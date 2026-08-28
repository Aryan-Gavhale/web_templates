/* =============================================================================
   Website content — page sections, treatments, doctors, clinics, reviews.

   One module for all of them because they are the same screen with a different
   field list: a reorderable table, a create/edit drawer, a publish toggle and a
   delete guard. The field lists mirror the server's column map, so a form
   cannot offer a field the API would refuse to write.
   ========================================================================== */

import {
  $, $$, esc, api, money, fmtDate, statusChip, plural, titleCase, or,
  toastOk, reportError, on, confirmModal, drawer, dl, withBusy, session,
} from './core.js';
import { listScreen, table, twoLine, enableReorder, actPub } from './list.js';
import { createRow, editRow, formDrawer } from './forms.js';

/* Reference lists shared by several forms. */
let refs = null;
async function loadRefs(force = false) {
  if (refs && !force) return refs;
  const [categories, locations] = await Promise.all([
    api('/admin/categories', { query: { limit: 200 } }),
    api('/admin/locations', { query: { limit: 100 } }),
  ]);
  refs = { categories: categories.items, locations: locations.items };
  return refs;
}

const SUBNAV = [
  ['content', 'Page sections'],
  ['services', 'Treatments'],
  ['categories', 'Categories'],
  ['doctors', 'Doctors'],
  ['locations', 'Clinics'],
  ['reviews', 'Reviews'],
];

const subnav = (active) => `
  <nav class="subnav">
    ${SUBNAV.map(([path, label]) =>
      `<a href="#/${path}" class="${path === active ? 'on' : ''}">${esc(label)}</a>`).join('')}
  </nav>`;

/* ============================================================== router ==== */

export async function render(ctx) {
  await loadRefs();

  if (ctx.path === 'content' && ctx.params[0]) return sectionItems(ctx, Number(ctx.params[0]));

  const screens = {
    content: sections,
    services,
    categories,
    doctors,
    locations,
    reviews,
  };
  return (screens[ctx.path] || sections)(ctx);
}

/**
 * The server refuses content writes from a staff account. Reflecting that here
 * matters: otherwise reception sees Edit and Delete on every row, fills in a
 * whole form, and only then gets told they were never allowed to save it.
 */
const canWrite = () => ['owner', 'manager'].includes(session.user?.role);

/** Wraps a list screen with the shared sub-navigation. */
function shell(mount, active) {
  const ro = !canWrite();

  mount.innerHTML = subnav(active) + (ro ? `<div class="note note--warn">Your role
    (${esc(session.user.role)}) can read the website content but not change it.
    Ask an owner or manager to make edits.</div>` : '');

  /* One class rather than a check inside every action cell: the rule in
     admin.css hides the write controls, and it keeps working through a search
     or filter repaint without anything having to remember to reapply it. */
  mount.classList.toggle('ro', ro);

  const host = document.createElement('div');
  mount.append(host);
  return host;
}

const publishChip = (row) => (row.is_published
  ? '<span class="chip chip--ok">Live</span>'
  : '<span class="chip chip--warn">Hidden</span>');

const handle = '<span class="hnd" title="Drag to reorder">⠿</span>';

/* Only one content list is on screen at a time, so the visible list's refresh
   is held here for the reorder handler to fall back on when a save fails. */
let refreshActive = null;
const reorderIn = (resource) => (region) => {
  if (!canWrite()) return;                 // dragging would only earn a 403
  enableReorder(region, resource, () => refreshActive?.());
};

/**
 * The behaviour every content list shares: create, edit, publish toggle,
 * delete with a named consequence, and drag reordering.
 */
function wireCrud({ host, screen, resource, label, fields, extraFields, rowsRef }) {
  refreshActive = screen.refresh;

  /* The controls are hidden by CSS for a read-only role, but not binding the
     handlers at all is the part that actually guarantees nothing is attempted. */
  if (!canWrite()) return;

  on(host, 'click', '[data-new]', () => createRow({
    resource, title: `New ${label}`, fields: fields(), onDone: screen.refresh,
  }));

  on(screen.card, 'click', '[data-act=edit]', async (e, btn) => {
    e.stopPropagation();
    const row = rowsRef().find((r) => r.id === Number(btn.closest('tr').dataset.id));
    if (!row) return;
    await editRow({
      resource, id: row.id, title: `Edit ${label}`, fields: fields(row), data: row,
      onDone: screen.refresh,
      ...(extraFields?.(row) || {}),
    });
  });

  on(screen.card, 'click', '[data-act=pub]', async (e, btn) => {
    e.stopPropagation();
    const row = rowsRef().find((r) => r.id === Number(btn.closest('tr').dataset.id));
    if (!row) return;
    try {
      await api(`/admin/${resource}/${row.id}`, {
        method: 'PATCH', body: { is_published: !row.is_published },
      });
      toastOk(row.is_published ? 'Hidden from the website.' : 'Published to the website.');
      await screen.refresh();
    } catch (err) { reportError(err); }
  });

  on(screen.card, 'click', '[data-act=del]', async (e, btn) => {
    e.stopPropagation();
    const row = rowsRef().find((r) => r.id === Number(btn.closest('tr').dataset.id));
    if (!row) return;
    const go = await confirmModal({
      title: `Delete this ${label}?`,
      danger: true,
      confirmLabel: 'Delete',
      message: `<strong>${esc(row.name || row.title || row.author || row.key)}</strong>
        will be removed from the database. This cannot be undone — if you only want it
        off the website, hide it instead.`,
    });
    if (!go) return;
    try {
      await api(`/admin/${resource}/${row.id}`, { method: 'DELETE' });
      toastOk('Deleted.');
      await screen.refresh();
    } catch (err) { reportError(err); }
  });
}

/* ============================================================ sections ==== */

const SECTION_KINDS = ['hero', 'stats', 'prose', 'steps', 'faq', 'cta', 'gallery', 'emi'];

const sectionFields = () => [
  { type: 'note', html: `Sections are the blocks of the home page. The <strong>key</strong> is what
      the page markup looks for, so changing it on an existing section will blank
      that block until the markup is updated to match.` },
  { type: 'row', fields: [
    { name: 'key', label: 'Key', type: 'text', required: true, placeholder: 'hero',
      hint: 'Lower-case, hyphens allowed.' },
    { name: 'kind', label: 'Section type', type: 'select', required: true,
      options: SECTION_KINDS.map((k) => ({ value: k, label: titleCase(k) })),
      hint: 'Determines how the items beneath it are rendered.' },
  ] },
  { name: 'eyebrow', label: 'Eyebrow', type: 'text', hint: 'The small capitalised line above the heading.' },
  { name: 'title', label: 'Heading', type: 'text' },
  { name: 'subtitle', label: 'Sub-heading', type: 'text' },
  { name: 'body', label: 'Body copy', type: 'textarea', rows: 6,
    hint: 'Leave a blank line between paragraphs.' },
  { type: 'row', fields: [
    { name: 'cta_label', label: 'Button text', type: 'text' },
    { name: 'cta_href', label: 'Button link', type: 'text', placeholder: '#booking' },
  ] },
  { name: 'media_id', label: 'Image', type: 'media', previewFrom: 'media_url' },
  { name: 'is_published', label: 'Show this section on the website', type: 'checkbox' },
];

async function sections({ mount, setHead }) {
  setHead('Page sections', 'The blocks that make up the home page, in order.');
  const host = shell(mount, 'content');
  let rows = [];

  const screen = listScreen({
    mount: host,
    search: 'Key, heading or copy…',
    actions: '<button class="btn btn--sm btn--pri" data-new>New section</button>',
    afterRender: reorderIn('sections'),
    fetchPage: async (state) => {
      const data = await api('/admin/sections', { query: { ...state, limit: 200 } });
      rows = data.items;
      return {
        meta: `${plural(data.total, 'section')} · drag to reorder`,
        html: table({
          columns: [
            { key: 'h', label: '', width: '2rem', cell: () => handle },
            { key: 'key', label: 'Key', cell: (r) => twoLine(
              `<span class="mono">${esc(r.key)}</span>`, esc(titleCase(r.kind))) },
            { key: 'title', label: 'Heading', cell: (r) => twoLine(
              or(r.title, '<span style="color:var(--faint)">No heading</span>'),
              esc(r.eyebrow || '')) },
            { key: 'items', label: 'Items', cell: (r) => (r.item_count
              ? `<a href="#/content/${r.id}" style="text-decoration:underline">${plural(r.item_count, 'item')}</a>`
              : '<span style="color:var(--faint)">none</span>') },
            { key: 'img', label: 'Image', cell: (r) => (r.media_url
              ? `<img src="${esc(r.media_url)}" alt="" class="pick__t" style="width:44px;height:32px">`
              : '<span style="color:var(--faint)">—</span>') },
            { key: 'pub', label: '', cell: publishChip },
            { key: 'act', label: '', cls: 't__act', cell: (r) => `
              <div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                <button class="btn btn--sm" data-act="items">Items</button>
                ${actPub(r)}
                <button class="btn btn--sm" data-act="edit">Edit</button>
                <button class="btn btn--sm btn--bad" data-act="del">Delete</button>
              </div>` },
          ],
          rows,
          emptyTitle: 'No sections',
          emptyText: 'Run npm run seed to install the standard set, or create one.',
        }),
      };
    },
  });

  wireCrud({
    host: mount, screen, resource: 'sections', label: 'section',
    fields: sectionFields, rowsRef: () => rows,
  });

  on(screen.card, 'click', '[data-act=items]', (e, btn) => {
    e.stopPropagation();
    location.hash = `#/content/${btn.closest('tr').dataset.id}`;
  });
}

/* ------------------------------------------------------ section items ---- */

const itemFields = (kind) => [
  { type: 'note', tone: kind === 'stats' ? '' : null, html: hintFor(kind) },
  { name: 'title', label: kind === 'faq' ? 'Question' : 'Title', type: 'text' },
  { name: 'body', label: kind === 'faq' ? 'Answer' : 'Body', type: 'textarea', rows: 4 },
  ...(kind === 'stats' || kind === 'emi' ? [{ type: 'row', fields: [
    { name: 'value', label: 'Figure', type: 'text', placeholder: '12,400',
      hint: 'Digits count up on the website.' },
    { name: 'suffix', label: 'Suffix', type: 'text', placeholder: '+ or /5 or months' },
  ] }] : []),
  { name: 'media_id', label: 'Image', type: 'media', previewFrom: 'media_url' },
  { name: 'is_published', label: 'Show this item', type: 'checkbox' },
];

function hintFor(kind) {
  const map = {
    stats: 'A figure and a label. The number animates on the website, so keep it a plain numeral.',
    faq: 'One question and its answer. Answers are shown one at a time in an accordion.',
    steps: 'One step of the patient journey. Order is the order shown.',
    gallery: 'One photograph. The image matters more than the text here.',
    emi: 'One tenure tile: the number of months, and what it costs.',
  };
  return map[kind] || 'A single item within this section.';
}

async function sectionItems({ mount, setHead }, sectionId) {
  const parent = await api(`/admin/sections/${sectionId}`);
  setHead(`${parent.title || parent.key} — items`, `${titleCase(parent.kind)} section`);

  mount.innerHTML = subnav('content');
  const host = document.createElement('div');
  mount.append(host);

  let rows = [];

  const screen = listScreen({
    mount: host,
    actions: `<a class="btn btn--sm" href="#/content">&larr; All sections</a>
              <button class="btn btn--sm btn--pri" data-new>New item</button>`,
    afterRender: reorderIn('section_items'),
    fetchPage: async () => {
      const data = await api('/admin/section_items', {
        query: { section_id: sectionId, limit: 200 },
      });
      rows = data.items;
      return {
        meta: `${plural(data.total, 'item')} · drag to reorder`,
        html: table({
          columns: [
            { key: 'h', label: '', width: '2rem', cell: () => handle },
            { key: 'v', label: 'Figure', cell: (r) => (r.value
              ? `<strong>${esc(r.value)}</strong>${esc(r.suffix || '')}`
              : '<span style="color:var(--faint)">—</span>') },
            { key: 'title', label: 'Title', cell: (r) => twoLine(
              or(r.title), esc((r.body || '').slice(0, 90) + ((r.body || '').length > 90 ? '…' : ''))) },
            { key: 'img', label: 'Image', cell: (r) => (r.media_url
              ? `<img src="${esc(r.media_url)}" alt="" class="pick__t" style="width:44px;height:32px">`
              : '<span style="color:var(--faint)">—</span>') },
            { key: 'pub', label: '', cell: publishChip },
            { key: 'act', label: '', cls: 't__act', cell: (r) => `
              <div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                ${actPub(r)}
                <button class="btn btn--sm" data-act="edit">Edit</button>
                <button class="btn btn--sm btn--bad" data-act="del">Delete</button>
              </div>` },
          ],
          rows,
          emptyTitle: 'No items in this section',
          emptyText: 'Add the first one.',
          emptyAction: '<button class="btn btn--pri" data-new>New item</button>',
        }),
      };
    },
  });

  on(mount, 'click', '[data-new]', () => createRow({
    resource: 'section_items',
    title: 'New item',
    fields: itemFields(parent.kind),
    extra: { section_id: sectionId },
    onDone: screen.refresh,
  }));

  wireCrud({
    host: mount, screen, resource: 'section_items', label: 'item',
    fields: () => itemFields(parent.kind), rowsRef: () => rows,
  });
}

/* ============================================================ services ==== */

const serviceFields = () => [
  { name: 'name', label: 'Treatment name', type: 'text', required: true },
  { name: 'category_id', label: 'Category', type: 'select',
    options: refs.categories.map((c) => ({ value: c.id, label: c.name })),
    hint: 'Categories become the filter tabs on the website.' },
  { name: 'summary', label: 'One-line summary', type: 'textarea', rows: 2,
    hint: 'Shown on the card. Two lines at most reads best.' },
  { name: 'body', label: 'How this works', type: 'textarea', rows: 5,
    hint: 'Revealed when a visitor expands the card. Plain language beats marketing.' },
  { type: 'fieldset', label: 'Price', fields: [
    { type: 'row', fields: [
      { name: 'price_from', label: 'From', type: 'money' },
      { name: 'price_to', label: 'To', type: 'money',
        hint: 'Leave blank for a single fee.' },
    ] },
    { name: 'price_note', label: 'Price note', type: 'text',
      placeholder: 'Consultation plus medicines; varies with grade' },
  ] },
  { type: 'row', fields: [
    { name: 'duration_min', label: 'Duration (minutes)', type: 'number', min: 0, max: 1440 },
    { name: 'sessions_typical', label: 'Typical course', type: 'text', placeholder: '6–8 sessions' },
  ] },
  { name: 'media_id', label: 'Image', type: 'media' },
  { name: 'is_emi_eligible', label: 'Can be paid monthly (EMI)', type: 'checkbox',
    hint: 'Adds the EMI badge on the website.' },
  { name: 'is_featured', label: 'Mark as popular', type: 'checkbox' },
  { name: 'is_published', label: 'Show on the website', type: 'checkbox' },
];

async function services({ mount, setHead }) {
  setHead('Treatments', 'What the clinic offers, with prices as published.');
  const host = shell(mount, 'services');
  let rows = [];

  const screen = listScreen({
    mount: host,
    search: 'Treatment name or summary…',
    actions: '<button class="btn btn--sm btn--pri" data-new>New treatment</button>',
    afterRender: reorderIn('services'),
    fetchPage: async (state) => {
      const data = await api('/admin/services', { query: { ...state, limit: 300 } });
      rows = data.items;
      return {
        meta: `${plural(data.total, 'treatment')} · drag to reorder`,
        html: table({
          columns: [
            { key: 'h', label: '', width: '2rem', cell: () => handle },
            { key: 'name', label: 'Treatment', cell: (r) => twoLine(
              esc(r.name), esc(r.summary || '')) },
            { key: 'cat', label: 'Category', cell: (r) => or(r.category_name) },
            { key: 'price', label: 'Price', align: 'right', cell: (r) => (
              r.price_from_paise
                ? twoLine(`${money(r.price_from_paise)}${r.price_to_paise ? `–${money(r.price_to_paise, { sign: false })}` : ''}`,
                  r.duration_min ? `${r.duration_min} min` : '')
                : '<span style="color:var(--faint)">Not published</span>') },
            { key: 'flags', label: '', cell: (r) => [
              r.is_featured ? '<span class="chip chip--warn">Popular</span>' : '',
              r.is_emi_eligible ? '<span class="chip chip--clay">EMI</span>' : '',
            ].filter(Boolean).join(' ') },
            { key: 'pub', label: '', cell: publishChip },
            { key: 'act', label: '', cls: 't__act', cell: (r) => `
              <div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                ${actPub(r)}
                <button class="btn btn--sm" data-act="edit">Edit</button>
                <button class="btn btn--sm btn--bad" data-act="del">Delete</button>
              </div>` },
          ],
          rows,
          emptyTitle: 'No treatments',
          emptyText: 'Add the first treatment so the website has something to show.',
          emptyAction: '<button class="btn btn--pri" data-new>New treatment</button>',
        }),
      };
    },
  });

  wireCrud({
    host: mount, screen, resource: 'services', label: 'treatment',
    fields: serviceFields, rowsRef: () => rows,
  });
}

/* ========================================================== categories ==== */

async function categories({ mount, setHead }) {
  setHead('Treatment categories', 'The filter tabs above the treatment grid.');
  const host = shell(mount, 'categories');
  let rows = [];

  const fields = () => [
    { name: 'name', label: 'Name', type: 'text', required: true },
    { name: 'blurb', label: 'Blurb', type: 'textarea', rows: 2,
      hint: 'Optional description. Not shown on the current home page layout.' },
  ];

  const screen = listScreen({
    mount: host,
    search: 'Category name…',
    actions: '<button class="btn btn--sm btn--pri" data-new>New category</button>',
    afterRender: reorderIn('categories'),
    fetchPage: async (state) => {
      const data = await api('/admin/categories', { query: { ...state, limit: 200 } });
      rows = data.items;
      return {
        meta: `${plural(data.total, 'category', 'categories')} · drag to reorder`,
        html: table({
          columns: [
            { key: 'h', label: '', width: '2rem', cell: () => handle },
            { key: 'name', label: 'Category', cell: (r) => twoLine(esc(r.name),
              `<span class="mono">${esc(r.slug)}</span>`) },
            { key: 'blurb', label: 'Blurb', cell: (r) => or(r.blurb) },
            { key: 'act', label: '', cls: 't__act', cell: () => `
              <div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                <button class="btn btn--sm" data-act="edit">Edit</button>
                <button class="btn btn--sm btn--bad" data-act="del">Delete</button>
              </div>` },
          ],
          rows,
          emptyTitle: 'No categories',
          emptyText: 'Without categories the treatment grid shows a single "All" tab.',
          emptyAction: '<button class="btn btn--pri" data-new>New category</button>',
        }),
      };
    },
  });

  wireCrud({ host: mount, screen, resource: 'categories', label: 'category', fields, rowsRef: () => rows });
}

/* ============================================================= doctors ==== */

const doctorFields = () => [
  { name: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Dr Aditi Deshmukh' },
  { type: 'row', fields: [
    { name: 'credentials', label: 'Credentials', type: 'text', placeholder: 'MBBS, MD (Dermatology)' },
    { name: 'registration_no', label: 'Registration number', type: 'text',
      hint: 'Displayed for transparency where required.' },
  ] },
  { name: 'role_title', label: 'Role', type: 'text', placeholder: 'Consultant Dermatologist — Hair & Scalp' },
  { type: 'row', fields: [
    { name: 'experience_years', label: 'Years of experience', type: 'number', min: 0, max: 70 },
    { name: 'languages', label: 'Languages', type: 'text', placeholder: 'English, Hindi, Marathi' },
  ] },
  { name: 'bio', label: 'Biography', type: 'textarea', rows: 6 },
  { name: 'media_id', label: 'Photograph', type: 'media' },
  { name: 'is_published', label: 'Show on the website', type: 'checkbox' },
];

async function doctors({ mount, setHead }) {
  setHead('Doctors', 'The consultants shown on the website.');
  const host = shell(mount, 'doctors');
  let rows = [];

  const screen = listScreen({
    mount: host,
    search: 'Name or credentials…',
    actions: '<button class="btn btn--sm btn--pri" data-new>New doctor</button>',
    afterRender: reorderIn('doctors'),
    fetchPage: async (state) => {
      const data = await api('/admin/doctors', { query: { ...state, limit: 200 } });
      rows = data.items;
      return {
        meta: `${plural(data.total, 'doctor')} · drag to reorder`,
        html: table({
          columns: [
            { key: 'h', label: '', width: '2rem', cell: () => handle },
            { key: 'img', label: '', width: '3.5rem', cell: (r) => `
              <img src="${esc(r.image_url || '/assets/img/placeholder.svg')}" alt=""
                   class="pick__t" style="width:40px;height:40px;border-radius:50%">` },
            { key: 'name', label: 'Doctor', cell: (r) => twoLine(esc(r.name), esc(r.credentials || '')) },
            { key: 'role', label: 'Role', cell: (r) => twoLine(or(r.role_title),
              r.experience_years ? `${r.experience_years} years` : '') },
            { key: 'pub', label: '', cell: publishChip },
            { key: 'act', label: '', cls: 't__act', cell: (r) => `
              <div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                ${actPub(r)}
                <button class="btn btn--sm" data-act="edit">Edit</button>
                <button class="btn btn--sm btn--bad" data-act="del">Delete</button>
              </div>` },
          ],
          rows,
          emptyTitle: 'No doctors listed',
          emptyAction: '<button class="btn btn--pri" data-new>New doctor</button>',
        }),
      };
    },
  });

  wireCrud({ host: mount, screen, resource: 'doctors', label: 'doctor', fields: doctorFields, rowsRef: () => rows });
}

/* =========================================================== locations ==== */

const locationFields = () => [
  { name: 'name', label: 'Clinic name', type: 'text', required: true, placeholder: 'TWACHA Koregaon Park' },
  { name: 'address_line1', label: 'Address line 1', type: 'text' },
  { name: 'address_line2', label: 'Address line 2', type: 'text' },
  { type: 'row', fields: [
    { name: 'city', label: 'City', type: 'text' },
    { name: 'state', label: 'State', type: 'text' },
    { name: 'pincode', label: 'PIN code', type: 'text' },
  ] },
  { type: 'row', fields: [
    { name: 'phone', label: 'Phone', type: 'tel' },
    { name: 'whatsapp', label: 'WhatsApp', type: 'tel' },
  ] },
  { name: 'hours', label: 'Opening hours', type: 'textarea', rows: 3,
    hint: 'One line per row, e.g. "Mon–Fri 10:00–19:30".' },
  { type: 'fieldset', label: 'Google Maps', fields: [
    { name: 'google_place_id', label: 'Place ID', type: 'text',
      placeholder: 'ChIJ…',
      hint: 'Needed to pull live reviews and photographs. Find it under Settings → Google.' },
    { name: 'google_maps_url', label: 'Directions link', type: 'text',
      placeholder: 'https://maps.google.com/…',
      hint: 'The link behind the "Directions" button.' },
  ] },
  { name: 'is_primary', label: 'This is the main clinic', type: 'checkbox',
    hint: 'The main clinic supplies the phone number in the header and footer.' },
  { name: 'is_published', label: 'Show on the website', type: 'checkbox' },
];

async function locations({ mount, setHead }) {
  setHead('Clinics', 'Addresses, hours and the Google Place ID behind live reviews.');
  const host = shell(mount, 'locations');
  let rows = [];

  const screen = listScreen({
    mount: host,
    search: 'Name, address or city…',
    actions: '<button class="btn btn--sm btn--pri" data-new>New clinic</button>',
    afterRender: reorderIn('locations'),
    fetchPage: async (state) => {
      const data = await api('/admin/locations', { query: { ...state, limit: 100 } });
      rows = data.items;
      return {
        meta: `${plural(data.total, 'clinic')}`,
        html: table({
          columns: [
            { key: 'h', label: '', width: '2rem', cell: () => handle },
            { key: 'name', label: 'Clinic', cell: (r) => twoLine(
              `${esc(r.name)}${r.is_primary ? ' <span class="chip chip--teal">Main</span>' : ''}`,
              esc([r.address_line1, r.city, r.pincode].filter(Boolean).join(', '))) },
            { key: 'phone', label: 'Phone', cell: (r) => twoLine(or(r.phone),
              r.whatsapp ? `WhatsApp ${esc(r.whatsapp)}` : '') },
            { key: 'g', label: 'Google', cell: (r) => (r.google_place_id
              ? '<span class="chip chip--ok">Place ID set</span>'
              : '<span class="chip chip--warn">No Place ID</span>') },
            { key: 'pub', label: '', cell: publishChip },
            { key: 'act', label: '', cls: 't__act', cell: (r) => `
              <div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                ${actPub(r)}
                <button class="btn btn--sm" data-act="edit">Edit</button>
                <button class="btn btn--sm btn--bad" data-act="del">Delete</button>
              </div>` },
          ],
          rows,
          emptyTitle: 'No clinics listed',
          emptyAction: '<button class="btn btn--pri" data-new>New clinic</button>',
        }),
      };
    },
  });

  wireCrud({
    host: mount, screen, resource: 'locations', label: 'clinic',
    fields: locationFields, rowsRef: () => rows,
  });
}

/* ============================================================= reviews ==== */

const reviewFields = () => [
  { name: 'author', label: 'Patient name', type: 'text', required: true },
  { type: 'row', fields: [
    { name: 'rating', label: 'Rating (1–5)', type: 'number', min: 1, max: 5, value: 5 },
    { name: 'reviewed_at', label: 'Date', type: 'date' },
  ] },
  { name: 'body', label: 'Review', type: 'textarea', rows: 5, required: true },
  { type: 'row', fields: [
    { name: 'treatment', label: 'Treatment', type: 'text' },
    { name: 'location_id', label: 'Clinic', type: 'select',
      options: refs.locations.map((l) => ({ value: l.id, label: l.name })) },
  ] },
  { name: 'is_published', label: 'Show on the website', type: 'checkbox' },
];

async function reviews({ mount, setHead }) {
  setHead('Reviews', 'Google reviews pulled live, plus anything the clinic publishes itself.');
  const host = shell(mount, 'reviews');
  let rows = [];
  let gstatus = null;

  const screen = listScreen({
    mount: host,
    search: 'Author or review text…',
    actions: `<button class="btn btn--sm" data-sync>Sync from Google</button>
              <button class="btn btn--sm btn--pri" data-new>Add review</button>`,
    afterRender: reorderIn('testimonials'),
    fetchPage: async (state) => {
      const [data, g] = await Promise.all([
        api('/admin/testimonials', { query: { ...state, limit: 200 } }),
        api('/admin/google/status').catch(() => null),
      ]);
      rows = data.items;
      gstatus = g;

      return {
        meta: `${plural(data.total, 'review')}`,
        html: `${googleNote(g, rows)}
          ${table({
            columns: [
              { key: 'h', label: '', width: '2rem', cell: () => handle },
              { key: 'who', label: 'Author', cell: (r) => twoLine(esc(r.author),
                [r.treatment, r.location_name].filter(Boolean).map(esc).join(' · ')) },
              { key: 'stars', label: 'Rating', width: '5.5rem',
                cell: (r) => `<span style="color:var(--gold);letter-spacing:.08em">${
                  '★★★★★'.slice(0, Math.round(r.rating || 0)).padEnd(5, '☆')}</span>` },
              { key: 'body', label: 'Review', cell: (r) => esc(
                (r.body || '').slice(0, 110) + ((r.body || '').length > 110 ? '…' : '')) },
              { key: 'src', label: 'Source', cell: (r) => sourceChip(r.source) },
              { key: 'date', label: 'Date', align: 'right', cell: (r) => or(fmtDate(r.reviewed_at)) },
              { key: 'pub', label: '', cell: publishChip },
              { key: 'act', label: '', cls: 't__act', cell: (r) => `
                <div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                  ${actPub(r)}
                  ${r.source === 'google' ? '' : '<button class="btn btn--sm" data-act="edit">Edit</button>'}
                  <button class="btn btn--sm btn--bad" data-act="del">Delete</button>
                </div>` },
            ],
            rows,
            emptyTitle: 'No reviews',
            emptyText: 'Sync from Google, or add one the clinic collected itself.',
          })}`,
      };
    },
  });

  wireCrud({
    host: mount, screen, resource: 'testimonials', label: 'review',
    fields: reviewFields, rowsRef: () => rows,
  });

  on(mount, 'click', '[data-sync]', (e) => withBusy(e.target, async () => {
    if (!gstatus?.key_present) {
      await confirmModal({
        title: 'No Google API key',
        confirmLabel: 'Open settings',
        message: `Live reviews need a Google Maps API key with the <strong>Places API (New)</strong>
          enabled, set as <code>GOOGLE_MAPS_API_KEY</code> in the project's <code>.env</code> file,
          and a Place ID on at least one clinic.`,
      }).then((go) => { if (go) location.hash = '#/settings'; });
      return;
    }
    try {
      const out = await api('/admin/google/sync', { method: 'POST', body: {} });
      toastOk(out.note || `${out.returned} review(s) synced.`, 'Google');
      await screen.refresh();
    } catch (err) { reportError(err); }
  }));
}

const sourceChip = (src) => ({
  google: '<span class="chip chip--info">Google</span>',
  'google-seed': '<span class="chip chip--warn">Sample</span>',
  clinic: '<span class="chip">Clinic</span>',
}[src] || `<span class="chip">${esc(src || 'clinic')}</span>`);

function googleNote(g, rows) {
  if (!g) return '';
  const seeded = rows.filter((r) => r.source === 'google-seed').length;

  if (!g.key_present) {
    return `<div class="bar" style="border-radius:0;background:var(--gold-soft);border-color:#EBD9AE">
      <span style="font-size:.79rem;color:#7A5D1C">
        No Google API key is configured, so the website is showing
        <strong>${seeded} sample review${seeded === 1 ? '' : 's'}</strong>.
        <a href="#/settings" style="text-decoration:underline">How to connect Google</a>.
      </span></div>`;
  }
  if (!g.place_id) {
    return `<div class="bar" style="border-radius:0;background:var(--gold-soft);border-color:#EBD9AE">
      <span style="font-size:.79rem;color:#7A5D1C">
        An API key is set, but no clinic has a Google Place ID, so there is nothing to sync.
        <a href="#/locations" style="text-decoration:underline">Add one under Clinics</a>.
      </span></div>`;
  }

  return `<div class="bar" style="border-radius:0;background:var(--info-soft);border-color:#CFDDF3">
    <span style="font-size:.79rem;color:#2C4A80">
      Live: <strong>${g.live_review_count}</strong> pulled from Google. Google returns at most
      <strong>five reviews per clinic</strong> through its API — that is a Google limit, not a
      fault here. Publish your own to show more.
    </span></div>`;
}
