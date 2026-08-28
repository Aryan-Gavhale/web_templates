/* =============================================================================
   Enquiries — the reception queue.

   The list is a triage view; the drawer is where an enquiry is actually worked:
   status, priority, owner, notes, and the one-click conversion into a patient
   record so an EMI plan can be raised against it.
   ========================================================================== */

import {
  $, $$, esc, api, session, fmtWhen, fmtAgo, fmtDate, statusChip, titleCase,
  drawer, closeDrawer, toastOk, reportError, withBusy, on, dl, confirmModal, or,
} from './core.js';
import { listScreen, table, twoLine } from './list.js';

const STATUSES = ['new', 'contacted', 'booked', 'completed', 'closed', 'spam'];

/* Reference data the drawer needs. Fetched once per page visit. */
let refs = null;
async function loadRefs() {
  if (refs) return refs;
  const [services, users] = await Promise.all([
    api('/admin/services', { query: { limit: 500 } }),
    api('/admin/users').catch(() => ({ items: [] })),   // staff cannot list users
  ]);
  refs = { services: services.items, users: users.items };
  return refs;
}

export async function render({ mount, setHead, params }) {
  refs = null;
  setHead('Enquiries', 'Everything submitted through the website booking form.');

  const screen = listScreen({
    mount,
    search: 'Name, phone, email or message…',
    filters: [
      { name: 'status', type: 'segs', value: 'new', options: [
        { value: 'new', label: 'New' },
        { value: 'contacted', label: 'Contacted' },
        { value: 'booked', label: 'Booked' },
        { value: 'completed', label: 'Completed' },
        { value: 'closed', label: 'Closed' },
        { value: 'all', label: 'All' },
      ] },
      { name: 'from', type: 'date', label: 'From' },
      { name: 'to', type: 'date', label: 'To' },
    ],
    actions: `
      <label class="check" style="margin:0">
        <input type="checkbox" data-filter-emi>
        <span style="font-size:.775rem">EMI only</span>
      </label>
      <a class="btn btn--sm" href="/api/admin/export/enquiries.csv">Export CSV</a>`,
    fetchPage,
  });

  /* The EMI toggle is not a segment, so it is wired by hand. */
  on(screen.card, 'change', '[data-filter-emi]', (_e, box) => {
    screen.state.emi_only = box.checked ? '1' : '';
    screen.refresh();
  });

  on(screen.card, 'click', 'tbody tr', async (_e, tr) => {
    await openEnquiry(Number(tr.dataset.id), screen.refresh);
  });

  /* Deep link: #/enquiries/12 opens that record straight away. */
  if (params[0]) await openEnquiry(Number(params[0]), screen.refresh);
}

async function fetchPage(state) {
  const data = await api('/admin/enquiries', { query: { ...state, limit: 200 } });

  return {
    meta: `${data.total} total`,
    html: table({
      columns: [
        { key: 'who', label: 'Enquiry', cell: (r) => twoLine(
          `${esc(r.name)}${r.priority === 'high' ? ' <span class="chip chip--bad">High</span>' : ''}`,
          `${esc(r.phone)}${r.email ? ` · ${esc(r.email)}` : ''}`) },

        { key: 'about', label: 'About', cell: (r) => twoLine(
          esc(r.service_name || 'Not stated'),
          [r.location_name, r.preferred_time].filter(Boolean).map(esc).join(' · ')) },

        { key: 'flags', label: '', cell: (r) => [
          r.wants_emi ? '<span class="chip chip--clay">EMI</span>' : '',
          r.patient_id ? '<span class="chip chip--teal">Patient</span>' : '',
          r.note_count ? `<span class="chip">${r.note_count} note${r.note_count > 1 ? 's' : ''}</span>` : '',
        ].filter(Boolean).join(' ') },

        { key: 'status', label: 'Status', cell: (r) => statusChip(r.status) },

        { key: 'owner', label: 'Owner', cell: (r) => or(r.assignee_name, '<span style="color:var(--faint)">Unassigned</span>') },

        { key: 'when', label: 'Received', align: 'right',
          cell: (r) => twoLine(fmtAgo(r.created_at),
            `<span title="${esc(fmtWhen(r.created_at))}">${esc(fmtDate(r.created_at))}</span>`) },
      ],
      rows: data.items,
      rowClass: () => 'click',
      emptyTitle: 'No enquiries match',
      emptyText: 'Change the filters above, or wait for the next website submission.',
    }),
  };
}

/* --------------------------------------------------------------- drawer -- */

async function openEnquiry(id, refresh) {
  let e;
  try {
    [e] = await Promise.all([api(`/admin/enquiries/${id}`), loadRefs()]);
  } catch (err) { reportError(err); return; }

  const body = document.createElement('div');
  body.className = 'stack';
  paint();

  await drawer({ title: `Enquiry #${e.id} — ${e.name}`, body });
  await refresh();

  /* The list sits visible behind the drawer, so a saved change has to land there
     immediately — otherwise the row still reads "New" next to a status select
     that now says "Contacted". The sidebar badge follows the `admin:wrote`
     event from core.js and needs no help here. */
  async function syncBehind() {
    try { await refresh(); } catch { /* the drawer is the user's focus */ }
  }

  function paint() {
    body.innerHTML = `
      <div class="card"><div class="card__b">
        ${dl([
          ['Received', esc(fmtWhen(e.created_at))],
          ['Name', esc(e.name)],
          ['Phone', `<a href="tel:${esc(e.phone)}" style="text-decoration:underline">${esc(e.phone)}</a>
                     &nbsp;<a class="chip chip--ok" href="https://wa.me/${esc(String(e.phone).replace(/\D/g, ''))}"
                        target="_blank" rel="noopener">WhatsApp</a>`],
          ['Email', e.email ? `<a href="mailto:${esc(e.email)}" style="text-decoration:underline">${esc(e.email)}</a>` : ''],
          ['Treatment', esc(e.service_name || 'Not stated')],
          ['Clinic', esc(e.location_name || 'No preference')],
          ['Best time to call', esc(e.preferred_time || '')],
          ['Wants EMI', e.wants_emi ? '<span class="chip chip--clay">Yes</span>' : 'No'],
          ['Message', e.message ? `<div style="white-space:pre-wrap">${esc(e.message)}</div>` : ''],
          ['Patient record', e.patient_id
            ? `<a href="#/patients/${e.patient_id}" style="text-decoration:underline">${esc(e.patient_name)}
               <span class="mono">${esc(e.patient_ref || '')}</span></a>`
            : '<span style="color:var(--faint)">Not converted yet</span>'],
          ['Source', esc(titleCase(e.source || 'website'))],
        ])}
      </div></div>

      <div class="card">
        <div class="card__h"><h2>Working the enquiry</h2></div>
        <div class="card__b">
          <div class="note note--bad" data-form-err hidden></div>
          <div class="f--row">
            <div class="f">
              <label for="d_status">Status</label>
              <select id="d_status" data-set="status">
                ${STATUSES.map((s) => `<option value="${s}" ${s === e.status ? 'selected' : ''}>${esc(titleCase(s))}</option>`).join('')}
              </select>
            </div>
            <div class="f">
              <label for="d_pri">Priority</label>
              <select id="d_pri" data-set="priority">
                ${['low', 'normal', 'high'].map((s) => `<option value="${s}" ${s === e.priority ? 'selected' : ''}>${esc(titleCase(s))}</option>`).join('')}
              </select>
            </div>
            <div class="f">
              <label for="d_own">Assigned to</label>
              <select id="d_own" data-set="assigned_to">
                <option value="">Unassigned</option>
                ${refs.users.map((u) => `<option value="${u.id}" ${u.id === e.assigned_to ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}
                ${/* A staff account cannot list colleagues, so the person this
                      enquiry is already assigned to would be missing from the
                      options — and saving anything else on the form would then
                      quietly unassign them. Keep the current holder either way. */ ''}
                ${e.assigned_to && !refs.users.some((u) => u.id === e.assigned_to)
                  ? `<option value="${e.assigned_to}" selected>${
                    esc(e.assignee_name || `Account #${e.assigned_to}`)}</option>` : ''}
              </select>
            </div>
            <div class="f">
              <label for="d_svc">Treatment</label>
              <select id="d_svc" data-set="service_id">
                <option value="">Not stated</option>
                ${refs.services.map((s) => `<option value="${s.id}" ${s.id === e.service_id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}
              </select>
            </div>
          </div>

          <div class="f">
            <label for="d_time">Best time to call</label>
            <input id="d_time" type="text" data-set="preferred_time" value="${esc(e.preferred_time || '')}"
                   placeholder="e.g. weekday evenings">
          </div>

          <div class="row">
            <button class="btn btn--pri" data-save>Save changes</button>
            ${e.patient_id
              ? `<a class="btn" href="#/patients/${e.patient_id}">Open patient file</a>`
              : '<button class="btn" data-convert>Convert to patient</button>'}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card__h"><h2>Notes</h2><p>An internal record of what was said and when.</p></div>
        <div class="card__b">
          ${e.notes.length ? `<ul class="feed" style="margin-bottom:1rem">
            ${e.notes.map((n) => `<li>
              <span class="feed__w">${esc(fmtWhen(n.created_at))}</span>
              <span class="feed__t"><b>${esc(n.user_name || 'System')}</b><br>
                <span style="white-space:pre-wrap">${esc(n.note)}</span></span>
            </li>`).join('')}
          </ul>` : '<p style="color:var(--mute);font-size:.8rem;margin-bottom:1rem">No notes yet.</p>'}

          <div class="f">
            <label for="d_note">Add a note</label>
            <textarea id="d_note" rows="3" placeholder="Called at 4pm — asked to ring back Thursday."></textarea>
          </div>
          <button class="btn" data-note>Add note</button>
        </div>
      </div>`;

    wire();
  }

  function wire() {
    const banner = $('[data-form-err]', body);

    $('[data-save]', body).onclick = (ev) => withBusy(ev.currentTarget, async () => {
      const patch = {};
      for (const sel of $$('[data-set]', body)) {
        patch[sel.dataset.set] = sel.value === '' ? null : sel.value;
      }
      try {
        await api(`/admin/enquiries/${e.id}`, { method: 'PATCH', body: patch });
        toastOk('Enquiry updated.');
        e = await api(`/admin/enquiries/${e.id}`);
        paint();
        await syncBehind();
      } catch (err) {
        banner.textContent = err.message;
        banner.hidden = false;
      }
    });

    $('[data-note]', body).onclick = (ev) => withBusy(ev.currentTarget, async () => {
      const field = $('#d_note', body);
      const note = field.value.trim();
      if (!note) { field.focus(); return; }
      try {
        await api(`/admin/enquiries/${e.id}/notes`, { method: 'POST', body: { note } });
        e = await api(`/admin/enquiries/${e.id}`);
        paint();
        toastOk('Note added.');
        await syncBehind();
      } catch (err) { reportError(err); }
    });

    const conv = $('[data-convert]', body);
    if (conv) conv.onclick = (ev) => withBusy(ev.currentTarget, async () => {
      const go = await confirmModal({
        title: 'Convert to patient',
        message: `A patient record will be created for <strong>${esc(e.name)}</strong>.
          If a patient already exists on ${esc(e.phone)} the enquiry is linked to them
          instead, so nobody ends up duplicated in the ledger.`,
        confirmLabel: 'Convert',
      });
      if (!go) return;

      try {
        const out = await api(`/admin/enquiries/${e.id}/convert`, { method: 'POST' });
        toastOk(out.created
          ? `Created patient ${out.patient.ref}.`
          : `Linked to the existing record for ${out.patient.name}.`);
        closeDrawer(true);
        location.hash = `#/patients/${out.patient.id}`;
      } catch (err) { reportError(err); }
    });
  }
}
