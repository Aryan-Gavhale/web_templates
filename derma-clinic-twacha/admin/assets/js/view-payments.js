/* =============================================================================
   Payments — the receipt book.

   A day-book view rather than a per-patient one: filter by date and method to
   reconcile a shift, then void anything entered wrongly. Voids stay visible
   behind a toggle, because a receipt book with pages torn out is worthless.
   ========================================================================== */

import {
  esc, api, money, fmtDate, paymentKind, plural, on, or,
} from './core.js';
import { listScreen, table, twoLine } from './list.js';
import { voidPayment } from './money-forms.js';

const METHODS = ['all', 'upi', 'cash', 'card', 'netbanking', 'neft', 'cheque', 'other'];

export async function render({ mount, setHead }) {
  setHead('Payments', 'Every receipt recorded, in date order.');

  const screen = listScreen({
    mount,
    search: 'Patient, phone, receipt number or reference…',
    filters: [
      { name: 'from', type: 'date', label: 'From' },
      { name: 'to', type: 'date', label: 'To' },
      { name: 'method', type: 'select', label: 'Method', value: 'all',
        options: METHODS.map((m) => ({ value: m, label: m === 'all' ? 'All methods' : m.toUpperCase() })) },
    ],
    actions: `
      <label class="check" style="margin:0">
        <input type="checkbox" data-void-toggle>
        <span style="font-size:.775rem">Show voided</span>
      </label>
      <a class="btn btn--sm" href="/api/admin/export/payments.csv">Export CSV</a>`,
    fetchPage: async (state) => {
      const data = await api('/admin/payments', { query: { ...state, limit: 400 } });
      const t = data.totals;

      return {
        meta: `${plural(t.n, 'receipt')} · ${money(t.collected)} collected${
          t.refunded ? ` · ${money(t.refunded)} refunded` : ''}`,
        html: `
          ${byMethod(data.by_method)}
          ${table({
            columns: [
              { key: 'no', label: 'Receipt', width: '8rem', cell: (y) => twoLine(
                `<span class="mono">${esc(y.receipt_no || `#${y.id}`)}</span>`, esc(fmtDate(y.received_on))) },
              { key: 'who', label: 'Patient', cell: (y) => twoLine(
                `<a href="#/patients/${y.patient_id}">${esc(y.patient_name)}</a>`, esc(y.phone)) },
              { key: 'what', label: 'For', cell: (y) => twoLine(esc(paymentKind(y.kind)),
                y.plan_ref
                  ? `<a class="mono" href="#/emi/${y.plan_id}">${esc(y.plan_ref)}</a>${
                    y.installment_seq ? ` · no. ${y.installment_seq}` : ''}`
                  : '') },
              { key: 'how', label: 'Method', cell: (y) => `<span class="chip">${esc(y.method)}</span>${
                y.reference ? `<div class="t__sub mono">${esc(y.reference)}</div>` : ''}` },
              { key: 'by', label: 'Taken by', cell: (y) => or(y.received_by_name) },
              { key: 'amt', label: 'Amount', align: 'right', cell: (y) => (
                y.kind === 'refund'
                  ? `<strong style="color:var(--bad)">−${money(y.amount_paise, { sign: false })}</strong>`
                  : `<strong>${money(y.amount_paise)}</strong>`) },
              { key: 'st', label: '', cell: (y) => (y.is_void
                ? `<span class="chip chip--bad" title="${esc(y.void_reason || '')}">Void</span>` : '') },
              { key: 'act', label: '', cls: 't__act', cell: (y) => (
                y.is_void ? '' : `<button class="btn btn--sm btn--bad" data-void="${y.id}">Void</button>`) },
            ],
            rows: data.items,
            rowClass: (y) => (y.is_void ? 'void' : ''),
            emptyTitle: 'No receipts match',
            emptyText: 'Widen the dates, or clear the method filter.',
          })}`,
      };
    },
  });

  on(screen.card, 'change', '[data-void-toggle]', (_e, box) => {
    screen.state.include_void = box.checked ? '1' : '';
    screen.refresh();
  });

  on(screen.card, 'click', '[data-void]', async (_e, btn) => {
    const data = await api('/admin/payments', { query: { include_void: '1', limit: 500 } });
    const pay = data.items.find((y) => y.id === Number(btn.dataset.void));
    if (pay) await voidPayment(pay, screen.refresh);
  });
}

/** A one-line reconciliation summary above the table. */
function byMethod(rows) {
  const live = rows.filter((r) => Number(r.amount) > 0);
  if (!live.length) return '';
  return `<div class="bar" style="border-radius:0;background:var(--white)">
    ${live.map((r) => `<span class="chip chip--soft">${esc(r.method.toUpperCase())}
      &nbsp;<strong>${money(r.amount)}</strong>
      <span style="color:var(--faint)">&nbsp;${r.n}</span></span>`).join('')}
  </div>`;
}
