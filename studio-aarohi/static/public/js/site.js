/* Studio Aarohi — public theme behaviour.
   Vanilla, no dependencies. Scroll-linked work runs off one rAF loop;
   everything discrete is IntersectionObserver. */

(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  };
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── line splitting ──────────────────────────────────────
     Wrap each visual line of a heading in a clipping box so it can
     slide up from beneath. Re-run on resize because the line breaks move. */

  function splitLines(el) {
    if (!el.dataset.raw) el.dataset.raw = el.textContent.trim();
    var text = el.dataset.raw;

    el.innerHTML = text.split(/\s+/).map(function (w) {
      return '<span class="w">' + w + '</span>';
    }).join(' ');

    var words = $$('.w', el);
    if (!words.length) return;

    var lines = [];
    var top = null;
    words.forEach(function (w) {
      var y = w.offsetTop;
      if (top === null || Math.abs(y - top) > 4) { lines.push([]); top = y; }
      lines[lines.length - 1].push(w.textContent);
    });

    el.innerHTML = lines.map(function (words, i) {
      return '<span class="ln"><span style="transition-delay:' +
        (i * 95) + 'ms">' + words.join(' ') + '</span></span>';
    }).join('');
  }

  function setupLines() {
    var heads = $$('[data-lines]');
    if (calm) {
      heads.forEach(function (h) { h.classList.add('is-in'); });
      return heads;
    }
    heads.forEach(splitLines);
    return heads;
  }

  /* ── curtain ─────────────────────────────────────────── */

  function curtain(done) {
    var el = $('#curtain');
    var nav = $('#nav');
    if (!el || calm) {
      if (el) el.remove();
      if (nav) nav.classList.add('is-ready');
      done();
      return;
    }
    document.body.classList.add('is-locked');
    requestAnimationFrame(function () { el.classList.add('is-in'); });

    setTimeout(function () {
      el.classList.add('is-out');
      document.body.classList.remove('is-locked');
      if (nav) nav.classList.add('is-ready');
      done();
      setTimeout(function () { el.remove(); }, 1100);
    }, 1250);
  }

  /* ── reveals ─────────────────────────────────────────── */

  function reveals(heads) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

    $$('[data-rise]').forEach(function (el) { io.observe(el); });
    heads.forEach(function (el) { io.observe(el); });

    /* clip-path hides an element from IntersectionObserver, so watch the
       parent and flip the child when the parent arrives. */
    var wipes = $$('[data-wipe]');
    var wio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        $$('[data-wipe]', e.target).forEach(function (w) { w.classList.add('is-in'); });
        if (e.target.hasAttribute('data-wipe')) e.target.classList.add('is-in');
        wio.unobserve(e.target);
      });
    }, { threshold: 0.06 });
    wipes.forEach(function (w) { wio.observe(w.parentElement || w); });
  }

  /* ── counters ────────────────────────────────────────── */

  function counters() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        run(e.target);
      });
    }, { threshold: 0.4 });
    $$('[data-count]').forEach(function (el) { io.observe(el); });

    function run(el) {
      var raw = String(el.dataset.count || el.textContent).trim();
      var target = parseFloat(raw.replace(/[^\d.]/g, ''));
      if (isNaN(target)) return;
      var decimals = (raw.split('.')[1] || '').length;
      if (calm) { el.textContent = target.toFixed(decimals); return; }

      var start = performance.now();
      var span = 1500;
      (function tick(now) {
        var t = Math.min((now - start) / span, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = (target * eased).toFixed(decimals);
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    }
  }

  /* ── header, parallax and the process spine ──────────── */

  function scrollWork() {
    var nav = $('#nav');
    var rail = $('#rail');
    var spine = $('[data-spine]');
    var layers = $$('[data-parallax]');
    var last = window.scrollY;
    var ticking = false;

    function frame() {
      ticking = false;
      var y = window.scrollY;
      var vh = window.innerHeight;

      if (nav) {
        nav.classList.toggle('is-stuck', y > 24);
        // Hide on the way down, bring it back the moment they scroll up.
        nav.classList.toggle('is-hidden', y > 420 && y > last + 4 && !document.body.classList.contains('is-locked'));
      }

      if (rail) {
        var max = document.documentElement.scrollHeight - vh;
        rail.style.transform = 'scaleX(' + (max > 0 ? Math.min(y / max, 1) : 0) + ')';
      }

      if (!calm) {
        layers.forEach(function (img) {
          var box = img.parentElement.getBoundingClientRect();
          if (box.bottom < -200 || box.top > vh + 200) return;
          var mid = box.top + box.height / 2 - vh / 2;
          img.style.transform = 'translate3d(0,' +
            (-mid * parseFloat(img.dataset.parallax || 0.08)).toFixed(2) + 'px,0)';
        });
      }

      if (spine) {
        var host = spine.parentElement;
        var hb = host.getBoundingClientRect();
        var seen = (vh * 0.62 - hb.top) / hb.height;
        spine.style.height = Math.max(0, Math.min(seen, 1)) * 100 + '%';
      }

      last = y;
    }

    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    frame();
  }

  /* ── drawer ──────────────────────────────────────────── */

  function drawer() {
    var burger = $('#burger');
    var panel = $('#drawer');
    if (!burger || !panel) return;
    var open = false;

    function toggle(next) {
      open = next;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.classList.toggle('is-locked', open);

      if (open) {
        panel.hidden = false;
        requestAnimationFrame(function () { panel.classList.add('is-open'); });
        $$('.drawer__nav a', panel).forEach(function (a, i) {
          a.style.transitionDelay = (140 + i * 55) + 'ms';
        });
      } else {
        panel.classList.remove('is-open');
        $$('.drawer__nav a', panel).forEach(function (a) { a.style.transitionDelay = '0ms'; });
        setTimeout(function () { if (!open) panel.hidden = true; }, 700);
      }
    }

    burger.addEventListener('click', function () { toggle(!open); });
    $$('a', panel).forEach(function (a) {
      a.addEventListener('click', function () { toggle(false); });
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && open) { toggle(false); burger.focus(); }
    });
  }

  /* ── reviews carousel ────────────────────────────────── */

  function reviews() {
    var track = $('#revTrack');
    var dots = $('#revDots');
    if (!track) return;
    var items = $$('[data-rev-item]', track);
    if (items.length < 2) { if (dots) dots.remove(); return; }

    var at = 0;
    var timer = null;
    var DWELL = 7000;

    /* Absolute-positioned slides need the tallest one to set the height,
       otherwise the section collapses as reviews change length. */
    function size() {
      track.style.height = 'auto';
      var tallest = 0;
      items.forEach(function (li) {
        var was = li.className;
        li.className = 'rev is-on';
        li.style.position = 'relative';
        tallest = Math.max(tallest, li.offsetHeight);
        li.style.position = '';
        li.className = was;
      });
      track.style.height = tallest + 'px';
    }

    items.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', 'Review ' + (i + 1));
      b.setAttribute('aria-selected', String(i === 0));
      b.addEventListener('click', function () { go(i, true); });
      dots.appendChild(b);
    });

    function go(next, manual) {
      at = (next + items.length) % items.length;
      items.forEach(function (li, i) { li.classList.toggle('is-on', i === at); });
      $$('button', dots).forEach(function (b, i) {
        b.setAttribute('aria-selected', String(i === at));
      });
      if (manual) restart();
    }

    function restart() {
      clearInterval(timer);
      if (!calm) timer = setInterval(function () { go(at + 1); }, DWELL);
    }

    $$('[data-rev]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        go(at + parseInt(btn.dataset.rev, 10), true);
      });
    });

    var stage = track.closest('.revs__stage');
    if (stage) {
      stage.addEventListener('mouseenter', function () { clearInterval(timer); });
      stage.addEventListener('mouseleave', restart);
      stage.addEventListener('focusin', function () { clearInterval(timer); });
    }

    // Swipe on touch.
    var x0 = null;
    track.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    track.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 44) go(at + (dx < 0 ? 1 : -1), true);
      x0 = null;
    }, { passive: true });

    size();
    restart();
    window.addEventListener('resize', debounce(size, 180));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(size);
  }

  /* ── enquiry form ────────────────────────────────────── */

  function enquiryForm() {
    var form = $('#enqForm');
    if (!form) return;
    var done = $('#enqDone');
    var btn = $('#enqBtn');

    function clearErrors() {
      $$('.fld', form).forEach(function (f) { f.classList.remove('is-bad'); });
      $$('.err', form).forEach(function (e) { e.textContent = ''; });
    }

    function showErrors(errors) {
      var first = null;
      Object.keys(errors).forEach(function (key) {
        var slot = $('[data-err="' + key + '"]', form);
        if (!slot) return;
        slot.textContent = errors[key];
        var fld = slot.closest('.fld');
        if (fld) fld.classList.add('is-bad');
        if (!first) first = fld;
      });
      if (first) {
        first.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        var input = $('input, textarea, select', first);
        if (input) input.focus({ preventScroll: true });
      }
    }

    $$('input, textarea, select', form).forEach(function (el) {
      el.addEventListener('input', function () {
        var fld = el.closest('.fld');
        if (fld) fld.classList.remove('is-bad');
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors();
      form.classList.add('is-sending');
      if (btn) btn.querySelector('span').textContent = 'Sending…';

      fetch(form.action, { method: 'POST', body: new FormData(form) })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          form.classList.remove('is-sending');
          if (btn) btn.querySelector('span').textContent = 'Send enquiry';

          if (!res.d.ok) { showErrors(res.d.errors || {}); return; }

          $$('.form__row, .fld, .form__end', form).forEach(function (n) { n.style.display = 'none'; });
          $('.form__msg', done).textContent = res.d.message || 'Thank you — we have your enquiry.';
          $('.form__ref', done).textContent = res.d.ref ? 'Reference ' + res.d.ref : '';
          done.hidden = false;
          done.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        })
        .catch(function () {
          form.classList.remove('is-sending');
          if (btn) btn.querySelector('span').textContent = 'Send enquiry';
          showErrors({ message: 'That did not send. Please try again, or email us directly.' });
        });
    });
  }

  /* ── utilities ───────────────────────────────────────── */

  function debounce(fn, wait) {
    var t;
    return function () {
      clearTimeout(t);
      t = setTimeout(fn, wait);
    };
  }

  /* ── boot ────────────────────────────────────────────── */

  function start() {
    var heads = setupLines();

    // Recompute line breaks when the type metrics or the viewport change.
    var relayout = debounce(function () {
      if (calm) return;
      heads.forEach(function (h) {
        var wasIn = h.classList.contains('is-in');
        splitLines(h);
        if (wasIn) h.classList.add('is-in');
      });
    }, 200);
    window.addEventListener('resize', relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

    drawer();
    scrollWork();
    counters();
    reviews();
    enquiryForm();

    curtain(function () { reveals(heads); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
