/* =========================================================
   SÉRA — interaction layer
   No dependencies. Everything degrades to a readable,
   fully navigable page if this file never runs.
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return Math.min(Math.max(v, a), b); };

  /* -------------------------------------------------------
     IMAGES — fade in once decoded
     ------------------------------------------------------- */
  function watchImage(img) {
    if (img.complete && img.naturalWidth) { img.classList.add('is-loaded'); return; }
    img.addEventListener('load', function () { img.classList.add('is-loaded'); });
    img.addEventListener('error', function () { img.classList.add('is-loaded'); });
  }
  $$('img').forEach(watchImage);

  /* -------------------------------------------------------
     SPLIT — wrap words in overflow-clipped spans
     ------------------------------------------------------- */
  function split(el) {
    var frag = document.createDocumentFragment();

    (function build(src, target) {
      Array.prototype.slice.call(src.childNodes).forEach(function (node) {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (!tok.trim()) { target.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            var i = document.createElement('i');
            w.className = 'w';
            i.textContent = tok;
            w.appendChild(i);
            target.appendChild(w);
          });
        } else if (node.nodeName === 'BR') {
          target.appendChild(document.createElement('br'));
        } else {
          var clone = node.cloneNode(false);
          build(node, clone);
          target.appendChild(clone);
        }
      });
    })(el, frag);

    el.textContent = '';
    el.appendChild(frag);
    $$('.w > i', el).forEach(function (i, idx) {
      i.style.transitionDelay = (idx * 0.045).toFixed(3) + 's';
    });
  }
  $$('[data-split]').forEach(split);

  /* -------------------------------------------------------
     BOOT — hold, lift, then release the page animations
     ------------------------------------------------------- */
  var boot = $('[data-boot]');

  function start() {
    revealInit();
    stepsInit();
    countInit();
  }

  if (boot && !REDUCED) {
    var lift = function () {
      boot.classList.add('is-done');
      setTimeout(function () { boot.remove(); }, 1100);
      start();
    };
    var done = false;
    var go = function () { if (!done) { done = true; setTimeout(lift, 320); } };
    window.addEventListener('load', go);
    setTimeout(go, 2200);
  } else {
    if (boot) boot.remove();
    start();
  }

  /* -------------------------------------------------------
     REVEAL
     ------------------------------------------------------- */
  function revealInit() {
    var items = $$('.r, [data-split]');
    if (!('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });
    items.forEach(function (el) { io.observe(el); });
  }

  /* -------------------------------------------------------
     HEADER — condense, hide on scroll down, progress
     ------------------------------------------------------- */
  var top = $('[data-top]');
  var prog = $('[data-prog]');
  var lastY = window.scrollY;

  function onScrollHeader() {
    var y = window.scrollY;
    if (top) {
      top.classList.toggle('is-stuck', y > 12);
      if (y > 480 && y > lastY + 6) top.classList.add('is-hidden');
      else if (y < lastY - 6 || y < 200) top.classList.remove('is-hidden');
    }
    if (prog) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      prog.style.width = (max > 0 ? (y / max) * 100 : 0) + '%';
    }
    lastY = y;
  }

  /* nav active state */
  (function navActive() {
    var links = $$('[data-navlink]');
    if (!links.length || !('IntersectionObserver' in window)) return;
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var a = map[e.target.id];
        if (!a) return;
        if (e.isIntersecting) {
          links.forEach(function (l) { l.removeAttribute('aria-current'); });
          a.setAttribute('aria-current', 'true');
        }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });

    Object.keys(map).forEach(function (id) {
      var s = document.getElementById(id);
      if (s) io.observe(s);
    });
  })();

  /* -------------------------------------------------------
     MOBILE MENU
     ------------------------------------------------------- */
  (function menu() {
    var el = $('[data-menu]');
    if (!el) return;
    var links = $$('[data-menu-link]', el);
    links.forEach(function (a, i) { a.style.setProperty('--i', i); });

    var open = function (state) {
      el.classList.toggle('is-open', state);
      el.setAttribute('aria-hidden', state ? 'false' : 'true');
      document.body.classList.toggle('stop', state);
    };

    var btn = $('[data-menu-open]');
    var close = $('[data-menu-close]');
    if (btn) btn.addEventListener('click', function () { open(true); });
    if (close) close.addEventListener('click', function () { open(false); });
    links.forEach(function (a) { a.addEventListener('click', function () { open(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') open(false);
    });
  })();

  /* -------------------------------------------------------
     TABS
     ------------------------------------------------------- */
  (function tabs() {
    var wrap = $('[data-tabs]');
    if (!wrap) return;
    var btns = $$('.tabs__btn', wrap);
    var panels = $$('.tabs__panel', wrap);
    var ink = $('[data-tab-ink]', wrap);

    function moveInk(btn) {
      if (!ink || !btn) return;
      ink.style.width = btn.offsetWidth + 'px';
      ink.style.transform = 'translateX(' + btn.offsetLeft + 'px)';
    }

    btns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-tab');
        btns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        panels.forEach(function (p) {
          p.classList.toggle('is-on', p.getAttribute('data-panel') === key);
        });
        moveInk(btn);
      });
    });

    var settle = function () { moveInk($('.tabs__btn.is-on', wrap)); };
    settle();
    window.addEventListener('resize', settle);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle);
    setTimeout(settle, 400);
  })();

  /* -------------------------------------------------------
     PEEK — cursor-following preview on the concern index
     ------------------------------------------------------- */
  (function peek() {
    var el = $('[data-peek]');
    if (!el || !FINE || REDUCED) return;
    var img = $('img', el);
    var x = 0, y = 0, cx = 0, cy = 0, on = false, raf = null;

    function loop() {
      cx += (x - cx) * 0.14;
      cy += (y - cy) * 0.14;
      el.style.left = cx + 'px';
      el.style.top = cy + 'px';
      raf = requestAnimationFrame(loop);
    }

    $$('[data-hoverlist] .index__row').forEach(function (row) {
      row.addEventListener('mouseenter', function () {
        var src = row.getAttribute('data-img');
        if (src && img.getAttribute('src') !== src) {
          img.classList.remove('is-loaded');
          img.setAttribute('src', src);
          watchImage(img);
        }
        on = true;
        el.classList.add('is-on');
        if (!raf) loop();
      });
      row.addEventListener('mouseleave', function () {
        on = false;
        el.classList.remove('is-on');
        setTimeout(function () {
          if (!on && raf) { cancelAnimationFrame(raf); raf = null; }
        }, 500);
      });
    });

    window.addEventListener('mousemove', function (e) {
      x = e.clientX + 200;
      y = e.clientY;
      if (x > window.innerWidth - 120) x = e.clientX - 200;
      y = clamp(y, 160, window.innerHeight - 160);
    });
  })();

  /* -------------------------------------------------------
     PROTOCOL STEPS — active state + rail
     ------------------------------------------------------- */
  var steps = [], rail = null, stepsWrap = null;

  function stepsInit() {
    stepsWrap = $('[data-steps]');
    rail = $('[data-rail]');
    if (!stepsWrap) return;
    steps = $$('.step', stepsWrap);

    if (!('IntersectionObserver' in window)) {
      steps.forEach(function (s) { s.classList.add('is-on'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        e.target.classList.toggle('is-on', e.isIntersecting);
      });
    }, { rootMargin: '-25% 0px -35% 0px' });
    steps.forEach(function (s) { io.observe(s); });
  }

  function onScrollRail() {
    if (!rail || !stepsWrap) return;
    var b = stepsWrap.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = clamp((vh * 0.65 - b.top) / b.height, 0, 1);
    rail.style.transform = 'scaleY(' + p.toFixed(4) + ')';
  }

  /* -------------------------------------------------------
     BEFORE / AFTER
     ------------------------------------------------------- */
  (function ba() {
    var el = $('[data-ba]');
    if (!el) return;
    var range = $('[data-ba-range]', el);
    var before = $('[data-ba-before]', el);
    var after = $('[data-ba-after]', el);
    var tagR = $('.ba__tag--r', el);

    function set(v) { el.style.setProperty('--x', v + '%'); }
    set(range ? range.value : 52);
    if (range) range.addEventListener('input', function () { set(range.value); });

    function swap(img, src) {
      if (!img || !src) return;
      img.classList.remove('is-loaded');
      img.setAttribute('src', src);
      watchImage(img);
    }

    $$('[data-cases] .cases__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        $$('[data-cases] .cases__btn').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-on', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });

        swap(before, btn.getAttribute('data-before'));
        swap(after, btn.getAttribute('data-after'));

        ['k1', 'k2', 'k3'].forEach(function (k) {
          var cell = $('[data-fact="' + k + '"]');
          if (cell) cell.textContent = btn.getAttribute('data-' + k) || '—';
        });

        if (tagR) {
          var m = (btn.getAttribute('data-k3') || '').match(/(\d+)\s*weeks?/i);
          tagR.textContent = m ? 'Week ' + m[1] : 'After';
        }

        if (range) {
          range.value = 52;
          set(52);
        }
      });
    });
  })();

  /* -------------------------------------------------------
     STRIP — drag to scroll + label cursor
     ------------------------------------------------------- */
  (function strip() {
    var el = $('[data-strip]');
    if (!el) return;
    var down = false, startX = 0, startL = 0, moved = 0;

    el.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      down = true; moved = 0;
      startX = e.clientX;
      startL = el.scrollLeft;
      el.classList.add('is-drag');
    });
    window.addEventListener('pointerup', function () {
      down = false;
      el.classList.remove('is-drag');
    });
    el.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      moved = Math.abs(dx);
      if (moved > 3) el.scrollLeft = startL - dx;
    });
    el.addEventListener('click', function (e) {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); }
    }, true);
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });

    var cur = $('[data-strip-cursor]');
    if (!cur || !FINE || REDUCED) return;
    el.addEventListener('mouseenter', function () { cur.classList.add('is-on'); });
    el.addEventListener('mouseleave', function () { cur.classList.remove('is-on'); });
    el.addEventListener('mousemove', function (e) {
      cur.style.left = e.clientX + 'px';
      cur.style.top = e.clientY + 'px';
    });
  })();

  /* -------------------------------------------------------
     QUOTES SLIDER
     ------------------------------------------------------- */
  (function slider() {
    var el = $('[data-slider]');
    if (!el) return;
    var prev = $('[data-slide-prev]');
    var next = $('[data-slide-next]');
    var bar = $('[data-slide-bar]');

    function step() {
      var card = $('.quote', el);
      if (!card) return el.clientWidth;
      var gap = parseFloat(getComputedStyle(el).columnGap || getComputedStyle(el).gap || 0) || 0;
      return card.getBoundingClientRect().width + gap;
    }

    function paint() {
      var max = el.scrollWidth - el.clientWidth;
      if (bar) {
        var pct = clamp((el.clientWidth / el.scrollWidth) * 100, 8, 100);
        bar.style.width = pct + '%';
        bar.style.left = (max > 0 ? (el.scrollLeft / max) * (100 - pct) : 0) + '%';
      }
      if (prev) prev.disabled = el.scrollLeft <= 4;
      if (next) next.disabled = el.scrollLeft >= max - 4;
    }

    if (prev) prev.addEventListener('click', function () { el.scrollBy({ left: -step(), behavior: 'smooth' }); });
    if (next) next.addEventListener('click', function () { el.scrollBy({ left: step(), behavior: 'smooth' }); });
    el.addEventListener('scroll', paint, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  })();

  /* -------------------------------------------------------
     ACCORDION
     ------------------------------------------------------- */
  (function acc() {
    var wrap = $('[data-acc]');
    if (!wrap) return;
    var items = $$('.acc__item', wrap);

    function shut(item) {
      var q = $('.acc__q', item);
      var a = $('.acc__a', item);
      q.setAttribute('aria-expanded', 'false');
      a.style.height = '0px';
    }

    items.forEach(function (item) {
      var q = $('.acc__q', item);
      var a = $('.acc__a', item);
      a.style.height = '0px';

      q.addEventListener('click', function () {
        var isOpen = q.getAttribute('aria-expanded') === 'true';
        items.forEach(shut);
        if (!isOpen) {
          q.setAttribute('aria-expanded', 'true');
          a.style.height = a.scrollHeight + 'px';
        }
      });
    });

    window.addEventListener('resize', function () {
      items.forEach(function (item) {
        var q = $('.acc__q', item);
        var a = $('.acc__a', item);
        if (q.getAttribute('aria-expanded') === 'true') a.style.height = a.scrollHeight + 'px';
      });
    });
  })();

  /* -------------------------------------------------------
     COUNTERS
     ------------------------------------------------------- */
  function countInit() {
    var nodes = $$('[data-count]');
    if (!nodes.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count')) || 0;
      var suffix = el.getAttribute('data-suffix') || '';
      if (REDUCED) { el.textContent = target.toLocaleString('en-GB') + suffix; return; }
      var dur = 1500, t0 = null;
      function frame(t) {
        if (!t0) t0 = t;
        var p = clamp((t - t0) / dur, 0, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * e).toLocaleString('en-GB') + (p === 1 ? suffix : '');
        if (p < 1) requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    }

    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.4 });
    nodes.forEach(function (n) { io.observe(n); });
  }

  /* -------------------------------------------------------
     PARALLAX
     ------------------------------------------------------- */
  var para = $$('[data-parallax]');

  function onScrollPara() {
    if (REDUCED) return;
    var vh = window.innerHeight;
    para.forEach(function (el) {
      var b = el.getBoundingClientRect();
      if (b.bottom < -200 || b.top > vh + 200) return;
      var amt = parseFloat(el.getAttribute('data-parallax')) || 0.05;
      var y = clamp((b.top + b.height / 2 - vh / 2) * -amt, -70, 70);
      el.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0) scale(1.06)';
    });
  }

  /* -------------------------------------------------------
     FORM
     ------------------------------------------------------- */
  (function form() {
    var el = $('[data-form]');
    if (!el) return;
    el.addEventListener('submit', function (e) {
      e.preventDefault();
      var bad = false;
      $$('input[required], textarea[required]', el).forEach(function (input) {
        var field = input.closest('.field');
        var ok = input.value.trim().length > 1 &&
                 (input.type !== 'email' || /.+@.+\..+/.test(input.value));
        if (field) field.classList.toggle('is-bad', !ok);
        if (!ok) bad = true;
      });
      if (bad) return;

      var name = (el.querySelector('input[name="name"]') || {}).value || '';
      el.classList.add('is-sent');
      el.innerHTML =
        '<p class="eyebrow eyebrow--on" style="justify-content:center"><span class="dot"></span>Request received</p>' +
        '<h3 class="h2 h2--on" style="text-align:center;font-size:clamp(26px,3vw,40px)">Thank you' +
        (name ? ', ' + name.split(' ')[0] : '') + '.</h3>' +
        '<p class="form__fine" style="max-width:34ch">The secretary will reply with two or three ' +
        'specific times within one working day. Urgent cases are triaged today.</p>';
    });

    $$('input, textarea', el).forEach(function (input) {
      input.addEventListener('input', function () {
        var field = input.closest('.field');
        if (field) field.classList.remove('is-bad');
      });
    });
  })();

  /* -------------------------------------------------------
     MISC
     ------------------------------------------------------- */
  var year = $('[data-year]');
  if (year) year.textContent = new Date().getFullYear();

  /* -------------------------------------------------------
     SCROLL LOOP — one listener, one frame
     ------------------------------------------------------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      try {
        onScrollHeader();
        onScrollRail();
        onScrollPara();
      } finally {
        ticking = false;
      }
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();
})();
