# Datum Dental — drafting-sheet template

A single-page site for an implant and reconstructive dentistry practice, built to look and behave
like a technical drawing sheet rather than a brochure. Graph-paper ground, drafting-blue ink, red
annotation marks, dimension lines with real arrowheads, callout bubbles on leader lines, and a
title block in the footer that carries the revision letter.

No build step, no dependencies. Open `index.html`.

---

## Why this design

Implant dentistry is the one part of the profession where the selling point genuinely is
measurement: the case is scanned, planned in software and placed through a printed guide. So the
page borrows the visual language of the discipline it is describing — engineering drawings — and
uses it consistently rather than decoratively.

Deliberate constraints:

- **Two inks and paper.** Drafting blue `#12356B` and annotation red `#D6482B` on a warm grey-green
  paper `#F1F2ED`, with white sheets laid over it. No gradients, no shadows, no glows.
- **Hairlines everywhere.** Every division is a 1px rule at 16% blue. Weight, not colour, carries
  the hierarchy — the same convention a drawing uses for object lines, thin lines and centre lines.
- **Square corners.** 2px radius at most. Nothing here should look soft.
- **Typography as annotation.** IBM Plex Sans Condensed for headlines, IBM Plex Sans for reading,
  IBM Plex Mono for anything that would be lettered on a drawing: sheet numbers, dimensions, item
  codes, quantities, references, the title block.

## Sheets (sections)

| Sheet | Section | What it does |
| --- | --- | --- |
| 01 | General arrangement | Headline, key figures, and Fig. 01 — a dimensioned section through a single fixture |
| 02 | Method | Scan → plan → guide → place, as one accumulating diagram |
| 03 | What we place | Exploded assembly with a component specification panel |
| — | Fig. 04 | One wide photograph of a surgery, greyscaled |
| 04 | Schedule of work | Rates as an itemised schedule with item codes |
| 05 | Estimate | Interactive bill of quantities |
| 06 | Clinicians | Four people, greyscale portraits, GDC numbers |
| 07 | Notes | Eight patient FAQs written as notes to the drawing |
| 08 | Request | Consultation request that issues a reference |
| — | Title block | Project, drawn, checked, scale, date, sheet, revision |

## The drawings

All figures are hand-authored inline SVG. Three parts are defined once in a `<defs>` library and
reused:

- `#p-crown` — a two-cusped molar crown in section, with a V fissure
- `#p-abut` — a tapered abutment
- `#p-fix` — a tapered fixture whose outline is a sawtooth, so it reads as a thread

Both figures that use them (`Fig. 01` assembled, `Fig. 03` exploded) reference the same paths, so a
change to a component propagates to both. `vector-effect="non-scaling-stroke"` keeps the line weight
identical at every scale, which is what makes the scaled-down copies still look drawn rather than
zoomed.

Drawing conventions that are actually observed:

- Bone and gum are section hatches at opposing 45° angles, drawn as SVG `<pattern>`s
- Components are filled with paper white so they visibly cut the hatch
- A red dash-dot centre line runs through the assembly axis
- Dimensions have extension lines, a dimension line, filled arrowheads and a boxed value
- The fixture diameter is a leader callout, not a dimension line, because the feature is too narrow
  to dimension between arrows — same decision a draughtsman would make
- Extension lines never cross the object they measure

## The three interactions

**Method stepper (Sheet 02).** Four layers on one diagram of the arch. Selecting a stage reveals
that layer and dims the earlier ones, so the plan visibly accumulates: scan outline, planned sites
with angles, printed guide shell, placed fixtures. It advances itself once when scrolled into view
(1.5s per stage) and stops the moment you touch it. Stage 04 is drawn in plan, consistent with the
earlier layers, rather than switching to a side view.

**Assembly explorer (Sheet 03).** Tabs — or a click on the part itself — select a component. The
selected part fills with a blue tint and the other two drop to 42% while a mono specification table
swaps in: material, fabrication, torque, warranty. Written so a patient can read the actual numbers
rather than "premium quality titanium".

**Bill of quantities (Sheet 05).** A fixture stepper (1–6), grafting, crown material and
anaesthesia. Line items appear, disappear and re-quantify against the controls, with a total under a
double rule and a three-stage payment figure. The estimate reference encodes the configuration —
`DTM/EST/3F-ZIR-SOC-IV` — which is the sort of thing a practice with a filing system would do.

**Request (Sheet 08).** Validates name, telephone and email, then replaces the form with an issued
panel: red stamp, reference number, and a summary table. Issuing also flips the footer title block's
revision from A to B, which is the small joke the whole frame exists for. "Amend and re-issue"
returns you to the form and the revision to A.

## Other behaviour

- **Sheet indicator.** The header shows the current sheet number and name, updated on scroll, with a
  red progress rule beneath it. Nav items highlight to match.
- **Live crosshair.** Pointing at Fig. 01 draws a red crosshair with a live coordinate readout in
  drawing units. Pointer-device only.
- **Line-drawing reveals.** Dimensions and leaders draw themselves via `stroke-dashoffset` on
  entry, then the arrowheads and values fade in. Text rises 10px. Nothing bounces.
- **Reduced motion.** `prefers-reduced-motion` removes the reveals, the line drawing and the
  stepper's auto-advance, and everything is present at once.
- **Accessibility.** Semantic landmarks, a skip link, keyboard-operable tabs with `aria-selected`,
  labelled form fields, `aria-label`s on every figure describing what is drawn, focus moved to the
  issued reference on submit, red focus rings.
- **Mobile.** The sticky side labels flatten into a header row, figures cap their width, and the
  tables drop their least useful column (Includes; Rate) so the money stays on screen rather than
  behind a horizontal scroll.
- **Print.** Chrome, the frame and the hero buttons are dropped; borders go black.

## Files

```
dental-template-datum/
├── index.html              markup, SVG part library, all figures
├── assets/
│   ├── css/styles.css      tokens, drawing primitives, 15 numbered sections
│   └── js/main.js          reveal, header, drawer, crosshair, stepper,
│                           assembly, bill of quantities, request
└── README.md
```

## Customising

- **Colours** — the tokens at the top of `styles.css`. `--blue` and `--red` are the only two inks;
  `--grid` controls the graph paper density and weight alongside the two
  `repeating-linear-gradient`s on `body`.
- **Grid pitch** — the `32px` in those two gradients.
- **Rates** — the `R` object in `estimate()` in `main.js`, and the static schedule table in
  `index.html`. Keep the two in step.
- **Component specs** — the `PARTS` object in `main.js`.
- **Sheet numbers** — `data-sheet` and `data-title` on each `.sect`; the header reads them directly,
  so adding a section needs nothing else.
- **Title block** — plain markup in the footer. `data-date` is filled at load; `data-rev` is driven
  by the request form.

## Notes

Every figure, name, price, GDC number and statistic is invented for demonstration. Photographs are
from Unsplash via their CDN and are hidden automatically if they fail to load. Forms do not submit
anywhere — wire the two `submit` handlers in `main.js` to your own endpoint.
