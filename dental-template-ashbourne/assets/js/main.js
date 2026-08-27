/* =========================================================
   Ashbourne & Wade — template behaviour
   Vanilla JS, no dependencies, no build step.
   ========================================================= */
(function () {
  'use strict';

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- reveal on scroll ---------- */
  function rises() {
    var items = [].slice.call(document.querySelectorAll('[data-rise]'));
    if (!items.length) return;

    items.forEach(function (el) {
      var d = el.getAttribute('data-delay');
      if (d) el.style.setProperty('--d', d + 'ms');
    });

    if (calm) {
      items.forEach(function (el) { el.classList.add('in'); });
      return;
    }

    var queued = false;
    function check() {
      queued = false;
      var line = window.innerHeight * 0.9;
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

  /* ---------- masthead: condense, and mark the section you are in ---------- */
  function masthead() {
    var mast = document.querySelector('[data-mast]');
    if (!mast) return;

    var links = [].slice.call(document.querySelectorAll('.mast__nav a[href^="#"]'));
    var map = links.map(function (a) {
      return { a: a, sec: document.querySelector(a.getAttribute('href')) };
    }).filter(function (o) { return o.sec; });

    var queued = false;
    function paint() {
      queued = false;
      mast.classList.toggle('is-tight', window.scrollY > 90);

      var y = window.scrollY + 160;
      var live = null;
      map.forEach(function (o) { if (o.sec.offsetTop <= y) live = o.a; });
      links.forEach(function (a) { a.classList.toggle('is-on', a === live); });
    }
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }

  /* ---------- drawer ---------- */
  function drawer() {
    var btn = document.querySelector('[data-burger]');
    var panel = document.querySelector('[data-drawer]');
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
      window.setTimeout(function () { panel.hidden = true; }, calm ? 0 : 380);
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

  /* ---------- the tooth chart ---------- */
  var GROUPS = {
    incisors: {
      name: 'Incisors',
      count: 'Eight teeth',
      note: 'The four at the front, top and bottom. These are the teeth people notice, ' +
            'and the ones that chip on a bottle, a fork or a fall.',
      items: [
        ['Composite bonding, per tooth', '£190'],
        ['Porcelain veneer', 'from £720'],
        ['Whitening, take-home trays', '£320'],
        ['Aligners, front crowding', 'from £2,200']
      ]
    },
    canines: {
      name: 'Canines',
      count: 'Four teeth',
      note: 'The corner teeth. They take the strain when you tear at something, and they ' +
            'are the first to wear flat if you grind in your sleep.',
      items: [
        ['Composite build-up', '£190'],
        ['Night guard, laboratory-made', '£240'],
        ['Aligners, both arches', 'from £2,200']
      ]
    },
    premolars: {
      name: 'Premolars',
      count: 'Eight teeth',
      note: 'Between the canines and the molars, and where most first fillings happen. ' +
            'Caught early, work here is quick and cheap.',
      items: [
        ['White filling', 'from £160'],
        ['Onlay, laboratory-made', 'from £520'],
        ['Fissure sealant', '£45']
      ]
    },
    molars: {
      name: 'Molars',
      count: 'Eight teeth',
      note: 'The grinding teeth. They do the work, they crack under it, and they are ' +
            'where root canal treatment usually turns out to be needed.',
      items: [
        ['White filling', 'from £180'],
        ['Root canal treatment', 'from £420'],
        ['Crown, made downstairs', 'from £680'],
        ['Extraction', 'from £180']
      ]
    },
    wisdom: {
      name: 'Wisdom teeth',
      count: 'Four teeth',
      note: 'The last four to arrive, and the only ones we are glad to see the back of. ' +
            'Half never cause a day of trouble; the other half are better out.',
      items: [
        ['Assessment, with X-ray', '£68'],
        ['Simple extraction', 'from £180'],
        ['Surgical removal', 'from £320']
      ]
    }
  };

  /* which group each of the sixteen positions belongs to, temple to temple */
  var PATTERN = [
    'wisdom', 'molars', 'molars', 'premolars', 'premolars', 'canines',
    'incisors', 'incisors', 'incisors', 'incisors',
    'canines', 'premolars', 'premolars', 'molars', 'molars', 'wisdom'
  ];
  var SIZE = {
    wisdom:    [22, 24],
    molars:    [24, 26],
    premolars: [19, 24],
    canines:   [17, 28],
    incisors:  [15, 25]
  };

  function chart() {
    var host = document.querySelector('[data-arch]');
    var chips = [].slice.call(document.querySelectorAll('.chip[data-group]'));
    if (!host || !chips.length) return;

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '48 46 464 378');
    svg.setAttribute('role', 'presentation');

    function line(y) {
      var l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', 112); l.setAttribute('x2', 448);
      l.setAttribute('y1', y);  l.setAttribute('y2', y);
      l.setAttribute('class', 'chart__mid');
      svg.appendChild(l);
    }
    function caption(text, x, y) {
      var t = document.createElementNS(NS, 'text');
      t.setAttribute('x', x); t.setAttribute('y', y);
      t.setAttribute('class', 'chart__cap');
      t.textContent = text;
      svg.appendChild(t);
    }

    /* teeth are spread over 150° rather than a full half-turn, so the two
       arches read as horseshoes facing each other instead of one ring */
    function build(which) {
      var cy = which === 'upper' ? 206 : 264;
      for (var i = 0; i < 16; i++) {
        var group = PATTERN[i];
        var step = 150 / 16;
        var deg = (which === 'upper' ? 195 : 15) + (i + 0.5) * step;
        var rad = deg * Math.PI / 180;
        var x = 280 + 205 * Math.cos(rad);
        var y = cy + 132 * Math.sin(rad);
        var w = SIZE[group][0];
        var h = SIZE[group][1];

        var g = document.createElementNS(NS, 'g');
        g.setAttribute('class', 'tooth');
        g.setAttribute('data-group', group);
        g.setAttribute('transform',
          'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') rotate(' + (deg + 90).toFixed(1) + ')');

        /* a transparent pad first, so small teeth stay easy to hit on a phone */
        var pad = document.createElementNS(NS, 'rect');
        pad.setAttribute('x', (-(w + 13) / 2).toFixed(1));
        pad.setAttribute('y', (-(h + 11) / 2).toFixed(1));
        pad.setAttribute('width', w + 13);
        pad.setAttribute('height', h + 11);
        pad.setAttribute('fill', 'transparent');
        g.appendChild(pad);

        var r = document.createElementNS(NS, 'rect');
        r.setAttribute('class', 'tooth__b');
        r.setAttribute('x', (-w / 2).toFixed(1));
        r.setAttribute('y', (-h / 2).toFixed(1));
        r.setAttribute('width', w);
        r.setAttribute('height', h);
        r.setAttribute('rx', 4);
        g.appendChild(r);

        var hint = document.createElementNS(NS, 'title');
        hint.textContent = GROUPS[group].name;
        g.appendChild(hint);

        svg.appendChild(g);
      }
    }

    build('upper');
    build('lower');
    line(235);
    caption('Upper', 54, 226);
    caption('Lower', 54, 255);
    host.appendChild(svg);

    var teeth = [].slice.call(svg.querySelectorAll('.tooth'));
    var elCount = document.querySelector('[data-c-count]');
    var elName = document.querySelector('[data-c-name]');
    var elNote = document.querySelector('[data-c-note]');
    var elList = document.querySelector('[data-c-list]');

    function select(key) {
      var g = GROUPS[key];
      if (!g) return;

      chips.forEach(function (c) {
        var on = c.getAttribute('data-group') === key;
        c.classList.toggle('is-on', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      teeth.forEach(function (t) {
        t.classList.toggle('is-on', t.getAttribute('data-group') === key);
      });

      elCount.textContent = g.count;
      elName.textContent = g.name;
      elNote.textContent = g.note;
      elList.innerHTML = g.items.map(function (row) {
        return '<li><span>' + row[0] + '</span><i></i><b>' + row[1] + '</b></li>';
      }).join('');
    }

    chips.forEach(function (c) {
      c.addEventListener('click', function () { select(c.getAttribute('data-group')); });
    });
    teeth.forEach(function (t) {
      t.addEventListener('click', function () { select(t.getAttribute('data-group')); });
    });

    select('incisors');
  }

  /* ---------- booking, answered with a stamp ---------- */
  function booking() {
    var form = document.querySelector('[data-form]');
    var stamp = document.querySelector('[data-stamp]');
    if (!form || !stamp) return;

    var err = form.querySelector('[data-err]');
    var elDate = stamp.querySelector('[data-stamp-date]');
    var elRef = stamp.querySelector('[data-stamp-ref]');
    var elSay = stamp.querySelector('[data-stamp-say]');
    var reset = stamp.querySelector('[data-reset]');

    function picked(name) {
      var el = form.querySelector('input[name="' + name + '"]:checked');
      return el ? el.value : '';
    }
    function dayWords() {
      var v = form.elements.day.value;
      if (!v) return '';
      var d = new Date(v + 'T00:00:00');
      return isNaN(d) ? '' : d.toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long'
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name;
      var phone = form.elements.phone;
      var digits = phone.value.replace(/\D/g, '');
      [name, phone].forEach(function (f) { f.classList.remove('is-bad'); });

      if (!name.value.trim()) {
        name.classList.add('is-bad');
        err.textContent = 'Please give us a name to put on the request.';
        name.focus();
        return;
      }
      if (digits.length < 9) {
        phone.classList.add('is-bad');
        err.textContent = 'A telephone number of at least nine digits, so the desk can ring you.';
        phone.focus();
        return;
      }
      err.textContent = '';

      var first = name.value.trim().split(/\s+/)[0];
      var when = dayWords();
      var slot = picked('slot').toLowerCase();
      var reason = form.elements.reason.value.toLowerCase();
      var known = picked('known') === 'yes';

      elDate.textContent = new Date().toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      elRef.textContent = 'No. ' + Math.floor(1000 + Math.random() * 9000);

      elSay.textContent = 'Thank you, ' + first + '. The desk will ring ' + phone.value.trim() +
        ' with two or three times for ' + reason +
        (when ? ', starting with ' + when : '') +
        (slot === 'either' ? ', morning or afternoon' : ', in the ' + slot) + '. ' +
        (known ? 'We will have your notes out before you arrive.'
               : 'Your first visit is ninety minutes, and nothing is treated on the day.');

      form.hidden = true;
      stamp.hidden = false;
      stamp.scrollIntoView({ block: 'center' });
    });

    if (reset) {
      reset.addEventListener('click', function () {
        stamp.hidden = true;
        form.hidden = false;
        form.reset();
        form.elements.name.focus();
      });
    }
  }

  /* ---------- image fallback ---------- */
  function images() {
    [].slice.call(document.querySelectorAll('[data-img]')).forEach(function (img) {
      img.addEventListener('error', function () {
        img.style.visibility = 'hidden';
        if (img.parentElement) img.parentElement.style.background = '#F0E8DA';
      });
    });
  }

  /* ---------- year ---------- */
  function year() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  function boot() {
    rises();
    masthead();
    drawer();
    chart();
    booking();
    images();
    year();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
