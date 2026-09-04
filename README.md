# web_templates

Twenty-four hand-built, single-page website templates across three verticals —
dental practices, dermatology clinics, and interior design studios — plus three
of them taken all the way to working applications, each with a database and an
admin panel behind it (described at the bottom).

Every **template** is static **HTML, CSS and vanilla JavaScript**. No build step,
no framework, no package manager, no runtime dependencies beyond a Google Fonts
link. Each folder holds four files:

```
<template>/
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

## Running one

Open the `index.html` directly, or serve the folder:

```bash
cd derma-template-umbra
python -m http.server 8000
```

Each template's own `README.md` carries its full design brief — palette tokens,
typography, interaction notes, accessibility notes, and a list of what in it is
placeholder.

---

## Building a hundred of them — `dental-site-builder/`

Three of the dental templates (`dental-template-arogya`, `-enamel`, and
`dental-template`) are wired for bulk personalisation. Each keeps its content in
`assets/js/site-config.js` and reads a per-client overlay from
`assets/js/client.js`, which means one spreadsheet row becomes one finished site.

```bash
cd dental-site-builder
python fetch.py "<google maps url>"   # fills a row from their Google listing
python build.py build                 # one folder per row, into dist/
```

`fetch.py` drives a headless browser over a Google Maps place page and pulls out
the name, address, phone, opening hours, star rating and photos. `build.py`
copies the chosen template and writes the small overlay — no AI, no API calls, so
a hundred sites cost the same as one.

Blank cells keep the template's own content, so a half-filled row still renders a
complete page. Two things are switched off rather than defaulted, because Google
cannot tell us them and guessing would put words in a real clinic's mouth: the
clinician list and the review quotes. The star rating and review count are
scraped and genuine, so those stay.

Full documentation is in [`dental-site-builder/README.md`](dental-site-builder/README.md).

---

## Dental — 11 templates

| Folder | Name | Direction |
| --- | --- | --- |
| `dental-template` | Aurelia Dental Institute | Warm editorial. Paper and spruce, Fraunces serif, arch shapes, hard offset blocks |
| `dental-template-arogya` | Arogya Dental | Indian clinic, phone first. Reads like an app on a handset — bottom action bar, swipe rails, live open/closed pill, ₹ price list with filter chips. Lenis smooth scroll |
| `dental-template-ashbourne` | Ashbourne & Wade | Heritage practice. Oat and oxblood, arched frames, an interactive tooth chart |
| `dental-template-datum` | Datum Dental | A technical drawing sheet. Graph paper, drafting blue, dimension lines, title block |
| `dental-template-enamel` | ENAMEL | Loud studio. Bone and safety orange, 2px borders, a four-question smile check |
| `dental-template-junction` | Junction Dental | The practice drawn as a transit network — routes, interchange, departure board, fares |
| `dental-template-lumen` | Lumen Dental Atelier | Dark and centred. Near-black with brass hairlines, high-contrast serif, symmetry |
| `dental-template-meridian` | Meridian Dental Group | Swiss and UI-driven. Cobalt and lemon on bone, grotesk, a visible grid |
| `dental-template-muskaan` | Muskaan Dental Hospital | Indian multi-centre chain. Brand-led, rupees, EMI and NABH, Hindi toggle |
| `dental-template-northlight` | Northlight Dental Hospital | Photography-led. Ten photographs carry the page and the type stays quiet |
| `dental-template-wobble` | Wobble | Children's dentistry. Illustration-led, flat colour blocks joined by wave dividers |

## Dermatology — 6 templates

| Folder | Name | Direction |
| --- | --- | --- |
| `derma-template-sera` | SÉRA | Light porcelain and editorial serif. Consultant-led practice |
| `derma-template-calibre` | CALIBRE | Near-black, instrument-grade. The clinic publishes its numbers |
| `derma-template-paloma` | PALOMA | One saturated flat colour at a time, changing as you scroll. Architectural |
| `derma-template-verso` | VERSO | A broadsheet newspaper. Newsprint, Didone masthead, justified columns, a real tear-out |
| `derma-template-strata` | STRATA | A depth atlas of the skin, surface downward. Not one photograph — every drawing is CSS |
| `derma-template-umbra` | UMBRA | Warm dark. Organised as the ten questions patients actually ask, short answer first |

## Interiors — 7 templates

| Folder | Name | Direction |
| --- | --- | --- |
| `interior-template-arche` | ARCHÉ | Motion-led warm editorial minimalism. Interior architecture practice |
| `interior-template-datum` | DATUM | A drafting sheet. Chalk graph paper, cobalt drawing lines, crop marks, title block |
| `interior-template-kiln` | KILN | Colour-blocked poster typography. Bone and terracotta, no rounded corners anywhere |
| `interior-template-olea` | OLEA | Soft and biophilic. Cream, pine green and honey; arches and pills |
| `interior-template-umbra` | UMBRA | Dark Swiss-grid brutalist-luxe. Spatial design studio |
| `interior-template-vesper` | VESPER | Hospitality interiors. Oxblood, oat and brass; Bodoni; everything on a centre line |
| `interior-template-vitrine` | VITRINE | Retail, flagship and exhibition interiors. A fictional Antwerp practice |

---

## The three that are real applications

Everything above is a front end. These three are the same design thinking wired
to a database: no heading, paragraph, image, service, price or section order is
hard-coded — each is a row in SQLite that the owner edits from an admin panel.
All three pull their reviews live from Google, and all three carry the same
three pieces of back-office work a small practice actually repeats every week:
**enquiries, EMI instalments, and website content.**

| Folder | Vertical | Stack | Runs on |
| --- | --- | --- | --- |
| `dental-clinic-cms` | Dental | Flask 3, stdlib `sqlite3`, Jinja | `127.0.0.1:8120` |
| `derma-clinic-twacha` | Dermatology | Node 22, `node:sqlite`, no framework | `localhost:5173` |
| `studio-aarohi` | Interiors | Flask 3, stdlib `sqlite3`, Jinja | `127.0.0.1:8910` |

Each has its own `README.md` with full setup, the Google API steps, the data
model and the demo sign-in. Short version below.

### dental-clinic-cms — Flask, section-composable pages

A dentist site where treatments, clinicians, clinics, FAQs, colours and menu
items are all rows the practice owner edits.

**Flask 3, stdlib `sqlite3`, Jinja, hand-written CSS, one deferred script per
surface.** Still no build step and no JS framework; three pip packages.

```bash
cd dental-clinic-cms
pip install -r requirements.txt
python app.py reset      # create the database, load the demo practice
python app.py            # http://127.0.0.1:8120
```

Pages are built from typed, reorderable sections (fifteen types, each with its
own admin form and public partial). The panel also carries a media library with
generated WebP variants, live Google reviews through the Places API with curated
quotes as the fallback, enquiries as a small CRM with a timeline and CSV export,
and EMI as a working ledger — plans, applications, generated instalment
schedules, recorded payments and printable receipts. Roles, CSRF, login
throttling and an audit trail of every change are in place.

Its own `README.md` covers setup, the Google Places key steps and their billing
caveat, the data model, backup and restore, and the two verification scripts
(`check_routes.py` and `check_browser.py`).

### derma-clinic-twacha — Node, role-aware clinic back office

A skin clinic site whose admin panel the clinic runs on day to day: content,
booking enquiries, patient records, EMI plans and the receipts against them.

The database driver is `node:sqlite`, which ships with Node itself, so there is
nothing to compile and no native module to break on a new machine. The front end
has no build step either — the browser loads the files as they sit on disk.

```bash
cd derma-clinic-twacha
npm install
npm run seed     # creates data/app.db and fills it with demo content
npm start        # http://localhost:5173
```

It is the only one of the three with **roles**: owner, manager and staff, with
the differences enforced on the server rather than merely hinted at in the UI —
a staff member can record a receipt but cannot void one, and only an owner can
touch staff accounts. The seed creates one account per role; the passwords are
in its README and are meant to be changed immediately.

### studio-aarohi — Flask, an animated site driven entirely by its database

An interior design studio, built so the animation-heavy public page survives
being fully editable. Headings unmask line by line, images wipe in behind a
clip-path, figures count up on scroll, and the work grid retiles itself so the
last row never leaves a hole — all of it rendered from rows the owner controls.

```bash
cd studio-aarohi
pip install -r requirements.txt
python app.py            # http://127.0.0.1:8910, admin at /admin
```

Google reviews come through the Places API (New) v1 with a fallback to the
legacy endpoint, and the owner searches for their business by name rather than
hunting for a place ID. Google reviews and hand-written testimonials share one
table, so a review can be hidden, featured or reordered without touching Google.
Payments cover flat and reducing-balance interest with a live schedule preview
before you commit, part-payments, receipts, reminders and CSV export, with
amounts formatted in lakh and crore. Two test scripts ship with it: `_smoke.py`
for pages and `_api_smoke.py` for every mutating endpoint against a throwaway
database.

### What applies to all three

Unlike the templates, **their forms really do store what they are given.** Every
seeded practice is fictional and the seeded imagery is remote Unsplash URLs, so
replace both before any of them goes anywhere real. Each keeps its database,
uploads and session key out of version control, so a fresh clone seeds its own.

---

## Shared conventions

Templates within a vertical are deliberately built to share nothing — different
palettes, typefaces, layout logic, navigation models and motion vocabulary — so
they read as separate design systems rather than reskins of one another.

What they do have in common:

- **No gradients, no glows, no blurred drop shadows.** Depth comes from flat
  tones, hairline rules and hard offset blocks.
- **Semantic HTML**, real headings, real labels, `aria-expanded` on disclosures,
  and visible focus states.
- **`prefers-reduced-motion: reduce`** honoured throughout.
- **Progressive enhancement.** Nothing essential is hidden behind JavaScript;
  with it off, disclosures sit open and forms submit as ordinary forms.
- **A print stylesheet** where printing the page is a plausible thing to want.
- Responsive from roughly 320px up, with no horizontal overflow at any width.

## Everything in here is placeholder

These are design templates, not live sites. Across all of them the practice
names, practitioners, registration and council numbers, addresses, telephone
numbers, opening hours, fees and insurer arrangements are **invented**, and any
clinical or technical figures are illustrative and need review and sign-off by
the professional whose name goes on the site.

In the templates, forms are intercepted and answered entirely in the browser —
they post nowhere. Wire them to a real endpoint before they take a single detail
from anybody, and where the data is health data, treat it accordingly. In the
three applications they do post, to your own SQLite file, which is the same
obligation with the storage already built.

Photographs, where used, are stock images from Unsplash standing in for real
premises and real people.
