/* =============================================================================
   Dashboard — what needs attention today, then the money, then the website.

   Ordered by urgency rather than by data source: overdue instalments and new
   enquiries first, because those are the two things that cost the clinic money
   if nobody looks at them.
   ========================================================================== */

import {
  $, esc, api, money, moneyShort, fmtDate, fmtDateShort, fmtAgo, fmtWhen,
  fmtMonth, statusChip, plural, titleCase, on,
} from './core.js';
import { table, twoLine } from './list.js';

export async function render({ mount, setHead }) {
  const d = await api('/admin/dashboard');
  setHead('Overview', `Figures as at ${fmtDate(d.as_of)}`);

  mount.innerHTML = `
    <div class="stack">
      ${kpis(d)}
      ${attention(d)}
      <div class="split">
        <div class="stack">
          ${recentEnquiries(d)}
          ${dueSoon(d)}
        </div>
        <div class="stack">
          ${collections(d)}
          ${recentPayments(d)}
          ${websiteState(d)}
          ${activity(d)}
        </div>
      </div>
    </div>`;

  /* Every row on this page is a shortcut to the screen that can act on it. */
  on(mount, 'click', '[data-go]', (_e, hit) => { location.hash = hit.dataset.go; });
}

/* ----------------------------------------------------------------- kpis -- */

function kpis(d) {
  const m = d.money;
  return `
  <div class="grid grid--kpi">
    <div class="kpi kpi--teal">
      <p class="kpi__k">Collected this month</p>
      <p class="kpi__v">${moneyShort(m.collected_month)}</p>
      <p class="kpi__m">${money(m.collected_today)} today${
        m.refunded_month ? ` · ${money(m.refunded_month)} refunded` : ''}</p>
    </div>

    <div class="kpi">
      <p class="kpi__k">Outstanding on live plans</p>
      <p class="kpi__v">${moneyShort(m.outstanding)}</p>
      <p class="kpi__m">${plural(m.active_plans, 'active plan')} · ${
        plural(m.completed_plans, 'completed')}</p>
    </div>

    <div class="kpi ${m.overdue_count ? 'kpi--bad' : ''}">
      <p class="kpi__k">Overdue</p>
      <p class="kpi__v">${moneyShort(m.overdue_amount)}</p>
      <p class="kpi__m">${m.overdue_count
        ? `${plural(m.overdue_count, 'instalment')} past ${
          m.overdue_count === 1 ? 'its' : 'their'} due date`
        : 'Nothing is late'}</p>
    </div>

    <div class="kpi ${d.enquiries.new ? 'kpi--ok' : ''}">
      <p class="kpi__k">New enquiries</p>
      <p class="kpi__v">${d.enquiries.new}</p>
      <p class="kpi__m">${d.enquiries.this_week} this week · ${
        d.enquiries.wants_emi} asking about EMI</p>
    </div>
  </div>`;
}

/* ------------------------------------------------------------ attention -- */

function attention(d) {
  const bits = [];

  if (d.money.overdue_count) {
    bits.push(`<p><strong>${plural(d.money.overdue_count, 'instalment')}</strong> totalling
      <strong>${money(d.money.overdue_amount)}</strong> ${
      d.money.overdue_count === 1 ? 'is' : 'are'} past due.
      <a href="#/installments" style="text-decoration:underline">Open the arrears list</a>.</p>`);
  }
  if (d.enquiries.high_priority) {
    bits.push(`<p><strong>${plural(d.enquiries.high_priority, 'enquiry', 'enquiries')}</strong>
      marked high priority ${d.enquiries.high_priority === 1 ? 'is' : 'are'} still unanswered.
      <a href="#/enquiries" style="text-decoration:underline">Open enquiries</a>.</p>`);
  }
  if (d.google.mode !== 'live') {
    bits.push(`<p>Reviews on the website are <strong>sample data</strong>${
      d.google.mode === 'key-without-place-id'
        ? ' — an API key is set, but no clinic has a Google Place ID yet'
        : ' — no Google Maps API key is configured'}.
      <a href="#/settings" style="text-decoration:underline">Settings</a>.</p>`);
  }
  if (d.content.services_hidden) {
    bits.push(`<p>${plural(d.content.services_hidden, 'treatment')}
      ${d.content.services_hidden === 1 ? 'is' : 'are'} unpublished and not visible on the site.
      <a href="#/services" style="text-decoration:underline">Treatments</a>.</p>`);
  }

  if (!bits.length) {
    return `<div class="note note--ok">Nothing needs attention: no arrears, no unanswered
      priority enquiries, and the website content is published.</div>`;
  }

  return `<div class="note ${d.money.overdue_count ? 'note--bad' : 'note--warn'}">
    <div class="stack stack--sm">${bits.join('')}</div>
  </div>`;
}

/* -------------------------------------------------------------- panels --- */

function recentEnquiries(d) {
  const rows = d.enquiries.recent;
  return `
  <div class="card">
    <div class="card__h">
      <h2>Latest enquiries</h2>
      <a class="btn btn--sm" href="#/enquiries">See all</a>
    </div>
    <div class="card__b card__b--flush">
      ${table({
        columns: [
          { key: 'name', label: 'From', cell: (r) => twoLine(esc(r.name), esc(r.phone)) },
          { key: 'svc', label: 'About', cell: (r) => esc(r.service_name || 'Not stated') },
          { key: 'st', label: 'Status', cell: (r) => `${statusChip(r.status)}${
            r.priority === 'high' ? ' <span class="chip chip--bad">High</span>' : ''}${
            r.wants_emi ? ' <span class="chip chip--clay">EMI</span>' : ''}` },
          { key: 'when', label: 'Received', align: 'right', cell: (r) => `<span title="${esc(fmtWhen(r.created_at))}">${fmtAgo(r.created_at)}</span>` },
        ],
        rows,
        rowClass: () => 'click',
        emptyTitle: 'No enquiries yet',
        emptyText: 'Submissions from the website booking form will appear here.',
      })}
    </div>
    ${rows.length ? `<div class="card__f">${statusBreakdown(d.enquiries.by_status)}</div>` : ''}
  </div>`;
}

const statusBreakdown = (list) => list.length
  ? list.map((s) => `${titleCase(s.status)} ${s.n}`).join(' · ')
  : '';

function dueSoon(d) {
  const rows = [...d.schedule.overdue, ...d.schedule.due_soon];
  return `
  <div class="card">
    <div class="card__h">
      <h2>Instalments due</h2>
      <p>Arrears first, then everything falling due in the next month.</p>
      <a class="btn btn--sm" href="#/installments">Open</a>
    </div>
    <div class="card__b card__b--flush">
      ${table({
        columns: [
          { key: 'who', label: 'Patient', cell: (r) => twoLine(esc(r.patient_name), esc(r.phone)) },
          { key: 'plan', label: 'Plan', cell: (r) => twoLine(`<span class="mono">${esc(r.plan_ref)}</span>`, `No. ${r.seq}`) },
          { key: 'due', label: 'Due', cls: 't__nw', cell: (r) => {
            const late = r.due_date < d.as_of;
            return twoLine(fmtDateShort(r.due_date),
              `<span style="color:${late ? 'var(--bad)' : 'var(--faint)'}">${fmtAgo(r.due_date)}</span>`);
          } },
          { key: 'amt', label: 'Outstanding', align: 'right',
            cell: (r) => `<strong>${money(r.amount_paise - r.paid_paise)}</strong>` },
        ],
        rows,
        rowClass: () => 'click',
        emptyTitle: 'Nothing due',
        emptyText: 'No instalment is outstanding in the coming month.',
      })}
    </div>
  </div>`;
}

function collections(d) {
  const months = [...d.money.collections_by_month].reverse();
  const peak = Math.max(1, ...months.map((m) => Number(m.n)));

  return `
  <div class="card">
    <div class="card__h"><h2>Collections</h2><p>Last six months, receipts excluding refunds.</p></div>
    <div class="card__b">
      ${months.length ? `
        <div class="spark">
          ${months.map((m) => `
            <div title="${esc(fmtMonth(m.month))}: ${money(m.n)}">
              <b>${moneyShort(m.n)}</b>
              <span class="spark__t"><i
                style="height:${Math.max(2, (Number(m.n) / peak) * 100)}%"></i></span>
              <b>${esc(fmtMonth(m.month))}</b>
            </div>`).join('')}
        </div>` : '<p style="color:var(--mute);font-size:.8rem">No receipts recorded yet.</p>'}
    </div>
  </div>`;
}

function recentPayments(d) {
  const rows = d.money.recent_payments;
  return `
  <div class="card">
    <div class="card__h"><h2>Recent receipts</h2><a class="btn btn--sm" href="#/payments">See all</a></div>
    <div class="card__b card__b--flush">
      ${table({
        columns: [
          { key: 'who', label: 'Patient', cell: (r) => twoLine(esc(r.patient_name),
            `<span class="mono">${esc(r.receipt_no || '—')}</span>`) },
          { key: 'how', label: 'Method', cell: (r) => `<span class="chip">${esc(r.method)}</span>${
            r.kind === 'refund' ? ' <span class="chip chip--bad">Refund</span>' : ''}` },
          { key: 'amt', label: 'Amount', align: 'right', cell: (r) => twoLine(
            `<strong>${money(r.amount_paise)}</strong>`, fmtDateShort(r.received_on)) },
        ],
        rows,
        emptyTitle: 'No receipts yet',
        emptyText: 'Payments recorded against a plan or a consultation will show here.',
      })}
    </div>
  </div>`;
}

function websiteState(d) {
  const c = d.content;
  const line = (label, n, hidden, href) => `
    <div><dt>${label}</dt><dd>
      <a href="${href}" style="text-decoration:underline">${n} published</a>
      ${hidden ? `<span class="chip chip--warn" style="margin-left:.35rem">${hidden} hidden</span>` : ''}
    </dd></div>`;

  return `
  <div class="card">
    <div class="card__h"><h2>Website content</h2></div>
    <div class="card__b">
      <dl class="dl">
        ${line('Treatments', c.services, c.services_hidden, '#/services')}
        ${line('Doctors', c.doctors, 0, '#/doctors')}
        ${line('Clinics', c.locations, 0, '#/locations')}
        ${line('Reviews', c.testimonials, 0, '#/reviews')}
        <div><dt>Page sections</dt><dd><a href="#/content" style="text-decoration:underline">${c.sections}</a></dd></div>
        <div><dt>Images</dt><dd><a href="#/media" style="text-decoration:underline">${c.media} in the library</a></dd></div>
        <div><dt>Google reviews</dt><dd>${d.google.mode === 'live'
          ? `<span class="chip chip--ok">Live</span>
             <span class="t__sub">${d.google.live_review_count} pulled from Google</span>`
          : `<span class="chip chip--warn">Sample data</span>
             <span class="t__sub">${d.google.seeded_review_count} seeded</span>`}</dd></div>
      </dl>
    </div>
  </div>`;
}

function activity(d) {
  return `
  <div class="card">
    <div class="card__h"><h2>Recent activity</h2><a class="btn btn--sm" href="#/activity">Full log</a></div>
    <div class="card__b">
      ${d.activity.length ? `<ul class="feed">
        ${d.activity.map((a) => `
          <li>
            <span class="feed__w">${esc(fmtWhen(a.created_at))}</span>
            <span class="feed__t"><b>${esc(a.user_name || 'System')}</b>
              ${esc(a.action)} ${esc(a.entity || '')}${a.entity_id ? ` #${a.entity_id}` : ''}</span>
          </li>`).join('')}
      </ul>` : '<p style="color:var(--mute);font-size:.8rem">Nothing logged yet.</p>'}
    </div>
  </div>`;
}
