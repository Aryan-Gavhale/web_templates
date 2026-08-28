/* =============================================================================
   HTTP odds and ends: cookies, client IP, error envelope, rate limiting.
   Deliberately dependency-free — cookie-parser is five lines of work.
   ========================================================================== */

export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const bad = (msg, details) => new HttpError(400, msg, details);
export const unauthorized = (msg = 'Sign in required') => new HttpError(401, msg);
export const forbidden = (msg = 'Not permitted') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

/** Wrap an async route so a rejected promise reaches the error handler. */
export const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); }
    catch { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

export function cookieMiddleware(req, _res, next) {
  req.cookies = parseCookies(req.headers.cookie);
  next();
}

export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'unknown';
}

/* --------------------------------------------------------------------------
   Fixed-window rate limiter. In-process, which is the right scope for a
   single-clinic deployment; put it in Redis the day you run two of these.
   -------------------------------------------------------------------------- */

const buckets = new Map();

export function rateLimit({ name, limit, windowMs, message }) {
  return (req, _res, next) => {
    const key = `${name}:${clientIp(req)}`;
    const now = Date.now();
    let entry = buckets.get(key);

    if (!entry || now > entry.reset) {
      entry = { count: 0, reset: now + windowMs };
      buckets.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > limit) {
      const secs = Math.ceil((entry.reset - now) / 1000);
      return next(new HttpError(429, message || `Too many attempts. Try again in ${secs}s.`));
    }
    next();
  };
}

/* Keep the map from growing without bound on a long-running process. */
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}, 60_000).unref();
