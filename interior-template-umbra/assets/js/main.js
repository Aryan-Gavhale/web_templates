/* =========================================================
   UMBRA — interaction layer
   Vanilla JS. Scroll-linked work shares one rAF loop;
   everything else is event or observer driven.
   ========================================================= */
(function () {
  'use strict';

  const qs = (s, c) => (c || document).querySelector(s);
  const qsa = (s, c) => Array.from((c || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp = (a, b, n) => a + (b - a) * n;

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // The boot screen and the hero reveal both assume a reload starts at the top.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  let vh = innerHeight;
  let vw = innerWidth;

  /* ---------------- TEXT: CHARACTER SPLIT ---------------- */
  function splitChars(el) {
    if (!el.dataset.o) el.dataset.o = el.textContent.trim();
    const text = el.dataset.o;
    const words = text.split(/\s+/).filter(Boolean);

    // Per-character spans read as "D e s i g n e d" to a screen reader, so the
    // split markup is hidden and the original string is exposed as the label.
    const visual = document.createElement('span');
    visual.setAttribute('aria-hidden', 'true');
    let n = 0;

    words.forEach((word, wi) => {
      const wrap = document.createElement('span');
      wrap.className = 'wd';
      Array.from(word).forEach((ch) => {
        const s = document.createElement('span');
        s.className = 'ch';
        // cap the stagger so long headings don't crawl in
        s.style.setProperty('--c', Math.min(n++, 46));
        s.textContent = ch;
        wrap.appendChild(s);
      });
      visual.appendChild(wrap);
      if (wi < words.length - 1) visual.appendChild(document.createTextNode(' '));
    });

    el.innerHTML = '';
    el.setAttribute('aria-label', text);
    el.appendChild(visual);
    el.classList.add('ready');
  }

  function buildText() {
    qsa('[data-chars]').forEach((el) => {
      const lit = el.classList.contains('lit');
      el.classList.remove('lit');
      splitChars(el);
      if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay + 'ms');
      if (lit) requestAnimationFrame(() => el.classList.add('lit'));
    });
  }

  /* ---------------- REVEAL ON ENTER ---------------- */
  function watchReveals() {
    const items = qsa('[data-fade], [data-chars]');
    items.forEach((el) => {
      if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay + 'ms');
    });

    if (REDUCED) { items.forEach((el) => el.classList.add('lit')); return; }

    // The hero is above the fold; play it on load instead of on intersection.
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
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    later.forEach((el) => io.observe(el));
  }

  /* ---------------- BOOT SCREEN ---------------- */
  function boot(done) {
    const el = qs('[data-boot]');
    if (!el) { done(); return; }
    document.body.classList.add('lock');
    requestAnimationFrame(() => el.classList.add('in'));

    const pct = qs('[data-boot-pct]', el);
    const bar = qs('.boot__rule i', el);
    const span = REDUCED ? 260 : 1800;
    const t0 = performance.now();

    (function step(now) {
      const t = clamp((now - t0) / span, 0, 1);
      const e = 1 - Math.pow(1 - t, 3);
      const v = Math.round(e * 100);
      pct.textContent = String(v).padStart(3, '0');
      bar.style.width = e * 100 + '%';
      if (t < 1) { requestAnimationFrame(step); return; }

      el.classList.add('up');
      document.body.classList.remove('lock');
      done();
      setTimeout(() => el.classList.add('gone'), 1100);
    })(t0);
  }

  /* ---------------- CROSSHAIR CURSOR ---------------- */
  const cur = { x: vw / 2, y: vh / 2, rx: vw / 2, ry: vh / 2 };

  function crosshair() {
    const el = qs('.xhair');
    if (!el || !FINE) return;
    const v = qs('.xhair__v', el);
    const h = qs('.xhair__h', el);
    const r = qs('.xhair__ring', el);

    addEventListener('mousemove', (e) => {
      cur.x = e.clientX; cur.y = e.clientY;
      el.classList.add('on');
    }, { passive: true });
    document.addEventListener('mouseleave', () => el.classList.remove('on'));

    qsa('[data-x], button, a, input, select, textarea').forEach((n) => {
      n.addEventListener('mouseenter', () => el.classList.add('hot'));
      n.addEventListener('mouseleave', () => el.classList.remove('hot'));
    });

    (function tick() {
      cur.rx = lerp(cur.rx, cur.x, 0.22);
      cur.ry = lerp(cur.ry, cur.y, 0.22);
      const a = 'translate(' + cur.x + 'px,' + cur.y + 'px)';
      const b = 'translate(' + cur.rx + 'px,' + cur.ry + 'px)';
      v.style.transform = a + ' translate(-50%,-50%)';
      h.style.transform = a + ' translate(-50%,-50%)';
      r.style.transform = b + ' translate(-50%,-50%)';
      requestAnimationFrame(tick);
    })();
  }

  /* ---------------- HEADER, DRAWER, SECTION READOUT ---------------- */
  const SECTIONS = [
    ['intro', '01 / Intro'], ['services', '02 / Services'], ['work', '03 / Work'],
    ['anatomy', '04 / Anatomy'], ['studio', '05 / Studio'], ['faq', '06 / Questions'],
    ['contact', '07 / Contact']
  ];
  let marks = [];
  const head = qs('[data-head]');
  const whereEl = qs('[data-where]');
  const railLabel = qs('[data-rail-label]');
  const railBar = qs('[data-rail-bar]');
  const railPct = qs('[data-rail-pct]');
  let lastY = 0;

  function measure() {
    marks = SECTIONS
      .map(([id, label]) => {
        const node = document.getElementById(id);
        return node ? { top: node.offsetTop, label: label } : null;
      })
      .filter(Boolean);
  }

  function header() {
    const drawer = qs('[data-drawer]');
    const open = () => { drawer.classList.add('open'); document.body.classList.add('lock'); };
    const shut = () => { drawer.classList.remove('open'); document.body.classList.remove('lock'); };

    qs('[data-open]').addEventListener('click', open);
    qsa('[data-close]').forEach((b) => b.addEventListener('click', shut));
    qsa('[data-link]').forEach((a) => a.addEventListener('click', () => setTimeout(shut, 140)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });

    addEventListener('scroll', () => {
      const y = scrollY;
      head.classList.toggle('solid', y > 40);
      head.classList.toggle('away', y > lastY && y > 420 && !drawer.classList.contains('open'));
      lastY = y;
    }, { passive: true });
  }

  function updateReadout() {
    const y = scrollY + vh * 0.38;
    let label = marks.length ? marks[0].label : '';
    for (let i = 0; i < marks.length; i++) if (y >= marks[i].top) label = marks[i].label;
    if (whereEl && whereEl.textContent !== label) whereEl.textContent = label;
    if (railLabel) {
      const short = label.split('/ ')[1] || label;
      if (railLabel.textContent !== short) railLabel.textContent = short;
    }

    const max = document.documentElement.scrollHeight - vh;
    const p = clamp(scrollY / (max || 1), 0, 1);
    if (railBar) railBar.style.height = p * 100 + '%';
    if (railPct) railPct.textContent = String(Math.round(p * 100)).padStart(2, '0');
  }

  /* ---------------- HERO SLIDESHOW ---------------- */
  function slideshow() {
    const slides = qsa('[data-slide]');
    const bars = qsa('[data-slide-bars] button');
    const idx = qs('[data-slide-i]');
    const cap = qs('[data-slide-cap]');
    if (slides.length < 2) return;

    let i = 0;
    let timer;
    const HOLD = 6000;

    const paint = () => {
      slides.forEach((s, n) => s.classList.toggle('is-on', n === i));
      bars.forEach((b, n) => {
        b.classList.remove('run', 'done');
        if (n < i) b.classList.add('done');
      });
      // force a reflow so the progress animation restarts cleanly
      void bars[i].offsetWidth;
      if (!REDUCED) bars[i].classList.add('run');
      idx.textContent = String(i + 1).padStart(2, '0');
      cap.textContent = slides[i].dataset.cap || '';
    };

    const go = (n) => { i = (n + slides.length) % slides.length; paint(); run(); };
    function run() { clearInterval(timer); if (!REDUCED) timer = setInterval(() => go(i + 1), HOLD); }

    bars.forEach((b, n) => b.addEventListener('click', () => go(n)));
    paint();
    run();
  }

  /* ---------------- ACCORDIONS ---------------- */
  function accordions() {
    qsa('[data-acc]').forEach((group) => {
      const items = qsa('[data-acc-item]', group);
      items.forEach((item) => {
        qs('[data-acc-btn]', item).addEventListener('click', () => {
          const wasOpen = item.classList.contains('is-open');
          items.forEach((o) => o.classList.remove('is-open'));
          if (!wasOpen) item.classList.add('is-open');
        });
      });
    });
  }

  /* ---------------- STACKED CARDS ---------------- */
  const cards = qsa('[data-card]');

  function updateStack() {
    if (vw <= 860 || !cards.length) return;
    for (let i = 0; i < cards.length - 1; i++) {
      const nextTop = cards[i + 1].getBoundingClientRect().top;
      const p = clamp(1 - nextTop / vh, 0, 1);
      cards[i].style.setProperty('--dim-v', (p * 0.6).toFixed(3));
    }
  }

  /* ---------------- ANATOMY HOTSPOTS ---------------- */
  function hotspots() {
    const pins = qsa('[data-pin]');
    const facts = qsa('[data-fact]');
    const jumps = qsa('[data-jump]');
    if (!pins.length) return;

    const pick = (n) => {
      pins.forEach((p) => p.classList.toggle('is-on', p.dataset.pin === String(n)));
      facts.forEach((f) => f.classList.toggle('is-on', f.dataset.fact === String(n)));
      jumps.forEach((j) => j.classList.toggle('is-on', j.dataset.jump === String(n)));
    };

    pins.forEach((p) => {
      const n = p.dataset.pin;
      p.addEventListener('click', () => pick(n));
      if (FINE) p.addEventListener('mouseenter', () => pick(n));
    });

    jumps.forEach((j) => {
      const n = j.dataset.jump;
      j.addEventListener('click', () => pick(n));
      if (FINE) j.addEventListener('mouseenter', () => pick(n));
    });
  }

  /* ---------------- COUNTERS ---------------- */
  function counters() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseInt(el.dataset.to, 10);
        const t0 = performance.now();
        (function step(now) {
          const t = clamp((now - t0) / 1600, 0, 1);
          el.textContent = Math.round((1 - Math.pow(1 - t, 4)) * target);
          if (t < 1) requestAnimationFrame(step);
        })(t0);
        io.unobserve(el);
      });
    }, { threshold: 0.4 });
    qsa('[data-to]').forEach((el) => io.observe(el));
  }

  /* ---------------- MAGNETIC ---------------- */
  function magnets() {
    if (!FINE) return;
    qsa('[data-mag]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform .25s cubic-bezier(.4,0,.2,1)';
        el.style.transform = 'translate(' + dx * 0.24 + 'px,' + dy * 0.3 + 'px)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)';
        el.style.transform = '';
      });
    });
  }

  /* ---------------- CONTACT FORM ---------------- */
  function contactForm() {
    const form = qs('[data-form]');
    if (!form) return;
    const note = qs('[data-form-note]', form);
    const original = note.textContent;

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;

      qsa('input, select, textarea', form).forEach((input) => {
        const field = input.closest('.field');
        const empty = !input.value.trim();
        const badMail = input.type === 'email' && input.value && !/^\S+@\S+\.\S+$/.test(input.value);
        const bad = (input.required && empty) || badMail;
        field.classList.toggle('bad', bad);
        if (bad) ok = false;
      });

      if (!ok) {
        note.textContent = 'Check the highlighted fields.';
        return;
      }

      // Demo only — wire this up to a real endpoint before launch.
      form.classList.add('sent');
      note.textContent = 'Thank you — we will reply within two working days.';
      form.reset();
      setTimeout(() => {
        form.classList.remove('sent');
        note.textContent = original;
      }, 6000);
    });

    qsa('input, select, textarea', form).forEach((input) => {
      input.addEventListener('input', () => input.closest('.field').classList.remove('bad'));
      input.addEventListener('change', () => input.closest('.field').classList.remove('bad'));
    });
  }

  /* ---------------- CLOCK ---------------- */
  function clock() {
    const el = qs('[data-clock]');
    if (!el) return;
    const tick = () => {
      el.textContent = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hour12: false
      }).format(new Date()) + ' LDN';
    };
    tick();
    setInterval(tick, 20000);
  }

  /* ---------------- LOOP + BOOTSTRAP ---------------- */
  function loop() {
    updateReadout();
    updateStack();
    requestAnimationFrame(loop);
  }

  let rt;
  function onResize() {
    clearTimeout(rt);
    rt = setTimeout(() => {
      vh = innerHeight; vw = innerWidth;
      measure();
      buildText();
    }, 200);
  }

  function start() {
    crosshair();
    header();
    slideshow();
    accordions();
    hotspots();
    counters();
    magnets();
    contactForm();
    clock();
    measure();

    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]).then(() => {
      buildText();
      measure();
      boot(watchReveals);
    });

    addEventListener('resize', onResize);
    loop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
