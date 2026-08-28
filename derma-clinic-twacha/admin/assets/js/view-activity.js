/* =============================================================================
   Activity log — who changed what, and when.

   Read-only by design. An audit trail that can be edited from the panel it
   audits is not an audit trail.
   ========================================================================== */

import { esc, api, fmtWhen, titleCase, plural, or } from './core.js';
import { table, twoLine } from './list.js';

/* Actions grouped so the log can be read at a glance. */
const TONE = {
  login: 'ok', logout: '', create: 'teal', update: '', delete: 'bad',
  payment: 'ok', void: 'bad', convert: 'info', note: '', reorder: '',
  upload: 'info', link: 'info', export: '', 'google-sync': 'info',
  'password-change': 'warn', 'password-reset': 'warn',
};

export async function render({ mount, setHead }) {
  const data = await api('/admin/activity', { query: { limit: 400 } });
  setHead('Activity log', `The last ${plural(data.items.length, 'recorded action')}.`);

  mount.innerHTML = `
    <div class="stack">
      <div class="note">Sign-ins, content changes, receipts and voids are all recorded here
        with the account that performed them. The log cannot be edited or cleared from this
        panel.</div>

      <div class="card">
        <div class="card__b card__b--flush">
          ${table({
            columns: [
              { key: 'when', label: 'When', width: '13rem', cell: (a) => esc(fmtWhen(a.created_at)) },
              { key: 'who', label: 'Who', cell: (a) => twoLine(
                or(a.user_name, 'System'), esc(a.ip || '')) },
              { key: 'what', label: 'Action', cell: (a) => `<span class="chip chip--${
                TONE[a.action] ?? ''}">${esc(titleCase(a.action))}</span>` },
              { key: 'on', label: 'On', cell: (a) => (a.entity
                ? twoLine(esc(titleCase(a.entity)), a.entity_id ? `#${a.entity_id}` : '')
                : '<span style="color:var(--faint)">—</span>') },
              { key: 'det', label: 'Detail', cell: (a) => (a.detail
                ? `<span class="feed__d">${esc(summarise(a.detail))}</span>`
                : '') },
            ],
            rows: data.items,
            emptyTitle: 'Nothing logged yet',
            emptyText: 'Actions appear here as soon as somebody signs in and changes something.',
          })}
        </div>
      </div>
    </div>`;
}

/**
 * The `details` column is JSON. Rendering raw JSON in a table makes the column
 * unreadable, so it is flattened to key=value pairs and truncated.
 */
function summarise(json) {
  let obj;
  try { obj = JSON.parse(json); } catch { return String(json).slice(0, 90); }
  if (!obj || typeof obj !== 'object') return String(obj).slice(0, 90);

  const parts = Object.entries(obj).map(([k, v]) => {
    if (v === null || v === undefined) return null;

    /* The record's own label carries more meaning than any key would add, so it
       is printed bare. */
    if (k === 'name' || k === 'title') return String(v);

    if (Array.isArray(v)) {
      /* "10 items" hides the one thing the reader wants — which fields moved.
         Short lists print in full; long ones name the first few and count. */
      if (!v.length) return null;
      const shown = v.slice(0, 4).join(', ');
      return v.length > 4 ? `${k}: ${shown} +${v.length - 4} more` : `${k}: ${shown}`;
    }
    if (typeof v === 'object') return `${k}=…`;

    // Money fields are stored in paise; showing 250000 as a raw number misleads.
    if (/(amount|paise|principal)/.test(k) && Number.isFinite(Number(v))) {
      return `${k}=₹${(Number(v) / 100).toLocaleString('en-IN')}`;
    }
    return `${k}=${v}`;
  }).filter(Boolean);

  const text = parts.join(' · ');
  return text.length > 110 ? `${text.slice(0, 110)}…` : text;
}
