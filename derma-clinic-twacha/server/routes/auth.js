/* =============================================================================
   Sign in, sign out, who am I.
   ========================================================================== */

import express from 'express';
import { get } from '../db.js';
import { wrap, rateLimit, unauthorized, HttpError } from '../lib/http.js';
import * as v from '../lib/validate.js';
import {
  verifyPassword, burnTime, createSession, destroySession, requireAuth,
} from '../lib/auth.js';
import { log } from '../lib/activity.js';

export const router = express.Router();

const loginLimiter = rateLimit({
  name: 'login',
  limit: 8,
  windowMs: 15 * 60_000,
  message: 'Too many sign-in attempts. Wait fifteen minutes and try again.',
});

router.post('/login', loginLimiter, wrap(async (req, res) => {
  const email = v.email(req.body, 'email', { required: true, label: 'Email' });
  const password = v.str(req.body, 'password', { required: true, max: 200, label: 'Password' });

  const user = get(
    'SELECT id, email, name, role, is_active, password_hash FROM users WHERE email = ?',
    email
  );

  /* One message for every failure mode, and the hashing cost is paid either
     way, so neither the wording nor the timing reveals whether the address
     exists. */
  const rejected = new HttpError(401, 'Those details do not match an active account.');

  if (!user || !user.is_active) {
    await burnTime();
    throw rejected;
  }
  if (!await verifyPassword(password, user.password_hash)) throw rejected;

  const { csrf, expires_at } = createSession(req, res, user);

  /* attachUser ran before this session existed, so req.user is still empty and
     the audit row would be attributed to "System" — on the one action where
     knowing who it was matters most. The request is authenticated now. */
  req.user = user;
  log(req, 'login', 'users', user.id, { email: user.email });

  res.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    csrf,
    expires_at,
  });
}));

router.post('/logout', wrap(async (req, res) => {
  if (req.user) log(req, 'logout', 'users', req.user.id, null);
  destroySession(req, res);
  res.json({ ok: true });
}));

router.get('/me', wrap(async (req, res) => {
  if (!req.user) throw unauthorized('Not signed in.');
  res.json({
    user: req.user,
    csrf: req.session.csrf,
    expires_at: req.session.expires_at,
  });
}));
