/* ═══════════════════════════════════════════════════════════
   VESPER — interaction
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  /* ── loader ───────────────────────────────────────────── */

  function boot() {
    var veil = $('[data-veil]');
    var op = $('.op');
    var done = function () {
      if (veil) { veil.classList.add('out'); }
      document.body.classList.remove('lock');
      if (op) op.classList.add('on');
      window.dispatchEvent(new Event('vesper:in'));
    };

    if (!veil || calm) { if (veil) veil.remove(); done(); return; }

    document.body.classList.add('lock');
    window.scrollTo(0, 0);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () { veil.classList.add('go'); });
    });

    setTimeout(function () {
      done();
      setTimeout(function () { veil.remove(); }, 1100);
    }, 2050);
  }

  /* ── word splitting ───────────────────────────────────── */

  function split() {
    $$('[data-words]').forEach(function (el) {
      var words = el.textContent.trim().split(/\s+/);
      el.setAttribute('aria-label', words.join(' '));
      el.textContent = '';
      words.forEach(function (w, i) {
        var s = document.createElement('span');
        s.className = 'w';
        s.setAttribute('aria-hidden', 'true');
        var em = document.createElement('i');
        em.textContent = w;
        em.style.transitionDelay = (i * 42) + 'ms';
        s.appendChild(em);
        el.appendChild(s);
        if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      });
    });
  }

  /* ── reveals ──────────────────────────────────────────── */

  function reveals() {
    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) {
        if (!r.isIntersecting) return;
        var el = r.target;
        var d = parseInt(el.getAttribute('data-delay') || '0', 10);
        if (d) el.style.transitionDelay = d + 'ms';
        el.classList.add('on');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });

    var hero = [];
    $$('[data-up],[data-tr],[data-rule]').forEach(function (el) {
      if (el.closest('.op')) { hero.push(el); return; }
      io.observe(el);
    });

    /* a clipped element reports no intersection, so watch its container */
    var wio = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) {
        if (!r.isIntersecting) return;
        $$('[data-wipe]', r.target).forEach(function (el) { el.classList.add('on'); });
        wio.unobserve(r.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.08 });

    $$('[data-wipe]').forEach(function (el) {
      wio.observe(el.parentElement || el);
    });
    window.addEventListener('vesper:in', function () {
      hero.forEach(function (el) {
        var d = parseInt(el.getAttribute('data-delay') || '0', 10);
        if (d) el.style.transitionDelay = d + 'ms';
        el.classList.add('on');
      });
    });

    var sio = new IntersectionObserver(function (rows) {
      rows.forEach(function (r) {
        if (!r.isIntersecting) return;
        $$('.w', r.target).forEach(function (w) { w.classList.add('on'); });
        sio.unobserve(r.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.2 });

    $$('[data-words]').forEach(function (el) { sio.observe(el); });
  }

  /* ── header ───────────────────────────────────────────── */

  function header() {
    var bar = $('[data-bar]');
    if (!bar) return;
    var last = window.scrollY;
    var tick = false;

    function run() {
      var y = window.scrollY;
      bar.classList.toggle('solid', y > 60);
      if (!document.body.classList.contains('nav')) {
        bar.classList.toggle('up', y > 520 && y > last + 4);
      }
      last = y;
      tick = false;
    }

    window.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(run);
    }, { passive: true });
    run();
  }

  /* ── mobile sheet ─────────────────────────────────────── */

  function menu() {
    var sheet = $('[data-sheet]');
    var open = $('[data-open]');
    var close = $('[data-close]');
    if (!sheet || !open) return;
    var y = 0;

    function set(on) {
      sheet.classList.toggle('open', on);
      sheet.setAttribute('aria-hidden', on ? 'false' : 'true');
      open.setAttribute('aria-expanded', on ? 'true' : 'false');
      document.body.classList.toggle('nav', on);
      if (on) {
        y = window.scrollY;
        document.body.classList.add('lock');
        setTimeout(function () { close && close.focus(); }, 340);
      } else {
        document.body.classList.remove('lock');
        window.scrollTo(0, y);
        open.focus();
      }
    }

    open.addEventListener('click', function () { set(true); });
    close && close.addEventListener('click', function () { set(false); });
    $$('a', sheet).forEach(function (a) {
      a.addEventListener('click', function () { set(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('open')) set(false);
    });
  }

  /* ── scroll-reactive marquee ──────────────────────────── */

  function marquee() {
    var row = $('[data-mq]');
    if (!row || calm) return;
    var grp = row.firstElementChild;
    var w = grp.offsetWidth;
    var x = 0;
    var last = window.scrollY;
    var push = 0;

    window.addEventListener('resize', function () { w = grp.offsetWidth; });
    window.addEventListener('scroll', function () {
      var y = window.scrollY;
      push += (y - last) * 0.42;
      last = y;
    }, { passive: true });

    /* stepped on elapsed time so the drift reads the same at 60 or 120Hz */
    var prev = performance.now();

    requestAnimationFrame(function frame(now) {
      var dt = Math.min((now - prev) / 16.667, 4);
      prev = now;
      x -= (0.42 + push) * dt;
      push *= Math.pow(0.90, dt);
      if (w) {
        while (x <= -w) x += w;
        while (x > 0) x -= w;
      }
      row.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
      requestAnimationFrame(frame);
    });
  }

  /* ── venue carousel ───────────────────────────────────── */

  function carousel() {
    var stage = $('[data-stage]');
    var track = $('[data-track]');
    if (!stage || !track) return;

    var items = $$('[data-it]', track);
    var caps = $$('[data-c]');
    var seg = $('[data-seg]');
    var num = $('[data-num]');
    var n = items.length;
    var act = 0;
    var half = n / 2;
    var hold = 0;
    var hover = false;

    var dots = items.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Venue ' + (i + 1));
      b.addEventListener('click', function () { go(i, true); });
      seg && seg.appendChild(b);
      return b;
    });

    function place() {
      items.forEach(function (el, i) {
        var d = i - act;
        if (d > half) d -= n;
        if (d < -half) d += n;
        var a = Math.abs(d);
        var near = a <= 1;
        el.style.setProperty('--i', near ? d : (d > 0 ? 1.7 : -1.7));
        el.style.setProperty('--s', a === 0 ? 1 : (a === 1 ? 0.74 : 0.6));
        el.style.setProperty('--o', a <= 1 ? 1 : 0);
        el.style.setProperty('--dim', a === 0 ? 0 : 0.58);
        el.style.setProperty('--z', String(10 - a));
        el.classList.toggle('act', a === 0);
        el.setAttribute('aria-hidden', a === 0 ? 'false' : 'true');
        el.style.pointerEvents = a <= 1 ? 'auto' : 'none';
      });

      caps.forEach(function (c, i) { c.classList.toggle('is-on', i === act); });
      dots.forEach(function (b, i) { b.setAttribute('aria-selected', i === act ? 'true' : 'false'); });
      if (num) num.textContent = ('0' + (act + 1)).slice(-2);
    }

    function go(i, manual) {
      act = ((i % n) + n) % n;
      place();
      if (manual) hold = Date.now();
    }

    items.forEach(function (el, i) {
      el.addEventListener('click', function () { if (i !== act) go(i, true); });
    });

    $('[data-prev]') && $('[data-prev]').addEventListener('click', function () { go(act - 1, true); });
    $('[data-next]') && $('[data-next]').addEventListener('click', function () { go(act + 1, true); });

    stage.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(act - 1, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(act + 1, true); }
    });

    /* drag */
    var sx = 0, dx = 0, down = false;
    stage.addEventListener('pointerdown', function (e) {
      if (e.button) return;
      down = true; sx = e.clientX; dx = 0;
      track.style.transition = 'none';
      stage.setPointerCapture(e.pointerId);
    });
    stage.addEventListener('pointermove', function (e) {
      if (!down) return;
      dx = e.clientX - sx;
      track.style.transform = 'translate3d(' + (dx * 0.34).toFixed(1) + 'px,0,0)';
    });
    function release() {
      if (!down) return;
      down = false;
      track.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1)';
      track.style.transform = '';
      if (Math.abs(dx) > 48) go(act + (dx < 0 ? 1 : -1), true);
      dx = 0;
    }
    stage.addEventListener('pointerup', release);
    stage.addEventListener('pointercancel', release);

    /* gentle autoplay, out of the way of anyone touching it */
    stage.addEventListener('pointerenter', function () { hover = true; });
    stage.addEventListener('pointerleave', function () { hover = false; });
    stage.addEventListener('focusin', function () { hover = true; });
    stage.addEventListener('focusout', function () { hover = false; });

    if (!calm) {
      setInterval(function () {
        if (hover || document.hidden) return;
        if (Date.now() - hold < 11000) return;
        var r = stage.getBoundingClientRect();
        if (r.bottom < 120 || r.top > window.innerHeight - 120) return;
        go(act + 1);
      }, 6200);
    }

    place();
  }

  /* ── form ─────────────────────────────────────────────── */

  function form() {
    var f = $('[data-form]');
    if (!f) return;
    var ok = $('[data-ok]');

    function bad(field, msg) {
      var wrap = field.closest('.fld');
      wrap.classList.add('bad');
      var e = $('[data-err]', wrap);
      if (e) e.textContent = msg;
    }
    function clear(field) {
      var wrap = field.closest('.fld');
      wrap.classList.remove('bad');
      var e = $('[data-err]', wrap);
      if (e) e.textContent = '';
    }

    $$('input,select,textarea', f).forEach(function (el) {
      el.addEventListener('input', function () { clear(el); });
      el.addEventListener('change', function () { clear(el); });
    });

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var first = null;

      var name = f.elements.name;
      var mail = f.elements.email;
      var type = f.elements.type;
      var when = f.elements.open;

      [name, mail, type, when].forEach(function (el) { clear(el); });

      if (!name.value.trim()) { bad(name, 'Please tell us your name.'); first = first || name; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail.value.trim())) {
        bad(mail, 'A working email, please.'); first = first || mail;
      }
      if (!type.value) { bad(type, 'Choose a room type.'); first = first || type; }
      if (!when.value) { bad(when, 'Choose a timeframe.'); first = first || when; }

      if (first) { first.focus(); if (ok) ok.textContent = ''; return; }

      if (ok) ok.textContent = 'Thank you — we will write back within two working days.';
      f.reset();
      $$('.fld', f).forEach(function (w) { w.classList.remove('bad'); });
    });
  }

  /* ── go ───────────────────────────────────────────────── */

  function init() {
    split();
    reveals();
    header();
    menu();
    marquee();
    carousel();
    form();
    boot();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
