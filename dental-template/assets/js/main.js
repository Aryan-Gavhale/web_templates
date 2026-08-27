/* =========================================================
   Aurelia Dental Institute — interaction layer
   Vanilla JS, no dependencies. Every motion effect is gated
   behind prefers-reduced-motion where it is decorative.
   ========================================================= */
(function () {
  'use strict';

  const $  = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

  /* ---------- headline word split ---------- */
  function splitHeadings() {
    $$('[data-split]').forEach((root) => {
      let i = 0;
      (function walk(node) {
        Array.from(node.childNodes).forEach((child) => {
          if (child.nodeType === Node.TEXT_NODE) {
            if (!child.textContent.trim()) return;
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) {
                frag.appendChild(document.createTextNode(' '));
                return;
              }
              const outer = document.createElement('span');
              outer.className = 'word';
              const inner = document.createElement('span');
              inner.textContent = part;
              inner.style.setProperty('--wd', i * 32 + 'ms');
              i += 1;
              outer.appendChild(inner);
              frag.appendChild(outer);
            });
            node.replaceChild(frag, child);
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            walk(child);
          }
        });
      })(root);
    });
  }

  /* ---------- scroll reveal ---------- */
  function reveals() {
    const targets = $$('[data-reveal], [data-split]');
    targets.forEach((el) => {
      const d = el.getAttribute('data-delay');
      if (d) el.style.setProperty('--rd', d + 'ms');
    });

    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });

    targets.forEach((el) => io.observe(el));
  }

  /* ---------- counters ---------- */
  function counters() {
    const nodes = $$('[data-count]');
    if (!nodes.length) return;

    const run = (el) => {
      const target = parseFloat(el.getAttribute('data-count'));
      const dp = parseInt(el.getAttribute('data-decimals') || '0', 10);
      if (calm) { el.textContent = target.toFixed(dp); return; }

      const dur = 1500;
      const t0 = performance.now();
      const tick = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toFixed(dp);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target.toFixed(dp);
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    nodes.forEach((n) => io.observe(n));
  }

  /* ---------- header state + progress ---------- */
  function header() {
    const bar = $('[data-progress]');
    const el = $('#header');
    let queued = false;

    const paint = () => {
      queued = false;
      const y = window.scrollY;
      el.classList.toggle('is-stuck', y > 24);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar) bar.style.transform = 'scaleX(' + (max > 0 ? clamp(y / max, 0, 1) : 0) + ')';
    };

    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    paint();
  }

  /* ---------- active nav link ---------- */
  function activeNav() {
    const links = $$('[data-navlink]');
    if (!links.length || !('IntersectionObserver' in window)) return;

    const map = new Map();
    links.forEach((a) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) map.set(target, a);
    });

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        links.forEach((l) => l.classList.remove('is-active'));
        const link = map.get(e.target);
        if (link) link.classList.add('is-active');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    map.forEach((_link, section) => io.observe(section));
  }

  /* ---------- mobile drawer ---------- */
  function drawer() {
    const btn = $('[data-burger]');
    const panel = $('[data-drawer]');
    if (!btn || !panel) return;

    const close = () => {
      btn.setAttribute('aria-expanded', 'false');
      panel.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 600);
    };

    const open = () => {
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-open'));
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };

    btn.addEventListener('click', () => {
      btn.getAttribute('aria-expanded') === 'true' ? close() : open();
    });
    $$('a', panel).forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // the burger is hidden above this width, so an open drawer would trap the page
    const wide = window.matchMedia('(min-width: 1081px)');
    wide.addEventListener('change', (e) => { if (e.matches) close(); });
  }

  /* ---------- marquee seamless loop ---------- */
  function marquee() {
    const track = $('[data-marquee]');
    if (!track) return;
    track.innerHTML += track.innerHTML;
  }

  /* ---------- service row hover preview ---------- */
  function servicePreview() {
    const box = $('[data-svc-preview]');
    const img = $('[data-svc-preview-img]');
    const rows = $$('.svc__row');
    if (!box || !img || !rows.length || !fine || calm) return;

    let x = window.innerWidth / 2, y = window.innerHeight / 2;
    let cx = x, cy = y, running = false;

    const loop = () => {
      cx += (x - cx) * 0.14;
      cy += (y - cy) * 0.14;
      box.style.translate = cx + 'px ' + cy + 'px';
      if (running) requestAnimationFrame(loop);
    };

    rows.forEach((row) => {
      row.addEventListener('mouseenter', (e) => {
        const src = row.getAttribute('data-preview');
        if (src && img.getAttribute('src') !== src) img.setAttribute('src', src);
        x = cx = e.clientX + 130;
        y = cy = e.clientY;
        box.style.translate = cx + 'px ' + cy + 'px';
        box.classList.add('is-on');
        if (!running) { running = true; requestAnimationFrame(loop); }
      });
      row.addEventListener('mouseleave', () => {
        box.classList.remove('is-on');
        running = false;
      });
      row.addEventListener('mousemove', (e) => { x = e.clientX + 130; y = e.clientY; });
    });
  }

  /* ---------- draggable rail ---------- */
  function rail() {
    const track = $('[data-rail-track]');
    if (!track) return;

    const prev = $('[data-rail="prev"]');
    const next = $('[data-rail="next"]');
    const step = () => {
      const card = $('.tcard', track);
      return card ? card.getBoundingClientRect().width + 20 : 320;
    };

    const sync = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= max;
    };

    if (prev) prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: calm ? 'auto' : 'smooth' }));
    if (next) next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: calm ? 'auto' : 'smooth' }));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();

    let down = false, startX = 0, startLeft = 0, moved = 0;
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') return;
      down = true; moved = 0;
      startX = e.clientX;
      startLeft = track.scrollLeft;
    });
    track.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - startX;
      moved = Math.abs(dx);
      if (moved > 5) track.classList.add('is-dragging');
      track.scrollLeft = startLeft - dx;
    });
    const release = () => {
      if (!down) return;
      down = false;
      track.classList.remove('is-dragging');
    };
    track.addEventListener('pointerup', release);
    track.addEventListener('pointerleave', release);
    track.addEventListener('pointercancel', release);
  }

  /* ---------- before / after compare ---------- */
  function compare() {
    const box = $('[data-compare]');
    const handle = $('[data-compare-handle]');
    if (!box || !handle) return;

    let pos = 50;
    const apply = (v) => {
      pos = clamp(v, 2, 98);
      box.style.setProperty('--pos', pos + '%');
      handle.setAttribute('aria-valuenow', Math.round(pos));
    };
    const fromEvent = (e) => {
      const r = box.getBoundingClientRect();
      apply(((e.clientX - r.left) / r.width) * 100);
    };

    let dragging = false;
    box.addEventListener('pointerdown', (e) => {
      dragging = true;
      box.setPointerCapture(e.pointerId);
      fromEvent(e);
    });
    box.addEventListener('pointermove', (e) => { if (dragging) fromEvent(e); });
    box.addEventListener('pointerup', () => { dragging = false; });
    box.addEventListener('pointercancel', () => { dragging = false; });

    handle.addEventListener('keydown', (e) => {
      const stepSize = e.shiftKey ? 10 : 3;
      if (e.key === 'ArrowLeft')  { apply(pos - stepSize); e.preventDefault(); }
      if (e.key === 'ArrowRight') { apply(pos + stepSize); e.preventDefault(); }
      if (e.key === 'Home')       { apply(2);  e.preventDefault(); }
      if (e.key === 'End')        { apply(98); e.preventDefault(); }
    });

    apply(50);
  }

  /* ---------- testimonial rotator ---------- */
  function quotes() {
    const stage = $('[data-quotes]');
    if (!stage) return;
    const items = $$('[data-quote]', stage);
    const dotsBox = $('[data-quote-dots]');
    if (items.length < 2) return;

    let index = 0;
    let timer = null;

    const dots = items.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Quote ' + (i + 1));
      b.addEventListener('click', () => { go(i); restart(); });
      if (dotsBox) dotsBox.appendChild(b);
      return b;
    });

    function go(i) {
      index = (i + items.length) % items.length;
      items.forEach((el, n) => el.classList.toggle('is-active', n === index));
      dots.forEach((d, n) => d.classList.toggle('is-on', n === index));
    }
    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(() => go(index + 1), 7000);
    }

    const prev = $('[data-quote-prev]');
    const next = $('[data-quote-next]');
    if (prev) prev.addEventListener('click', () => { go(index - 1); restart(); });
    if (next) next.addEventListener('click', () => { go(index + 1); restart(); });

    stage.addEventListener('mouseenter', () => timer && clearInterval(timer));
    stage.addEventListener('mouseleave', restart);

    go(0);
    restart();
  }

  /* ---------- accordion ---------- */
  function accordion() {
    const root = $('[data-acc]');
    if (!root) return;
    const items = $$('.acc__item', root);

    const shut = (item) => {
      const btn = $('.acc__btn', item);
      const panel = $('.acc__panel', item);
      btn.setAttribute('aria-expanded', 'false');
      panel.style.height = '0px';
    };

    items.forEach((item) => {
      const btn = $('.acc__btn', item);
      const panel = $('.acc__panel', item);
      panel.style.height = '0px';

      btn.addEventListener('click', () => {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        items.forEach(shut);
        if (isOpen) return;
        btn.setAttribute('aria-expanded', 'true');
        panel.style.height = panel.scrollHeight + 'px';
      });
    });

    window.addEventListener('resize', () => {
      items.forEach((item) => {
        const btn = $('.acc__btn', item);
        const panel = $('.acc__panel', item);
        if (btn.getAttribute('aria-expanded') === 'true') {
          panel.style.height = panel.scrollHeight + 'px';
        }
      });
    });
  }

  /* ---------- chips ---------- */
  function chips() {
    const group = $('[data-chips]');
    if (!group) return;
    const all = $$('[data-chip]', group);
    all.forEach((chip) => {
      chip.addEventListener('click', () => {
        all.forEach((c) => c.classList.remove('is-on'));
        chip.classList.add('is-on');
      });
    });
  }

  /* ---------- booking form ---------- */
  function form() {
    const el = $('[data-form]');
    if (!el) return;
    const done = $('[data-form-done]');
    const ref = $('[data-form-ref]');

    el.addEventListener('submit', (e) => {
      e.preventDefault();
      const required = $$('input[required]', el);
      let ok = true;
      required.forEach((input) => {
        const bad = !input.value.trim();
        input.classList.toggle('is-bad', bad);
        if (bad && ok) { input.focus(); ok = false; }
      });
      if (!ok) return;

      if (ref) ref.textContent = 'AUR-' + String(Math.floor(1000 + Math.random() * 8999));
      if (done) {
        done.hidden = false;
        requestAnimationFrame(() => done.classList.add('is-on'));
      }
    });

    $$('input', el).forEach((input) => {
      input.addEventListener('input', () => input.classList.remove('is-bad'));
    });

    const reset = $('[data-form-reset]', el);
    if (reset && done) {
      reset.addEventListener('click', () => {
        done.classList.remove('is-on');
        el.reset();
        setTimeout(() => { done.hidden = true; }, 500);
        const first = $('input', el);
        if (first) first.focus();
      });
    }
  }

  /* ---------- magnetic buttons ---------- */
  function magnetic() {
    if (!fine || calm) return;
    $$('[data-magnetic]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform = 'translate(' + (dx * 7).toFixed(2) + 'px,' + (dy * 5).toFixed(2) + 'px)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- hero parallax ---------- */
  function parallax() {
    const nodes = $$('[data-parallax]');
    if (!nodes.length || calm) return;
    let queued = false;

    const paint = () => {
      queued = false;
      const mid = window.innerHeight / 2;
      nodes.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
        const strength = parseFloat(el.getAttribute('data-parallax')) || 0.05;
        const offset = (mid - (r.top + r.height / 2)) * strength;
        el.style.translate = '0 ' + offset.toFixed(2) + 'px';
      });
    };

    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    paint();
  }

  /* ---------- opening hours badge ---------- */
  function hours() {
    const box = $('[data-hours]');
    if (!box) return;
    const text = $('.hours__text', box);
    const now = new Date();
    const day = now.getDay();
    const mins = now.getHours() * 60 + now.getMinutes();

    let open = null;
    if (day >= 1 && day <= 5) open = [8 * 60, 20 * 60];
    else if (day === 6) open = [9 * 60, 17 * 60];

    if (open && mins >= open[0] && mins < open[1]) {
      const h = Math.floor(open[1] / 60);
      text.textContent = 'Open now · until ' + (h > 12 ? h - 12 : h) + ':00 ' + (h >= 12 ? 'PM' : 'AM');
      box.classList.remove('is-closed');
    } else {
      text.textContent = 'Closed · emergency line open';
      box.classList.add('is-closed');
    }
  }

  /* ---------- graceful image fallback ---------- */
  function imageFallback() {
    $$('[data-img]').forEach((img) => {
      img.addEventListener('error', () => {
        const holder = img.closest('figure, .arch, .doc__fig, .compare, .avatars') || img.parentElement;
        if (holder) holder.classList.add('img-fallback');
      });
    });
  }

  /* ---------- footer year ---------- */
  function year() {
    const el = $('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------- boot ---------- */
  function init() {
    splitHeadings();
    reveals();
    counters();
    header();
    activeNav();
    drawer();
    marquee();
    servicePreview();
    rail();
    compare();
    quotes();
    accordion();
    chips();
    form();
    magnetic();
    parallax();
    hours();
    imageFallback();
    year();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
