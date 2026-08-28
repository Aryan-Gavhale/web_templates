/* =============================================================================
   Staff accounts — owner only.

   Passwords are set through their own endpoint rather than as a field on the
   general edit form, so a stray empty input can never blank a credential.
   ========================================================================== */

import {
  $, esc, api, session, fmtWhen, titleCase, on, toastOk, reportError,
  withBusy, confirmModal, modal, or,
} from './core.js';
import { listScreen, table, twoLine } from './list.js';
import { createRow, editRow } from './forms.js';

const ROLES = [
  ['owner', 'Owner', 'Everything, including staff accounts and password resets.'],
  ['manager', 'Manager', 'All content, all money, settings. Cannot manage accounts.'],
  /* "No content" would be wrong: staff can open the website screens, they just
     cannot save on them. Saying otherwise sends people hunting for a menu that
     is in front of them. */
  ['staff', 'Staff', 'Enquiries, patients and receipts. Can view website content and settings but not change them.'],
];

export async function render({ mount, setHead }) {
  setHead('Staff accounts', 'Who can sign in, and what each of them may change.');

  let rows = [];

  const screen = listScreen({
    mount,
    search: 'Name or email…',
    actions: '<button class="btn btn--sm btn--pri" data-new>New account</button>',
    fetchPage: async (state) => {
      const data = await api('/admin/users', { query: { ...state, limit: 100 } });
      rows = data.items;
      return {
        meta: `${data.total} account${data.total === 1 ? '' : 's'}`,
        html: `
          <div class="bar" style="border-radius:0;background:var(--white)">
            <span style="font-size:.78rem;color:var(--mute)">
              ${ROLES.map(([, label, hint]) => `<strong>${label}</strong> — ${hint}`).join('&nbsp; · &nbsp;')}
            </span>
          </div>
          ${table({
            columns: [
              { key: 'name', label: 'Person', cell: (u) => twoLine(esc(u.name), esc(u.email)) },
              { key: 'role', label: 'Role', cell: (u) => `<span class="chip chip--${
                u.role === 'owner' ? 'teal' : (u.role === 'manager' ? 'info' : '')
              }">${esc(titleCase(u.role))}</span>` },
              { key: 'active', label: '', cell: (u) => (u.is_active
                ? '<span class="chip chip--ok">Active</span>'
                : '<span class="chip chip--bad">Suspended</span>') },
              { key: 'seen', label: 'Last signed in', align: 'right',
                cell: (u) => (u.last_login_at ? esc(fmtWhen(u.last_login_at))
                  : '<span style="color:var(--faint)">Never</span>') },
              { key: 'act', label: '', cls: 't__act', cell: (u) => `
                <div class="row row--end" style="gap:.3rem;flex-wrap:nowrap">
                  <button class="btn btn--sm" data-act="edit">Edit</button>
                  <button class="btn btn--sm" data-act="pw">Reset password</button>
                  ${u.id === session.user.id ? ''
                    : `<button class="btn btn--sm btn--bad" data-act="del">Delete</button>`}
                </div>` },
            ],
            rows,
            emptyTitle: 'No accounts',
          })}`,
      };
    },
  });

  const find = (btn) => rows.find((u) => u.id === Number(btn.closest('tr').dataset.id));

  const fields = (existing) => [
    { name: 'name', label: 'Full name', type: 'text', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true,
      hint: 'This is the sign-in name.' },
    { name: 'role', label: 'Role', type: 'select', required: true, value: 'staff',
      options: ROLES.map(([value, label]) => ({ value, label })) },
    ...(existing ? [] : [{ name: 'password', label: 'Initial password', type: 'text', required: true,
      hint: 'At least ten characters with a letter and a number. Tell them to change it after signing in.' }]),
    { name: 'is_active', label: 'This account may sign in', type: 'checkbox',
      value: existing ? existing.is_active : true,
      hint: 'Suspending is preferable to deleting — it keeps the audit trail intact.' },
  ];

  on(mount, 'click', '[data-new]', () => createRow({
    resource: 'users', title: 'New staff account', fields: fields(null), onDone: screen.refresh,
    intro: `<div class="note">Give each person their own account. A shared login makes the
      activity log worthless.</div>`,
  }));

  on(screen.card, 'click', '[data-act=edit]', (_e, btn) => {
    const u = find(btn);
    if (!u) return;
    return editRow({
      resource: 'users', id: u.id, title: `Edit ${u.name}`, fields: fields(u), data: u,
      onDone: screen.refresh,
      intro: u.id === session.user.id
        ? '<div class="note note--warn">This is your own account. Removing your owner role or suspending it will lock you out.</div>'
        : '',
    });
  });

  on(screen.card, 'click', '[data-act=pw]', async (_e, btn) => {
    const u = find(btn);
    if (!u) return;
    await resetPassword(u);
  });

  on(screen.card, 'click', '[data-act=del]', async (_e, btn) => {
    const u = find(btn);
    if (!u) return;
    const go = await confirmModal({
      title: `Delete ${u.name}?`,
      danger: true,
      confirmLabel: 'Delete account',
      message: `<strong>${esc(u.email)}</strong> will no longer be able to sign in and the
        account row is removed. Suspending it instead keeps their name attached to
        everything they did.`,
    });
    if (!go) return;
    try {
      await api(`/admin/users/${u.id}`, { method: 'DELETE' });
      toastOk('Account deleted.');
      await screen.refresh();
    } catch (err) { reportError(err); }
  });
}

async function resetPassword(u) {
  await modal({
    title: `Reset password for ${u.name}`,
    body: `
      <form id="rpw" novalidate>
        <div class="note note--bad" data-form-err hidden></div>
        <div class="note" style="margin-bottom:1rem">Every session belonging to
          <strong>${esc(u.email)}</strong> is signed out when the password changes.</div>
        <div class="f">
          <label for="rp_new">New password <span class="req">*</span></label>
          <input id="rp_new" type="text" autocomplete="off" spellcheck="false">
          <p class="f__hint">At least ten characters with a letter and a number.
            Shown in plain text so you can read it out.</p>
        </div>
      </form>`,
    footer: `<button class="btn" data-no>Cancel</button>
             <button class="btn btn--pri" data-yes>Reset password</button>`,
    onMount({ close, body, foot }) {
      const banner = $('[data-form-err]', body);
      foot.querySelector('[data-no]').onclick = () => close(false);
      foot.querySelector('[data-yes]').onclick = (ev) => withBusy(ev.currentTarget, async () => {
        banner.hidden = true;
        try {
          const out = await api(`/admin/account/users/${u.id}/password`, {
            method: 'POST',
            body: { new_password: $('#rp_new', body).value },
          });
          toastOk(out.message);
          close(true);
        } catch (err) {
          banner.textContent = err.message;
          banner.hidden = false;
        }
      });
    },
  });
}
