/* =============================================================================
   Smoke test — reads every endpoint against a running server and checks the
   role rules still hold.

     npm start          # in one terminal
     npm run smoke      # in another

   It is deliberately read-only apart from the writes it needs to prove a
   permission is refused, and those are all expected to fail. Nothing here
   changes data, so it is safe against a seeded database.

   Exits non-zero on the first sign of trouble, so CI can use it.
   ========================================================================== */

const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:5173';

const ACCOUNTS = {
  owner: ['owner@twacha.in', process.env.SEED_ADMIN_PASSWORD || 'TwachaAdmin2026'],
  manager: ['manager@twacha.in', 'ClinicManager2026'],
  staff: ['reception@twacha.in', 'FrontDesk2026'],
};

let failures = 0;
const record = (ok, line) => {
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${line}`);
};

async function signIn(role) {
  const [email, password] = ACCOUNTS[role];
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (res.status !== 200) {
    console.error(`\nCould not sign in as ${role} (${res.status}). Has the database been seeded?`);
    process.exit(1);
  }
  const body = await res.json();
  return {
    csrf: body.csrf,
    cookie: (res.headers.getSetCookie?.() || []).map((c) => c.split(';')[0]).join('; '),
  };
}

async function call(path, { cookie, csrf, method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, text: await res.text() };
}

/* ------------------------------------------------------------- endpoints -- */

const owner = await signIn('owner');

console.log('\nEndpoints (as owner)');
for (const path of [
  '/api/site',
  '/api/reviews',
  '/api/admin/dashboard',
  '/api/admin/enquiries?limit=5',
  '/api/admin/enquiries/1',
  '/api/admin/patients?limit=5',
  '/api/admin/patients/1',
  '/api/admin/emi-plans?limit=5',
  '/api/admin/emi-plans/1',
  '/api/admin/installments?view=overdue',
  '/api/admin/installments?view=due',
  '/api/admin/installments?view=paid',
  '/api/admin/installments?view=month',
  '/api/admin/payments?limit=5',
  '/api/admin/sections?limit=50',
  '/api/admin/section_items?limit=50',
  '/api/admin/services?limit=50',
  '/api/admin/categories',
  '/api/admin/doctors',
  '/api/admin/locations',
  '/api/admin/testimonials',
  '/api/admin/media?limit=50',
  '/api/admin/settings',
  '/api/admin/users',
  '/api/admin/activity?limit=20',
  '/api/admin/google/status',
  '/api/admin/export/enquiries.csv',
  '/api/admin/export/payments.csv',
  '/api/admin/export/installments.csv',
]) {
  const r = await call(path, owner);
  record(r.status === 200, `${r.status}  ${String(r.text.length).padStart(7)}b  ${path}`);
}

/* --------------------------------------------------------- public shape --- */

/* A missing key here renders as a blank section rather than an error, which is
   exactly the kind of fault that reaches production unnoticed. */
console.log('\nPublic payload');
const site = JSON.parse((await call('/api/site')).text);
for (const [key, value] of Object.entries({
  sections: site.sections?.length,
  services: site.services?.length,
  categories: site.categories?.length,
  doctors: site.doctors?.length,
  locations: site.locations?.length,
  gallery: site.gallery?.length,
  reviews: site.reviews?.items?.length,
  rating: site.reviews?.summary?.rating,
  settings: Object.keys(site.settings || {}).length,
})) {
  record(Boolean(value), `${key} = ${value ?? 'missing'}`);
}

/* ------------------------------------------------------------ permissions - */

console.log('\nPermissions');
const manager = await signIn('manager');
const staff = await signIn('staff');

const probeSection = { key: `smoke-${Date.now()}`, kind: 'prose', title: 'Smoke probe' };

for (const [expected, label, path, opts] of [
  [401, 'anonymous cannot read the dashboard', '/api/admin/dashboard', {}],
  [403, 'a write without a CSRF token is refused', '/api/admin/sections',
    { ...owner, csrf: null, method: 'POST', body: probeSection }],
  [403, 'staff cannot change website content', '/api/admin/sections',
    { ...staff, method: 'POST', body: probeSection }],
  [403, 'staff cannot read staff accounts', '/api/admin/users', { ...staff }],
  [403, 'staff cannot change settings', '/api/admin/settings',
    { ...staff, method: 'PATCH', body: { clinic_name: 'Smoke' } }],
  [403, 'manager cannot create accounts', '/api/admin/users',
    { ...manager, method: 'POST', body: { name: 'Smoke', email: `smoke${Date.now()}@x.in`, role: 'staff', password: 'Smoke123456' } }],
  [200, 'manager can read website content', '/api/admin/sections', { ...manager }],
  [200, 'staff can read patients', '/api/admin/patients', { ...staff }],

  /* The media library sits on its own path and so bypasses the generic
     engine's role check. It had none of its own, and a staff account could
     delete an image that was live on the site. */
  [403, 'staff cannot add to the media library', '/api/admin/media/link',
    { ...staff, method: 'POST', body: { url: 'https://example.invalid/x.png' } }],
  [403, 'staff cannot delete media', '/api/admin/media/1', { ...staff, method: 'DELETE' }],
  [200, 'staff can still read the media library', '/api/admin/media', { ...staff }],
  [403, 'staff cannot drive billed Places searches', '/api/admin/google/find',
    { ...staff, method: 'POST', body: { query: 'clinic' } }],
]) {
  const r = await call(path, opts);
  record(r.status === expected, `${label} (${r.status}, expected ${expected})`);
}

/* ------------------------------------------------------------ hardening --- */

/* These are the regressions that would not show up as a broken screen: the
   panel would keep working and the site would quietly gain a script. */
console.log('\nHardening');

const JS_URL = 'javascript:alert(document.domain)';
const heroId = JSON.parse((await call('/api/admin/sections?limit=50', owner)).text)
  .items.find((s) => s.kind === 'hero')?.id;

for (const [expected, label, path, opts] of [
  [400, 'a javascript: URL is refused on a section button link', `/api/admin/sections/${heroId}`,
    { ...owner, method: 'PATCH', body: { cta_href: JS_URL } }],
  [400, 'a protocol-relative link is refused there too', `/api/admin/sections/${heroId}`,
    { ...owner, method: 'PATCH', body: { cta_href: '//evil.example' } }],
  [200, 'an ordinary in-page anchor is still accepted', `/api/admin/sections/${heroId}`,
    { ...owner, method: 'PATCH', body: { cta_href: '#booking' } }],
  [400, 'a javascript: URL is refused on a url-kind setting', '/api/admin/settings',
    { ...owner, method: 'PATCH', body: { instagram_url: JS_URL } }],
]) {
  const r = await call(path, opts);
  record(r.status === expected, `${label} (${r.status}, expected ${expected})`);
}

/* An upload is identified by its leading bytes, not by the name or the
   Content-Type the client chose, because both used to decide what landed on
   disk and what /uploads then served it back as. */
const fd = new FormData();
fd.append('files', new File(['<script>alert(1)</script>'], 'probe.html', { type: 'image/png' }));
const up = await fetch(`${BASE}/api/admin/media/upload`, {
  method: 'POST',
  headers: { cookie: owner.cookie, 'x-csrf-token': owner.csrf },
  body: fd,
});
record(up.status === 400, `HTML declared as an image is refused on upload (${up.status}, expected 400)`);

const csp = (await fetch(`${BASE}/`)).headers.get('content-security-policy') || '';
record(csp.includes("script-src 'self'") && !csp.includes("'unsafe-inline' 'self'"),
  `a Content-Security-Policy is sent, with script-src 'self'`);

for (const s of [owner, manager, staff]) {
  await call('/api/auth/logout', { ...s, method: 'POST' });
}

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll checks passed.\n');
process.exit(failures ? 1 : 0);
