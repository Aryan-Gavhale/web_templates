/* Studio Aarohi — admin console runtime.
   One global, `A`. Pages call into it; nothing here knows about a page. */

window.A = (function () {
  'use strict';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ── icons ───────────────────────────────────────────── */

  const ICONS = {
    check: 'M4 12.5 9.5 18 20 6',
    alert: 'M12 8v5M12 16.5v.5M10.3 3.8 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z',
    x: 'M6 6l12 12M18 6 6 18',
    up: 'M12 19V5M5 12l7-7 7 7',
    down: 'M12 5v14M5 12l7 7 7-7',
    plus: 'M12 5v14M5 12h14',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    edit: 'M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3Z',
    inbox: 'M3 13h4l2 3h6l2-3h4M3 13 6 5h12l3 8v6H3v-6Z',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    photo: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6',
    star: 'm12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3Z',
    rupee: 'M7 5h10M7 9h10M14.5 5c2 0 3 1.6 3 3.5S16 12 14 12H7l7 7',
    users: 'M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 20v-2a4 4 0 0 0-3-3.9M16 2.1a4 4 0 0 1 0 7.8',
    cog: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0V21a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 15H2.8a2 2 0 1 1 0-4H3a1.6 1.6 0 0 0 1.1-2.8L4 8.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.6 4.3V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4H21a1.6 1.6 0 0 0-1.5 1Z',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
    layout: 'M3 4h18v16H3zM3 9h18M9 9v11',
    layers: 'm12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5',
    image: 'M3 5h18v14H3zM8.5 10.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM21 15l-5-5-6 6-3-3-4 4',
    steps: 'M4 20h4v-5H4zM10 20h4V9h-4zM16 20h4V4h-4z',
    link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
    copy: 'M8 8h11v11H8zM5 16H4V4h12v1',
    down2: 'M12 3v13M6 11l6 6 6-6M4 21h16',
    refresh: 'M20 11A8 8 0 0 0 6.3 6.3L3 9M4 13a8 8 0 0 0 13.7 4.7L21 15M3 5v4h4M21 19v-4h-4',
    eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
    ext: 'M14 4h6v6M20 4l-8 8M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
    phone: 'M6 3h4l2 5-3 2a13 13 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2Z',
    wa: 'M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z M8.5 8.5c0 4 3 7 7 7 .8 0 1.2-.6 1.2-1.2l-2-1-1 1a7 7 0 0 1-3-3l1-1-1-2c-.6 0-1.2.4-1.2 1.2Z',
    file: 'M6 2h8l4 4v16H6zM14 2v4h4',
    money: 'M3 6h18v12H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
    bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.5.4.5 1.1.5 1.6v.5h6v-.5c0-.5 0-1.2.5-1.6A6 6 0 0 0 12 3Z',
  };

  function icon(name, cls) {
    const d = ICONS[name] || ICONS.grid;
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
      'stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  function paintIcons(root) {
    $$('[data-ic]', root).forEach(el => {
      el.outerHTML = icon(el.dataset.ic, el.className);
    });
  }

  /* ── toasts ──────────────────────────────────────────── */

  function toast(message, kind) {
    let host = $('.toasts');
    if (!host) {
      host = document.createElement('div');
      host.className = 'toasts';
      document.body.appendChild(host);
    }
    const el = document.createElement('div');
    el.className = 'toast toast--' + (kind === 'bad' ? 'bad' : 'ok');
    el.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
    el.innerHTML = icon(kind === 'bad' ? 'alert' : 'check') + '<span></span>';
    $('span', el).textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => el.remove(), 260);
    }, kind === 'bad' ? 5200 : 3200);
  }

  /* ── api ─────────────────────────────────────────────── */

  async function api(method, path, body) {
    const opts = { method, headers: {} };
    if (body instanceof FormData) {
      opts.body = body;
    } else if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    let res, out;
    try {
      res = await fetch('/api' + path, opts);
    } catch (e) {
      toast('Could not reach the server. Is it still running?', 'bad');
      throw e;
    }
    try {
      out = await res.json();
    } catch (e) {
      out = { ok: false, error: 'The server sent a reply we could not read.' };
    }
    if (!out.ok) {
      out.status = res.status;
      throw out;
    }
    return out;
  }

  const get = p => api('GET', p);
  const post = (p, b) => api('POST', p, b === undefined ? {} : b);
  const put = (p, b) => api('PUT', p, b);
  const patch = (p, b) => api('PATCH', p, b);
  const del = (p, b) => api('DELETE', p, b === undefined ? {} : b);

  /** Run an API call with button busy-state and a toast on either outcome. */
  async function act(btn, fn, okMessage) {
    if (btn) btn.classList.add('is-busy');
    try {
      const out = await fn();
      if (okMessage) toast(okMessage);
      return out;
    } catch (e) {
      if (e && e.error) toast(e.error, 'bad');
      return null;
    } finally {
      if (btn) btn.classList.remove('is-busy');
    }
  }

  /* ── modal ───────────────────────────────────────────── */

  let openModals = [];

  function modal(opts) {
    const veil = document.createElement('div');
    veil.className = 'veil';
    veil.innerHTML =
      '<div class="modal ' + (opts.size ? 'modal--' + opts.size : '') + '" role="dialog" ' +
      'aria-modal="true" aria-label="' + esc(opts.title || 'Dialog') + '">' +
        '<header class="modal__h"><div><h2></h2>' +
          (opts.note ? '<p></p>' : '') +
        '</div><button class="modal__x" type="button" aria-label="Close">' +
          icon('x') + '</button></header>' +
        '<div class="modal__b"></div>' +
        '<footer class="modal__f"></footer>' +
      '</div>';

    $('h2', veil).textContent = opts.title || '';
    if (opts.note) $('.modal__h p', veil).textContent = opts.note;

    const bodyEl = $('.modal__b', veil);
    if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body;
    else if (opts.body) bodyEl.appendChild(opts.body);
    paintIcons(bodyEl);

    const footEl = $('.modal__f', veil);
    (opts.actions || []).forEach(a => {
      if (a.spacer) {
        const s = document.createElement('div');
        s.className = 'grow';
        footEl.appendChild(s);
        return;
      }
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'b ' + (a.className || '');
      btn.innerHTML = (a.icon ? icon(a.icon) : '') + '<span>' + esc(a.label) + '</span>';
      btn.addEventListener('click', () => a.onClick && a.onClick(api2, btn));
      footEl.appendChild(btn);
    });
    if (!footEl.children.length) footEl.remove();

    function close() {
      veil.classList.remove('is-open');
      openModals = openModals.filter(m => m !== api2);
      if (!openModals.length) document.body.style.overflow = '';
      setTimeout(() => veil.remove(), 220);
      if (opts.onClose) opts.onClose();
    }

    const api2 = {
      el: veil,
      body: bodyEl,
      close,
      values: () => formValues(bodyEl),
      field: name => $('[name="' + name + '"]', bodyEl),
    };

    $('.modal__x', veil).addEventListener('click', close);
    veil.addEventListener('mousedown', e => { if (e.target === veil) close(); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === api2) {
        close();
        document.removeEventListener('keydown', onKey);
      }
    });

    document.body.appendChild(veil);
    document.body.style.overflow = 'hidden';
    openModals.push(api2);
    requestAnimationFrame(() => veil.classList.add('is-open'));

    const first = $('input:not([type=hidden]), textarea, select', bodyEl);
    if (first && !opts.noAutofocus) setTimeout(() => first.focus(), 120);
    return api2;
  }

  /** Yes/no dialog. Resolves true when confirmed. */
  function confirmDialog(opts) {
    return new Promise(resolve => {
      let answered = false;
      const m = modal({
        title: opts.title || 'Are you sure?',
        size: 'slim',
        body: '<p style="font-size:13.5px;color:var(--muted);line-height:1.6">' +
          esc(opts.message || '') + '</p>',
        actions: [
          { spacer: true },
          { label: opts.cancelLabel || 'Cancel', onClick: m => m.close() },
          {
            label: opts.confirmLabel || 'Delete',
            className: opts.danger === false ? 'b--pri' : 'b--bad',
            onClick: m => { answered = true; m.close(); resolve(true); },
          },
        ],
        onClose: () => { if (!answered) resolve(false); },
      });
      const last = m.el.querySelectorAll('.modal__f .b');
      if (last.length) last[last.length - 1].focus();
    });
  }

  /* ── forms ───────────────────────────────────────────── */

  function formValues(root) {
    const out = {};
    $$('[name]', root).forEach(el => {
      if (el.type === 'checkbox') out[el.name] = el.checked ? 1 : 0;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
      else out[el.name] = el.value;
    });
    return out;
  }

  function fill(root, values) {
    Object.keys(values || {}).forEach(k => {
      const el = $('[name="' + k + '"]', root);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = !!Number(values[k]);
      else el.value = values[k] === null || values[k] === undefined ? '' : values[k];
    });
  }

  function esc(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── field builders (used by the page modals) ────────── */

  const F = {
    text: (name, label, o) => field('input', name, label, o),
    number: (name, label, o) => field('input', name, label, Object.assign({ type: 'number' }, o)),
    date: (name, label, o) => field('input', name, label, Object.assign({ type: 'date' }, o)),
    area: (name, label, o) => field('textarea', name, label, o),
    select: (name, label, options, o) => {
      const opts = options.map(op => {
        const v = Array.isArray(op) ? op[0] : op;
        const t = Array.isArray(op) ? op[1] : op;
        return '<option value="' + esc(v) + '">' + esc(t) + '</option>';
      }).join('');
      return field('select', name, label, Object.assign({ inner: opts }, o));
    },
    toggle: (name, label, on) =>
      '<label class="sw" style="margin-bottom:14px">' +
      '<input type="checkbox" name="' + name + '"' + (on ? ' checked' : '') + '>' +
      '<span class="sw__t"></span><span class="sw__l">' + esc(label) + '</span></label>',
    row: (...bits) => '<div class="f-' + bits.length + '">' + bits.join('') + '</div>',
    raw: html => html,
  };

  function field(tag, name, label, o) {
    o = o || {};
    const attrs = [
      'class="in' + (o.className ? ' ' + o.className : '') + '"',
      'name="' + name + '"',
      'id="fld-' + name + '"',
      o.type ? 'type="' + o.type + '"' : '',
      o.placeholder ? 'placeholder="' + esc(o.placeholder) + '"' : '',
      o.rows ? 'rows="' + o.rows + '"' : '',
      o.min !== undefined ? 'min="' + o.min + '"' : '',
      o.max !== undefined ? 'max="' + o.max + '"' : '',
      o.step ? 'step="' + o.step + '"' : '',
      o.readonly ? 'readonly' : '',
    ].filter(Boolean).join(' ');

    const control = tag === 'input'
      ? '<input ' + attrs + '>'
      : '<' + tag + ' ' + attrs + '>' + (o.inner || '') + '</' + tag + '>';

    return '<div class="f">' +
      '<label for="fld-' + name + '">' + esc(label) +
      (o.required ? ' <i class="f-req">*</i>' : '') + '</label>' +
      (o.prefix
        ? '<span class="pre"><span class="pre__s">' + esc(o.prefix) + '</span>' + control + '</span>'
        : control) +
      (o.hint ? '<p class="f-hint">' + esc(o.hint) + '</p>' : '') +
      '</div>';
  }

  /* ── media picker ────────────────────────────────────── */

  let mediaCache = null;

  async function media(force) {
    if (!mediaCache || force) mediaCache = (await get('/media')).items;
    return mediaCache;
  }

  /**
   * Open the library. `multi` returns an array of ids, otherwise a single id
   * (or null when the owner clears the choice).
   */
  async function pickMedia(opts) {
    opts = opts || {};
    const items = await media();
    const picked = new Set(opts.selected || []);

    const wrap = document.createElement('div');
    wrap.innerHTML =
      '<div class="drop" id="pk-drop">' +
        '<h3>Drop images here</h3>' +
        '<p>JPG, PNG or WebP up to 12 MB. They are resized for the web automatically.</p>' +
        '<button class="b b--pri" type="button" id="pk-browse">' + icon('plus') +
          '<span>Choose files</span></button>' +
        '<input type="file" id="pk-file" accept="image/*" multiple hidden>' +
      '</div>' +
      '<div class="row" style="margin:16px 0 12px">' +
        '<div class="search">' + icon('search') +
          '<input class="in" id="pk-q" placeholder="Search by name or alt text">' +
        '</div>' +
        '<span class="dim tiny" id="pk-n"></span>' +
      '</div>' +
      '<div class="mgrid" id="pk-grid"></div>';

    const grid = $('#pk-grid', wrap);
    const counter = $('#pk-n', wrap);

    function draw(filter) {
      const term = (filter || '').toLowerCase();
      const list = items.filter(m =>
        !term || (m.name + ' ' + m.alt).toLowerCase().includes(term));
      counter.textContent = list.length + ' of ' + items.length + ' images';
      if (!list.length) {
        grid.innerHTML = '<p class="dim tiny">Nothing matches that search.</p>';
        return;
      }
      grid.innerHTML = list.map(m =>
        '<figure class="mcell' + (picked.has(m.id) ? ' is-pick' : '') + '" data-id="' + m.id + '">' +
        '<img src="' + esc(m.thumb || m.src) + '" alt="" loading="lazy">' +
        '<figcaption>' + esc(m.alt || m.name || 'Untitled') + '</figcaption></figure>').join('');
    }
    draw('');

    $('#pk-q', wrap).addEventListener('input', e => draw(e.target.value));

    grid.addEventListener('click', e => {
      const cell = e.target.closest('.mcell');
      if (!cell) return;
      const id = Number(cell.dataset.id);
      if (opts.multi) {
        if (picked.has(id)) picked.delete(id); else picked.add(id);
        cell.classList.toggle('is-pick');
      } else {
        picked.clear();
        picked.add(id);
        $$('.mcell', grid).forEach(c => c.classList.remove('is-pick'));
        cell.classList.add('is-pick');
      }
    });

    async function upload(files) {
      if (!files || !files.length) return;
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append('file', f));
      const drop = $('#pk-drop', wrap);
      drop.classList.add('is-over');
      try {
        const out = await api('POST', '/media', fd);
        mediaCache = null;
        out.items.forEach(m => { items.unshift(m); picked.add(m.id); });
        if (!opts.multi && out.items.length) {
          picked.clear();
          picked.add(out.items[0].id);
        }
        draw($('#pk-q', wrap).value);
        toast(out.items.length + ' image(s) added');
        (out.warnings || []).forEach(w => toast(w, 'bad'));
      } catch (e) {
        toast((e && e.error) || 'That upload failed.', 'bad');
      } finally {
        drop.classList.remove('is-over');
      }
    }

    $('#pk-browse', wrap).addEventListener('click', () => $('#pk-file', wrap).click());
    $('#pk-file', wrap).addEventListener('change', e => upload(e.target.files));
    const drop = $('#pk-drop', wrap);
    ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault(); drop.classList.add('is-over');
    }));
    ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => {
      e.preventDefault();
      if (ev === 'dragleave') drop.classList.remove('is-over');
    }));
    drop.addEventListener('drop', e => upload(e.dataTransfer.files));

    return new Promise(resolve => {
      let answered = false;
      modal({
        title: opts.title || (opts.multi ? 'Add images' : 'Choose an image'),
        size: 'wide',
        body: wrap,
        noAutofocus: true,
        actions: [
          opts.allowClear
            ? { label: 'Remove image', className: 'b--bad', onClick: m => {
                answered = true; m.close(); resolve(opts.multi ? [] : null);
              } }
            : { spacer: true },
          { spacer: true },
          { label: 'Cancel', onClick: m => m.close() },
          {
            label: opts.multi ? 'Add selected' : 'Use this image',
            className: 'b--pri',
            onClick: m => {
              if (!picked.size) { toast('Pick an image first.', 'bad'); return; }
              answered = true;
              m.close();
              resolve(opts.multi ? Array.from(picked) : Array.from(picked)[0]);
            },
          },
        ],
        onClose: () => { if (!answered) resolve(undefined); },
      });
    });
  }

  /* ── reordering ──────────────────────────────────────── */

  /** Wire up-/down- buttons inside a list, then persist the new order. */
  function sortable(listSelector, table, onDone) {
    const list = $(listSelector);
    if (!list) return;

    function refresh() {
      const rows = $$('[data-row]', list);
      rows.forEach((row, idx) => {
        const up = $('[data-move="up"]', row);
        const down = $('[data-move="down"]', row);
        if (up) up.disabled = idx === 0;
        if (down) down.disabled = idx === rows.length - 1;
      });
    }

    list.addEventListener('click', async e => {
      const btn = e.target.closest('[data-move]');
      if (!btn) return;
      const row = btn.closest('[data-row]');
      const sibling = btn.dataset.move === 'up'
        ? row.previousElementSibling
        : row.nextElementSibling;
      if (!sibling) return;

      if (btn.dataset.move === 'up') list.insertBefore(row, sibling);
      else list.insertBefore(sibling, row);
      refresh();

      const ids = $$('[data-row]', list).map(r => Number(r.dataset.id));
      await act(btn, () => post('/reorder', { table, ids }));
      if (onDone) onDone(ids);
    });

    refresh();
    return { refresh };
  }

  /** Wire every .sw switch that carries data-toggle-table / -field / -id. */
  function toggles(root) {
    $$('[data-toggle-table]', root || document).forEach(el => {
      if (el.dataset.wired) return;
      el.dataset.wired = '1';
      el.addEventListener('change', async () => {
        try {
          await post('/toggle', {
            table: el.dataset.toggleTable,
            field: el.dataset.toggleField || 'is_visible',
            id: Number(el.dataset.toggleId),
            value: el.checked ? 1 : 0,
          });
          toast(el.dataset.toggleLabel
            ? el.dataset.toggleLabel + (el.checked ? ' is now live' : ' is now hidden')
            : (el.checked ? 'Now showing on the site' : 'Hidden from the site'));
        } catch (e) {
          el.checked = !el.checked;
          toast((e && e.error) || 'That switch did not save.', 'bad');
        }
      });
    });
  }

  /* ── misc helpers ────────────────────────────────────── */

  function copy(text, note) {
    const done = () => toast(note || 'Copied to the clipboard');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, () => fallback());
    } else fallback();

    function fallback() {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;left:-9999px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); }
      catch (e) { toast('Copying is blocked in this browser.', 'bad'); }
      ta.remove();
    }
  }

  function money(v) {
    const n = Math.round(Number(v) || 0);
    const sign = n < 0 ? '-' : '';
    const s = String(Math.abs(n));
    let body;
    if (s.length <= 3) body = s;
    else {
      let head = s.slice(0, -3);
      const tail = s.slice(-3);
      const parts = [];
      while (head.length > 2) { parts.unshift(head.slice(-2)); head = head.slice(0, -2); }
      if (head) parts.unshift(head);
      body = parts.join(',') + ',' + tail;
    }
    return sign + (window.CURRENCY || '₹') + body;
  }

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /** '2026-07-28' -> '28 Jul 2026'. Anything unparseable comes back untouched. */
  function date(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return iso || '—';
    return Number(m[3]) + ' ' + MONTHS[Number(m[2]) - 1] + ' ' + m[1];
  }

  function fillTemplate(tpl, vars) {
    return String(tpl || '').replace(/\{(\w+)\}/g, (m, k) =>
      vars[k] === undefined || vars[k] === null ? m : String(vars[k]));
  }

  function debounce(fn, wait) {
    let t;
    return function (...a) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, a), wait);
    };
  }

  /* ── boot ────────────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    paintIcons(document);
    toggles(document);

    const burger = $('#burger');
    if (burger) {
      burger.addEventListener('click', () => document.body.classList.toggle('rail-open'));
      document.addEventListener('click', e => {
        if (!document.body.classList.contains('rail-open')) return;
        if (e.target.closest('.rail') || e.target.closest('#burger')) return;
        document.body.classList.remove('rail-open');
      });
    }

    // Live search boxes just re-run the page query.
    $$('[data-search-form]').forEach(form => {
      const input = $('input[name="q"]', form);
      if (input) input.addEventListener('input', debounce(() => form.submit(), 550));
    });

    $$('[data-copy]').forEach(btn => {
      btn.addEventListener('click', () => copy(btn.dataset.copy, btn.dataset.copyNote));
    });
  });

  return {
    $, $$, icon, paintIcons, toast, api, get, post, put, patch, del, act,
    modal, confirmDialog, formValues, fill, esc, F, media, pickMedia,
    sortable, toggles, copy, money, date, fillTemplate, debounce,
  };
})();
