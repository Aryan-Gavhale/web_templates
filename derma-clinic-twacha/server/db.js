/* =============================================================================
   Database — node:sqlite (built into Node 22.5+, no native compilation)

   Money is stored as INTEGER paise throughout. There is not a single float in
   this schema, because a rupee amount that has been through a float is no
   longer an amount you can put on a receipt.

   Dates: ISO-8601 strings. Day-only fields use YYYY-MM-DD so they sort and
   compare lexicographically in SQL.
   ========================================================================== */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, 'app.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

/* --------------------------------------------------------------------------
   Schema. Written idempotently so start-up is always safe to repeat.
   -------------------------------------------------------------------------- */

db.exec(`
/* ---- access -------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  password_hash  TEXT    NOT NULL,
  role           TEXT    NOT NULL DEFAULT 'staff'
                 CHECK (role IN ('owner','manager','staff')),
  is_active      INTEGER NOT NULL DEFAULT 1,
  last_login_at  TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token       TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf        TEXT    NOT NULL,
  expires_at  TEXT    NOT NULL,
  ip          TEXT,
  user_agent  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

/* ---- site configuration -------------------------------------------------- */

CREATE TABLE IF NOT EXISTS settings (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  kind        TEXT NOT NULL DEFAULT 'text'
              CHECK (kind IN ('text','longtext','number','bool','json','url','email','tel','secret')),
  group_name  TEXT NOT NULL DEFAULT 'general',
  label       TEXT,
  hint        TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

/* ---- media --------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS media (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  source         TEXT    NOT NULL DEFAULT 'upload'
                 CHECK (source IN ('upload','url','google')),
  url            TEXT    NOT NULL,
  filename       TEXT,
  original_name  TEXT,
  mime           TEXT,
  size_bytes     INTEGER,
  alt_text       TEXT    NOT NULL DEFAULT '',
  credit         TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* ---- page content -------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS sections (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  key           TEXT    NOT NULL UNIQUE,
  kind          TEXT    NOT NULL DEFAULT 'prose'
                CHECK (kind IN ('hero','stats','prose','steps','faq','cta','gallery','emi')),
  eyebrow       TEXT,
  title         TEXT,
  subtitle      TEXT,
  body          TEXT,
  cta_label     TEXT,
  cta_href      TEXT,
  media_id      INTEGER REFERENCES media(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  INTEGER NOT NULL DEFAULT 1,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* Child rows for a section: stat figures, journey steps, FAQ pairs, bullets.
   One generic table beats four near-identical ones. */
CREATE TABLE IF NOT EXISTS section_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id    INTEGER NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title         TEXT,
  body          TEXT,
  value         TEXT,
  suffix        TEXT,
  media_id      INTEGER REFERENCES media(id) ON DELETE SET NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_section_items ON section_items(section_id, sort_order);

/* ---- services ------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  blurb       TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS services (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  slug             TEXT    NOT NULL UNIQUE,
  name             TEXT    NOT NULL,
  summary          TEXT,
  body             TEXT,
  duration_min     INTEGER,
  sessions_typical TEXT,
  price_from_paise INTEGER,
  price_to_paise   INTEGER,
  price_note       TEXT,
  is_emi_eligible  INTEGER NOT NULL DEFAULT 0,
  media_id         INTEGER REFERENCES media(id) ON DELETE SET NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_featured      INTEGER NOT NULL DEFAULT 0,
  is_published     INTEGER NOT NULL DEFAULT 1,
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_services_cat ON services(category_id, sort_order);

/* ---- people and places --------------------------------------------------- */

CREATE TABLE IF NOT EXISTS doctors (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  credentials      TEXT,
  role_title       TEXT,
  registration_no  TEXT,
  experience_years INTEGER,
  languages        TEXT,
  bio              TEXT,
  media_id         INTEGER REFERENCES media(id) ON DELETE SET NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_published     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS locations (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT    NOT NULL,
  address_line1    TEXT,
  address_line2    TEXT,
  city             TEXT,
  state            TEXT,
  pincode          TEXT,
  phone            TEXT,
  whatsapp         TEXT,
  google_place_id  TEXT,
  google_maps_url  TEXT,
  hours            TEXT,
  is_primary       INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_published     INTEGER NOT NULL DEFAULT 1
);

/* ---- reviews ------------------------------------------------------------- */

/* Admin-curated wall. Rows sourced from Google carry google_review_id so a
   re-sync updates rather than duplicates. */
CREATE TABLE IF NOT EXISTS testimonials (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  author           TEXT    NOT NULL,
  rating           INTEGER CHECK (rating BETWEEN 1 AND 5),
  body             TEXT    NOT NULL,
  treatment        TEXT,
  source           TEXT    NOT NULL DEFAULT 'manual'
                   CHECK (source IN ('manual','google','google-seed')),
  google_review_id TEXT UNIQUE,
  author_photo_url TEXT,
  reviewed_at      TEXT,
  location_id      INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  is_published     INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

/* Raw Places responses, kept briefly so the site is not calling a billed API
   on every page view. */
CREATE TABLE IF NOT EXISTS google_cache (
  cache_key   TEXT PRIMARY KEY,
  payload     TEXT NOT NULL,
  fetched_at  TEXT NOT NULL DEFAULT (datetime('now')),
  ok          INTEGER NOT NULL DEFAULT 1,
  error       TEXT
);

/* ---- enquiries ----------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS enquiries (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT    NOT NULL,
  phone          TEXT    NOT NULL,
  email          TEXT,
  service_id     INTEGER REFERENCES services(id) ON DELETE SET NULL,
  location_id    INTEGER REFERENCES locations(id) ON DELETE SET NULL,
  message        TEXT,
  preferred_time TEXT,
  wants_emi      INTEGER NOT NULL DEFAULT 0,
  consent        INTEGER NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'new'
                 CHECK (status IN ('new','contacted','booked','completed','closed','spam')),
  priority       TEXT    NOT NULL DEFAULT 'normal'
                 CHECK (priority IN ('low','normal','high')),
  source         TEXT    NOT NULL DEFAULT 'website',
  assigned_to    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  patient_id     INTEGER,
  ip             TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_enq_status ON enquiries(status, created_at DESC);

CREATE TABLE IF NOT EXISTS enquiry_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id  INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  note        TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_enq_notes ON enquiry_notes(enquiry_id, created_at);

/* ---- patients, EMI plans, installments, payments ------------------------- */

CREATE TABLE IF NOT EXISTS patients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ref         TEXT    UNIQUE,
  name        TEXT    NOT NULL,
  phone       TEXT    NOT NULL,
  email       TEXT,
  address     TEXT,
  city        TEXT,
  notes       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);

CREATE TABLE IF NOT EXISTS emi_plans (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  ref                  TEXT    UNIQUE,
  patient_id           INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  service_id           INTEGER REFERENCES services(id) ON DELETE SET NULL,
  title                TEXT    NOT NULL,
  principal_paise      INTEGER NOT NULL,
  downpayment_paise    INTEGER NOT NULL DEFAULT 0,
  financed_paise       INTEGER NOT NULL,
  tenure_months        INTEGER NOT NULL,
  interest_rate_bps    INTEGER NOT NULL DEFAULT 0,
  processing_fee_paise INTEGER NOT NULL DEFAULT 0,
  installment_paise    INTEGER NOT NULL,
  total_payable_paise  INTEGER NOT NULL,
  start_date           TEXT    NOT NULL,
  status               TEXT    NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active','completed','cancelled','defaulted')),
  notes                TEXT,
  created_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_plans_patient ON emi_plans(patient_id);

CREATE TABLE IF NOT EXISTS installments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id      INTEGER NOT NULL REFERENCES emi_plans(id) ON DELETE CASCADE,
  seq          INTEGER NOT NULL,
  due_date     TEXT    NOT NULL,
  amount_paise INTEGER NOT NULL,
  paid_paise   INTEGER NOT NULL DEFAULT 0,
  status       TEXT    NOT NULL DEFAULT 'due'
               CHECK (status IN ('due','partial','paid','waived')),
  paid_on      TEXT,
  notes        TEXT,
  UNIQUE (plan_id, seq)
);
CREATE INDEX IF NOT EXISTS idx_inst_due ON installments(due_date, status);

CREATE TABLE IF NOT EXISTS payments (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  receipt_no     TEXT    UNIQUE,
  patient_id     INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  plan_id        INTEGER REFERENCES emi_plans(id) ON DELETE SET NULL,
  installment_id INTEGER REFERENCES installments(id) ON DELETE SET NULL,
  amount_paise   INTEGER NOT NULL,
  kind           TEXT    NOT NULL DEFAULT 'installment'
                 CHECK (kind IN ('installment','downpayment','consultation','procedure','other','refund')),
  method         TEXT    NOT NULL DEFAULT 'upi'
                 CHECK (method IN ('cash','upi','card','netbanking','neft','cheque','other')),
  reference      TEXT,
  received_on    TEXT    NOT NULL,
  received_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes          TEXT,
  is_void        INTEGER NOT NULL DEFAULT 0,
  void_reason    TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pay_patient ON payments(patient_id, received_on DESC);
CREATE INDEX IF NOT EXISTS idx_pay_on ON payments(received_on);

/* ---- audit --------------------------------------------------------------- */

CREATE TABLE IF NOT EXISTS activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT    NOT NULL,
  entity      TEXT,
  entity_id   INTEGER,
  detail      TEXT,
  ip          TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_activity ON activity_log(created_at DESC);
`);

/* --------------------------------------------------------------------------
   Small query helpers. node:sqlite returns plain objects, which is all we want.
   -------------------------------------------------------------------------- */

export const all = (sql, ...p) => db.prepare(sql).all(...p);
export const get = (sql, ...p) => db.prepare(sql).get(...p);
export const run = (sql, ...p) => db.prepare(sql).run(...p);

/** Run fn inside a transaction, rolling back on any throw. */
export function tx(fn) {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* already unwound */ }
    throw err;
  }
}

export const setting = (key, fallback = null) => {
  const row = get('SELECT value FROM settings WHERE key = ?', key);
  return row && row.value != null && row.value !== '' ? row.value : fallback;
};

export function settingsMap() {
  const out = {};
  for (const r of all('SELECT key, value, kind FROM settings')) {
    out[r.key] = r.kind === 'bool' ? r.value === '1'
      : r.kind === 'number' ? Number(r.value)
      : r.value;
  }
  return out;
}

export function putSetting(key, value) {
  run(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    key, value == null ? null : String(value)
  );
}
