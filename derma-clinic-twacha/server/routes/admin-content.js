/* =============================================================================
   Admin — content CRUD, media library, settings, Google integration.

   The CRUD engine is driven by an explicit per-resource field map. That map is
   also the mass-assignment allow-list: a column that is not named there cannot
   be written by a request, whatever the request body contains.
   ========================================================================== */

import express from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { all, get, run, tx, UPLOAD_DIR, settingsMap, putSetting } from '../db.js';
import { wrap, bad, notFound, forbidden, rateLimit } from '../lib/http.js';
import * as v from '../lib/validate.js';
import * as google from '../lib/google.js';
import { log } from '../lib/activity.js';
import { toPaise } from '../lib/money.js';
import { hashPassword, verifyPassword } from '../lib/auth.js';
import { invalidateSiteCache } from './public.js';

export const router = express.Router();

/* --------------------------------------------------------------------------
   Resource definitions
   -------------------------------------------------------------------------- */

const fkOpt = (field, table, label) => (b) => v.fk(b, field, table, get, { label });

const RESOURCES = {
  sections: {
    table: 'sections',
    write: ['owner', 'manager'],
    order: 'sort_order ASC, id ASC',
    search: ['key', 'title', 'body'],
    reorderable: true,
    listSql: `SELECT s.*, m.url AS media_url,
                     (SELECT COUNT(*) FROM section_items i WHERE i.section_id = s.id) AS item_count
                FROM sections s LEFT JOIN media m ON m.id = s.media_id`,
    columns: {
      key: { required: true, parse: (b) => v.slug(b, 'key', b.title, { label: 'Key' }) },
      kind: { required: true, parse: (b) => v.pick(b, 'kind',
        ['hero', 'stats', 'prose', 'steps', 'faq', 'cta', 'gallery', 'emi'],
        { required: true, label: 'Section type' }) },
      eyebrow: { parse: (b) => v.str(b, 'eyebrow', { max: 120 }) },
      title: { parse: (b) => v.str(b, 'title', { max: 240 }) },
      subtitle: { parse: (b) => v.str(b, 'subtitle', { max: 400 }) },
      body: { parse: (b) => v.str(b, 'body', { max: 20000 }) },
      cta_label: { parse: (b) => v.str(b, 'cta_label', { max: 80 }) },
      cta_href: { parse: (b) => v.href(b, 'cta_href', { label: 'Button link' }) },
      media_id: { parse: fkOpt('media_id', 'media', 'Image') },
      sort_order: { parse: (b) => v.int(b, 'sort_order', { min: 0, max: 9999 }) ?? 0 },
      is_published: { parse: (b) => v.bool(b, 'is_published') },
    },
  },

  section_items: {
    table: 'section_items',
    write: ['owner', 'manager'],
    order: 'sort_order ASC, id ASC',
    search: ['title', 'body'],
    reorderable: true,
    scope: 'section_id',
    listSql: `SELECT i.*, m.url AS media_url, s.key AS section_key, s.kind AS section_kind
                FROM section_items i
                LEFT JOIN media m ON m.id = i.media_id
                JOIN sections s ON s.id = i.section_id`,
    columns: {
      section_id: { required: true, parse: (b) => v.fk(b, 'section_id', 'sections', get, { required: true, label: 'Section' }) },
      title: { parse: (b) => v.str(b, 'title', { max: 240 }) },
      body: { parse: (b) => v.str(b, 'body', { max: 8000 }) },
      value: { parse: (b) => v.str(b, 'value', { max: 40 }) },
      suffix: { parse: (b) => v.str(b, 'suffix', { max: 40 }) },
      media_id: { parse: fkOpt('media_id', 'media', 'Image') },
      sort_order: { parse: (b) => v.int(b, 'sort_order', { min: 0, max: 9999 }) ?? 0 },
      is_published: { parse: (b) => v.bool(b, 'is_published') },
    },
  },

  categories: {
    table: 'categories',
    write: ['owner', 'manager'],
    order: 'sort_order ASC, name ASC',
    search: ['name'],
    reorderable: true,
    columns: {
      name: { required: true, parse: (b) => v.str(b, 'name', { required: true, max: 120, label: 'Name' }) },
      slug: { required: true, parse: (b) => v.slug(b, 'slug', b.name, { label: 'Slug' }) },
      blurb: { parse: (b) => v.str(b, 'blurb', { max: 400 }) },
      sort_order: { parse: (b) => v.int(b, 'sort_order', { min: 0, max: 9999 }) ?? 0 },
    },
  },

  services: {
    table: 'services',
    write: ['owner', 'manager'],
    order: 's.sort_order ASC, s.name ASC',
    search: ['s.name', 's.summary'],
    reorderable: true,
    listSql: `SELECT s.*, c.name AS category_name, m.url AS image_url
                FROM services s
                LEFT JOIN categories c ON c.id = s.category_id
                LEFT JOIN media m ON m.id = s.media_id`,
    columns: {
      name: { required: true, parse: (b) => v.str(b, 'name', { required: true, max: 160, label: 'Treatment name' }) },
      slug: { required: true, parse: (b) => v.slug(b, 'slug', b.name, { label: 'Slug' }) },
      category_id: { parse: fkOpt('category_id', 'categories', 'Category') },
      summary: { parse: (b) => v.str(b, 'summary', { max: 400 }) },
      body: { parse: (b) => v.str(b, 'body', { max: 20000 }) },
      duration_min: { parse: (b) => v.int(b, 'duration_min', { min: 0, max: 1440, label: 'Duration' }) },
      sessions_typical: { parse: (b) => v.str(b, 'sessions_typical', { max: 80 }) },
      price_from_paise: { parse: (b) => v.paiseField(b, 'price_from', toPaise, { min: 0, max: 100_000_000, label: 'Price from' }) },
      price_to_paise: { parse: (b) => v.paiseField(b, 'price_to', toPaise, { min: 0, max: 100_000_000, label: 'Price to' }) },
      price_note: { parse: (b) => v.str(b, 'price_note', { max: 200 }) },
      is_emi_eligible: { parse: (b) => v.bool(b, 'is_emi_eligible') },
      media_id: { parse: fkOpt('media_id', 'media', 'Image') },
      sort_order: { parse: (b) => v.int(b, 'sort_order', { min: 0, max: 9999 }) ?? 0 },
      is_featured: { parse: (b) => v.bool(b, 'is_featured') },
      is_published: { parse: (b) => v.bool(b, 'is_published') },
    },
    validate(data) {
      if (data.price_from_paise != null && data.price_to_paise != null
          && data.price_to_paise < data.price_from_paise) {
        throw bad('"Price to" cannot be lower than "Price from".', { field: 'price_to' });
      }
    },
  },

  doctors: {
    table: 'doctors',
    write: ['owner', 'manager'],
    order: 'd.sort_order ASC, d.id ASC',
    search: ['d.name', 'd.credentials'],
    reorderable: true,
    listSql: `SELECT d.*, m.url AS image_url FROM doctors d LEFT JOIN media m ON m.id = d.media_id`,
    columns: {
      name: { required: true, parse: (b) => v.str(b, 'name', { required: true, max: 160, label: 'Name' }) },
      credentials: { parse: (b) => v.str(b, 'credentials', { max: 200 }) },
      role_title: { parse: (b) => v.str(b, 'role_title', { max: 160 }) },
      registration_no: { parse: (b) => v.str(b, 'registration_no', { max: 120 }) },
      experience_years: { parse: (b) => v.int(b, 'experience_years', { min: 0, max: 70, label: 'Years of experience' }) },
      languages: { parse: (b) => v.str(b, 'languages', { max: 200 }) },
      bio: { parse: (b) => v.str(b, 'bio', { max: 8000 }) },
      media_id: { parse: fkOpt('media_id', 'media', 'Photograph') },
      sort_order: { parse: (b) => v.int(b, 'sort_order', { min: 0, max: 9999 }) ?? 0 },
      is_published: { parse: (b) => v.bool(b, 'is_published') },
    },
  },

  locations: {
    table: 'locations',
    write: ['owner', 'manager'],
    order: 'is_primary DESC, sort_order ASC',
    search: ['name', 'address_line1', 'city'],
    reorderable: true,
    columns: {
      name: { required: true, parse: (b) => v.str(b, 'name', { required: true, max: 160, label: 'Clinic name' }) },
      address_line1: { parse: (b) => v.str(b, 'address_line1', { max: 200 }) },
      address_line2: { parse: (b) => v.str(b, 'address_line2', { max: 200 }) },
      city: { parse: (b) => v.str(b, 'city', { max: 80 }) },
      state: { parse: (b) => v.str(b, 'state', { max: 80 }) },
      pincode: { parse: (b) => v.str(b, 'pincode', { max: 12 }) },
      phone: { parse: (b) => v.phone(b, 'phone', { label: 'Phone' }) },
      whatsapp: { parse: (b) => v.phone(b, 'whatsapp', { label: 'WhatsApp' }) },
      google_place_id: { parse: (b) => v.str(b, 'google_place_id', { max: 200 }) },
      google_maps_url: { parse: (b) => v.url(b, 'google_maps_url', { max: 600, label: 'Google Maps link' }) },
      hours: { parse: (b) => v.str(b, 'hours', { max: 1000 }) },
      is_primary: { parse: (b) => v.bool(b, 'is_primary') },
      sort_order: { parse: (b) => v.int(b, 'sort_order', { min: 0, max: 9999 }) ?? 0 },
      is_published: { parse: (b) => v.bool(b, 'is_published') },
    },
  },

  testimonials: {
    table: 'testimonials',
    write: ['owner', 'manager'],
    order: 't.sort_order ASC, t.id DESC',
    search: ['t.author', 't.body'],
    reorderable: true,
    listSql: `SELECT t.*, l.name AS location_name
                FROM testimonials t LEFT JOIN locations l ON l.id = t.location_id`,
    columns: {
      author: { required: true, parse: (b) => v.str(b, 'author', { required: true, max: 120, label: 'Patient name' }) },
      rating: { parse: (b) => v.int(b, 'rating', { min: 1, max: 5, label: 'Rating' }) },
      body: { required: true, parse: (b) => v.str(b, 'body', { required: true, max: 4000, label: 'Review' }) },
      treatment: { parse: (b) => v.str(b, 'treatment', { max: 160 }) },
      reviewed_at: { parse: (b) => v.date(b, 'reviewed_at', { label: 'Review date' }) },
      location_id: { parse: fkOpt('location_id', 'locations', 'Clinic') },
      sort_order: { parse: (b) => v.int(b, 'sort_order', { min: 0, max: 9999 }) ?? 0 },
      is_published: { parse: (b) => v.bool(b, 'is_published') },
    },
    /* Google-sourced rows are read-only apart from ordering and publishing —
       editing the text of somebody's public review would be dishonest. */
    guardUpdate(existing, data) {
      if (existing.source === 'google') {
        const allowed = new Set(['sort_order', 'is_published']);
        for (const k of Object.keys(data)) {
          if (!allowed.has(k)) {
            throw forbidden('A Google review cannot be edited here — only hidden or reordered. Re-sync to refresh its text.');
          }
        }
      }
    },
  },

  patients: {
    table: 'patients',
    write: ['owner', 'manager', 'staff'],
    order: 'id DESC',
    search: ['name', 'phone', 'email', 'ref'],
    columns: {
      name: { required: true, parse: (b) => v.str(b, 'name', { required: true, max: 160, label: 'Name' }) },
      phone: { required: true, parse: (b) => v.phone(b, 'phone', { required: true, label: 'Phone' }) },
      email: { parse: (b) => v.email(b, 'email', { label: 'Email' }) },
      address: { parse: (b) => v.str(b, 'address', { max: 400 }) },
      city: { parse: (b) => v.str(b, 'city', { max: 80 }) },
      notes: { parse: (b) => v.str(b, 'notes', { max: 4000 }) },
    },
    afterCreate(id) {
      run('UPDATE patients SET ref = ? WHERE id = ? AND ref IS NULL', `PT-${String(id).padStart(4, '0')}`, id);
    },
  },

  users: {
    table: 'users',
    write: ['owner'],
    /* Colleagues' e-mail addresses, roles and last sign-in times. The panel
       already hides this screen from a staff account; without a read gate the
       API would still hand the list over to anyone who asked for it. */
    read: ['owner', 'manager'],
    order: 'id ASC',
    search: ['name', 'email'],
    listSql: `SELECT id, email, name, role, is_active, last_login_at, created_at FROM users u`,
    columns: {
      name: { required: true, parse: (b) => v.str(b, 'name', { required: true, max: 160, label: 'Name' }) },
      email: { required: true, parse: (b) => v.email(b, 'email', { required: true, label: 'Email' }) },
      role: { required: true, parse: (b) => v.pick(b, 'role', ['owner', 'manager', 'staff'], { required: true, label: 'Role' }) },
      is_active: { parse: (b) => v.bool(b, 'is_active') },
      password_hash: { required: true, parse: (b) => hashPassword(requirePassword(b)) },
    },
    preCreate(body) {
      requirePassword(body);
    },
    /* Passwords are changed through their own endpoint, never as a field on a
       general edit form, so a stray empty input cannot blank a credential. */
    guardUpdate(_existing, data) {
      delete data.password_hash;
    },
  },
};

function requirePassword(body) {
  const pw = v.str(body, 'password', { required: true, min: 10, max: 200, label: 'Password' });
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) {
    throw bad('Password must contain at least one letter and one number.', { field: 'password' });
  }
  return pw;
}

/* Resources whose rows the site renders, so a write should drop the cache. */
const PUBLIC_FACING = new Set([
  'sections', 'section_items', 'categories', 'services',
  'doctors', 'locations', 'testimonials', 'media',
]);

/* --------------------------------------------------------------------------
   Engine
   -------------------------------------------------------------------------- */

function spec(name) {
  const s = RESOURCES[name];
  if (!s) throw notFound(`Unknown resource "${name}".`);
  return s;
}

function assertWrite(req, s) {
  if (!s.write.includes(req.user.role)) {
    throw forbidden(`Your role (${req.user.role}) cannot change this.`);
  }
}

/** Most resources are readable by anyone signed in; `read` narrows that. */
function assertRead(req, s) {
  if (s.read && !s.read.includes(req.user.role)) {
    throw forbidden(`Your role (${req.user.role}) cannot view this.`);
  }
}

/**
 * Build the column map. In partial mode only keys present in the body count.
 *
 * Async because password hashing is: it is the one parser that has to leave the
 * event loop. Awaiting a plain value is harmless, so the other parsers are
 * unaffected.
 */
async function parseColumns(s, body, { partial }) {
  const data = {};
  for (const [col, def] of Object.entries(s.columns)) {
    // The public field name may differ from the column (price_from -> price_from_paise).
    const alias = col.replace(/_paise$/, '');
    const present = Object.hasOwn(body, col) || Object.hasOwn(body, alias);
    if (partial && !present) continue;
    data[col] = await def.parse(body);
  }
  if (s.validate) s.validate(data, body);
  return data;
}

router.get('/:resource', wrap(async (req, res) => {
  const name = req.params.resource;
  const s = spec(name);
  assertRead(req, s);

  const limit = Math.min(v.int(req.query, 'limit', { min: 1, max: 500 }) ?? 200, 500);
  const offset = v.int(req.query, 'offset', { min: 0 }) ?? 0;
  const q = v.str(req.query, 'q', { max: 120 });

  const where = [];
  const params = [];

  if (q && s.search?.length) {
    where.push(`(${s.search.map((c) => `${c} LIKE ?`).join(' OR ')})`);
    for (let i = 0; i < s.search.length; i++) params.push(`%${q}%`);
  }
  if (s.scope && req.query[s.scope]) {
    where.push(`${s.scope} = ?`);
    params.push(Number(req.query[s.scope]));
  }

  const base = s.listSql || `SELECT * FROM ${s.table}`;
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const rows = all(`${base}${clause} ORDER BY ${s.order} LIMIT ? OFFSET ?`, ...params, limit, offset);
  const total = get(`SELECT COUNT(*) AS n FROM (${base}${clause})`, ...params);

  res.json({ items: rows, total: total?.n ?? rows.length, limit, offset });
}));

router.get('/:resource/:id', wrap(async (req, res) => {
  const s = spec(req.params.resource);
  assertRead(req, s);
  const base = s.listSql || `SELECT * FROM ${s.table}`;
  const row = get(`SELECT * FROM (${base}) WHERE id = ?`, Number(req.params.id));
  if (!row) throw notFound('That record no longer exists.');
  res.json(row);
}));

router.post('/:resource', wrap(async (req, res) => {
  const name = req.params.resource;
  const s = spec(name);
  assertWrite(req, s);

  s.preCreate?.(req.body || {}, req);
  const data = await parseColumns(s, req.body || {}, { partial: false });
  const cols = Object.keys(data);

  let id;
  try {
    const r = run(
      `INSERT INTO ${s.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
      ...cols.map((c) => data[c])
    );
    id = Number(r.lastInsertRowid);
  } catch (err) {
    throw translateSqlite(err, s);
  }

  s.afterCreate?.(id, data, req);
  log(req, 'create', name, id, { name: data.name || data.title || data.key || null });
  if (PUBLIC_FACING.has(name)) invalidateSiteCache();

  res.status(201).json({ ok: true, id });
}));

router.patch('/:resource/:id', wrap(async (req, res) => {
  const name = req.params.resource;
  const s = spec(name);
  assertWrite(req, s);

  const id = Number(req.params.id);
  const existing = get(`SELECT * FROM ${s.table} WHERE id = ?`, id);
  if (!existing) throw notFound('That record no longer exists.');

  const data = await parseColumns(s, req.body || {}, { partial: true });
  s.guardUpdate?.(existing, data, req);
  if (!Object.keys(data).length) throw bad('Nothing to update.');

  // An owner locking themselves out is a support call nobody enjoys.
  if (name === 'users' && id === req.user.id) {
    if (data.role && data.role !== existing.role) throw bad('You cannot change your own role.');
    if (data.is_active === 0) throw bad('You cannot deactivate your own account.');
  }

  const cols = Object.keys(data);
  try {
    run(
      `UPDATE ${s.table} SET ${cols.map((c) => `${c} = ?`).join(', ')}
         ${hasColumn(s.table, 'updated_at') ? `, updated_at = datetime('now')` : ''}
       WHERE id = ?`,
      ...cols.map((c) => data[c]), id
    );
  } catch (err) {
    throw translateSqlite(err, s);
  }

  /* The record's own label goes in as well as the field list. "Sections #1,
     10 fields" tells you nothing six weeks later; "Hero — 10 fields" does. */
  log(req, 'update', name, id, {
    name: existing.name || existing.title || existing.key || null,
    fields: cols,
  });
  if (PUBLIC_FACING.has(name)) invalidateSiteCache();

  res.json({ ok: true, id });
}));

router.delete('/:resource/:id', wrap(async (req, res) => {
  const name = req.params.resource;
  const s = spec(name);
  assertWrite(req, s);

  const id = Number(req.params.id);
  const existing = get(`SELECT * FROM ${s.table} WHERE id = ?`, id);
  if (!existing) throw notFound('That record no longer exists.');

  if (name === 'users') {
    if (id === req.user.id) throw bad('You cannot delete your own account.');
    const owners = get(`SELECT COUNT(*) AS n FROM users WHERE role = 'owner' AND is_active = 1`);
    if (existing.role === 'owner' && owners.n <= 1) {
      throw bad('This is the last active owner account. Promote somebody else first.');
    }
  }

  run(`DELETE FROM ${s.table} WHERE id = ?`, id);
  log(req, 'delete', name, id, { name: existing.name || existing.title || existing.key || null });
  if (PUBLIC_FACING.has(name)) invalidateSiteCache();

  res.json({ ok: true });
}));

/** Drag-to-reorder: [{id, sort_order}, ...] applied in one transaction. */
router.post('/:resource/reorder', wrap(async (req, res) => {
  const name = req.params.resource;
  const s = spec(name);
  assertWrite(req, s);
  if (!s.reorderable) throw bad('This list cannot be reordered.');

  const order = req.body?.order;
  if (!Array.isArray(order) || !order.length) throw bad('Send an "order" array of ids.');

  tx(() => {
    const stmt = `UPDATE ${s.table} SET sort_order = ? WHERE id = ?`;
    order.forEach((id, i) => run(stmt, i, Number(id)));
  });

  log(req, 'reorder', name, null, { count: order.length });
  if (PUBLIC_FACING.has(name)) invalidateSiteCache();
  res.json({ ok: true });
}));

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

const columnCache = new Map();
function hasColumn(table, column) {
  if (!columnCache.has(table)) {
    columnCache.set(table, new Set(all(`PRAGMA table_info(${table})`).map((r) => r.name)));
  }
  return columnCache.get(table).has(column);
}

/** Turn SQLite constraint noise into something an owner can act on. */
function translateSqlite(err, s) {
  const m = String(err.message || '');
  if (m.includes('UNIQUE constraint failed')) {
    const col = m.split(':').pop()?.trim().split('.').pop();
    return bad(`Another record already uses that ${col || 'value'}. Pick a different one.`, { field: col });
  }
  if (m.includes('FOREIGN KEY constraint failed')) {
    return bad('That refers to a record that does not exist.');
  }
  if (m.includes('CHECK constraint failed')) {
    return bad('One of the values is outside what this field allows.');
  }
  return err;
}

export { RESOURCES };

/* =============================================================================
   Media library

   Registered after the generic engine, on a distinct path prefix, so uploads
   and their file-system side effects never go through generic CRUD.
   ========================================================================== */

const ALLOWED_IMAGE = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

/* The extension a given image type is allowed to be stored under. Nothing
   outside this map ever reaches disk, which is what stops /uploads serving
   something the browser would treat as a document. */
const EXT_FOR_MIME = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/avif': '.avif',
  'image/gif': '.gif',
};

/**
 * Identify an image by its leading bytes.
 *
 * file.mimetype is only the Content-Type the client typed into the multipart
 * part, and the extension used to come from the client's filename, so a file
 * called payload.html declaring image/png was stored as .html and served back
 * as text/html — script execution on this origin, from an upload form. The
 * bytes are the only part of an upload the client cannot lie about.
 */
function sniffImage(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))) return 'image/png';
  if (buf.subarray(0, 6).toString('latin1').startsWith('GIF8')) return 'image/gif';
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF'
      && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  /* AVIF and other ISO-BMFF: 'ftyp' at byte 4, brand follows. */
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (['avif', 'avis', 'mif1', 'msf1'].includes(brand)) return 'image/avif';
  }
  return null;
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    /* Provisional name only — no extension at all, so nothing is servable as a
       document even in the window before the bytes have been checked. The final
       name is applied once sniffImage has spoken. */
    filename: (_req, _file, cb) =>
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.part`),
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    // A cheap first pass; the authoritative check is on the bytes, after write.
    if (!ALLOWED_IMAGE.has(file.mimetype)) {
      return cb(new Error('Only JPEG, PNG, WebP, AVIF or GIF images can be uploaded.'));
    }
    cb(null, true);
  },
});

export const mediaRouter = express.Router();

/**
 * The media library is website content, so it follows the same rule as every
 * other content resource: owners and managers write, everyone signed in reads.
 *
 * This router is mounted on its own path and so never passed through the
 * generic engine's assertWrite — which meant it had no role check at all, and a
 * staff account could delete an image that was live on the public site.
 */
function requireContentWrite(req, _res, next) {
  if (!['owner', 'manager'].includes(req.user.role)) {
    return next(forbidden(`Your role (${req.user.role}) cannot change the media library.`));
  }
  next();
}

mediaRouter.get('/', wrap(async (req, res) => {
  const limit = Math.min(v.int(req.query, 'limit', { min: 1, max: 500 }) ?? 200, 500);
  const q = v.str(req.query, 'q', { max: 120 });
  const rows = q
    ? all(`SELECT * FROM media WHERE alt_text LIKE ? OR original_name LIKE ?
             ORDER BY id DESC LIMIT ?`, `%${q}%`, `%${q}%`, limit)
    : all('SELECT * FROM media ORDER BY id DESC LIMIT ?', limit);

  res.json({ items: rows.map((m) => ({ ...m, usage: mediaUsage(m.id) })), total: rows.length });
}));

mediaRouter.post('/upload', requireContentWrite, upload.array('files', 12), wrap(async (req, res) => {
  if (!req.files?.length) throw bad('No files were received.');

  const alt = v.str(req.body, 'alt_text', { max: 300 }) || '';
  const created = [];
  const rejected = [];

  for (const f of req.files) {
    const head = Buffer.alloc(16);
    let sniffed = null;
    try {
      const fd = fs.openSync(f.path, 'r');
      try { fs.readSync(fd, head, 0, 16, 0); } finally { fs.closeSync(fd); }
      sniffed = sniffImage(head);
    } catch { /* unreadable, treated as a rejection below */ }

    if (!sniffed) {
      // Never leave an unidentified file sitting in a directory that is served.
      try { fs.unlinkSync(f.path); } catch { /* already gone */ }
      rejected.push(f.originalname);
      continue;
    }

    const finalName = path.basename(f.filename, '.part') + EXT_FOR_MIME[sniffed];
    fs.renameSync(f.path, path.join(UPLOAD_DIR, finalName));

    const r = run(
      `INSERT INTO media (source, url, filename, original_name, mime, size_bytes, alt_text)
       VALUES ('upload', ?, ?, ?, ?, ?, ?)`,
      `/uploads/${finalName}`, finalName, f.originalname, sniffed, f.size, alt
    );
    created.push({ id: Number(r.lastInsertRowid), url: `/uploads/${finalName}` });
  }

  if (!created.length) {
    throw bad(`That is not an image file. ${rejected.join(', ')} was rejected after reading its contents.`);
  }

  log(req, 'upload', 'media', null, { count: created.length, rejected: rejected.length || undefined });
  invalidateSiteCache();
  res.status(201).json({
    ok: true,
    items: created,
    ...(rejected.length ? { rejected, note: `${rejected.length} file(s) were not images and were discarded.` } : {}),
  });
}));

/* Link an image by URL — the practical route for a Google Maps or Street View
   photograph the owner already has a link to. */
mediaRouter.post('/link', requireContentWrite, wrap(async (req, res) => {
  const url = v.url(req.body, 'url', { required: true, label: 'Image URL' });
  const alt = v.str(req.body, 'alt_text', { max: 300 }) || '';
  const credit = v.str(req.body, 'credit', { max: 200 });

  const r = run(
    `INSERT INTO media (source, url, alt_text, credit, mime) VALUES ('url', ?, ?, ?, 'image/*')`,
    url, alt, credit
  );
  log(req, 'link', 'media', Number(r.lastInsertRowid), { url });
  invalidateSiteCache();
  res.status(201).json({ ok: true, id: Number(r.lastInsertRowid), url });
}));

mediaRouter.patch('/:id', requireContentWrite, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!get('SELECT id FROM media WHERE id = ?', id)) throw notFound('That image is gone.');

  const alt = v.str(req.body, 'alt_text', { max: 300 }) ?? '';
  const credit = v.str(req.body, 'credit', { max: 200 });
  run('UPDATE media SET alt_text = ?, credit = ? WHERE id = ?', alt, credit, id);

  log(req, 'update', 'media', id, null);
  invalidateSiteCache();
  res.json({ ok: true });
}));

/** Where an image is referenced. Deleting one in use would silently blank a
    section, so the answer is shown before it is allowed. */
function mediaUsage(id) {
  const spots = [
    ['sections', 'Page section', 'SELECT key AS label FROM sections WHERE media_id = ?'],
    // Single quotes: SQLite reads "item" as an identifier, not a string.
    ['section_items', 'Section item', `SELECT COALESCE(title, 'Untitled item') AS label FROM section_items WHERE media_id = ?`],
    ['services', 'Treatment', 'SELECT name AS label FROM services WHERE media_id = ?'],
    ['doctors', 'Doctor', 'SELECT name AS label FROM doctors WHERE media_id = ?'],
  ];
  const out = [];
  for (const [, kind, sql] of spots) {
    for (const row of all(sql, id)) out.push({ kind, label: row.label });
  }
  return out;
}

mediaRouter.delete('/:id', requireContentWrite, wrap(async (req, res) => {
  const id = Number(req.params.id);
  const row = get('SELECT * FROM media WHERE id = ?', id);
  if (!row) throw notFound('That image is gone.');

  const usage = mediaUsage(id);
  if (usage.length && req.query.force !== '1') {
    throw bad(
      `That image is still used in ${usage.length} place${usage.length > 1 ? 's' : ''}: ` +
      `${usage.map((u) => `${u.kind} “${u.label}”`).join(', ')}. ` +
      'Delete it anyway to clear those references.',
      { usage }
    );
  }

  run('DELETE FROM media WHERE id = ?', id);
  if (row.source === 'upload' && row.filename) {
    // Best effort: a missing file must not block the row from going.
    try { fs.unlinkSync(path.join(UPLOAD_DIR, row.filename)); } catch { /* already gone */ }
  }

  log(req, 'delete', 'media', id, { usage_cleared: usage.length });
  invalidateSiteCache();
  res.json({ ok: true, references_cleared: usage.length });
}));

/* =============================================================================
   Settings
   ========================================================================== */

export const settingsRouter = express.Router();

settingsRouter.get('/', wrap(async (_req, res) => {
  const rows = all(
    `SELECT key, value, kind, group_name, label, hint, sort_order
       FROM settings ORDER BY group_name, sort_order, key`
  );
  // Secrets are reported as configured-or-not, never echoed back.
  res.json({
    items: rows.map((r) => (r.kind === 'secret'
      ? { ...r, value: r.value ? '••••••••' : '', configured: !!r.value }
      : r)),
    groups: [...new Set(rows.map((r) => r.group_name))],
  });
}));

/**
 * Coerce and check one setting against the `kind` it declares.
 *
 * The write path used to ignore kind entirely and store whatever string
 * arrived, so a field the panel renders as a URL happily accepted
 * `javascript:…` — and that value became the href of a link on the public site.
 * A blank still clears the setting, which is what "leave blank to hide" relies
 * on.
 */
function coerceSetting({ key, kind, label }, value) {
  const name = label || key;
  const body = { [key]: value };

  switch (kind) {
    case 'url': return v.url(body, key, { label: name });
    case 'email': return v.email(body, key, { label: name });
    case 'tel': return v.phone(body, key, { label: name });
    case 'bool': return v.bool(body, key) ? '1' : '0';
    case 'number': {
      const n = v.int(body, key, { label: name });
      return n == null ? null : String(n);
    }
    case 'json': {
      const s = v.str(body, key, { max: 20000, label: name });
      if (s == null) return null;
      try { JSON.parse(s); } catch { throw bad(`${name} must be valid JSON.`, { field: key }); }
      return s;
    }
    case 'longtext': return v.str(body, key, { max: 20000, label: name });
    case 'secret': return v.str(body, key, { max: 500, label: name });
    default: return v.str(body, key, { max: 2000, label: name });
  }
}

settingsRouter.patch('/', wrap(async (req, res) => {
  if (!['owner', 'manager'].includes(req.user.role)) {
    throw forbidden('Only an owner or manager can change settings.');
  }
  const patch = req.body || {};
  const known = new Map(
    all('SELECT key, kind, label FROM settings').map((r) => [r.key, r])
  );

  /* Everything is validated before anything is written, so one bad field
     rejects the whole form rather than leaving half of it applied. */
  const pending = [];
  for (const [key, value] of Object.entries(patch)) {
    const meta = known.get(key);
    if (!meta) continue;                     // unknown keys are ignored, not created
    if (value === '••••••••') continue;      // masked secret came back untouched
    pending.push([key, coerceSetting(meta, value)]);
  }

  if (!pending.length) throw bad('No recognised settings were sent.');

  const written = pending.map(([key]) => key);
  tx(() => {
    for (const [key, value] of pending) putSetting(key, value);
  });

  log(req, 'update', 'settings', null, { keys: written });
  invalidateSiteCache();
  res.json({ ok: true, updated: written });
}));

/* =============================================================================
   Google integration
   ========================================================================== */

export const googleRouter = express.Router();

googleRouter.get('/status', wrap(async (_req, res) => {
  res.json(google.status());
}));

/* Each search is a billed Places call, so it is limited to the roles that have
   a reason to look one up, and capped per address. */
const findLimiter = rateLimit({
  name: 'google-find',
  limit: 20,
  windowMs: 10 * 60_000,
  message: 'That is a lot of place searches. Wait a few minutes.',
});

googleRouter.post('/find', requireContentWrite, findLimiter, wrap(async (req, res) => {
  const q = v.str(req.body, 'query', { required: true, max: 200, label: 'Search text' });
  try {
    const places = await google.findPlace(q);
    res.json({
      ok: true,
      items: places.map((p) => ({
        place_id: p.id,
        name: p.displayName?.text || '',
        address: p.formattedAddress || '',
        rating: p.rating ?? null,
        total: p.userRatingCount ?? null,
      })),
    });
  } catch (err) {
    res.status(502).json({ ok: false, error: err.message });
  }
}));

googleRouter.post('/sync', wrap(async (req, res) => {
  if (!['owner', 'manager'].includes(req.user.role)) {
    throw forbidden('Only an owner or manager can sync reviews.');
  }

  const locationId = v.int(req.body, 'location_id', { min: 1 });
  const loc = locationId
    ? get('SELECT id, google_place_id FROM locations WHERE id = ?', locationId)
    : get(`SELECT id, google_place_id FROM locations
            WHERE google_place_id IS NOT NULL AND google_place_id != ''
            ORDER BY is_primary DESC, sort_order LIMIT 1`);

  if (!loc?.google_place_id) {
    throw bad('No clinic has a Google Place ID yet. Add one under Locations first.');
  }
  if (!google.hasKey()) {
    throw bad('No Google Maps API key is configured. Add GOOGLE_MAPS_API_KEY to your .env file and restart.');
  }

  const result = await google.syncReviews(loc.google_place_id, loc.id);
  log(req, 'google-sync', 'testimonials', null, result);
  invalidateSiteCache();

  if (!result.ok) return res.status(502).json(result);
  res.json({
    ...result,
    note: result.returned < 5
      ? `Google returned ${result.returned} review(s) for this place.`
      : 'Google returns a maximum of 5 reviews per place — that is an API limit, not a bug.',
  });
}));

/* =============================================================================
   Own password
   ========================================================================== */

export const accountRouter = express.Router();

/* Changing a password requires the current one, which makes this endpoint an
   online guessing oracle against whoever is signed in — worth a limit even
   though it already needs a session. */
const passwordLimiter = rateLimit({
  name: 'password',
  limit: 6,
  windowMs: 15 * 60_000,
  message: 'Too many attempts with the current password. Wait fifteen minutes.',
});

accountRouter.post('/password', passwordLimiter, wrap(async (req, res) => {
  const current = v.str(req.body, 'current_password', { required: true, max: 200, label: 'Current password' });
  const next = requirePassword({ password: req.body?.new_password });

  const row = get('SELECT password_hash FROM users WHERE id = ?', req.user.id);
  if (!await verifyPassword(current, row.password_hash)) {
    throw bad('Current password is not correct.', { field: 'current_password' });
  }

  run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(next), req.user.id);
  // Every other session for this user is dropped; a password change should
  // log out the device you were worried about.
  run('DELETE FROM sessions WHERE user_id = ? AND token != ?', req.user.id, req.session.token);

  log(req, 'password-change', 'users', req.user.id, null);
  res.json({ ok: true, message: 'Password updated. Other sessions have been signed out.' });
}));

/** Owner resetting somebody else's password. */
accountRouter.post('/users/:id/password', wrap(async (req, res) => {
  if (req.user.role !== 'owner') throw forbidden('Only an owner can reset another password.');

  const id = Number(req.params.id);
  const target = get('SELECT id, email FROM users WHERE id = ?', id);
  if (!target) throw notFound('No such user.');

  const next = requirePassword({ password: req.body?.new_password });
  run('UPDATE users SET password_hash = ? WHERE id = ?', await hashPassword(next), id);
  run('DELETE FROM sessions WHERE user_id = ?', id);

  log(req, 'password-reset', 'users', id, { email: target.email });
  res.json({ ok: true, message: `Password reset for ${target.email}. Their sessions were signed out.` });
}));
