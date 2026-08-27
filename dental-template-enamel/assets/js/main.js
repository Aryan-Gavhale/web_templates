/* =========================================================
   ENAMEL — template behaviour
   Vanilla JS, no dependencies, no build step.
   ========================================================= */
(function () {
  'use strict';

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function el(sel, root) { return (root || document).querySelector(sel); }
  function all(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }

  /* ---------- reveal ---------- */
  function pops() {
    var items = all('[data-pop]');
    items.forEach(function (n) {
      var d = n.getAttribute('data-delay');
      if (d) n.style.setProperty('--d', d + 'ms');
    });
    if (calm) { items.forEach(function (n) { n.classList.add('in'); }); return; }

    var queued = false;
    function check() {
      queued = false;
      var line = window.innerHeight * 0.92;
      for (var i = items.length - 1; i >= 0; i--) {
        if (items[i].getBoundingClientRect().top < line) {
          items[i].classList.add('in');
          items.splice(i, 1);
        }
      }
      if (!items.length) window.removeEventListener('scroll', onScroll);
    }
    function onScroll() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(check);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    check();
  }

  /* ---------- header, section marking, mobile dock ---------- */
  function chrome() {
    var bar = el('[data-bar]');
    var dock = el('[data-dock]');
    var hero = el('.hero');
    var book = el('#book');
    var links = all('.bar__nav a[href^="#"]');
    var map = links.map(function (a) {
      return { a: a, sec: el(a.getAttribute('href')) };
    }).filter(function (o) { return o.sec; });

    var queued = false;
    function paint() {
      queued = false;
      var y = window.scrollY;
      if (bar) bar.classList.toggle('is-stuck', y > 8);

      var live = null;
      map.forEach(function (o) { if (o.sec.offsetTop - 140 <= y) live = o.a; });
      links.forEach(function (a) { a.classList.toggle('is-on', a === live); });

      if (dock) {
        var past = hero ? y > hero.offsetHeight * 0.8 : y > 400;
        var atBook = book && book.getBoundingClientRect().top < window.innerHeight * 0.75;
        dock.classList.toggle('is-up', past && !atBook);
      }
    }
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }

  /* ---------- mobile sheet ---------- */
  function sheet() {
    var btn = el('[data-burger]');
    var panel = el('[data-sheet]');
    if (!btn || !panel) return;

    function open() {
      panel.hidden = false;
      requestAnimationFrame(function () { panel.classList.add('is-open'); });
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function shut() {
      panel.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      window.setTimeout(function () { panel.hidden = true; }, calm ? 0 : 280);
    }
    btn.addEventListener('click', function () {
      btn.getAttribute('aria-expanded') === 'true' ? shut() : open();
    });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) shut(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) shut();
    });
    window.matchMedia('(min-width: 1081px)').addEventListener('change', function (e) {
      if (e.matches && !panel.hidden) shut();
    });
  }

  /* ---------- treatment rail: drag, arrows, progress ---------- */
  function rail() {
    var strip = el('[data-rail]');
    var prog = el('[data-prog]');
    if (!strip) return;

    var down = false, startX = 0, startLeft = 0, moved = 0;

    function meter() {
      if (!prog) return;
      var max = strip.scrollWidth - strip.clientWidth;
      var pct = max > 4 ? strip.scrollLeft / max : 0;
      prog.style.width = (14 + pct * 86) + '%';
    }
    strip.addEventListener('scroll', function () { requestAnimationFrame(meter); }, { passive: true });
    window.addEventListener('resize', meter);

    strip.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'touch') return;
      down = true;
      moved = 0;
      startX = e.clientX;
      startLeft = strip.scrollLeft;
      strip.setPointerCapture(e.pointerId);
    });
    strip.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) {
        moved = dx;
        strip.classList.add('is-drag');
      }
      strip.scrollLeft = startLeft - dx;
    });
    function up() {
      if (!down) return;
      down = false;
      window.setTimeout(function () { strip.classList.remove('is-drag'); }, moved ? 40 : 0);
    }
    strip.addEventListener('pointerup', up);
    strip.addEventListener('pointercancel', up);

    all('[data-scroll]').forEach(function (b) {
      b.addEventListener('click', function () {
        var card = el('.card', strip);
        var step = card ? card.offsetWidth + 18 : 300;
        strip.scrollBy({ left: step * Number(b.getAttribute('data-scroll')), behavior: calm ? 'auto' : 'smooth' });
      });
    });

    meter();
  }

  /* ---------- the smile check ---------- */
  var QS = [
    {
      q: 'When did you last see a dentist?',
      a: [
        { t: 'Within the last year', k: 'recent' },
        { t: 'One to three years ago', k: 'gap' },
        { t: 'Longer than three years', k: 'long' },
        { t: 'I genuinely cannot remember', k: 'long' }
      ]
    },
    {
      q: 'What is bothering you most right now?',
      a: [
        { t: 'Nothing — I am just due', k: 'routine' },
        { t: 'Pain, or a tooth that broke', k: 'pain' },
        { t: 'The way my teeth look', k: 'looks' },
        { t: 'Bleeding or sore gums', k: 'gums' }
      ]
    },
    {
      q: 'How do you feel about the chair?',
      a: [
        { t: 'Fine — get on with it', k: 'ok' },
        { t: 'A bit nervous', k: 'nervy' },
        { t: 'I have been putting it off for years', k: 'dread' }
      ]
    },
    {
      q: 'If you could change one thing?',
      a: [
        { t: 'The colour', k: 'colour' },
        { t: 'The alignment', k: 'align' },
        { t: 'One specific tooth', k: 'tooth' },
        { t: 'Nothing — just keep them healthy', k: 'health' }
      ]
    }
  ];

  var OUTCOMES = {
    pain: {
      k: 'Book this first',
      h: 'An emergency slot.',
      d: 'Pain and breaks jump the queue here — we hold slots back every morning for exactly this.',
      price: '£40', len: '30 min',
      why: [
        'Seen the same day if you ring before ten',
        'Assessment, X-ray and a plan in one visit',
        'The £40 comes off the treatment if you go ahead'
      ],
      reason: 'Pain or a break'
    },
    gentle: {
      k: 'Book this first',
      h: 'A gentle first visit.',
      d: 'Sixty minutes, no treatment, no instruments unless you say so. A look, a talk and a plan you can take away.',
      price: '£65', len: '60 min',
      why: [
        'Nothing is treated on the day unless you ask',
        'Your notes are flagged so nobody rushes you',
        'Sedation available later for anything long'
      ],
      reason: 'A check-up'
    },
    gums: {
      k: 'Book this first',
      h: 'A hygiene assessment.',
      d: 'Bleeding gums are the one thing worth not waiting on. You get a full gum score and a plan to reverse it.',
      price: '£75', len: '50 min',
      why: [
        'Six-point gum chart, written down and dated',
        'Cleaning on the same visit if it is straightforward',
        'A brushing routine that takes two minutes, not ten'
      ],
      reason: 'Hygiene'
    },
    looks: {
      k: 'Book this first',
      h: 'A cosmetic consultation.',
      d: 'Free, twenty minutes, and no pressure. Photos and a scan, then the realistic options with prices next to them.',
      price: 'Free', len: '20 min',
      why: [
        'You see the simulated result before committing',
        'Whitening, bonding and aligners compared side by side',
        'A written quote that stands for six months'
      ],
      reason: 'Aligners or whitening'
    },
    routine: {
      k: 'Book this first',
      h: 'A check-up and hygiene.',
      d: 'The straightforward one. Forty-five minutes, two X-rays, a gum score and a plan only if you need one.',
      price: '£65', len: '45 min',
      why: [
        'Two X-rays and photographs included',
        'Hygiene in the same appointment where possible',
        'On a plan from £14.99 it is already covered'
      ],
      reason: 'A check-up'
    }
  };

  function quiz() {
    var box = el('[data-q-stage]');
    if (!box) return;

    var title = el('[data-q-title]');
    var opts = el('[data-q-opts]');
    var dots = el('[data-q-dots]');
    var now = el('[data-q-now]');
    var suffix = el('[data-q-of]');
    var back = el('[data-q-back]');
    var again = el('[data-q-again]');

    var at = 0;
    var picked = [];

    for (var i = 0; i < QS.length; i++) dots.appendChild(document.createElement('i'));
    var pips = all('i', dots);

    function verdict() {
      var k = picked;
      if (k.indexOf('pain') > -1) return OUTCOMES.pain;
      if (k.indexOf('dread') > -1) return OUTCOMES.gentle;
      if (k.indexOf('gums') > -1) return OUTCOMES.gums;
      if (k.indexOf('looks') > -1 || k.indexOf('colour') > -1 || k.indexOf('align') > -1) return OUTCOMES.looks;
      return OUTCOMES.routine;
    }

    function result() {
      var o = verdict();
      now.textContent = 'Done';
      suffix.textContent = '';
      pips.forEach(function (p) { p.classList.add('is-on'); });

      title.textContent = '';
      opts.innerHTML =
        '<p class="res__k">' + o.k + '</p>' +
        '<h3 class="res__h">' + o.h + '</h3>' +
        '<p class="res__d">' + o.d + '</p>' +
        '<dl class="res__facts">' +
          '<div><dt>Price</dt><dd>' + o.price + '</dd></div>' +
          '<div><dt>Length</dt><dd>' + o.len + '</dd></div>' +
        '</dl>' +
        '<ul class="res__list">' + o.why.map(function (w) {
          return '<li>' + w + '</li>';
        }).join('') + '</ul>' +
        '<div class="res__do"><a href="#book" class="btn btn--wide">Book it — takes 90 seconds</a></div>';

      back.hidden = true;
      again.hidden = false;

      /* carry the answer into the booking form */
      var target = all('[data-what] .opt').filter(function (b) {
        return b.getAttribute('data-val') === o.reason;
      })[0];
      if (target) target.click();
    }

    function draw() {
      if (at >= QS.length) return result();

      var q = QS[at];
      now.textContent = at + 1;
      suffix.textContent = 'of ' + QS.length;
      title.textContent = q.q;
      opts.innerHTML = '';

      q.a.forEach(function (a) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = a.t;
        b.addEventListener('click', function () {
          picked[at] = a.k;
          at++;
          draw();
        });
        opts.appendChild(b);
      });

      pips.forEach(function (p, i) { p.classList.toggle('is-on', i <= at); });
      back.hidden = at === 0;
      again.hidden = at === 0;
    }

    back.addEventListener('click', function () {
      if (at > 0) { at--; draw(); }
    });
    again.addEventListener('click', function () {
      at = 0;
      picked = [];
      draw();
    });

    draw();
  }

  /* ---------- booking ---------- */
  var TIMES = ['08:30', '09:15', '10:00', '10:45', '11:30', '13:00',
               '13:45', '14:30', '15:15', '16:00', '16:45', '17:30'];
  var DAY_S = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function booking() {
    var form = el('[data-form]');
    var flip = el('[data-flip]');
    if (!form || !flip) return;

    var dayBox = el('[data-days]');
    var timeBox = el('[data-times]');
    var whatBox = el('[data-what]');
    var line = el('[data-summary]');
    var err = el('[data-err]');
    var again = el('[data-again]');

    var day = null;   /* { date, i } */
    var time = null;
    var what = 'A check-up';

    /* next fortnight, Sundays closed */
    var dates = [];
    var cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (dates.length < 12) {
      if (cursor.getDay() !== 0) dates.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    dates.forEach(function (d, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      b.setAttribute('aria-pressed', 'false');
      b.setAttribute('aria-label', DAY_S[d.getDay()] + ' ' + d.getDate() + ' ' + MON_S[d.getMonth()]);
      b.innerHTML = '<i>' + DAY_S[d.getDay()] + '</i><b>' + d.getDate() + '</b>';
      b.addEventListener('click', function () {
        day = { date: d, i: i };
        all('.day', dayBox).forEach(function (o) {
          var on = o === b;
          o.classList.toggle('is-on', on);
          o.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        time = null;
        drawTimes();
        say();
      });
      dayBox.appendChild(b);
    });

    /* a stable pattern of gone slots, so the page looks alive but never shuffles */
    function open(dayIndex, timeIndex, date) {
      if (date.getDay() === 6 && timeIndex > 4) return false;
      return ((dayIndex + 1) * 17 + (timeIndex + 1) * 29) % 7 > 1;
    }

    function drawTimes() {
      timeBox.innerHTML = '';
      if (!day) {
        timeBox.innerHTML = '<p class="card__m">Pick a day first.</p>';
        return;
      }
      TIMES.forEach(function (t, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'time';
        b.textContent = t;
        b.setAttribute('aria-pressed', 'false');
        if (!open(day.i, i, day.date)) {
          b.disabled = true;
          b.setAttribute('aria-label', t + ', taken');
        } else {
          b.addEventListener('click', function () {
            time = t;
            all('.time', timeBox).forEach(function (o) {
              var on = o === b;
              o.classList.toggle('is-on', on);
              o.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            say();
          });
        }
        timeBox.appendChild(b);
      });
    }

    all('.opt', whatBox).forEach(function (b) {
      b.setAttribute('aria-pressed', b.classList.contains('is-on') ? 'true' : 'false');
      b.addEventListener('click', function () {
        what = b.getAttribute('data-val');
        all('.opt', whatBox).forEach(function (o) {
          var on = o === b;
          o.classList.toggle('is-on', on);
          o.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        say();
      });
    });

    function words() {
      if (!day) return '';
      return DAY_S[day.date.getDay()] + ' ' + day.date.getDate() + ' ' + MON_S[day.date.getMonth()];
    }
    function say() {
      if (!day) { line.textContent = 'Choose a day and a time to get started.'; return; }
      if (!time) { line.textContent = words() + ' — now pick a time.'; return; }
      line.textContent = words() + ', ' + time + ' · ' + what;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name;
      var phone = form.elements.phone;
      [name, phone].forEach(function (f) { f.classList.remove('is-bad'); });

      if (!day || !time) {
        err.textContent = 'Pick a day and a time first.';
        (day ? timeBox : dayBox).scrollIntoView({ block: 'center' });
        return;
      }
      if (!name.value.trim()) {
        name.classList.add('is-bad');
        err.textContent = 'We need a name for the appointment.';
        name.focus();
        return;
      }
      if (phone.value.replace(/\D/g, '').length < 9) {
        phone.classList.add('is-bad');
        err.textContent = 'A mobile number, so we can text you the confirmation.';
        phone.focus();
        return;
      }
      err.textContent = '';

      el('[data-done-when]').textContent = words() + ', ' + time;
      el('[data-done-what]').textContent = what + ' with ' +
        (what === 'Hygiene' ? 'Marisa Ferreira' : 'Dr. Theo Bakare') + '.';
      el('[data-done-ref]').textContent = 'EN-' + Math.floor(1000 + Math.random() * 9000);
      el('[data-done-tel]').textContent = phone.value.trim();

      var backFace = el('[data-back]');
      flip.classList.add('is-done');
      backFace.setAttribute('aria-hidden', 'false');
      form.setAttribute('aria-hidden', 'true');
      flip.scrollIntoView({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
      window.setTimeout(function () { el('[data-done-when]').setAttribute('tabindex', '-1'); el('[data-done-when]').focus(); }, calm ? 0 : 600);
    });

    if (again) {
      again.addEventListener('click', function () {
        flip.classList.remove('is-done');
        el('[data-back]').setAttribute('aria-hidden', 'true');
        form.setAttribute('aria-hidden', 'false');
        form.reset();
        day = null;
        time = null;
        all('.day', dayBox).forEach(function (o) {
          o.classList.remove('is-on');
          o.setAttribute('aria-pressed', 'false');
        });
        drawTimes();
        say();
        window.setTimeout(function () { form.elements.name.focus(); }, calm ? 0 : 600);
      });
    }

    drawTimes();
    say();
  }

  /* ---------- images, year ---------- */
  function bits() {
    all('[data-img]').forEach(function (img) {
      img.addEventListener('error', function () {
        img.style.visibility = 'hidden';
      });
    });
    var y = el('[data-year]');
    if (y) y.textContent = new Date().getFullYear();
  }

  function boot() {
    pops();
    chrome();
    sheet();
    rail();
    quiz();
    booking();
    bits();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
