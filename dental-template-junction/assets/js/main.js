/* Junction Dental — wayfinding system
   reveal · nav · drawer · station clock · network map
   journey planner · live service status · booking */

(function () {
  'use strict';

  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var pad = function (n) { return String(n).padStart(2, '0'); };

  /* ── data ───────────────────────────────────────────────────────────── */
  var LINES = {
    routine: {
      name: 'Routine',
      letter: 'g',
      chip: 'chip--g',
      dot: 'dotline--g',
      fare: '\u00a3110',
      stops: ['c0', 'g1', 'x1', 'g3', 'g4', 'g5']
    },
    restore: {
      name: 'Restore',
      letter: 'b',
      chip: 'chip--b',
      dot: 'dotline--b',
      fare: '\u00a3300\u2013\u00a3900',
      stops: ['c0', 'b1', 'x1', 'b3', 'b4', 'b5']
    },
    straighten: {
      name: 'Straighten',
      letter: 'a',
      chip: 'chip--a',
      dot: 'dotline--a',
      fare: '\u00a31,945\u2013\u00a32,745',
      stops: ['c0', 'a1', 'a2', 'a3', 'x2', 'a5']
    },
    replace: {
      name: 'Replace',
      letter: 'r',
      chip: 'chip--r',
      dot: 'dotline--r',
      fare: '\u00a32,630\u2013\u00a33,010',
      stops: ['c0', 'r1', 'r2', 'r3', 'x2', 'r5']
    }
  };

  var STOPS = {
    c0: {
      name: 'Consultation',
      short: 'Talking, looking, and a written plan',
      what: 'Where every route starts. Twenty minutes of talking, a proper look round your mouth, and a written plan with figures on it before anything at all is done.',
      mins: 30,
      fare: '\u00a342'
    },
    g1: {
      name: 'Examination',
      short: 'Charted tooth by tooth',
      what: 'Charting, soft tissues, and gums measured at six points on every tooth. You are told what we found in the order of what actually matters.',
      mins: 20,
      fare: '\u00a338'
    },
    x1: {
      name: 'X-rays',
      short: 'Two films, or a full set',
      what: 'Two small films or a full set, depending on what the examination turned up. Digital, low dose, and you look at them on the screen with us rather than being told about them.',
      mins: 10,
      fare: '\u00a312 \u2013 \u00a365'
    },
    g3: {
      name: 'Clean',
      short: 'Thirty minutes with the hygienist',
      what: 'Scale, polish, and the part where we show you the two places your brushing keeps missing. Nobody has ever been told off in this chair.',
      mins: 30,
      fare: '\u00a358'
    },
    g4: {
      name: 'Plan',
      short: 'Your own recall interval',
      what: 'A recall interval set at three, six or twelve months based on your risk rather than on a standard year. Written down, with the reasons.',
      mins: 10,
      fare: 'Included'
    },
    g5: {
      name: 'Six-month recall',
      short: 'The stop most people never leave',
      what: 'Terminus. Most people never travel any further than this line, and keeping them here is the entire point of the practice.',
      mins: 20,
      fare: '\u00a338'
    },
    b1: {
      name: 'Diagnosis',
      short: 'Finding out what is actually wrong',
      what: 'Working out whether the pain is the nerve, the gum, or the filling next door. Cold tests, a tap test, and honesty about what is not certain yet.',
      mins: 20,
      fare: '\u00a338'
    },
    b3: {
      name: 'Treatment',
      short: 'Filling, onlay or root canal',
      what: 'Numbed properly, tested before we start, and stopped the moment you raise a hand. Long appointments get a break in the middle whether you ask or not.',
      mins: 75,
      fare: '\u00a3145 \u2013 \u00a3680'
    },
    b4: {
      name: 'Crown or onlay',
      short: 'Scanned here, made a mile away',
      what: 'Scanned rather than moulded, made by a lab a mile from this door, and fitted a fortnight later. The temporary in between is one you can eat with.',
      mins: 45,
      fare: '\u00a3590 \u2013 \u00a3695'
    },
    b5: {
      name: 'Bite check',
      short: 'Ten minutes, a week later, free',
      what: 'Terminus. A filling that feels high is a filling that fails, so everyone comes back for ten minutes and there is no charge for it.',
      mins: 10,
      fare: 'Free'
    },
    a1: {
      name: 'Scan',
      short: 'A digital scan, no putty',
      what: 'A digital scan of both arches in about four minutes. No trays of impression material, no gagging, and the file is yours to take elsewhere.',
      mins: 20,
      fare: '\u00a395'
    },
    a2: {
      name: 'Preview',
      short: 'See the result before you commit',
      what: 'The finished result as a simulation, side by side with where you are now. Plenty of people look at this and decide they are happy as they are.',
      mins: 20,
      fare: 'Included'
    },
    a3: {
      name: 'Aligners',
      short: 'Twenty-two hours a day',
      what: 'Trays issued in sets and worn twenty-two hours a day. Six to fourteen months, and you are told which at the preview rather than at the end.',
      mins: 30,
      fare: '\u00a31,850 \u2013 \u00a32,650'
    },
    x2: {
      name: 'Review',
      short: 'Progress checked, plan adjusted',
      what: 'Fifteen minutes to check progress and adjust the plan. Aligner cases and implant cases both come through this stop, which is why it is an interchange.',
      mins: 15,
      fare: 'Included'
    },
    a5: {
      name: 'Retainers',
      short: 'The stop nobody should skip',
      what: 'Terminus. A fixed retainer behind the teeth and a night guard over them. Teeth drift back within a year if you decide to skip this one.',
      mins: 30,
      fare: '\u00a3180'
    },
    r1: {
      name: 'CT scan',
      short: 'Seeing the bone first',
      what: 'A 3D scan to measure the bone you have. If there is not enough of it you find out here, at the start, rather than half way through a surgery.',
      mins: 20,
      fare: '\u00a3180'
    },
    r2: {
      name: 'Extraction',
      short: 'Only if it cannot be kept',
      what: 'Only when the tooth is genuinely beyond keeping, and we would far rather keep it. Grafted at the same time where that protects the site.',
      mins: 40,
      fare: '\u00a3160'
    },
    r3: {
      name: 'Implant placed',
      short: 'Forty minutes under local',
      what: 'Pressure and noise, no pain, and a temporary tooth the same day wherever the bone allows one. Sedation available if you would rather not be present for it.',
      mins: 60,
      fare: '\u00a32,450'
    },
    r5: {
      name: 'New tooth',
      short: 'Fitted, torqued, recorded',
      what: 'Terminus. The crown is fitted, the torque is recorded in your notes, and an annual check keeps the ten-year guarantee alive.',
      mins: 45,
      fare: 'Included'
    }
  };

  /* ── reveal ─────────────────────────────────────────────────────────── */
  function reveal() {
    var targets = qa('.rise');
    if (!('IntersectionObserver' in window) || calm) {
      targets.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var sibs = Array.prototype.filter.call(el.parentNode.children, function (c) {
          return c.classList.contains('rise');
        });
        var i = Math.max(0, sibs.indexOf(el));
        setTimeout(function () { el.classList.add('is-in'); }, Math.min(i, 6) * 80);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ── nav state ──────────────────────────────────────────────────────── */
  function nav() {
    var links = qa('.nav a');
    var sects = links
      .map(function (a) { return q(a.getAttribute('href')); })
      .filter(Boolean);
    if (!sects.length) return;

    var tick = false;
    function paint() {
      var y = scrollY + Math.min(320, innerHeight * 0.35);
      var cur = null;
      sects.forEach(function (s) { if (s.offsetTop <= y) cur = s; });
      links.forEach(function (a) {
        a.classList.toggle('is-here', !!cur && a.getAttribute('href') === '#' + cur.id);
      });
    }
    addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () { paint(); tick = false; });
    }, { passive: true });
    paint();
  }

  /* ── drawer ─────────────────────────────────────────────────────────── */
  function drawer() {
    var tog = q('.tog');
    var box = q('#drawer');
    if (!tog || !box) return;

    function set(open) {
      tog.setAttribute('aria-expanded', String(open));
      box.hidden = !open;
      document.body.style.overflow = open ? 'hidden' : '';
    }
    tog.addEventListener('click', function () {
      set(tog.getAttribute('aria-expanded') !== 'true');
    });
    box.addEventListener('click', function (e) {
      if (e.target.closest('a')) set(false);
    });
    addEventListener('keydown', function (e) {
      if (e.key === 'Escape') set(false);
    });
    matchMedia('(min-width: 961px)').addEventListener('change', function (m) {
      if (m.matches) set(false);
    });
  }

  /* ── station clock ──────────────────────────────────────────────────── */
  function clock() {
    var el = q('[data-clock]');
    if (!el) return;
    function paint() {
      var d = new Date();
      el.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }
    paint();
    setInterval(paint, 1000);
  }

  /* ── the map ────────────────────────────────────────────────────────── */
  var map = (function () {
    var state = { line: 'routine', stop: 'c0' };
    var api = {};

    function stopLines(id) {
      return Object.keys(LINES).filter(function (k) {
        return LINES[k].stops.indexOf(id) > -1;
      });
    }

    function paintCard() {
      var d = STOPS[state.stop];
      if (!d) return;
      var line = LINES[state.line];
      var served = stopLines(state.stop);
      var chip = q('[data-card-chip]');

      chip.className = 'chip ' + line.chip;
      chip.textContent = line.name;
      q('[data-card-name]').textContent = d.name;
      q('[data-card-what]').textContent = d.what;
      q('[data-card-mins]').textContent = d.mins + ' min';
      q('[data-card-fare]').textContent = d.fare;
      q('[data-card-served]').textContent =
        served.length === 4
          ? 'Every route'
          : served
              .map(function (k) { return LINES[k].name; })
              .join(' and ');

      var i = line.stops.indexOf(state.stop);
      var live = q('[data-live]');
      if (live) {
        live.textContent =
          d.name + ', stop ' + (i + 1) + ' of ' + line.stops.length + ' on the ' + line.name +
          ' route. ' + d.what;
      }
    }

    function paintMap() {
      qa('.stop').forEach(function (g) {
        g.classList.toggle('is-on', g.dataset.stop === state.stop);
      });
    }

    api.go = function (id, line) {
      if (!STOPS[id]) return;
      var lines = stopLines(id);
      if (line && lines.indexOf(line) > -1) state.line = line;
      else if (lines.indexOf(state.line) === -1) state.line = lines[0];
      state.stop = id;
      paintMap();
      paintCard();
    };

    api.step = function (n) {
      var list = LINES[state.line].stops;
      var i = list.indexOf(state.stop) + n;
      if (i < 0) i = list.length - 1;
      if (i >= list.length) i = 0;
      api.go(list[i], state.line);
      var g = q('.stop[data-stop="' + state.stop + '"]');
      if (g) g.focus({ preventScroll: true });
    };

    api.filter = function (key) {
      var net = q('.net');
      qa('.fil .pill').forEach(function (b) {
        b.classList.toggle('is-on', b.dataset.line === key);
      });
      if (key === 'all') {
        net.classList.remove('is-fil');
        qa('.ln, .rname, .stop, .xlink').forEach(function (e) { e.classList.remove('is-lit'); });
        return;
      }
      net.classList.add('is-fil');
      qa('.ln').forEach(function (p) { p.classList.toggle('is-lit', p.dataset.line === key); });
      qa('.rname').forEach(function (t) {
        t.classList.toggle('is-lit', t.classList.contains('rname--' + LINES[key].letter));
      });
      qa('.stop, .xlink').forEach(function (g) {
        g.classList.toggle('is-lit', (g.dataset.line || '').split(' ').indexOf(key) > -1);
      });
      api.go(LINES[key].stops[1], key);
    };

    api.init = function () {
      if (!q('.net')) return;

      qa('.stop').forEach(function (g) {
        var id = g.dataset.stop;
        var lines = (g.dataset.line || '').split(' ');
        g.addEventListener('click', function () {
          q('.net').classList.remove('is-fil');
          qa('.fil .pill').forEach(function (b) {
            b.classList.toggle('is-on', b.dataset.line === 'all');
          });
          api.go(id, lines[0]);
        });
        g.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            g.click();
          } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            api.go(id, lines[0]);
            api.step(1);
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            api.go(id, lines[0]);
            api.step(-1);
          }
        });
      });

      qa('.fil .pill').forEach(function (b) {
        b.addEventListener('click', function () { api.filter(b.dataset.line); });
      });

      q('[data-prev]').addEventListener('click', function () { api.step(-1); });
      q('[data-next]').addEventListener('click', function () { api.step(1); });

      api.go('c0', 'routine');
    };

    return api;
  })();

  /* ── journey planner ────────────────────────────────────────────────── */
  function planner() {
    var opts = qa('.opt');
    var box = q('[data-itin]');
    if (!opts.length || !box) return;
    var empty = q('[data-plan-empty]');
    var list = q('[data-itin-list]');

    function hours(m) {
      if (m < 60) return m + ' min';
      var h = Math.floor(m / 60);
      var r = m % 60;
      return h + ' h' + (r ? ' ' + r : '');
    }

    opts.forEach(function (b) {
      b.addEventListener('click', function () {
        var key = b.dataset.pick;
        var line = LINES[key];
        opts.forEach(function (o) { o.classList.toggle('is-on', o === b); });

        q('[data-itin-name]').textContent = line.name;
        var total = 0;
        list.innerHTML = line.stops
          .map(function (id) {
            var s = STOPS[id];
            total += s.mins;
            return (
              '<li><span class="itin__i" aria-hidden="true"></span>' +
              '<span class="itin__n">' + s.name + '<small>' + s.short + '</small></span>' +
              '<span class="itin__m">' + s.mins + ' min</span></li>'
            );
          })
          .join('');
        list.style.color = 'var(--' + line.letter + ')';

        q('[data-itin-stops]').textContent = line.stops.length;
        q('[data-itin-mins]').textContent = hours(total);
        q('[data-itin-fare]').textContent = line.fare;

        box.hidden = false;
        if (empty) empty.hidden = true;

        var sel = q('[data-route]');
        if (sel) sel.value = key;
        map.filter(key);
      });
    });
  }

  /* ── live service status ────────────────────────────────────────────── */
  function status() {
    var pill = q('[data-open-pill]');
    var note = q('[data-open-note]');
    if (!pill) return;

    var week = [null, [8, 18], [8, 20], [8, 18], [8, 18], [8, 16], [9, 13]];
    var names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    var now = new Date();
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var today = week[day];

    if (today && mins >= today[0] * 60 && mins < today[1] * 60) {
      pill.className = 'st st--ok';
      pill.textContent = 'Open now';
      note.textContent = 'Until ' + pad(today[1]) + '.00 today';
      return;
    }

    if (today && mins < today[0] * 60) {
      pill.className = 'st st--few';
      pill.textContent = 'Closed';
      note.textContent = 'Opens at ' + pad(today[0]) + '.00 this morning';
      return;
    }

    var i = 1;
    while (i < 8 && !week[(day + i) % 7]) i += 1;
    var nd = (day + i) % 7;
    pill.className = 'st st--no';
    pill.textContent = 'Closed';
    note.textContent =
      'Opens ' + (i === 1 ? 'tomorrow' : names[nd]) + ' at ' + pad(week[nd][0]) + '.00';
  }

  /* ── booking ────────────────────────────────────────────────────────── */
  function booking() {
    var form = q('[data-bk]');
    if (!form) return;
    var done = q('[data-done]');
    var err = q('[data-err]');
    var when = 'Morning';

    qa('[data-when] button').forEach(function (b) {
      b.addEventListener('click', function () {
        qa('[data-when] button').forEach(function (x) { x.classList.toggle('is-on', x === b); });
        when = b.dataset.v;
      });
    });

    var TIME = { Morning: '09:40', Afternoon: '15:20', 'Late, Tuesday': '18:40' };
    var days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    var mons = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = q('[data-name]', form).value.trim();
      var tel = q('[data-tel]', form).value.trim();
      var mail = q('[data-email]', form).value.trim();
      var ok =
        name.length > 1 &&
        tel.replace(/\D/g, '').length >= 9 &&
        /^[^@\s]+@[^@\s]+\.\w{2,}$/.test(mail);

      if (!ok) {
        err.hidden = false;
        return;
      }
      err.hidden = true;

      var key = q('[data-route]', form).value;
      var line = LINES[key] || { name: 'Emergency', dot: 'dotline--k' };

      var raw = q('[data-day]', form).value;
      var d = raw ? new Date(raw + 'T09:00') : new Date(Date.now() + 864e5 * 2);
      if (isNaN(d.getTime())) d = new Date(Date.now() + 864e5 * 2);

      q('[data-done-ref]').textContent =
        'JD-' + String(((Date.now() / 1000) | 0) % 9000 + 1000);
      q('[data-done-time]').textContent = TIME[when] || '09:40';
      q('[data-done-route]').innerHTML =
        '<span class="dotline ' + line.dot + '"></span>' + line.name;
      q('[data-done-day]').textContent =
        days[d.getDay()] + ' ' + d.getDate() + ' ' + mons[d.getMonth()];
      q('[data-done-name]').innerHTML =
        'Held for <b>' + name.replace(/[<>&]/g, '') + '</b> \u00b7 we will ring to confirm the exact time';

      form.hidden = true;
      done.hidden = false;
      done.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
      var ref = q('[data-done-ref]');
      ref.setAttribute('tabindex', '-1');
      ref.focus();
    });

    q('[data-again]').addEventListener('click', function () {
      done.hidden = true;
      form.hidden = false;
      q('[data-name]', form).focus();
    });
  }

  /* ── odds and ends ──────────────────────────────────────────────────── */
  function bits() {
    var y = q('[data-year]');
    if (y) y.textContent = new Date().getFullYear();

    var day = q('[data-day]');
    if (day) {
      var t = new Date();
      day.min = t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
    }

    qa('img').forEach(function (im) {
      im.addEventListener('error', function () { im.style.visibility = 'hidden'; });
    });
  }

  function init() {
    reveal();
    nav();
    drawer();
    clock();
    map.init();
    planner();
    status();
    booking();
    bits();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
