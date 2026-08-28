/* =============================================================================
   List scaffolding — filter bar, table, empty state, drag reordering.

   Ten screens in this panel are "filter a list, click a row, act on it". This
   module is that shape written once so the tables behave identically: same
   sticky header, same empty state, same debounce on the search box.
   ========================================================================== */

import { $, $$, esc, el, api, on, debounce, empty, toastOk, reportError } from './core.js';

/**
 * @param {object}   o
 * @param {Array}    o.columns   [{ key, label, cell(row), align, width, cls }]
 * @param {Array}    o.rows
 * @param {Function} [o.rowClass]
 * @param {string}   [o.emptyTitle]
 * @param {string}   [o.emptyText]
 * @param {string}   [o.emptyAction] HTML
 */
export function table({
  columns, rows, rowClass, emptyTitle = 'Nothing here yet', emptyText = '', emptyAction = '',
}) {
  if (!rows.length) return empty(emptyTitle, emptyText, emptyAction);

  const head = columns.map((c) => `
    <th ${c.align === 'right' ? 'class="num"' : ''} ${c.width ? `style="width:${c.width}"` : ''}>
      ${esc(c.label)}
    </th>`).join('');

  const body = rows.map((row, i) => `
    <tr data-id="${row.id ?? ''}" data-i="${i}" class="${rowClass ? rowClass(row) : ''}">
      ${columns.map((c) => `
        <td class="${[c.align === 'right' ? 'num' : '', c.cls || ''].filter(Boolean).join(' ')}">
          ${c.cell(row) ?? ''}
        </td>`).join('')}
    </tr>`).join('');

  return `<div class="tw"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** Two-line table cell: a strong primary and a quiet secondary. */
export const twoLine = (main, sub) =>
  `<div class="t__main">${main ?? '—'}</div>${sub ? `<div class="t__sub">${sub}</div>` : ''}`;

/**
 * A complete list screen: card, filter bar, table region that refreshes on its
 * own without re-rendering the surrounding chrome.
 *
 * @param {object}   o
 * @param {Node}     o.mount
 * @param {string}   [o.search]      placeholder; omit for no search box
 * @param {Array}    [o.filters]     [{ name, type:'segs'|'select'|'date', options, value, label }]
 * @param {string}   [o.actions]     HTML for the right-hand side of the bar
 * @param {Function} o.fetch         (state) => Promise<{ html, meta }>
 * @returns {{ refresh: Function, state: object, card: Node }}
 */
export function listScreen({ mount, search, filters = [], actions = '', fetchPage, afterRender }) {
  const state = {};
  for (const f of filters) if (f.value !== undefined) state[f.name] = f.value;

  const barBits = [];

  if (search) {
    barBits.push(`<input type="search" data-q placeholder="${esc(search)}" autocomplete="off">`);
  }

  for (const f of filters) {
    if (f.type === 'segs') {
      barBits.push(`<div class="segs" data-segs="${f.name}">
        ${f.options.map((o) => `
          <button type="button" data-v="${esc(o.value)}"
            class="${String(o.value) === String(f.value) ? 'on' : ''}">${esc(o.label)}
            ${o.count != null ? `<span class="n">${o.count}</span>` : ''}
          </button>`).join('')}
      </div>`);
    } else if (f.type === 'select') {
      barBits.push(`<select data-filter="${f.name}" aria-label="${esc(f.label || f.name)}">
        ${f.options.map((o) => `<option value="${esc(o.value)}"
          ${String(o.value) === String(f.value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
      </select>`);
    } else if (f.type === 'date') {
      barBits.push(`<label style="font-size:.75rem;color:var(--mute);display:flex;gap:.35rem;align-items:center">
        ${esc(f.label)}<input type="date" data-filter="${f.name}" value="${esc(f.value || '')}">
      </label>`);
    }
  }

  const card = el(`
    <div class="card">
      <div class="bar">
        ${barBits.join('')}
        <div class="push"></div>
        ${actions}
        <span class="bar__meta" data-meta style="font-size:.75rem;color:var(--faint)"></span>
      </div>
      <div data-region><div class="loading"><span class="spin"></span> Loading…</div></div>
    </div>`);

  mount.innerHTML = '';
  mount.append(card);

  const region = $('[data-region]', card);
  const meta = $('[data-meta]', card);
  let inFlight = 0;

  async function refresh() {
    const token = ++inFlight;
    region.style.opacity = '.55';
    try {
      const out = await fetchPage(state);
      if (token !== inFlight) return;
      region.innerHTML = out.html;
      meta.innerHTML = out.meta || '';
      // Runs on every repaint, not just the first, so behaviour attached to
      // rows (drag reordering) survives a search or a filter change.
      afterRender?.(region);
    } catch (err) {
      if (token !== inFlight) return;
      reportError(err);
      region.innerHTML = `<div class="empty"><strong>Could not load this list</strong>
        <p>${esc(err.message)}</p>
        <button class="btn" data-retry>Try again</button></div>`;
    } finally {
      if (token === inFlight) region.style.opacity = '';
    }
  }

  if (search) {
    $('[data-q]', card).addEventListener('input', debounce((e) => {
      state.q = e.target.value.trim();
      refresh();
    }));
  }

  on(card, 'click', '[data-segs] button', (_e, btn) => {
    const wrap = btn.closest('[data-segs]');
    $$('button', wrap).forEach((b) => b.classList.toggle('on', b === btn));
    state[wrap.dataset.segs] = btn.dataset.v;
    refresh();
  });

  on(card, 'change', '[data-filter]', (_e, input) => {
    state[input.dataset.filter] = input.value;
    refresh();
  });

  on(card, 'click', '[data-retry]', () => refresh());

  refresh();
  return { refresh, state, card, region };
}

/* ------------------------------------------------------- drag reorder --- */

/**
 * Row reordering for the content lists. HTML5 drag-and-drop over table rows,
 * persisted with one POST of the resulting id order.
 */
export function enableReorder(region, resource, afterSave) {
  const tbody = $('tbody', region);
  if (!tbody) return;

  let dragged = null;

  for (const tr of $$('tr', tbody)) tr.draggable = true;

  tbody.addEventListener('dragstart', (e) => {
    dragged = e.target.closest('tr');
    if (!dragged) return;
    dragged.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragged.dataset.id);
  });

  tbody.addEventListener('dragover', (e) => {
    e.preventDefault();
    const over = e.target.closest('tr');
    if (!over || over === dragged) return;
    $$('tr.over', tbody).forEach((r) => r.classList.remove('over'));
    over.classList.add('over');
  });

  tbody.addEventListener('dragleave', (e) => {
    e.target.closest('tr')?.classList.remove('over');
  });

  tbody.addEventListener('drop', async (e) => {
    e.preventDefault();
    const over = e.target.closest('tr');
    $$('tr.over', tbody).forEach((r) => r.classList.remove('over'));
    if (!over || !dragged || over === dragged) return;

    const rows = $$('tr', tbody);
    const from = rows.indexOf(dragged);
    const to = rows.indexOf(over);
    over.insertAdjacentElement(from < to ? 'afterend' : 'beforebegin', dragged);

    const order = $$('tr', tbody).map((r) => Number(r.dataset.id));
    try {
      await api(`/admin/${resource}/reorder`, { method: 'POST', body: { order } });
      toastOk('Order saved.');
      await afterSave?.();
    } catch (err) {
      reportError(err);
      await afterSave?.();
    }
  });

  tbody.addEventListener('dragend', () => {
    dragged?.classList.remove('dragging');
    $$('tr.over', tbody).forEach((r) => r.classList.remove('over'));
    dragged = null;
  });
}

/** Standard row action buttons. */
export const rowActions = (bits) => `<div class="row row--end" style="gap:.3rem">${bits.join('')}</div>`;
export const actEdit = () => '<button class="btn btn--sm" data-act="edit">Edit</button>';
export const actDel = () => '<button class="btn btn--sm btn--bad" data-act="del">Delete</button>';
export const actOpen = (label = 'Open') => `<button class="btn btn--sm" data-act="open">${esc(label)}</button>`;

/**
 * The publish toggle names what it will do, not what the row is. A button
 * reading "Publish" on a row already marked LIVE invites somebody to click it
 * and take the section off the website by accident.
 */
export const actPub = (row) => `<button class="btn btn--sm" data-act="pub">${
  row.is_published ? 'Hide' : 'Publish'}</button>`;
