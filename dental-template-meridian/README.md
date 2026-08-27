# Meridian Dental Group — dental template

A second, deliberately different dental template. Where the first one is warm and editorial
(paper, spruce, serif display type, arch shapes), this one is Swiss and UI-driven: a visible
grid, square corners, bold grotesk type, monospace labels and hard colour blocking.

No gradients, no glows, no drop shadows anywhere in the stylesheet.

## Colour theme

| Token | Value | Used for |
| --- | --- | --- |
| `--ink` | `#0A0F1C` | Dark bands, footer, primary buttons |
| `--cobalt` | `#2340F0` | Primary accent, the pathway band, links, tab markers |
| `--lemon` | `#E4F062` | Sparing highlight — selections, progress line, dark-band labels |
| `--bone` | `#F4F4F0` | Alternating section background |
| `--peri` | `#E2E6FF` | Table row hover, avatar squares |
| `--line` | `#DEDED7` | The 1px rules that carry the whole grid |

Sections alternate white → cobalt → white → bone → ink so the page reads as stacked colour
blocks rather than one continuous surface.

## Type

- **Space Grotesk** — display, 600 weight, `-0.035em` tracking
- **DM Sans** — body copy
- **JetBrains Mono** — eyebrows, numbers, metadata, table figures

## Structure

1. **Header** — cobalt utility strip that collapses to zero height on scroll, over a translucent main bar
2. **Hero** — headline with a rotating treatment word, plus a four-tile stat row and an insurer list
3. **Treatments** — vertical tab list driving an animated panel (photo, bullets, from-price)
4. **Pathway** — full-bleed cobalt band, five stages, with a lemon progress line that fills as you scroll
5. **Facilities** — mixed-size bento of flat colour tiles with line icons, subtle tilt on hover
6. **Team** — greyscale portrait roster that colourises on hover
7. **Reviews** — three cards with a "show three more" reveal
8. **Fees** — a real published price table beside an ink membership card
9. **Booking** — interactive picker: treatment chips, seven real dates, a time-slot grid, live summary, validation and a confirmation state
10. **FAQ** — single-open accordion with a plus/minus marker
11. **Footer** — link grid over a mono baseline, plus a sticky mobile CTA bar

## Motion

Everything is CSS transitions driven by small class changes. Notable pieces:

- **Reveal** — a left-to-right `clip-path` wipe with a per-element `data-delay`
- **Rotating word** — vertical mask swap every 2.6s, placed at the end of the headline so nothing reflows
- **Counters** — quartic ease-out, fired once when the tile scrolls into view
- **Pathway line** — width driven by a `--p` custom property from scroll position
- **Buttons** — two stacked labels sliding on hover instead of a colour fade
- **Tilt** — 3° maximum, pointer-driven, disabled on touch and coarse pointers

### Note on the reveal implementation

Reveals use a `getBoundingClientRect` check rather than `IntersectionObserver`. Chrome factors an
element's own `clip-path` into its intersection ratio, so a target that starts at
`clip-path: inset(0 100% 0 0)` never reports as intersecting and would never reveal.

## Accessibility

- Tabs implement `role="tablist"`/`tab`/`tabpanel` with arrow-key navigation
- The rotating headline exposes one static phrase to assistive tech; the animated list is `aria-hidden`
- Unavailable time slots are real `disabled` buttons with descriptive labels, not styled divs
- The fees table is a `<table>` with scoped headers and a caption
- Form errors are announced through an `aria-live` status region
- `prefers-reduced-motion` disables the wipe, the rotator, tilt, counters and the pulsing dot

## Files

```
dental-template-meridian/
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

No build step and no dependencies. Open `index.html`, or serve the folder:

```bash
python -m http.server 8766
```

## Customising

- **Colour** — every colour is a token in `:root`. Swapping `--cobalt` and `--lemon` re-themes the whole page.
- **Opening hours** — `openWindow()` in `main.js` is the single source of truth. It drives the hero "right now" tile, which days are bookable, and which slots are still offered today.
- **Availability** — slots come from `SLOT_TIMES` with a deterministic "taken" pattern so the demo looks plausible without a backend. Replace `isFree()` with a fetch when wiring to a real system.
- **Images** — remote Unsplash URLs marked `data-img`; on load failure the frame falls back to a flat panel.
