/* =========================================================
   Meridian Dental Group — interaction layer
   Vanilla JS, no dependencies. Decorative motion is gated
   behind prefers-reduced-motion.
   ========================================================= */
(function () {
  'use strict';

  const $  = (s, c) => (c || document).querySelector(s);
  const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));
  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const SLOT_TIMES = ['08:30', '09:15', '10:00', '10:45', '11:30', '13:00',
                      '13:45', '14:30', '15:15', '16:30', '17:15', '18:00'];

  /* ---------- reveal ----------
     Geometry check rather than IntersectionObserver: the wipe starts at
     clip-path inset(0 100% 0 0), and a target clipped to zero area never
     reports an intersection ratio above zero. */
  function reveals() {
    let pending = $$('[data-reveal]');
    pending.forEach((el) => {
      const d = el.getAttribute('data-delay');
      if (d) el.style.setProperty('--rd', d + 'ms');
    });

    let queued = false;
    const check = () => {
      queued = false;
      const line = window.innerHeight * 0.92;
      pending = pending.filter((el) => {
        const r = el.getBoundingClientRect();
        const laidOut = r.width || r.height;   // skips anything still display:none
        if (laidOut && r.top < line) { el.classList.add('in'); return false; }
        return true;
      });
    };

    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(check);
    }, { passive: true });
    window.addEventListener('resize', check);
    document.addEventListener('reveal:check', check);
    check();
  }

  /* ---------- header ---------- */
  function header() {
    const head = $('#head');
    const bar = $('[data-ctabar]');
    let queued = false;

    const paint = () => {
      queued = false;
      const y = window.scrollY;
      head.classList.toggle('is-down', y > 40);
      if (bar) bar.classList.toggle('is-up', y > window.innerHeight * 0.75);
    };

    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    paint();
  }

  /* ---------- mobile sheet ---------- */
  function sheet() {
    const btn = $('[data-tog]');
    const panel = $('[data-sheet]');
    if (!btn || !panel) return;

    const close = () => {
      btn.setAttribute('aria-expanded', 'false');
      panel.classList.remove('is-open');
      document.body.style.overflow = '';
      setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 550);
    };
    const open = () => {
      panel.hidden = false;
      requestAnimationFrame(() => panel.classList.add('is-open'));
      btn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };

    btn.addEventListener('click', () => {
      btn.getAttribute('aria-expanded') === 'true' ? close() : open();
    });
    $$('a', panel).forEach((a) => a.addEventListener('click', close));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    // the toggle is hidden above this width, so an open sheet would trap the page
    const wide = window.matchMedia('(min-width: 1181px)');
    wide.addEventListener('change', (e) => { if (e.matches) close(); });
  }

  /* ---------- section dots + nav highlight ---------- */
  function sectionNav() {
    const box = $('[data-dots]');
    const links = $$('[data-navlink]');
    const ids = ['top', 'treatments', 'pathway', 'facilities', 'team', 'fees', 'book', 'faq'];
    const labels = ['Top', 'Treatments', 'Pathway', 'Facilities', 'Team', 'Fees', 'Booking', 'Questions'];

    const sections = ids
      .map((id, i) => ({ el: document.getElementById(id), id: id, label: labels[i] }))
      .filter((s) => s.el);

    const dots = sections.map((s) => {
      if (!box) return null;
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', s.label);
      b.addEventListener('click', () => s.el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' }));
      box.appendChild(b);
      return b;
    });

    if (!('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const i = sections.findIndex((s) => s.el === e.target);
        dots.forEach((d, n) => { if (d) d.classList.toggle('is-on', n === i); });
        const id = sections[i].id;
        links.forEach((l) => l.classList.toggle('is-on', l.getAttribute('href') === '#' + id));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    sections.forEach((s) => io.observe(s.el));

    // flip the dot colours over the dark bands
    if (box) {
      const darks = [$('.sec--pathway'), $('.sec--book'), $('.foot')].filter(Boolean);
      const dio = new IntersectionObserver((entries) => {
        const anyDark = entries.some((e) => e.isIntersecting);
        if (anyDark) box.classList.add('is-inv');
        else if (!darks.some(isMidViewport)) box.classList.remove('is-inv');
      }, { rootMargin: '-45% 0px -50% 0px' });
      darks.forEach((d) => dio.observe(d));
    }

    function isMidViewport(el) {
      const r = el.getBoundingClientRect();
      const mid = window.innerHeight / 2;
      return r.top <= mid && r.bottom >= mid;
    }
  }

  /* ---------- rotating headline word ---------- */
  function rotator() {
    const box = $('[data-rot]');
    if (!box) return;
    const items = $$('.rot__i', box);
    if (items.length < 2 || calm) return;

    let i = 0;
    setInterval(() => {
      const cur = items[i];
      i = (i + 1) % items.length;
      const next = items[i];
      cur.classList.remove('is-on');
      cur.classList.add('is-out');
      next.classList.add('is-on');
      setTimeout(() => cur.classList.remove('is-out'), 650);
    }, 2600);
  }

  /* ---------- odometer counters ---------- */
  function counters() {
    const nodes = $$('[data-odo]');
    if (!nodes.length) return;

    const run = (el) => {
      const target = parseFloat(el.getAttribute('data-odo'));
      const dp = parseInt(el.getAttribute('data-dp') || '0', 10);
      if (calm) { el.textContent = target.toFixed(dp); return; }
      const dur = 1300;
      const t0 = performance.now();
      const tick = (now) => {
        const p = clamp((now - t0) / dur, 0, 1);
        const eased = 1 - Math.pow(1 - p, 4);
        el.textContent = (target * eased).toFixed(dp);
        if (p < 1) requestAnimationFrame(tick);
        else el.textContent = target.toFixed(dp);
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) { nodes.forEach(run); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    nodes.forEach((n) => io.observe(n));
  }

  /* ---------- treatment tabs ---------- */
  function tabs() {
    const root = $('[data-tabs]');
    if (!root) return;
    const btns = $$('[role="tab"]', root);
    const pans = $$('[role="tabpanel"]', root);

    const show = (idx) => {
      btns.forEach((b, i) => {
        const on = i === idx;
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-selected', on ? 'true' : 'false');
      });
      pans.forEach((p, i) => {
        const on = i === idx;
        p.hidden = !on;
        p.classList.toggle('is-on', on);
      });
    };

    btns.forEach((b, i) => {
      b.addEventListener('click', () => show(i));
      b.addEventListener('keydown', (e) => {
        let next = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (i + 1) % btns.length;
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (i - 1 + btns.length) % btns.length;
        if (next === null) return;
        e.preventDefault();
        show(next);
        btns[next].focus();
      });
    });
  }

  /* ---------- pathway progress line ---------- */
  function pathway() {
    const el = $('[data-path]');
    if (!el || calm) return;
    let queued = false;

    const paint = () => {
      queued = false;
      const r = el.getBoundingClientRect();
      const start = window.innerHeight * 0.85;
      const travel = r.height + window.innerHeight * 0.35;
      const p = clamp((start - r.top) / travel, 0, 1);
      el.style.setProperty('--p', p.toFixed(3));
    };

    window.addEventListener('scroll', () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    }, { passive: true });
    window.addEventListener('resize', paint);
    paint();
  }

  /* ---------- bento tilt ---------- */
  function tilt() {
    if (!fine || calm) return;
    $$('[data-tilt]').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.transform =
          'perspective(760px) rotateY(' + (dx * 3).toFixed(2) + 'deg) rotateX(' +
          (-dy * 3).toFixed(2) + 'deg) translateY(-3px)';
      });
      el.addEventListener('pointerleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------- reviews: show more ---------- */
  function reviews() {
    const grid = $('[data-revs]');
    const btn = $('[data-revs-more]');
    if (!grid || !btn) return;
    btn.addEventListener('click', () => {
      grid.classList.add('is-all');
      btn.remove();
      document.dispatchEvent(new Event('reveal:check'));
    });
  }

  /* ---------- accordion ---------- */
  function accordion() {
    const root = $('[data-acc]');
    if (!root) return;
    const items = $$('.acc__i', root);

    const shut = (item) => {
      $('.acc__b', item).setAttribute('aria-expanded', 'false');
      $('.acc__p', item).style.height = '0px';
    };

    items.forEach((item) => {
      const btn = $('.acc__b', item);
      const pan = $('.acc__p', item);
      pan.style.height = '0px';
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        items.forEach(shut);
        if (open) return;
        btn.setAttribute('aria-expanded', 'true');
        pan.style.height = pan.scrollHeight + 'px';
      });
    });

    window.addEventListener('resize', () => {
      items.forEach((item) => {
        const btn = $('.acc__b', item);
        const pan = $('.acc__p', item);
        if (btn.getAttribute('aria-expanded') === 'true') pan.style.height = pan.scrollHeight + 'px';
      });
    });
  }

  /* ---------- opening hours ---------- */
  function openWindow(date) {
    const d = date.getDay();
    if (d >= 1 && d <= 5) return [8 * 60, 20 * 60];
    if (d === 6) return [9 * 60, 17 * 60];
    return null;
  }

  function hoursTile() {
    const el = $('[data-open-text]');
    if (!el) return;
    const now = new Date();
    const win = openWindow(now);
    const mins = now.getHours() * 60 + now.getMinutes();
    if (win && mins >= win[0] && mins < win[1]) {
      el.textContent = 'Open until ' + String(win[1] / 60).padStart(2, '0') + ':00';
    } else {
      el.textContent = 'Closed — emergency only';
    }
  }

  /* ---------- appointment picker ---------- */
  function picker() {
    const form = $('[data-picker]');
    if (!form) return;

    const chipBox = $('[data-chips="treatment"]', form);
    const dayBox = $('[data-days]', form);
    const slotBox = $('[data-slots]', form);
    const sumEl = $('[data-sum]', form);
    const errEl = $('[data-err]', form);
    const done = $('[data-done]', form);

    const state = { treatment: 'Assessment', date: null, time: null };

    /* treatment chips */
    if (chipBox) {
      $$('.chip', chipBox).forEach((chip) => {
        chip.addEventListener('click', () => {
          $$('.chip', chipBox).forEach((c) => c.classList.remove('is-on'));
          chip.classList.add('is-on');
          state.treatment = chip.textContent.trim();
          summary();
        });
      });
    }

    /* day buttons — the next seven days from today */
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const closed = openWindow(date) === null;

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'day';
      b.disabled = closed;
      b.setAttribute('aria-label',
        DAY_NAMES[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()] +
        (closed ? ', closed' : ''));
      b.innerHTML =
        '<span class="day__d">' + (i === 0 ? 'Today' : DAY_NAMES[date.getDay()]) + '</span>' +
        '<span class="day__n">' + date.getDate() + '</span>';

      if (!closed) {
        b.addEventListener('click', () => {
          days.forEach((d) => d.btn.classList.remove('is-on'));
          b.classList.add('is-on');
          state.date = date;
          state.time = null;
          buildSlots(date, i);
          summary();
        });
      }
      days.push({ btn: b, date: date, closed: closed, index: i });
      if (dayBox) dayBox.appendChild(b);
    }

    /* a slot is free unless the pattern marks it taken or the time has passed today */
    function isFree(date, dayIndex, slotIndex) {
      const parts = SLOT_TIMES[slotIndex].split(':');
      const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const taken = (dayIndex * 3 + slotIndex * 5) % 4 === 0;
      return !taken && !(isToday && mins <= nowMins + 30);
    }

    function freeCount(date, dayIndex) {
      return SLOT_TIMES.reduce((n, _t, i) => n + (isFree(date, dayIndex, i) ? 1 : 0), 0);
    }

    /* time slots — deterministic "taken" pattern, plus past times today */
    function buildSlots(date, dayIndex) {
      if (!slotBox) return;
      slotBox.textContent = '';
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      const nowMins = now.getHours() * 60 + now.getMinutes();

      SLOT_TIMES.forEach((time, i) => {
        const parts = time.split(':');
        const mins = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        const taken = (dayIndex * 3 + i * 5) % 4 === 0;
        const past = isToday && mins <= nowMins + 30;

        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot';
        b.textContent = time;
        b.disabled = taken || past;
        if (b.disabled) b.setAttribute('aria-label', time + ', unavailable');

        b.addEventListener('click', () => {
          $$('.slot', slotBox).forEach((s) => s.classList.remove('is-on'));
          b.classList.add('is-on');
          state.time = time;
          summary();
        });
        slotBox.appendChild(b);
      });
    }

    /* default to the first day that still has real availability, not just the first open one */
    const preset = days.find((d) => !d.closed && freeCount(d.date, d.index) >= 3)
                || days.find((d) => !d.closed);
    if (preset) {
      preset.btn.classList.add('is-on');
      state.date = preset.date;
      buildSlots(preset.date, preset.index);
      announceNext(preset);
    }

    /* keep the hero tile and the sticky bar honest about the earliest real slot */
    function announceNext(day) {
      const i = SLOT_TIMES.findIndex((_t, n) => isFree(day.date, day.index, n));
      if (i < 0) return;
      const time = SLOT_TIMES[i];
      const isToday = day.date.toDateString() === new Date().toDateString();
      const when = isToday ? 'today' : DAY_NAMES[day.date.getDay()] + ' ' + day.date.getDate() + ' ' + MONTHS[day.date.getMonth()];

      const long = $('[data-next-long]');
      const short = $('[data-next-short]');
      if (long) long.textContent = 'Next free slot ' + when + ' at ' + time;
      if (short) short.textContent = (isToday ? 'Today' : when) + ' · ' + time;
    }

    function label(date) {
      const isToday = date.toDateString() === new Date().toDateString();
      return (isToday ? 'today' : DAY_NAMES[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS[date.getMonth()]);
    }

    function summary() {
      if (!sumEl) return;
      if (!state.date) { sumEl.textContent = state.treatment + ' — choose a day and time'; return; }
      if (!state.time) { sumEl.textContent = state.treatment + ' — ' + label(state.date) + ', choose a time'; return; }
      sumEl.textContent = state.treatment + ' — ' + label(state.date) + ' at ' + state.time;
      if (errEl) errEl.textContent = '';
    }
    summary();

    /* submit */
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = $('input[name="name"]', form);
      const phone = $('input[name="phone"]', form);

      if (!state.time) {
        if (errEl) errEl.textContent = 'Pick a time slot to continue.';
        if (slotBox) slotBox.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        return;
      }
      let ok = true;
      [name, phone].forEach((input) => {
        if (!input) return;
        const bad = !input.value.trim();
        input.classList.toggle('is-bad', bad);
        if (bad && ok) { input.focus(); ok = false; }
      });
      if (!ok) {
        if (errEl) errEl.textContent = 'We need a name and a mobile number to hold the slot.';
        return;
      }
      if (errEl) errEl.textContent = '';

      const line = $('[data-done-line]', form);
      const ref = $('[data-done-ref]', form);
      if (line) line.textContent = state.treatment + ' — ' + label(state.date) + ' at ' + state.time + ', Whitcombe Row.';
      if (ref) ref.textContent = 'MER-' + String(Math.floor(1000 + Math.random() * 8999));
      if (done) {
        done.hidden = false;
        requestAnimationFrame(() => done.classList.add('is-on'));
      }
    });

    $$('input', form).forEach((i) => i.addEventListener('input', () => i.classList.remove('is-bad')));

    const reset = $('[data-done-reset]', form);
    if (reset && done) {
      reset.addEventListener('click', () => {
        done.classList.remove('is-on');
        form.reset();
        setTimeout(() => { done.hidden = true; }, 450);
      });
    }
  }

  /* ---------- graceful image fallback ---------- */
  function imageFallback() {
    $$('[data-img]').forEach((img) => {
      img.addEventListener('error', () => {
        const holder = img.closest('figure') || img.parentElement;
        if (holder) holder.style.background = 'var(--bone-2)';
        img.style.opacity = '0';
      });
    });
  }

  /* ---------- footer year ---------- */
  function year() {
    const el = $('[data-year]');
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------- boot ---------- */
  function init() {
    reveals();
    header();
    sheet();
    sectionNav();
    rotator();
    counters();
    tabs();
    pathway();
    tilt();
    reviews();
    accordion();
    hoursTile();
    picker();
    imageFallback();
    year();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
