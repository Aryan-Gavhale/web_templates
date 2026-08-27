/* ==========================================================================
   Wobble — children's dentistry
   1  reveal
   2  header, tray, dock, active nav
   3  first-visit storyboard
   4  two-minute brushing timer
   5  counter + opening hours
   6  booking + bravery certificate
   7  odds and ends
   ========================================================================== */
(function () {
  "use strict";

  var calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (s, r) {
    return (r || document).querySelector(s);
  };
  var $$ = function (s, r) {
    return Array.prototype.slice.call((r || document).querySelectorAll(s));
  };

  /* 1 ── reveal ──────────────────────────────────────────────────────────── */
  function reveal() {
    var items = $$(".pop");
    if (calm || !("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-in");
      });
      return;
    }
    var io = new IntersectionObserver(
      function (rows) {
        rows.forEach(function (row) {
          if (!row.isIntersecting) return;
          var el = row.target;
          var sibs = $$(".pop", el.parentNode);
          var i = sibs.indexOf(el);
          el.style.transitionDelay = (i > 0 ? Math.min(i, 5) * 70 : 0) + "ms";
          el.classList.add("is-in");
          io.unobserve(el);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach(function (el) {
      io.observe(el);
    });
  }

  /* 2 ── header, tray, dock, active nav ──────────────────────────────────── */
  function chrome() {
    var top = $(".top");
    var tray = $("#tray");
    var burger = $(".burger");
    var dock = $("[data-dock]");
    var links = $$(".nav a");
    var marks = links
      .map(function (a) {
        return { a: a, el: document.getElementById(a.getAttribute("href").slice(1)) };
      })
      .filter(function (m) {
        return m.el;
      });

    function shut() {
      tray.hidden = true;
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }

    if (burger) {
      burger.addEventListener("click", function () {
        var open = burger.getAttribute("aria-expanded") === "true";
        if (open) return shut();
        tray.hidden = false;
        burger.setAttribute("aria-expanded", "true");
      });
      $$("a", tray).forEach(function (a) {
        a.addEventListener("click", shut);
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") shut();
      });
    }

    var frame = false;
    function paint() {
      frame = false;
      var y = window.pageYOffset || document.documentElement.scrollTop;
      top.classList.toggle("is-stuck", y > 24);
      if (dock) dock.classList.toggle("is-up", y > window.innerHeight * 0.8);

      var here = null;
      marks.forEach(function (m) {
        var r = m.el.getBoundingClientRect();
        if (r.top <= 160 && r.bottom > 160) here = m.a;
      });
      links.forEach(function (a) {
        a.classList.toggle("is-here", a === here);
      });
    }
    window.addEventListener(
      "scroll",
      function () {
        if (frame) return;
        frame = true;
        window.requestAnimationFrame(paint);
      },
      { passive: true }
    );
    window.addEventListener("resize", paint);
    paint();
  }

  /* 3 ── storyboard ──────────────────────────────────────────────────────── */
  function story() {
    var card = $(".story__card");
    if (!card) return;
    var scenes = $$(".sc", card);
    var texts = $$("[data-steps] > li", card);
    var dots = $$(".dot", card);
    var prev = $("[data-prev]", card);
    var next = $("[data-next]", card);
    var now = $("[data-now]", card);
    var of = $("[data-of]", card);
    var at = 0;

    if (of) of.textContent = "of " + scenes.length;

    function draw(i, focus) {
      at = Math.max(0, Math.min(scenes.length - 1, i));
      scenes.forEach(function (el, k) {
        el.classList.toggle("is-on", k === at);
      });
      texts.forEach(function (el, k) {
        el.classList.toggle("is-on", k === at);
      });
      dots.forEach(function (d, k) {
        d.classList.toggle("is-on", k === at);
        d.setAttribute("aria-selected", k === at ? "true" : "false");
      });
      if (now) now.textContent = String(at + 1);
      prev.disabled = at === 0;
      next.disabled = at === scenes.length - 1;
      if (focus) {
        var live = texts[at].querySelector("h3");
        if (live) {
          live.setAttribute("tabindex", "-1");
          live.focus({ preventScroll: true });
        }
      }
    }

    prev.addEventListener("click", function () {
      draw(at - 1, true);
    });
    next.addEventListener("click", function () {
      draw(at + 1, true);
    });
    dots.forEach(function (d) {
      d.addEventListener("click", function () {
        draw(parseInt(d.getAttribute("data-go"), 10), true);
      });
    });
    card.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") draw(at + 1, true);
      if (e.key === "ArrowLeft") draw(at - 1, true);
    });

    draw(0, false);
  }

  /* 4 ── brushing timer ──────────────────────────────────────────────────── */
  function timer() {
    var box = $(".timer");
    if (!box) return;

    var TOTAL = 120;
    var SPAN = 30;
    var ZONES = ["Top left", "Top right", "Bottom left", "Bottom right"];
    var RING = 641;

    var ring = $("[data-ring]", box);
    var clock = $("[data-clock]", box);
    var zone = $("[data-zone]", box);
    var quads = $$("[data-quads] li", box);
    var play = $("[data-play]", box);
    var label = $("[data-play-l]", box);
    var reset = $("[data-reset]", box);
    var live = $("[data-live]", box);

    var run = false;
    var done = false;
    var spent = 0; // seconds banked from earlier runs
    var from = 0; // timestamp of the current run
    var beat = null;
    var said = -1;

    function secs() {
      var s = spent + (run ? (Date.now() - from) / 1000 : 0);
      return Math.min(TOTAL, s);
    }

    function clean(s) {
      var left = Math.max(0, Math.ceil(TOTAL - s));
      return Math.floor(left / 60) + ":" + ("0" + (left % 60)).slice(-2);
    }

    function paint() {
      var s = secs();
      var cur = Math.min(ZONES.length - 1, Math.floor(s / SPAN));

      clock.textContent = clean(s);
      ring.style.strokeDashoffset = String(RING * (1 - s / TOTAL));

      if (done) {
        zone.textContent = "All done. Nice work.";
      } else if (!run && s === 0) {
        zone.textContent = "Ready when you are";
      } else {
        zone.textContent = ZONES[cur] + (run ? "" : " (paused)");
      }

      quads.forEach(function (li, k) {
        li.classList.remove("is-now", "is-done", "is-next");
        if (done || k < cur) li.classList.add("is-done");
        else if (k === cur && (run || s > 0)) li.classList.add("is-now");
        else if (k === cur && s === 0) li.classList.add("is-next");
      });

      if (run && cur !== said) {
        said = cur;
        live.textContent = "Now brush the " + ZONES[cur].toLowerCase();
      }

      if (s >= TOTAL) finish();
    }

    function finish() {
      run = false;
      done = true;
      spent = TOTAL;
      window.clearInterval(beat);
      box.classList.add("is-done");
      label.textContent = "Go again";
      clock.textContent = "0:00";
      zone.textContent = "All done. Nice work.";
      ring.style.strokeDashoffset = "0";
      quads.forEach(function (li) {
        li.classList.remove("is-now", "is-next");
        li.classList.add("is-done");
      });
      live.textContent = "Two minutes finished. Spit, do not rinse.";
    }

    function start() {
      if (done) return wipe(true);
      run = true;
      from = Date.now();
      label.textContent = "Pause";
      beat = window.setInterval(paint, 200);
      paint();
    }

    function hold() {
      spent = secs();
      run = false;
      window.clearInterval(beat);
      label.textContent = "Keep going";
      paint();
    }

    function wipe(go) {
      window.clearInterval(beat);
      run = false;
      done = false;
      spent = 0;
      said = -1;
      box.classList.remove("is-done");
      label.textContent = "Start brushing";
      ring.style.transition = "none";
      ring.style.strokeDashoffset = String(RING);
      window.requestAnimationFrame(function () {
        ring.style.transition = "";
      });
      paint();
      if (go) start();
    }

    play.addEventListener("click", function () {
      if (run) hold();
      else start();
    });
    reset.addEventListener("click", function () {
      wipe(false);
    });

    paint();
  }

  /* 5 ── counter + opening hours ─────────────────────────────────────────── */
  function counter() {
    var el = $("[data-count]");
    if (!el) return;
    var end = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (calm || !("IntersectionObserver" in window)) {
      el.textContent = String(end);
      return;
    }
    var io = new IntersectionObserver(
      function (rows) {
        rows.forEach(function (row) {
          if (!row.isIntersecting) return;
          io.unobserve(el);
          var t0 = null;
          var span = 1100;
          function step(t) {
            if (t0 === null) t0 = t;
            var p = Math.min(1, (t - t0) / span);
            var e = 1 - Math.pow(1 - p, 3);
            el.textContent = String(Math.round(end * e));
            if (p < 1) window.requestAnimationFrame(step);
          }
          window.requestAnimationFrame(step);
        });
      },
      { threshold: 0.5 }
    );
    io.observe(el);
  }

  function hours() {
    var list = $("[data-hours]");
    var out = $("[data-open]");
    if (!list || !out) return;

    // day: [open, close] in decimal hours, null when shut
    var week = {
      0: null,
      1: [8.5, 18],
      2: [8.5, 18],
      3: [8.5, 19],
      4: [8.5, 18],
      5: [8.5, 17],
      6: [9, 14],
    };
    var names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

    function say(h) {
      var hh = Math.floor(h);
      var mm = Math.round((h - hh) * 60);
      return hh + "." + ("0" + mm).slice(-2);
    }

    var now = new Date();
    var d = now.getDay();
    var t = now.getHours() + now.getMinutes() / 60;

    $$("[data-day]", list).forEach(function (row) {
      row.classList.toggle("is-today", parseInt(row.getAttribute("data-day"), 10) === d);
    });

    var today = week[d];
    if (today && t >= today[0] && t < today[1]) {
      out.textContent = "Open now, until " + say(today[1]);
      out.classList.remove("is-shut");
      return;
    }

    var step = today && t < today[0] ? 0 : 1;
    for (var i = step; i < 8; i++) {
      var k = (d + i) % 7;
      if (week[k]) {
        out.textContent =
          "Closed \u00b7 opens " +
          (i === 0 ? "today" : i === 1 ? "tomorrow" : names[k]) +
          " at " +
          say(week[k][0]);
        out.classList.add("is-shut");
        return;
      }
    }
  }

  /* 6 ── booking + certificate ───────────────────────────────────────────── */
  function booking() {
    var form = $("[data-form]");
    if (!form) return;

    var cert = $("[data-cert]");
    var child = $("[data-child]", form);
    var parent = $("[data-parent]", form);
    var phone = $("[data-phone]", form);
    var when = $("[data-when]", form);
    var sum = $("[data-sum]", form);
    var err = $("[data-err]", form);
    var ages = $$("[data-age] button", form);
    var chips = $$("[data-chips] button", form);

    function age() {
      var on = ages.filter(function (b) {
        return b.classList.contains("is-on");
      })[0];
      return on ? on.getAttribute("data-v") : "3\u20135";
    }

    function notes() {
      return chips
        .filter(function (b) {
          return b.classList.contains("is-on");
        })
        .map(function (b) {
          return b.textContent.trim().toLowerCase();
        });
    }

    function nice(s) {
      s = (s || "").trim();
      return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
    }

    function tally() {
      var who = nice(child.value) || "your child";
      var line = "A free first visit for " + who + ", aged " + age() + ".";
      var n = notes();
      if (n.length) line += " Flagged: " + n.join(", ") + ".";
      line += " " + when.options[when.selectedIndex].text + ".";
      sum.textContent = line;
    }

    ages.forEach(function (b) {
      b.addEventListener("click", function () {
        ages.forEach(function (o) {
          o.classList.toggle("is-on", o === b);
        });
        tally();
      });
    });

    chips.forEach(function (b) {
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", function () {
        var on = b.classList.toggle("is-on");
        b.setAttribute("aria-pressed", on ? "true" : "false");
        tally();
      });
    });

    [child, parent, when].forEach(function (el) {
      el.addEventListener("input", tally);
      el.addEventListener("change", tally);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = !child.value.trim() || !parent.value.trim() || phone.value.trim().length < 7;
      err.hidden = !bad;
      if (bad) {
        (!child.value.trim() ? child : !parent.value.trim() ? parent : phone).focus();
        return;
      }

      $("[data-cert-name]", cert).textContent = nice(child.value);
      $("[data-cert-date]", cert).textContent = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      $("[data-cert-msg]", cert).textContent =
        "Booked. We will ring " + phone.value.trim() + " today with two or three times.";

      form.hidden = true;
      cert.hidden = false;
      cert.setAttribute("tabindex", "-1");
      cert.focus({ preventScroll: true });
    });

    $("[data-print]", cert).addEventListener("click", function () {
      window.print();
    });

    $("[data-again]", cert).addEventListener("click", function () {
      form.reset();
      chips.forEach(function (b) {
        b.classList.remove("is-on");
        b.setAttribute("aria-pressed", "false");
      });
      ages.forEach(function (b, i) {
        b.classList.toggle("is-on", i === 1);
      });
      tally();
      cert.hidden = true;
      form.hidden = false;
      child.focus();
    });

    tally();
  }

  /* 7 ── odds and ends ───────────────────────────────────────────────────── */
  function bits() {
    var y = $("[data-year]");
    if (y) y.textContent = String(new Date().getFullYear());

    $$("img").forEach(function (img) {
      img.addEventListener("error", function () {
        img.style.display = "none";
      });
    });
  }

  function go() {
    reveal();
    chrome();
    story();
    timer();
    counter();
    hours();
    booking();
    bits();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", go);
  } else {
    go();
  }
})();
