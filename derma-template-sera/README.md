# SÉRA — Dermatology & Skin Health

A front-end template for a consultant-led dermatology practice. Static HTML, CSS
and vanilla JavaScript — no build step, no framework, no dependencies. Open
`index.html` and it runs.

```
derma-template-sera/
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

---

## The design brief this answers

Medical websites usually fail in one of two directions: clinical to the point of
looking abandoned, or so soft-focus that you cannot tell a dermatologist from a
day spa. This template takes the third route — an **editorial medical** register.
It reads like a practice that publishes its own research and its own prices.

**No gradients. No glows. No coloured shadows.** Depth comes from three things
only: hairline rules, generous whitespace, and motion. Every fill is flat.

### Palette

| Token | Value | Role |
|---|---|---|
| `--porcelain` | `#F1F0EC` | page ground |
| `--paper` | `#FAF9F6` | raised cards, hover states |
| `--ink` | `#15181B` | type, and the dark Results block |
| `--moss` | `#20302B` | the Book block and the lead fee card |
| `--moss-2` | `#18241F` | footer |
| `--rose` | `#B07C6E` | the only accent — indices, dots, active states |

One accent, used sparingly. Rose appears on eyebrow dots, active numerals, list
markers and button hover fills, and nowhere else.

### Type

- **Display** — Fraunces (variable serif). Used at `opsz 120–144` with tight
  negative tracking, and in italic for the single emphasised word in the hero.
  It carries authority without looking like a law firm.
- **UI** — Inter, 15–16px, for everything a patient actually has to read.

Small caps-style labels are Inter at 10.5–11px with `.18em` tracking. That
contrast — a 100px serif beside an 11px letterspaced label — does most of the
design's work.

### Shape

An **arch** (`--arch`, a clamped 120–260px top radius) appears on exactly two
things: the hero portrait and the cursor-follow preview. Everything else is a
plain 18px radius or a pill. Reserving the arch is what keeps it feeling like a
signature rather than a decoration.

---

## Sections

| # | Section | What it is |
|---|---|---|
| 1 | Boot | Wordmark holds while a hairline measures the viewport, then the layer lifts |
| 2 | Hero | Word-masked headline, floating availability and rating chips, credential row |
| 3 | Ticker | Accreditation marquee, pauses on hover |
| 4 | Concerns | Tabbed index (Medical / Aesthetic / Surgical) with a cursor-follow image preview |
| 5 | Protocol | Sticky title, four steps that brighten as they enter, with a scroll-driven rail |
| 6 | Results | Before/after wipe with case switcher and a facts table |
| 7 | Practice | Consultant portrait, animated counters, dated credential list |
| 8 | Inside | Drag-to-scroll gallery with a custom "Drag" cursor |
| 9 | Voices | Snap-scrolling testimonials with a progress bar |
| 10 | Fees | Three published fee cards, the middle one a flat moss block |
| 11 | FAQ | Single-open accordion, plus mark rotating to a cross |
| 12 | Book | Validated appointment form with an in-place success state |
| 13 | Footer | Wordmark, four columns, legal bar |

---

## Motion

Every animation is CSS transition or transform driven, timed on two shared
easings (`--ez` for entrances, `--ez2` for wipes). JavaScript only adds and
removes classes, sets a custom property, or writes a transform.

- **Reveals** — `IntersectionObserver` adds `.is-in`; stagger comes from a
  per-element `--d` delay set in the markup.
- **Headline** — words are wrapped in overflow-clipped spans at runtime and
  rise into place on a 45ms cascade.
- **Comparison slider** — a transparent `<input type="range">` covers the image,
  so dragging, tapping and arrow keys all work with no pointer maths and no
  accessibility gap. Its value drives `--x`, which drives a `clip-path`.
- **Cursor preview** — position is lerped at `0.14` toward the pointer, and the
  loop is cancelled on mouse-out so nothing spins when it isn't visible.
- **Scroll work** — one listener, one `requestAnimationFrame`, three jobs
  (header state, protocol rail, parallax), in a `try/finally` so a throw can
  never leave the loop latched.

Motion is disabled wholesale under `prefers-reduced-motion`, and the boot layer
is skipped entirely.

---

## Accessibility and no-JS behaviour

- Reveal animations only hide content once `main.js` has added `.js` to `<html>`,
  so with JavaScript off the page renders fully and reads top to bottom.
- Tabs, case switchers and the accordion carry `role`, `aria-selected` and
  `aria-expanded`; the nav marks the current section with `aria-current`.
- The comparison slider is a real range input with an accessible name.
- Focus is visible everywhere via a rose `:focus-visible` outline.
- Decorative rules, dots and the drag cursor are `aria-hidden`.

---

## Before you ship this

**Imagery is placeholder.** Photographs are hot-linked from Unsplash with
`imgix` crop parameters. Replace them with your own files under
`assets/img/` before launch — hot-linking a third party in production is a
dependency you do not want.

**The before/after pairs are staged.** Each case currently uses one photograph
twice, with the "before" half toned down through `&sat=-42&con=-12&exp=-8`, so
the mechanism can be demonstrated honestly. Swap in genuine consented pairs shot
on the same body, lens and lighting. The copy in that section makes a specific
claim about methodology — do not ship it unless the claim is true.

**Content is fictional.** Séra, Dr Amara Vance, the GMC number, the fees, the
reviews and the accreditations are invented for the template. Regulated medical
claims, prices and professional registrations must be replaced with real,
verifiable detail.

**The form does not submit.** `main.js` validates and shows a success state
locally. Point it at a real endpoint, and treat anything a patient types as
clinical data — encrypted transport and storage, with a retention policy.
