# ARCHÉ — Interior Architecture Studio Template

A single-page, motion-led marketing site for an interior design / interior architecture
practice. Built as static HTML, CSS and vanilla JavaScript — no build step, no framework,
no runtime dependencies.

```
interior-template-arche/
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  └─ js/main.js
└─ README.md
```

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8899
```

---

## Design direction

The brief was explicitly *not* the usual gradient-and-glow landing page. This is an
editorial layout: flat colour only, hairline rules, large serif display type, generous
whitespace, and a film-grain overlay. Every impression of depth comes from paper tones,
scale contrast and motion rather than shadows or blur.

**Palette** — all flat, no gradients anywhere in the stylesheet.

| Token | Value | Role |
|---|---|---|
| `--bone` | `#F1EDE6` | page background |
| `--paper` | `#FAF8F4` | alternating band background |
| `--ink` | `#141110` | text, dark sections |
| `--graphite` | `#4B443E` | body copy |
| `--stone` | `#8A8078` | eyebrows, meta |
| `--clay` | `#B0613A` | the single accent — italics, indices, active states |
| `--sand` | `#DED5C7` | image placeholder |

**Type** — `Instrument Serif` for display (its italic carries the accent colour),
`Inter` for UI and body. Both from Google Fonts.

Light and dark sections alternate to give the page rhythm: bone hero → paper ticker →
bone studio → **ink work gallery** → paper figures → bone process → **ink materials** →
paper testimonials → bone recognition → paper journal → bone contact → **ink footer**.

---

## Sections

1. **Preloader** — wordmark letters rise, a percentage counter runs, then five panels
   wipe upward to reveal the page.
2. **Hero** — masked line-by-line headline reveal, slow image scale, a paper stat card
   over the photograph, animated scroll cue.
3. **Ticker** — infinite discipline marquee, pauses on hover.
4. **Studio** — manifesto text that lights up word by word as you scroll, plus a
   parallaxed image pair.
5. **Selected Work** — a pinned section where vertical scroll drives a horizontal track
   of six projects, with a progress rule at the base.
6. **Figures** — counters that animate from zero when they enter view.
7. **Process** — sticky heading with a step counter; each step brightens and reveals a
   small photograph as it becomes active.
8. **Material Library** — hover or tap a swatch to cross-fade the large sample image,
   name, origin and description.
9. **Testimonials** — auto-rotating quotes with clickable rule indicators.
10. **Recognition** — award rows that pull a photograph along with the cursor.
11. **Journal** — three entries with image scale-on-hover.
12. **Contact** — oversized headline, magnetic circular call-to-action, detail grid.
13. **Footer** — justified wordmark and a live Milan clock.

---

## Motion architecture

All scroll-linked work runs through **one `requestAnimationFrame` loop** in `main.js`
(`updateParallax`, `updateWorks`, `updateLit`, `updatePress`, `updateProgress`). Discrete
enter-once animations use `IntersectionObserver` instead. Nothing polls the scroll event
for layout reads.

Notable pieces:

- **Text splitting** — `tokenize()` walks a heading's child nodes, preserving inline
  `<em>` and `<br>`, and emits word spans. `splitToLines()` then groups those words into
  lines by measuring `offsetTop` and wraps each line in an overflow-hidden mask. Runs
  after `document.fonts.ready` and re-runs on a debounced resize.
- **Pinned horizontal gallery** — the section's height is set to
  `viewport height + track overflow`, an inner element is `position: sticky`, and scroll
  progress maps to a lerped `translate3d` on the track. Below 760px it degrades to a
  native scroll-snap carousel.
- **Custom cursor** — a dot that tracks exactly and a lerped ring behind it, in
  `mix-blend-mode: difference`. `data-hover` enlarges the ring; `data-hover="View"`
  expands it into a filled label. Hidden entirely on coarse pointers.
- **Magnetic buttons** — `data-magnetic` elements translate toward the cursor at 32%
  strength and spring back on leave.

### Authoring hooks

| Attribute | Effect |
|---|---|
| `data-split` | split into masked lines, reveal on enter |
| `data-reveal="fade" \| "up" \| "mask"` | fade, rise, or clip-path wipe on enter |
| `data-delay="120"` | stagger in milliseconds, applied to either of the above |
| `data-parallax="0.12"` | scroll parallax strength |
| `data-parallax-scale="1.16"` | base scale so the parallax has room to move |
| `data-magnetic` | cursor-attracted button |
| `data-hover` / `data-hover="Read"` | cursor ring state, optional label |
| `data-count="168"` | count-up on enter |

Hero content is exempt from the intersection observer and reveals on load, since the
bottom stat rail sits inside the observer's negative root margin.

---

## Responsive and accessibility

- Breakpoints at **1180px** (nav collapses to the fullscreen menu, columns stack, the
  hero photograph becomes a full-bleed band above the text) and **760px** (single column,
  the pinned gallery becomes a swipe carousel).
- `prefers-reduced-motion: reduce` disables the grain, all transitions and transforms,
  and forces every reveal to its final visible state.
- Menu traps scroll via `body.is-locked` and closes on `Escape`.
- Semantic landmarks, real heading levels, `alt` text on content imagery, and
  `aria-label` on icon-only controls.

---

## Making it yours

- **Copy and structure** live entirely in `index.html`.
- **Colour and type** are the custom properties in the `:root` block at the top of
  `styles.css` — changing `--clay` re-themes every accent on the page.
- **Photography** is currently hot-linked from Unsplash for demonstration. Replace those
  URLs with licensed assets before going live; drop files into `assets/img/` and update
  the `src` and `data-img` attributes. Aspect ratios are set in CSS, so any reasonably
  sized image will crop correctly.
- Project cards accept `proj--wide` or `proj--tall` modifiers to vary the gallery rhythm.

### Note on the demo content

Studio name, projects, awards, testimonials and contact details are all fictional
placeholder content written to make the layout read realistically.
