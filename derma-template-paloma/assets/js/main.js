/* =========================================================================
   PALOMA — Dermatología, Roma Norte
   The page holds one palette at a time. Everything else here is small.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var io = 'IntersectionObserver' in window;

  /* ------------------------------------------------------------  imagery */
  $$('img').forEach(function (img) {
    if (!img.closest('.hero')) img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    if (img.complete && img.naturalWidth) { img.classList.add('in'); return; }
    img.addEventListener('load',  function () { img.classList.add('in'); });
    img.addEventListener('error', function () { img.classList.add('in'); });
  });

  /* -------------------------------------------------------------  curtain */
  var curtain = $('[data-curtain]');
  var open = function () { document.body.classList.add('go'); };

  if (calm || !curtain) {
    open();
  } else {
    window.setTimeout(open, 1150);
    window.setTimeout(function () {
      if (curtain.parentNode) curtain.parentNode.removeChild(curtain);
    }, 1900);
  }

  /* ---------------------------------------------------------------  rooms */
  var rooms = {
    cal:   { bg:'#F5EEE2', fg:'#1E1917', pop:'#E86A80' },
    rosa:  { bg:'#E86A80', fg:'#241110', pop:'#F7F1E6' },
    ocre:  { bg:'#EBA83F', fg:'#241A08', pop:'#1E1917' },
    lila:  { bg:'#A192D6', fg:'#1B1533', pop:'#F7F1E6' },
    terra: { bg:'#A8462F', fg:'#F7F1E6', pop:'#EBA83F' },
    tinta: { bg:'#1E1917', fg:'#F7F1E6', pop:'#EBA83F' }
  };
  var themeTag = $('meta[name="theme-color"]');
  var current = 'cal';

  function wear(name) {
    var r = rooms[name];
    if (!r || name === current) return;
    current = name;
    root.style.setProperty('--bg', r.bg);
    root.style.setProperty('--fg', r.fg);
    root.style.setProperty('--pop', r.pop);
    if (themeTag) themeTag.setAttribute('content', r.bg);
  }

  var painted = $$('[data-room]');
  if (painted.length && io) {
    var roomSpy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) wear(e.target.getAttribute('data-room'));
      });
    }, { rootMargin: '-50% 0px -50% 0px', threshold: 0 });
    painted.forEach(function (s) { roomSpy.observe(s); });
  }

  /* -------------------------------------------------------------  reveals */
  if (io) {
    var upper = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('up');
        upper.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.15 });
    $$('.u').forEach(function (el) { upper.observe(el); });
  } else {
    $$('.u').forEach(function (el) { el.classList.add('up'); });
  }

  /* ------------------------------------------------------------  counters */
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-count')) || 0;
    if (calm) { el.textContent = to; return; }
    var dur = 1100, t0 = null;
    function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
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
    }, { threshold: 0.6 });
    $$('[data-count]').forEach(function (el) { counter.observe(el); });
  } else {
    $$('[data-count]').forEach(countUp);
  }

  /* ---------------------------------------------------------  nav active */
  var navLinks = $$('[data-navlink]');
  if (navLinks.length && io) {
    var byId = {};
    navLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        navLinks.forEach(function (l) { l.classList.remove('on'); l.removeAttribute('aria-current'); });
        var a = byId[e.target.id];
        if (!a) return;
        a.classList.add('on');
        a.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('section[id], .room[id]').forEach(function (s) { spy.observe(s); });
  }

  /* --------------------------------------------------------------  drawer */
  var drawer = $('[data-menu]');
  if (drawer) {
    var openBtn  = $('[data-menu-open]');
    var closeBtn = $('[data-menu-close]');
    $$('[data-menu-link]').forEach(function (a, i) {
      a.style.transitionDelay = (0.12 + i * 0.045) + 's';
      a.addEventListener('click', function () { setDrawer(false); });
    });
    function setDrawer(on) {
      drawer.classList.toggle('open', on);
      drawer.setAttribute('aria-hidden', on ? 'false' : 'true');
      root.classList.toggle('lock', on);
      if (openBtn) openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    }
    if (openBtn)  openBtn.addEventListener('click',  function () { setDrawer(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { setDrawer(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) setDrawer(false);
    });
  }

  /* -----------------------------------------------------  phototype picker */
  var TYPES = [
    {
      sw:'#F4DFD1', dark:false, roman:'I',
      title:'Always burns, never tans',
      lead:'The highest skin-cancer risk of the six, and the lowest risk of pigment trouble after a procedure.',
      sun:'SPF 50 daily, reapplied. Burns in under twenty minutes at this altitude.',
      laser:'Nearly the whole bench is available, ablative resurfacing included.',
      pig:'Post-inflammatory hyperpigmentation is uncommon. Redness lingers instead.',
      screen:'Full-body mole check every 12 months from age 25.'
    },
    {
      sw:'#EFD0BA', dark:false, roman:'II',
      title:'Burns easily, tans minimally',
      lead:'Still a high skin-cancer risk. Most devices are open to you and pigment rebound is rare.',
      sun:'SPF 50 daily, reapplied at altitude and near water without exception.',
      laser:'Ablative and non-ablative both available at standard settings.',
      pig:'Low rebound risk. Freckling and solar lentigines are the usual complaint.',
      screen:'Full-body check every 12 months, sooner with any family history.'
    },
    {
      sw:'#E0B492', dark:false, roman:'III',
      title:'Burns moderately, tans gradually',
      lead:'The middle of the scale, and the point at which laser settings start coming down.',
      sun:'SPF 50 daily. Mexico City sits at 2,240 m, which lifts UV by roughly a quarter.',
      laser:'Most devices available at conservative settings, with a test patch first.',
      pig:'A real risk of post-inflammatory pigment after any inflammation, including acne.',
      screen:'Every 12 to 18 months depending on mole count.'
    },
    {
      sw:'#C08E68', dark:false, roman:'IV',
      title:'Burns minimally, tans easily',
      lead:'Lower cancer risk, considerably higher risk of pigment that outlasts the problem that caused it.',
      sun:'SPF 50 daily — as much for pigment control as for cancer.',
      laser:'Longer wavelengths only. No IPL, and no ablative resurfacing without a test patch.',
      pig:'High risk of post-inflammatory hyperpigmentation and of melasma.',
      screen:'Every 18 months, including palms, soles and nail beds.'
    },
    {
      sw:'#8D5B3C', dark:true, roman:'V',
      title:'Rarely burns, tans darkly',
      lead:'Melasma and post-inflammatory pigmentation are the dominant concerns here, not sunburn.',
      sun:'SPF 50 with iron oxides — visible light drives melasma, not only UV.',
      laser:'1064 nm Nd:YAG as the workhorse. IPL and alexandrite are declined.',
      pig:'Very high pigment-rebound risk. Intervals go up and energies come down.',
      screen:'Every 18 months, with close attention to palms, soles and nails.'
    },
    {
      sw:'#5A3728', dark:true, roman:'VI',
      title:'Never burns, deeply pigmented',
      lead:'The phototype most often treated with settings that were written for somebody else\u2019s skin.',
      sun:'SPF 30–50 with iron oxides, for pigment control and photoageing.',
      laser:'Long-pulse 1064 nm only, always after a test patch. Ablative work is declined.',
      pig:'The highest risk of keloid, and of pigment moving in either direction.',
      screen:'Every 18 months. Acral and nail examination at every visit — that is where melanoma presents.'
    }
  ];

  var tone = $('[data-tone]');
  if (tone) {
    var chips  = $$('.chip', tone);
    var plate  = $('[data-tone-plate]');
    var fields = {
      roman:  $('[data-tone-roman]'),
      label:  $('[data-tone-label]'),
      title:  $('[data-tone-title]'),
      lead:   $('[data-tone-lead]'),
      sun:    $('[data-tone-sun]'),
      laser:  $('[data-tone-laser]'),
      pig:    $('[data-tone-pig]'),
      screen: $('[data-tone-screen]')
    };

    function paint(i) {
      var t = TYPES[i];
      if (!t) return;
      chips.forEach(function (c, n) { c.setAttribute('aria-selected', n === i ? 'true' : 'false'); });
      if (plate) {
        plate.style.setProperty('--sw', t.sw);
        plate.classList.toggle('dark', !!t.dark);
      }
      if (fields.roman)  fields.roman.textContent  = t.roman;
      if (fields.label)  fields.label.textContent  = 'Phototype ' + t.roman;
      if (fields.title)  fields.title.textContent  = t.title;
      if (fields.lead)   fields.lead.textContent   = t.lead;
      if (fields.sun)    fields.sun.textContent    = t.sun;
      if (fields.laser)  fields.laser.textContent  = t.laser;
      if (fields.pig)    fields.pig.textContent    = t.pig;
      if (fields.screen) fields.screen.textContent = t.screen;
    }

    chips.forEach(function (c, i) {
      c.addEventListener('click', function () { paint(i); });
      c.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : -1;
        if (n < 0 || n >= chips.length) return;
        e.preventDefault();
        chips[n].focus();
        paint(n);
      });
    });
    paint(0);
  }

  /* ----------------------------------------------------------------  asks */
  var asks = $('[data-asks]');
  if (asks) {
    $$('.ask', asks).forEach(function (row) {
      var btn = $('.ask__q', row);
      btn.addEventListener('click', function () {
        var was = row.classList.contains('on');
        $$('.ask', asks).forEach(function (r) {
          r.classList.remove('on');
          $('.ask__q', r).setAttribute('aria-expanded', 'false');
        });
        if (!was) {
          row.classList.add('on');
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* --------------------------------------------------------------  quotes */
  var quoteBox = $('[data-quotes]');
  if (quoteBox) {
    var quotes = $$('.quote', quoteBox);
    var dotBox = $('[data-quote-dots]');
    var at = 0, timer = null;

    var dots = quotes.map(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Quote ' + (i + 1));
      b.addEventListener('click', function () { show(i); hold(); });
      if (dotBox) dotBox.appendChild(b);
      return b;
    });

    function show(i) {
      at = (i + quotes.length) % quotes.length;
      quotes.forEach(function (q, n) { q.classList.toggle('is-on', n === at); });
      dots.forEach(function (d, n) {
        if (n === at) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
    }
    function hold() {
      if (timer) window.clearInterval(timer);
      if (calm) return;
      timer = window.setInterval(function () { show(at + 1); }, 6500);
    }

    var prev = $('[data-quote-prev]');
    var next = $('[data-quote-next]');
    if (prev) prev.addEventListener('click', function () { show(at - 1); hold(); });
    if (next) next.addEventListener('click', function () { show(at + 1); hold(); });

    show(0);
    hold();
  }

  /* ----------------------------------------------------------  book wizard */
  var wiz = $('[data-wiz]');
  if (wiz) {
    var panes = $$('[data-pane]', wiz);
    var fill  = $('[data-wiz-fill]');
    var num   = $('[data-wiz-n]');
    var back  = $('[data-wiz-back]');
    var fwd   = $('[data-wiz-next]');
    var send  = $('[data-wiz-send]');
    var step  = 0;

    function draw() {
      panes.forEach(function (p, i) { p.classList.toggle('is-on', i === step); });
      if (fill) fill.style.width = ((step + 1) / panes.length * 100) + '%';
      if (num)  num.textContent = String(step + 1);
      if (back) back.hidden = step === 0;
      if (fwd)  fwd.hidden  = step === panes.length - 1;
      if (send) send.hidden = step !== panes.length - 1;
    }

    function warn(pane, text) {
      var box = $('.pane__err', pane);
      if (!box) {
        box = document.createElement('p');
        box.className = 'pane__err';
        box.setAttribute('role', 'alert');
        pane.appendChild(box);
      }
      box.textContent = text;
    }
    function clearWarn(pane) {
      var box = $('.pane__err', pane);
      if (box) box.remove();
    }

    function valid(i) {
      var pane = panes[i];
      var radios = $$('input[type="radio"]', pane);
      if (radios.length) {
        var picked = radios.some(function (r) { return r.checked; });
        if (!picked) { warn(pane, 'Pick one to carry on.'); return false; }
        clearWarn(pane);
        return true;
      }
      var ok = true;
      $$('input[required]', pane).forEach(function (f) {
        var good = f.type === 'email'
          ? /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.value.trim())
          : f.value.trim().length > 1;
        f.classList.toggle('bad', !good);
        if (!good && ok) { f.focus(); ok = false; }
      });
      if (!ok) warn(pane, 'A name, a telephone and an email, please.');
      else clearWarn(pane);
      return ok;
    }

    if (fwd) fwd.addEventListener('click', function () {
      if (!valid(step)) return;
      step = Math.min(panes.length - 1, step + 1);
      draw();
    });
    if (back) back.addEventListener('click', function () {
      step = Math.max(0, step - 1);
      draw();
    });

    $$('input', wiz).forEach(function (f) {
      f.addEventListener('change', function () { clearWarn(f.closest('[data-pane]')); });
      f.addEventListener('input',  function () { f.classList.remove('bad'); });
    });

    wiz.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valid(step)) return;

      function pick(name) {
        var r = wiz.querySelector('input[name="' + name + '"]:checked');
        return r ? r.value : '—';
      }
      var name = (wiz.querySelector('[name="name"]') || {}).value || '';
      var panel = document.createElement('div');
      panel.className = 'sent__panel';
      panel.setAttribute('role', 'status');
      panel.innerHTML =
        '<p class="kicker">Solicitud recibida</p>' +
        '<h3>Gracias, ' + name.split(/[\s,]+/)[0].replace(/[<>&]/g, '') + '.</h3>' +
        '<p>Reception will telephone you within one working day to fix an exact ' +
        'time. Nothing has been charged. If anything on your skin changes before ' +
        'then, call +52 55 4172 6080 rather than waiting.</p>' +
        '<dl>' +
          '<div><dt>Concern</dt><dd>' + pick('concern') + '</dd></div>' +
          '<div><dt>Phototype</dt><dd>' + pick('type') + '</dd></div>' +
          '<div><dt>When</dt><dd>' + pick('when') + '</dd></div>' +
        '</dl>';

      wiz.classList.add('sent');
      wiz.parentNode.insertBefore(panel, wiz);
      panel.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    });

    draw();
  }

  /* ----------------------------------------------------------------  year */
  var year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
