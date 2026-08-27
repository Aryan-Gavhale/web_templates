# web_templates

Twenty-three hand-built, single-page website templates across three verticals —
dental practices, dermatology clinics, and interior design studios.

Every template is static **HTML, CSS and vanilla JavaScript**. No build step, no
framework, no package manager, no runtime dependencies beyond a Google Fonts
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

Forms are intercepted and answered entirely in the browser — they post nowhere.
Wire them to a real endpoint before they take a single detail from anybody, and
where the data is health data, treat it accordingly.

Photographs, where used, are stock images from Unsplash standing in for real
premises and real people.
