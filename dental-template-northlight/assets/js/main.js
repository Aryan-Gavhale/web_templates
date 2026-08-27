/* =========================================================
   Northlight Dental Hospital — template behaviour
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
      var line = window.innerHeight * 0.88;
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

  /* ---------- header: invert over the hero, then settle ---------- */
  function header() {
    var top = document.querySelector('[data-top]');
    var hero = document.querySelector('.hero');
    if (!top) return;

    var links = [].slice.call(document.querySelectorAll('.topnav a[href^="#"]'));
    var map = links.map(function (a) {
      return { a: a, sec: document.querySelector(a.getAttribute('href')) };
    }).filter(function (o) { return o.sec; });

    var queued = false;
    function paint() {
      queued = false;
      var edge = hero ? hero.offsetHeight - top.offsetHeight * 1.6 : 80;
      var past = window.scrollY > edge;
      top.classList.toggle('is-solid', past);
      top.classList.toggle('is-dark', !past && window.scrollY > 40);

      var y = window.scrollY + 140;
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

  /* ---------- mobile sheet ---------- */
  function sheet() {
    var btn = document.querySelector('[data-burger]');
    var panel = document.querySelector('[data-sheet]');
    if (!btn || !panel) return;

    function open() {
      panel.hidden = false;
      requestAnimationFrame(function () { panel.classList.add('is-open'); });
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      document.querySelector('[data-top]').classList.add('is-solid');
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
    window.matchMedia('(min-width: 1181px)').addEventListener('change', function (e) {
      if (e.matches && !panel.hidden) shut();
    });
  }

  /* ---------- lightbox ---------- */
  function lightbox() {
    var box = document.querySelector('[data-lbox]');
    var shots = [].slice.call(document.querySelectorAll('[data-gallery] .tile__btn'));
    if (!box || !shots.length) return;

    var img = box.querySelector('[data-lbox-img]');
    var cap = box.querySelector('[data-lbox-cap]');
    var count = box.querySelector('[data-lbox-count]');
    var closeBtn = box.querySelector('[data-lbox-close]');
    var at = 0;
    var opener = null;

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function show(i) {
      at = (i + shots.length) % shots.length;
      var s = shots[at];
      img.src = s.getAttribute('data-src');
      img.alt = s.querySelector('img').alt;
      cap.textContent = s.getAttribute('data-cap');
      count.textContent = pad(at + 1) + ' / ' + pad(shots.length);
    }

    function open(i, from) {
      opener = from;
      show(i);
      box.hidden = false;
      requestAnimationFrame(function () { box.classList.add('is-open'); });
      document.body.style.overflow = 'hidden';
      closeBtn.focus();
    }
    function shut() {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      window.setTimeout(function () { box.hidden = true; }, calm ? 0 : 340);
      if (opener) opener.focus();
    }

    shots.forEach(function (s, i) {
      s.addEventListener('click', function () { open(i, s); });
    });
    closeBtn.addEventListener('click', shut);
    box.querySelector('[data-lbox-prev]').addEventListener('click', function () { show(at - 1); });
    box.querySelector('[data-lbox-next]').addEventListener('click', function () { show(at + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) shut(); });

    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') shut();
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });
  }

  /* ---------- parallax on the quote band ---------- */
  function parallax() {
    var bg = document.querySelector('[data-parallax]');
    if (!bg || calm) return;
    var band = bg.parentElement;

    var queued = false;
    function move() {
      queued = false;
      var r = band.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) return;
      var mid = window.innerHeight / 2;
      var p = ((r.top + r.height / 2) - mid) / (mid + r.height / 2);
      bg.style.transform = 'translate3d(0,' + (p * r.height * 0.09).toFixed(1) + 'px,0)';
    }
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(move);
    }, { passive: true });
    window.addEventListener('resize', move);
    move();
  }

  /* ---------- opening hours ---------- */
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var WEEK = [null, [8, 20], [8, 20], [8, 20], [8, 20], [8, 18], [9, 17]];

  function hours() {
    var state = document.querySelector('[data-hours-state]');
    var short = document.querySelector('[data-hours-short]');
    var now = new Date();
    var day = now.getDay();
    var mins = now.getHours() * 60 + now.getMinutes();
    var today = WEEK[day];

    var row = document.querySelector('.hours tr[data-day="' + day + '"]');
    if (row) row.classList.add('is-today');

    function clock(h) { return (h < 10 ? '0' + h : h) + ':00'; }
    function nextOpen() {
      for (var i = 1; i <= 7; i++) {
        var d = (day + i) % 7;
        if (WEEK[d]) return DAYS[d] + ' ' + clock(WEEK[d][0]);
      }
      return '';
    }

    var longText, shortText, shut = false;

    if (!today) {
      longText = 'Emergencies only today';
      shortText = 'Emergency cover today';
      shut = true;
    } else if (mins < today[0] * 60) {
      longText = 'Opens at ' + clock(today[0]);
      shortText = 'Opens ' + clock(today[0]) + ' today';
      shut = true;
    } else if (mins >= today[1] * 60) {
      longText = 'Closed · opens ' + nextOpen();
      shortText = 'Closed now';
      shut = true;
    } else {
      longText = 'Open now · closes ' + clock(today[1]);
      shortText = 'Open until ' + clock(today[1]) + ' today';
    }

    if (state) {
      state.textContent = longText;
      state.classList.toggle('is-shut', shut);
    }
    if (short) short.textContent = shortText;
  }

  /* ---------- booking: a summary that becomes the confirmation ---------- */
  var FEES = {
    'Examination & hygiene': { fee: '£95', len: '90 minutes' },
    'Endodontics':           { fee: 'from £480', len: '90 minutes' },
    'Prosthodontics':        { fee: 'from £790', len: '60 minutes' },
    'Implantology':          { fee: 'from £2,150', len: '60 minutes' },
    'Orthodontics':          { fee: 'from £2,400', len: '45 minutes' },
    'Oral surgery':          { fee: 'from £340', len: '45 minutes' },
    'Paediatric dentistry':  { fee: '£45', len: '30 minutes' },
    'Periodontics':          { fee: 'from £260', len: '60 minutes' }
  };

  function booking() {
    var form = document.querySelector('[data-form]');
    if (!form) return;

    var segs = [].slice.call(form.querySelectorAll('[data-segs] .seg'));
    var err = form.querySelector('[data-err]');
    var line = document.querySelector('[data-summary]');
    var sDept = document.querySelector('[data-s-dept]');
    var sWhen = document.querySelector('[data-s-when]');
    var sLen = document.querySelector('[data-s-len]');
    var sFee = document.querySelector('[data-s-fee]');
    var sNote = document.querySelector('[data-s-note]');
    var done = document.querySelector('[data-done]');
    var doneLine = document.querySelector('[data-done-line]');
    var ref = document.querySelector('[data-ref]');
    var reset = document.querySelector('[data-reset]');
    var part = 'Morning';

    function dayWords() {
      var v = form.elements.day.value;
      if (!v) return null;
      var d = new Date(v + 'T00:00:00');
      if (isNaN(d)) return null;
      return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    function paint() {
      var name = form.elements.name.value.trim();
      var dept = form.elements.dept.value;
      var first = form.elements.firstTime.checked;
      var when = dayWords();
      var slot = part.toLowerCase();
      var info = FEES[dept] || { fee: '—', len: '60 minutes' };

      line.innerHTML = (first ? 'A first appointment for ' : 'An appointment for ') +
        '<b>' + (name ? escapeHtml(name) : '—') + '</b>, ' +
        escapeHtml(dept.toLowerCase().replace(' & ', ' and ')) + ', ' +
        (when ? 'on ' + when : 'at the next opening') +
        ' in the ' + slot + '.';

      sDept.textContent = dept;
      sWhen.textContent = (when || 'Next available') + ', ' + slot;
      sLen.textContent = first ? '90 minutes' : info.len;
      sFee.textContent = info.fee;
      sNote.textContent = first
        ? 'First appointments include two X-rays and a written estimate. Nothing is charged today, and nothing is treated today.'
        : 'We will have your record open before you arrive, including your last X-rays and the estimate we issued.';
    }

    function escapeHtml(s) {
      return s.replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });
    }

    segs.forEach(function (seg) {
      seg.addEventListener('click', function () {
        segs.forEach(function (s) { s.classList.toggle('is-on', s === seg); });
        part = seg.textContent.trim();
        paint();
      });
    });
    form.addEventListener('input', paint);
    form.addEventListener('change', paint);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements.name;
      var phone = form.elements.phone;
      var digits = phone.value.replace(/\D/g, '');
      [name, phone].forEach(function (f) { f.classList.remove('is-bad'); });

      if (!name.value.trim()) {
        name.classList.add('is-bad');
        err.textContent = 'Please tell us who the appointment is for.';
        name.focus();
        return;
      }
      if (digits.length < 10) {
        phone.classList.add('is-bad');
        err.textContent = 'A telephone number of at least ten digits, so reception can reply.';
        phone.focus();
        return;
      }
      err.textContent = '';

      var when = dayWords();
      doneLine.textContent = 'Reception will ring ' + name.value.trim().split(' ')[0] +
        ' on ' + phone.value.trim() + ' to confirm ' +
        (when ? when : 'the first suitable date') + ', ' + part.toLowerCase() + '.';
      ref.textContent = 'NL-' + String(Math.floor(1000 + Math.random() * 9000));
      done.hidden = false;
      form.querySelector('button[type="submit"]').disabled = true;
      done.scrollIntoView({ block: 'center' });
    });

    if (reset) {
      reset.addEventListener('click', function () {
        done.hidden = true;
        form.reset();
        segs.forEach(function (s, i) { s.classList.toggle('is-on', i === 0); });
        part = 'Morning';
        form.querySelector('button[type="submit"]').disabled = false;
        paint();
        form.elements.name.focus();
      });
    }

    paint();
  }

  /* ---------- image fallback ---------- */
  function images() {
    [].slice.call(document.querySelectorAll('[data-img]')).forEach(function (img) {
      img.addEventListener('error', function () {
        img.style.visibility = 'hidden';
        if (img.parentElement) img.parentElement.style.background = '#E9F0EE';
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
    header();
    sheet();
    lightbox();
    parallax();
    hours();
    booking();
    images();
    year();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
