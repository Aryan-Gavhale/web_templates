/* ==========================================================================
   Admin panel behaviour. No framework, no build step.
   Everything degrades to a plain form post if JS is unavailable.
   ========================================================================== */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const csrf = () => (document.querySelector('input[name=csrf_token]') || {}).value || '';

  /* ── sidebar on small screens ───────────────────────────────────────────── */
  const side = $('#side'), scrim = $('#scrim'), burger = $('#burger2');
  const sideSync = () => {
    const open = !!side?.classList.contains('is-open');
    if (scrim) scrim.hidden = !open;
    burger?.setAttribute('aria-expanded', String(open));
    burger?.setAttribute('aria-label', open ? 'Close the menu' : 'Menu');
  };
  const closeSide = () => { side?.classList.remove('is-open'); sideSync(); };
  burger?.addEventListener('click', () => { side?.classList.toggle('is-open'); sideSync(); });
  scrim?.addEventListener('click', closeSide);
  sideSync();

  // The open sidebar sits under the top bar, so it needs the bar's real height.
  const topbar = $('.top');
  const measureTop = () => {
    if (topbar) document.documentElement.style.setProperty('--top-h', topbar.offsetHeight + 'px');
  };
  measureTop();
  if (topbar && window.ResizeObserver) new ResizeObserver(measureTop).observe(topbar);
  window.addEventListener('resize', measureTop);

  /* ── flashes ────────────────────────────────────────────────────────────── */
  $$('.flash').forEach((el) => {
    const kill = () => { el.style.opacity = '0'; el.style.transform = 'translateX(14px)'; setTimeout(() => el.remove(), 240); };
    el.style.transition = 'opacity .22s, transform .22s';
    $('.flash__x', el)?.addEventListener('click', kill);
    setTimeout(kill, 6000);
  });

  function toast(message, isError) {
    let host = $('#flashes');
    if (!host) { host = document.createElement('div'); host.id = 'flashes'; host.className = 'flashes'; document.body.appendChild(host); }
    const el = document.createElement('div');
    el.className = 'flash' + (isError ? ' flash--error' : '');
    el.innerHTML = '<span></span><button class="flash__x" type="button" aria-label="Dismiss">&times;</button>';
    el.firstChild.textContent = message;
    host.appendChild(el);
    el.style.transition = 'opacity .22s, transform .22s';
    const kill = () => { el.style.opacity = '0'; setTimeout(() => el.remove(), 240); };
    $('.flash__x', el).addEventListener('click', kill);
    setTimeout(kill, 5000);
  }
  window.adminToast = toast;

  /* ── confirm before destructive posts ───────────────────────────────────── */
  document.addEventListener('submit', (event) => {
    const form = event.target;
    const question = form.dataset.confirm;
    if (question && !window.confirm(question)) event.preventDefault();
  });
  $$('button[data-confirm], a[data-confirm]').forEach((el) => {
    el.addEventListener('click', (event) => {
      if (el.closest('form') && el.type === 'submit') return;   // handled above
      if (!window.confirm(el.dataset.confirm)) event.preventDefault();
    });
  });

  /* ── unsaved-changes guard ──────────────────────────────────────────────── */
  $$('form[data-guard]').forEach((form) => {
    let dirty = false;
    form.addEventListener('input', () => { dirty = true; });
    form.addEventListener('submit', () => { dirty = false; });
    window.addEventListener('beforeunload', (event) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    });
  });

  /* ── colour inputs paired with a hex field ──────────────────────────────── */
  $$('input[data-colour-for]').forEach((swatch) => {
    const text = document.getElementById(swatch.dataset.colourFor);
    if (!text) return;
    swatch.addEventListener('input', () => { text.value = swatch.value.toUpperCase(); });
    text.addEventListener('input', () => {
      if (/^#[0-9a-f]{6}$/i.test(text.value)) swatch.value = text.value;
    });
  });

  /* ── slug helper: fill from a title until touched by hand ───────────────── */
  const slugify = (value) => value.toString().toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '').replace(/[\s-]+/g, '-').replace(/^-|-$/g, '');
  $$('input[name=slug]').forEach((slug) => {
    const form = slug.closest('form');
    const source = form && (form.querySelector('input[name=name]') || form.querySelector('input[name=title]'));
    if (!source) return;
    if (slug.value) slug.dataset.touched = '1';
    slug.addEventListener('input', () => { slug.dataset.touched = '1'; });
    source.addEventListener('input', () => {
      if (!slug.dataset.touched) slug.value = slugify(source.value);
    });
  });

  /* ── opening-hours rows ─────────────────────────────────────────────────── */
  $$('[data-hrow]').forEach((row) => {
    const closed = $('[data-hclosed]', row);
    const times = $$('input[type=time]', row);
    const sync = () => {
      row.classList.toggle('is-closed', closed.checked);
      times.forEach((t) => { t.disabled = closed.checked; });
    };
    closed.addEventListener('change', sync);
    sync();
  });

  /* ── media picker ───────────────────────────────────────────────────────── */
  const modal = $('#picker'), modalBody = $('#picker-body');
  let pickTarget = null, lastFocus = null;

  function openPicker(host) {
    pickTarget = host;
    lastFocus = document.activeElement;
    modal.hidden = false;
    modalBody.innerHTML = '<p class="hint">Loading the library…</p>';
    fetch('/admin/media/picker', { headers: { 'X-Requested-With': 'fetch' } })
      .then((r) => r.text())
      .then((html) => {
        modalBody.innerHTML = html;
        $('#picker-search', modalBody)?.focus();
        wirePicker();
      })
      .catch(() => { modalBody.innerHTML = '<p class="note note--warn">Could not load the media library.</p>'; });
  }

  function closePicker() {
    modal.hidden = true;
    pickTarget = null;
    lastFocus?.focus();
  }

  function wirePicker() {
    const search = $('#picker-search', modalBody);
    let timer = null;
    search?.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        fetch('/admin/media/picker?q=' + encodeURIComponent(search.value), { headers: { 'X-Requested-With': 'fetch' } })
          .then((r) => r.text())
          .then((html) => {
            const keep = search.value;
            modalBody.innerHTML = html;
            const again = $('#picker-search', modalBody);
            if (again) { again.value = keep; again.focus(); }
            wirePicker();
          });
      }, 260);
    });

    $$('.pitem', modalBody).forEach((item) => {
      item.addEventListener('click', () => {
        if (!pickTarget) return;
        const input = $('[data-pick-input]', pickTarget);
        const preview = $('[data-pick-preview]', pickTarget);
        const meta = $('[data-pick-meta]', pickTarget);
        input.value = item.dataset.id;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        preview.innerHTML = '<img src="' + item.dataset.thumb + '" alt="">';
        if (meta) meta.textContent = '#' + item.dataset.id + ' · ' + (item.dataset.alt || 'no alt text');
        closePicker();
      });
    });
  }

  $$('[data-pick]').forEach((host) => {
    $('[data-pick-open]', host)?.addEventListener('click', () => openPicker(host));
    $('[data-pick-clear]', host)?.addEventListener('click', () => {
      const input = $('[data-pick-input]', host);
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      $('[data-pick-preview]', host).textContent = 'No image';
      const meta = $('[data-pick-meta]', host);
      if (meta) meta.textContent = 'Nothing selected';
    });
  });
  $$('[data-picker-close]').forEach((b) => b.addEventListener('click', closePicker));
  modal?.addEventListener('click', (event) => { if (event.target === modal) closePicker(); });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      if (modal && !modal.hidden) closePicker();
      else closeSide();
    }
  });

  /* ── drag reorder for any table with data-reorder ───────────────────────── */
  $$('[data-reorder]').forEach((table) => {
    const url = table.dataset.reorder;
    const body = $('tbody', table) || table;
    let dragged = null;

    const rows = () => $$('[data-id]', body);
    const persist = () => {
      const order = rows().map((r) => r.dataset.id);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify({ order, ids: order }),
      })
        .then((r) => r.json())
        .then((data) => { if (data.ok) toast('Order saved.'); else toast('Could not save the order.', true); })
        .catch(() => toast('Could not save the order.', true));
    };

    rows().forEach((row) => {
      const handle = $('.drag', row);
      if (!handle) return;
      handle.setAttribute('draggable', 'true');
      handle.addEventListener('dragstart', (event) => {
        dragged = row;
        row.classList.add('is-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', row.dataset.id);
      });
      handle.addEventListener('dragend', () => {
        row.classList.remove('is-dragging');
        rows().forEach((r) => r.classList.remove('is-over'));
        dragged = null;
        persist();
      });
      row.addEventListener('dragover', (event) => {
        if (!dragged || dragged === row) return;
        event.preventDefault();
        row.classList.add('is-over');
        const box = row.getBoundingClientRect();
        const after = (event.clientY - box.top) > box.height / 2;
        row.parentNode.insertBefore(dragged, after ? row.nextSibling : row);
      });
      row.addEventListener('dragleave', () => row.classList.remove('is-over'));

      // keyboard equivalent, because drag-and-drop alone is not accessible
      handle.setAttribute('tabindex', '0');
      handle.addEventListener('keydown', (event) => {
        const list = rows();
        const at = list.indexOf(row);
        if (event.key === 'ArrowUp' && at > 0) {
          event.preventDefault();
          row.parentNode.insertBefore(row, list[at - 1]);
          handle.focus(); persist();
        } else if (event.key === 'ArrowDown' && at < list.length - 1) {
          event.preventDefault();
          row.parentNode.insertBefore(list[at + 1], row);
          handle.focus(); persist();
        }
      });
    });
  });

  /* ── select-all + bulk bar on list tables ───────────────────────────────── */
  $$('[data-bulk]').forEach((form) => {
    const all = $('[data-bulk-all]', form);
    const boxes = $$('[data-bulk-item]', form);
    const bar = $('[data-bulk-bar]', form);
    const count = $('[data-bulk-count]', form);
    const sync = () => {
      const on = boxes.filter((b) => b.checked).length;
      if (bar) bar.hidden = on === 0;
      if (count) count.textContent = on + (on === 1 ? ' selected' : ' selected');
      if (all) all.checked = on === boxes.length && on > 0;
    };
    all?.addEventListener('change', () => { boxes.forEach((b) => { b.checked = all.checked; }); sync(); });
    boxes.forEach((b) => b.addEventListener('change', sync));
    sync();
  });

  /* ── auto-submitting filter forms ───────────────────────────────────────── */
  $$('form[data-autofilter] select, form[data-autofilter] input[type=date]').forEach((el) => {
    el.addEventListener('change', () => el.form.submit());
  });

  /* ── inline toggles (publish switches in list rows) ─────────────────────── */
  $$('[data-toggle-url]').forEach((box) => {
    box.addEventListener('change', () => {
      fetch(box.dataset.toggleUrl, { method: 'POST', headers: { 'X-CSRF-Token': csrf() } })
        .then((r) => r.json())
        .then((data) => {
          if (!data.ok) throw new Error();
          const row = box.closest('tr, .sitem');
          row?.classList.toggle('is-draft', !data.on);
          toast(data.on ? 'Published.' : 'Hidden from the site.');
        })
        .catch(() => { box.checked = !box.checked; toast('Could not change that.', true); });
    });
  });

  /* ── section type chooser filter ────────────────────────────────────────── */
  const typeFilter = $('#type-filter');
  typeFilter?.addEventListener('input', () => {
    const needle = typeFilter.value.toLowerCase();
    $$('.typecard').forEach((card) => {
      card.hidden = needle && !card.textContent.toLowerCase().includes(needle);
    });
  });

  /* ── media library upload ───────────────────────────────────────────────── */
  const drop = $('#drop');
  if (drop) {
    const input = $('#drop-input');
    const stop = (event) => { event.preventDefault(); event.stopPropagation(); };
    ['dragenter', 'dragover'].forEach((name) => drop.addEventListener(name, (e) => { stop(e); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((name) => drop.addEventListener(name, (e) => { stop(e); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (event) => { if (event.dataTransfer.files.length) send(event.dataTransfer.files); });
    input?.addEventListener('change', () => { if (input.files.length) send(input.files); });

    function send(files) {
      const status = $('#drop-status');
      let done = 0, failed = 0;
      const total = files.length;
      const tick = () => {
        if (status) status.textContent = `Uploading ${done + failed} of ${total}…`;
        if (done + failed === total) {
          if (failed) toast(`${failed} file${failed === 1 ? '' : 's'} could not be uploaded.`, true);
          window.location.reload();
        }
      };
      Array.from(files).forEach((file) => {
        const body = new FormData();
        body.append('files', file);
        body.append('csrf_token', csrf());
        fetch('/admin/media/upload', { method: 'POST', body, headers: { 'X-Requested-With': 'fetch' } })
          .then((r) => r.json())
          .then((data) => { data.ok ? done++ : failed++; tick(); })
          .catch(() => { failed++; tick(); });
      });
      tick();
    }
  }

  /* ── EMI quote preview inside the admin application form ────────────────── */
  const emiForm = $('[data-emi-quote]');
  if (emiForm) {
    const out = $('[data-emi-out]', emiForm);
    const recalc = () => {
      const amount = parseFloat($('[name=treatment_amount]', emiForm)?.value || '0');
      const planEl = $('[name=plan_id]', emiForm);
      const option = planEl?.selectedOptions[0];
      if (!amount || !option || !option.dataset.tenure) { out.textContent = ''; return; }
      const tenure = parseInt(option.dataset.tenure, 10);
      const rate = parseFloat(option.dataset.rate || '0');
      const fee = amount * parseFloat(option.dataset.fee || '0') / 100;
      const down = amount * parseFloat(option.dataset.down || '0') / 100;
      const financed = amount - down;
      const monthly = rate > 0
        ? (() => { const r = rate / 1200; const f = Math.pow(1 + r, tenure); return financed * r * f / (f - 1); })()
        : financed / tenure;
      out.textContent = `₹${Math.round(monthly).toLocaleString('en-IN')} × ${tenure} months`
        + (down ? ` · ₹${Math.round(down).toLocaleString('en-IN')} down` : '')
        + (fee ? ` · ₹${Math.round(fee).toLocaleString('en-IN')} fee` : '');
    };
    emiForm.addEventListener('input', recalc);
    emiForm.addEventListener('change', recalc);
    recalc();
  }

  /* ── animate dashboard bars once laid out ───────────────────────────────── */
  requestAnimationFrame(() => $$('.bar__f').forEach((f) => { f.style.width = f.style.width; }));
})();
