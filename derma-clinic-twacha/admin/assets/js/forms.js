/* =============================================================================
   Forms — a declarative field renderer and a save loop.

   Fields are described as data, so a resource's edit form and its validation
   live next to its columns rather than being hand-written twice. When the
   server rejects a write it names the offending field in `details.field`; that
   is painted onto the input instead of being dropped into a toast, which is the
   difference between "something was wrong" and "this box was wrong".
   ========================================================================== */

import {
  $, $$, esc, el, api, money, stripGrouping, isoToday, ApiError,
  modal, drawer, closeDrawer, toastOk, reportError, withBusy, on,
} from './core.js';

/* ------------------------------------------------------------ fields ---- */

/**
 * Field shape:
 *   { name, label, type, required, hint, options, rows, min, max, step,
 *     placeholder, value, width, when }
 *
 * type: text | textarea | number | money | date | email | tel | url |
 *       select | checkbox | media | static | fieldset | row
 */
function field(f, data = {}) {
  const raw = f.value !== undefined ? f.value : data[f.name];
  const id = `f_${f.name}`;
  const req = f.required ? ' <span class="req" title="Required">*</span>' : '';
  const hint = f.hint ? `<p class="f__hint">${f.hint}</p>` : '';
  const err = '<p class="f__err" hidden></p>';
  const label = `<label for="${id}">${esc(f.label)}${req}</label>`;

  switch (f.type) {
    case 'fieldset':
      return `<fieldset class="fset"><legend>${esc(f.label)}</legend>
                ${f.fields.map((sub) => field(sub, data)).join('')}
              </fieldset>`;

    case 'row':
      return `<div class="f--row">${f.fields.map((sub) => field(sub, data)).join('')}</div>`;

    case 'static':
      return `<div class="f"><label>${esc(f.label)}</label>
                <p style="font-size:.83rem">${f.html ?? esc(raw ?? '—')}</p>${hint}</div>`;

    case 'note':
      return `<div class="note ${f.tone ? `note--${f.tone}` : ''}" style="margin-bottom:1.1rem">${f.html}</div>`;

    case 'checkbox':
      return `<label class="check">
                <input type="checkbox" id="${id}" name="${f.name}" ${raw ? 'checked' : ''}>
                <span>${esc(f.label)}${f.hint ? `<em>${f.hint}</em>` : ''}</span>
              </label>`;

    case 'textarea':
      return `<div class="f">${label}
                <textarea id="${id}" name="${f.name}" rows="${f.rows || 4}"
                  ${f.placeholder ? `placeholder="${esc(f.placeholder)}"` : ''}>${esc(raw ?? '')}</textarea>
                ${hint}${err}</div>`;

    case 'select': {
      const opts = (f.options || []).map((o) => {
        const val = o.value ?? o.id ?? '';
        const text = o.label ?? o.name ?? String(val);
        const sel = String(val) === String(raw ?? '') ? ' selected' : '';
        return `<option value="${esc(val)}"${sel}>${esc(text)}</option>`;
      }).join('');
      const blank = f.required ? '' : `<option value=""${raw ? '' : ' selected'}>${esc(f.blank || '— none —')}</option>`;
      return `<div class="f">${label}
                <select id="${id}" name="${f.name}">${blank}${opts}</select>
                ${hint}${err}</div>`;
    }

    case 'money':
      return `<div class="f">${label}
                <div class="money">
                  <input type="text" inputmode="decimal" id="${id}" name="${f.name}"
                         value="${raw == null || raw === '' ? '' : esc(typeof raw === 'number' ? (raw / 100).toString() : raw)}"
                         placeholder="${esc(f.placeholder || '0')}" autocomplete="off">
                </div>${hint}${err}</div>`;

    case 'media':
      return `<div class="f">${label}
                <div class="pick" data-media-pick="${f.name}">
                  <img class="pick__t" alt="" src="${esc(data[f.previewFrom || 'image_url'] || '/assets/img/placeholder.svg')}">
                  <span class="pick__n">${data[f.previewFrom || 'image_url'] ? 'Image selected' : 'No image chosen'}</span>
                  <button type="button" class="btn btn--sm" data-open-media>Choose…</button>
                  <button type="button" class="btn btn--sm" data-clear-media ${raw ? '' : 'hidden'}>Clear</button>
                </div>
                <input type="hidden" name="${f.name}" value="${esc(raw ?? '')}">
                ${hint}${err}</div>`;

    default: {
      const type = f.type || 'text';
      const attrs = [
        f.min !== undefined ? `min="${f.min}"` : '',
        f.max !== undefined ? `max="${f.max}"` : '',
        f.step !== undefined ? `step="${f.step}"` : '',
        f.placeholder ? `placeholder="${esc(f.placeholder)}"` : '',
        f.autocomplete ? `autocomplete="${f.autocomplete}"` : 'autocomplete="off"',
      ].filter(Boolean).join(' ');
      const val = type === 'date' ? String(raw ?? '').slice(0, 10) : (raw ?? '');
      return `<div class="f">${label}
                <input type="${type}" id="${id}" name="${f.name}" value="${esc(val)}" ${attrs}>
                ${hint}${err}</div>`;
    }
  }
}

export const renderFields = (fields, data) =>
  fields.filter((f) => !f.when || f.when(data)).map((f) => field(f, data)).join('');

/* --------------------------------------------------------- read a form -- */

/** Flatten the declared fields, including those nested in rows/fieldsets. */
function flatten(fields) {
  const out = [];
  for (const f of fields) {
    if (f.type === 'row' || f.type === 'fieldset') out.push(...flatten(f.fields));
    else if (f.type !== 'static' && f.type !== 'note') out.push(f);
  }
  return out;
}

/**
 * Collect values by declared type rather than by reading the DOM blindly, so a
 * blank optional field is sent as null and never as the string "".
 */
export function readForm(root, fields) {
  const body = {};
  for (const f of flatten(fields)) {
    const input = root.querySelector(`[name="${f.name}"]`);
    if (!input) continue;

    if (f.type === 'checkbox') { body[f.name] = input.checked; continue; }

    const raw = String(input.value ?? '').trim();

    if (f.type === 'money') { body[f.name] = raw === '' ? null : stripGrouping(raw); continue; }
    if (f.type === 'number') { body[f.name] = raw === '' ? null : Number(raw); continue; }
    if (f.type === 'select' || f.type === 'media') { body[f.name] = raw === '' ? null : raw; continue; }

    body[f.name] = raw === '' ? null : raw;
  }
  return body;
}

export function clearErrors(root) {
  $$('.f.bad', root).forEach((f) => f.classList.remove('bad'));
  $$('.f__err', root).forEach((e) => { e.hidden = true; e.textContent = ''; });
  $('[data-form-err]', root)?.setAttribute('hidden', '');
}

/** Paint a server rejection where it belongs. Returns true if it landed. */
export function showError(root, err) {
  clearErrors(root);
  const fieldName = err instanceof ApiError ? err.details?.field : null;
  const input = fieldName ? root.querySelector(`[name="${fieldName}"]`) : null;

  if (input) {
    const holder = input.closest('.f');
    holder?.classList.add('bad');
    const slot = holder?.querySelector('.f__err');
    if (slot) { slot.textContent = err.message; slot.hidden = false; }
    input.focus();
    return true;
  }

  const banner = $('[data-form-err]', root);
  if (banner) {
    banner.textContent = err.message;
    banner.removeAttribute('hidden');
    banner.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    return true;
  }
  return false;
}

/* ------------------------------------------------------- media picker --- */

let mediaCache = null;

async function loadMedia(force = false) {
  if (!mediaCache || force) mediaCache = (await api('/admin/media', { query: { limit: 300 } })).items;
  return mediaCache;
}

export const invalidateMediaCache = () => { mediaCache = null; };

/** Grid picker used by every image field in the panel. */
export async function pickMedia() {
  let items;
  try { items = await loadMedia(); } catch (err) { reportError(err); return undefined; }

  const grid = items.length
    ? `<div class="mg">${items.map((m) => `
        <button type="button" class="mg__i" data-id="${m.id}" data-url="${esc(m.url)}">
          <img src="${esc(m.url)}" alt="" loading="lazy"
               onerror="this.src='/assets/img/placeholder.svg'">
          <span class="mg__c">
            <p>${esc(m.alt_text || m.original_name || 'Untitled')}</p>
            <em>${m.source === 'upload' ? 'Uploaded' : 'Linked'}</em>
          </span>
        </button>`).join('')}</div>`
    : `<p class="note note--warn">The library is empty. Add images under
       <strong>Website → Media</strong> first.</p>`;

  return modal({
    title: 'Choose an image',
    wide: true,
    body: `<div class="stack stack--sm">
             <p style="font-size:.79rem;color:var(--mute)">
               ${items.length} image${items.length === 1 ? '' : 's'} in the library.
               Upload more from Website → Media.</p>
             ${grid}
           </div>`,
    footer: '<button class="btn" data-close>Cancel</button>',
    onMount({ close, body }) {
      on(body, 'click', '.mg__i', (_e, hit) => {
        close({ id: Number(hit.dataset.id), url: hit.dataset.url });
      });
    },
  });
}

/** Attach picker behaviour to every media field inside a container. */
export function wireMediaFields(root) {
  on(root, 'click', '[data-open-media]', async (_e, btn) => {
    const pick = btn.closest('[data-media-pick]');
    const chosen = await pickMedia();
    if (!chosen) return;
    pick.querySelector('input[type=hidden]').value = chosen.id;
    pick.querySelector('.pick__t').src = chosen.url;
    pick.querySelector('.pick__n').textContent = 'Image selected';
    pick.querySelector('[data-clear-media]').hidden = false;
  });

  on(root, 'click', '[data-clear-media]', (_e, btn) => {
    const pick = btn.closest('[data-media-pick]');
    pick.querySelector('input[type=hidden]').value = '';
    pick.querySelector('.pick__t').src = '/assets/img/placeholder.svg';
    pick.querySelector('.pick__n').textContent = 'No image chosen';
    btn.hidden = true;
  });
}

/* --------------------------------------------------------- form drawer -- */

/**
 * The standard create/edit surface.
 *
 * @param {object}   o
 * @param {string}   o.title
 * @param {Array}    o.fields
 * @param {object}   [o.data]      existing row, for edit
 * @param {Function} o.submit      (body) => Promise, throws ApiError on reject
 * @param {string}   [o.saveLabel]
 * @param {string}   [o.intro]     HTML shown above the fields
 * @returns {Promise<boolean>}     true when saved
 */
export function formDrawer({
  title, fields, data = {}, submit, saveLabel = 'Save', intro = '', wide = false,
}) {
  const form = el(`
    <form novalidate class="stack">
      ${intro}
      <div class="note note--bad" data-form-err hidden></div>
      <div data-fields>${renderFields(fields, data)}</div>
      <div class="row row--end" style="padding-top:.3rem">
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="submit" class="btn btn--pri">${esc(saveLabel)}</button>
      </div>
    </form>`);

  wireMediaFields(form);

  /* Clearing an error as soon as the field is touched keeps the message
     attached to the attempt that produced it. */
  form.addEventListener('input', (e) => {
    const holder = e.target.closest('.f.bad');
    if (holder) {
      holder.classList.remove('bad');
      const slot = holder.querySelector('.f__err');
      if (slot) slot.hidden = true;
    }
  });

  return drawer({
    title,
    body: form,
    onMount({ close }) {
      form.querySelector('[data-cancel]').onclick = () => close(false);

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]');
        clearErrors(form);

        await withBusy(btn, async () => {
          try {
            await submit(readForm(form, fields));
            close(true);
          } catch (err) {
            if (!showError(form, err)) reportError(err);
          }
        });
      });
    },
  });
}

/* Convenience wrappers used by the resource views. ------------------------ */

export async function createRow({ resource, title, fields, extra = {}, onDone, intro }) {
  const saved = await formDrawer({
    title,
    fields,
    intro,
    saveLabel: 'Create',
    submit: (body) => api(`/admin/${resource}`, { method: 'POST', body: { ...body, ...extra } }),
  });
  if (saved) { toastOk('Created.'); await onDone?.(); }
  return saved;
}

export async function editRow({ resource, id, title, fields, data, onDone, intro }) {
  const saved = await formDrawer({
    title,
    fields,
    data,
    intro,
    submit: (body) => api(`/admin/${resource}/${id}`, { method: 'PATCH', body }),
  });
  if (saved) { toastOk('Saved.'); await onDone?.(); }
  return saved;
}

export { money, isoToday, closeDrawer };
