/* =============================================================================
   Core — API client, formatters, DOM helpers, toasts, modal, drawer.

   Everything in the panel goes through api(): one place that carries the CSRF
   token, one place that turns a non-2xx response into an Error whose message is
   the server's own wording. The server writes better messages than a generic
   "request failed", so they are surfaced verbatim.
   ========================================================================== */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Session state, populated by app.js at boot and after sign-in. */
export const session = { user: null, csrf: null, expires_at: null };

/* ---------------------------------------------------------------- api ---- */

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/**
 * @param {string} path      e.g. '/admin/enquiries'
 * @param {object} [opts]    method, body (auto-JSON), form (FormData), query
 */
export async function api(path, opts = {}) {
  const { method = 'GET', body, form, query } = opts;

  let url = `/api${path}`;
  if (query) {
    const qs = new URLSearchParams(
      Object.entries(query).filter(([, val]) => val !== undefined && val !== null && val !== '')
    ).toString();
    if (qs) url += `?${qs}`;
  }

  const headers = { Accept: 'application/json' };
  if (session.csrf) headers['X-CSRF-Token'] = session.csrf;

  let payload;
  if (form) {
    payload = form;                              // let the browser set the boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, 'The server could not be reached. Is it still running?');
  }

  if (res.status === 204) return null;

  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const msg = (data && data.error) || `The server replied ${res.status}.`;

    /* The session has gone — expired, swept, or the database was reseeded under
       us. Every caller would otherwise render its own "could not load" panel
       inside a shell the user can no longer use, so tell the shell once and let
       it put the sign-in gate back. */
    if (res.status === 401) {
      session.csrf = null;
      window.dispatchEvent(new CustomEvent('admin:unauthorised'));
    }

    throw new ApiError(res.status, msg, data?.details);
  }

  /* A successful write can change the sidebar counters — a payment settles an
     instalment, working an enquiry clears it from the new queue. Announcing it
     here means the shell stays in step without every view having to remember
     to ask, which is exactly the thing views kept forgetting to do. */
  if (method !== 'GET') {
    window.dispatchEvent(new CustomEvent('admin:wrote', { detail: { path, method } }));
  }

  return data;
}

/* ------------------------------------------------------- formatters ---- */

const RUPEE_FMT = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const RUPEE_FMT_2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Paise integer to a rupee string. Paise are shown only when non-zero. */
export function money(paise, { sign = true } = {}) {
  const n = Number(paise || 0);
  const abs = Math.abs(n);
  const rupees = abs / 100;
  const text = abs % 100 === 0 ? RUPEE_FMT.format(rupees) : RUPEE_FMT_2.format(rupees);
  return `${n < 0 ? '−' : ''}${sign ? '₹' : ''}${text}`;
}

/** Compact form for KPI tiles: ₹1.2L, ₹3.4Cr. */
export function moneyShort(paise) {
  const r = Math.abs(Number(paise || 0)) / 100;
  const s = Number(paise) < 0 ? '−₹' : '₹';
  if (r >= 1e7) return `${s}${(r / 1e7).toFixed(r >= 1e8 ? 0 : 2)}Cr`;
  if (r >= 1e5) return `${s}${(r / 1e5).toFixed(r >= 1e6 ? 0 : 2)}L`;
  if (r >= 1000) return `${s}${RUPEE_FMT.format(Math.round(r))}`;
  return `${s}${RUPEE_FMT.format(r)}`;
}

const D_FULL = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const D_SHORT = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const D_TIME = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
const D_MONTH = new Intl.DateTimeFormat('en-IN', { month: 'short', year: '2-digit' });

const asDate = (val) => {
  if (!val) return null;
  const s = String(val);
  // SQLite hands back 'YYYY-MM-DD HH:MM:SS' in UTC; ISO-ify it so it parses.
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + (s.length > 10 ? 'Z' : '');
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const fmtDate = (val) => { const d = asDate(val); return d ? D_FULL.format(d) : '—'; };
export const fmtDateShort = (val) => { const d = asDate(val); return d ? D_SHORT.format(d) : '—'; };
export const fmtMonth = (ym) => { const d = asDate(`${ym}-01`); return d ? D_MONTH.format(d) : ym; };

/** '2 Aug 2026, 4:15 pm' — used for anything with a clock component. */
export function fmtWhen(val) {
  const d = asDate(val);
  if (!d) return '—';
  return `${D_FULL.format(d)}, ${D_TIME.format(d).toLowerCase()}`;
}

/** 'today', '3 days ago', 'in 2 weeks' — for due dates and feeds. */
export function fmtAgo(val) {
  const d = asDate(val);
  if (!d) return '';
  const days = Math.round((d.setHours(12, 0, 0, 0) - new Date().setHours(12, 0, 0, 0)) / 86400_000);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  const n = Math.abs(days);
  const unit = n < 14 ? [n, 'day'] : n < 60 ? [Math.round(n / 7), 'week'] : [Math.round(n / 30), 'month'];
  const text = `${unit[0]} ${unit[1]}${unit[0] === 1 ? '' : 's'}`;
  return days < 0 ? `${text} ago` : `in ${text}`;
}

/** Input[type=date] wants YYYY-MM-DD in clinic-local terms. */
export const isoToday = () => new Date().toLocaleDateString('en-CA');

export const initials = (name) => String(name || '?').trim().split(/\s+/)
  .slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const titleCase = (s) => String(s || '').replace(/[_-]/g, ' ')
  .replace(/^./, (c) => c.toUpperCase());

export const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Payment kinds as they are worded to staff. The stored values are American
 * ("installment"), so title-casing them raw prints a spelling that appears
 * nowhere else in the panel — hence an explicit map.
 */
export const PAYMENT_KINDS = [
  ['installment', 'Instalment'],
  ['downpayment', 'Down payment'],
  ['consultation', 'Consultation fee'],
  ['procedure', 'Procedure / one-off'],
  ['other', 'Other'],
  ['refund', 'Refund to patient'],
];
const KIND_LABEL = Object.fromEntries(PAYMENT_KINDS);
export const paymentKind = (k) => KIND_LABEL[k] || titleCase(k);

/** Rupee text field to a plain string the server's toPaise() accepts. */
export const stripGrouping = (s) => String(s ?? '').replace(/[₹,\s]/g, '');

/* -------------------------------------------------------- dom helpers --- */

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Delegated listener: on(root, 'click', '[data-x]', (e, matched) => …) */
export function on(root, type, selector, handler) {
  root.addEventListener(type, (e) => {
    const hit = e.target.closest(selector);
    if (hit && root.contains(hit)) handler(e, hit);
  });
}

export const debounce = (fn, ms = 260) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/** Runs an async action with a spinner on the button and a toast on failure. */
export async function withBusy(btn, fn) {
  if (!btn) return fn();
  btn.classList.add('busy');
  btn.disabled = true;
  try {
    return await fn();
  } finally {
    btn.classList.remove('busy');
    btn.disabled = false;
  }
}

/* ------------------------------------------------------------- toast ---- */

export function toast(message, { kind = '', title = '', ms = 4200 } = {}) {
  const node = el(`
    <div class="toast ${kind ? `toast--${kind}` : ''}">
      <div>${title ? `<b>${esc(title)}</b>` : ''}${esc(message)}</div>
    </div>`);
  $('#toasts').append(node);
  setTimeout(() => {
    node.classList.add('out');
    setTimeout(() => node.remove(), 240);
  }, ms);
  return node;
}

export const toastOk = (m, t) => toast(m, { kind: 'ok', title: t });
export const toastBad = (m, t) => toast(m, { kind: 'bad', title: t || 'Not done' });

/** Every caught error in the panel ends up here, so wording stays consistent. */
export function reportError(err) {
  if (err?.status === 401) return;               // app.js sends you to the gate
  console.error(err);
  toastBad(err?.message || 'Something went wrong.');
}

/* ------------------------------------------------------------ modal ----- */

let modalClose = null;

/**
 * @returns {Promise<any>} resolves with whatever `close(value)` was given,
 *                         or undefined if dismissed.
 */
export function modal({ title, body, footer, wide = false, onMount }) {
  const box = $('#modal');
  $('#modalTitle').textContent = title || '';
  $('#modalBody').innerHTML = '';
  $('#modalFoot').innerHTML = '';

  if (typeof body === 'string') $('#modalBody').innerHTML = body;
  else if (body) $('#modalBody').append(body);

  if (typeof footer === 'string') $('#modalFoot').innerHTML = footer;
  else if (footer) $('#modalFoot').append(footer);

  box.classList.toggle('modal--wide', wide);
  box.hidden = false;

  return new Promise((resolve) => {
    modalClose = (value) => {
      box.hidden = true;
      modalClose = null;
      resolve(value);
    };
    onMount?.({ close: modalClose, body: $('#modalBody'), foot: $('#modalFoot') });
    $('#modalBody').querySelector('input,select,textarea,button')?.focus();
  });
}

export const closeModal = (value) => modalClose?.(value);

/** Yes/no with a named consequence. Destructive actions get the red button. */
export function confirmModal({
  title, message, confirmLabel = 'Confirm', danger = false, extra = '',
}) {
  return modal({
    title,
    body: `<div class="stack stack--sm">
             <p style="font-size:.85rem;line-height:1.6">${message}</p>
             ${extra}
           </div>`,
    footer: `
      <button class="btn" data-no>Cancel</button>
      <button class="btn ${danger ? 'btn--bad' : 'btn--pri'}" data-yes>${esc(confirmLabel)}</button>`,
    onMount({ close, foot, body }) {
      foot.querySelector('[data-no]').onclick = () => close(false);

      /* Clear the complaint as soon as they start addressing it, rather than
         leaving a red field under text that now satisfies it. */
      const reason = body.querySelector('[name=reason]');
      reason?.addEventListener('input', () => {
        const w = reason.closest('.f');
        w?.classList.remove('bad');
        w?.querySelector('.f__err')?.remove();
      });

      foot.querySelector('[data-yes]').onclick = () => {
        const field = body.querySelector('[name=reason]');
        if (!field) { close(true); return; }

        /* Four characters is the server's own minimum. Enforcing it here too
           means "ok" is refused before a round trip rather than after one. */
        const value = field.value.trim();
        const wrap = field.closest('.f');
        if (value.length < 4) {
          wrap?.classList.add('bad');
          /* A red outline alone leaves the user guessing, and "reason" is not
             self-evidently a four-character field. */
          let msg = wrap?.querySelector('.f__err');
          if (!msg && wrap) {
            msg = el('<p class="f__err"></p>');
            wrap.append(msg);
          }
          if (msg) {
            msg.textContent = value
              ? 'Please give a little more detail — at least four characters.'
              : 'A reason is required. It is kept on the record permanently.';
          }
          field.focus();
          return;
        }
        close(value);
      };
    },
  });
}

/* ----------------------------------------------------------- drawer ----- */

let drawerClose = null;

export function drawer({ title, body, onMount }) {
  $('#drawerTitle').textContent = title || '';
  const host = $('#drawerBody');
  host.innerHTML = '';
  if (typeof body === 'string') host.innerHTML = body;
  else if (body) host.append(body);

  $('#drawer').hidden = false;
  $('#drawer').scrollTop = 0;

  return new Promise((resolve) => {
    drawerClose = (value) => {
      $('#drawer').hidden = true;
      drawerClose = null;
      resolve(value);
    };
    onMount?.({ close: drawerClose, body: host });
    host.querySelector('input,select,textarea')?.focus();
  });
}

export const closeDrawer = (value) => drawerClose?.(value);

/* Wire the shared dismiss affordances once. */
export function initOverlays() {
  for (const id of ['#modal', '#drawer']) {
    on($(id), 'click', '[data-close],.modal__scrim,.drawer__scrim', () => {
      if (id === '#modal') closeModal(undefined); else closeDrawer(undefined);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#modal').hidden) closeModal(undefined);
    else if (!$('#drawer').hidden) closeDrawer(undefined);
  });
}

/* ------------------------------------------------------ render bits ----- */

export const empty = (title, message = '', action = '') => `
  <div class="empty">
    <strong>${esc(title)}</strong>
    ${message ? `<p>${esc(message)}</p>` : ''}
    ${action}
  </div>`;

export const spinner = () => '<div class="loading"><span class="spin"></span> Loading…</div>';

/** A labelled definition list from [label, value] pairs; blanks are dropped. */
export const dl = (pairs) => `
  <dl class="dl">
    ${pairs.filter(([, val]) => val !== null && val !== undefined && val !== '')
      .map(([k, val]) => `<div><dt>${esc(k)}</dt><dd>${val}</dd></div>`).join('')}
  </dl>`;

/* Status vocabularies live here so a colour means the same thing everywhere. */
const TONE = {
  // enquiries
  new: 'clay', contacted: 'info', booked: 'teal', completed: 'ok', closed: '', spam: 'bad',
  // plans
  active: 'teal', cancelled: '', defaulted: 'bad',
  // instalments
  due: 'info', partial: 'warn', paid: 'ok', waived: '', overdue: 'bad',
  // priority
  high: 'bad', normal: '', low: '',
};

export const statusChip = (value, label) =>
  `<span class="chip chip--${TONE[value] ?? ''}">${esc(label || titleCase(value))}</span>`;

export const yesNo = (val) => (val ? 'Yes' : 'No');

/** Guards a table cell against an empty string turning into a ragged column. */
export const or = (val, fallback = '—') =>
  (val === null || val === undefined || val === '' ? fallback : esc(val));
