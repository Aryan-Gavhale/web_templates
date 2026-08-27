# Lumen Dental Atelier — dental template

A third dental template, built to sit apart from the other two rather than beside them.

| | Template | Direction |
| --- | --- | --- |
| 1 | `dental-template` | Warm editorial. Paper and spruce, soft serif, arch shapes, asymmetric grid |
| 2 | `dental-template-meridian` | Swiss and UI-driven. Cobalt and lemon on bone, grotesk, square corners, visible grid |
| 3 | `dental-template-lumen` | **Dark and centred. Warm near-black with brass hairlines, high-contrast serif, symmetry** |

Both earlier templates are light-dominant and left-aligned. This one is dark throughout and
composed on a centre axis, aimed at cosmetic and restorative practice rather than a group clinic.

No gradients, no glows, no drop shadows. Every division on the page is a one-pixel rule.

## Colour theme

| Token | Value | Used for |
| --- | --- | --- |
| `--night` | `#0F0D0C` | Page ground, a warm black rather than a neutral one |
| `--night-2` / `--night-3` | `#15120F` / `#1C1815` | Alternating bands and the ghosted footer wordmark |
| `--ivory` | `#F2EDE4` | Body text, held at 66% and 40% opacity for secondary tiers |
| `--brass` | `#C2A06B` | The only accent — eyebrows, rules, italics, selected states |
| `--hair` | `rgba(242,237,228,0.14)` | Hairlines, which carry all the structure |

## Type

- **Cormorant Garamond** — display, 300 weight, italic used for the accented word in each heading
- **Jost** — body copy at 300, and all small caps labels at 0.18–0.28em tracking

There is no monospace here, deliberately: template 2 uses mono for metadata, so this one uses
letterspaced small caps for the same job.

## Structure

1. **Header** — nav split left and right around a centred wordmark, condensing on scroll
2. **Hero** — centred headline that assembles character by character, a letterboxed frame, and a slowly rotating brass ring badge
3. **Manifesto** — a centred position statement over three hairline-divided tenets
4. **Treatments** — a sticky image column that crossfades as you read down five entries; the entry you are on is at full opacity and the rest recede
5. **The visit** — vertical timeline whose brass hairline grows with scroll position
6. **The rooms** — four-image gallery with captions that slide up on hover
7. **Clinicians** — a centred pair, portraits desaturated until hover
8. **Voices** — one large serif quote at a time, with circular arrows and a counter
9. **Investment** — expandable fee rows, one open at a time
10. **Appointment** — a three-step wizard (what, when, who) with a brass progress rule, an accumulating summary, validation and a confirmation state
11. **Questions** — a plain two-column definition list, no accordion
12. **Footer** — an oversized ghosted wordmark over four hairline columns

## Motion

- **Character assembly** — headings split per character with a 16ms stagger; characters are grouped into word wrappers so a line never breaks mid-word
- **Rise** — everything else fades up with a barely-there scale, on a long ease
- **Ring** — 30-second linear rotation on an SVG `textPath`
- **Sticky crossfade** — the treatment image tracks whichever entry is nearest a line one third down the viewport
- **Timeline** — hairline height driven by a `--p` custom property from scroll position
- **Counters** — quartic ease-out, fired once on entry

`prefers-reduced-motion` disables the character stagger, the rise, the ring rotation and the
counters, and shows the timeline hairline and all treatment entries at full strength.

## Accessibility

- Split headings carry an `aria-label` of the full sentence and mark the character spans `aria-hidden`, so nothing is read letter by letter
- The wizard is a real `form` of `fieldset`/`legend` groups; errors are announced through an `aria-live` region
- Fee rows and the quote counter expose `aria-expanded` and `aria-live` respectively
- Photographic contrast is handled with filters and a flat tint, not opacity on text

## Files

```
dental-template-lumen/
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

No build step and no dependencies. Open `index.html`, or serve the folder:

```bash
python -m http.server 8767
```

## Customising

- **Colour** — all colour is tokenised in `:root`. Replacing `--brass` re-themes the page; lightening `--night` towards `#F7F4EE` and swapping the ivory tiers inverts it cleanly, because nothing relies on a dark ground for contrast.
- **Photography** — clinical stock is bright and cool, which fights this palette. `--pic` and `--tint` normalise it in one place; adjust those two rather than per-image filters.
- **Treatments** — add an `<li class="entry">` and a matching `<img class="stack__i">` in the same order. The `data-cap` attribute supplies the caption under the sticky image; the JS pairs them by index.
- **Wizard** — options carry a `data-phrase` sentence form so prose reads correctly ("on a Saturday" rather than a lowercased day name).
