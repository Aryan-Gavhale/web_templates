/* =========================================================================
   VERSO — Dermatology & Skin Cancer Medicine, Carlton
   The paper does very little. Rules draw, type sets, the running head
   keeps your place, and two forms behave themselves.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var io = 'IntersectionObserver' in window;

  /* ---------------------------------------------------------------  plates */
  $$('img').forEach(function (img) {
    if (!img.closest('.lead')) img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
    if (img.complete && img.naturalWidth) { img.classList.add('in'); return; }
    img.addEventListener('load',  function () { img.classList.add('in'); });
    img.addEventListener('error', function () { img.classList.add('in'); });
  });

  /* ------------------------------------------------------------  press run
     Rules draw left to right, type sets behind them. On first paint a whole
     screenful arrives at once, so it is staggered in document order.        */
  $$('.uv__chart span').forEach(function (bar, i) {
    bar.style.setProperty('--i', i);
  });

  var settable = $$('.rule, [data-press], .uv__chart');

  if (calm || !io) {
    settable.forEach(function (el) { el.classList.add('set'); });
  } else {
    var press = new IntersectionObserver(function (entries) {
      var live = entries.filter(function (e) { return e.isIntersecting; });
      live.sort(function (a, b) {
        return a.boundingClientRect.top - b.boundingClientRect.top;
      });
      live.forEach(function (e, i) {
        e.target.style.transitionDelay = Math.min(i * 90, 700) + 'ms';
        e.target.classList.add('set');
        press.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.02 });
    settable.forEach(function (el) { press.observe(el); });

    /* Hidden copy is worse than unanimated copy. If anything above has gone
       wrong, everything in view gets set anyway. */
    window.setTimeout(function () {
      settable.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('set');
      });
    }, 2500);
  }

  /* --------------------------------------------------------  running head */
  var runner = $('[data-runner]');
  var mast   = $('.mast');

  if (runner && mast && io) {
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        runner.classList.toggle('on', !e.isIntersecting);
      });
    }, { threshold: 0, rootMargin: '-40px 0px 0px 0px' });
    watch.observe(mast);

    var deptOut  = $('[data-runner-dept]');
    var folioOut = $('[data-runner-folio]');
    var folios = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        if (deptOut)  deptOut.textContent  = e.target.getAttribute('data-dept') || '';
        if (folioOut) folioOut.textContent = e.target.getAttribute('data-folio') || '';
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    $$('[data-page]').forEach(function (p) { folios.observe(p); });
  }

  /* ----------------------------------------------------------  index sheet */
  var sheet = $('[data-index-panel]');
  if (sheet) {
    var openBtn  = $('[data-index-open]');
    var closeBtn = $('[data-index-close]');

    function setSheet(on) {
      sheet.hidden = !on;
      root.classList.toggle('lock', on);
      if (openBtn) openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on && closeBtn) closeBtn.focus();
      else if (!on && openBtn) openBtn.focus();
    }
    if (openBtn)  openBtn.addEventListener('click',  function () { setSheet(true); });
    if (closeBtn) closeBtn.addEventListener('click', function () { setSheet(false); });
    $$('[data-jump]', sheet).forEach(function (a) {
      a.addEventListener('click', function () { setSheet(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !sheet.hidden) setSheet(false);
    });
  }

  /* ------------------------------------------------------  self-examination */
  var exam = $('[data-exam]');
  if (exam) {
    var boxes = $$('input[type="checkbox"]', exam);
    var out   = $('[data-exam-count]');

    function tally() {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      if (!out) return;
      if (n === 0) out.innerHTML = 'Nothing ticked.';
      else if (n === 1) out.innerHTML = '<b>One</b> ticked — that is already enough to book.';
      else out.innerHTML = '<b>' + n + '</b> ticked. Telephone rather than wait for an online slot.';
    }
    boxes.forEach(function (b) { b.addEventListener('change', tally); });
    tally();

    var printBtn = $('[data-print]');
    if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  }

  /* --------------------------------------------------------------  coupon */
  var coupon = $('[data-coupon]');
  if (coupon) {
    var mail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function complain(text) {
      var box = $('.coupon__err', coupon);
      if (!box) {
        box = document.createElement('p');
        box.className = 'coupon__err';
        box.setAttribute('role', 'alert');
        $('.coupon__foot', coupon).appendChild(box);
      }
      box.textContent = text;
    }

    $$('input, textarea', coupon).forEach(function (f) {
      f.addEventListener('input', function () { f.classList.remove('bad'); });
    });

    coupon.addEventListener('submit', function (e) {
      e.preventDefault();

      var first = null;
      $$('[required]', coupon).forEach(function (f) {
        var ok = f.type === 'email' ? mail.test(f.value.trim()) : f.value.trim().length > 1;
        f.classList.toggle('bad', !ok);
        if (!ok && !first) first = f;
      });
      if (first) {
        complain('A name, a telephone number and an email address, please — reception rings back on all three.');
        first.focus();
        return;
      }

      function val(name) {
        var f = coupon.querySelector('[name="' + name + '"]');
        return f ? f.value : '';
      }
      var flagged = $$('input[name="urgent"]:checked', coupon).length;
      var given = val('name').split(/[\s,]+/)[0].replace(/[<>&]/g, '');

      var panel = document.createElement('section');
      panel.className = 'stamp';
      panel.setAttribute('role', 'status');
      panel.innerHTML =
        '<p class="stamp__over">Received · no charge has been made</p>' +
        '<h3>Thank you, ' + given + '.</h3>' +
        '<p>' + (flagged
          ? 'You have flagged a changing lesion, so this coupon goes to the top of the pile and one of the held 8am appointments is offered first. If it is bleeding today, telephone (03) 9417 8820 now rather than waiting for the call.'
          : 'Reception telephones within one working day to settle a time. Bring your referral if you have one, and wear something you do not mind taking off.') +
        '</p>' +
        '<dl>' +
          '<div><dt>Clinic</dt><dd>' + val('clinic') + '</dd></div>' +
          '<div><dt>Referral</dt><dd>' + val('referral') + '</dd></div>' +
          '<div><dt>Telephone</dt><dd>' + val('tel').replace(/[<>&]/g, '') + '</dd></div>' +
          '<div><dt>Priority</dt><dd>' + (flagged ? 'Urgent — ' + flagged + ' flag' + (flagged > 1 ? 's' : '') : 'Routine') + '</dd></div>' +
        '</dl>';

      coupon.parentNode.replaceChild(panel, coupon);
      panel.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
    });
  }

  /* ----------------------------------------------------------------  year */
  var year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
