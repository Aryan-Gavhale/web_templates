/* =============================================================================
   Settings, Google integration, and the signed-in user's own account.

   Secrets are never echoed back by the API — they arrive as a mask plus a
   `configured` flag. The form therefore has to distinguish "left alone" from
   "cleared", which it does by sending nothing at all when the mask is untouched.
   ========================================================================== */

import {
  $, $$, esc, api, session, fmtWhen, titleCase, on, toastOk, toastBad,
  reportError, withBusy, modal, plural,
} from './core.js';

const MASK = '••••••••';

/* Group keys are lower-case slugs. Title-casing them is right for most, but
   "seo" would come out as "Seo". */
const GROUP_TITLE = {
  seo: 'Search engines',
  social: 'Social links',
  booking: 'Booking form',
  clinic: 'Clinic details',
  reviews: 'Reviews',
};

/* ============================================================ settings ==== */

export async function render({ mount, setHead }) {
  setHead('Settings', 'Clinic details, the booking form, and the Google connection.');

  const [data, g, locations] = await Promise.all([
    api('/admin/settings'),
    api('/admin/google/status').catch(() => null),
    api('/admin/locations', { query: { limit: 100 } }),
  ]);

  const byGroup = new Map();
  for (const s of data.items) {
    if (!byGroup.has(s.group_name)) byGroup.set(s.group_name, []);
    byGroup.get(s.group_name).push(s);
  }

  const canWrite = ['owner', 'manager'].includes(session.user.role);

  mount.innerHTML = `
    <div class="stack">
      ${canWrite ? '' : `<div class="note note--warn">Your role
        (${esc(session.user.role)}) can read these settings but not change them.</div>`}

      ${googleCard(g, locations.items)}

      <form id="setForm" novalidate class="stack">
        <div class="note note--bad" data-form-err hidden></div>
        ${[...byGroup].map(([group, rows]) => `
          <div class="card set__g">
            <div class="card__h"><h2>${esc(GROUP_TITLE[group] || titleCase(group))}</h2></div>
            <div class="card__b">${rows.map(settingField).join('')}</div>
          </div>`).join('')}

        ${canWrite ? `<div class="row row--end">
          <button class="btn btn--pri" type="submit">Save settings</button>
        </div>` : ''}
      </form>
    </div>`;

  if (!canWrite) $$('#setForm input, #setForm textarea, #setForm select', mount)
    .forEach((i) => { i.disabled = true; });

  $('#setForm', mount).addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const banner = $('[data-form-err]', form);
    banner.hidden = true;

    const body = {};
    for (const input of $$('[data-key]', form)) {
      const key = input.dataset.key;
      const value = input.type === 'checkbox' ? (input.checked ? '1' : '0') : input.value;
      // An untouched secret comes back as the mask; sending it would overwrite
      // the real value with dots.
      if (value === MASK) continue;
      body[key] = value;
    }

    await withBusy($('[type=submit]', form), async () => {
      try {
        const out = await api('/admin/settings', { method: 'PATCH', body });
        toastOk(`${plural(out.updated.length, 'setting')} saved.`);
      } catch (err) {
        banner.textContent = err.message;
        banner.hidden = false;
      }
    });
  });

  wireGoogle(mount, locations.items);
}

function settingField(s) {
  const id = `s_${s.key}`;
  const hint = s.hint ? `<p class="f__hint">${esc(s.hint)}</p>` : '';
  const label = `<label for="${id}">${esc(s.label || s.key)}</label>`;

  if (s.kind === 'bool') {
    return `<label class="check">
      <input type="checkbox" id="${id}" data-key="${esc(s.key)}" ${s.value === '1' ? 'checked' : ''}>
      <span>${esc(s.label || s.key)}${s.hint ? `<em>${esc(s.hint)}</em>` : ''}</span>
    </label>`;
  }

  if (['longtext', 'json'].includes(s.kind) || (s.value || '').length > 90) {
    return `<div class="f">${label}
      <textarea id="${id}" data-key="${esc(s.key)}" rows="3"
        ${s.kind === 'json' ? 'spellcheck="false"' : ''}>${esc(s.value || '')}</textarea>
      ${hint}</div>`;
  }

  if (s.kind === 'secret') {
    return `<div class="f">${label}
      <input type="text" id="${id}" data-key="${esc(s.key)}" value="${esc(s.value || '')}"
             autocomplete="off" spellcheck="false">
      <p class="f__hint">${s.configured
        ? 'Configured. Leave the dots alone to keep the current value, or type a new one.'
        : 'Not set.'}${s.hint ? ` ${esc(s.hint)}` : ''}</p></div>`;
  }

  const INPUT = { number: 'number', url: 'url', email: 'email', tel: 'tel' };
  return `<div class="f">${label}
    <input type="${INPUT[s.kind] || 'text'}" id="${id}"
           data-key="${esc(s.key)}" value="${esc(s.value || '')}">
    ${hint}</div>`;
}

/* ============================================================== google ==== */

function googleCard(g, locations) {
  const withId = locations.filter((l) => l.google_place_id);

  return `
  <div class="card">
    <div class="card__h">
      <h2>Google reviews and photographs</h2>
      ${g?.key_present
        ? '<span class="chip chip--ok">API key detected</span>'
        : '<span class="chip chip--warn">No API key</span>'}
      ${g?.mode === 'live' ? '<span class="chip chip--teal">Live</span>' : ''}
    </div>
    <div class="card__b">
      ${g?.key_present ? '' : `
        <div class="note note--warn" style="margin-bottom:1rem">
          <strong>The website is showing sample reviews.</strong> To show real ones:
          <ol style="margin:.5rem 0 0 1.1rem;list-style:decimal;padding:0">
            <li>Create a Google Cloud project and enable the <strong>Places API (New)</strong>.</li>
            <li>Create an API key and restrict it to that API.</li>
            <li>Put it in the project's <code>.env</code> file as
                <code>GOOGLE_MAPS_API_KEY=…</code> and restart the server.</li>
            <li>Find each clinic's Place ID below and save it against the clinic.</li>
          </ol>
        </div>`}

      <div class="note" style="margin-bottom:1rem">
        Google's API returns a maximum of <strong>five reviews per place</strong> and does not
        allow reordering or filtering them. That is a Google restriction. Anything beyond five
        has to be a review the clinic publishes itself under
        <a href="#/reviews" style="text-decoration:underline">Reviews</a>.
      </div>

      <div class="f">
        <label for="gq">Find a Place ID</label>
        <div class="row" style="flex-wrap:nowrap">
          <input type="text" id="gq" placeholder="TWACHA Skin Clinic Koregaon Park Pune"
                 style="flex:1">
          <button class="btn" id="gFind" type="button">Search</button>
        </div>
        <p class="f__hint">Search the way a patient would. Copy the Place ID onto the clinic
          under <a href="#/locations" style="text-decoration:underline">Clinics</a>.</p>
      </div>

      <div id="gResults"></div>

      <div style="border-top:1px solid var(--line);margin-top:1rem;padding-top:1rem">
        <p style="font-size:.79rem;color:var(--mute);margin-bottom:.7rem">
          ${withId.length
            ? `${plural(withId.length, 'clinic')} ${withId.length === 1 ? 'has' : 'have'} a Place ID:
               ${withId.map((l) => esc(l.name)).join(', ')}.`
            : 'No clinic has a Place ID yet, so there is nothing to sync.'}
        </p>
        <div class="row">
          ${/* An empty disabled select renders as a bare dropdown arrow with
                nothing behind it, so it is left out entirely until a clinic
                actually has a Place ID to pick. */ ''}
          ${withId.length > 1 ? `<select id="gLoc" aria-label="Clinic to sync">
            ${withId.map((l) => `<option value="${l.id}">${esc(l.name)}</option>`).join('')}
          </select>` : ''}
          ${withId.length === 1
            ? `<input type="hidden" id="gLoc" value="${withId[0].id}">` : ''}
          <button class="btn btn--pri" id="gSync" type="button"
                  ${g?.key_present && withId.length ? '' : 'disabled'}>Sync reviews now</button>
        </div>
        ${g?.last_fetch ? `<p style="font-size:.75rem;color:var(--faint);margin-top:.6rem">
          Last asked Google ${esc(fmtWhen(g.last_fetch))}${
            g.last_fetch_ok ? '' : ` — that attempt failed: ${esc(g.last_error || 'no reason given')}`}.
          Responses are cached for ${g.cache_ttl_minutes} minutes.</p>` : ''}
        ${g?.live_review_count ? `<p style="font-size:.75rem;color:var(--faint);margin-top:.35rem">
          ${g.live_review_count} live Google review(s) stored,
          ${g.seeded_review_count} sample row(s) still present.</p>` : ''}
      </div>
    </div>
  </div>`;
}

function wireGoogle(mount, locations) {
  const results = $('#gResults', mount);

  $('#gFind', mount).addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    const query = $('#gq', mount).value.trim();
    if (!query) { $('#gq', mount).focus(); return; }

    results.innerHTML = '<div class="loading"><span class="spin"></span> Asking Google…</div>';
    try {
      const out = await api('/admin/google/find', { method: 'POST', body: { query } });
      results.innerHTML = out.items.length
        ? `<div class="tw"><table>
             <thead><tr><th>Place</th><th>Rating</th><th>Place ID</th></tr></thead>
             <tbody>${out.items.map((p) => `<tr>
               <td>${esc(p.name)}<div class="t__sub">${esc(p.address)}</div></td>
               <td class="nowrap">${p.rating ? `${p.rating} ★ (${p.total})` : '—'}</td>
               <td><code class="mono" style="word-break:break-all">${esc(p.place_id)}</code>
                   <button class="btn btn--sm" data-copy="${esc(p.place_id)}"
                           style="margin-left:.4rem">Copy</button></td>
             </tr>`).join('')}</tbody></table></div>`
        : '<p class="note note--warn">Google found nothing for that search.</p>';
    } catch (err) {
      results.innerHTML = `<p class="note note--bad">${esc(err.message)}</p>`;
    }
  }));

  on(results, 'click', '[data-copy]', async (_e, btn) => {
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      toastOk('Place ID copied. Paste it onto the clinic under Clinics.');
    } catch {
      toastBad('Could not reach the clipboard — select the ID and copy it manually.');
    }
  });

  $('#gSync', mount)?.addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
    try {
      const out = await api('/admin/google/sync', {
        method: 'POST',
        body: { location_id: Number($('#gLoc', mount)?.value) || undefined },
      });
      toastOk(out.note || `${out.returned} review(s) synced.`, 'Google');
    } catch (err) { reportError(err); }
  }));
}

/* ============================================================= account ==== */

/** Reached at #/account. Own profile and password only. */
export async function account({ mount, setHead }) {
  const me = session.user;
  setHead('My account', `${me.email} · ${titleCase(me.role)}`);

  mount.innerHTML = `
    <div class="grid grid--2">
      <div class="card">
        <div class="card__h"><h2>Signed in as</h2></div>
        <div class="card__b">
          <dl class="dl">
            <div><dt>Name</dt><dd>${esc(me.name)}</dd></div>
            <div><dt>Email</dt><dd>${esc(me.email)}</dd></div>
            <div><dt>Role</dt><dd>${esc(titleCase(me.role))}</dd></div>
            <div><dt>Session ends</dt><dd>${esc(fmtWhen(session.expires_at))}</dd></div>
          </dl>
          <p class="f__hint" style="margin-top:.9rem">
            Only an owner can change your name, email or role — that is deliberate, so a
            compromised session cannot promote itself.
          </p>
        </div>
      </div>

      <div class="card">
        <div class="card__h"><h2>Change password</h2>
          <p>All your other sessions are signed out when you do.</p></div>
        <div class="card__b">
          <form id="pwForm" novalidate>
            <div class="note note--bad" data-form-err hidden></div>
            <div class="f">
              <label for="pw_cur">Current password <span class="req">*</span></label>
              <input id="pw_cur" name="current_password" type="password" autocomplete="current-password">
            </div>
            <div class="f">
              <label for="pw_new">New password <span class="req">*</span></label>
              <input id="pw_new" name="new_password" type="password" autocomplete="new-password">
              <p class="f__hint">At least ten characters, with a letter and a number.</p>
            </div>
            <div class="f">
              <label for="pw_rep">Repeat new password <span class="req">*</span></label>
              <input id="pw_rep" name="repeat" type="password" autocomplete="new-password">
            </div>
            <button class="btn btn--pri" type="submit">Change password</button>
          </form>
        </div>
      </div>
    </div>`;

  $('#pwForm', mount).addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const banner = $('[data-form-err]', form);
    banner.hidden = true;

    const next = $('#pw_new', form).value;
    if (next !== $('#pw_rep', form).value) {
      banner.textContent = 'The two new passwords do not match.';
      banner.hidden = false;
      $('#pw_rep', form).select();
      return;
    }

    await withBusy($('[type=submit]', form), async () => {
      try {
        const out = await api('/admin/account/password', {
          method: 'POST',
          body: { current_password: $('#pw_cur', form).value, new_password: next },
        });
        form.reset();
        toastOk(out.message);
      } catch (err) {
        banner.textContent = err.message;
        banner.hidden = false;
      }
    });
  });
}
