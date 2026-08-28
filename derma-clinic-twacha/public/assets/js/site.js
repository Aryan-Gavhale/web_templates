/* =============================================================================
   TWACHA — public site behaviour

   Every visible word, price, photograph and review on this page comes from
   GET /api/site, which the admin panel writes. Nothing is hard-coded here
   except the shape of the layout.
   ========================================================================== */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

document.documentElement.classList.add('js');

/* Escapes anything bound from the database. Content is authored by clinic
   staff, not the public, but an admin panel is not a licence to inject. */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Paragraph-per-blank-line, which is how the admin textareas are authored. */
const paras = (s) => String(s ?? '').split(/\n{2,}/).filter(Boolean)
  .map((p) => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('');

const stars = (n) => '★★★★★'.slice(0, Math.round(n || 0)).padEnd(5, '☆');

/** ISO dates come out of SQLite; visitors should not have to read them. */
const DATE_FMT = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric', month: 'short', year: 'numeric',
});
const niceDate = (iso) => {
  if (!iso) return '';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? String(iso) : DATE_FMT.format(d);
};

const PLACEHOLDER = '/assets/img/placeholder.svg';

/** Images come from the internet or from uploads; either can be missing. */
function safeImg(el, url, alt) {
  if (!el) return;
  el.alt = alt || '';
  el.addEventListener('error', () => {
    if (el.dataset.fellBack) return;
    el.dataset.fellBack = '1';
    el.src = PLACEHOLDER;
  });
  el.src = url || PLACEHOLDER;
}

const imgTag = (url, alt, cls = '') =>
  `<img ${cls ? `class="${cls}" ` : ''}src="${esc(url || PLACEHOLDER)}" alt="${esc(alt)}"
        loading="lazy" decoding="async"
        onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${PLACEHOLDER}'}">`;

/* =============================================================================
   Boot
   ========================================================================== */

let DATA = null;

try {
  const res = await fetch('/api/site', { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`The server replied ${res.status}.`);
  DATA = await res.json();
} catch (err) {
  $('#boot').innerHTML =
    `<p class="boot__msg">The site could not load its content.<br><br>
     ${esc(err.message)}<br><br>Is the server running? Try
     <code>npm start</code>, then reload.</p>`;
  throw err;
}

/**
 * Each block of the page renders independently. A single malformed row of
 * content should cost you that one section, not the whole site.
 *
 * render() itself is invoked at the very bottom of this module, after every
 * declaration exists. Calling it here instead would put any `let` or `const`
 * declared further down inside its temporal dead zone.
 */
const failures = [];
function step(label, fn) {
  try { fn(); } catch (err) {
    failures.push(`${label}: ${err.message}`);
    console.error(`[render] ${label} failed`, err);
  }
}

/* =============================================================================
   Render
   ========================================================================== */

function render(d) {
  const S = d.settings || {};
  const sec = d.section || {};

  /* ---- simple bindings -------------------------------------------------- */

  $$('[data-bind]').forEach((el) => {
    const v = S[el.dataset.bind];
    if (v != null && v !== '') el.textContent = v;
  });

  document.title = S.seo_title || document.title;
  const desc = $('meta[name=description]');
  if (desc && S.seo_description) desc.content = S.seo_description;

  const tel = String(S.phone || '').replace(/[^\d+]/g, '');
  $$('[data-bind-href=tel]').forEach((a) => { a.href = `tel:${tel}`; });

  const wa = String(S.whatsapp || '').replace(/[^\d]/g, '');
  const waHref = `https://wa.me/${wa}?text=${encodeURIComponent(S.whatsapp_message || '')}`;
  $$('[data-bind-href=wa]').forEach((a) => { a.href = waHref; });

  /* ---- section text ----------------------------------------------------- */

  const byKind = {};
  for (const s of d.sections || []) byKind[s.kind] ??= s;

  $$('[data-section]').forEach((host) => {
    const s = host.id === 'hero' ? sec.hero : (sec[host.id] || byKind[host.dataset.section]);
    if (!s) { host.hidden = true; return; }

    const put = (sel, val, html = false) => {
      const el = $(sel, host);
      if (!el) return;
      if (!val) { el.hidden = true; return; }
      if (html) el.innerHTML = val; else el.textContent = val;
    };
    const p = host.id === 'hero' ? 'data-hero' : 'data-s';

    put(`[${p}=eyebrow]`, s.eyebrow);
    put(`[${p}=title]`, s.title);
    put(`[${p}=subtitle]`, s.subtitle);
    put(`[${p}=body]`, paras(s.body), true);

    const cta = $(`[${p}=cta]`, host);
    if (cta) {
      if (s.cta_label) { cta.textContent = s.cta_label; if (s.cta_href) cta.href = s.cta_href; }
      else cta.hidden = true;
    }
    safeImg($(`[${p}=img]`, host), s.media_url, s.media_alt);
  });

  /* ---- hero ------------------------------------------------------------- */

  const hero = sec.hero;
  if (hero?.items?.length) {
    $('[data-hero=points]').innerHTML = hero.items.map((i) => `
      <li><strong>${esc(i.title)}</strong><span>${esc(i.body)}</span></li>`).join('');
  }

  /* Google rating badge — labelled with its real provenance either way. */
  const rv = d.reviews || {};
  if (S.show_google_badge !== false && rv.summary?.rating) {
    const b = $('#gBadge');
    b.hidden = false;
    $('.hero__badge__stars', b).textContent = stars(rv.summary.rating);
    $('.hero__badge__num', b).textContent =
      `${rv.summary.rating} from ${rv.summary.total || 0} reviews`;
    $('.hero__badge__src', b).textContent = rv.summary.source === 'google'
      ? (rv.summary.stale ? 'Google · cached' : 'Live from Google')
      : 'Sample data · connect Google to go live';
  }

  /* ticker */
  const marks = [
    'MD Dermatology led', 'Dermoscopy at every visit', 'Written treatment plans',
    'No-cost EMI available', 'Histology on every excision', 'Two Pune clinics',
    'Paediatric dermatology', 'Photographic records',
  ];
  $('#ticker').innerHTML = [...marks, ...marks].map((m) => `<span>${esc(m)}</span>`).join('');

  /* ---- stats ------------------------------------------------------------ */

  const stats = sec.trust || byKind.stats;
  if (stats?.items?.length) {
    $('#statsGrid').innerHTML = stats.items.map((i, n) => `
      <div class="stat r" style="--d:${n * 80}ms">
        <p class="stat__n" data-count="${esc(i.value)}">0${i.suffix ? `<em>${esc(i.suffix)}</em>` : ''}</p>
        <p class="stat__t">${esc(i.title)}</p>
        <p class="stat__b">${esc(i.body)}</p>
      </div>`).join('');
  }

  /* ---- services --------------------------------------------------------- */

  step('services', () => buildServices(d));

  /* ---- about bullets ---------------------------------------------------- */

  const about = sec.about || byKind.prose;
  if (about?.items?.length) {
    $('#aboutPts').innerHTML = about.items.map((i) => `
      <li><strong>${esc(i.title)}</strong><span>${esc(i.body)}</span></li>`).join('');
  }

  /* ---- doctors ---------------------------------------------------------- */

  step('doctors', () => { $('#docsGrid').innerHTML = (d.doctors || []).map((doc, n) => `
    <article class="doc" style="--d:${n * 90}ms">
      <div class="doc__fig">
        ${imgTag(doc.image_url, doc.image_alt || doc.name)}
        ${doc.experience_years ? `<span class="doc__yrs">${doc.experience_years} yrs</span>` : ''}
      </div>
      <div class="doc__in">
        <h3 class="doc__n">${esc(doc.name)}</h3>
        <p class="doc__c">${esc(doc.credentials)}</p>
        <p class="doc__r">${esc(doc.role_title)}</p>
        <p class="doc__b">${esc(doc.bio)}</p>
        <dl class="doc__f">
          ${doc.registration_no ? `<div><b>Registration</b> ${esc(doc.registration_no)}</div>` : ''}
          ${doc.languages ? `<div><b>Speaks</b> ${esc(doc.languages)}</div>` : ''}
        </dl>
      </div>
    </article>`).join(''); });

  /* ---- journey ---------------------------------------------------------- */

  const journey = sec.journey || byKind.steps;
  if (journey?.items?.length) {
    $('#stepsList').innerHTML = journey.items.map((i, n) => `
      <li class="step r" style="--d:${n * 110}ms">
        <p class="step__n">${esc(i.value || String(n + 1).padStart(2, '0'))}</p>
        <h3 class="step__t">${esc(i.title)}</h3>
        <p class="step__b">${esc(i.body)}</p>
      </li>`).join('');
  }

  /* ---- gallery ---------------------------------------------------------- */

  step('gallery', () => buildGallery(d));

  /* ---- reviews ---------------------------------------------------------- */

  step('reviews', () => buildReviews(d));

  /* ---- EMI tiles -------------------------------------------------------- */

  const emi = sec.emi || byKind.emi;
  if (emi?.items?.length) {
    $('#emiTiles').innerHTML = emi.items.map((i) => `
      <div class="tile">
        <p class="tile__n">${esc(i.value)}${i.suffix ? `<em>${esc(i.suffix)}</em>` : ''}</p>
        <p class="tile__t">${esc(i.title)}</p>
        <p class="tile__b">${esc(i.body)}</p>
      </div>`).join('');
  }

  /* ---- locations -------------------------------------------------------- */

  step('locations', () => { $('#locGrid').innerHTML = (d.locations || []).map((l, n) => {
    const addr = [l.address_line1, l.address_line2,
      [l.city, l.pincode].filter(Boolean).join(' ')].filter(Boolean).join('\n');
    const lwa = String(l.whatsapp || S.whatsapp || '').replace(/[^\d]/g, '');
    return `
    <article class="place r" style="--d:${n * 100}ms">
      <div class="place__top">
        <h3 class="place__n">${esc(l.name)}</h3>
        ${l.is_primary ? '<span class="chip">Main clinic</span>' : ''}
      </div>
      <p class="place__a">${esc(addr)}</p>
      ${l.hours ? `<p class="place__h">${esc(l.hours)}</p>` : ''}
      <div class="place__act">
        ${l.phone ? `<a href="tel:${esc(String(l.phone).replace(/[^\d+]/g, ''))}">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 3h3l2 5-2 1a9 9 0 004 4l1-2 5 2v3a1 1 0 01-1 1A15 15 0 013 4a1 1 0 011-1z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
          ${esc(l.phone)}</a>` : ''}
        ${lwa ? `<a href="https://wa.me/${lwa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${l.google_maps_url ? `<a href="${esc(l.google_maps_url)}" target="_blank" rel="noopener">
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 18s6-5.2 6-9.5A6 6 0 004 8.5C4 12.8 10 18 10 18z" fill="none" stroke="currentColor" stroke-width="1.4"/><circle cx="10" cy="8.5" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>
          Directions</a>` : ''}
      </div>
    </article>`;
  }).join(''); });

  /* ---- FAQ -------------------------------------------------------------- */

  const faq = sec.faq || byKind.faq;
  if (faq?.items?.length) {
    $('#faqList').innerHTML = faq.items.map((i, n) => `
      <div class="qa">
        <button class="qa__q" aria-expanded="false" aria-controls="qa-${n}">
          <span>${esc(i.title)}</span><span class="qa__ic" aria-hidden="true"></span>
        </button>
        <div class="qa__a" id="qa-${n}"><div><p>${esc(i.body)}</p></div></div>
      </div>`).join('');
  }

  /* ---- booking side ----------------------------------------------------- */

  step('booking', () => {
  const primary = (d.locations || []).find((l) => l.is_primary) || (d.locations || [])[0];
  $('#bookFacts').innerHTML = `
    <div><dt>Telephone</dt><dd><a href="tel:${esc(tel)}">${esc(S.phone)}</a></dd></div>
    <div><dt>WhatsApp</dt><dd><a href="${esc(waHref)}" target="_blank" rel="noopener">${esc(S.whatsapp)}</a></dd></div>
    ${S.consult_fee_note ? `<div><dt>Consultation</dt><dd>${esc(S.consult_fee_note)}</dd></div>` : ''}
    ${S.emi_note ? `<div><dt>Paying monthly</dt><dd><small>${esc(S.emi_note)}</small></dd></div>` : ''}
    ${primary ? `<div><dt>Main clinic</dt><dd>${esc(primary.name)}<small>${esc(primary.address_line1 || '')}</small></dd></div>` : ''}`;

  /* form selects */
  const svcSel = $('#f-service');
  const groups = {};
  for (const s of d.services || []) {
    (groups[s.category_name || 'Other'] ??= []).push(s);
  }
  svcSel.insertAdjacentHTML('beforeend', Object.entries(groups).map(([g, list]) => `
    <optgroup label="${esc(g)}">
      ${list.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}
    </optgroup>`).join(''));

  $('#f-location').innerHTML = (d.locations || [])
    .map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')
    || '<option value="">—</option>';
  });

  /* ---- footer ----------------------------------------------------------- */

  step('footer', () => {
  $('#footSvc').innerHTML = (d.services || []).filter((s) => s.is_featured).slice(0, 6)
    .map((s) => `<li><a href="#services">${esc(s.name)}</a></li>`).join('');

  $('#footContact').innerHTML = `
    <li><a href="tel:${esc(tel)}">${esc(S.phone)}</a></li>
    ${S.email ? `<li><a href="mailto:${esc(S.email)}">${esc(S.email)}</a></li>` : ''}
    ${(d.locations || []).map((l) => `<li><span>${esc(l.name)}</span></li>`).join('')}`;

  const SOCIAL = [
    ['instagram_url', 'Instagram', 'M10 6.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6zm5.2-.7a.9.9 0 11-1.8 0 .9.9 0 011.8 0zM10 2.8c2.3 0 2.6 0 3.5.05 2.4.1 3.6 1.3 3.7 3.7.04.9.05 1.2.05 3.5s0 2.6-.05 3.5c-.1 2.4-1.3 3.6-3.7 3.7-.9.04-1.2.05-3.5.05s-2.6 0-3.5-.05c-2.4-.1-3.6-1.3-3.7-3.7C2.8 12.6 2.8 12.3 2.8 10s0-2.6.05-3.5c.1-2.4 1.3-3.6 3.7-3.7C7.4 2.8 7.7 2.8 10 2.8z'],
    ['facebook_url', 'Facebook', 'M11.5 18v-6.5h2.2l.3-2.6h-2.5V7.3c0-.75.2-1.26 1.28-1.26H14V3.7c-.23-.03-1.03-.1-1.96-.1-1.94 0-3.27 1.18-3.27 3.36V8.9H6.5v2.6h2.27V18z'],
    ['practo_url', 'Practo', 'M4 4h5.5a4 4 0 010 8H7v4H4zm3 2v4h2.3a2 2 0 000-4z'],
  ];
  $('#social').innerHTML = SOCIAL.filter(([k]) => S[k]).map(([k, label, path]) => `
    <a href="${esc(S[k])}" target="_blank" rel="noopener" aria-label="${label}">
      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="${path}" fill="currentColor"/></svg>
    </a>`).join('');

  $('#revHeading').textContent = S.reviews_heading || 'What patients say';
  $('#year').textContent = new Date().getFullYear();
  });
}

/* =============================================================================
   Services with category tabs
   ========================================================================== */

function buildServices(d) {
  const tabsEl = $('#svcTabs');
  const gridEl = $('#svcGrid');
  const services = d.services || [];
  if (!services.length) { $('#services').hidden = true; return; }

  const used = new Set(services.map((s) => s.category_id));
  const cats = [{ id: 'all', name: 'All treatments' },
    ...(d.categories || []).filter((c) => used.has(c.id))];

  tabsEl.innerHTML = cats.map((c, n) => `
    <button role="tab" aria-selected="${n === 0}" data-cat="${c.id}">${esc(c.name)}</button>`).join('');

  const paint = (catId) => {
    const list = catId === 'all' ? services
      : services.filter((s) => String(s.category_id) === String(catId));

    gridEl.innerHTML = list.map((s, n) => {
      const price = s.price_from
        ? `<p class="card__price"><em>${s.price_to ? 'From' : 'Fee'}</em>${esc(s.price_from)}${s.price_to ? `–${esc(s.price_to)}` : ''}</p>`
        : '';
      return `
      <article class="card" style="--d:${Math.min(n, 9) * 55}ms">
        ${s.image_url ? `<div class="card__fig">${imgTag(s.image_url, s.image_alt || s.name)}</div>` : ''}
        <div class="card__in">
          <div class="card__tags">
            ${s.is_featured ? '<span class="chip chip--feat">Popular</span>' : ''}
            ${s.is_emi_eligible ? '<span class="chip chip--emi">EMI</span>' : ''}
            ${s.category_name ? `<span class="chip">${esc(s.category_name)}</span>` : ''}
          </div>
          <h3 class="card__h">${esc(s.name)}</h3>
          <p class="card__s">${esc(s.summary)}</p>

          ${s.body ? `
          <button class="card__more" aria-expanded="false" data-more>
            How this works
            <svg viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5L6 6.5l5-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
          <div class="card__body"><div><p>${esc(s.body)}</p></div></div>` : ''}

          <div class="card__meta">
            ${price}
            ${s.duration_min ? `<span><b>${s.duration_min}</b> min</span>` : ''}
            ${s.sessions_typical ? `<span>${esc(s.sessions_typical)}</span>` : ''}
          </div>
          ${s.price_note ? `<p class="card__s" style="font-size:.79rem;color:var(--faint)">${esc(s.price_note)}</p>` : ''}
        </div>
      </article>`;
    }).join('') || '<p style="color:var(--mute)">Nothing published in this category yet.</p>';

    wireDisclosures(gridEl);
  };

  paint('all');

  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    $$('[data-cat]', tabsEl).forEach((b) => b.setAttribute('aria-selected', b === btn));
    paint(btn.dataset.cat);
  });
}

/** Height-animated disclosure via grid-template-rows, which animates cleanly
    where height:auto does not. */
function wireDisclosures(root) {
  $$('[data-more]', root).forEach((btn) => {
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      btn.nextElementSibling.classList.toggle('open', !open);
    });
  });
}

/* =============================================================================
   Gallery + lightbox
   ========================================================================== */

let GAL = [];

function buildGallery(d) {
  GAL = d.gallery || [];
  if (!GAL.length) { $('#gallery').hidden = true; return; }

  $('#galGrid').innerHTML = GAL.slice(0, 6).map((g, n) => `
    <figure class="gal__i" style="--d:${n * 70}ms" tabindex="0" role="button"
            data-i="${n}" aria-label="View ${esc(g.alt || 'photograph')}">
      ${imgTag(g.url, g.alt)}
      ${g.alt ? `<figcaption>${esc(g.alt)}</figcaption>` : ''}
    </figure>`).join('');

  const fromGoogle = GAL.filter((g) => g.source === 'google').length;
  $('#galSrc').textContent = fromGoogle
    ? `${fromGoogle} of these photographs are served live from the clinic's Google Business Profile.`
    : 'Photographs are placeholders. Upload your own, or connect a Google Place ID to pull them from your Business Profile.';
}

const light = $('#light');
const lightImg = $('#lightImg');
let lightAt = 0;

function openLight(i) {
  lightAt = (i + GAL.length) % GAL.length;
  const g = GAL[lightAt];
  lightImg.src = g.url;
  lightImg.alt = g.alt || '';
  $('#lightCap').textContent = [g.alt, g.credit].filter(Boolean).join(' · ');
  light.hidden = false;
  document.body.style.overflow = 'hidden';
  $('#lightX').focus();
}
function closeLight() {
  light.hidden = true;
  document.body.style.overflow = '';
}

$('#galGrid').addEventListener('click', (e) => {
  const fig = e.target.closest('[data-i]');
  if (fig) openLight(Number(fig.dataset.i));
});
$('#galGrid').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const fig = e.target.closest('[data-i]');
  if (fig) { e.preventDefault(); openLight(Number(fig.dataset.i)); }
});
$('#lightX').addEventListener('click', closeLight);
$('#lightPrev').addEventListener('click', () => openLight(lightAt - 1));
$('#lightNext').addEventListener('click', () => openLight(lightAt + 1));
light.addEventListener('click', (e) => { if (e.target === light) closeLight(); });
addEventListener('keydown', (e) => {
  if (light.hidden) return;
  if (e.key === 'Escape') closeLight();
  if (e.key === 'ArrowLeft') openLight(lightAt - 1);
  if (e.key === 'ArrowRight') openLight(lightAt + 1);
});

/* =============================================================================
   Reviews carousel
   ========================================================================== */

function buildReviews(d) {
  const rv = d.reviews || {};
  const items = rv.items || [];
  if (!items.length) { $('#reviews').hidden = true; return; }

  const s = rv.summary || {};
  const live = rv.integration?.live;
  $('#revMeta').innerHTML = `
    ${s.rating ? `
      <div class="rev__score">
        <b>${esc(s.rating)}</b><span aria-hidden="true">${stars(s.rating)}</span>
      </div>
      <p class="rev__cnt">${esc(s.total || 0)} reviews${s.source === 'google' ? ' on Google' : ''}</p>` : ''}
    <span class="rev__mode rev__mode--${live ? 'live' : 'seed'}">
      ${live ? 'Live from Google' : 'Sample reviews'}
    </span>`;

  $('#revTrack').innerHTML = items.map((r) => `
    <article class="quote">
      <div class="quote__top">
        <span class="quote__stars" aria-label="${r.rating} out of 5">${stars(r.rating)}</span>
        <span class="quote__src ${r.is_google ? 'quote__src--g' : ''}">
          ${r.is_google ? 'Google' : (r.is_seed ? 'Sample' : 'Clinic')}
        </span>
      </div>
      <blockquote class="quote__b">${esc(r.body)}</blockquote>
      <div class="quote__f">
        <p class="quote__a">${esc(r.author)}</p>
        <p class="quote__m">${[r.treatment, r.location_name, niceDate(r.reviewed_at)]
          .filter(Boolean).map(esc).join(' · ')}</p>
      </div>
    </article>`).join('');

  $('#revNote').textContent = live
    ? 'Google returns a maximum of five reviews per location through its API; the remainder are published by the clinic.'
    : 'These are placeholder reviews. Add a Google Maps API key and a Place ID to show your real ones.';

  startCarousel(items.length);
}

function startCarousel(count) {
  const view = $('#revView');
  const track = $('#revTrack');
  const prev = $('#revPrev');
  const next = $('#revNext');
  const dots = $('#revDots');

  let at = 0;
  let perView = 1;
  let timer = null;

  const measure = () => {
    const card = track.firstElementChild;
    if (!card) return;
    perView = Math.max(1, Math.round(view.clientWidth / (card.offsetWidth + 18)));
    const pages = Math.max(1, count - perView + 1);
    at = Math.min(at, pages - 1);

    dots.innerHTML = Array.from({ length: pages }, (_, i) =>
      `<button role="tab" aria-selected="${i === at}" aria-label="Review ${i + 1}"></button>`).join('');
    go(at);
  };

  function go(i) {
    const pages = Math.max(1, count - perView + 1);
    at = (i + pages) % pages;
    const card = track.firstElementChild;
    if (!card) return;
    track.style.transform = `translateX(-${at * (card.offsetWidth + 18)}px)`;
    $$('button', dots).forEach((b, n) => b.setAttribute('aria-selected', String(n === at)));
    prev.disabled = false;
    next.disabled = false;
  }

  prev.addEventListener('click', () => { go(at - 1); rest(); });
  next.addEventListener('click', () => { go(at + 1); rest(); });
  dots.addEventListener('click', (e) => {
    const i = $$('button', dots).indexOf(e.target);
    if (i > -1) { go(i); rest(); }
  });

  /* Pointer drag, so the carousel behaves on a touchscreen without a
     gesture library. */
  let down = null;
  track.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, at };
    track.classList.add('drag');
    track.setPointerCapture(e.pointerId);
    stop();
  });
  track.addEventListener('pointermove', (e) => {
    if (!down) return;
    const card = track.firstElementChild;
    track.style.transform =
      `translateX(${-down.at * (card.offsetWidth + 18) + (e.clientX - down.x)}px)`;
  });
  const release = (e) => {
    if (!down) return;
    const card = track.firstElementChild;
    const moved = e.clientX - down.x;
    track.classList.remove('drag');
    go(down.at - Math.round(moved / (card.offsetWidth + 18)));
    down = null;
    rest();
  };
  track.addEventListener('pointerup', release);
  track.addEventListener('pointercancel', release);

  const stop = () => { clearInterval(timer); timer = null; };
  const rest = () => {
    stop();
    if (REDUCED) return;
    timer = setInterval(() => go(at + 1), 6500);
  };

  view.addEventListener('mouseenter', stop);
  view.addEventListener('mouseleave', rest);

  addEventListener('resize', debounce(measure, 160));
  measure();
  rest();
}

const debounce = (fn, ms) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

/* =============================================================================
   FAQ accordion
   ========================================================================== */

$('#faqList').addEventListener('click', (e) => {
  const btn = e.target.closest('.qa__q');
  if (!btn) return;
  const open = btn.getAttribute('aria-expanded') === 'true';

  // One at a time: a wall of open answers is harder to read than a list.
  $$('.qa__q').forEach((b) => {
    b.setAttribute('aria-expanded', 'false');
    b.nextElementSibling.classList.remove('open');
  });
  if (!open) {
    btn.setAttribute('aria-expanded', 'true');
    btn.nextElementSibling.classList.add('open');
  }
});

/* =============================================================================
   Reveals, counters, header state
   ========================================================================== */

const io = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    en.target.classList.add('in');
    if (en.target.dataset.count) countUp(en.target);
    io.unobserve(en.target);
  }
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

const observeAll = () => $$('.r, .step, [data-count]').forEach((el) => {
  if (!el.classList.contains('in')) io.observe(el);
});

/** Animates 0 → target, keeping the original formatting (12,400 / 4.8 / 38). */
function countUp(el) {
  const raw = el.dataset.count;
  const target = parseFloat(raw.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(target)) { el.innerHTML = raw + (el.querySelector('em')?.outerHTML || ''); return; }

  const suffix = el.querySelector('em')?.outerHTML || '';
  const decimals = (raw.split('.')[1] || '').length;
  const grouped = raw.includes(',');

  if (REDUCED) { el.innerHTML = raw + suffix; return; }

  const dur = 1250;
  const t0 = performance.now();
  const fmt = (n) => {
    const s = n.toFixed(decimals);
    return grouped ? Number(s).toLocaleString('en-IN', {
      minimumFractionDigits: decimals, maximumFractionDigits: decimals,
    }) : s;
  };

  const tick = (now) => {
    const p = Math.min(1, (now - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.innerHTML = fmt(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(tick);
    else el.innerHTML = raw + suffix;
  };
  requestAnimationFrame(tick);
}

/* header: background on scroll, progress bar, active link */
const nav = $('#nav');
const navBar = $('#navBar');
const links = $$('#navLinks a');
const targets = links.map((a) => $(a.getAttribute('href'))).filter(Boolean);

let raf = null;
addEventListener('scroll', () => {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    const y = scrollY;
    nav.classList.toggle('stuck', y > 24);
    $('#totop').hidden = y < 700;

    const max = document.documentElement.scrollHeight - innerHeight;
    navBar.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;

    let active = null;
    for (const t of targets) if (t.getBoundingClientRect().top <= 140) active = t;
    links.forEach((a) => a.classList.toggle('on', active && a.getAttribute('href') === `#${active.id}`));

    raf = null;
  });
}, { passive: true });

$('#totop').addEventListener('click', () =>
  scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }));

/* mobile nav */
const burger = $('#burger');
const navLinks = $('#navLinks');
burger.addEventListener('click', () => {
  const open = burger.getAttribute('aria-expanded') === 'true';
  burger.setAttribute('aria-expanded', String(!open));
  navLinks.classList.toggle('open', !open);
});
navLinks.addEventListener('click', (e) => {
  if (e.target.tagName === 'A') {
    burger.setAttribute('aria-expanded', 'false');
    navLinks.classList.remove('open');
  }
});

/* =============================================================================
   EMI indicator

   Client-side and deliberately labelled as an indication. The binding schedule
   is generated on the server in integer paise; this is a shop window, not a
   contract.
   ========================================================================== */

const calcAmt = $('#calcAmt');
const calcOut = $('#calcOut');
let months = 6;

const inr = (n) => `₹${Math.round(n).toLocaleString('en-IN')}`;

function recalc() {
  const rupees = Number(String(calcAmt.value).replace(/[^\d]/g, '')) || 0;
  calcOut.textContent = rupees && months ? inr(rupees / months) : '₹0';
}

calcAmt.addEventListener('input', () => {
  const digits = String(calcAmt.value).replace(/[^\d]/g, '').slice(0, 9);
  calcAmt.value = digits ? Number(digits).toLocaleString('en-IN') : '';
  recalc();
});

$('#calcTenure').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-m]');
  if (!btn) return;
  months = Number(btn.dataset.m);
  $$('#calcTenure button').forEach((b) => b.classList.toggle('on', b === btn));
  recalc();
});
recalc();

/* =============================================================================
   Enquiry form
   ========================================================================== */

const form = $('#enquiry');
const submit = $('#submit');
const formErr = $('#formErr');

const clearErrors = () => {
  $$('.field.bad', form).forEach((f) => f.classList.remove('bad'));
  $$('.check.bad', form).forEach((f) => f.classList.remove('bad'));
  $('[data-err=consent]').classList.remove('on');
  formErr.classList.remove('on');
};

const markField = (name, message) => {
  const input = form.elements[name];
  if (!input) return false;
  const holder = input.closest('.field') || input.closest('.check');
  if (!holder) return false;
  holder.classList.add('bad');
  const err = holder.querySelector(`[data-err=${name}]`) || $(`[data-err=${name}]`);
  if (err) {
    err.textContent = message;
    err.classList.add('on');
  }
  return true;
};

/* Client-side checks mirror the server's, purely so the answer is instant.
   The server validates again regardless — this is convenience, not security. */
function localCheck() {
  const problems = [];
  const name = form.elements.name.value.trim();
  const phone = form.elements.phone.value.trim();
  const email = form.elements.email.value.trim();

  if (!name) problems.push(['name', 'Please tell us your name.']);
  const digits = phone.replace(/\D/g, '');
  if (!phone) problems.push(['phone', 'A phone number is needed so we can call you back.']);
  else if (digits.length < 10) problems.push(['phone', 'That phone number looks too short.']);
  if (email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
    problems.push(['email', 'That email address does not look right.']);
  }
  if (!form.elements.consent.checked) {
    problems.push(['consent', 'Please tick the box so we may contact you.']);
  }
  return problems;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearErrors();

  const problems = localCheck();
  if (problems.length) {
    for (const [field, msg] of problems) markField(field, msg);
    const first = $('.field.bad input, .field.bad select, .check.bad input', form);
    first?.focus();
    return;
  }

  const body = {
    name: form.elements.name.value.trim(),
    phone: form.elements.phone.value.trim(),
    email: form.elements.email.value.trim(),
    service_id: form.elements.service_id.value || null,
    location_id: form.elements.location_id.value || null,
    message: form.elements.message.value.trim(),
    preferred_time: form.elements.preferred_time.value.trim(),
    wants_emi: form.elements.wants_emi.checked ? 1 : 0,
    consent: 1,
    website_url: form.elements.website_url.value,
  };

  submit.classList.add('busy');

  try {
    const res = await fetch('/api/enquiry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const out = await res.json();

    if (!res.ok) {
      if (out.details?.field && markField(out.details.field, out.error)) {
        // Field-level message is enough; no need to repeat it in the banner.
      } else {
        formErr.textContent = out.error || 'That did not go through. Please telephone the clinic.';
        formErr.classList.add('on');
      }
      return;
    }

    const svcName = form.elements.service_id.selectedOptions[0]?.value
      ? form.elements.service_id.selectedOptions[0].textContent.trim() : 'General consultation';

    $('#doneMsg').textContent = out.message || 'Reception will telephone you shortly.';
    $('#doneRef').innerHTML = `
      <div><dt>Reference</dt><dd>#${esc(out.id)}</dd></div>
      <div><dt>Enquiry about</dt><dd>${esc(svcName)}</dd></div>
      <div><dt>We will call</dt><dd>${esc(body.phone)}</dd></div>`;

    form.hidden = true;
    $('#done').hidden = false;
    $('#done').scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
  } catch {
    formErr.textContent =
      'The clinic could not be reached just now. Please telephone instead.';
    formErr.classList.add('on');
  } finally {
    submit.classList.remove('busy');
  }
});

/* Clear a field's error as soon as the visitor starts fixing it. */
form.addEventListener('input', (e) => {
  const holder = e.target.closest('.field, .check');
  if (holder?.classList.contains('bad')) {
    holder.classList.remove('bad');
    $('[data-err=consent]').classList.remove('on');
  }
});

$('#again').addEventListener('click', () => {
  form.reset();
  form.hidden = false;
  $('#done').hidden = true;
  clearErrors();
  form.elements.name.focus();
});

/* ------------------------------------------------------------------ boot -- */
/* Everything above is now defined, so it is safe to paint the page. */

render(DATA);

if (failures.length) {
  console.warn(`[render] ${failures.length} section(s) did not render:\n` + failures.join('\n'));
}

observeAll();

$('#boot').classList.add('gone');
setTimeout(() => $('#boot')?.remove(), 600);
