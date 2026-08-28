/* =============================================================================
   Public API — everything the website reads, and the one thing it writes.

   The whole page is served from a single GET /api/site payload, memoised in
   process and invalidated whenever the admin panel writes. One round trip,
   and an admin edit shows up on the next reload.
   ========================================================================== */

import express from 'express';
import { all, get, run, settingsMap } from '../db.js';
import { wrap, bad, rateLimit, clientIp } from '../lib/http.js';
import * as v from '../lib/validate.js';
import * as google from '../lib/google.js';
import { formatPaise } from '../lib/money.js';

export const router = express.Router();

/* --------------------------------------------------------------------------
   Cache
   -------------------------------------------------------------------------- */

let cache = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

export function invalidateSiteCache() {
  cache = null;
  cachedAt = 0;
}

/* --------------------------------------------------------------------------
   Assembly
   -------------------------------------------------------------------------- */

const pub = 'is_published = 1';

function buildSections() {
  const sections = all(
    `SELECT s.id, s.key, s.kind, s.eyebrow, s.title, s.subtitle, s.body,
            s.cta_label, s.cta_href, m.url AS media_url, m.alt_text AS media_alt
       FROM sections s LEFT JOIN media m ON m.id = s.media_id
      WHERE s.${pub} ORDER BY s.sort_order ASC, s.id ASC`
  );

  const items = all(
    `SELECT i.id, i.section_id, i.title, i.body, i.value, i.suffix,
            m.url AS media_url, m.alt_text AS media_alt
       FROM section_items i LEFT JOIN media m ON m.id = i.media_id
      WHERE i.${pub} ORDER BY i.sort_order ASC, i.id ASC`
  );

  const byId = new Map(sections.map((s) => [s.id, { ...s, items: [] }]));
  for (const it of items) byId.get(it.section_id)?.items.push(it);

  // Keyed as well as ordered: the front end wants both "render in order" and
  // "give me the hero".
  const list = [...byId.values()];
  return { list, byKey: Object.fromEntries(list.map((s) => [s.key, s])) };
}

function buildServices() {
  const categories = all('SELECT id, name, slug, blurb FROM categories ORDER BY sort_order, name');
  const services = all(
    `SELECT s.id, s.slug, s.name, s.summary, s.body, s.duration_min,
            s.sessions_typical, s.price_from_paise, s.price_to_paise, s.price_note,
            s.is_emi_eligible, s.is_featured, s.category_id,
            c.name AS category_name, c.slug AS category_slug,
            m.url AS image_url, m.alt_text AS image_alt
       FROM services s
       LEFT JOIN categories c ON c.id = s.category_id
       LEFT JOIN media m ON m.id = s.media_id
      WHERE s.${pub} ORDER BY s.sort_order ASC, s.name ASC`
  ).map((s) => ({
    ...s,
    price_from: formatPaise(s.price_from_paise),
    price_to: s.price_to_paise ? formatPaise(s.price_to_paise) : null,
  }));

  return { categories, services };
}

async function buildReviews() {
  const summary = await google.ratingSummary();

  const rows = all(
    `SELECT t.id, t.author, t.rating, t.body, t.treatment, t.source,
            t.author_photo_url, t.reviewed_at, l.name AS location_name
       FROM testimonials t LEFT JOIN locations l ON l.id = t.location_id
      WHERE t.${pub}
      ORDER BY CASE t.source WHEN 'google' THEN 0 ELSE 1 END,
               t.sort_order ASC, t.reviewed_at DESC, t.id DESC`
  );

  const st = google.status();

  return {
    summary,
    // The site is told plainly which mode it is in so the UI can label it.
    integration: {
      mode: st.mode,
      live: st.mode === 'live',
      max_from_google: st.max_reviews_from_google,
    },
    items: rows.map((r) => ({
      ...r,
      is_google: r.source === 'google',
      is_seed: r.source === 'google-seed',
    })),
  };
}

async function buildGallery() {
  const st = google.status();
  const uploaded = all(
    `SELECT i.id, m.url, m.alt_text, m.credit
       FROM section_items i
       JOIN sections s ON s.id = i.section_id
       JOIN media m ON m.id = i.media_id
      WHERE s.kind = 'gallery' AND s.${pub} AND i.${pub}
      ORDER BY i.sort_order ASC, i.id ASC`
  ).map((r) => ({ url: r.url, alt: r.alt_text, credit: r.credit, source: 'library' }));

  let fromGoogle = [];
  if (st.mode === 'live') {
    const r = await google.placeDetails(st.place_id);
    if (r.ok && r.payload) {
      fromGoogle = google.normalisePhotos(r.payload, 8).map((p) => ({
        url: p.proxy_url,
        alt: 'Clinic photograph from Google',
        credit: p.attribution ? `Google · ${p.attribution}` : 'Google',
        source: 'google',
      }));
    }
  }

  return [...uploaded, ...fromGoogle];
}

async function buildPayload() {
  const s = settingsMap();
  const { list, byKey } = buildSections();

  return {
    generated_at: new Date().toISOString(),
    settings: s,
    sections: list,
    section: byKey,
    ...buildServices(),
    doctors: all(
      `SELECT d.id, d.name, d.credentials, d.role_title, d.registration_no,
              d.experience_years, d.languages, d.bio,
              m.url AS image_url, m.alt_text AS image_alt
         FROM doctors d LEFT JOIN media m ON m.id = d.media_id
        WHERE d.${pub} ORDER BY d.sort_order ASC, d.id ASC`
    ),
    locations: all(
      `SELECT id, name, address_line1, address_line2, city, state, pincode,
              phone, whatsapp, google_maps_url, hours, is_primary
         FROM locations WHERE ${pub} ORDER BY is_primary DESC, sort_order ASC`
    ),
    reviews: await buildReviews(),
    gallery: await buildGallery(),
  };
}

/* --------------------------------------------------------------------------
   Routes
   -------------------------------------------------------------------------- */

router.get('/site', wrap(async (_req, res) => {
  if (cache && Date.now() - cachedAt < CACHE_MS) return res.json(cache);
  cache = await buildPayload();
  cachedAt = Date.now();
  res.json(cache);
}));

router.get('/reviews', wrap(async (_req, res) => {
  res.json(await buildReviews());
}));

/* Google photo proxy. The API key stays server-side; the browser only ever
   sees this path. */
router.get('/photo/:name', wrap(async (req, res) => {
  try {
    const { body, mime, cached: fromDisk } = await google.photoBytes(req.params.name);
    res.set('Content-Type', mime);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Photo-Cache', fromDisk ? 'disk' : 'fetched');
    res.send(body);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
}));

/* --------------------------------------------------------------------------
   Enquiry submission
   -------------------------------------------------------------------------- */

const enquiryLimiter = rateLimit({
  name: 'enquiry',
  limit: 6,
  windowMs: 10 * 60_000,
  message: 'That is several enquiries in a short time. Please telephone the clinic instead.',
});

router.post('/enquiry', enquiryLimiter, wrap(async (req, res) => {
  const b = req.body || {};

  // Honeypot: a real person cannot fill a field they cannot see.
  if (v.str(b, 'website_url', { max: 200 })) {
    return res.status(202).json({ ok: true, id: null });
  }

  const name = v.str(b, 'name', { required: true, max: 120, label: 'Name' });
  const phone = v.phone(b, 'phone', { required: true, label: 'Phone number' });
  const email = v.email(b, 'email', { label: 'Email' });
  const message = v.str(b, 'message', { max: 4000, label: 'Message' });
  const preferred = v.str(b, 'preferred_time', { max: 120, label: 'Preferred time' });
  const consent = v.bool(b, 'consent');
  const wantsEmi = v.bool(b, 'wants_emi');

  if (!consent) {
    throw bad('Please tick the consent box so we may contact you.', { field: 'consent' });
  }

  const serviceId = v.fk(b, 'service_id', 'services', get, { label: 'Treatment' });
  const locationId = v.fk(b, 'location_id', 'locations', get, { label: 'Clinic' });

  const r = run(
    `INSERT INTO enquiries
       (name, phone, email, service_id, location_id, message, preferred_time,
        wants_emi, consent, status, source, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 'new', 'website', ?)`,
    name, phone, email, serviceId, locationId, message, preferred,
    wantsEmi, clientIp(req)
  );

  res.status(201).json({
    ok: true,
    id: Number(r.lastInsertRowid),
    /* The page already leads with a thank-you above this line, so repeating it
       here reads like a form letter. */
    message: 'Reception will call you back on this number during clinic hours.',
  });
}));
