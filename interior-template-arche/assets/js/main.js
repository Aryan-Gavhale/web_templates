/* =========================================================
   ARCHÉ — motion layer
   One rAF loop drives every scroll-linked effect.
   ========================================================= */
(function () {
  'use strict';

  const qs  = (s, c) => (c || document).querySelector(s);
  const qsa = (s, c) => Array.from((c || document).querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const lerp  = (a, b, n) => a + (b - a) * n;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE    = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let vh = window.innerHeight;
  let vw = window.innerWidth;
  let compact = vw <= 1180;

  /* ------------------------------------------------------
     TEXT SPLITTING
     Tokenises a heading into words (keeping inline <em> and
     <br>), then regroups the words into masked lines.
  ------------------------------------------------------ */
  function tokenize(node, tag) {
    let out = [];
    node.childNodes.forEach((n) => {
      if (n.nodeType === 3) {
        n.textContent.split(/\s+/).forEach((t) => { if (t) out.push({ t: t, tag: tag }); });
      } else if (n.nodeName === 'BR') {
        out.push({ br: true });
      } else {
        out = out.concat(tokenize(n, n.nodeName.toLowerCase()));
      }
    });
    return out;
  }

  function buildWords(el, cls) {
    if (!el.dataset.orig) el.dataset.orig = el.innerHTML;
    else el.innerHTML = el.dataset.orig;

    const tokens = tokenize(el, null);
    const frag = document.createDocumentFragment();

    tokens.forEach((tk) => {
      if (tk.br) { frag.appendChild(document.createElement('br')); return; }
      const w = document.createElement('span');
      w.className = cls;
      w.style.display = 'inline-block';
      if (tk.tag) {
        const inner = document.createElement(tk.tag);
        inner.textContent = tk.t;
        w.appendChild(inner);
      } else {
        w.textContent = tk.t;
      }
      frag.appendChild(w);
      frag.appendChild(document.createTextNode(' '));
    });

    el.innerHTML = '';
    el.appendChild(frag);
    return qsa('.' + cls, el);
  }

  function splitToLines(el) {
    const words = buildWords(el, 'word');
    const lines = [];
    let current = null;
    let lastTop = null;

    words.forEach((w) => {
      const top = Math.round(w.offsetTop);
      if (lastTop === null || Math.abs(top - lastTop) > 4) {
        current = [];
        lines.push(current);
        lastTop = top;
      }
      current.push(w);
    });

    const frag = document.createDocumentFragment();
    lines.forEach((group, i) => {
      const line = document.createElement('span');
      line.className = 'line';
      line.style.setProperty('--i', i);
      const inner = document.createElement('span');
      group.forEach((w) => { inner.appendChild(w); inner.appendChild(document.createTextNode(' ')); });
      line.appendChild(inner);
      frag.appendChild(line);
    });

    el.innerHTML = '';
    el.appendChild(frag);
    el.classList.add('is-ready');
  }

  const splitTargets = qsa('[data-split]');

  function runSplits() {
    splitTargets.forEach((el) => {
      const wasLit = el.classList.contains('is-lit');
      el.classList.remove('is-lit');
      splitToLines(el);
      if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay + 'ms');
      if (wasLit) requestAnimationFrame(() => el.classList.add('is-lit'));
    });
  }

  /* ------------------------------------------------------
     REVEAL OBSERVER
  ------------------------------------------------------ */
  function observeReveals() {
    const targets = qsa('[data-reveal], [data-split]');
    targets.forEach((el) => {
      if (el.dataset.delay) el.style.setProperty('--d', el.dataset.delay + 'ms');
    });

    if (REDUCED) { targets.forEach((el) => el.classList.add('is-lit')); return; }

    // Everything in the hero is above the fold by definition — play it on load
    // rather than waiting on an intersection that the bottom rail never wins.
    const deferred = targets.filter((el) => {
      if (!el.closest('.hero')) return true;
      el.classList.add('is-lit');
      return false;
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-lit');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -9% 0px' });

    deferred.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------
     PRELOADER
  ------------------------------------------------------ */
  function loaderIntro() {
    const el = qs('[data-loader]');
    if (!el) return;
    document.body.classList.add('is-locked');
    requestAnimationFrame(() => el.classList.add('is-in'));
  }

  function preloader(done) {
    const el = qs('[data-loader]');
    if (!el) { done(); return; }

    const num = qs('[data-loader-num]', el);
    const bar = qs('[data-loader-bar]', el);

    const total = REDUCED ? 300 : 1900;
    const start = performance.now();

    (function tick(now) {
      const t = clamp((now - start) / total, 0, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const pct = Math.round(eased * 100);
      num.textContent = pct < 10 ? '0' + pct : pct;
      bar.style.width = eased * 100 + '%';
      if (t < 1) { requestAnimationFrame(tick); return; }

      el.classList.add('is-out');
      document.body.classList.remove('is-locked');
      done();
      setTimeout(() => el.classList.add('is-done'), 1500);
    })(start);
  }

  /* ------------------------------------------------------
     CUSTOM CURSOR
  ------------------------------------------------------ */
  const cursor = { x: vw / 2, y: vh / 2, rx: vw / 2, ry: vh / 2, el: qs('.cursor') };

  function initCursor() {
    if (!FINE || !cursor.el) return;
    const label = qs('.cursor__label', cursor.el);
    const dot = qs('.cursor__dot', cursor.el);
    const ring = qs('.cursor__ring', cursor.el);

    window.addEventListener('mousemove', (e) => {
      cursor.x = e.clientX; cursor.y = e.clientY;
      cursor.el.classList.add('is-on');
    }, { passive: true });

    document.addEventListener('mouseleave', () => cursor.el.classList.remove('is-on'));

    qsa('[data-hover]').forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const txt = el.getAttribute('data-hover');
        if (txt) { label.textContent = txt; cursor.el.classList.add('is-view'); }
        else cursor.el.classList.add('is-hover');
      });
      el.addEventListener('mouseleave', () => cursor.el.classList.remove('is-hover', 'is-view'));
    });

    (function loop() {
      cursor.rx = lerp(cursor.rx, cursor.x, 0.19);
      cursor.ry = lerp(cursor.ry, cursor.y, 0.19);
      dot.style.transform = 'translate(' + cursor.x + 'px,' + cursor.y + 'px) translate(-50%,-50%)';
      ring.style.transform = 'translate(' + cursor.rx + 'px,' + cursor.ry + 'px) translate(-50%,-50%)';
      requestAnimationFrame(loop);
    })();
  }

  /* ------------------------------------------------------
     NAV + MENU
  ------------------------------------------------------ */
  function initNav() {
    const nav = qs('[data-nav]');
    const menu = qs('[data-menu]');
    let last = 0;

    qsa('.nav__links a span').forEach((s) => {
      const t = s.textContent;
      s.innerHTML = '';
      const a = document.createElement('i'); a.textContent = t;
      const b = document.createElement('i'); b.textContent = t;
      s.appendChild(a); s.appendChild(b);
    });

    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      nav.classList.toggle('is-solid', y > 80);
      nav.classList.toggle('is-hidden', y > last && y > 400 && !menu.classList.contains('is-open'));
      last = y;
    }, { passive: true });

    const open = () => { menu.classList.add('is-open'); document.body.classList.add('is-locked'); };
    const close = () => { menu.classList.remove('is-open'); document.body.classList.remove('is-locked'); };

    qs('[data-menu-open]').addEventListener('click', open);
    qs('[data-menu-close]').addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    const preview = qs('[data-menu-preview]');
    qsa('[data-menu-link]').forEach((a) => {
      a.addEventListener('mouseenter', () => {
        const src = a.dataset.img;
        if (!preview || preview.src === src) return;
        preview.classList.add('is-swap');
        setTimeout(() => { preview.src = src; preview.classList.remove('is-swap'); }, 260);
      });
      a.addEventListener('click', () => setTimeout(close, 120));
    });
  }

  /* ------------------------------------------------------
     SCROLL-LIT MANIFESTO
  ------------------------------------------------------ */
  const litBlocks = [];

  function initLit() {
    qsa('[data-lit]').forEach((el) => {
      const words = buildWords(el, 'w');
      litBlocks.push({ el: el, words: words, last: -1 });
    });
  }

  function updateLit() {
    litBlocks.forEach((b) => {
      const r = b.el.getBoundingClientRect();
      const p = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.42), 0, 1);
      const idx = Math.round(p * b.words.length * 1.12);
      if (idx === b.last) return;
      for (let i = 0; i < b.words.length; i++) b.words[i].classList.toggle('on', i < idx);
      b.last = idx;
    });
  }

  /* ------------------------------------------------------
     PARALLAX
  ------------------------------------------------------ */
  const parallaxItems = qsa('[data-parallax]').map((el) => ({
    el: el,
    amt: parseFloat(el.dataset.parallax) || 0.1,
    scale: parseFloat(el.dataset.parallaxScale) || 1,
    cur: 0
  }));

  function updateParallax() {
    if (compact) return;
    parallaxItems.forEach((p) => {
      const r = p.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) return;
      const centre = r.top + r.height / 2 - vh / 2;
      p.cur = lerp(p.cur, -centre * p.amt, 0.12);
      p.el.style.transform =
        'translate3d(0,' + p.cur.toFixed(2) + 'px,0) scale(' + p.scale + ')';
    });
  }

  /* ------------------------------------------------------
     PINNED HORIZONTAL WORK GALLERY
  ------------------------------------------------------ */
  const works = { sec: qs('[data-works]'), track: qs('[data-works-track]'), bar: qs('[data-works-bar]'), dist: 0, x: 0, tx: 0, on: false };

  function layoutWorks() {
    if (!works.sec) return;
    works.on = vw > 760;
    if (!works.on) {
      works.sec.style.height = '';
      works.track.style.transform = '';
      return;
    }
    works.dist = Math.max(works.track.scrollWidth - vw, 0);
    works.sec.style.height = (vh + works.dist) + 'px';
  }

  function updateWorks() {
    if (!works.on || !works.sec) return;
    const r = works.sec.getBoundingClientRect();
    const span = works.sec.offsetHeight - vh;
    const p = clamp(-r.top / (span || 1), 0, 1);
    works.tx = -p * works.dist;
    works.x = lerp(works.x, works.tx, 0.11);
    works.track.style.transform = 'translate3d(' + works.x.toFixed(2) + 'px,0,0)';
    if (works.bar) works.bar.style.width = (p * 100).toFixed(2) + '%';
  }

  /* ------------------------------------------------------
     COUNTERS
  ------------------------------------------------------ */
  function initCounters() {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const target = parseInt(el.dataset.count, 10);
        const dur = 1700;
        const t0 = performance.now();
        (function tick(now) {
          const t = clamp((now - t0) / dur, 0, 1);
          const eased = 1 - Math.pow(1 - t, 4);
          el.textContent = Math.round(eased * target);
          if (t < 1) requestAnimationFrame(tick);
        })(t0);
        io.unobserve(el);
      });
    }, { threshold: 0.5 });
    qsa('[data-count]').forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------
     PROCESS STEPS
  ------------------------------------------------------ */
  function initSteps() {
    const steps = qsa('[data-step]');
    const num = qs('[data-step-num]');
    if (!steps.length) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        steps.forEach((s) => s.classList.remove('is-on'));
        e.target.classList.add('is-on');
        const i = steps.indexOf(e.target) + 1;
        if (num) num.textContent = i < 10 ? '0' + i : i;
      });
    }, { rootMargin: '-38% 0px -46% 0px' });

    steps.forEach((s) => io.observe(s));
    steps[0].classList.add('is-on');
  }

  /* ------------------------------------------------------
     MATERIAL SWATCHES
  ------------------------------------------------------ */
  function initSwatches() {
    const items = qsa('[data-swatch]');
    const img = qs('[data-swatch-img]');
    const name = qs('[data-swatch-name]');
    const origin = qs('[data-swatch-origin]');
    const desc = qs('[data-swatch-desc]');
    if (!items.length || !img) return;

    let active = 0;
    const select = (i) => {
      if (i === active) return;
      active = i;
      const el = items[i];
      items.forEach((s) => s.classList.remove('is-active'));
      el.classList.add('is-active');
      img.classList.add('is-swap');
      setTimeout(() => {
        img.src = el.dataset.img;
        name.textContent = el.dataset.name;
        origin.textContent = el.dataset.origin;
        desc.textContent = el.dataset.desc;
        img.classList.remove('is-swap');
      }, 280);
    };

    items.forEach((el, i) => {
      el.addEventListener('mouseenter', () => select(i));
      el.addEventListener('click', () => select(i));
    });
  }

  /* ------------------------------------------------------
     TESTIMONIALS
  ------------------------------------------------------ */
  function initVoices() {
    const slides = qsa('[data-voice]');
    const dots = qsa('[data-voice-dots] button');
    if (slides.length < 2) return;

    let i = 0;
    let timer;
    const go = (n) => {
      slides[i].classList.remove('is-active');
      dots[i].classList.remove('is-active');
      i = (n + slides.length) % slides.length;
      slides[i].classList.add('is-active');
      dots[i].classList.add('is-active');
    };
    const play = () => { clearInterval(timer); timer = setInterval(() => go(i + 1), 6200); };

    dots.forEach((d, n) => d.addEventListener('click', () => { go(n); play(); }));
    play();
  }

  /* ------------------------------------------------------
     PRESS HOVER IMAGE
  ------------------------------------------------------ */
  const press = { box: qs('[data-press-float]'), img: qs('[data-press-img]'), x: 0, y: 0, s: 0.86, on: false };

  function initPress() {
    if (!press.box || !FINE) return;
    qsa('[data-press-row]').forEach((row) => {
      row.addEventListener('mouseenter', () => {
        press.img.src = row.dataset.img;
        press.box.classList.add('is-on');
        press.on = true;
      });
      row.addEventListener('mouseleave', () => {
        press.box.classList.remove('is-on');
        press.on = false;
      });
    });
  }

  function updatePress() {
    if (!press.box) return;
    press.x = lerp(press.x, cursor.x + 160, 0.09);
    press.y = lerp(press.y, cursor.y, 0.09);
    press.s = lerp(press.s, press.on ? 1 : 0.86, 0.12);
    press.box.style.transform =
      'translate(' + press.x.toFixed(1) + 'px,' + press.y.toFixed(1) + 'px) translate(-50%,-50%) scale(' + press.s.toFixed(3) + ')';
  }

  /* ------------------------------------------------------
     MAGNETIC BUTTONS
  ------------------------------------------------------ */
  function initMagnetic() {
    if (!FINE) return;
    qsa('[data-magnetic]').forEach((el) => {
      const strength = 0.32;
      el.style.transition = 'transform .6s cubic-bezier(.19,1,.22,1)';
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform .25s cubic-bezier(.4,0,.2,1)';
        el.style.transform = 'translate(' + dx * strength + 'px,' + dy * strength + 'px)';
      });
      el.addEventListener('mouseleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.19,1,.22,1)';
        el.style.transform = 'translate(0,0)';
      });
    });
  }

  /* ------------------------------------------------------
     CLOCK + PROGRESS
  ------------------------------------------------------ */
  function initClock() {
    const el = qs('[data-clock]');
    if (!el) return;
    const tick = () => {
      el.textContent = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date());
    };
    tick();
    setInterval(tick, 1000);
  }

  const progressBar = qs('[data-progress]');

  function updateProgress() {
    if (!progressBar) return;
    const max = document.documentElement.scrollHeight - vh;
    progressBar.style.width = clamp(window.scrollY / (max || 1), 0, 1) * 100 + '%';
  }

  /* ------------------------------------------------------
     MASTER LOOP
  ------------------------------------------------------ */
  function loop() {
    updateParallax();
    updateWorks();
    updateLit();
    updatePress();
    updateProgress();
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------
     BOOT
  ------------------------------------------------------ */
  function resize() {
    vh = window.innerHeight;
    vw = window.innerWidth;
    const wasCompact = compact;
    compact = vw <= 1180;
    if (compact && !wasCompact) {
      parallaxItems.forEach((p) => { p.el.style.transform = ''; p.cur = 0; });
    }
    layoutWorks();
    runSplits();
  }

  function start() {
    loaderIntro();
    initCursor();
    initNav();
    initLit();
    initCounters();
    initSteps();
    initSwatches();
    initVoices();
    initPress();
    initMagnetic();
    initClock();

    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    const ready = Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]);

    ready.then(() => {
      runSplits();
      layoutWorks();
      preloader(() => {
        document.body.classList.add('is-ready');
        observeReveals();
      });
    });

    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 220); });
    if (!REDUCED) loop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
