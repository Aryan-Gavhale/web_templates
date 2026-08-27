/* =========================================================
   DATUM — interaction
   Vanilla, no dependencies. Discrete animation runs off
   IntersectionObserver; nothing is bound to a scroll handler
   that does layout reads.
   ========================================================= */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ---------------------------------------------------------
     LOADER
     Registration marks fly in, the wordmark is measured, the
     coordinates settle, the sheet lifts.
     --------------------------------------------------------- */
  function boot() {
    var el = $('[data-boot]');
    if (!el) return;

    var wOut = $('[data-boot-w]', el);
    var cOut = $('[data-boot-co]', el);
    var mark = $('.boot__mark', el);
    document.body.classList.add('stop');

    var done = function () {
      el.classList.add('out');
      document.body.classList.remove('stop');
      window.setTimeout(function () { el.remove(); }, 700);
      document.dispatchEvent(new CustomEvent('datum:ready'));
    };

    if (calm) { window.setTimeout(done, 200); return; }

    requestAnimationFrame(function () {
      el.classList.add('in');

      // count up to the measured width of the wordmark
      var target = Math.round(mark.getBoundingClientRect().width);
      var t0 = performance.now();
      (function tick(now) {
        var p = Math.min(1, (now - t0) / 900);
        var e = 1 - Math.pow(1 - p, 3);
        wOut.textContent = Math.round(target * e);
        if (p < 1) requestAnimationFrame(tick);
      })(t0);

      // scramble the coordinate decimals, then settle
      var real = cOut.textContent;
      var jit = window.setInterval(function () {
        cOut.textContent = real.replace(/\.\d+/g, function () {
          return '.' + Math.floor(Math.random() * 9000 + 1000);
        });
      }, 70);
      window.setTimeout(function () { window.clearInterval(jit); cOut.textContent = real; }, 900);

      window.setTimeout(done, 1900);
    });
  }

  /* ---------------------------------------------------------
     REVEALS
     --------------------------------------------------------- */
  function reveals() {
    var items = $$('[data-up],[data-wipe]');
    if (!items.length) return;

    if (calm || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('on'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var n = en.target;
        n.style.setProperty('--d', (n.dataset.delay || 0) + 'ms');
        n.classList.add('on');
        io.unobserve(n);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (n) { io.observe(n); });
  }

  /* ---------------------------------------------------------
     HEADER — solid once off the cover, hides on the way down
     --------------------------------------------------------- */
  function header() {
    var bar = $('[data-bar]');
    if (!bar) return;
    var last = window.scrollY, tick = false;

    var run = function () {
      var y = window.scrollY;
      bar.classList.toggle('set', y > 40);
      if (!$('[data-menu]').classList.contains('open')) {
        bar.classList.toggle('hide', y > 300 && y > last + 4);
      }
      last = y;
      tick = false;
    };

    window.addEventListener('scroll', function () {
      if (!tick) { tick = true; requestAnimationFrame(run); }
    }, { passive: true });
    run();
  }

  /* ---------------------------------------------------------
     MOBILE MENU
     --------------------------------------------------------- */
  function menu() {
    var pane = $('[data-menu]');
    var open = $('[data-menu-open]');
    var shut = $('[data-menu-close]');
    if (!pane || !open) return;

    var set = function (on) {
      pane.classList.toggle('open', on);
      document.body.classList.toggle('stop', on);
      open.setAttribute('aria-expanded', String(on));
      if (!on) open.focus();
    };

    open.addEventListener('click', function () { set(true); });
    shut.addEventListener('click', function () { set(false); });
    $$('[data-menu-link]', pane).forEach(function (a) {
      a.addEventListener('click', function () { set(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && pane.classList.contains('open')) set(false);
    });
  }

  /* ---------------------------------------------------------
     PLAN — every stroke is measured, then drawn at pen speed
     --------------------------------------------------------- */
  function plan() {
    var svg = $('[data-plan]');
    if (!svg) return;

    var lines = $$('.dl', svg);
    var labels = $$('.dt', svg);
    var clock = 0;

    lines.forEach(function (n) {
      var len;
      try { len = n.getTotalLength(); } catch (err) { len = 400; }
      len = Math.ceil(len) + 1;
      // long walls take longer than a door tick — the hand moves at one speed
      var dur = Math.min(1.5, 0.28 + len / 1500);
      n.style.setProperty('--len', len);
      n.style.setProperty('--dur', dur + 's');
      n.style.setProperty('--d', Math.round(clock) + 'ms');
      clock += Math.min(150, 40 + len / 14);
    });

    labels.forEach(function (n, i) {
      n.style.setProperty('--d', Math.round(clock * 0.72 + i * 45) + 'ms');
    });

    if (calm || !('IntersectionObserver' in window)) { svg.classList.add('on'); return; }

    var io = new IntersectionObserver(function (en) {
      if (en[0].isIntersecting) { svg.classList.add('on'); io.disconnect(); }
    }, { threshold: 0.2 });

    // the plan sits in the first screen, so wait for the sheet to lift
    document.addEventListener('datum:ready', function () { io.observe(svg); }, { once: true });
    window.setTimeout(function () { io.observe(svg); }, 2600);
  }

  /* ---------------------------------------------------------
     COUNTERS
     --------------------------------------------------------- */
  function counters() {
    var nums = $$('[data-num]');
    if (!nums.length) return;

    var fmt = function (v) {
      return v >= 1000 ? String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009') : String(v);
    };

    if (calm || !('IntersectionObserver' in window)) {
      nums.forEach(function (n) { n.textContent = fmt(+n.dataset.num); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var n = en.target, to = +n.dataset.num, t0 = performance.now();
        (function tick(now) {
          var p = Math.min(1, (now - t0) / 1500);
          var e = 1 - Math.pow(1 - p, 4);
          n.textContent = fmt(Math.round(to * e));
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
        io.unobserve(n);
      });
    }, { threshold: 0.6 });

    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---------------------------------------------------------
     PROJECT INDEX — filter chips and in-place expansion
     --------------------------------------------------------- */
  function index() {
    var wrap = $('[data-rows]');
    if (!wrap) return;

    var recs  = $$('[data-rec]', wrap);
    var chips = $$('[data-chip]');
    var count = $('[data-count]');
    var none  = $('[data-none]');

    /* --- expansion (one open at a time) --- */
    var shut = function (rec) {
      rec.classList.remove('open');
      $('[data-rec-btn]', rec).setAttribute('aria-expanded', 'false');
      $('.rec__p', rec).setAttribute('inert', '');
    };

    recs.forEach(function (rec) {
      var btn = $('[data-rec-btn]', rec);
      $('.rec__p', rec).setAttribute('inert', '');

      btn.addEventListener('click', function () {
        var was = rec.classList.contains('open');
        recs.forEach(shut);
        if (was) return;

        rec.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
        $('.rec__p', rec).removeAttribute('inert');

        // only chase it if the panel opened below the fold
        window.setTimeout(function () {
          var b = rec.getBoundingClientRect();
          if (b.bottom > window.innerHeight && b.height < window.innerHeight * 0.92) {
            rec.scrollIntoView({ block: 'end', behavior: calm ? 'auto' : 'smooth' });
          }
        }, calm ? 0 : 580);
      });
    });

    /* --- filtering --- */
    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var cat = chip.dataset.chip;

        chips.forEach(function (c) {
          var on = c === chip;
          c.classList.toggle('is-on', on);
          c.setAttribute('aria-pressed', String(on));
        });

        recs.forEach(shut);

        var shown = 0;
        recs.forEach(function (rec) {
          var keep = cat === 'all' || rec.dataset.cat === cat;
          rec.classList.toggle('gone', !keep);
          if (!keep) return;
          rec.classList.remove('in');
          void rec.offsetWidth;                       // restart the stagger
          rec.style.setProperty('--i', shown);
          rec.classList.add('in');
          shown++;
        });

        if (count) count.textContent = shown;
        if (none) none.hidden = shown > 0;
      });
    });

    /* --- first sight: deal the rows out in order --- */
    if (calm || !('IntersectionObserver' in window)) return;
    wrap.classList.add('armed');
    var io = new IntersectionObserver(function (en) {
      if (!en[0].isIntersecting) return;
      recs.forEach(function (rec, i) { rec.style.setProperty('--i', i); rec.classList.add('in'); });
      io.disconnect();
    }, { threshold: 0.05 });
    io.observe(wrap);
  }

  /* ---------------------------------------------------------
     FORM
     --------------------------------------------------------- */
  function form() {
    var f = $('[data-form]');
    if (!f) return;
    var note = $('[data-form-note]', f);
    var base = note.innerHTML;

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = 0;

      $$('.blk__c', f).forEach(function (cell) {
        var field = $('input,select,textarea', cell);
        if (!field || !field.required) return;
        var ok = field.value.trim() !== '' && (field.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(field.value));
        cell.classList.toggle('bad', !ok);
        if (!ok) bad++;
      });

      if (bad) {
        note.textContent = bad + (bad === 1 ? ' field needs' : ' fields need') + ' completing before this can be issued.';
        var first = $('.blk__c.bad input,.blk__c.bad select,.blk__c.bad textarea', f);
        if (first) first.focus();
        return;
      }

      note.textContent = 'Received. Logged as Rev A — we will come back within five working days.';
      f.reset();
      window.setTimeout(function () { note.innerHTML = base; }, 7000);
    });

    $$('.blk input,.blk select,.blk textarea', f).forEach(function (field) {
      field.addEventListener('input', function () { field.closest('.blk__c').classList.remove('bad'); });
      field.addEventListener('change', function () { field.closest('.blk__c').classList.remove('bad'); });
    });
  }

  /* --------------------------------------------------------- */
  function init() { boot(); reveals(); header(); menu(); plan(); counters(); index(); form(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
