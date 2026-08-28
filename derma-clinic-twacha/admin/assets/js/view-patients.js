/* =============================================================================
   Patients — the register, and the patient file.

   The file is the screen the front desk actually lives in: who they are, what
   they owe, what they have paid, and the two buttons that matter (raise a plan,
   record a receipt).
   ========================================================================== */

import {
  $, $$, esc, api, money, fmtDate, fmtWhen, fmtAgo, statusChip, plural, paymentKind,
  toastOk, reportError, on, dl, drawer, or, confirmModal,
} from './core.js';
import { listScreen, table, twoLine } from './list.js';
import { formDrawer, createRow, editRow } from './forms.js';
import { planDrawer, paymentDrawer, voidPayment } from './money-forms.js';

const FIELDS = [
  { name: 'name', label: 'Full name', type: 'text', required: true },
  { type: 'row', fields: [
    { name: 'phone', label: 'Phone', type: 'tel', required: true, placeholder: '9822041208',
      hint: 'Used to match returning patients, so keep it accurate.' },
    { name: 'email', label: 'Email', type: 'email' },
  ] },
  { name: 'address', label: 'Address', type: 'textarea', rows: 2 },
  { name: 'city', label: 'City', type: 'text' },
  { name: 'notes', label: 'Notes', type: 'textarea', rows: 3,
    hint: 'Administrative notes only. Clinical records do not belong here.' },
];

export async function render(ctx) {
  if (ctx.params[0]) return patientFile(ctx, Number(ctx.params[0]));
  return patientList(ctx);
}

/* ----------------------------------------------------------------- list -- */

async function patientList({ mount, setHead }) {
  setHead('Patients', 'Everyone with a record, whether or not they have a payment plan.');

  const screen = listScreen({
    mount,
    search: 'Name, phone, email or reference…',
    actions: '<button class="btn btn--sm btn--pri" data-new>New patient</button>',
    fetchPage: async (state) => {
      const data = await api('/admin/patients', { query: { ...state, limit: 300 } });
      return {
        meta: `${data.total} on record`,
        html: table({
          columns: [
            { key: 'ref', label: 'Ref', width: '7rem',
              cell: (r) => `<span class="mono">${esc(r.ref || `#${r.id}`)}</span>` },
            { key: 'name', label: 'Patient',
              cell: (r) => twoLine(esc(r.name), esc([r.phone, r.email].filter(Boolean).join(' · '))) },
            { key: 'city', label: 'City', cell: (r) => or(r.city) },
            { key: 'since', label: 'On record since', align: 'right',
              cell: (r) => twoLine(esc(fmtDate(r.created_at)), esc(fmtAgo(r.created_at))) },
          ],
          rows: data.items,
          rowClass: () => 'click',
          emptyTitle: 'No patients yet',
          emptyText: 'Convert an enquiry, or add somebody who walked in.',
          emptyAction: '<button class="btn btn--pri" data-new>New patient</button>',
        }),
      };
    },
  });

  on(mount, 'click', '[data-new]', () => createRow({
    resource: 'patients',
    title: 'New patient',
    fields: FIELDS,
    onDone: screen.refresh,
  }));

  on(screen.card, 'click', 'tbody tr', (_e, tr) => {
    location.hash = `#/patients/${tr.dataset.id}`;
  });
}

/* ----------------------------------------------------------------- file -- */

async function patientFile({ mount, setHead, reload }, id) {
  const f = await api(`/admin/patient-file/${id}`);
  const p = f.patient;

  setHead(p.name, `${p.ref || `Patient #${p.id}`} · on record since ${fmtDate(p.created_at)}`);

  const owed = f.plans
    .filter((x) => ['active', 'defaulted'].includes(x.status))
    .reduce((sum, x) => sum + x.rollup.outstanding_paise, 0);
  const late = f.plans
    .filter((x) => ['active', 'defaulted'].includes(x.status))
    .reduce((sum, x) => sum + x.rollup.overdue_paise, 0);

  mount.innerHTML = `
    <div class="stack">
      <div class="row">
        <a class="btn btn--sm" href="#/patients">&larr; All patients</a>
        <div class="push"></div>
        <button class="btn btn--sm" data-edit>Edit details</button>
        <button class="btn btn--sm" data-plan>New EMI plan</button>
        <button class="btn btn--sm btn--pri" data-pay>Record payment</button>
      </div>

      <div class="grid grid--kpi">
        <div class="kpi"><p class="kpi__k">Paid to date</p>
          <p class="kpi__v">${money(f.totals.paid)}</p>
          <p class="kpi__m">${plural(f.payments.filter((x) => !x.is_void).length, 'live receipt')}</p></div>
        <div class="kpi ${owed ? '' : 'kpi--ok'}"><p class="kpi__k">Outstanding</p>
          <p class="kpi__v">${money(owed)}</p>
          <p class="kpi__m">${owed ? 'Across live plans' : 'Nothing owed'}</p></div>
        <div class="kpi ${late ? 'kpi--bad' : ''}"><p class="kpi__k">Overdue</p>
          <p class="kpi__v">${money(late)}</p>
          <p class="kpi__m">${late ? 'Past the due date' : 'Up to date'}</p></div>
        ${f.totals.refunded ? `<div class="kpi"><p class="kpi__k">Refunded</p>
          <p class="kpi__v">${money(f.totals.refunded)}</p>
          <p class="kpi__m">Money returned</p></div>` : ''}
      </div>

      <div class="split">
        <div class="stack">
          ${plansCard(f)}
          ${receiptsCard(f)}
        </div>
        <div class="stack">
          ${detailsCard(p)}
          ${enquiriesCard(f)}
        </div>
      </div>
    </div>`;

  const patientRef = { id: p.id, name: p.name, ref: p.ref };

  on(mount, 'click', '[data-edit]', () => editRow({
    resource: 'patients', id: p.id, title: `Edit ${p.name}`, fields: FIELDS, data: p, onDone: reload,
  }));

  on(mount, 'click', '[data-plan]', () => planDrawer({ patient: patientRef, onDone: reload }));
  on(mount, 'click', '[data-pay]', () => paymentDrawer({ patient: patientRef, onDone: reload }));

  on(mount, 'click', '[data-plan-open]', (_e, hit) => {
    location.hash = `#/emi/${hit.dataset.planOpen}`;
  });

  on(mount, 'click', '[data-void]', async (_e, btn) => {
    const pay = f.payments.find((x) => x.id === Number(btn.dataset.void));
    if (pay) await voidPayment(pay, reload);
  });
}

function detailsCard(p) {
  return `
  <div class="card">
    <div class="card__h"><h2>Details</h2></div>
    <div class="card__b">
      ${dl([
        ['Reference', `<span class="mono">${esc(p.ref || `#${p.id}`)}</span>`],
        ['Phone', `<a href="tel:${esc(p.phone)}" style="text-decoration:underline">${esc(p.phone)}</a>
                   &nbsp;<a class="chip chip--ok" target="_blank" rel="noopener"
                     href="https://wa.me/${esc(String(p.phone).replace(/\D/g, ''))}">WhatsApp</a>`],
        ['Email', p.email ? `<a href="mailto:${esc(p.email)}" style="text-decoration:underline">${esc(p.email)}</a>` : ''],
        ['Address', p.address ? `<span style="white-space:pre-wrap">${esc(p.address)}</span>` : ''],
        ['City', esc(p.city || '')],
        ['Added', esc(fmtWhen(p.created_at))],
        ['Notes', p.notes ? `<span style="white-space:pre-wrap">${esc(p.notes)}</span>` : ''],
      ])}
    </div>
  </div>`;
}

function plansCard(f) {
  return `
  <div class="card">
    <div class="card__h"><h2>Payment plans</h2>
      <button class="btn btn--sm" data-plan>New plan</button></div>
    <div class="card__b card__b--flush">
      ${table({
        columns: [
          { key: 'ref', label: 'Plan', cell: (r) => twoLine(
            `<span class="mono">${esc(r.ref)}</span>`, esc(r.title)) },
          { key: 'terms', label: 'Terms', cell: (r) => twoLine(
            `${money(r.installment_paise)} × ${r.tenure_months}`,
            r.interest_rate_bps ? `${(r.interest_rate_bps / 100).toFixed(2)}% a year` : 'No-cost') },
          { key: 'prog', label: 'Progress', cell: (r) => progress(r) },
          { key: 'status', label: 'Status', cell: (r) => statusChip(r.status) },
          { key: 'out', label: 'Outstanding', align: 'right', cell: (r) => (
            r.rollup.overdue_paise
              ? `<strong style="color:var(--bad)">${money(r.rollup.outstanding_paise)}</strong>
                 <div class="t__sub" style="color:var(--bad)">${money(r.rollup.overdue_paise)} late</div>`
              : `<strong>${money(r.rollup.outstanding_paise)}</strong>`) },
          { key: 'act', label: '', cls: 't__act',
            cell: (r) => `<button class="btn btn--sm" data-plan-open="${r.id}">Open</button>` },
        ],
        rows: f.plans,
        emptyTitle: 'No payment plans',
        emptyText: 'Raise one when a course of treatment is agreed.',
        emptyAction: '<button class="btn btn--pri" data-plan>New EMI plan</button>',
      })}
    </div>
  </div>`;
}

/** Paid/total meter, coloured by whether anything is late. */
function progress(plan) {
  const r = plan.rollup;
  const done = (r.paid_count || 0) + (r.waived_count || 0);
  const pct = r.total ? Math.round((done / r.total) * 100) : 0;
  const tone = r.overdue_count ? ' meter--late' : (pct === 100 ? ' meter--full' : '');
  return `
    <div class="meter${tone}"><i style="width:${pct}%"></i></div>
    <div class="t__sub">${done} of ${r.total} settled${
      r.next_due ? ` · next ${fmtDate(r.next_due.due_date)}` : ''}</div>`;
}

function receiptsCard(f) {
  return `
  <div class="card">
    <div class="card__h"><h2>Receipts</h2>
      <button class="btn btn--sm btn--pri" data-pay>Record payment</button></div>
    <div class="card__b card__b--flush">
      ${table({
        columns: [
          { key: 'no', label: 'Receipt', cell: (r) => twoLine(
            `<span class="mono">${esc(r.receipt_no || `#${r.id}`)}</span>`,
            esc(fmtDate(r.received_on))) },
          { key: 'what', label: 'For', cell: (r) => twoLine(
            esc(paymentKind(r.kind)),
            r.plan_ref ? `${esc(r.plan_ref)}${r.installment_id ? ' instalment' : ''}` : '') },
          { key: 'how', label: 'Method', cell: (r) => `<span class="chip">${esc(r.method)}</span>${
            r.is_void ? ' <span class="chip chip--bad">Void</span>' : ''}` },
          { key: 'amt', label: 'Amount', align: 'right', cell: (r) => (
            r.kind === 'refund'
              ? `<strong style="color:var(--bad)">−${money(r.amount_paise, { sign: false })}</strong>`
              : `<strong>${money(r.amount_paise)}</strong>`) },
          { key: 'act', label: '', cls: 't__act', cell: (r) => (
            r.is_void ? '' : `<button class="btn btn--sm btn--bad" data-void="${r.id}">Void</button>`) },
        ],
        rows: f.payments,
        rowClass: (r) => (r.is_void ? 'void' : ''),
        emptyTitle: 'No receipts',
        emptyText: 'Nothing has been collected from this patient yet.',
        emptyAction: '<button class="btn btn--pri" data-pay>Record payment</button>',
      })}
    </div>
  </div>`;
}

function enquiriesCard(f) {
  if (!f.enquiries.length) return '';
  return `
  <div class="card">
    <div class="card__h"><h2>Enquiry history</h2></div>
    <div class="card__b">
      <ul class="feed">
        ${f.enquiries.map((e) => `<li>
          <span class="feed__w">${esc(fmtDate(e.created_at))}</span>
          <span class="feed__t">
            <a href="#/enquiries/${e.id}" style="text-decoration:underline">
              ${esc(e.service_name || 'General enquiry')}</a>
            ${statusChip(e.status)}
          </span>
        </li>`).join('')}
      </ul>
    </div>
  </div>`;
}
