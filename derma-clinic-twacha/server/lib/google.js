/* =============================================================================
   Google Places (New) v1 — reviews and place photos.

   Two things worth being straight about before reading this file:

   1. The Places API returns AT MOST 5 reviews for a place. There is no
      endpoint, paid or otherwise, that returns your full review history. So
      the site shows up to 5 live Google reviews and the rest of the wall is
      admin-curated testimonials. Anything claiming otherwise is scraping.

   2. The API key never reaches the browser. Photo bytes are proxied through
      /api/photo so the key stays on the server, which is also why the key can
      be locked to server-side use in the Google console.

   With no key configured, everything degrades to seeded rows that are labelled
   as seeded in both the admin panel and the API response. Nothing pretends.
   ========================================================================== */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, run, DATA_DIR } from '../db.js';

const BASE = 'https://places.googleapis.com/v1';
const PHOTO_CACHE = path.join(DATA_DIR, 'cache', 'photos');
fs.mkdirSync(PHOTO_CACHE, { recursive: true });

const TTL_MIN = Number(process.env.GOOGLE_CACHE_MINUTES || 360);
const TIMEOUT_MS = 8000;

export const apiKey = () => (process.env.GOOGLE_MAPS_API_KEY || '').trim();
export const hasKey = () => apiKey().length > 10;

/* --------------------------------------------------------------------------
   Cache
   -------------------------------------------------------------------------- */

function readCache(key) {
  const row = get('SELECT payload, fetched_at, ok, error FROM google_cache WHERE cache_key = ?', key);
  if (!row) return null;
  const ageMin = (Date.now() - new Date(`${row.fetched_at.replace(' ', 'T')}Z`).getTime()) / 60000;
  let payload = null;
  try { payload = JSON.parse(row.payload); } catch { /* corrupt row, treat as miss */ }
  return { payload, ageMin, ok: !!row.ok, error: row.error, fetched_at: row.fetched_at };
}

function writeCache(key, payload, ok = true, error = null) {
  run(
    `INSERT INTO google_cache (cache_key, payload, fetched_at, ok, error)
     VALUES (?, ?, datetime('now'), ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       payload = excluded.payload, fetched_at = excluded.fetched_at,
       ok = excluded.ok, error = excluded.error`,
    key, JSON.stringify(payload ?? null), ok ? 1 : 0, error
  );
}

/* --------------------------------------------------------------------------
   Requests
   -------------------------------------------------------------------------- */

async function call(url, fieldMask) {
  const res = await fetch(url, {
    headers: {
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask': fieldMask,
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = `Google returned ${res.status}`;
    try {
      const j = JSON.parse(text);
      if (j?.error?.message) msg = j.error.message;
    } catch { /* keep the status-code message */ }
    throw new Error(msg);
  }
  return JSON.parse(text);
}

const PLACE_FIELDS = [
  'id', 'displayName', 'formattedAddress', 'rating', 'userRatingCount',
  'googleMapsUri', 'reviews', 'photos', 'currentOpeningHours.weekdayDescriptions',
].join(',');

/**
 * Place details, cached for GOOGLE_CACHE_MINUTES. On a network or quota
 * failure the last good payload is served rather than blanking the review
 * wall — a stale review is far better than an empty section.
 */
export async function placeDetails(placeId, { force = false } = {}) {
  if (!placeId) return { ok: false, reason: 'no-place-id', payload: null };
  if (!hasKey()) return { ok: false, reason: 'no-key', payload: null };

  const key = `place:${placeId}`;
  const cached = readCache(key);

  if (!force && cached?.payload && cached.ok && cached.ageMin < TTL_MIN) {
    return { ok: true, reason: 'cache', payload: cached.payload, ageMin: cached.ageMin };
  }

  try {
    const payload = await call(`${BASE}/places/${encodeURIComponent(placeId)}`, PLACE_FIELDS);
    writeCache(key, payload, true, null);
    return { ok: true, reason: 'live', payload, ageMin: 0 };
  } catch (err) {
    writeCache(key, cached?.payload ?? null, false, err.message);
    if (cached?.payload) {
      return { ok: true, reason: 'stale', payload: cached.payload, ageMin: cached.ageMin, error: err.message };
    }
    return { ok: false, reason: 'error', payload: null, error: err.message };
  }
}

/** Admin helper: search by name so the owner can find their own Place ID. */
export async function findPlace(query) {
  if (!hasKey()) throw new Error('No Google Maps API key is configured.');

  const res = await fetch(`${BASE}/places:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey(),
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
    },
    body: JSON.stringify({ textQuery: query, maxResultCount: 8 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await res.text();
  if (!res.ok) {
    let msg = `Google returned ${res.status}`;
    try { const j = JSON.parse(text); if (j?.error?.message) msg = j.error.message; } catch {}
    throw new Error(msg);
  }
  return JSON.parse(text).places || [];
}

/* --------------------------------------------------------------------------
   Normalising
   -------------------------------------------------------------------------- */

export function normaliseReviews(payload) {
  const list = payload?.reviews || [];
  return list.map((r) => ({
    google_review_id: r.name || null,
    author: r.authorAttribution?.displayName || 'Google user',
    author_photo_url: r.authorAttribution?.photoUri || null,
    rating: Number(r.rating) || null,
    body: r.originalText?.text || r.text?.text || '',
    reviewed_at: r.publishTime ? String(r.publishTime).slice(0, 10) : null,
    relative: r.relativePublishTimeDescription || null,
  })).filter((r) => r.body.trim().length > 0);
}

export function normalisePhotos(payload, limit = 8) {
  return (payload?.photos || []).slice(0, limit).map((p) => ({
    name: p.name,
    proxy_url: `/api/photo/${encodeURIComponent(p.name)}`,
    attribution: p.authorAttributions?.[0]?.displayName || null,
    width: p.widthPx || null,
    height: p.heightPx || null,
  }));
}

/* --------------------------------------------------------------------------
   Photo proxy, with a disk cache so a page view does not equal a billed call
   -------------------------------------------------------------------------- */

export async function photoBytes(photoName, maxPx = 1200) {
  if (!hasKey()) throw new Error('No Google Maps API key is configured.');
  if (!/^places\/[A-Za-z0-9_\-]+\/photos\/[A-Za-z0-9_\-]+$/.test(photoName)) {
    throw new Error('Malformed photo reference.');
  }

  const hash = crypto.createHash('sha1').update(`${photoName}:${maxPx}`).digest('hex');
  const file = path.join(PHOTO_CACHE, `${hash}.bin`);
  const meta = `${file}.json`;

  if (fs.existsSync(file) && fs.existsSync(meta)) {
    const info = JSON.parse(fs.readFileSync(meta, 'utf8'));
    const ageMin = (Date.now() - info.at) / 60000;
    if (ageMin < TTL_MIN * 4) {
      return { body: fs.readFileSync(file), mime: info.mime, cached: true };
    }
  }

  const url = `${BASE}/${photoName}/media?maxHeightPx=${maxPx}&skipHttpRedirect=true`;
  const res = await fetch(url, {
    headers: { 'X-Goog-Api-Key': apiKey() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Google returned ${res.status} for that photo.`);

  const { photoUri } = JSON.parse(await res.text());
  if (!photoUri) throw new Error('Google did not return a photo URL.');

  const img = await fetch(photoUri, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!img.ok) throw new Error(`Photo fetch failed with ${img.status}.`);

  const body = Buffer.from(await img.arrayBuffer());
  const mime = img.headers.get('content-type') || 'image/jpeg';
  fs.writeFileSync(file, body);
  fs.writeFileSync(meta, JSON.stringify({ at: Date.now(), mime }));

  return { body, mime, cached: false };
}

/* --------------------------------------------------------------------------
   Sync into the testimonials table
   -------------------------------------------------------------------------- */

/**
 * Upsert Google reviews as testimonials keyed on google_review_id, so running
 * this twice updates rather than duplicating. Existing publish flags and sort
 * order are preserved — the owner's editorial decisions survive a re-sync.
 */
export async function syncReviews(placeId, locationId = null) {
  const result = await placeDetails(placeId, { force: true });
  if (!result.ok) {
    return { ok: false, error: result.error || result.reason, inserted: 0, updated: 0 };
  }

  const reviews = normaliseReviews(result.payload);
  let inserted = 0;
  let updated = 0;

  for (const r of reviews) {
    if (!r.google_review_id) continue;
    const existing = get('SELECT id FROM testimonials WHERE google_review_id = ?', r.google_review_id);

    if (existing) {
      run(
        `UPDATE testimonials
            SET author = ?, rating = ?, body = ?, author_photo_url = ?, reviewed_at = ?
          WHERE id = ?`,
        r.author, r.rating, r.body, r.author_photo_url, r.reviewed_at, existing.id
      );
      updated++;
    } else {
      run(
        `INSERT INTO testimonials
           (author, rating, body, source, google_review_id, author_photo_url,
            reviewed_at, location_id, is_published, sort_order)
         VALUES (?, ?, ?, 'google', ?, ?, ?, ?, 1, 0)`,
        r.author, r.rating, r.body, r.google_review_id,
        r.author_photo_url, r.reviewed_at, locationId
      );
      inserted++;
    }
  }

  return {
    ok: true,
    inserted,
    updated,
    rating: result.payload?.rating ?? null,
    total_ratings: result.payload?.userRatingCount ?? null,
    returned: reviews.length,
  };
}

/** What the admin dashboard shows about the integration. */
export function status() {
  const placeId = get(
    `SELECT google_place_id AS id FROM locations
      WHERE google_place_id IS NOT NULL AND google_place_id != ''
      ORDER BY is_primary DESC, sort_order ASC LIMIT 1`
  );
  const cached = placeId ? readCache(`place:${placeId.id}`) : null;
  const googleRows = get(
    `SELECT COUNT(*) AS n FROM testimonials WHERE source = 'google'`
  );
  const seedRows = get(
    `SELECT COUNT(*) AS n FROM testimonials WHERE source = 'google-seed'`
  );

  return {
    key_present: hasKey(),
    place_id: placeId?.id || null,
    cache_ttl_minutes: TTL_MIN,
    last_fetch: cached?.fetched_at || null,
    last_fetch_ok: cached ? cached.ok : null,
    last_error: cached?.error || null,
    cache_age_minutes: cached ? Math.round(cached.ageMin) : null,
    live_review_count: googleRows?.n || 0,
    seeded_review_count: seedRows?.n || 0,
    max_reviews_from_google: 5,
    mode: hasKey() ? (placeId?.id ? 'live' : 'key-without-place-id') : 'seeded',
  };
}

/** Rating headline for the site: prefers Google's real numbers when available. */
export async function ratingSummary() {
  const st = status();
  if (st.mode === 'live') {
    const r = await placeDetails(st.place_id);
    if (r.ok && r.payload) {
      return {
        rating: r.payload.rating ?? null,
        total: r.payload.userRatingCount ?? null,
        source: 'google',
        stale: r.reason === 'stale',
      };
    }
  }
  const agg = get(
    `SELECT ROUND(AVG(rating), 1) AS rating, COUNT(*) AS total
       FROM testimonials WHERE is_published = 1 AND rating IS NOT NULL`
  );
  return {
    rating: agg?.rating ?? null,
    total: agg?.total ?? 0,
    source: 'seeded',
    stale: false,
  };
}
