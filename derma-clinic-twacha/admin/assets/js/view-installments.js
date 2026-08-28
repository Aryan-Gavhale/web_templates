/* =============================================================================
   Instalments — the collections worklist.

   Arrears first by default, because that is the view somebody opens this screen
   to work through. Every row can be actioned in place: take the money, move the
   date, or write it off.
   ========================================================================== */

import {
  esc, api, money, fmtDate, fmtAgo, statusChip, plural, on,
} from './core.js';
import { listScreen, table, twoLine } from './list.js';
import { paymentDrawer, waiveInstalment, rescheduleInstalment } from './money-forms.js';

export async function render({ mount, setHead }) {
  setHead('Instalments', 'Only live plans are listed — a cancelled plan is not money anybody is owed.');

  const screen = listScreen({
    mount,
    search: 'Patient, phone or plan reference…',
    filters: [
      { name: 'view', type: 'segs', value: 'overdue', options: [
        { value: 'overdue', label: 'Overdue' },
        { value: 'due', label: 'Upcoming' },
        { value: 'month', label: 'This month' },
        { value: 'paid', label: 'Settled' },
        { value: 'all', label: 'All' },
      ] },
    ],
    actions: '<a class="btn btn--sm" href="/api/admin/export/installments.csv">Export CSV</a>',
    fetchPage: async (state) => {
      const data = await api('/admin/installments', { query: { ...state, limit: 400 } });
      const owed = data.items.reduce((s, i) => s + i.outstanding_paise, 0);

      return {
        meta: `${plural(data.total, 'instalment')}${owed ? ` · ${money(owed)} outstanding` : ''}`,
        html: table({
          columns: [
            { key: 'who', label: 'Patient', cell: (i) => twoLine(
              `<a href="#/patients/${i.patient_id}">${esc(i.patient_name)}</a>`, esc(i.phone)) },
            { key: 'plan', label: 'Plan', cell: (i) => twoLine(
              `<a class="mono" href="#/emi/${i.plan_id}">${esc(i.plan_ref)}</a>`,
              `${esc(i.title)} · no. ${i.seq}`) },
            { key: 'due', label: 'Due', cls: 't__nw', cell: (i) => twoLine(esc(fmtDate(i.due_date)),
              `<span style="color:${i.state === 'overdue' ? 'var(--bad)' : 'var(--faint)'}">${
                esc(fmtAgo(i.due_date))}</span>`) },
            { key: 'amt', label: 'Amount', align: 'right', cell: (i) => money(i.amount_paise) },
            { key: 'left', label: 'Outstanding', align: 'right', cell: (i) => (
              i.outstanding_paise
                ? `<strong${i.state === 'overdue' ? ' style="color:var(--bad)"' : ''}>${money(i.outstanding_paise)}</strong>`
                : '<span style="color:var(--faint)">Settled</span>') },
            { key: 'st', label: 'State', cell: (i) => statusChip(i.state) },
            { key: 'act', label: '', cls: 't__act', cell: (i) => (
              ['due', 'partial'].includes(i.status)
                ? `<div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                     <button class="btn btn--sm btn--pri" data-pay="${i.id}">Pay</button>
                     <button class="btn btn--sm" data-move="${i.id}">Move</button>
                     ${i.paid_paise ? '' : `<button class="btn btn--sm" data-waive="${i.id}">Waive</button>`}
                   </div>`
                : (i.status === 'waived'
                  ? `<button class="btn btn--sm" data-waive="${i.id}">Reinstate</button>`
                  : '')) },
          ],
          rows: data.items,
          rowClass: (i) => (i.state === 'overdue' ? 'od' : (i.status === 'paid' ? 'pd' : '')),
          emptyTitle: state.view === 'overdue' ? 'Nothing is overdue' : 'Nothing in this view',
          emptyText: state.view === 'overdue'
            ? 'Every instalment on a live plan is either settled or not yet due.'
            : 'Try a different filter above.',
        }),
      };
    },
  });

  /* Row actions need the row's data, and the list is re-fetched after each
     action, so the record is looked up fresh rather than cached in a closure. */
  const find = async (id) => {
    const data = await api('/admin/installments', { query: { view: 'all', limit: 500 } });
    return data.items.find((i) => i.id === Number(id));
  };

  /* The sidebar arrears badge follows the `admin:wrote` event from core.js, so
     only the list itself needs repainting here. */
  const done = () => screen.refresh();

  on(screen.card, 'click', '[data-pay]', async (_e, btn) => {
    const i = await find(btn.dataset.pay);
    if (!i) return;
    await paymentDrawer({
      patient: { id: i.patient_id, name: i.patient_name, ref: i.patient_ref },
      plan: { id: i.plan_id },
      installment: i,
      onDone: done,
    });
  });

  on(screen.card, 'click', '[data-move]', async (_e, btn) => {
    const i = await find(btn.dataset.move);
    if (i) await rescheduleInstalment(i, done);
  });

  on(screen.card, 'click', '[data-waive]', async (_e, btn) => {
    const i = await find(btn.dataset.waive);
    if (i) await waiveInstalment(i, done);
  });
}
