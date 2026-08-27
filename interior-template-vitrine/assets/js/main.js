/* ═══════════════════════════════════════════════════════════
   VITRINE — behaviour
   Panel-split loader · live section name · hover-preview index
   Line clip reveals · left-origin rules · form validation
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── loader ──────────────────────────────────────────── */

  function gate() {
    var el = $('[data-gate]');
    if (!el) { open(); return; }

    var num  = $('[data-gate-n]', el);
    var mark = $('.gate__mark', el);
    var done = false;

    function open() {
      if (done) return;
      done = true;
      el.classList.add('out');
      setTimeout(function () {
        el.classList.add('done');
        document.dispatchEvent(new CustomEvent('vitrine:in'));
      }, 950);
    }

    if (calm) {
      if (num) num.textContent = '100';
      if (mark) mark.style.clipPath = 'none';
      setTimeout(open, 200);
      return;
    }

    if (mark) mark.style.clipPath = 'inset(0 100% 0 0)';

    var t0 = performance.now();
    var span = 1250;

    (function tick(now) {
      var t = Math.min((now - t0) / span, 1);
      var e = 1 - Math.pow(1 - t, 3);
      var p = Math.round(e * 100);

      if (num) num.textContent = p < 100 ? ('0' + p).slice(-2) : '100';
      if (mark) mark.style.clipPath = 'inset(0 ' + (100 - e * 100).toFixed(2) + '% 0 0)';

      if (t < 1) requestAnimationFrame(tick);
      else setTimeout(open, 260);
    })(t0);

    // never strand the page behind the panels
    setTimeout(open, 4200);
  }

  /* ── reveals ─────────────────────────────────────────── */

  function reveals() {
    var items = $$('[data-up],[data-line],[data-bar]');
    var cuts  = $$('[data-cut]');
    var hero  = [];

    function fire(el) {
      var d = parseInt(el.getAttribute('data-delay') || '0', 10);
      if (d) setTimeout(function () { el.classList.add('on'); }, d);
      else el.classList.add('on');
    }

    if (calm) {
      items.concat(cuts).forEach(function (el) { el.classList.add('on'); });
      return;
    }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        fire(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) {
      if (el.closest('.lead')) { hero.push(el); return; }
      io.observe(el);
    });

    // a clip-path'd element has no box to intersect, so watch its container
    var cio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$('[data-cut]', e.target).forEach(function (c) { c.classList.add('on'); });
        cio.unobserve(e.target);
      });
    }, { threshold: 0.05 });

    cuts.forEach(function (c) {
      if (c.closest('.lead')) { hero.push(c); return; }
      if (c.parentElement) cio.observe(c.parentElement);
    });

    document.addEventListener('vitrine:in', function () {
      hero.forEach(fire);
    });
  }

  /* ── header: progress rail + live section name ───────── */

  function header() {
    var bar   = $('[data-prog]');
    var where = $('[data-where]');
    var secs  = $$('[data-name]');
    var top   = $('[data-top]');
    var last  = '';
    var queued = false;

    function read() {
      queued = false;

      if (bar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        var p = max > 0 ? Math.min(window.scrollY / max, 1) : 0;
        bar.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      }

      if (where && secs.length) {
        var line = (top ? top.offsetHeight : 60) + 140;
        var name = secs[0].getAttribute('data-name');
        secs.forEach(function (s) {
          if (s.getBoundingClientRect().top <= line) name = s.getAttribute('data-name');
        });
        if (name !== last) {
          last = name;
          where.style.opacity = '0';
          setTimeout(function () {
            where.textContent = name;
            where.style.opacity = '1';
          }, 150);
        }
      }
    }

    function ping() { if (!queued) { queued = true; requestAnimationFrame(read); } }

    window.addEventListener('scroll', ping, { passive: true });
    window.addEventListener('resize', ping);
    read();
  }

  /* ── mobile sheet ────────────────────────────────────── */

  function menu() {
    var sheet = $('[data-sheet]');
    var open  = $('[data-open]');
    var close = $('[data-close]');
    if (!sheet || !open) return;

    var y = 0;

    function show() {
      y = window.scrollY;
      sheet.classList.add('open');
      sheet.setAttribute('aria-hidden', 'false');
      open.setAttribute('aria-expanded', 'true');
      document.body.classList.add('lock');
      document.body.style.top = -y + 'px';
      document.body.style.position = 'fixed';
      document.body.style.width = '100%';
      setTimeout(function () { var a = $('a', sheet); if (a) a.focus(); }, 340);
    }

    function hide(back) {
      sheet.classList.remove('open');
      sheet.setAttribute('aria-hidden', 'true');
      open.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('lock');
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, y);
      if (back !== false) open.focus();
    }

    open.addEventListener('click', show);
    if (close) close.addEventListener('click', function () { hide(); });

    $$('a', sheet).forEach(function (a) {
      a.addEventListener('click', function () {
        var id = a.getAttribute('href');
        hide(false);
        if (id && id.charAt(0) === '#') {
          var t = document.querySelector(id);
          if (t) setTimeout(function () { t.scrollIntoView({ behavior: calm ? 'auto' : 'smooth' }); }, 80);
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sheet.classList.contains('open')) hide();
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth > 940 && sheet.classList.contains('open')) hide(false);
    });
  }

  /* ── work index: hover preview ───────────────────────── */

  function index() {
    var rows  = $$('[data-row]');
    var shots = $$('[data-shot]');
    var vnum  = $('[data-vnum]');
    var vtxt  = $('[data-vtxt]');
    if (!rows.length || !shots.length) return;

    var live = 0;

    function set(i) {
      if (i === live) return;
      live = i;
      shots.forEach(function (s, n) { s.classList.toggle('is-on', n === i); });
      if (vnum) vnum.textContent = ('0' + (i + 1)).slice(-2);
      if (vtxt) vtxt.textContent = rows[i].getAttribute('data-meta') || '';
    }

    rows.forEach(function (a, i) {
      a.addEventListener('pointerenter', function () { set(i); });
      a.addEventListener('focus', function () { set(i); });
    });

    if (vtxt) vtxt.textContent = rows[0].getAttribute('data-meta') || '';
  }

  /* ── narrow screens: colour the row nearest the middle ─ */

  function nearest() {
    var rows = $$('.row');
    if (!rows.length || calm) {
      rows.forEach(function (r) { r.classList.add('near'); });
      return;
    }

    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('near', e.isIntersecting); });
    }, { rootMargin: '-46% 0px -46% 0px', threshold: 0 });

    rows.forEach(function (r) { io.observe(r); });
  }

  /* ── form ────────────────────────────────────────────── */

  function form() {
    var f = $('[data-form]');
    if (!f) return;
    var ok = $('[data-ok]', f);

    function check(el) {
      var box = el.closest('.fld');
      var msg = box ? $('[data-err]', box) : null;
      var bad = '';

      if (el.hasAttribute('required') && !el.value.trim()) {
        bad = el.tagName === 'SELECT' ? 'Please choose a scope' : 'This one is needed';
      } else if (el.type === 'email' && el.value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(el.value)) {
        bad = 'That address does not look right';
      }

      if (box) box.classList.toggle('bad', !!bad);
      if (msg) msg.textContent = bad;
      return !bad;
    }

    $$('input,select,textarea', f).forEach(function (el) {
      el.addEventListener('blur', function () { check(el); });
      el.addEventListener('input', function () {
        var box = el.closest('.fld');
        if (box && box.classList.contains('bad')) check(el);
      });
    });

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var fields = $$('input,select,textarea', f);
      var good = true;
      var first = null;

      fields.forEach(function (el) {
        if (!check(el) && good) { good = false; first = el; }
      });

      if (!good) {
        if (ok) ok.textContent = '';
        if (first) first.focus();
        return;
      }

      if (ok) ok.textContent = 'Thank you — we answer every enquiry within two working days.';
      f.reset();
      $$('.fld', f).forEach(function (b) { b.classList.remove('bad'); });
    });
  }

  /* ── go ──────────────────────────────────────────────── */

  function start() {
    reveals();
    header();
    menu();
    index();
    nearest();
    form();
    gate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
