/* =============================================================================
   Admin shell — sign-in gate, sidebar, hash router.

   Views are loaded on demand and each one owns its region of the DOM. The
   router hands a view a mount node and the parsed params; the view returns the
   header text so the page title and the route stay in step.
   ========================================================================== */

import {
  $, $$, esc, api, session, initials, titleCase, toastOk, toastBad,
  reportError, withBusy, spinner, initOverlays, on, closeModal, closeDrawer, debounce,
} from './core.js';

/* ------------------------------------------------------------- routes ---- */

const ICON = {
  home: 'M2 7l6-5 6 5v7a1 1 0 01-1 1h-3v-4H6v4H3a1 1 0 01-1-1z',
  inbox: 'M2 9l2-6h8l2 6v4a1 1 0 01-1 1H3a1 1 0 01-1-1zM2 9h3l1 2h4l1-2h3',
  people: 'M6 7a2.2 2.2 0 100-4.4A2.2 2.2 0 006 7zm5.5.5a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zM1 14v-1.2C1 10.7 3 9.5 6 9.5s5 1.2 5 3.3V14M11.5 9.8c2 .3 3.5 1.3 3.5 3V14',
  card: 'M1.5 4.5h13v8h-13zM1.5 7h13',
  cal: 'M2.5 3.5h11v11h-11zM2.5 6.5h11M5.5 1.5v3M10.5 1.5v3',
  rupee: 'M5 2.5h6M5 5.5h6M9.5 2.5c1.6 0 2.4 1.2 2.4 2.6C11.9 7 10.6 8 8.6 8H5l5 5.5',
  layers: 'M8 1.5L14.5 5 8 8.5 1.5 5zM1.5 8.5L8 12l6.5-3.5M1.5 11.5L8 15l6.5-3.5',
  spark: 'M8 1.5l1.9 4.3 4.6.4-3.5 3 1 4.5L8 11.4l-3.9 2.3 1-4.5-3.5-3 4.6-.4z',
  pin: 'M8 14.5s5-4.6 5-8.1A5 5 0 003 6.4c0 3.5 5 8.1 5 8.1zM8 8a1.8 1.8 0 100-3.6A1.8 1.8 0 008 8z',
  quote: 'M6 4.5C4 5 3 6.4 3 8.4V11h3V7.6H4.6c.1-.9.6-1.6 1.4-2zM13 4.5C11 5 10 6.4 10 8.4V11h3V7.6h-1.4c.1-.9.6-1.6 1.4-2z',
  image: 'M1.5 3.5h13v9h-13zM1.5 10l3.5-3 3 2.5 2.5-2 3.5 3M11 6.2a.9.9 0 100-1.8.9.9 0 000 1.8z',
  cog: 'M8 10a2 2 0 100-4 2 2 0 000 4zM13 8l1.3-.8-1-2.4-1.5.3-1.1-1.1.3-1.5-2.4-1L8 1.7 7.2.4l-2.4 1 .3 1.5L4 4l-1.5-.3-1 2.4L2.8 7v2L1.5 9.8l1 2.4 1.5-.3 1.1 1.1-.3 1.5 2.4 1 .8-1.3h2l.8 1.3 2.4-1-.3-1.5 1.1-1.1 1.5.3 1-2.4L13 9z',
  user: 'M8 8a3 3 0 100-6 3 3 0 000 6zM2.5 14.5c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5',
  log: 'M3.5 2.5h9v11h-9zM5.5 5.5h5M5.5 8h5M5.5 10.5h3',
};

const icon = (k) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${ICON[k]}" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/**
 * Every route in one table. `badge` names a counter from /admin/dashboard so a
 * queue that needs attention says so in the sidebar rather than only inside the
 * page you have not opened.
 */
const ROUTES = [
  { group: 'Overview', items: [
    { path: 'dashboard', label: 'Dashboard', icon: 'home', title: 'Overview', mod: 'view-dashboard.js' },
  ] },
  { group: 'Patients & money', items: [
    { path: 'enquiries', label: 'Enquiries', icon: 'inbox', title: 'Enquiries', mod: 'view-enquiries.js', badge: 'new_enquiries' },
    { path: 'patients', label: 'Patients', icon: 'people', title: 'Patients', mod: 'view-patients.js' },
    { path: 'emi', label: 'EMI plans', icon: 'card', title: 'EMI plans', mod: 'view-emi.js' },
    { path: 'installments', label: 'Instalments', icon: 'cal', title: 'Instalments', mod: 'view-installments.js', badge: 'overdue', tone: 'bad' },
    { path: 'payments', label: 'Payments', icon: 'rupee', title: 'Payments', mod: 'view-payments.js' },
  ] },
  { group: 'Website', items: [
    { path: 'content', label: 'Page sections', icon: 'layers', title: 'Page sections', mod: 'view-content.js' },
    { path: 'services', label: 'Treatments', icon: 'spark', title: 'Treatments', mod: 'view-content.js' },
    { path: 'doctors', label: 'Doctors', icon: 'user', title: 'Doctors', mod: 'view-content.js' },
    { path: 'locations', label: 'Clinics', icon: 'pin', title: 'Clinics', mod: 'view-content.js' },
    { path: 'reviews', label: 'Reviews', icon: 'quote', title: 'Reviews', mod: 'view-content.js' },
    { path: 'media', label: 'Media', icon: 'image', title: 'Media library', mod: 'view-media.js' },
  ] },
  { group: 'System', items: [
    { path: 'settings', label: 'Settings', icon: 'cog', title: 'Settings', mod: 'view-settings.js' },
    { path: 'users', label: 'Staff accounts', icon: 'people', title: 'Staff accounts', mod: 'view-users.js', roles: ['owner'] },
    { path: 'activity', label: 'Activity log', icon: 'log', title: 'Activity log', mod: 'view-activity.js' },
  ] },
];

/* Routes reachable but not listed in the sidebar. */
const HIDDEN = [
  { path: 'account', title: 'My account', mod: 'view-settings.js', entry: 'account' },
  { path: 'categories', title: 'Treatment categories', mod: 'view-content.js' },
];

const ALL = [...ROUTES.flatMap((g) => g.items), ...HIDDEN];
const findRoute = (path) => ALL.find((r) => r.path === path);

/* --------------------------------------------------------------- boot ---- */

initOverlays();

const gate = $('#gate');
const shell = $('#shell');

async function boot() {
  try {
    const me = await api('/auth/me');
    Object.assign(session, me);
    enterApp();
  } catch (err) {
    if (err.status === 401) showGate();
    else {
      $('#boot').innerHTML =
        `<div class="gate__card"><p class="gate__err">${esc(err.message)}</p>
         <p class="gate__hint">Start the server with <code>npm start</code>, then reload.</p></div>`;
      return;
    }
  }
  $('#boot').hidden = true;
}

function showGate() {
  shell.hidden = true;
  gate.hidden = false;
  $('#li_email').focus();

  /* A brand-new install has no way of knowing the seeded credentials, so say
     where they come from rather than leaving somebody stuck at a login box. */
  $('#gateHint').innerHTML =
    'Seeded accounts (created by <code>npm run seed</code>):<br>' +
    '<code>owner@twacha.in</code> / <code>TwachaAdmin2026</code><br>' +
    '<code>manager@twacha.in</code> / <code>ClinicManager2026</code><br>' +
    '<code>reception@twacha.in</code> / <code>FrontDesk2026</code><br>' +
    'Change these before the site is reachable by anybody else.';
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('#loginErr');
  err.hidden = true;

  await withBusy($('#loginBtn'), async () => {
    try {
      const out = await api('/auth/login', {
        method: 'POST',
        body: { email: $('#li_email').value.trim(), password: $('#li_pw').value },
      });
      Object.assign(session, out);
      $('#li_pw').value = '';
      gate.hidden = true;
      enterApp();
    } catch (ex) {
      err.textContent = ex.message;
      err.hidden = false;
      $('#li_pw').select();
    }
  });
});

/* Bound once for the lifetime of the page. enterApp() can run again after a
   re-login, and re-binding there would stack duplicate handlers. */
window.addEventListener('hashchange', () => { if (!shell.hidden) route(); });

/* Any successful write anywhere in the panel may have moved a sidebar counter.
   Debounced because one action can produce several calls in a row. */
window.addEventListener('admin:wrote', debounce(() => {
  if (!shell.hidden) refreshBadges();
}, 400));

/* The session died mid-use — expired, swept, or the database was rebuilt. Drop
   straight back to the gate rather than leaving a shell full of dead panels. */
window.addEventListener('admin:unauthorised', () => {
  if (shell.hidden) return;                        // already at the gate
  session.user = null;
  closeDrawer(undefined);
  closeModal(undefined);
  showGate();
  toastBad('Your session has ended. Please sign in again.');
});

function enterApp() {
  shell.hidden = false;
  paintWho();
  buildNav();
  route();
  refreshBadges();
}

setInterval(() => { if (!shell.hidden) refreshBadges(); }, 120_000);

function paintWho() {
  $('#whoName').textContent = session.user.name;
  $('#whoRole').textContent = session.user.role;
  $('#whoAv').textContent = initials(session.user.name);
}

/* --------------------------------------------------------------- nav ----- */

function buildNav() {
  const role = session.user.role;
  $('#nav').innerHTML = ROUTES.map((g) => {
    const items = g.items.filter((r) => !r.roles || r.roles.includes(role));
    if (!items.length) return '';
    return `<div class="side__grp"><p>${esc(g.group)}</p>
      ${items.map((r) => `
        <a href="#/${r.path}" data-path="${r.path}">
          ${icon(r.icon)}<span>${esc(r.label)}</span>
          ${r.badge ? `<span class="side__n ${r.tone === 'bad' ? '' : 'side__n--quiet'}" data-badge="${r.badge}" hidden>0</span>` : ''}
        </a>`).join('')}
    </div>`;
  }).join('');
}

/** Sidebar counters. Failure here must never break the page you are on. */
async function refreshBadges() {
  try {
    const d = await api('/admin/dashboard');
    const counts = {
      new_enquiries: d.enquiries.new,
      overdue: d.money.overdue_count,
    };
    for (const [key, n] of Object.entries(counts)) {
      const node = $(`[data-badge="${key}"]`);
      if (!node) continue;
      node.textContent = n > 99 ? '99+' : n;
      node.hidden = !n;
    }
    const chip = $('#googleChip');
    const live = d.google.mode === 'live';
    chip.hidden = false;
    chip.textContent = live ? 'Google reviews: live' : 'Google reviews: sample';
    chip.title = {
      live: 'A Google Maps API key and a Place ID are configured; reviews are pulled live.',
      'key-without-place-id': 'An API key is set but no clinic has a Google Place ID yet.',
      seeded: 'No Google Maps API key configured — the site is showing sample reviews.',
    }[d.google.mode];
  } catch { /* a stale badge is better than a broken screen */ }
}

/* ------------------------------------------------------------- router ---- */

let currentToken = 0;

function parseHash() {
  const raw = (location.hash || '#/dashboard').replace(/^#\/?/, '');
  const [path, ...rest] = raw.split('/');
  return { path: path || 'dashboard', params: rest.filter(Boolean) };
}

async function route() {
  const { path, params } = parseHash();
  const r = findRoute(path);
  const token = ++currentToken;

  closeModal(undefined);
  closeDrawer(undefined);
  $('#side').classList.remove('open');
  $('#sideToggle').setAttribute('aria-expanded', 'false');

  if (!r) { location.hash = '#/dashboard'; return; }
  if (r.roles && !r.roles.includes(session.user.role)) {
    setHead('Not available', `Your role (${session.user.role}) cannot open that page.`);
    $('#view').innerHTML = `<div class="card"><div class="card__b">
      <p class="note note--warn">That section is limited to: ${r.roles.join(', ')}.</p></div></div>`;
    return;
  }

  $$('#nav a').forEach((a) => a.classList.toggle('on', a.dataset.path === path));
  setHead(r.title, '');
  const mount = $('#view');
  mount.innerHTML = spinner();

  try {
    const mod = await import(`./${r.mod}`);
    if (token !== currentToken) return;           // a newer navigation won

    const entry = mod[r.entry || 'render'] || mod.render;
    await entry({
      mount,
      params,
      route: r,
      path,
      setHead,
      isStale: () => token !== currentToken,
      reload: () => route(),
    });
  } catch (err) {
    if (token !== currentToken) return;
    if (err?.status === 401) return;               // the gate is already back up
    reportError(err);
    mount.innerHTML = `<div class="card"><div class="card__b">
      <p class="note note--bad">${esc(err.message || 'This page could not be loaded.')}</p>
      <div class="row" style="margin-top:.9rem">
        <button class="btn" onclick="location.reload()">Reload</button>
      </div></div></div>`;
  }
}

function setHead(title, sub = '') {
  $('#pageTitle').textContent = title;
  $('#pageSub').textContent = sub;
  document.title = `${title} — TWACHA admin`;
}

/* --------------------------------------------------------------- chrome -- */

$('#sideToggle').addEventListener('click', () => {
  const open = $('#side').classList.toggle('open');
  $('#sideToggle').setAttribute('aria-expanded', String(open));
});

const whoBtn = $('#whoBtn');
const whoMenu = $('#whoMenu');
whoBtn.addEventListener('click', () => {
  const open = whoMenu.hidden;
  whoMenu.hidden = !open;
  whoBtn.setAttribute('aria-expanded', String(open));
});
document.addEventListener('click', (e) => {
  if (!whoMenu.hidden && !e.target.closest('#who')) {
    whoMenu.hidden = true;
    whoBtn.setAttribute('aria-expanded', 'false');
  }
});
on(whoMenu, 'click', 'a', () => { whoMenu.hidden = true; });

$('#logoutBtn').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* leaving anyway */ }
  session.user = null;
  session.csrf = null;
  whoMenu.hidden = true;
  toastOk('Signed out.');
  showGate();
});

/* A session that expires while the tab is open should say so once, clearly,
   rather than failing every subsequent click in a different way. */
window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.status === 401 && session.user) {
    session.user = null;
    session.csrf = null;
    toastBad('Your session expired. Sign in again.');
    showGate();
  }
});

boot();
