/* =========================================================
   Muskaan Dental Hospital — template behaviour
   Vanilla JS, no dependencies, no build step.
   ========================================================= */
(function () {
  'use strict';

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var rupee = function (n) { return '\u20B9' + Math.round(n).toLocaleString('en-IN'); };

  /* ---------- reveal on scroll ---------- */
  function reveals() {
    var items = [].slice.call(document.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    items.forEach(function (el) {
      var d = el.getAttribute('data-delay');
      if (d) el.style.setProperty('--rd', d + 'ms');
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
        var el = items[i];
        if (el.getBoundingClientRect().top < line) {
          el.classList.add('in');
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
    document.addEventListener('reveal:check', onScroll);
    check();
  }

  /* ---------- language toggle (English / Hindi) ---------- */
  function language() {
    var btn = document.querySelector('[data-lang]');
    if (!btn) return;

    var label = btn.querySelector('[data-lang-label]');
    var nodes = [].slice.call(document.querySelectorAll('[data-hi]'));
    nodes.forEach(function (el) { el.setAttribute('data-en', el.textContent.trim()); });

    var hi = false;
    btn.addEventListener('click', function () {
      hi = !hi;
      nodes.forEach(function (el) {
        el.textContent = el.getAttribute(hi ? 'data-hi' : 'data-en');
      });
      document.body.classList.toggle('is-hi', hi);
      document.documentElement.setAttribute('lang', hi ? 'hi' : 'en');
      btn.setAttribute('aria-pressed', hi ? 'true' : 'false');
      label.textContent = hi ? 'English' : '\u0939\u093F\u0902\u0926\u0940';
    });
  }

  /* ---------- mobile drawer ---------- */
  function drawer() {
    var ham = document.querySelector('[data-ham]');
    var panel = document.querySelector('[data-drawer]');
    if (!ham || !panel) return;

    function open() {
      panel.hidden = false;
      requestAnimationFrame(function () { panel.classList.add('is-open'); });
      ham.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    }
    function shut() {
      panel.classList.remove('is-open');
      ham.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      window.setTimeout(function () { panel.hidden = true; }, calm ? 0 : 320);
    }

    ham.addEventListener('click', function () {
      ham.getAttribute('aria-expanded') === 'true' ? shut() : open();
    });
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) shut();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) shut();
    });
    window.matchMedia('(min-width: 1081px)').addEventListener('change', function (e) {
      if (e.matches && !panel.hidden) shut();
    });
  }

  /* ---------- nav: highlight the section in view ---------- */
  function navMark() {
    var links = [].slice.call(document.querySelectorAll('.nav__links a[href^="#"]'));
    var map = links.map(function (a) {
      return { a: a, sec: document.querySelector(a.getAttribute('href')) };
    }).filter(function (o) { return o.sec; });
    if (!map.length) return;

    var queued = false;
    function mark() {
      queued = false;
      var y = window.scrollY + 160;
      var live = null;
      map.forEach(function (o) {
        if (o.sec.offsetTop <= y) live = o.a;
      });
      links.forEach(function (a) { a.classList.toggle('is-on', a === live); });
    }
    window.addEventListener('scroll', function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(mark);
    }, { passive: true });
    mark();
  }

  /* ---------- no-cost EMI calculator ---------- */
  function emi() {
    var box = document.querySelector('[data-emi]');
    if (!box) return;

    var chips = [].slice.call(box.querySelectorAll('[data-emi-chips] .chip'));
    var range = box.querySelector('[data-emi-range]');
    var outMonthly = box.querySelector('[data-emi-monthly]');
    var outTotal = box.querySelector('[data-emi-total]');
    var outTenure = box.querySelector('[data-emi-tenure]');
    var cost = Number(chips[0].getAttribute('data-cost'));

    function paint() {
      var months = Number(range.value);
      outMonthly.textContent = rupee(cost / months);
      outTotal.textContent = rupee(cost);
      outTenure.textContent = months + ' months';
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
        cost = Number(chip.getAttribute('data-cost'));
        paint();
      });
    });
    range.addEventListener('input', paint);
    paint();
  }

  /* ---------- centre filter ---------- */
  function centres() {
    var bar = document.querySelector('[data-city]');
    var wrap = document.querySelector('[data-branches]');
    if (!bar || !wrap) return;

    var chips = [].slice.call(bar.querySelectorAll('.chip'));
    var count = bar.querySelector('[data-city-count]');
    var cards = [].slice.call(wrap.querySelectorAll('.br'));

    function apply(city, label) {
      var shown = 0;
      cards.forEach(function (card) {
        var ok = city === 'all' || card.getAttribute('data-c') === city;
        card.hidden = !ok;
        if (ok) shown++;
      });
      count.textContent = city === 'all'
        ? 'Showing all ' + shown + ' centres'
        : 'Showing ' + shown + ' centre' + (shown === 1 ? '' : 's') + ' in ' + label;
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
        apply(chip.getAttribute('data-c'), chip.textContent.trim());
      });
    });
  }

  /* ---------- booking form ---------- */
  function form() {
    var el = document.querySelector('[data-form]');
    if (!el) return;

    var chips = [].slice.call(el.querySelectorAll('[data-form-chips] .chip'));
    var err = el.querySelector('[data-form-err]');
    var done = el.querySelector('[data-form-done]');
    var line = el.querySelector('[data-form-done-line]');
    var ref = el.querySelector('[data-form-ref]');
    var reset = el.querySelector('[data-form-reset]');
    var reason = 'Check-up';

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
        reason = chip.textContent.trim();
      });
    });

    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = el.elements.name;
      var phone = el.elements.phone;
      var digits = phone.value.replace(/\D/g, '');

      [name, phone].forEach(function (f) { f.classList.remove('is-bad'); });

      if (!name.value.trim()) {
        name.classList.add('is-bad');
        err.textContent = 'We need a name to ask for at the desk.';
        name.focus();
        return;
      }
      if (digits.length < 10) {
        phone.classList.add('is-bad');
        err.textContent = 'Please give a 10-digit mobile number so we can call back.';
        phone.focus();
        return;
      }

      err.textContent = '';
      var centre = el.elements.centre.value;
      var day = el.elements.day.value;
      var when = day
        ? new Date(day + 'T00:00:00').toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long'
          })
        : 'the next working day';

      line.textContent = name.value.trim().split(' ')[0] + ', we have your ' + reason.toLowerCase() +
        ' request for ' + centre + '. Our desk will ring you about ' + when +
        ' within thirty minutes of opening hours.';
      ref.textContent = 'MDH-' + String(Math.floor(1000 + Math.random() * 9000));

      done.hidden = false;
      requestAnimationFrame(function () { done.classList.add('is-on'); });
    });

    if (reset) {
      reset.addEventListener('click', function () {
        done.classList.remove('is-on');
        window.setTimeout(function () { done.hidden = true; }, calm ? 0 : 340);
        el.reset();
        chips.forEach(function (c, i) { c.classList.toggle('is-on', i === 0); });
        reason = 'Check-up';
        el.elements.name.focus();
      });
    }
  }

  /* ---------- image fallback ---------- */
  function images() {
    [].slice.call(document.querySelectorAll('[data-img]')).forEach(function (img) {
      img.addEventListener('error', function () {
        var fill = document.createElement('div');
        fill.style.cssText = 'width:100%;aspect-ratio:4/3.4;background:#FFE7EF';
        if (img.parentNode) img.parentNode.replaceChild(fill, img);
      });
    });
  }

  /* ---------- year ---------- */
  function year() {
    var el = document.querySelector('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------- boot ---------- */
  function boot() {
    reveals();
    language();
    drawer();
    navMark();
    emi();
    centres();
    form();
    images();
    year();
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', boot)
    : boot();
})();
