/* =============================================================================
   Field validation. Hand-rolled rather than pulling in a schema library, so
   the error messages can be written for the person reading them.

   Every validator returns the coerced value or throws a 400 naming the field.
   ========================================================================== */

import { bad } from './http.js';

const isBlank = (v) => v == null || (typeof v === 'string' && v.trim() === '');

export function str(body, field, { required = false, max = 5000, min = 0, label } = {}) {
  const name = label || field;
  const raw = body[field];
  if (isBlank(raw)) {
    if (required) throw bad(`${name} is required.`, { field });
    return null;
  }
  const v = String(raw).trim();
  if (v.length < min) throw bad(`${name} must be at least ${min} characters.`, { field });
  if (v.length > max) throw bad(`${name} must be ${max} characters or fewer.`, { field });
  return v;
}

export function int(body, field, { required = false, min, max, label } = {}) {
  const name = label || field;
  const raw = body[field];
  if (isBlank(raw)) {
    if (required) throw bad(`${name} is required.`, { field });
    return null;
  }
  const n = Number(String(raw).trim());
  if (!Number.isInteger(n)) throw bad(`${name} must be a whole number.`, { field });
  if (min != null && n < min) throw bad(`${name} cannot be below ${min}.`, { field });
  if (max != null && n > max) throw bad(`${name} cannot be above ${max}.`, { field });
  return n;
}

export function bool(body, field) {
  const v = body[field];
  if (v === true || v === 1 || v === '1' || v === 'true' || v === 'on') return 1;
  return 0;
}

export function pick(body, field, allowed, { required = false, fallback = null, label } = {}) {
  const name = label || field;
  const raw = body[field];
  if (isBlank(raw)) {
    if (required) throw bad(`${name} is required.`, { field });
    return fallback;
  }
  const v = String(raw).trim();
  if (!allowed.includes(v)) {
    throw bad(`${name} must be one of: ${allowed.join(', ')}.`, { field });
  }
  return v;
}

/* Deliberately permissive. The job of this check is to catch a typo, not to
   adjudicate RFC 5322. */
export function email(body, field, { required = false, label } = {}) {
  const v = str(body, field, { required, max: 320, label });
  if (v == null) return null;
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) {
    throw bad(`${label || field} does not look like an email address.`, { field });
  }
  return v.toLowerCase();
}

/**
 * Indian mobile or landline, tolerant about how people actually type them:
 * +91 98220 41208, 09822041208, 020-41208800 all pass.
 */
export function phone(body, field, { required = false, label } = {}) {
  const v = str(body, field, { required, max: 24, label });
  if (v == null) return null;
  const digits = v.replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) {
    throw bad(`${label || field} does not look like a phone number.`, { field });
  }
  return v;
}

export function date(body, field, { required = false, label } = {}) {
  const v = str(body, field, { required, max: 10, label });
  if (v == null) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    throw bad(`${label || field} must be a date.`, { field });
  }
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) {
    throw bad(`${label || field} is not a real date.`, { field });
  }
  return v;
}

/* `/(?!/)` rather than plain `/`: a value of "//evil.example" is a
   protocol-relative URL, not a local path, and would silently point offsite. */
export function url(body, field, { required = false, label, max = 2000 } = {}) {
  const v = str(body, field, { required, max, label });
  if (v == null) return null;
  if (!/^(https?:\/\/|\/(?!\/))/i.test(v)) {
    throw bad(`${label || field} must start with http://, https:// or /.`, { field });
  }
  return v;
}

/**
 * Somewhere a link on the page may point. Wider than url() because these fields
 * legitimately hold in-page anchors and click-to-call, and narrower than free
 * text because they are assigned to an href.
 *
 * The scheme is the whole point: a `javascript:` value in any of these columns
 * executes when a visitor clicks it, and HTML-escaping does nothing about it
 * because there is no character to escape.
 */
export function href(body, field, { required = false, label, max = 400 } = {}) {
  const v = str(body, field, { required, max, label });
  if (v == null) return null;
  if (!/^(https?:\/\/|\/(?!\/)|#|tel:|mailto:|wa\.me\/)/i.test(v)) {
    throw bad(
      `${label || field} must be a link — http://, https://, a path starting with /, `
      + 'an anchor like #booking, or tel: / mailto:.',
      { field }
    );
  }
  return v;
}

/** Lowercase, hyphenated, unique-able. Derived from a name when absent. */
export function slug(body, field, fallbackFrom, { label } = {}) {
  const raw = !isBlank(body[field]) ? body[field] : fallbackFrom;
  if (isBlank(raw)) throw bad(`${label || field} is required.`, { field });
  const v = String(raw).trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  if (!v) throw bad(`${label || field} must contain at least one letter or number.`, { field });
  return v;
}

/** Reference to another row; verifies it exists so we never store a dangling id. */
export function fk(body, field, table, dbGet, { required = false, label } = {}) {
  const id = int(body, field, { required, min: 1, label });
  if (id == null) return null;
  const row = dbGet(`SELECT id FROM ${table} WHERE id = ?`, id);
  if (!row) throw bad(`${label || field} refers to a record that no longer exists.`, { field });
  return id;
}

/** Money field: rupee string in, integer paise out. */
export function paiseField(body, field, toPaise, { required = false, min = 0, max, label } = {}) {
  const name = label || field;
  const raw = body[field];
  if (isBlank(raw)) {
    if (required) throw bad(`${name} is required.`, { field });
    return null;
  }
  const p = toPaise(raw);
  if (p == null) throw bad(`${name} must be an amount, like 8500 or 8500.50.`, { field });
  if (p < min) throw bad(`${name} cannot be less than ${min / 100}.`, { field });
  if (max != null && p > max) throw bad(`${name} is implausibly large.`, { field });
  return p;
}
