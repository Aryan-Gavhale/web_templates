/* =============================================================================
   Authentication — scrypt password hashing and database-backed sessions.

   Sessions rather than JWTs, because an admin panel needs to be able to revoke
   access immediately and a signed token cannot be un-signed.

   Cookie is httpOnly + SameSite=Strict, and every state-changing request must
   also carry the session's CSRF token in an X-CSRF-Token header. SameSite alone
   would very nearly do it; the token is the belt to that pair of braces.
   ========================================================================== */

import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { get, run } from '../db.js';
import { HttpError, clientIp, unauthorized, forbidden } from './http.js';

const COOKIE = 'twacha_sid';
const SESSION_HOURS = 12;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/* ---- passwords ----------------------------------------------------------- */

/* The async form, not scryptSync. These parameters cost ~100ms of pure CPU, and
   scryptSync spends it on the event loop, so every sign-in froze the whole
   server for that long — including the responses of everyone already signed in.
   crypto.scrypt hands the work to the thread pool instead. */
const scrypt = promisify(crypto.scrypt);

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
  });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p,
    salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, keyB64] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltB64, 'base64');
    const expected = Buffer.from(keyB64, 'base64');
    const actual = await scrypt(password, salt, expected.length, {
      N: Number(N), r: Number(r), p: Number(p),
    });
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

/* Pay the same hashing cost when the address does not exist, so response timing
   does not become an account-enumeration oracle. One scrypt, matching the one
   verifyPassword would have run. */
export async function burnTime() {
  await scrypt('no-such-password', crypto.randomBytes(16), SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p,
  });
}

/** Length-aware constant-time compare for tokens that arrive from a request. */
function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---- sessions ------------------------------------------------------------ */

export function createSession(req, res, user) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);

  run(
    `INSERT INTO sessions (token, user_id, csrf, expires_at, ip, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    token, user.id, csrf, expires.toISOString(),
    clientIp(req), String(req.headers['user-agent'] || '').slice(0, 400)
  );
  run(`UPDATE users SET last_login_at = datetime('now') WHERE id = ?`, user.id);

  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.COOKIE_SECURE === '1',
    path: '/',
    expires,
  });
  return { csrf, expires_at: expires.toISOString() };
}

export function destroySession(req, res) {
  const token = req.cookies?.[COOKIE];
  if (token) run('DELETE FROM sessions WHERE token = ?', token);
  res.clearCookie(COOKIE, { path: '/' });
}

/** Attach req.user / req.session when a valid cookie is present. Never throws. */
export function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return next();

  const row = get(
    `SELECT s.token, s.csrf, s.expires_at,
            u.id, u.email, u.name, u.role, u.is_active
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ?`,
    token
  );
  if (!row) return next();

  if (new Date(row.expires_at) < new Date() || !row.is_active) {
    run('DELETE FROM sessions WHERE token = ?', token);
    return next();
  }

  req.session = { token: row.token, csrf: row.csrf, expires_at: row.expires_at };
  req.user = { id: row.id, email: row.email, name: row.name, role: row.role };
  next();
}

export const requireAuth = (req, _res, next) =>
  req.user ? next() : next(unauthorized());

export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user) return next(unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(forbidden(`This action needs one of: ${roles.join(', ')}`));
  }
  next();
};

export function requireCsrf(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const sent = req.headers['x-csrf-token'];
  if (!req.session || !sent || !safeEqual(sent, req.session.csrf)) {
    return next(new HttpError(403, 'Stale session token. Reload the page and try again.'));
  }
  next();
}

/** Housekeeping: drop expired sessions hourly. */
export function startSessionSweeper() {
  const sweep = () => run(`DELETE FROM sessions WHERE expires_at < datetime('now')`);
  sweep();
  setInterval(sweep, 3600_000).unref();
}
