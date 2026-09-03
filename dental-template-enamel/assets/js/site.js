/* =========================================================
   Shared configuration layer
   ---------------------------------------------------------
   Reads window.SITE_CONFIG (assets/js/site-config.js) and
   applies it to the page before any animation module runs.

   This file is identical in every template in the pack. All
   per-customer differences live in site-config.js.

   Markup contract
   ---------------
   Scalars        data-bind="path"        -> textContent
                  data-bind-html="path"   -> innerHTML
                  data-bind-href="path"   -> href
                  data-bind-src="path"    -> src
                  data-bind-alt="path"    -> alt

   Lists          data-repeat="path"      -> container holding a
                                             single <template>
     inside a template:
                  data-field="key"        -> textContent
                  data-field-html="key"   -> innerHTML
                  data-field-src="key"    -> src
                  data-field-alt="key"    -> alt
                  data-field-index        -> 01, 02, 03 ...

   Sections       data-section="gallery"  -> removed when that
                                             block is disabled

   An empty config value leaves the template's own demo content
   in place, so a half-filled config still renders a full page.
   ========================================================= */
(function () {
  'use strict';

  /* ---------- two config layers ----------
     site-config.js  window.SITE_CONFIG  full defaults, all keys
     client.js       window.SITE_CLIENT  per-customer overrides

     The bulk builder only ever writes client.js, which means it
     never has to read or re-emit the defaults. Objects merge key
     by key; arrays replace wholesale, because a client with three
     clinicians should get three, not three overlaid on four. */
  function merge(base, over) {
    Object.keys(over).forEach(function (k) {
      var v = over[k];
      if (v === undefined) return;
      var mergeable = v && typeof v === 'object' && !Array.isArray(v) &&
                      base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]);
      if (mergeable) merge(base[k], v);
      else base[k] = v;
    });
    return base;
  }

  var cfg = window.SITE_CONFIG || {};
  if (window.SITE_CLIENT) cfg = merge(cfg, window.SITE_CLIENT);

  /* ---------- path lookup: 'location.line1' ---------- */
  function get(path) {
    if (!path) return undefined;
    var node = cfg;
    var parts = path.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (node === null || typeof node !== 'object') return undefined;
      node = node[parts[i]];
    }
    return node;
  }

  /* Treat '', null and undefined as "not supplied" so the
     template's own content survives. 0 and false are real values. */
  function has(v) {
    return v !== undefined && v !== null && v !== '';
  }

  function all(sel, root) {
    return [].slice.call((root || document).querySelectorAll(sel));
  }

  function digits(v) {
    return String(v || '').replace(/[^\d+]/g, '');
  }

  /* ---------- derived values ---------- */
  /* Anything the markup needs but a human should not have to
     type twice: tel: links, map URLs, directions, wa.me. */
  function derive() {
    var contact = cfg.contact || {};
    var loc = cfg.location || {};
    var biz = cfg.business || {};
    var d = {};

    if (has(contact.phoneHref)) d.telHref = 'tel:' + digits(contact.phoneHref);
    if (has(contact.email))     d.mailHref = 'mailto:' + contact.email;
    if (has(contact.whatsapp))  d.waHref = 'https://wa.me/' + digits(contact.whatsapp).replace(/^\+/, '');

    /* the string we point Google at, in order of precision */
    var target = '';
    if (has(loc.mapLat) && has(loc.mapLng)) {
      target = loc.mapLat + ',' + loc.mapLng;
    } else if (has(loc.mapQuery)) {
      target = loc.mapQuery;
    } else if (has(loc.line1)) {
      target = [loc.line1, loc.line2].filter(has).join(', ');
    }
    d.mapTarget = target;

    var zoom = has(loc.mapZoom) ? loc.mapZoom : 16;
    if (has(loc.mapEmbedUrl)) {
      d.mapSrc = loc.mapEmbedUrl;
    } else if (target) {
      d.mapSrc = 'https://maps.google.com/maps?q=' + encodeURIComponent(target) +
                 '&z=' + zoom + '&hl=en&output=embed';
    }

    if (has(loc.directionsUrl)) {
      d.directionsHref = loc.directionsUrl;
    } else if (target) {
      d.directionsHref = 'https://www.google.com/maps/dir/?api=1&destination=' +
                         encodeURIComponent(target);
    }

    if (has(loc.reviewsUrl)) {
      d.reviewsHref = loc.reviewsUrl;
    } else if (target) {
      d.reviewsHref = 'https://www.google.com/maps/search/?api=1&query=' +
                      encodeURIComponent([biz.name, target].filter(has).join(' '));
    }

    d.addressOneLine = [loc.line1, loc.line2].filter(has).join(', ');
    d.addressStacked = [loc.line1, loc.line2].filter(has).join('<br />');

    cfg._ = d;
  }

  /* ---------- meta, title, theme colour ---------- */
  function meta() {
    var m = cfg.meta || {};
    if (has(m.title)) document.title = m.title;

    if (has(m.description)) {
      var desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', m.description);
    }
    var theme = has(m.themeColor) ? m.themeColor : get('brand.primary');
    if (has(theme)) {
      var tc = document.querySelector('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', theme);
    }
  }

  /* ---------- brand colour ---------- */
  /* Only the accent and the ink are exposed. Everything else in
     the palette is derived from them in CSS. */
  function brand() {
    var b = cfg.brand || {};
    var root = document.documentElement;
    if (has(b.primary)) {
      root.style.setProperty('--orange', b.primary);   /* ENAMEL accent */
      root.style.setProperty('--moss', b.primary);     /* Aurelia accent */
      root.style.setProperty('--brand', b.primary);
    }
    if (has(b.ink)) {
      root.style.setProperty('--ink', b.ink);
    }
  }

  /* ---------- scalar bindings ---------- */
  function scalars() {
    var jobs = [
      ['data-bind',      function (n, v) { n.textContent = v; }],
      ['data-bind-html', function (n, v) { n.innerHTML = v; }],
      ['data-bind-href', function (n, v) { n.setAttribute('href', v); }],
      ['data-bind-src',  function (n, v) { n.setAttribute('src', v); }],
      ['data-bind-alt',  function (n, v) { n.setAttribute('alt', v); }]
    ];

    jobs.forEach(function (job) {
      all('[' + job[0] + ']').forEach(function (node) {
        var v = get(node.getAttribute(job[0]));
        if (has(v)) job[1](node, v);
      });
    });
  }

  /* ---------- list rendering ---------- */
  function fill(node, item, index) {
    var pad = index < 9 ? '0' + (index + 1) : String(index + 1);

    all('[data-field-index]', node).forEach(function (n) { n.textContent = pad; });
    if (node.hasAttribute && node.hasAttribute('data-field-index')) node.textContent = pad;

    var jobs = [
      ['data-field',      function (n, v) { n.textContent = v; }],
      ['data-field-html', function (n, v) { n.innerHTML = v; }],
      ['data-field-src',  function (n, v) { n.setAttribute('src', v); }],
      ['data-field-alt',  function (n, v) { n.setAttribute('alt', v); }],
      ['data-field-href', function (n, v) { n.setAttribute('href', v); }],
      /* Feeds the animated counters. main.js reads data-count
         after this runs, so the tween starts from the real
         number and picks up its own decimal places. */
      ['data-field-count', function (n, v) {
        var num = String(v).replace(/[^\d.]/g, '');
        if (!num) { n.textContent = v; return; }
        var dot = num.indexOf('.');
        n.setAttribute('data-count', num);
        n.setAttribute('data-decimals', dot > -1 ? String(num.length - dot - 1) : '0');
        n.textContent = '0';
      }]
    ];

    jobs.forEach(function (job) {
      all('[' + job[0] + ']', node).forEach(function (n) {
        var key = n.getAttribute(job[0]);
        var v = item[key];
        if (has(v)) job[1](n, v);
        else if (job[0] === 'data-field') n.textContent = '';
      });
    });
  }

  function repeats() {
    all('[data-repeat]').forEach(function (box) {
      var list = get(box.getAttribute('data-repeat'));
      var tpl = box.querySelector('template');
      if (!tpl) return;

      /* No data supplied — leave the template alone so the
         section can be hidden by sections() instead. */
      if (!Array.isArray(list) || !list.length) return;

      var frag = document.createDocumentFragment();
      list.forEach(function (item, i) {
        var clone = tpl.content.cloneNode(true);
        var host = clone.firstElementChild;
        fill(host || clone, item || {}, i);
        frag.appendChild(clone);
      });

      /* keep the template for reference, drop previous output */
      all('[data-generated]', box).forEach(function (n) { n.remove(); });
      [].slice.call(frag.children).forEach(function (n) {
        n.setAttribute('data-generated', '');
      });
      box.appendChild(frag);
    });
  }

  /* ---------- optional sections ---------- */
  function sections() {
    all('[data-section]').forEach(function (node) {
      var key = node.getAttribute('data-section');
      var block = get(key) || {};

      var off = block.enabled === false;
      /* a gallery with no pictures, or a team with nobody in it,
         is worse than no section at all */
      if (!off && key === 'gallery') off = !(block.images || []).length;
      if (!off && key === 'team')    off = !(block.members || []).length;

      if (off) {
        node.remove();
        all('a[href="#' + node.id + '"]').forEach(function (a) { a.remove(); });
      }
    });
  }

  /* ---------- Google map, loaded only when it comes into view ---------- */
  function maps() {
    var holders = all('[data-map]');
    if (!holders.length) return;

    var src = get('_.mapSrc');
    if (!has(src)) {
      holders.forEach(function (h) {
        var wrap = h.closest('[data-map-wrap]') || h;
        wrap.remove();
      });
      return;
    }

    function load(holder) {
      if (holder.getAttribute('data-map-loaded')) return;
      holder.setAttribute('data-map-loaded', '1');

      var frame = document.createElement('iframe');
      frame.setAttribute('src', src);
      frame.setAttribute('title', 'Map showing ' +
        (get('business.name') || 'the practice') + ' at ' +
        (get('_.addressOneLine') || 'this location'));
      frame.setAttribute('loading', 'lazy');
      frame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
      frame.setAttribute('allowfullscreen', '');
      holder.appendChild(frame);
      holder.classList.add('is-loaded');
    }

    if (!('IntersectionObserver' in window)) {
      holders.forEach(load);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        load(e.target);
        io.unobserve(e.target);
      });
    }, { rootMargin: '400px 0px' });
    holders.forEach(function (h) { io.observe(h); });
  }

  /* ---------- gallery lightbox ---------- */
  function lightbox() {
    var figures = all('[data-lightbox] img');
    if (!figures.length) return;

    var box = document.createElement('div');
    box.className = 'lbox';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Practice photo');
    box.hidden = true;
    box.innerHTML =
      '<button class="lbox__x" type="button" aria-label="Close">&times;</button>' +
      '<button class="lbox__nav lbox__nav--prev" type="button" aria-label="Previous photo">&#8249;</button>' +
      '<figure class="lbox__stage"><img alt="" /><figcaption></figcaption></figure>' +
      '<button class="lbox__nav lbox__nav--next" type="button" aria-label="Next photo">&#8250;</button>';
    document.body.appendChild(box);

    var img = box.querySelector('img');
    var cap = box.querySelector('figcaption');
    var at = 0;
    var opener = null;

    function show(i) {
      at = (i + figures.length) % figures.length;
      var source = figures[at];
      img.setAttribute('src', source.currentSrc || source.src);
      img.setAttribute('alt', source.getAttribute('alt') || '');
      cap.textContent = (at + 1) + ' / ' + figures.length +
        (source.getAttribute('alt') ? ' · ' + source.getAttribute('alt') : '');
    }
    function open(i) {
      opener = document.activeElement;
      show(i);
      box.hidden = false;
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(function () { box.classList.add('is-on'); });
      box.querySelector('.lbox__x').focus();
    }
    function shut() {
      box.classList.remove('is-on');
      document.body.style.overflow = '';
      window.setTimeout(function () { box.hidden = true; }, 200);
      if (opener && opener.focus) opener.focus();
    }

    figures.forEach(function (node, i) {
      var trigger = node.closest('figure, button, a') || node;
      trigger.style.cursor = 'zoom-in';
      if (!trigger.hasAttribute('tabindex')) trigger.setAttribute('tabindex', '0');
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-label', 'Open photo ' + (i + 1) + ' of ' + figures.length);
      trigger.addEventListener('click', function () { open(i); });
      trigger.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); }
      });
    });

    box.querySelector('.lbox__x').addEventListener('click', shut);
    box.querySelector('.lbox__nav--prev').addEventListener('click', function () { show(at - 1); });
    box.querySelector('.lbox__nav--next').addEventListener('click', function () { show(at + 1); });
    box.addEventListener('click', function (e) {
      if (e.target === box || e.target.classList.contains('lbox__stage')) shut();
    });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') shut();
      if (e.key === 'ArrowLeft') show(at - 1);
      if (e.key === 'ArrowRight') show(at + 1);
    });

    /* swipe on a phone */
    var x0 = null;
    box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 48) show(at + (dx < 0 ? 1 : -1));
      x0 = null;
    });
  }

  /* ---------- swipe rails: progress dots on phones ---------- */
  /* Multi-column desktop rows become horizontal swipe rails on a
     phone rather than tall stacks. This wires up the little
     position indicator under each one. */
  function rails() {
    all('[data-rail-dots]').forEach(function (box) {
      var track = document.querySelector(box.getAttribute('data-rail-dots'));
      if (!track) return;

      function paint() {
        var cards = [].slice.call(track.children).filter(function (n) {
          return n.tagName !== 'TEMPLATE';
        });
        if (cards.length !== box.children.length) {
          box.innerHTML = '';
          cards.forEach(function () {
            box.appendChild(document.createElement('i'));
          });
        }
        var mid = track.scrollLeft + track.clientWidth / 2;
        var live = 0;
        cards.forEach(function (card, i) {
          var c = card.offsetLeft + card.offsetWidth / 2;
          if (Math.abs(c - mid) < Math.abs(
            cards[live].offsetLeft + cards[live].offsetWidth / 2 - mid)) live = i;
        });
        [].slice.call(box.children).forEach(function (dot, i) {
          dot.classList.toggle('is-on', i === live);
        });
      }

      var queued = false;
      track.addEventListener('scroll', function () {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () { queued = false; paint(); });
      }, { passive: true });
      window.addEventListener('resize', paint);
      paint();
    });
  }

  /* ---------- boot ---------- */
  function init() {
    derive();
    meta();
    brand();
    scalars();
    repeats();
    sections();
    maps();
    lightbox();
    rails();
    document.documentElement.classList.add('cfg-ready');
  }

  /* This must finish before main.js reads the DOM, so it runs
     immediately rather than waiting on DOMContentLoaded. The
     script tag is placed at the end of <body> for that reason. */
  init();
})();
