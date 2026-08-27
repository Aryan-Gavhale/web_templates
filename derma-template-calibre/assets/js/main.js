/* =========================================================================
   CALIBRE — Skin Laboratory
   Interaction layer. Everything degrades to a readable static page if this
   file fails to load: the `js` class below is the only thing that arms the
   entry animations.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };

  /* ------------------------------------------------------------  imagery */
  function fadeIn(img) {
    if (img.complete && img.naturalWidth) { img.classList.add('in'); return; }
    img.addEventListener('load', function () { img.classList.add('in'); });
    img.addEventListener('error', function () { img.classList.add('in'); });
  }
  $$('img').forEach(function (img) {
    if (!img.getAttribute('loading') && !img.closest('.hero')) img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    fadeIn(img);
  });

  /* ---------------------------------------------------------------  boot */
  var boot     = $('[data-boot]');
  var bootBar  = $('[data-boot-bar]');
  var bootPct  = $('[data-boot-pct]');
  var bootLbl  = $('[data-boot-label]');
  var stages   = ['Calibrating', 'Reference set', 'White balance', 'Ready'];

  function open() {
    document.body.classList.add('go');
    if (boot) boot.classList.add('done');
    window.setTimeout(function () { if (boot && boot.parentNode) boot.parentNode.removeChild(boot); }, 900);
  }

  if (!boot || calm) {
    open();
  } else {
    var pct = 0;
    var tick = window.setInterval(function () {
      pct = Math.min(100, pct + 4 + Math.random() * 9);
      var p = Math.round(pct);
      if (bootBar) bootBar.style.width = p + '%';
      if (bootPct) bootPct.textContent = ('00' + p).slice(-3);
      if (bootLbl) bootLbl.textContent = stages[clamp(Math.floor(p / 26), 0, 3)];
      if (pct >= 100) {
        window.clearInterval(tick);
        window.setTimeout(open, 380);
      }
    }, 90);
  }

  /* ------------------------------------------------------------  reveals */
  var io = 'IntersectionObserver' in window;

  if (io) {
    var revealer = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('on');
        revealer.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    $$('.v').forEach(function (el) { revealer.observe(el); });
  } else {
    $$('.v').forEach(function (el) { el.classList.add('on'); });
  }

  /* ------------------------------------------------  scramble mono labels */
  var pool = '0123456789§#/\\*+';
  function scramble(el) {
    var target = el.textContent;
    if (calm) return;
    var frame = 0;
    var id = window.setInterval(function () {
      frame++;
      if (frame > 7) {
        window.clearInterval(id);
        el.textContent = target;
        return;
      }
      el.textContent = target.split('').map(function () {
        return pool[Math.floor(Math.random() * pool.length)];
      }).join('');
    }, 55);
  }
  if (io) {
    var scr = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        scramble(e.target);
        scr.unobserve(e.target);
      });
    }, { threshold: 0.9 });
    $$('[data-scramble]').forEach(function (el) { scr.observe(el); });
  }

  /* -----------------------------------------------------------  counters */
  function group(n) {
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u2009');
  }
  function countUp(el) {
    var to  = parseFloat(el.getAttribute('data-count')) || 0;
    var div = parseFloat(el.getAttribute('data-div')) || 1;
    if (calm) { el.textContent = div === 1 ? group(to) : (to / div).toFixed(1); return; }
    var dur = 1250, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = clamp((ts - t0) / dur, 0, 1);
      var e = 1 - Math.pow(1 - p, 3);
      var v = to * e;
      el.textContent = div === 1 ? group(Math.round(v)) : (v / div).toFixed(1);
      if (p < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }
  if (io) {
    var counter = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(e.target);
        counter.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    $$('[data-count]').forEach(function (el) { counter.observe(el); });
  } else {
    $$('[data-count]').forEach(countUp);
  }

  /* -------------------------------------------------------------  meters */
  var meters = $('[data-meters]');
  if (meters && io) {
    var mo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        meters.classList.add('on');
        mo.disconnect();
      });
    }, { threshold: 0.28 });
    mo.observe(meters);
  } else if (meters) {
    meters.classList.add('on');
  }

  /* ------------------------------------------------  rail: active section */
  var links = $$('[data-navlink]');
  if (links.length && io) {
    var byId = {};
    links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var secs = Object.keys(byId).map(function (id) { return document.getElementById(id); }).filter(Boolean);

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = byId[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (l) { l.classList.remove('on'); l.removeAttribute('aria-current'); });
          a.classList.add('on');
          a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (s) { spy.observe(s); });
  }

  /* ---------------------------------------------------------------  clock */
  var clock = $('[data-clock]');
  if (clock) {
    var fmt;
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit',
        second: '2-digit', hour12: false
      });
    } catch (err) { fmt = null; }
    var beat = function () {
      var d = new Date();
      clock.textContent = fmt ? fmt.format(d) : d.toTimeString().slice(0, 8);
    };
    beat();
    window.setInterval(beat, 1000);
  }

  /* ----------------------------------------------------------------  menu */
  var sheet = $('[data-menu]');
  if (sheet) {
    var openBtn  = $('[data-menu-open]');
    var closeBtn = $('[data-menu-close]');
    var mLinks   = $$('[data-menu-link]');
    mLinks.forEach(function (a, i) { a.style.transitionDelay = (0.1 + i * 0.05) + 's'; });

    function setMenu(on) {
      sheet.classList.toggle('open', on);
      sheet.setAttribute('aria-hidden', on ? 'false' : 'true');
      root.classList.toggle('lock', on);
      if (openBtn) openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    if (openBtn)  openBtn.addEventListener('click',  function () { setMenu(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { setMenu(false); });
    mLinks.forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('open')) setMenu(false);
    });
  }

  /* ------------------------------------------------  matrix + ask toggles */
  function collapse(scope, rowSel, btnSel, onClass) {
    var host = $(scope);
    if (!host) return;
    $$(rowSel, host).forEach(function (row) {
      var btn = $(btnSel, row);
      if (!btn) return;
      btn.addEventListener('click', function () {
        var open = row.classList.contains(onClass);
        $$(rowSel, host).forEach(function (r) {
          r.classList.remove(onClass);
          var b = $(btnSel, r);
          if (b) b.setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          row.classList.add(onClass);
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }
  collapse('[data-matrix]', '.row', '.row__btn', 'on');
  collapse('[data-ask]', '.ask__i', '.ask__q', 'on');

  /* ---------------------------------------------------  protocol track */
  var track = $('[data-track]');
  if (track) {
    var down = false, sx = 0, sl = 0, moved = 0;

    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      down = true; moved = 0;
      sx = e.clientX; sl = track.scrollLeft;
      track.classList.add('drag');
      track.setPointerCapture(e.pointerId);
    });
    track.addEventListener('pointermove', function (e) {
      if (!down) return;
      var d = e.clientX - sx;
      moved = Math.abs(d);
      track.scrollLeft = sl - d;
    });
    ['pointerup', 'pointercancel'].forEach(function (evt) {
      track.addEventListener(evt, function () { down = false; track.classList.remove('drag'); });
    });
    track.addEventListener('click', function (e) { if (moved > 6) e.preventDefault(); });

    var prev = $('[data-track-prev]');
    var next = $('[data-track-next]');
    var stop = $('.stop', track);

    function nudge(dir) {
      var w = stop ? stop.getBoundingClientRect().width : 340;
      track.scrollBy({ left: dir * w, behavior: calm ? 'auto' : 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { nudge(-1); });
    if (next) next.addEventListener('click', function () { nudge(1); });

    var arrows = $('.sh__nav');
    function edges() {
      var span = track.scrollWidth - track.clientWidth;
      if (arrows) arrows.classList.toggle('hide', span < 4);
      if (prev) prev.disabled = track.scrollLeft <= 2;
      if (next) next.disabled = track.scrollLeft >= span - 2;
    }
    track.addEventListener('scroll', edges, { passive: true });
    window.addEventListener('resize', edges);
    edges();
  }

  /* ------------------------------------------------------  reticle + ROI */
  var retic = $('[data-retic]');
  if (retic && window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
    var readout = $('[data-readout]');

    window.addEventListener('pointermove', function (e) {
      var panel = e.target instanceof Element ? e.target.closest('[data-scan]') : null;
      if (!panel) {
        retic.classList.remove('on');
        if (readout) readout.textContent = 'x —— · y ——';
        return;
      }
      retic.classList.add('on');
      retic.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';

      if (readout && panel.contains(readout.parentNode)) {
        var b = panel.getBoundingClientRect();
        var x = clamp((e.clientX - b.left) / b.width, 0, 1);
        var y = clamp((e.clientY - b.top) / b.height, 0, 1);
        readout.textContent = 'x ' + x.toFixed(3) + ' · y ' + y.toFixed(3);
      }
    }, { passive: true });
  }

  /* ----------------------------------------------------------  slot grid */
  var slots = $('[data-slots]');
  var slotOut = $('[data-slot-out]');
  if (slots && slotOut) {
    slots.addEventListener('change', function (e) {
      var t = e.target;
      if (t && t.name === 'slot' && t.value) slotOut.textContent = t.value;
    });
  }

  /* ---------------------------------------------------------------  form */
  var form = $('[data-form]');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = false;

      $$('input[required], textarea[required]', form).forEach(function (field) {
        var ok = field.value.trim().length > 1;
        if (field.type === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(field.value.trim());
        field.classList.toggle('bad', !ok);
        if (!ok && !bad) { field.focus(); bad = true; }
      });
      if (bad) return;

      var slot = form.querySelector('input[name="slot"]:checked');
      var panel = document.createElement('div');
      panel.className = 'done';
      panel.setAttribute('role', 'status');
      panel.innerHTML =
        '<p class="lbl">Request logged</p>' +
        '<h3>' + (slot ? slot.value : 'No window selected') + '</h3>' +
        '<p>The practice manager will confirm an exact time within one working ' +
        'day. Nothing has been charged. If the concern is a changing lesion, ' +
        'telephone +41 44 214 66 80 rather than waiting on this.</p>';
      form.classList.add('sent');
      form.parentNode.insertBefore(panel, form);
      panel.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    });

    $$('input, textarea', form).forEach(function (field) {
      field.addEventListener('input', function () { field.classList.remove('bad'); });
    });
  }

  /* -------------------------------------------------------------  scroll */
  var prog = $('[data-prog]');
  var ticking = false;

  function onScroll() {
    if (prog) {
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? clamp(window.scrollY / h, 0, 1) : 0;
      prog.style.height = (p * 100) + '%';
    }
  }
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      try { onScroll(); } finally { ticking = false; }
    });
  }, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------  year */
  var year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
