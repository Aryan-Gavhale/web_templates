# CALIBRE — Skin Laboratory

A dermatology webpage template built on a single idea: **the clinic publishes its
numbers**. Where a typical aesthetic-clinic site sells reassurance, this one sells
measurement — so the whole interface is styled as a piece of laboratory
instrumentation rather than a brochure.

This is the second of two dermatology templates in this workspace and it was
designed to share nothing with the first (`derma-template-sera`, a light
porcelain-and-serif editorial theme). Different palette, different typography,
different navigation model, different section grammar, different motion language.

```
derma-template-calibre/
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  └─ js/main.js
└─ README.md
```

Open `index.html` through any static server (`python -m http.server`). There is no
build step, no framework and no dependency beyond two Google Fonts.

---

## The design brief

**Positioning.** A device-led dermatology practice in Zürich: diagnostic imaging,
laser and surgical work, one consultant, nine patients a day. Copy is written in
that voice throughout — declarative, specific, occasionally blunt. Prices,
wavelengths, contraindications and failure rates are all on the page, because a
practice that hides them would not be selling measurement.

**Ground.** Near-black (`#0A0B0C`) with panels one step up (`#111315`). Nothing
glows, nothing has a gradient, nothing has a drop shadow. Depth comes from
hairlines at three weights and from flat panel fills.

**Accent.** A single cold mint (`#7EE3CF`) used only where an instrument would use
it: active state, a measured value, a crosshair, a filled bar, the selected slot.
One warm flag (`#E2714A`) appears exactly once — on the case whose result is
"arrested, no change" — so the exception is legible as an exception.

**Type.** `Archivo` variable, driven on its width axis: 96 for tabular numbers,
102–108 for headings, 112 for the hero, 118 for the footer wordmark. Metadata,
labels, specifications and fine print are all `IBM Plex Mono` in small uppercase
with wide tracking. The result is a page where prose and data are visibly
different classes of information.

**Shape.** Zero border radius, anywhere. Every corner in the template is square,
including inputs, buttons and the select. It is the single most effective way to
read as an instrument rather than a consumer app.

---

## Structure

A **fixed left rail** replaces the conventional top bar on desktop (≥1100px). It
carries the wordmark set vertically, seven section numbers, a scroll-progress
tick and a live Zürich clock. Section labels fly out horizontally on hover, so the
rail stays 96px wide. Below 1100px the rail is swapped for a slim bar and a
full-screen sheet menu.

A **fixed four-line column grid** sits behind all content, so full-bleed sections
still read as measured against something.

Sections are numbered `§01`–`§07` and share one header component: mono section
number, a two-line statement, and a mono note in the second column.

| § | Section | What it does |
|---|---------|--------------|
| 01 | Assessment | Six-index baseline readout with animated bar meters, plus imaging/histology/threshold cards |
| 02 | Register | Expandable treatment matrix — ref, modality, sessions, downtime, fee; opens to parameters, contraindications and what the fee covers |
| 03 | Protocol | Horizontally scrolling, drag-to-move timeline of the four visits |
| 04 | Evidence | Four consented cases reported as a delta on a named index |
| 05 | Bench | Practitioner portrait, credential register, five-instrument specification strip |
| 06 | Questions | Numbered question register (accordion) |
| 07 | Admission | Slot grid + request form with in-place confirmation |

---

## Motion

Everything is short, linear and mechanical. Nothing bounces.

- **Calibration boot.** A sweep line crosses the viewport while a monospace
  counter climbs 000 → 100 through four named stages. The page opens when it
  completes.
- **Headline wipe.** The three hero lines reveal by `clip-path` wipe from the
  left, staggered 90ms — a scan, not a fade.
- **Annotation build.** Corner brackets, two ROI crosshairs, the axis hairlines,
  the exposure tags and the bottom tick ruler arrive in sequence over the hero
  specimen.
- **Reticle.** Over any `[data-scan]` region the cursor becomes a crosshair and a
  square reticle tracks it; the hero caption prints live normalised coordinates.
- **Scramble.** Section numbers scramble through a small glyph pool for seven
  frames on entry, then settle.
- **Meters and counters.** Bars fill to their stated percentage with a staggered
  delay while the value counts up in tabular mono.
- **Case scan.** Hovering a case tile runs a hairline down the image and lifts it
  from monochrome to colour.

---

## Accessibility

- `prefers-reduced-motion: reduce` disables the boot animation, all wipes, the
  scramble and the counters, and paints meters at their final width immediately.
- The page is fully readable with JavaScript disabled — the `js` class on `<html>`
  is what arms every entry animation, so without it nothing is hidden.
- Accordions and matrix rows are real `<button>` elements with `aria-expanded`.
  The slot grid and priority selector are radio inputs. The menu closes on Escape.
- Focus is visible everywhere (1px mint outline, 3px offset).
- Section tracking sets `aria-current` on the rail.
- Verified at 390px, 430px, 820px, 1512px and 2074px with no horizontal overflow
  outside the intentionally scrollable timeline.

---

## Placeholder content — read before shipping

Everything factual on this page is invented for the template and must be replaced.

- **Imagery** is hot-linked from Unsplash for demonstration only, presented as
  clinical "captures". These are stock portraits, not patients, and not
  before/after evidence. Host your own consented images and do not imply
  otherwise.
- **Clinical content** — wavelengths, fluences, session counts, cumulative
  isotretinoin doses, contraindications, margins — reads plausibly but is
  illustrative. It must be reviewed and rewritten by the responsible clinician.
- **Case results, indices and deltas** are fabricated. Real outcome claims are
  regulated advertising in most jurisdictions and need consent, documentation and
  usually a disclaimer.
- **Practitioner, registration numbers, GLN/FMH IDs, address, fees and insurance
  statements** are fictional.
- **The form does not submit.** It validates client-side and renders a
  confirmation panel locally. Wire it to a real endpoint with server-side
  validation, and route anything marked urgent to a channel a human actually
  watches — the page promises a 48-hour lesion pathway.
- **Availability windows** are hard-coded for "week 36". Drive them from a real
  calendar or remove the grid.
