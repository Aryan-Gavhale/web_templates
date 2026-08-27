/* =========================================================================
   UMBRA — behaviour
   1. filtering the questions by what you actually came to ask
   2. short answer / longer answer disclosure
   3. a read mark against questions you have been to
   4. the recall button and the index overlay
   5. the sentence form, whose fields grow as you type
   Nothing here is load-bearing: with JavaScript off every answer is open,
   the index is the hero, and the form posts as an ordinary form.
   ========================================================================= */
(function () {
  'use strict';

  var root = document.documentElement;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var io = 'IntersectionObserver' in window;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) {
    return Array.prototype.slice.call((c || document).querySelectorAll(s));
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ------------------------------------------------------------ 0. reveal */

  var RISE = '.hero__head, .hero__h, .lede, .ask, .qlist, .q, .sh, .cols,' +
             '.who, .fees, .notes, .book, .foot__grid';

  if (calm || !io) {
    $$(RISE).forEach(function (el) { el.classList.add('in'); });
  } else {
    var rise = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        rise.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
    $$(RISE).forEach(function (el) { rise.observe(el); });

    /* Hidden copy is worse than unanimated copy. */
    window.setTimeout(function () {
      $$(RISE).forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('in');
      });
    }, 2400);
  }

  /* ------------------------------------------------- 1. filter the questions */

  var find = $('[data-find]');
  var qlist = $('[data-qlist]');
  var count = $('[data-find-count]');
  var none = $('[data-find-none]');

  var words = ['No', 'One', 'Two', 'Three', 'Four', 'Five',
               'Six', 'Seven', 'Eight', 'Nine', 'Ten'];

  /* every question's searchable text, gathered once */
  var rows = qlist ? $$('li', qlist).map(function (li) {
    var a = $('a', li);
    var sec = document.getElementById(a.getAttribute('data-q'));
    var keys = sec ? (sec.getAttribute('data-k') || '') : '';
    return {
      li: li,
      a: a,
      id: a.getAttribute('data-q'),
      n: $('b', a).textContent.trim(),
      text: $('span', a).textContent.trim(),
      hay: (a.textContent + ' ' + keys).toLowerCase()
    };
  }) : [];

  function say(n) {
    if (n === rows.length) return words[n] + ' questions';
    if (n === 0) return 'Nothing matches that';
    if (n === 1) return 'One question';
    return words[n] + ' questions';
  }

  function filter() {
    var term = (find.value || '').trim().toLowerCase();
    var hits = 0;

    rows.forEach(function (r) {
      var on = !term || r.hay.indexOf(term) > -1;
      r.li.hidden = !on;
      if (on) hits++;
    });

    if (count) count.textContent = say(hits);
    if (none) none.hidden = hits !== 0;
  }

  if (find) {
    find.addEventListener('input', filter);
    find.addEventListener('search', filter);
    filter();
  }

  /* -------------------------------------------------------- 2. disclosures */

  $$('[data-more-btn]').forEach(function (btn) {
    var body = btn.parentNode.querySelector('[data-more]');
    if (!body) return;
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      body.classList.toggle('open', !open);
      $('span', btn).textContent = open ? 'The longer answer' : 'That is enough';
    });
  });

  /* --------------------------------------------- 3. read marks + 4. recall */

  var recall = $('[data-recall]');
  var recallN = $('[data-recall-n]');
  var here = null;

  if (io) {
    /* a question counts as read once it has properly been on screen */
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var row = rows.filter(function (r) { return r.id === e.target.id; })[0];
        if (!row) return;
        row.a.classList.add('read');
        var mirror = $('[data-index-list] a[data-q="' + row.id + '"]');
        if (mirror) mirror.classList.add('read');
      });
    }, { threshold: 0.45 });
    $$('.q').forEach(function (q) { seen.observe(q); });

    /* which question the reader is currently in front of */
    var live = {};
    var where = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { live[e.target.id] = e.isIntersecting; });
      /* the first one across the line, so a question arriving from below does
         not claim the counter while its predecessor is still being read */
      for (var i = 0; i < rows.length; i++) {
        if (live[rows[i].id]) { here = rows[i]; break; }
      }
      if (here && recallN) recallN.textContent = here.n;
    }, { rootMargin: '-38% 0px -57% 0px', threshold: 0 });
    $$('.q').forEach(function (q) { where.observe(q); });

    /* The recall only exists while there are answers on screen and the index
       in the hero is not. Elsewhere it is either redundant or a chip sitting
       on top of somebody's prices. */
    if (recall) {
      var within = {};
      var atIndex = true;

      function settle() {
        var reading = Object.keys(within).some(function (k) { return within[k]; });
        recall.hidden = atIndex || !reading;
      }

      var inQ = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) { within[e.target.id] = e.isIntersecting; });
        settle();
      }, { threshold: 0 });
      $$('.q').forEach(function (q) { inQ.observe(q); });

      if (qlist) {
        var onIndex = new IntersectionObserver(function (entries) {
          atIndex = entries[0].isIntersecting;
          settle();
        }, { threshold: 0 });
        onIndex.observe(qlist);
      }
    }
  }

  /* ----------------------------------------------------- 5. index overlay */

  var index = $('[data-index]');
  var indexList = $('[data-index-list]');
  var back = null;

  if (indexList && rows.length) {
    indexList.innerHTML = rows.map(function (r) {
      return '<li><a href="#' + r.id + '" data-q="' + r.id + '" data-index-close>' +
             '<b>' + esc(r.n) + '</b><span>' + esc(r.text) + '</span></a></li>';
    }).join('');
  }

  function openIndex() {
    if (!index) return;
    back = document.activeElement;
    index.hidden = false;
    root.classList.add('lock');
    var first = $('a, button', index);
    if (first) first.focus();
  }
  function closeIndex() {
    if (!index || index.hidden) return;
    index.hidden = true;
    root.classList.remove('lock');
    if (back && back.focus) back.focus();
  }

  if (recall) recall.addEventListener('click', openIndex);
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-index-close]') : null;
    if (t) closeIndex();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && index && !index.hidden) closeIndex();
  });
  if (index) {
    index.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button', index).filter(function (el) {
        return el.offsetParent !== null;
      });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });
  }

  /* ------------------------------------------------- 6. the sentence form */

  var say_ = $('[data-say]');
  if (say_) {
    var mail = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;

    /* Every field is sized to what is in it, so the sentence stays a
       sentence instead of a row of boxes. A select is the awkward one: the
       browser sizes it to its longest option, which leaves a rule hanging
       past the words, so it gets measured against a ruler instead. */
    var ruler = document.createElement('span');
    ruler.setAttribute('aria-hidden', 'true');
    ruler.style.cssText =
      'position:absolute;left:-9999px;top:0;white-space:pre;visibility:hidden;';
    say_.appendChild(ruler);

    var fitters = [];

    $$('.slot input', say_).forEach(function (f) {
      var floor = (f.getAttribute('placeholder') || '').length;
      function fit() {
        var n = Math.max(floor, Math.min(26, f.value.length)) + 0.3;
        f.style.width = n + 'ch';
      }
      f.addEventListener('input', fit);
      fitters.push(fit);
    });

    $$('.slot select', say_).forEach(function (s) {
      function fit() {
        var cs = window.getComputedStyle(s);
        ruler.style.fontFamily = cs.fontFamily;
        ruler.style.fontSize = cs.fontSize;
        ruler.style.fontStyle = cs.fontStyle;
        ruler.style.fontWeight = cs.fontWeight;
        ruler.style.letterSpacing = cs.letterSpacing;
        ruler.textContent = s.options[s.selectedIndex].text;
        s.style.width = (ruler.offsetWidth + 7) + 'px';
      }
      s.addEventListener('change', fit);
      fitters.push(fit);
    });

    function fitAll() { fitters.forEach(function (f) { f(); }); }
    fitAll();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitAll);

    say_.addEventListener('input', function (e) {
      e.target.classList.remove('bad');
      var err = $('.say__err', say_);
      if (err) err.remove();
    });

    say_.addEventListener('submit', function (e) {
      e.preventDefault();

      var bad = [];
      $$('[required]', say_).forEach(function (f) {
        var ok = f.value.trim() !== '';
        if (ok && f.type === 'email') ok = mail.test(f.value.trim());
        f.classList.toggle('bad', !ok);
        if (!ok) bad.push(f);
      });

      var old = $('.say__err', say_);
      if (old) old.remove();

      if (bad.length) {
        var note = document.createElement('p');
        note.className = 'say__err';
        note.setAttribute('role', 'alert');
        note.textContent = 'A name, a telephone number and an email address, ' +
          'please — the gaps marked in red are the ones still to fill.';
        var foot = $('.say__foot', say_);
        if (foot) foot.appendChild(note);
        bad[0].focus();
        return;
      }

      var data = new FormData(say_);
      var flags = data.getAll('flag');

      var reply = document.createElement('div');
      reply.className = 'reply chamfer';
      reply.setAttribute('role', 'status');
      reply.innerHTML =
        '<p class="lab">Recebido</p>' +
        '<h3>Reception will ring you today.</h3>' +
        '<p>On the number below, before the clinic closes. If something ' +
        'changes before then, telephone <b>+351 21 347 22 60</b> and say so — ' +
        'the two 08.30 appointments are held back for exactly that call.</p>' +
        '<dl>' +
        '<div><dt>Nome</dt><dd>' + esc(data.get('name')) + '</dd></div>' +
        '<div><dt>Telefone</dt><dd>' + esc(data.get('tel')) + '</dd></div>' +
        '<div><dt>E-mail</dt><dd>' + esc(data.get('email')) + '</dd></div>' +
        '<div><dt>Assunto</dt><dd>' + esc(data.get('reason')) + '</dd></div>' +
        '<div><dt>Duração</dt><dd>' + esc(data.get('since')) + '</dd></div>' +
        '<div><dt>Prioridade</dt><dd>' +
          (flags.length ? 'Prioritário' : 'Normal') +
        '</dd></div>' +
        '</dl>';

      say_.parentNode.replaceChild(reply, say_);
      reply.setAttribute('tabindex', '-1');
      reply.focus();
    });
  }

  /* -------------------------------------------------------------- 7. tidy */

  var y = $('[data-year]');
  if (y) y.textContent = new Date().getFullYear();
})();
