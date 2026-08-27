# UMBRA — Spatial Design Studio

A dark, architectural template for an interior design practice. Static HTML, CSS and
vanilla JavaScript — no build step, no framework, no dependencies beyond two Google fonts.

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8896
```

---

## The idea

Where a light editorial template sells warmth, this one sells rigour. It is built to look
like a studio that measures things: near-black surfaces, hairline column rules, monospaced
metadata, and a grotesk set at expanded width for headlines. There are no gradients and no
glows anywhere in the stylesheet — every edge is a 1px rule or a hard change in value.

**Palette**

| Token | Value | Use |
| --- | --- | --- |
| `--void` | `#0A0A0B` | page ground |
| `--coal` | `#101012` | alternating section bands |
| `--steel` | `#1F1F24` | image placeholders, footer wordmark |
| `--chalk` | `#EDEBE6` | primary text |
| `--ash` / `--dim` | `#8E8E96` / `#5C5C64` | body copy, labels |
| `--sage` | `#A3B18A` | the single accent |

**Type** — `Archivo` (variable width axis, used at `wdth 104–118` for display) and
`JetBrains Mono` for every label, number and piece of metadata.

---

## Sections

1. **Boot screen** — wordmark revealed by a clip-path wipe, a rule that fills to 100%, then the whole panel slides up
2. **Header** — logo, live section readout (`04 / Anatomy`), phone number, menu trigger. Hides on scroll-down, returns on scroll-up
3. **Drawer nav** — slides in from the right, numbered list with staggered line reveals
4. **Hero** — split layout: text left, auto-advancing image carousel right with an index, per-slide progress bars and a caption
5. **Ticker** — infinite marquee of coordinates and disciplines, pauses on hover
6. **Statement** — big claim plus a two-column supporting argument
7. **Services** — five-item accordion, each opening to copy, capability chips, a price band and a photograph
8. **Selected work** — five project cards that **stack** on scroll, each sticking under the header and dimming as the next covers it
9. **Anatomy of a room** — an annotated photograph with five hotspots; hover or tap a marker (or use the index list) to swap the detail card
10. **Numbers** — counters that animate on entry
11. **Studio** — four portraits, grayscale until hover
12. **Clients** — three quote cards
13. **Questions** — plain FAQ accordion
14. **Contact** — a real form with floating labels, inline validation and a success state, beside studio details and a live London clock
15. **Footer** — oversized wordmark, link columns, registration details
16. **Mobile dock** — a fixed two-button action bar below 860px

---

## Motion

Everything scroll-linked runs in **one** `requestAnimationFrame` loop (`loop()` in
`main.js`): the section readout, the progress rail and the card-stack dimming. Discrete
animations use `IntersectionObserver` and hand off to CSS transitions, so the main thread
stays free.

| Effect | Where |
| --- | --- |
| Per-character headline reveal | `[data-chars]` — split into `.wd` / `.ch` spans, staggered 15ms, capped at 46 characters |
| Fade-and-rise | `[data-fade]`, optional `data-delay="220"` |
| Crosshair cursor | a plus that grows and rings on interactive elements, `mix-blend-mode: difference` |
| Magnetic pull | `[data-mag]` on the primary buttons |
| Card stacking | `position: sticky` with a per-card `--n` offset; JS sets `--dim-v` on the covered card |
| Accordion | `grid-template-rows: 0fr → 1fr`, so no height is ever measured in JS |

### Authoring hooks

| Attribute | Effect |
| --- | --- |
| `data-chars` | split the heading into animated characters |
| `data-fade` | fade and rise on entry |
| `data-delay="220"` | stagger a reveal, in milliseconds |
| `data-mag` | magnetic hover |
| `data-x` | enlarge the crosshair on hover |
| `data-cap="…"` | caption shown under the hero carousel for that slide |
| `--n` on `[data-card]` | stack order and sticky offset |
| `--px` / `--py` on `.pin` | hotspot position, as a percentage of the image box |

---

## Responsive behaviour

Three breakpoints, each removing complexity rather than rearranging it.

- **≤1080px** — hero goes single-column with the image first, the progress rail and half the column rules are dropped, accordion panels and the anatomy stage go full width
- **≤860px** — the sticky card stack becomes a plain vertical list (and stops dimming), the form collapses to one column, the mobile dock appears and `body` gains matching bottom padding
- **≤560px** — column rules are removed entirely, stats go single-file, the carousel caption drops to its own line, and hotspot markers shrink to 30px with a 50px touch target

Two details worth knowing if you edit them:

- The anatomy image keeps a `16/11` ratio at **every** width on purpose. The pin
  coordinates are percentages of that box, so changing the ratio moves every marker off
  its feature.
- The hero image uses an explicit `height`, not `aspect-ratio`. With a ratio plus a height
  cap the browser shrinks the *width* to preserve it, which leaves a gap beside the column.

---

## Accessibility

- Split headings expose the original string via `aria-label` and hide the per-character
  spans from assistive tech, so a screen reader hears a sentence rather than spelled letters
- `prefers-reduced-motion: reduce` disables the noise layer, collapses every transition and
  shows all revealed content immediately
- The drawer traps body scroll, closes on `Escape`, and every hotspot has an `aria-label`
- Hotspot content is reachable without hovering — the index list works on tap and keyboard
- Colour is never the only signal: the active hotspot changes number colour, fill and a rule

---

## Customising

- **Colours and type** live in `:root` at the top of `assets/css/styles.css`
- **Images** are Unsplash URLs in the markup; swap the `photo-…` IDs. Sizes are requested
  via `?auto=format&fit=crop&w=…&q=80`
- **Sections** are numbered in the `SECTIONS` array in `main.js` — keep it in sync with the
  drawer if you add or remove one
- **The form** is demo-only. `contactForm()` prevents default and fakes a success state;
  point it at a real endpoint before launch

---

## Files

```
interior-template-umbra/
├── index.html
├── README.md
└── assets/
    ├── css/styles.css
    └── js/main.js
```
