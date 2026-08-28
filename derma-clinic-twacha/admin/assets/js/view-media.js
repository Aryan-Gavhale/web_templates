/* =============================================================================
   Media library — uploads and linked images.

   Deleting an image that a section still points at would silently blank that
   block on the website, so usage is counted first and the delete has to be
   confirmed against a named list of the places it appears.
   ========================================================================== */

import {
  $, $$, esc, el, api, fmtWhen, plural, on, toastOk, reportError,
  withBusy, confirmModal, modal, drawer,
} from './core.js';
import { formDrawer, invalidateMediaCache } from './forms.js';

export async function render({ mount, setHead }) {
  setHead('Media library', 'Photographs used across the website.');

  mount.innerHTML = `
    <div class="stack">
      <div class="grid grid--2">
        <div class="card">
          <div class="card__h"><h2>Upload from this computer</h2>
            <p>JPEG, PNG, WebP, AVIF or GIF. Up to 8 MB each, twelve at a time.</p></div>
          <div class="card__b">
            <label class="drop" id="drop">
              <input type="file" id="file" accept="image/*" multiple hidden>
              <strong style="display:block;color:var(--ink);margin-bottom:.25rem">Drop images here</strong>
              or <span style="text-decoration:underline;cursor:pointer">choose files</span>
            </label>
            <div class="f" style="margin-top:.9rem;margin-bottom:0">
              <label for="upAlt">Description for screen readers</label>
              <input id="upAlt" type="text" placeholder="Consulting room at Koregaon Park">
              <p class="f__hint">Applied to everything in this batch. You can edit each one afterwards.</p>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__h"><h2>Link an image by URL</h2>
            <p>The practical route for a photograph you already have a link to.</p></div>
          <div class="card__b">
            <form id="linkForm" novalidate>
              <div class="note note--bad" data-form-err hidden></div>
              <div class="f">
                <label for="lkUrl">Image URL <span class="req">*</span></label>
                <input id="lkUrl" name="url" type="url" placeholder="https://…">
                <p class="f__hint">Must be a direct link to the image file, not to a page
                  showing it. Google Maps place photographs are pulled automatically once a
                  Place ID is set on the clinic — you do not need to paste those here.</p>
              </div>
              <div class="f">
                <label for="lkAlt">Description</label>
                <input id="lkAlt" name="alt_text" type="text">
              </div>
              <div class="f">
                <label for="lkCredit">Credit</label>
                <input id="lkCredit" name="credit" type="text" placeholder="Photographer or source">
              </div>
              <button class="btn btn--pri" type="submit">Add to library</button>
            </form>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="bar">
          <input type="search" id="mq" placeholder="Search descriptions and filenames…">
          <div class="push"></div>
          <span id="mMeta" style="font-size:.75rem;color:var(--faint)"></span>
        </div>
        <div class="card__b" id="grid">
          <div class="loading"><span class="spin"></span> Loading…</div>
        </div>
      </div>
    </div>`;

  const grid = $('#grid', mount);
  let items = [];

  async function refresh(q = '') {
    grid.style.opacity = '.55';
    try {
      const data = await api('/admin/media', { query: { q, limit: 300 } });
      items = data.items;
      invalidateMediaCache();

      $('#mMeta', mount).textContent = plural(items.length, 'image');
      grid.innerHTML = items.length
        ? `<div class="mg">${items.map(tile).join('')}</div>`
        : `<div class="empty"><strong>The library is empty</strong>
             <p>Upload a photograph or link one by URL to get started.</p></div>`;
    } catch (err) {
      reportError(err);
      grid.innerHTML = `<div class="empty"><strong>Could not load the library</strong>
        <p>${esc(err.message)}</p></div>`;
    } finally {
      grid.style.opacity = '';
    }
  }

  /* ---- upload ---- */

  const drop = $('#drop', mount);
  const file = $('#file', mount);

  drop.addEventListener('click', (e) => { if (e.target !== file) file.click(); });

  for (const type of ['dragenter', 'dragover']) {
    drop.addEventListener(type, (e) => { e.preventDefault(); drop.classList.add('hot'); });
  }
  for (const type of ['dragleave', 'drop']) {
    drop.addEventListener(type, () => drop.classList.remove('hot'));
  }
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    upload([...e.dataTransfer.files].filter((f) => f.type.startsWith('image/')));
  });
  file.addEventListener('change', () => upload([...file.files]));

  async function upload(files) {
    if (!files.length) return;
    const form = new FormData();
    for (const f of files.slice(0, 12)) form.append('files', f);
    form.append('alt_text', $('#upAlt', mount).value.trim());

    drop.innerHTML = `<span class="spin"></span> Uploading ${plural(files.length, 'image')}…`;
    try {
      const out = await api('/admin/media/upload', { method: 'POST', form });
      toastOk(`${plural(out.items.length, 'image')} uploaded.`);
      await refresh($('#mq', mount).value.trim());
    } catch (err) {
      reportError(err);
    } finally {
      drop.innerHTML = `
        <strong style="display:block;color:var(--ink);margin-bottom:.25rem">Drop images here</strong>
        or <span style="text-decoration:underline;cursor:pointer">choose files</span>`;
      file.value = '';
    }
  }

  /* ---- link by URL ---- */

  $('#linkForm', mount).addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const banner = $('[data-form-err]', form);
    banner.hidden = true;

    await withBusy($('[type=submit]', form), async () => {
      try {
        await api('/admin/media/link', {
          method: 'POST',
          body: {
            url: $('#lkUrl', form).value.trim(),
            alt_text: $('#lkAlt', form).value.trim(),
            credit: $('#lkCredit', form).value.trim(),
          },
        });
        form.reset();
        toastOk('Image added to the library.');
        await refresh();
      } catch (err) {
        banner.textContent = err.message;
        banner.hidden = false;
      }
    });
  });

  /* ---- search and per-image actions ---- */

  $('#mq', mount).addEventListener('input', (() => {
    let t;
    return (e) => {
      clearTimeout(t);
      const q = e.target.value.trim();
      t = setTimeout(() => refresh(q), 260);
    };
  })());

  on(grid, 'click', '.mg__i', (_e, hit) => {
    const m = items.find((x) => x.id === Number(hit.dataset.id));
    if (m) inspect(m, () => refresh($('#mq', mount).value.trim()));
  });

  await refresh();
}

const tile = (m) => `
  <div class="mg__i" data-id="${m.id}">
    <img src="${esc(m.url)}" alt="${esc(m.alt_text || '')}" loading="lazy"
         onerror="this.src='/assets/img/placeholder.svg'">
    ${m.usage.length ? `<span class="mg__u chip chip--teal">${m.usage.length} in use</span>` : ''}
    <div class="mg__c">
      <p>${esc(m.alt_text || m.original_name || 'No description')}</p>
      <em>${m.source === 'upload' ? 'Uploaded' : 'Linked'}${
        m.size_bytes ? ` · ${Math.round(m.size_bytes / 1024)} KB` : ''}</em>
    </div>
  </div>`;

/* ------------------------------------------------------------- inspect --- */

async function inspect(m, refresh) {
  const body = el(`
    <div class="stack">
      <img src="${esc(m.url)}" alt="${esc(m.alt_text || '')}"
           style="width:100%;border-radius:var(--r);background:var(--sand)"
           onerror="this.src='/assets/img/placeholder.svg'">

      <div class="card"><div class="card__b">
        <div class="note note--bad" data-form-err hidden></div>
        <div class="f">
          <label for="i_alt">Description for screen readers</label>
          <input id="i_alt" type="text" value="${esc(m.alt_text || '')}">
          <p class="f__hint">Describe what the photograph shows. This is read aloud to
            visitors using a screen reader and is shown if the image fails to load.</p>
        </div>
        <div class="f">
          <label for="i_credit">Credit</label>
          <input id="i_credit" type="text" value="${esc(m.credit || '')}">
        </div>
        <div class="row">
          <button class="btn btn--pri" data-save>Save</button>
          <div class="push"></div>
          <button class="btn btn--bad" data-del>Delete image</button>
        </div>
      </div></div>

      <div class="card">
        <div class="card__h"><h2>Where it is used</h2></div>
        <div class="card__b">
          ${m.usage.length
            ? `<ul class="feed">${m.usage.map((u) => `<li>
                 <span class="feed__w">${esc(u.kind)}</span>
                 <span class="feed__t">${esc(u.label)}</span></li>`).join('')}</ul>`
            : '<p style="font-size:.8rem;color:var(--mute)">Not referenced anywhere. Safe to delete.</p>'}
        </div>
        <div class="card__f">
          <span class="mono" style="word-break:break-all">${esc(m.url)}</span><br>
          Added ${esc(fmtWhen(m.created_at))}${m.mime ? ` · ${esc(m.mime)}` : ''}
        </div>
      </div>
    </div>`);

  await drawer({
    title: m.original_name || 'Image',
    body,
    onMount({ close }) {
      const banner = $('[data-form-err]', body);

      $('[data-save]', body).onclick = (e) => withBusy(e.currentTarget, async () => {
        try {
          await api(`/admin/media/${m.id}`, {
            method: 'PATCH',
            body: {
              alt_text: $('#i_alt', body).value.trim(),
              credit: $('#i_credit', body).value.trim(),
            },
          });
          toastOk('Saved.');
          close(true);
        } catch (err) {
          banner.textContent = err.message;
          banner.hidden = false;
        }
      });

      $('[data-del]', body).onclick = async () => {
        const inUse = m.usage.length;
        const go = await confirmModal({
          title: 'Delete this image?',
          danger: true,
          confirmLabel: inUse ? 'Delete and clear references' : 'Delete',
          message: inUse
            ? `It is used in ${plural(inUse, 'place')}: ${
              m.usage.map((u) => `${esc(u.kind)} “${esc(u.label)}”`).join(', ')}.
              Deleting it will leave those without a photograph.`
            : 'The file will be removed from the server. This cannot be undone.',
        });
        if (!go) return;

        try {
          await api(`/admin/media/${m.id}${inUse ? '?force=1' : ''}`, { method: 'DELETE' });
          toastOk('Image deleted.');
          close(true);
        } catch (err) { reportError(err); }
      };
    },
  });

  await refresh();
}
