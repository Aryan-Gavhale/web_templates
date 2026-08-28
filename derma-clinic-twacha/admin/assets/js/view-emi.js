/* =============================================================================
   EMI plans — the portfolio, and one plan in full.

   The plan detail is deliberately read-mostly. Financial terms are immutable
   once instalments exist: the honest correction for a wrong rate or tenure is
   to cancel the plan and issue a replacement, not to rewrite a schedule the
   patient already holds a copy of.
   ========================================================================== */

import {
  $, $$, esc, api, money, fmtDate, fmtWhen, fmtAgo, statusChip, plural, paymentKind,
  toastOk, reportError, on, dl, confirmModal, withBusy, or,
} from './core.js';
import { listScreen, table, twoLine } from './list.js';
import { editRow } from './forms.js';
import { paymentDrawer, voidPayment, waiveInstalment, rescheduleInstalment } from './money-forms.js';

export async function render(ctx) {
  if (ctx.params[0]) return planDetail(ctx, Number(ctx.params[0]));
  return planList(ctx);
}

/* ----------------------------------------------------------------- list -- */

async function planList({ mount, setHead }) {
  setHead('EMI plans', 'Every instalment plan raised, live or closed.');

  const screen = listScreen({
    mount,
    search: 'Patient, phone, plan reference or title…',
    filters: [
      { name: 'status', type: 'segs', value: 'active', options: [
        { value: 'active', label: 'Active' },
        { value: 'defaulted', label: 'Defaulted' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'all', label: 'All' },
      ] },
    ],
    actions: '<a class="btn btn--sm" href="/api/admin/export/installments.csv">Export schedule CSV</a>',
    fetchPage: async (state) => {
      const data = await api('/admin/emi-plans', { query: { ...state, limit: 300 } });
      const owed = data.items.reduce((s, p) => s + p.rollup.outstanding_paise, 0);

      return {
        meta: `${data.total} plan${data.total === 1 ? '' : 's'} · ${money(owed)} outstanding in this view`,
        html: table({
          columns: [
            { key: 'ref', label: 'Plan', cell: (r) => twoLine(
              `<span class="mono">${esc(r.ref)}</span>`, esc(r.title)) },
            { key: 'who', label: 'Patient', cell: (r) => twoLine(esc(r.patient_name), esc(r.phone)) },
            { key: 'terms', label: 'Terms', cell: (r) => twoLine(
              `${money(r.installment_paise)} × ${r.tenure_months}`,
              r.interest_rate_bps ? `${(r.interest_rate_bps / 100).toFixed(2)}% a year` : 'No-cost') },
            { key: 'next', label: 'Next due', cls: 't__nw', cell: (r) => (r.rollup.next_due
              ? twoLine(esc(fmtDate(r.rollup.next_due.due_date)),
                `<span style="color:${r.rollup.overdue_count ? 'var(--bad)' : 'var(--faint)'}">${
                  esc(fmtAgo(r.rollup.next_due.due_date))}</span>`)
              : '<span style="color:var(--faint)">—</span>') },
            { key: 'status', label: 'Status', cell: (r) => `${statusChip(r.status)}${
              r.rollup.overdue_count ? ` <span class="chip chip--bad">${r.rollup.overdue_count} late</span>` : ''}` },
            { key: 'out', label: 'Outstanding', align: 'right',
              cell: (r) => twoLine(`<strong>${money(r.rollup.outstanding_paise)}</strong>`,
                `of ${money(r.total_payable_paise)}`) },
          ],
          rows: data.items,
          rowClass: () => 'click',
          emptyTitle: 'No plans in this view',
          emptyText: 'Raise a plan from a patient file when a course of treatment is agreed.',
        }),
      };
    },
  });

  on(screen.card, 'click', 'tbody tr', (_e, tr) => { location.hash = `#/emi/${tr.dataset.id}`; });
}

/* --------------------------------------------------------------- detail -- */

async function planDetail({ mount, setHead, reload }, id) {
  const p = await api(`/admin/emi-plans/${id}`);
  setHead(`${p.ref} — ${p.title}`,
    `${p.patient_name} · raised ${fmtDate(p.created_at)}${p.created_by_name ? ` by ${p.created_by_name}` : ''}`);

  const r = p.rollup;
  const patientRef = { id: p.patient_id, name: p.patient_name, ref: p.patient_ref };
  const live = ['active', 'defaulted'].includes(p.status);

  mount.innerHTML = `
    <div class="stack">
      <div class="row">
        <a class="btn btn--sm" href="#/emi">&larr; All plans</a>
        <a class="btn btn--sm" href="#/patients/${p.patient_id}">Patient file</a>
        <div class="push"></div>
        <button class="btn btn--sm" data-edit>Edit name & notes</button>
        <button class="btn btn--sm" data-status>Change status</button>
        ${live ? '<button class="btn btn--sm btn--pri" data-pay>Record payment</button>' : ''}
        <button class="btn btn--sm" onclick="window.print()">Print</button>
      </div>

      ${p.status === 'cancelled' ? `<div class="note note--warn">
        This plan is cancelled. Its receipts are kept for the record and its unpaid
        instalments are excluded from outstanding.</div>` : ''}
      ${p.status === 'defaulted' ? `<div class="note note--bad">
        This plan is marked defaulted. It still counts towards arrears.</div>` : ''}
      ${r.overdue_count && live ? `<div class="note note--bad">
        <strong>${plural(r.overdue_count, 'instalment')}</strong> overdue,
        totalling <strong>${money(r.overdue_paise)}</strong>.</div>` : ''}

      <div class="grid grid--kpi">
        <div class="kpi"><p class="kpi__k">Monthly instalment</p>
          <p class="kpi__v">${money(p.installment_paise)}</p>
          <p class="kpi__m">${p.tenure_months} months from ${fmtDate(p.start_date)}</p></div>
        <div class="kpi"><p class="kpi__k">Collected</p>
          <p class="kpi__v">${money(r.paid_paise)}</p>
          <p class="kpi__m">${r.paid_count} of ${r.total} instalments settled</p></div>
        <div class="kpi ${r.overdue_paise ? 'kpi--bad' : (r.outstanding_paise ? '' : 'kpi--ok')}">
          <p class="kpi__k">Outstanding</p>
          <p class="kpi__v">${money(r.outstanding_paise)}</p>
          <p class="kpi__m">${r.overdue_paise ? `${money(r.overdue_paise)} of it late` : 'Nothing late'}</p></div>
        <div class="kpi"><p class="kpi__k">Total payable</p>
          <p class="kpi__v">${money(p.total_payable_paise)}</p>
          <p class="kpi__m">${p.interest_rate_bps
            ? `includes ${money(p.total_payable_paise - p.financed_paise)} interest`
            : 'No interest added'}</p></div>
      </div>

      <div class="split">
        <div class="stack">
          ${scheduleCard(p, live)}
          ${receiptsCard(p)}
        </div>
        <div class="stack">
          ${termsCard(p)}
          ${p.notes ? `<div class="card"><div class="card__h"><h2>Notes</h2></div>
            <div class="card__b"><p style="white-space:pre-wrap;font-size:.83rem">${esc(p.notes)}</p></div></div>` : ''}
        </div>
      </div>
    </div>`;

  on(mount, 'click', '[data-pay]', () => paymentDrawer({ patient: patientRef, plan: p, onDone: reload }));

  on(mount, 'click', '[data-pay-inst]', (_e, btn) => {
    const inst = p.installments.find((i) => i.id === Number(btn.dataset.payInst));
    return paymentDrawer({ patient: patientRef, plan: p, installment: inst, onDone: reload });
  });

  on(mount, 'click', '[data-waive]', (_e, btn) => {
    const inst = p.installments.find((i) => i.id === Number(btn.dataset.waive));
    return waiveInstalment(inst, reload);
  });

  on(mount, 'click', '[data-move]', (_e, btn) => {
    const inst = p.installments.find((i) => i.id === Number(btn.dataset.move));
    return rescheduleInstalment(inst, reload);
  });

  on(mount, 'click', '[data-void]', (_e, btn) => {
    const pay = p.payments.find((x) => x.id === Number(btn.dataset.void));
    return voidPayment(pay, reload);
  });

  on(mount, 'click', '[data-edit]', () => editRow({
    resource: 'emi-plans', id: p.id, title: `Edit ${p.ref}`, data: p, onDone: reload,
    intro: `<div class="note">The financial terms cannot be edited once a plan exists.
      To change a rate, a tenure or a start date, cancel this plan and raise a
      replacement — that keeps the patient's copy of the schedule meaningful.</div>`,
    fields: [
      { name: 'title', label: 'Plan name', type: 'text', required: true },
      { name: 'notes', label: 'Internal notes', type: 'textarea', rows: 4 },
    ],
  }));

  on(mount, 'click', '[data-status]', () => changeStatus(p, reload));
}

function termsCard(p) {
  return `
  <div class="card">
    <div class="card__h"><h2>Terms</h2><p>Fixed at the moment the plan was raised.</p></div>
    <div class="card__b">
      ${dl([
        ['Reference', `<span class="mono">${esc(p.ref)}</span>`],
        ['Patient', `<a href="#/patients/${p.patient_id}" style="text-decoration:underline">${esc(p.patient_name)}</a>`],
        ['Phone', esc(p.phone)],
        ['Treatment', or(p.service_name, 'Not linked')],
        ['Treatment cost', money(p.principal_paise)],
        ['Down payment', p.downpayment_paise ? money(p.downpayment_paise) : '—'],
        ['Amount financed', `<strong>${money(p.financed_paise)}</strong>`],
        ['Interest rate', p.interest_rate_bps
          ? `${(p.interest_rate_bps / 100).toFixed(2)}% a year`
          : '<span class="chip chip--ok">No-cost</span>'],
        ['Processing fee', p.processing_fee_paise ? money(p.processing_fee_paise) : '—'],
        ['Tenure', `${p.tenure_months} months`],
        ['First instalment', esc(fmtDate(p.start_date))],
        ['Status', statusChip(p.status)],
        ['Raised', esc(fmtWhen(p.created_at))],
      ])}
    </div>
  </div>`;
}

function scheduleCard(p, live) {
  return `
  <div class="card">
    <div class="card__h"><h2>Schedule</h2>
      <p>${plural(p.installments.length, 'instalment')} · amounts in whole rupees as written.</p></div>
    <div class="card__b card__b--flush">
      ${table({
        columns: [
          { key: 'seq', label: 'No.', width: '3rem', cell: (i) => i.seq },
          { key: 'due', label: 'Due', cls: 't__nw', cell: (i) => twoLine(esc(fmtDate(i.due_date)),
            `<span style="color:${i.state === 'overdue' ? 'var(--bad)' : 'var(--faint)'}">${
              i.status === 'paid' ? `paid ${fmtDate(i.paid_on)}` : fmtAgo(i.due_date)}</span>`) },
          { key: 'amt', label: 'Amount', align: 'right', cell: (i) => money(i.amount_paise) },
          { key: 'paid', label: 'Received', align: 'right',
            cell: (i) => (i.paid_paise ? money(i.paid_paise) : '<span style="color:var(--faint)">—</span>') },
          { key: 'left', label: 'Outstanding', align: 'right', cell: (i) => (
            i.outstanding_paise
              ? `<strong${i.state === 'overdue' ? ' style="color:var(--bad)"' : ''}>${money(i.outstanding_paise)}</strong>`
              : '<span style="color:var(--faint)">—</span>') },
          { key: 'st', label: 'State', cell: (i) => statusChip(i.state) },
          { key: 'act', label: '', cls: 't__act', cell: (i) => (live ? actions(i) : '') },
        ],
        rows: p.installments,
        rowClass: (i) => (i.state === 'overdue' ? 'od' : (i.status === 'paid' ? 'pd' : '')),
        emptyTitle: 'No instalments',
      })}
    </div>
    ${p.installments.some((i) => i.notes) ? `<div class="card__f">
      ${p.installments.filter((i) => i.notes).map((i) => `No. ${i.seq}: ${esc(i.notes)}`).join(' · ')}
    </div>` : ''}
  </div>`;
}

const actions = (i) => {
  const bits = [];
  if (['due', 'partial'].includes(i.status)) {
    bits.push(`<button class="btn btn--sm btn--pri" data-pay-inst="${i.id}">Pay</button>`);
    bits.push(`<button class="btn btn--sm" data-move="${i.id}">Move</button>`);
    if (!i.paid_paise) bits.push(`<button class="btn btn--sm" data-waive="${i.id}">Waive</button>`);
  } else if (i.status === 'waived') {
    bits.push(`<button class="btn btn--sm" data-waive="${i.id}">Reinstate</button>`);
  }
  return `<div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">${bits.join('')}</div>`;
};

function receiptsCard(p) {
  return `
  <div class="card">
    <div class="card__h"><h2>Receipts against this plan</h2></div>
    <div class="card__b card__b--flush">
      ${table({
        columns: [
          { key: 'no', label: 'Receipt', cell: (y) => twoLine(
            `<span class="mono">${esc(y.receipt_no || `#${y.id}`)}</span>`, esc(fmtDate(y.received_on))) },
          { key: 'what', label: 'For', cell: (y) => twoLine(esc(paymentKind(y.kind)),
            y.installment_id ? `Instalment ${p.installments.find((i) => i.id === y.installment_id)?.seq ?? ''}` : '') },
          { key: 'how', label: 'Method', cell: (y) => `<span class="chip">${esc(y.method)}</span>${
            y.reference ? `<div class="t__sub mono">${esc(y.reference)}</div>` : ''}${
            y.is_void ? ' <span class="chip chip--bad">Void</span>' : ''}` },
          { key: 'by', label: 'Taken by', cell: (y) => or(y.received_by_name) },
          { key: 'amt', label: 'Amount', align: 'right', cell: (y) => `<strong>${money(y.amount_paise)}</strong>` },
          { key: 'act', label: '', cls: 't__act',
            cell: (y) => (y.is_void ? '' : `<button class="btn btn--sm btn--bad" data-void="${y.id}">Void</button>`) },
        ],
        rows: p.payments,
        rowClass: (y) => (y.is_void ? 'void' : ''),
        emptyTitle: 'Nothing collected yet',
        emptyText: 'Receipts recorded against this plan will be listed here.',
      })}
    </div>
    ${p.payments.some((y) => y.is_void) ? `<div class="card__f">
      Voided receipts stay listed with their reason, so the audit trail is complete.
    </div>` : ''}
  </div>`;
}

/* ----------------------------------------------------- status change ----- */

async function changeStatus(p, reload) {
  const { modal } = await import('./core.js');

  const options = [
    ['active', 'Active', 'Instalments continue to fall due and count towards outstanding.'],
    ['defaulted', 'Defaulted', 'The patient has stopped paying. Stays in arrears reporting.'],
    ['completed', 'Completed', 'Set automatically when nothing is left owing.'],
    ['cancelled', 'Cancelled', 'Unpaid instalments stop counting. Receipts already taken stay.'],
  ];

  const chosen = await modal({
    title: `Status of ${p.ref}`,
    body: `<div class="stack stack--sm">
      ${options.map(([value, label, hint]) => `
        <label class="check">
          <input type="radio" name="st" value="${value}" ${value === p.status ? 'checked' : ''}>
          <span>${esc(label)}<em>${esc(hint)}</em></span>
        </label>`).join('')}
      <div class="note note--warn" data-warn hidden></div>
      <div class="note note--bad" data-form-err hidden></div>
    </div>`,
    footer: `<button class="btn" data-no>Cancel</button>
             <button class="btn btn--pri" data-yes>Save status</button>`,
    onMount({ close, body, foot }) {
      const warn = $('[data-warn]', body);
      const banner = $('[data-form-err]', body);

      body.addEventListener('change', () => {
        const val = $('input[name=st]:checked', body).value;
        if (val === 'cancelled' && p.rollup.paid_paise > 0) {
          warn.innerHTML = `<strong>${money(p.rollup.paid_paise)}</strong> has already been
            collected against this plan. Cancelling leaves those receipts in place.`;
          warn.hidden = false;
        } else { warn.hidden = true; }
      });

      foot.querySelector('[data-no]').onclick = () => close(false);
      foot.querySelector('[data-yes]').onclick = (ev) => withBusy(ev.currentTarget, async () => {
        const status = $('input[name=st]:checked', body).value;
        try {
          await api(`/admin/emi-plans/${p.id}`, {
            method: 'PATCH',
            body: { status, confirm_cancel: true },
          });
          close(status);
        } catch (err) {
          banner.textContent = err.message;
          banner.hidden = false;
        }
      });
    },
  });

  if (chosen) { toastOk(`Plan marked ${chosen}.`); await reload(); }
}
