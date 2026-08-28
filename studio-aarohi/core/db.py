"""SQLite access and schema.

One file, no ORM. Connections are per-request and rows behave like dicts.
"""

import os
import sqlite3
from datetime import datetime, timezone

from flask import g

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
# STUDIO_DB lets a test run against a throwaway copy instead of the real file.
DB_PATH = os.environ.get("STUDIO_DB") or os.path.join(DATA_DIR, "app.db")
UPLOAD_DIR = os.path.join(DATA_DIR, "uploads")


def now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def connect() -> sqlite3.Connection:
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=15)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode = WAL")
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA busy_timeout = 8000")
    return con


def db() -> sqlite3.Connection:
    if "db" not in g:
        g.db = connect()
    return g.db


def close_db(_exc=None):
    con = g.pop("db", None)
    if con is not None:
        con.close()


# ── query helpers ──────────────────────────────────────────────────────

def q(sql: str, args=()) -> list:
    return db().execute(sql, args).fetchall()


def q1(sql: str, args=()):
    return db().execute(sql, args).fetchone()


def run(sql: str, args=()) -> int:
    cur = db().execute(sql, args)
    db().commit()
    return cur.lastrowid


def run_many(sql: str, seq) -> None:
    db().executemany(sql, seq)
    db().commit()


def insert(table: str, data: dict) -> int:
    cols = ", ".join(data)
    marks = ", ".join("?" for _ in data)
    return run(f"INSERT INTO {table} ({cols}) VALUES ({marks})", tuple(data.values()))


def update(table: str, row_id: int, data: dict) -> None:
    if not data:
        return
    sets = ", ".join(f"{k} = ?" for k in data)
    run(f"UPDATE {table} SET {sets} WHERE id = ?", tuple(data.values()) + (row_id,))


def delete(table: str, row_id: int) -> None:
    run(f"DELETE FROM {table} WHERE id = ?", (row_id,))


def next_position(table: str, where: str = "1=1", args=()) -> int:
    row = q1(f"SELECT COALESCE(MAX(position), 0) + 1 AS n FROM {table} WHERE {where}", args)
    return row["n"] if row else 1


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'owner',
  created_at    TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT
);

-- Reusable images. 'remote' rows point at a URL (the shipped demo content),
-- 'local' rows live under data/uploads.
CREATE TABLE IF NOT EXISTS media (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kind          TEXT NOT NULL DEFAULT 'local',
  filename      TEXT,
  thumb         TEXT,
  url           TEXT,
  original_name TEXT,
  mime          TEXT,
  bytes         INTEGER DEFAULT 0,
  width         INTEGER DEFAULT 0,
  height        INTEGER DEFAULT 0,
  alt           TEXT DEFAULT '',
  created_at    TEXT NOT NULL
);

-- Editable blocks of the public page. `key` is what the theme looks up.
CREATE TABLE IF NOT EXISTS sections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  key        TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  hint       TEXT DEFAULT '',
  eyebrow    TEXT DEFAULT '',
  heading    TEXT DEFAULT '',
  body       TEXT DEFAULT '',
  cta_label  TEXT DEFAULT '',
  cta_href   TEXT DEFAULT '',
  image_id   INTEGER REFERENCES media(id) ON DELETE SET NULL,
  extra      TEXT DEFAULT '',
  position   INTEGER DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS services (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  slug       TEXT NOT NULL UNIQUE,
  summary    TEXT DEFAULT '',
  body       TEXT DEFAULT '',
  price_from INTEGER,
  price_note TEXT DEFAULT '',
  image_id   INTEGER REFERENCES media(id) ON DELETE SET NULL,
  position   INTEGER DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS projects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL,
  slug          TEXT NOT NULL UNIQUE,
  category      TEXT DEFAULT '',
  location      TEXT DEFAULT '',
  year          TEXT DEFAULT '',
  area          TEXT DEFAULT '',
  summary       TEXT DEFAULT '',
  body          TEXT DEFAULT '',
  cover_id      INTEGER REFERENCES media(id) ON DELETE SET NULL,
  position      INTEGER DEFAULT 0,
  is_visible    INTEGER NOT NULL DEFAULT 1,
  is_featured   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS project_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  media_id   INTEGER NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  caption    TEXT DEFAULT '',
  position   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS process_steps (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  duration   TEXT DEFAULT '',
  position   INTEGER DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stats (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  label      TEXT NOT NULL,
  value      TEXT NOT NULL,
  suffix     TEXT DEFAULT '',
  position   INTEGER DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1
);

-- Google reviews land here alongside anything typed in by hand, so the
-- theme only ever reads one table.
CREATE TABLE IF NOT EXISTS testimonials (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  source           TEXT NOT NULL DEFAULT 'manual',
  google_review_id TEXT UNIQUE,
  author           TEXT NOT NULL,
  author_photo     TEXT DEFAULT '',
  role             TEXT DEFAULT '',
  rating           INTEGER DEFAULT 5,
  body             TEXT DEFAULT '',
  review_time      TEXT,
  relative_time    TEXT DEFAULT '',
  profile_url      TEXT DEFAULT '',
  is_visible       INTEGER NOT NULL DEFAULT 1,
  is_featured      INTEGER NOT NULL DEFAULT 0,
  position         INTEGER DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS google_sync (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  place_id      TEXT,
  status        TEXT NOT NULL,
  rating        REAL,
  total_ratings INTEGER,
  imported      INTEGER DEFAULT 0,
  updated       INTEGER DEFAULT 0,
  message       TEXT DEFAULT '',
  fetched_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS enquiries (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  ref               TEXT NOT NULL UNIQUE,
  name              TEXT NOT NULL,
  email             TEXT DEFAULT '',
  phone             TEXT DEFAULT '',
  city              TEXT DEFAULT '',
  service_id        INTEGER REFERENCES services(id) ON DELETE SET NULL,
  budget_band       TEXT DEFAULT '',
  timeline          TEXT DEFAULT '',
  message           TEXT DEFAULT '',
  source            TEXT DEFAULT 'website',
  status            TEXT NOT NULL DEFAULT 'new',
  priority          TEXT NOT NULL DEFAULT 'normal',
  is_archived       INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT NOT NULL,
  updated_at        TEXT,
  last_contacted_at TEXT
);

CREATE TABLE IF NOT EXISTS enquiry_notes (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  enquiry_id  INTEGER NOT NULL REFERENCES enquiries(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  author      TEXT DEFAULT '',
  created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT DEFAULT '',
  phone      TEXT DEFAULT '',
  address    TEXT DEFAULT '',
  city       TEXT DEFAULT '',
  notes      TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_plans (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ref           TEXT NOT NULL UNIQUE,
  client_id     INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  total_amount  REAL NOT NULL DEFAULT 0,
  discount      REAL NOT NULL DEFAULT 0,
  downpayment   REAL NOT NULL DEFAULT 0,
  interest_type TEXT NOT NULL DEFAULT 'none',
  interest_pct  REAL NOT NULL DEFAULT 0,
  tenure_months INTEGER NOT NULL DEFAULT 6,
  start_date    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active',
  note          TEXT DEFAULT '',
  created_at    TEXT NOT NULL,
  updated_at    TEXT
);

CREATE TABLE IF NOT EXISTS installments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_id     INTEGER NOT NULL REFERENCES payment_plans(id) ON DELETE CASCADE,
  seq         INTEGER NOT NULL,
  label       TEXT DEFAULT '',
  due_date    TEXT NOT NULL,
  amount      REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  paid_on     TEXT,
  method      TEXT DEFAULT '',
  reference   TEXT DEFAULT '',
  note        TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS activity (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_name  TEXT DEFAULT 'system',
  action     TEXT NOT NULL,
  entity     TEXT DEFAULT '',
  entity_id  INTEGER,
  summary    TEXT DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enq_status  ON enquiries(status, is_archived);
CREATE INDEX IF NOT EXISTS idx_enq_created ON enquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inst_plan   ON installments(plan_id, seq);
CREATE INDEX IF NOT EXISTS idx_inst_due    ON installments(due_date);
CREATE INDEX IF NOT EXISTS idx_proj_img    ON project_images(project_id, position);
CREATE INDEX IF NOT EXISTS idx_activity    ON activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_test_vis    ON testimonials(is_visible, position);
"""


def init_db() -> None:
    """Create the schema if it is missing. Safe to call on every boot."""
    con = connect()
    try:
        con.executescript(SCHEMA)
        con.commit()
    finally:
        con.close()
