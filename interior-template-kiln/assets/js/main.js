/* =========================================================
   KILN — interactions
   No dependencies. One rAF loop for the scroll-linked drift,
   IntersectionObserver for everything discrete.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- utilities ---------- */
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* =========================================================
     LOADER
     ========================================================= */
  function boot(done) {
    var el = $('[data-boot]');
    if (!el) return done();

    if (calm) {
      el.classList.add('gone');
      document.body.classList.remove('stop');
      return done();
    }

    document.body.classList.add('stop');

    // the clay layer wipes across and the wordmark inverts under the edge
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('in'); });
    });

    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise(function (r) { setTimeout(r, 2200); })]).then(function () {
      setTimeout(function () {
        el.classList.add('out');
        document.body.classList.remove('stop');
        window.scrollTo(0, 0);
        done();
        setTimeout(function () { el.classList.add('gone'); }, 950);
      }, 1250);
    });
  }

  /* =========================================================
     REVEALS
     ========================================================= */
  function reveals() {
    var items = $$('[data-up],[data-wipe]');
    items.forEach(function (n) {
      if (n.dataset.delay) n.style.setProperty('--d', n.dataset.delay + 'ms');
    });

    if (calm || !('IntersectionObserver' in window)) {
      items.forEach(function (n) { n.classList.add('on'); });
      return;
    }

    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) {
        if (!r.isIntersecting) return;
        r.target.classList.add('on');
        io.unobserve(r.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (n) { io.observe(n); });
  }

  /* =========================================================
     HEADER
     ========================================================= */
  function header() {
    var top = $('[data-top]');
    if (!top) return;
    var last = window.scrollY;

    var tick = function () {
      var y = window.scrollY;
      top.classList.toggle('set', y > 40);
      // never hide while an overlay owns the screen
      var busy = document.body.classList.contains('stop');
      top.classList.toggle('hide', !busy && y > 300 && y > last);
      last = y;
    };

    tick();
    window.addEventListener('scroll', tick, { passive: true });
  }

  /* =========================================================
     MOBILE MENU
     ========================================================= */
  function menu() {
    var panel = $('[data-menu]');
    var open  = $('[data-menu-open]');
    if (!panel || !open) return;

    var show = function (on) {
      panel.classList.toggle('open', on);
      document.body.classList.toggle('stop', on);
      open.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (!on) open.focus();
    };

    open.addEventListener('click', function () { show(true); });
    $$('[data-menu-close]').forEach(function (b) {
      b.addEventListener('click', function () { show(false); });
    });
    $$('[data-menu-link]').forEach(function (a) {
      a.addEventListener('click', function () { show(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('open')) show(false);
    });
  }

  /* =========================================================
     HERO STRIP DRIFT — the only scroll-linked effect
     ========================================================= */
  function drift() {
    var strip = $('[data-strip]');
    if (!strip || calm) return;

    var pics = $$('.strip__i', strip);
    var mid  = (pics.length - 1) / 2;
    var wide = window.matchMedia('(min-width: 861px)');
    var raf  = 0;

    var frame = function () {
      raf = 0;
      if (!wide.matches) {
        pics.forEach(function (p) { p.style.transform = ''; });
        return;
      }
      var r = strip.getBoundingClientRect();
      var p = clamp(1 - (r.top / window.innerHeight), 0, 1);
      pics.forEach(function (pic, i) {
        pic.style.transform = 'translate3d(' + ((i - mid) * p * 34).toFixed(1) + 'px,0,0)';
      });
    };

    var queue = function () { if (!raf) raf = requestAnimationFrame(frame); };
    frame();
    window.addEventListener('scroll', queue, { passive: true });
    window.addEventListener('resize', queue);
  }

  /* =========================================================
     COUNTERS
     ========================================================= */
  function counters() {
    var nums = $$('[data-num]');
    if (!nums.length) return;

    if (calm || !('IntersectionObserver' in window)) {
      nums.forEach(function (n) { n.textContent = n.dataset.num; });
      return;
    }

    var run = function (n) {
      var to = parseFloat(n.dataset.num) || 0;
      var t0 = performance.now();
      var step = function (t) {
        var p = clamp((t - t0) / 1400, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        n.textContent = Math.round(to * e);
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) {
        if (!r.isIntersecting) return;
        run(r.target);
        io.unobserve(r.target);
      });
    }, { threshold: 0.6 });

    nums.forEach(function (n) { io.observe(n); });
  }

  /* =========================================================
     MATERIAL SWATCHES
     ========================================================= */
  function swatches() {
    var wrap = $('[data-swatches]');
    if (!wrap) return;
    var all = $$('[data-sw]', wrap);

    var pick = function (n) {
      all.forEach(function (s) { s.classList.toggle('is-on', s === n); });
    };

    all.forEach(function (s) {
      s.addEventListener('mouseenter', function () { pick(s); });
      s.addEventListener('focus', function () { pick(s); });
      s.addEventListener('click', function () { pick(s); });
    });
  }

  /* =========================================================
     SHELL / FITTED SLIDER
     ========================================================= */
  function compare() {
    var box  = $('[data-cmp]');
    var grip = $('[data-cmp-grip]');
    if (!box || !grip) return;

    var at = 50;

    var set = function (v) {
      at = clamp(v, 0, 100);
      box.style.setProperty('--x', at + '%');
      grip.setAttribute('aria-valuenow', Math.round(at));
    };

    var fromX = function (x) {
      var r = box.getBoundingClientRect();
      set(((x - r.left) / r.width) * 100);
    };

    var dragging = false;

    box.addEventListener('pointerdown', function (e) {
      dragging = true;
      box.setPointerCapture(e.pointerId);
      fromX(e.clientX);
    });
    box.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      e.preventDefault();
      fromX(e.clientX);
    });
    ['pointerup', 'pointercancel'].forEach(function (t) {
      box.addEventListener(t, function () { dragging = false; });
    });

    grip.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowLeft' ? -4 : e.key === 'ArrowRight' ? 4
            : e.key === 'Home' ? -100 : e.key === 'End' ? 100 : 0;
      if (!d) return;
      e.preventDefault();
      set(at + d);
    });

    set(50);
  }

  /* =========================================================
     PROJECT VIEWER — the card image flies into the panel
     ========================================================= */
  function viewer() {
    var view = $('[data-view]');
    if (!view) return;

    var pic   = $('.view__pic', view);
    var pImg  = $('[data-view-img]', view);
    var panel = $('.view__panel', view);
    var from  = null;
    var busy  = false;

    var fields = {
      sector: $('[data-view-sector]', view),
      title:  $('[data-view-title]', view),
      body:   $('[data-view-body]', view),
      place:  $('[data-view-place]', view),
      year:   $('[data-view-year]', view),
      scope:  $('[data-view-scope]', view),
      size:   $('[data-view-size]', view)
    };

    var box = function (n, r) {
      n.style.left   = r.left + 'px';
      n.style.top    = r.top + 'px';
      n.style.width  = r.width + 'px';
      n.style.height = r.height + 'px';
    };

    var onScreen = function (r) { return r.bottom > 0 && r.top < window.innerHeight; };

    var lock = function (on) {
      if (on) {
        var bar = window.innerWidth - document.documentElement.clientWidth;
        document.body.style.paddingRight = bar > 0 ? bar + 'px' : '';
      } else {
        document.body.style.paddingRight = '';
      }
      document.body.classList.toggle('stop', on);
    };

    function open(card) {
      if (busy) return;
      busy = true;
      from = card;

      var d = card.dataset;
      fields.sector.textContent = d.sector;
      fields.title.textContent  = d.title;
      fields.body.textContent   = d.body;
      fields.place.textContent  = d.place;
      fields.year.textContent   = d.year;
      fields.scope.innerHTML    = d.scope;
      fields.size.textContent   = d.size;
      pImg.src = d.src;
      pImg.alt = d.title;

      var src = card.querySelector('img');
      var r0  = src.getBoundingClientRect();

      lock(true);
      view.hidden = false;
      view.classList.add('on');
      panel.scrollTop = 0;

      if (calm) {
        view.classList.add('set');
        busy = false;
        return;
      }

      var r1 = pic.getBoundingClientRect();

      var ghost = document.createElement('div');
      ghost.className = 'ghost';
      ghost.innerHTML = '<img alt="" src="' + (src.currentSrc || src.src) + '">';
      box(ghost, r0);
      document.body.appendChild(ghost);

      void ghost.offsetWidth;
      ghost.style.transition = 'left .6s cubic-bezier(.16,1,.3,1),top .6s cubic-bezier(.16,1,.3,1),width .6s cubic-bezier(.16,1,.3,1),height .6s cubic-bezier(.16,1,.3,1)';
      box(ghost, r1);

      setTimeout(function () {
        view.classList.add('set');
        ghost.remove();
        busy = false;
      }, 620);
    }

    function close() {
      if (busy || view.hidden) return;
      busy = true;

      var src = from && from.querySelector('img');
      var r0  = src && src.getBoundingClientRect();
      var r1  = pic.getBoundingClientRect();

      var finish = function () {
        view.classList.remove('on');
        setTimeout(function () {
          view.hidden = true;
          lock(false);
          if (from) from.focus({ preventScroll: true });
          busy = false;
        }, 420);
      };

      view.classList.remove('set');

      if (calm || !r0 || !onScreen(r0)) return finish();

      var ghost = document.createElement('div');
      ghost.className = 'ghost';
      ghost.innerHTML = '<img alt="" src="' + (pImg.currentSrc || pImg.src) + '">';
      box(ghost, r1);
      document.body.appendChild(ghost);

      void ghost.offsetWidth;
      ghost.style.transition = 'left .52s cubic-bezier(.16,1,.3,1),top .52s cubic-bezier(.16,1,.3,1),width .52s cubic-bezier(.16,1,.3,1),height .52s cubic-bezier(.16,1,.3,1),opacity .2s linear .34s';
      box(ghost, r0);
      ghost.style.opacity = '0';

      setTimeout(function () { ghost.remove(); finish(); }, 400);
    }

    $$('[data-open]').forEach(function (card) {
      card.addEventListener('click', function () { open(card); });
    });
    $$('[data-view-close]').forEach(function (b) {
      b.addEventListener('click', close);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !view.hidden) close();
    });
  }

  /* =========================================================
     ENQUIRY FORM
     ========================================================= */
  function form() {
    var fm = $('[data-form]');
    if (!fm) return;
    var note = $('[data-form-note]', fm);
    var base = note.textContent;

    fm.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = 0;

      $$('.fm__row', fm).forEach(function (row) {
        var f = row.querySelector('input,select,textarea');
        if (!f || !f.required) return;
        var ok = f.checkValidity() && f.value.trim() !== '';
        row.classList.toggle('bad', !ok);
        if (!ok && !bad) { bad = 1; f.focus(); }
      });

      if (bad) {
        note.textContent = 'A couple of fields still need you.';
        return;
      }

      var go = $('.fm__go', fm);
      go.disabled = true;
      go.textContent = 'Sending…';

      setTimeout(function () {
        go.textContent = 'Sent — thank you';
        note.textContent = 'Got it. We will come back to you within five working days.';
        setTimeout(function () {
          fm.reset();
          go.disabled = false;
          go.textContent = 'Send it through';
          note.textContent = base;
        }, 4200);
      }, 750);
    });

    $$('.fm input,.fm select,.fm textarea', fm).forEach(function (f) {
      f.addEventListener('input', function () {
        var row = f.closest('.fm__row');
        if (row) row.classList.remove('bad');
      });
    });
  }

  /* =========================================================
     GO
     ========================================================= */
  function start() {
    header();
    menu();
    drift();
    swatches();
    compare();
    viewer();
    form();
    boot(function () {
      reveals();
      counters();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
