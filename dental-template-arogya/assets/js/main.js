/* =========================================================
   AROGYA — interaction layer
   ---------------------------------------------------------
   Runs after site.js has poured the config into the DOM, so
   everything here works on the real, already-populated page.

   Nothing in this file is required for the content to be
   readable. If it throws, or the Lenis CDN is unreachable,
   the page still scrolls and every section is visible.
   ========================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var cfg = window.SITE_CONFIG || {};

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return [].slice.call((c || document).querySelectorAll(s)); };

  var still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var phone = function () { return window.innerWidth < 860; };


  /* ---------------------------------------------------------
     1. Smooth scrolling
     Lenis adds the weighted, inertial feel. Without it the page
     falls back to the browser's own scrolling, which is fine.
     --------------------------------------------------------- */
  var lenis = null;

  function smoothScroll() {
    if (still || typeof window.Lenis !== 'function') return;

    lenis = new window.Lenis({
      duration: 1.05,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.6,
      infinite: false
    });

    function frame(time) {
      lenis.raf(time);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* A dialog or lightbox must not scroll the page behind it. */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') lenis.start();
    });
  }

  /* Anchor jumps, routed through Lenis when it is running so the
     travel matches the rest of the page. */
  function anchors() {
    var barH = function () {
      var bar = $('[data-bar]');
      return bar ? bar.offsetHeight + 10 : 70;
    };

    $$('a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var id = link.getAttribute('href');
        if (!id || id === '#') return;

        var target = document.getElementById(id.slice(1));
        if (!target) return;

        e.preventDefault();
        if (lenis) {
          lenis.scrollTo(target, { offset: -barH(), duration: 1.1 });
        } else {
          window.scrollTo({
            top: target.getBoundingClientRect().top + window.pageYOffset - barH(),
            behavior: still ? 'auto' : 'smooth'
          });
        }
      });
    });
  }


  /* ---------------------------------------------------------
     2. Scroll reveal
     Children of a revealed group are staggered so a row of cards
     arrives in sequence rather than all at once.
     --------------------------------------------------------- */
  function reveals() {
    var nodes = $$('[data-reveal]');
    if (!nodes.length) return;

    /* Cards rendered from config get a reveal each, staggered by
       their position in the row. */
    $$('.rail, .why, .tiles, .nums, .assure').forEach(function (row) {
      $$(':scope > :not(template)', row).forEach(function (card, i) {
        if (card.hasAttribute('data-reveal')) return;
        card.setAttribute('data-reveal', '');
        card.style.setProperty('--d', Math.min(i, 6) * 70 + 'ms');
        nodes.push(card);
      });
    });

    nodes.forEach(function (n) {
      var delay = n.getAttribute('data-delay');
      if (delay) n.style.setProperty('--d', delay + 'ms');
    });

    function showAll() { nodes.forEach(function (n) { n.classList.add('is-in'); }); }

    if (still || !('IntersectionObserver' in window)) { showAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });

    nodes.forEach(function (n) { io.observe(n); });

    /* Belt and braces: nothing stays invisible because an observer
       misfired on an unusual browser. */
    window.setTimeout(showAll, 4000);
  }


  /* ---------------------------------------------------------
     3. Counters
     site.js writes data-count from the config, so these tween to
     whatever the client's real numbers are.
     --------------------------------------------------------- */
  function counters() {
    var nodes = $$('[data-count]');
    if (!nodes.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute('data-count'));
      if (isNaN(target)) return;
      var dp = parseInt(el.getAttribute('data-decimals') || '0', 10);

      if (still) { el.textContent = target.toLocaleString('en-IN', {
        minimumFractionDigits: dp, maximumFractionDigits: dp }); return; }

      var t0 = null;
      var span = 1400;
      function step(now) {
        if (t0 === null) t0 = now;
        var p = Math.min((now - t0) / span, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = (target * eased).toLocaleString('en-IN', {
          minimumFractionDigits: dp, maximumFractionDigits: dp });
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: .4 });
    nodes.forEach(function (n) { io.observe(n); });
  }


  /* ---------------------------------------------------------
     4. App bar + bottom dock
     --------------------------------------------------------- */
  function chrome() {
    var bar  = $('[data-bar]');
    var dock = $('[data-dock]');
    var hero = $('.hero');
    var book = $('#book');

    var queued = false;
    function paint() {
      queued = false;
      var y = window.pageYOffset;

      if (bar) bar.classList.toggle('is-stuck', y > 12);

      if (dock) {
        /* Up once the hero is behind you, but out of the way while
           the booking form itself is on screen. */
        var past = hero ? y > hero.offsetHeight * .65 : y > 380;
        var atForm = false;
        if (book) {
          var r = book.getBoundingClientRect();
          atForm = r.top < window.innerHeight * .72 && r.bottom > 120;
        }
        dock.classList.toggle('is-up', past && !atForm);
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


  /* ---------------------------------------------------------
     5. Open / closed pill
     Reads openBadge from the config, which is strict 24-hour
     "HH:MM-HH:MM" precisely so this can be trusted.
     --------------------------------------------------------- */
  function openNow() {
    var pill = $('[data-open-pill]');
    if (!pill) return;

    var badge = cfg.openBadge || {};
    var now = new Date();
    var day = now.getDay();                      /* 0 Sun … 6 Sat */

    var todays = day === 0 ? badge.sunday
               : day === 6 ? badge.saturday
               : badge.weekdays;

    var label = pill.querySelector('b');
    var span = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(String(todays || '').trim());

    if (!span) {
      pill.classList.add('is-shut');
      if (label) label.textContent = badge.closedNote || 'Closed today';
      return;
    }

    var mins = now.getHours() * 60 + now.getMinutes();
    var from = (+span[1]) * 60 + (+span[2]);
    var to   = (+span[3]) * 60 + (+span[4]);
    var open = mins >= from && mins < to;

    pill.classList.toggle('is-shut', !open);
    if (!label) return;

    if (open) {
      var left = to - mins;
      label.textContent = left <= 60 ? 'Closing in ' + left + ' min' : 'Open now';
    } else {
      label.textContent = mins < from
        ? 'Opens at ' + span[1] + ':' + span[2]
        : (badge.closedNote || 'Closed now');
    }
  }


  /* ---------------------------------------------------------
     6. Treatment filter
     The chips are built from whichever categories the config
     actually contains, so a clinic that only lists three kinds
     of treatment gets three chips.
     --------------------------------------------------------- */
  function filters() {
    var box = $('[data-filter]');
    if (!box) return;

    var rail = $(box.getAttribute('data-filter'));
    if (!rail) { box.remove(); return; }

    /* Lift each card's category onto the card itself. */
    var cards = $$(':scope > :not(template)', rail);
    cards.forEach(function (card) {
      var key = card.getAttribute('data-cat-from');
      if (!key) return;
      var src = card.querySelector('[data-field="' + key + '"]');
      card.setAttribute('data-cat', src ? src.textContent.trim() : '');
    });

    var cats = [];
    cards.forEach(function (card) {
      var c = card.getAttribute('data-cat');
      if (c && cats.indexOf(c) === -1) cats.push(c);
    });

    /* One category is not a filter, it is a label. */
    if (cats.length < 2) { box.remove(); return; }

    box.hidden = false;
    box.appendChild(chip('All', true));
    cats.forEach(function (c) { box.appendChild(chip(c, false)); });

    function chip(text, on) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = text;
      b.className = on ? 'is-on' : '';
      b.addEventListener('click', function () {
        $$('button', box).forEach(function (n) { n.classList.remove('is-on'); });
        b.classList.add('is-on');

        cards.forEach(function (card) {
          var show = text === 'All' || card.getAttribute('data-cat') === text;
          card.classList.toggle('is-hid', !show);
        });

        rail.scrollTo({ left: 0, behavior: still ? 'auto' : 'smooth' });
        window.dispatchEvent(new Event('resize'));   /* repaint the dots */
      });
      return b;
    }
  }


  /* ---------------------------------------------------------
     7. FAQ accordion
     --------------------------------------------------------- */
  function accordion() {
    $$('[data-accordion]').forEach(function (box) {
      $$('.qa__item', box).forEach(function (item) {
        var btn = $('.qa__q', item);
        var panel = $('.qa__a', item);
        if (!btn || !panel) return;

        btn.addEventListener('click', function () {
          var open = item.classList.contains('is-on');

          /* one at a time reads better than a wall of open text */
          $$('.qa__item.is-on', box).forEach(function (other) {
            if (other !== item) shut(other);
          });

          if (open) shut(item); else show(item);
        });

        function show(node) {
          var p = $('.qa__a', node);
          var b = $('.qa__q', node);
          node.classList.add('is-on');
          b.setAttribute('aria-expanded', 'true');
          p.hidden = false;
          if (still) { p.style.height = 'auto'; return; }
          p.style.height = '0px';
          requestAnimationFrame(function () {
            p.style.transition = 'height .34s cubic-bezier(.22,1,.36,1)';
            p.style.height = p.scrollHeight + 'px';
          });
          window.setTimeout(function () {
            if (node.classList.contains('is-on')) p.style.height = 'auto';
          }, 360);
        }

        function shut(node) {
          var p = $('.qa__a', node);
          var b = $('.qa__q', node);
          node.classList.remove('is-on');
          b.setAttribute('aria-expanded', 'false');
          if (still) { p.hidden = true; return; }
          p.style.height = p.scrollHeight + 'px';
          requestAnimationFrame(function () { p.style.height = '0px'; });
          window.setTimeout(function () {
            if (!node.classList.contains('is-on')) p.hidden = true;
          }, 340);
        }
      });
    });
  }


  /* ---------------------------------------------------------
     8. Booking form
     Validates in place, then swaps in the thank-you panel.
     There is no backend wired up — point the <form> at one
     before a real client goes live.
     --------------------------------------------------------- */
  function forms() {
    var form = $('[data-form]');
    if (!form) return;

    var done = $('.done', form);
    if (done) done.hidden = true;

    function check(field) {
      var input = $('input, select', field);
      if (!input) return true;
      var ok = input.checkValidity();
      field.classList.toggle('is-bad', !ok);
      return ok;
    }

    $$('.f', form).forEach(function (field) {
      var input = $('input, select', field);
      if (!input) return;
      input.addEventListener('blur', function () {
        if (input.value) check(field);
      });
      input.addEventListener('input', function () {
        if (field.classList.contains('is-bad')) check(field);
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      var bad = null;
      $$('.f', form).forEach(function (field) {
        if (!check(field) && !bad) bad = field;
      });

      if (bad) {
        var input = $('input, select', bad);
        if (input) input.focus();
        bad.animate(
          [{ transform: 'translateX(0)' }, { transform: 'translateX(-5px)' },
           { transform: 'translateX(5px)' }, { transform: 'translateX(0)' }],
          { duration: 260, easing: 'ease-in-out' });
        return;
      }

      if (done) {
        done.hidden = false;
        done.focus && done.focus();
      }
    });
  }


  /* ---------------------------------------------------------
     9. Small housekeeping
     --------------------------------------------------------- */
  function tidy() {
    /* Copyright year */
    $$('[data-year]').forEach(function (n) {
      n.textContent = String(new Date().getFullYear());
    });

    /* No WhatsApp number configured, no WhatsApp buttons. */
    var wa = cfg._ && cfg._.waHref;
    if (!wa) $$('[data-wa]').forEach(function (n) { n.remove(); });

    /* No hero photograph, so let the headline have the full row
       rather than leaving a gap beside it. */
    var art = $('[data-hero-art]');
    if (art) {
      var img = $('img', art);
      if (!img || !img.getAttribute('src')) art.remove();
      else img.addEventListener('error', function () { art.remove(); });
    }

    /* A photo that will not load is worse than one fewer photo. */
    $$('.shot img, .doc__pic img').forEach(function (img) {
      img.addEventListener('error', function () {
        var holder = img.closest('figure, .doc');
        if (holder) holder.remove();
      });
    });
  }


  /* ---------------------------------------------------------
     Boot
     --------------------------------------------------------- */
  function init() {
    root.classList.add('anim');       /* only now is it safe to hide reveals */

    try { smoothScroll(); } catch (e) {}
    try { anchors(); }      catch (e) {}
    try { reveals(); }      catch (e) {}
    try { counters(); }     catch (e) {}
    try { chrome(); }       catch (e) {}
    try { openNow(); }      catch (e) {}
    try { filters(); }      catch (e) {}
    try { accordion(); }    catch (e) {}
    try { forms(); }        catch (e) {}
    try { tidy(); }         catch (e) {}

    /* Keep the pill honest on a tab left open all day. */
    window.setInterval(function () { try { openNow(); } catch (e) {} }, 60000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
