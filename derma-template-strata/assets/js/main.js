/* =========================================================================
   STRATA — behaviour
   1. depth gauge: reads out which stratum the reader is in
   2. the plate: each layer opens, and the layer visibly thickens
   3. the lesion: an ABCDE demonstrator drawn entirely in CSS
   4. the request form
   Everything degrades: with JavaScript off the notes are shut but the copy
   is all present, the form posts normally, and the gauge simply sits still.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = 'IntersectionObserver' in window;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  }

  /* ------------------------------------------------------------ 0. reveal */

  /* The same list the stylesheet hides. Kept in one string so the two
     cannot drift apart. */
  var RISE = '.hero__copy, .plate, .sh, .lesion, .trio, .reach, .grid2,' +
             '.scale, .who, .two, .fees, .notices, .foot__grid';

  var risers = $$(RISE);

  if (calm || !io) {
    risers.forEach(function (el) { el.classList.add('in'); });
    $$('.plate, .reach__list').forEach(function (el) { el.classList.add('in'); });
  } else {
    var rise = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        rise.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    risers.forEach(function (el) { rise.observe(el); });

    /* the plate draws its bands downward, one stratum at a time */
    var draw = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var kids = $$('.lay__band, .reach__b i', e.target);
        kids.forEach(function (k, i) { k.style.setProperty('--d', (i * 110) + 'ms'); });
        e.target.classList.add('in');
        draw.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    $$('.plate, .reach__list').forEach(function (el) { draw.observe(el); });

    /* Hidden copy is worse than unanimated copy. */
    window.setTimeout(function () {
      $$(RISE + ', .reach__list').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
      });
    }, 2400);
  }

  /* ------------------------------------------------------- 1. depth gauge */

  var gauge = $('[data-gauge]');
  if (gauge) {
    var val = $('[data-gauge-val]', gauge);
    var unit = $('.gauge__read span', gauge);
    var name = $('[data-gauge-name]', gauge);
    var cursor = $('[data-gauge-cursor]', gauge);
    var spine = $('.gauge__spine', gauge);
    var ticks = $$('.gauge__tick', gauge);
    var zones = $$('[data-depth]');

    function place(id) {
      var tick = null;
      ticks.forEach(function (t) {
        var on = t.getAttribute('data-tick') === id;
        t.classList.toggle('on', on);
        if (on) tick = t;
      });
      if (!tick || !cursor) return;
      cursor.style.top = (tick.offsetTop + tick.offsetHeight / 2) + 'px';
    }

    function show(sec) {
      var d = sec.getAttribute('data-depth');
      if (val) val.textContent = d;
      /* no unit where there is no depth — "— mm" reads like a fault */
      if (unit) unit.textContent = /\d/.test(d) ? 'mm' : '';
      if (name) name.textContent = sec.getAttribute('data-name') || '';
      place(sec.id);
    }

    ticks.forEach(function (t) {
      t.addEventListener('click', function () {
        var sec = document.getElementById(t.getAttribute('data-tick'));
        if (sec) sec.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
      });
    });

    if (io && zones.length) {
      /* A band across the upper third of the viewport decides which stratum
         we are in — the same way a scale is read against a fixed line. */
      var seen = {};
      var watch = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { seen[e.target.id] = e.isIntersecting; });
        for (var i = zones.length - 1; i >= 0; i--) {
          if (seen[zones[i].id]) { show(zones[i]); return; }
        }
      }, { rootMargin: '-22% 0px -68% 0px', threshold: 0 });
      zones.forEach(function (z) { watch.observe(z); });
    }

    if (zones.length) show(zones[0]);
    window.addEventListener('resize', function () {
      var on = $('.gauge__tick.on', gauge);
      if (on && cursor) cursor.style.top = (on.offsetTop + on.offsetHeight / 2) + 'px';
    });
    void spine;
  }

  /* ---------------------------------------------------------- 2. contents */

  var sheet = $('[data-sheet]');
  var opener = $('[data-sheet-open]');
  var last = null;

  function openSheet() {
    if (!sheet) return;
    last = document.activeElement;
    sheet.hidden = false;
    root.classList.add('lock');
    if (opener) opener.setAttribute('aria-expanded', 'true');
    var first = $('a, button', sheet);
    if (first) first.focus();
  }
  function closeSheet() {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    root.classList.remove('lock');
    if (opener) opener.setAttribute('aria-expanded', 'false');
    if (last && last.focus) last.focus();
  }

  if (opener) opener.addEventListener('click', openSheet);
  $$('[data-sheet-close]').forEach(function (b) {
    b.addEventListener('click', closeSheet);
  });
  $$('[data-jump]').forEach(function (a) {
    a.addEventListener('click', closeSheet);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !sheet || sheet.hidden) return;
    closeSheet();
  });
  if (sheet) {
    sheet.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button', sheet).filter(function (el) {
        return el.offsetParent !== null;
      });
      if (!f.length) return;
      var first = f[0], lastEl = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault(); first.focus();
      }
    });
  }

  /* --------------------------------------------------------- 3. the plate */

  $$('.lay__btn').forEach(function (btn) {
    var note = btn.parentNode.querySelector('.lay__note');
    if (!note) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      note.hidden = open;
    });
  });

  /* -------------------------------------------------------- 4. the lesion */

  var lesion = $('[data-lesion]');
  if (lesion) {
    var mm = $('[data-lesion-mm]', lesion);
    var list = $('[data-lesion-notes]', lesion);
    var verdict = $('[data-lesion-verdict]', lesion);
    var chips = $$('.chip', lesion);
    var rest = verdict ? verdict.innerHTML : '';

    var copy = {
      a: '<b>Asymmetry.</b> Fold it down the middle and the halves no longer match. Ordinary moles are boringly symmetrical.',
      b: '<b>Border.</b> The edge has gone ragged and notched instead of stopping cleanly against normal skin.',
      c: '<b>Colour.</b> More than one shade in the same spot — a darker area, a paler one, sometimes both.',
      d: '<b>Diameter.</b> Wider than about 6 mm, the width of a pencil. Smaller still counts if anything else on this list applies.',
      e: '<b>Evolving.</b> The dashed outline is where it sat six months ago. Change over time outranks every other feature here.'
    };
    var order = ['a', 'b', 'c', 'd', 'e'];

    function words(n) {
      return ['No', 'One', 'Two', 'Three', 'Four', 'Five'][n] || String(n);
    }

    function paint() {
      var on = order.filter(function (k) {
        return lesion.classList.contains('is-' + k);
      });

      if (mm) mm.textContent = lesion.classList.contains('is-d') ? '9' : '4';

      if (list) {
        list.innerHTML = on.map(function (k) {
          return '<li>' + copy[k] + '</li>';
        }).join('');
      }

      if (!verdict) return;
      var n = on.length;
      if (n === 0) {
        verdict.innerHTML = rest;
      } else if (n === 1) {
        verdict.innerHTML = '<b>One feature is enough.</b> A single change is the ' +
          'commonest way melanoma announces itself, and checking it costs you ' +
          'forty minutes and, with a referral, nothing at all.';
      } else if (n < 4) {
        verdict.innerHTML = '<b>' + words(n) + ' features.</b> Do not wait to ' +
          'collect the rest of the list. Telephone the clinic rather than ' +
          'booking online, and say which of these you have seen.';
      } else {
        verdict.innerHTML = '<b>' + words(n) + ' features.</b> This is the ' +
          'picture the list was written to describe. Telephone today — the two ' +
          '08.00 slots are held back for exactly this and are given out by ' +
          'telephone only.';
      }
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        var k = chip.getAttribute('data-f');
        var on = chip.getAttribute('aria-pressed') === 'true';
        chip.setAttribute('aria-pressed', on ? 'false' : 'true');
        lesion.classList.toggle('is-' + k, !on);
        paint();
      });
    });

    paint();
  }

  /* ---------------------------------------------------------- 5. the form */

  var req = $('[data-req]');
  if (req) {
    var mail = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    function cellOf(field) {
      var c = field.closest ? field.closest('.cell') : null;
      return c;
    }

    req.addEventListener('input', function (e) {
      var c = cellOf(e.target);
      if (c) c.classList.remove('bad');
      var err = $('.req__err', req);
      if (err) err.remove();
    });

    req.addEventListener('submit', function (e) {
      e.preventDefault();

      var bad = [];
      $$('[required]', req).forEach(function (f) {
        var ok = f.value.trim() !== '';
        if (ok && f.type === 'email') ok = mail.test(f.value.trim());
        var c = cellOf(f);
        if (c) c.classList.toggle('bad', !ok);
        if (!ok) bad.push(f);
      });

      var old = $('.req__err', req);
      if (old) old.remove();

      if (bad.length) {
        var note = document.createElement('p');
        note.className = 'req__err';
        note.setAttribute('role', 'alert');
        note.textContent = 'Navn, telefon og en gyldig e-mail, please — the ' +
          'marked fields are how reception rings you back.';
        var foot = $('.req__foot', req);
        if (foot) foot.appendChild(note);
        bad[0].focus();
        return;
      }

      var data = new FormData(req);
      var flags = data.getAll('flag');

      var slip = document.createElement('div');
      slip.className = 'slip';
      slip.setAttribute('role', 'status');
      slip.innerHTML =
        '<p class="lab slip__over">Anmodning modtaget</p>' +
        '<h3>Reception will ring you back.</h3>' +
        '<p>Within one working day, on the number below. If a lesion changes ' +
        'before then, telephone <b>+45 33 15 40 80</b> and say so — the held ' +
        '08.00 slots exist for that call.</p>' +
        '<dl>' +
        '<div><dt>Navn</dt><dd>' + esc(data.get('name')) + '</dd></div>' +
        '<div><dt>Telefon</dt><dd>' + esc(data.get('tel')) + '</dd></div>' +
        '<div><dt>E-mail</dt><dd>' + esc(data.get('email')) + '</dd></div>' +
        '<div><dt>Sygesikring</dt><dd>' + esc(data.get('group')) + '</dd></div>' +
        '<div><dt>Anledning</dt><dd>' + esc(data.get('reason')) + '</dd></div>' +
        '<div><dt>Markeret</dt><dd>' +
          (flags.length ? flags.length + (flags.length === 1 ? ' forhold' : ' forhold') +
            ' — prioriteres' : 'Ingen') +
        '</dd></div>' +
        '</dl>';

      req.parentNode.replaceChild(slip, req);
      slip.setAttribute('tabindex', '-1');
      slip.focus();
    });
  }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ------------------------------------------------------------- 6. tidy */

  var y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
