/* =========================================================
   Lumen Dental Atelier — interaction layer
   Vanilla JS, no dependencies. Decorative motion is gated
   behind prefers-reduced-motion.
   ========================================================= */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------- character split ----------
     Runs before the reveal pass so the per-character delays exist by the
     time an element is asked to animate. Text nodes are replaced in place
     so inline markup such as <em> survives. */
  function splitChars() {
    $$('[data-chars]').forEach((el) => {
      const full = el.textContent.replace(/\s+/g, ' ').trim();
      el.setAttribute('aria-label', full);

      let i = 0;
      const walk = (node) => {
        Array.from(node.childNodes).forEach((n) => {
          if (n.nodeType === 3) {
            const frag = document.createDocumentFragment();
            // characters are grouped per word, otherwise a line can break mid-word
            n.textContent.split(/(\s+)/).forEach((chunk) => {
              if (!chunk) return;
              if (/^\s+$/.test(chunk)) { frag.appendChild(document.createTextNode(' ')); return; }
              const word = document.createElement('span');
              word.className = 'wd';
              Array.from(chunk).forEach((ch) => {
                const s = document.createElement('span');
                s.className = 'ch';
                s.style.setProperty('--i', i);
                s.textContent = ch;
                i += 1;
                word.appendChild(s);
              });
              frag.appendChild(word);
            });
            n.replaceWith(frag);
          } else if (n.nodeType === 1) {
            n.setAttribute('aria-hidden', 'true');
            walk(n);
          }
        });
      };
      walk(el);
      Array.from(el.children).forEach((c) => c.setAttribute('aria-hidden', 'true'));
    });
  }

  /* ---------- reveal ---------- */
  function reveals() {
    let pending = $$('[data-rise], [data-chars]');
    pending.forEach((el) => {
      const d = el.getAttribute('data-delay');
      if (d) el.style.setProperty('--rd', d + 'ms');
    });

    let queued = false;
    const check = () => {
      queued = false;
      const line = window.innerHeight * 0.9;
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        if ((r.width || r.height) && r.top < line) { el.classList.add('in'); return false; }
        return true;
      });
    };

    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(check);
    }, { passive: true });
    window.addEventListener('resize', check);
    document.addEventListener('reveal:check', check);
    check();
  }

  /* ---------- header ---------- */
  function header() {
    const hdr = $('[data-hdr]');
    if (!hdr) return;
    let queued = false;
    const paint = () => {
      queued = false;
      hdr.classList.toggle('is-down', window.scrollY > 30);
    };
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    paint();
  }

  /* ---------- mobile veil ---------- */
  function veil() {
    const btn = $('[data-burger]');
    const panel = $('[data-veil]');
    if (!btn || !panel) return;

    const close = () => {
      btn.setAttribute('aria-expanded', 'false');
      panel.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 500);
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

    // the burger is hidden above this width, so an open veil would trap the page
    const wide = window.matchMedia('(min-width: 1041px)');
    wide.addEventListener('change', (e) => { if (e.matches) close(); });
  }

  /* ---------- hero counters ---------- */
  function counters() {
    const nodes = $$('[data-count]');
    if (!nodes.length) return;

    const format = (n) => (n >= 1000 ? n.toLocaleString('en-GB') : String(n));

    const run = (el) => {
      const target = parseInt(el.getAttribute('data-count'), 10);
      if (calm) { el.textContent = format(target); return; }
      const dur = 1500;
      const t0 = performance.now();
      const tick = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = format(Math.round(target * eased));
        if (p < 1) requestAnimationFrame(tick);
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
    }, { threshold: 0.4 });
    nodes.forEach((n) => io.observe(n));
  }

  /* ---------- treatments: sticky media follows the read position ---------- */
  function stickyMedia() {
    const entries = $$('.entry');
    const shots = $$('.stack__i');
    const cap = $('[data-media-cap]');
    if (!entries.length || !shots.length) return;

    let live = -1;
    const show = (i) => {
      if (i === live) return;
      live = i;
      shots.forEach((s, n) => s.classList.toggle('is-on', n === i));
      entries.forEach((e, n) => e.classList.toggle('is-live', n === i));
      if (cap) cap.textContent = entries[i].getAttribute('data-cap') || '';
    };
    show(0);

    let queued = false;
    const pick = () => {
      queued = false;
      // whichever entry sits closest to a line one third down the viewport
      const mark = window.innerHeight * 0.36;
      let best = 0;
      let dist = Infinity;
      entries.forEach((el, n) => {
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mark);
        if (d < dist) { dist = d; best = n; }
      });
      show(best);
    };

    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(pick);
    }, { passive: true });
    window.addEventListener('resize', pick);
    pick();
  }

  /* ---------- journey: hairline grows with scroll ---------- */
  function timeline() {
    const el = $('[data-tl]');
    if (!el) return;
    if (calm) { el.style.setProperty('--p', '1'); return; }

    let queued = false;
    const paint = () => {
      queued = false;
      const r = el.getBoundingClientRect();
      const start = window.innerHeight * 0.7;
      const p = clamp((start - r.top) / (r.height * 0.72), 0, 1);
      el.style.setProperty('--p', p.toFixed(3));
    };
    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }

  /* ---------- quotes ---------- */
  function quotes() {
    const root = $('[data-quotes]');
    if (!root) return;
    const items = $$('.q', root);
    const now = $('[data-q-now]', root);
    const all = $('[data-q-all]', root);
    const prev = $('[data-q-prev]', root);
    const next = $('[data-q-next]', root);
    if (items.length < 2) return;

    const pad = (n) => String(n).padStart(2, '0');
    if (all) all.textContent = pad(items.length);

    let i = 0;
    const go = (n) => {
      i = (n + items.length) % items.length;
      items.forEach((q, x) => q.classList.toggle('is-on', x === i));
      if (now) now.textContent = pad(i + 1);
    };

    if (prev) prev.addEventListener('click', () => go(i - 1));
    if (next) next.addEventListener('click', () => go(i + 1));
    root.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') go(i - 1);
      if (e.key === 'ArrowRight') go(i + 1);
    });
    go(0);
  }

  /* ---------- investment rows ---------- */
  function fees() {
    const root = $('[data-fees]');
    if (!root) return;
    const rows = $$('.fee', root);

    const shut = (row) => {
      $('.fee__b', row).setAttribute('aria-expanded', 'false');
      $('.fee__p', row).style.height = '0px';
    };

    rows.forEach((row) => {
      const btn = $('.fee__b', row);
      const pan = $('.fee__p', row);
      pan.style.height = '0px';
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        rows.forEach(shut);
        if (open) return;
        btn.setAttribute('aria-expanded', 'true');
        pan.style.height = pan.scrollHeight + 'px';
      });
    });

    window.addEventListener('resize', () => {
      rows.forEach((row) => {
        const btn = $('.fee__b', row);
        const pan = $('.fee__p', row);
        if (btn.getAttribute('aria-expanded') === 'true') pan.style.height = pan.scrollHeight + 'px';
      });
    });
  }

  /* ---------- appointment wizard ---------- */
  function wizard() {
    const form = $('[data-wiz]');
    if (!form) return;

    const steps = $$('.wiz__s', form);
    const fill = $('[data-wiz-fill]', form);
    const num = $('[data-wiz-n]', form);
    const sum = $('[data-wiz-sum]', form);
    const err = $('[data-wiz-err]', form);
    const back = $('[data-wiz-back]', form);
    const next = $('[data-wiz-next]', form);
    const send = $('[data-wiz-send]', form);
    const done = $('[data-wiz-done]', form);

    const state = {
      interest: 'Veneers or smile design',
      when: 'Weekday morning',
      whenPhrase: 'on a weekday morning'
    };
    let at = 0;

    $$('[data-opts]', form).forEach((group) => {
      const key = group.getAttribute('data-opts');
      $$('.opt', group).forEach((opt) => {
        opt.addEventListener('click', () => {
          $$('.opt', group).forEach((o) => o.classList.remove('is-on'));
          opt.classList.add('is-on');
          state[key] = opt.textContent.trim();
          // sentence form, so day names keep their capital in prose
          if (key === 'when') state.whenPhrase = opt.getAttribute('data-phrase') || opt.textContent.trim().toLowerCase();
          summary();
        });
      });
    });

    function summary() {
      if (sum) sum.textContent = state.interest + ' · ' + state.when;
    }

    function paint() {
      steps.forEach((s, i) => { s.hidden = i !== at; });
      if (num) num.textContent = String(at + 1);
      if (fill) fill.style.width = ((at + 1) / steps.length * 100) + '%';
      if (back) back.hidden = at === 0;
      if (next) next.hidden = at === steps.length - 1;
      if (send) send.hidden = at !== steps.length - 1;
      if (err) err.textContent = '';
    }

    if (next) next.addEventListener('click', () => {
      at = Math.min(at + 1, steps.length - 1);
      paint();
    });
    if (back) back.addEventListener('click', () => {
      at = Math.max(at - 1, 0);
      paint();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('input[name="name"]', form);
      const phone = $('input[name="phone"]', form);

      let ok = true;
      [name, phone].forEach((input) => {
        if (!input) return;
        const bad = !input.value.trim();
        input.classList.toggle('is-bad', bad);
        if (bad && ok) { input.focus(); ok = false; }
      });
      if (!ok) {
        if (err) err.textContent = 'We need a name and a number to call you back.';
        return;
      }
      if (err) err.textContent = '';

      const line = $('[data-wiz-done-line]', form);
      const ref = $('[data-wiz-ref]', form);
      if (line) {
        line.textContent = state.interest + ', ' + state.whenPhrase +
          '. We will offer you two or three specific times within one working day.';
      }
      if (ref) ref.textContent = 'LMN-' + String(Math.floor(1000 + Math.random() * 8999));
      if (done) {
        done.hidden = false;
        requestAnimationFrame(() => done.classList.add('is-on'));
      }
    });

    $$('input, textarea', form).forEach((i) =>
      i.addEventListener('input', () => i.classList.remove('is-bad')));

    const reset = $('[data-wiz-reset]', form);
    if (reset && done) {
      reset.addEventListener('click', () => {
        done.classList.remove('is-on');
        form.reset();
        at = 0;
        paint();
        setTimeout(() => { done.hidden = true; }, 500);
      });
    }

    summary();
    paint();
  }

  /* ---------- graceful image fallback ---------- */
  function imageFallback() {
    $$('[data-img]').forEach((img) => {
      img.addEventListener('error', () => {
        const holder = img.closest('figure') || img.parentElement;
        if (holder) holder.style.background = 'var(--night-3)';
        img.style.opacity = '0';
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
    splitChars();
    reveals();
    header();
    veil();
    counters();
    stickyMedia();
    timeline();
    quotes();
    fees();
    wizard();
    imageFallback();
    year();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
