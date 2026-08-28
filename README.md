# web_templates

Twenty-three hand-built, single-page website templates across three verticals —
dental practices, dermatology clinics, and interior design studios — plus one of
them taken all the way to a working application with a database and an admin
panel behind it (`dental-clinic-cms`, described at the bottom).

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

## Dental — 10 templates

| Folder | Name | Direction |
| --- | --- | --- |
| `dental-template` | Aurelia Dental Institute | Warm editorial. Paper and spruce, Fraunces serif, arch shapes, hard offset blocks |
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

## dental-clinic-cms — the one that is a real application

Everything above is a front end. This one is the same design thinking wired to a
database: a dentist site where no heading, paragraph, image, treatment,
clinician, clinic, FAQ, colour or menu item is hard-coded — each is a row in
SQLite that the practice owner edits from an admin panel.

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

Unlike the templates, **its forms really do store what they are given.** The
seeded practice is fictional and the seeded imagery is remote Unsplash URLs, so
replace both before it goes anywhere real.

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
from anybody, and where the data is health data, treat it accordingly. In
`dental-clinic-cms` they do post, to your own SQLite file, which is the same
obligation with the storage already built.

Photographs, where used, are stock images from Unsplash standing in for real
premises and real people.
