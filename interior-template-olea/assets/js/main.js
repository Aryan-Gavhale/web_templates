/* =========================================================
   OLEA — interaction layer
   Vanilla JS, no dependencies. Observers drive the discrete
   animations; only the drag rail listens to pointer moves.
   ========================================================= */
(function () {
  'use strict';

  const qs = (s, c) => (c || document).querySelector(s);
  const qsa = (s, c) => Array.from((c || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // The loader assumes a reload starts at the top of the page.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------- LOADER ---------------- */
  function boot(done) {
    const el = qs('[data-boot]');
    if (!el) { done(); return; }

    document.body.classList.add('lock');
    requestAnimationFrame(() => el.classList.add('in'));

    setTimeout(() => {
      el.classList.add('up');
      document.body.classList.remove('lock');
      done();
      setTimeout(() => el.classList.add('gone'), 1100);
    }, REDUCED ? 260 : 1750);
  }

  /* ---------------- REVEALS ---------------- */
  function reveals() {
    const items = qsa('[data-rise], [data-mask]');
    items.forEach((el) => {
      if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay + 'ms');
    });

    if (REDUCED) { items.forEach((el) => el.classList.add('lit')); return; }

    // Above-the-fold content plays on load rather than on intersection.
    const later = items.filter((el) => {
      if (!el.closest('.hero')) return true;
      el.classList.add('lit');
      return false;
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('lit');
        io.unobserve(e.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -8% 0px' });

    later.forEach((el) => io.observe(el));
  }

  /* ---------------- HEADER + SHEET ---------------- */
  function header() {
    const nav = qs('[data-nav]');
    const sheet = qs('[data-sheet]');
    // Below this width the process section pins itself under the bar, so the
    // bar has to stay put or it leaves a gap behind it.
    const wide = matchMedia('(min-width: 1081px)');
    let lastY = 0;

    const open = () => { sheet.classList.add('open'); document.body.classList.add('lock'); };
    const shut = () => { sheet.classList.remove('open'); document.body.classList.remove('lock'); };

    qs('[data-sheet-open]').addEventListener('click', open);
    qs('[data-sheet-close]').addEventListener('click', shut);
    qsa('[data-sheet-link]').forEach((a) => a.addEventListener('click', () => setTimeout(shut, 160)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });

    addEventListener('scroll', () => {
      const y = scrollY;
      nav.classList.toggle('stuck', y > 24);
      nav.classList.toggle('away', wide.matches && y > lastY && y > 400 && !sheet.classList.contains('open'));
      lastY = y;
    }, { passive: true });
  }

  /* ---------------- HEADLINE WORD ROLLER ---------------- */
  function roller() {
    const set = qs('[data-roll-set]');
    if (!set || REDUCED) return;

    const words = qsa('em', set);
    if (words.length < 2) return;

    let i = 0;
    setInterval(() => {
      const out = words[i];
      i = (i + 1) % words.length;
      const next = words[i];

      out.classList.remove('is-on');
      out.classList.add('is-out');

      next.classList.remove('is-out');
      void next.offsetWidth; // land on the start state before transitioning in
      next.classList.add('is-on');

      setTimeout(() => out.classList.remove('is-out'), 900);
    }, 2600);
  }

  /* ---------------- ROOM TABS ---------------- */
  function tabs() {
    const bar = qs('[data-tabs]');
    if (!bar) return;

    const btns = qsa('[data-tab]', bar);
    const ink = qs('[data-tab-ink]', bar);
    const pics = qsa('[data-room]');
    const panels = qsa('[data-panel]');

    const moveInk = () => {
      const on = btns.find((b) => b.getAttribute('aria-selected') === 'true') || btns[0];
      ink.style.width = on.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + on.offsetLeft + 'px)';
    };

    const pick = (n) => {
      btns.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === String(n))));
      pics.forEach((p) => p.classList.toggle('is-on', p.dataset.room === String(n)));
      panels.forEach((p) => p.classList.toggle('is-on', p.dataset.panel === String(n)));
      moveInk();
    };

    btns.forEach((b) => b.addEventListener('click', () => pick(b.dataset.tab)));

    bar.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const at = btns.findIndex((b) => b.getAttribute('aria-selected') === 'true');
      const to = (at + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length;
      pick(to);
      btns[to].focus();
    });

    // The ink is sized from layout, so it has to wait for webfonts.
    moveInk();
    addEventListener('resize', moveInk);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(moveInk);
  }

  /* ---------------- PROCESS STEPS ---------------- */
  function flow() {
    const steps = qsa('[data-step]');
    const pics = qsa('[data-flow]');
    const num = qs('[data-flow-n]');
    const label = qs('[data-flow-label]');
    if (!steps.length) return;

    const show = (n) => {
      steps.forEach((s) => s.classList.toggle('on', s.dataset.step === String(n)));
      pics.forEach((p) => p.classList.toggle('is-on', p.dataset.flow === String(n)));
      if (num) num.textContent = String(Number(n) + 1).padStart(2, '0');
      if (label) label.textContent = steps[Number(n)].querySelector('h3').textContent;
    };

    show(0);

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) show(e.target.dataset.step); });
    }, { rootMargin: '-45% 0px -45% 0px', threshold: 0 });

    steps.forEach((s) => io.observe(s));
  }

  /* ---------------- DRAG RAIL ---------------- */
  function rail() {
    const el = qs('[data-rail]');
    if (!el || !FINE) return;

    let down = false, startX = 0, startLeft = 0, moved = 0;

    el.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = 0;
      startX = e.clientX;
      startLeft = el.scrollLeft;
      el.classList.add('drag');
      el.setPointerCapture(e.pointerId);
    });

    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.abs(dx);
      el.scrollLeft = startLeft - dx;
    });

    const release = (e) => {
      if (!down) return;
      down = false;
      el.classList.remove('drag');
      if (e.pointerId !== undefined && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    };
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);

    // Suppress the click that follows a real drag.
    el.addEventListener('click', (e) => { if (moved > 6) { e.preventDefault(); e.stopPropagation(); } }, true);
  }

  /* ---------------- CURSOR CUE ---------------- */
  function cue() {
    const el = qs('[data-cue-el]');
    if (!el || !FINE) return;

    const targets = qsa('[data-cue]');
    if (!targets.length) return;

    let on = false;

    const place = (e) => {
      el.style.setProperty('--x', e.clientX + 'px');
      el.style.setProperty('--y', e.clientY + 'px');
    };

    addEventListener('mousemove', (e) => { if (on) place(e); }, { passive: true });

    targets.forEach((t) => {
      t.addEventListener('mouseenter', (e) => {
        el.textContent = t.dataset.cue || 'Drag';
        place(e);
        on = true;
        el.classList.add('on');
      });
      t.addEventListener('mouseleave', () => { on = false; el.classList.remove('on'); });
    });
  }

  /* ---------------- COUNTERS ---------------- */
  function counters() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseInt(el.dataset.count, 10);
        const t0 = performance.now();
        (function step(now) {
          const t = clamp((now - t0) / 1500, 0, 1);
          el.textContent = Math.round((1 - Math.pow(1 - t, 4)) * target);
          if (t < 1) requestAnimationFrame(step);
        })(t0);
        io.unobserve(el);
      });
    }, { threshold: 0.45 });

    qsa('[data-count]').forEach((el) => io.observe(el));
  }

  /* ---------------- ENQUIRY FORM ---------------- */
  function form() {
    const f = qs('[data-form]');
    if (!f) return;

    const note = qs('[data-form-note]', f);
    const original = note.textContent;

    f.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;

      qsa('input, select, textarea', f).forEach((input) => {
        const row = input.closest('.ask__row');
        const empty = !input.value.trim();
        const badMail = input.type === 'email' && input.value && !/^\S+@\S+\.\S+$/.test(input.value);
        const bad = (input.required && empty) || badMail;
        row.classList.toggle('bad', bad);
        if (bad) ok = false;
      });

      if (!ok) { note.textContent = 'Please fill in the highlighted fields.'; return; }

      // Demo only — point this at a real endpoint before launch.
      note.textContent = 'Thank you — we will be in touch within one working day.';
      f.reset();
      setTimeout(() => { note.textContent = original; }, 6000);
    });

    qsa('input, select, textarea', f).forEach((input) => {
      const clear = () => input.closest('.ask__row').classList.remove('bad');
      input.addEventListener('input', clear);
      input.addEventListener('change', clear);
    });
  }

  /* ---------------- BOOTSTRAP ---------------- */
  function start() {
    header();
    roller();
    tabs();
    flow();
    rail();
    cue();
    counters();
    form();

    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(() => {
      boot(reveals);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
