# Studio Aarohi

A website for an interior design practice, with an owner's admin console behind it.

Everything the visitor sees is stored in a database and edited through the admin —
the headings, the paragraphs, the photographs, the services, the projects, the
numbers. Nothing is hardcoded in a template. Reviews come from the studio's real
Google Business Profile. Enquiries from the site land in a pipeline, and the money
side — clients, instalment plans, payments, receipts, reminders — lives in the same
place.

---

## Running it

You need Python 3.10 or newer.

```bash
cd studio-aarohi
pip install -r requirements.txt
python app.py
```

| | |
|---|---|
| Website | http://127.0.0.1:8910/ |
| Admin console | http://127.0.0.1:8910/admin |
| Sign in | `owner@aarohi.design` / `aarohi2026` |

On the very first run the database is created and filled with demo content — six
projects, five services, reviews, nine enquiries and five payment plans in various
states of being paid. That is there so every screen has something in it. Delete
`data/app.db` and restart to get a clean copy of the same demo.

**Change that password** under Settings → Your account before this goes anywhere
near the internet.

### Options

| Environment variable | What it does |
|---|---|
| `PORT` | Port to serve on. Default `8910`. |
| `DEBUG=1` | Turns on the reloader and tracebacks. Off by default. |
| `SECRET_KEY` | Session signing key. If unset, a random one is generated once and kept in `data/.secret`. |
| `STUDIO_DB` | Path to the SQLite file. Used by the tests to work on a throwaway copy. |

---

## What is in here

```
app.py                  Flask app, config, filters
core/
  db.py                 SQLite connection and the whole schema
  settings.py           Typed key/value settings with defaults
  auth.py               Sign-in, password hashing, @login_required
  content.py            Read helpers shared by the site and the admin
  ops.py                Business queries — pipeline, collections, health checks
  money.py              Instalment maths, due dates, Indian currency formatting
  uploads.py            Image intake, resizing, thumbnails
  google_reviews.py     Google Places client, sync and caching
  activity.py           Audit trail
  seed.py               Demo content
routes/
  public.py             The website
  admin.py              Admin pages (render only)
  api.py                The JSON API the admin talks to (everything that writes)
templates/public/       The theme
templates/admin/        The console
static/public/          Theme CSS and JS
static/admin/           Console CSS and JS
data/                   app.db, uploads/, .secret  — created on first run
```

The split between `routes/admin.py` and `routes/api.py` is deliberate: admin pages
only ever read and render, and every write goes through the JSON API. That means
there is one place to look when something changes in the database, and one place
where validation and the audit log live.

---

## The website

One long homepage, plus a page per project and a page per service.

Sections appear in the order set in the admin, and any of them can be switched off
without losing what was written in it. The animation is all CSS and a little
`IntersectionObserver` — headings reveal line by line, images wipe in behind a
clip path, figures count up, the header contracts on scroll. Everything respects
`prefers-reduced-motion`.

Enquiries submit over `fetch` and stay on the page.

---

## The admin console

### Website

**Page sections** — the blocks of the homepage. Each one has an eyebrow, a heading,
a paragraph, up to two links and a photograph. Expand a block, edit it, save.

**Services** — what the studio sells. Each gets a card on the homepage, its own page,
and an entry in the enquiry form's dropdown. Reorder with the arrows.

**Projects** — the portfolio. Each project has a cover, a gallery with captions, the
facts (category, location, year, area) and a write-up. A project can be hidden
while it is being written, and featured to push it to the front of the grid.

**Process & figures** — the numbered "how we work" steps, and the statistics that
count up on scroll.

**Media library** — every photograph, in one place. Drag files anywhere onto the page
to upload. Anything you drop is re-encoded to a sensible web size with a thumbnail,
so a 12 MP photo straight off a phone is fine. Alt text is editable and the console
nags you on the dashboard when images do not have it.

**Reviews** — see below.

### Business

**Enquiries** — a pipeline: New → Contacted → Qualified → Quoted → Won or Lost.
Pick a row and the whole enquiry opens beside it: what they asked for, their budget
and timeline, your notes, and one-tap Call / WhatsApp / Email that pre-fills your
reply template and marks them contacted. High priority ones sort to the top.
Anything open and untouched for three days is flagged on the dashboard, because
that is how work actually gets lost. Won enquiries convert to a client in one click,
and offer to start a payment plan straight away. Export the lot as CSV.

**Payments & EMI** — clients, plans, instalments.

Create a plan from the project value, a discount, the advance, the number of months
and an interest basis (none, flat, or reducing balance). The schedule previews live
as you type and is written when you save. Rounding never loses a rupee: any drift
is absorbed into the last instalment so the schedule sums exactly to the payable.

Record a payment in full or in part, with the method and reference. Overdue is
worked out from the due date every time it is read, never stored, so it cannot go
stale. A plan closes itself when the last rupee lands. Print a receipt for any paid
instalment or a full statement of account for the plan. When terms change mid-project,
"reschedule the unpaid part" rebuilds only the instalments that have not been paid
and leaves the history alone.

The dashboard and the payments page both lead with what is late and who to chase,
with the reminder message already written.

**Clients** — the address book behind the plans.

### Studio

**Settings** — studio identity, contact details, social links, the Google connection,
the enquiry form's dropdown options, your two message templates, and the three
colours that drive the whole public theme.

**Activity** — an audit line for every change, payment and sync.

---

## Connecting Google reviews

Without this the site still works; it just shows only the reviews typed in by hand.

1. Go to the [Google Cloud console](https://console.cloud.google.com/), create a
   project, and enable **Places API (New)**. Billing has to be enabled on the
   project even though this stays comfortably inside the free tier.
2. Create an API key. Restrict it to the Places API — and, if you deploy this
   somewhere public, to your server's IP.
3. In the admin, go to **Settings → Google reviews**, paste the key, then use
   **Find** to search for the studio by name and city. Pick it from the results and
   the Place ID fills itself in.
4. Save, then **Test the connection**, then **Pull reviews now**.

After that reviews refresh on their own. A public page view triggers a refresh if
the cache is older than the window you set (12 hours by default), and it fails
quietly — a Google outage can never take the website down with it. `Reviews` in the
admin shows what came back, and you decide which ones appear.

Two things worth knowing. Google's API returns the five reviews it considers most
relevant, not all of them; that is a limit of the API. And the minimum rating filter
only controls what gets shown on your site — it does not hide anything on Google.

The API key is stored in the database, never echoed back to the browser in full, and
never sent to the public template.

---

## Notes on how it is built

**No build step.** No bundler, no framework, no `node_modules`. Plain CSS and one
JavaScript file per side. Edit a file, refresh the page.

**SQLite, no ORM.** One file at `data/app.db`. Backing the site up means copying it,
along with `data/uploads/`.

**Money is integer rupees**, formatted with lakh/crore grouping. `core/money.py` is
the only place that does the arithmetic, and it is the only place that needs a test
when the rules change.

**Passwords** are hashed with Werkzeug's PBKDF2. Sessions are signed, HTTP-only and
`SameSite=Lax`.

**Uploads** are validated by extension, size and by actually decoding them with
Pillow, then re-encoded. Files are written under `data/uploads/YYYY/MM/` with a
random suffix, so an uploaded filename can never collide with or overwrite another.

### Testing

Two scripts, both safe to run:

```bash
python _smoke.py       # every page renders, signed in
python _api_smoke.py   # every write endpoint, against a temp copy of the database
```

`_api_smoke.py` copies the database to your temp directory first and refuses to run
if that copy did not take effect, so it cannot touch real data.

---

## Putting it online

`python app.py` runs Flask's development server, which is fine for one person on a
laptop and not fine on the internet. For a real deployment:

- Serve through a WSGI server — `gunicorn -w 2 'app:app'` behind nginx or Caddy.
- Set `SECRET_KEY` from the environment.
- Terminate TLS at the proxy and set `SESSION_COOKIE_SECURE=True`.
- Let the proxy serve `/static` and `/uploads` directly.
- Back up `data/app.db` and `data/uploads/` on a schedule. That is the entire site.
