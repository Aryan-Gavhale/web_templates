/* Datum Dental — drafting sheet
   reveal · sheet indicator · drawer · live crosshair
   method stepper · assembly explorer · bill of quantities · request */

(function () {
  'use strict';

  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var q = function (s, r) { return (r || document).querySelector(s); };
  var qa = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var money = function (n) { return '\u00a3' + Math.round(n).toLocaleString('en-GB'); };

  /* ── reveal ─────────────────────────────────────────────────────────── */
  function reveal() {
    var targets = qa('.rise, .fig, .method__art, .asm__art');
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
        setTimeout(function () { el.classList.add('is-in'); }, Math.min(i, 6) * 70);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    targets.forEach(function (el) { io.observe(el); });
  }

  /* ── header: sheet indicator, nav state, progress ───────────────────── */
  function header() {
    var sects = qa('.sect[data-sheet]');
    var num = q('[data-sheet-n]');
    var title = q('[data-sheet-t]');
    var prog = q('[data-progress]');
    var links = qa('.nav a');
    var last = '';

    function paint() {
      var y = scrollY + Math.min(340, innerHeight * 0.4);
      var cur = sects[0];
      sects.forEach(function (s) { if (s.offsetTop <= y) cur = s; });

      if (cur && num && cur.dataset.sheet !== last) {
        last = cur.dataset.sheet;
        num.textContent = cur.dataset.sheet;
        title.textContent = cur.dataset.title;
      }

      if (prog) {
        var h = document.documentElement.scrollHeight - innerHeight;
        prog.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 0) + '%';
      }

      var id = cur ? cur.id : '';
      links.forEach(function (a) {
        a.classList.toggle('is-here', !!id && a.getAttribute('href') === '#' + id);
      });
    }

    var tick = false;
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

  /* ── live crosshair over fig 01 ─────────────────────────────────────── */
  function crosshair() {
    var fig = q('[data-live-fig]');
    if (!fig || !matchMedia('(hover: hover)').matches) return;
    var box = q('.fig__box', fig);
    var svg = q('svg', box);
    var cx = q('[data-cx]', fig);
    var cy = q('[data-cy]', fig);
    var read = q('[data-read]', fig);
    var pad = function (n) { return String(Math.max(0, Math.round(n))).padStart(3, '0'); };

    box.addEventListener('pointerenter', function () { fig.classList.add('is-live'); });
    box.addEventListener('pointerleave', function () { fig.classList.remove('is-live'); });
    box.addEventListener('pointermove', function (e) {
      var b = box.getBoundingClientRect();
      var s = svg.getBoundingClientRect();
      cx.style.top = e.clientY - b.top + 'px';
      cy.style.left = e.clientX - b.left + 'px';
      read.textContent =
        'X ' + pad(((e.clientX - s.left) / s.width) * 460) +
        ' \u00b7 Y ' + pad(((e.clientY - s.top) / s.height) * 500);
    });
  }

  /* ── method stepper ─────────────────────────────────────────────────── */
  function method() {
    var list = q('[data-steps]');
    if (!list) return;
    var items = qa('li', list);
    var layers = qa('.ly');
    var cap = q('[data-mstage]');
    var names = ['Scan', 'Plan', 'Guide', 'Place'];
    var at = -1;

    function go(i) {
      if (i === at) return;
      at = i;
      items.forEach(function (li, k) { li.classList.toggle('is-on', k === i); });
      layers.forEach(function (ly, k) {
        ly.classList.toggle('is-on', k <= i);
        ly.classList.toggle('is-past', k < i);
      });
      if (cap) cap.innerHTML = 'Stage 0' + (i + 1) + ' &middot; ' + names[i];
    }

    items.forEach(function (li, k) {
      q('button', li).addEventListener('click', function () { go(k); });
    });

    go(0);

    /* advance on scroll-through the diagram, once */
    if (!calm && 'IntersectionObserver' in window) {
      var timer = null;
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting || timer) return;
          var i = 0;
          timer = setInterval(function () {
            i += 1;
            if (i > 3) { clearInterval(timer); return; }
            go(i);
          }, 1500);
          io.disconnect();
        });
      }, { threshold: 0.55 });
      io.observe(q('.method__art'));
      list.addEventListener('click', function () { clearInterval(timer); timer = -1; });
    }
  }

  /* ── assembly explorer ──────────────────────────────────────────────── */
  var PARTS = {
    crown: {
      h: 'Monolithic zirconia crown',
      p: 'Milled in one piece from a single blank, then shade-matched to the teeth either side of it. Screw-retained wherever the angle allows, so it can be removed and refitted without cutting anything.',
      rows: [
        ['Material', 'Zirconia, 1,200 MPa'],
        ['Fabrication', 'Milled, one piece'],
        ['Retention', 'Screw, where angle allows'],
        ['Minimum wall', '1.2 mm'],
        ['Shade', 'Matched to adjacent teeth'],
        ['Warranty', '5 years']
      ]
    },
    abutment: {
      h: 'Milled titanium abutment',
      p: 'The part nobody sees and everything depends on. Milled to the shape of your own gum so the crown emerges at the right angle, and torqued to a figure that goes in your notes.',
      rows: [
        ['Material', 'Ti-6Al-4V, medical grade'],
        ['Fabrication', 'Patient-specific, milled'],
        ['Interface', 'Conical, 11\u00b0'],
        ['Torque', '25 Ncm'],
        ['Emergence', 'Designed to gum profile'],
        ['Warranty', '10 years']
      ]
    },
    fixture: {
      h: 'Grade 4 titanium fixture',
      p: 'The root replacement. Diameter and length are chosen from your CBCT, never from a default \u2014 which is the whole reason for scanning first.',
      rows: [
        ['Material', 'Grade 4 titanium'],
        ['Diameter', '\u00d8 3.6 \u2013 5.0 mm'],
        ['Length', '8 \u2013 13 mm'],
        ['Surface', 'Blasted, etched, hydrophilic'],
        ['Placement torque', '35 Ncm'],
        ['Warranty', '10 years']
      ]
    }
  };

  function assembly() {
    var tabs = qa('.tabs button');
    var pcs = qa('.pc');
    if (!tabs.length) return;
    var hEl = q('[data-spec-h]');
    var pEl = q('[data-spec-p]');
    var rows = q('[data-spec-rows]');

    function go(key) {
      var d = PARTS[key];
      if (!d) return;
      tabs.forEach(function (b) {
        var on = b.dataset.part === key;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', String(on));
      });
      pcs.forEach(function (g) { g.classList.toggle('is-on', g.dataset.part === key); });
      hEl.textContent = d.h;
      pEl.textContent = d.p;
      rows.innerHTML = d.rows
        .map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; })
        .join('');
    }

    tabs.forEach(function (b) {
      b.addEventListener('click', function () { go(b.dataset.part); });
    });
    pcs.forEach(function (g) {
      g.addEventListener('click', function () { go(g.dataset.part); });
    });
    go('crown');
  }

  /* ── bill of quantities ─────────────────────────────────────────────── */
  function estimate() {
    var form = q('[data-est]');
    if (!form) return;
    var body = q('[data-boq]');
    var out = q('[data-count]');
    var totalEl = q('[data-total]');
    var stageEl = q('[data-stage]');
    var refEl = q('[data-est-ref]');

    var R = {
      plan: 250, guide: 180, fixture: 1450, abut: 220,
      zir: 950, pfm: 780, socket: 380, block: 1200, iv: 450
    };
    var s = { n: 2, graft: 'none', crown: 'zir', anaes: 'local' };

    function lines() {
      var L = [
        ['A.01', 'CBCT, optical scan and written plan', 1, R.plan],
        ['A.02', 'Printed surgical guide', 1, R.guide],
        ['B.01', 'Implant fixture, guided placement', s.n, R.fixture]
      ];
      if (s.graft === 'socket') L.push(['C.01', 'Socket graft, xenograft and membrane', s.n, R.socket]);
      if (s.graft === 'block') L.push(['C.02', 'Block graft, fixation and membrane', 1, R.block]);
      L.push(['D.01', 'Custom milled abutment', s.n, R.abut]);
      L.push([
        'D.02',
        s.crown === 'zir' ? 'Crown, monolithic zirconia' : 'Crown, porcelain fused to metal',
        s.n,
        s.crown === 'zir' ? R.zir : R.pfm
      ]);
      if (s.anaes === 'iv') L.push(['E.01', 'Intravenous sedation, per session', 1, R.iv]);
      L.push(['F.01', 'Reviews at 1, 3 and 12 months', 3, 0]);
      return L;
    }

    function paint() {
      var L = lines();
      var total = 0;
      body.innerHTML = L.map(function (r) {
        var amt = r[2] * r[3];
        total += amt;
        return (
          '<tr><td class="mono">' + r[0] + '</td>' +
          '<td>' + r[1] + '</td>' +
          '<td class="mono num">' + r[2] + '</td>' +
          '<td class="mono num">' + (r[3] ? money(r[3]) : '\u2014') + '</td>' +
          '<td class="mono num">' + (amt ? money(amt) : 'Included') + '</td></tr>'
        );
      }).join('');

      totalEl.textContent = money(total);
      stageEl.textContent = money(Math.ceil(total / 3 / 5) * 5);
      out.textContent = s.n;
      refEl.textContent =
        'DTM/EST/' + s.n + 'F-' + s.crown.toUpperCase() +
        (s.graft === 'none' ? '' : '-' + s.graft.slice(0, 3).toUpperCase()) +
        (s.anaes === 'iv' ? '-IV' : '');
    }

    qa('.step button', form).forEach(function (b) {
      b.addEventListener('click', function () {
        s.n = Math.min(6, Math.max(1, s.n + Number(b.dataset.n)));
        paint();
      });
    });

    [['[data-graft]', 'graft'], ['[data-crown]', 'crown'], ['[data-anaes]', 'anaes']].forEach(
      function (pair) {
        var box = q(pair[0], form);
        if (!box) return;
        qa('button', box).forEach(function (b) {
          b.addEventListener('click', function () {
            qa('button', box).forEach(function (x) { x.classList.toggle('is-on', x === b); });
            s[pair[1]] = b.dataset.v;
            paint();
          });
        });
      }
    );

    form.addEventListener('submit', function (e) { e.preventDefault(); });
    paint();
  }

  /* ── request ────────────────────────────────────────────────────────── */
  function request() {
    var form = q('[data-req]');
    if (!form) return;
    var out = q('[data-issued]');
    var err = q('[data-err]');
    var rev = q('[data-rev]');

    var fmt = function (d) {
      var p = function (n) { return String(n).padStart(2, '0'); };
      return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = q('[data-name]', form).value.trim();
      var tel = q('[data-tel]', form).value.trim();
      var mail = q('[data-email]', form).value.trim();
      var ok = name.length > 1 && tel.replace(/\D/g, '').length >= 9 && /^[^@\s]+@[^@\s]+\.\w{2,}$/.test(mail);

      if (!ok) {
        err.hidden = false;
        return;
      }
      err.hidden = true;

      var d = new Date();
      var seq = String(((d.getTime() / 1000) | 0) % 9000 + 1000);
      q('[data-issued-ref]').textContent = 'DTM\u2013' + d.getFullYear() + '\u2013' + seq;
      q('[data-issued-name]').textContent = name;
      q('[data-issued-case]').textContent = q('[data-case]', form).value;
      q('[data-issued-contact]').textContent = tel + ' \u00b7 ' + mail;
      q('[data-issued-date]').textContent = fmt(d);

      form.hidden = true;
      out.hidden = false;
      if (rev) rev.textContent = 'B';
      out.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
      q('[data-issued-ref]').setAttribute('tabindex', '-1');
      q('[data-issued-ref]').focus();
    });

    q('[data-again]').addEventListener('click', function () {
      out.hidden = true;
      form.hidden = false;
      if (rev) rev.textContent = 'A';
      q('[data-name]', form).focus();
    });
  }

  /* ── odds and ends ──────────────────────────────────────────────────── */
  function bits() {
    var y = q('[data-year]');
    if (y) y.textContent = new Date().getFullYear();

    var d = q('[data-date]');
    if (d) {
      var t = new Date();
      var p = function (n) { return String(n).padStart(2, '0'); };
      d.textContent = p(t.getDate()) + '.' + p(t.getMonth() + 1) + '.' + t.getFullYear();
    }

    qa('img').forEach(function (im) {
      im.addEventListener('error', function () { im.style.visibility = 'hidden'; });
    });
  }

  function init() {
    reveal();
    header();
    drawer();
    crosshair();
    method();
    assembly();
    estimate();
    request();
    bits();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
