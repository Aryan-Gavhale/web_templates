/* =============================================================================
   Server entry point.

   Route order matters here:
     /api/*          public read + enquiry write
     /api/auth/*     sign in
     /api/admin/*    authenticated, CSRF-checked, role-gated
     static          public site, admin panel, uploads
   ========================================================================== */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Node loads .env natively; no dotenv dependency needed.
try { process.loadEnvFile(); } catch { /* no .env file, which is fine */ }

import { ROOT, UPLOAD_DIR, get } from './db.js';
import { cookieMiddleware, HttpError } from './lib/http.js';
import { attachUser, requireAuth, requireCsrf, startSessionSweeper } from './lib/auth.js';
import { router as publicRouter } from './routes/public.js';
import { router as authRouter } from './routes/auth.js';
import {
  router as contentRouter, mediaRouter, settingsRouter, googleRouter, accountRouter,
} from './routes/admin-content.js';
import { router as crmRouter } from './routes/admin-crm.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.disable('x-powered-by');

/* A hop count, not a boolean. `true` would make Express read the left-most
   X-Forwarded-For entry, which a client can still prepend to even when a real
   proxy sits in front; `1` means "the address my own proxy saw". Everything
   that rate-limits or audits by address depends on this being right. */
const proxyHops = Number.parseInt(process.env.TRUST_PROXY || '0', 10);
app.set('trust proxy', Number.isInteger(proxyHops) && proxyHops > 0 ? proxyHops : false);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));
app.use(cookieMiddleware);
app.use(attachUser);

/**
 * Content-Security-Policy, written against what the two pages actually load.
 *
 * `script-src 'self'` is the load-bearing directive. It stops inline script in
 * anything served from this origin, which is the containment for a file that
 * reaches /uploads with the wrong sort of content, and it also neutralises a
 * `javascript:` URL that found its way into an href.
 *
 * Styles need 'unsafe-inline' because the front end sets ~130 inline style
 * attributes while rendering. That is a real weakening, but a style attribute
 * cannot execute, and the alternative is a per-request nonce on markup that is
 * assembled in the browser.
 *
 * img-src stays broad on purpose: the media library exists so an owner can link
 * a photograph from anywhere, and an image cannot execute.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https: http:",
  "connect-src 'self'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
].join('; ');

app.use((_req, res, next) => {
  res.set('Content-Security-Policy', CSP);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  next();
});

/* ---- API ----------------------------------------------------------------- */

app.use('/api/auth', authRouter);
app.use('/api', publicRouter);

const adminGate = [requireAuth, requireCsrf];
app.use('/api/admin/media', ...adminGate, mediaRouter);
app.use('/api/admin/settings', ...adminGate, settingsRouter);
app.use('/api/admin/google', ...adminGate, googleRouter);
app.use('/api/admin/account', ...adminGate, accountRouter);
app.use('/api/admin', ...adminGate, crmRouter);
// The generic /:resource engine goes last so it cannot shadow the named
// admin routes above.
app.use('/api/admin', ...adminGate, contentRouter);

/* ---- static -------------------------------------------------------------- */

/**
 * Filenames here are not fingerprinted — there is no build step to hash them —
 * so a max-age would leave an edited stylesheet or module invisible to anyone
 * who had already loaded the old one. `no-cache` still lets the browser keep
 * the file; it just has to revalidate, and the ETag turns that into a 304.
 *
 * Images are the exception: their bytes never change under a given name, so
 * they are worth caching outright.
 */
const cacheHeaders = {
  etag: true,
  setHeaders(res, filePath) {
    const immutable = /\.(woff2?|jpg|jpeg|png|webp|avif|svg|ico)$/i.test(filePath);
    res.set('Cache-Control', immutable ? 'public, max-age=604800' : 'no-cache');
  },
};

app.use('/uploads', express.static(UPLOAD_DIR, {
  maxAge: '7d',
  index: false,
  setHeaders(res) {
    // Uploaded files are only ever images; make certain nothing is executed.
    res.set('Content-Disposition', 'inline');
    res.set('X-Content-Type-Options', 'nosniff');
  },
}));

app.use('/admin', express.static(path.join(ROOT, 'admin'), cacheHeaders));
app.use('/', express.static(path.join(ROOT, 'public'), cacheHeaders));

/* ---- 404 and errors ------------------------------------------------------ */

app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next(new HttpError(404, `No API route for ${req.method} ${req.path}`));
  }
  // Any other unknown path falls back to the single-page site.
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.use((err, req, res, _next) => {
  // Multer reports its own limits through err.code.
  if (err?.code === 'LIMIT_FILE_SIZE') {
    err = new HttpError(413, 'That image is larger than the 8 MB limit.');
  }
  if (err?.code === 'LIMIT_FILE_COUNT') {
    err = new HttpError(413, 'Twelve images at a time is the limit.');
  }

  const status = err instanceof HttpError ? err.status : 500;

  if (status >= 500) {
    console.error(`[500] ${req.method} ${req.originalUrl}`);
    console.error(err);
  }

  res.status(status).json({
    error: status >= 500 ? 'Something went wrong on the server.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
});

/* ---- start --------------------------------------------------------------- */

const PORT = Number(process.env.PORT || 5173);

/* '::' is dual-stack, so both 127.0.0.1 and ::1 answer. Binding 0.0.0.0
   leaves IPv6 unserved, and browsers frequently resolve localhost to ::1
   first — which looks exactly like a dead server. */
const HOST = process.env.HOST || '::';

if (get('SELECT COUNT(*) AS n FROM users').n === 0) {
  console.log('\n  No admin user exists yet. Run:  npm run seed\n');
}

startSessionSweeper();

const server = app.listen(PORT, HOST, () => {
  const keyed = (process.env.GOOGLE_MAPS_API_KEY || '').trim().length > 10;
  console.log(`
  TWACHA clinic server

  Website        http://localhost:${PORT}/
  Admin panel    http://localhost:${PORT}/admin/
  Google Places  ${keyed ? 'live (key detected)' : 'seeded (no GOOGLE_MAPS_API_KEY set)'}
  Database       ${path.relative(process.cwd(), path.join(ROOT, 'data', 'app.db'))}
`);
});

/* Without this, a failed bind exits silently with status 0 and you are left
   wondering why nothing answers. EACCES on Windows usually means the port
   falls inside a reserved range rather than anything to do with privileges —
   check `netsh int ipv4 show excludedportrange protocol=tcp`. */
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use.\n  Try:  PORT=5250 npm start\n`);
  } else if (err.code === 'EACCES') {
    console.error(`
  Port ${PORT} was refused by the operating system (EACCES).

  On Windows this is usually a reserved port range rather than a permissions
  problem. List the ranges with:

      netsh int ipv4 show excludedportrange protocol=tcp

  Then pick a port outside them:  PORT=5250 npm start
`);
  } else {
    console.error('\n  Could not start the server:', err.message, '\n');
  }
  process.exit(1);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
