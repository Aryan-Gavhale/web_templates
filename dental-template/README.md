# Aurelia — Dental Institute Template

A single-page marketing template for a multi-speciality dental hospital. Hand-built HTML, CSS
and vanilla JavaScript — no build step, no framework, no dependencies. Open `index.html`.

## Design direction

Editorial and clinical rather than the usual medical-website look. The whole system is flat:

- **No gradients, no glows, no soft blurred shadows anywhere.** Depth comes from three paper
  tones, hairline rules, and hard offset blocks (`box-shadow: 16px 16px 0` in a flat colour).
- **Palette** — warm paper `#F4F1EA`, deep spruce ink `#101E1A`, moss `#1D4A3D`, mint `#D7E3DA`,
  and terracotta `#C25E43` used sparingly as the only accent.
- **Type** — Fraunces (variable serif, italic for emphasis words) against Inter for UI text.
  Section labels are small uppercase with wide tracking.
- **Shapes** — arch-topped figures for portraits and hero imagery, full-round pills for actions.
- A fixed SVG grain layer at 3.5% opacity keeps large flat fields from looking like plastic.

## Sections

| # | Section | Notable interaction |
|---|---------|--------------------|
| — | Hero | Word-by-word masked headline, rotating circular badge, parallax arch, floating slot card |
| 01 | Treatments | Index-style rows with a cursor-following image preview |
| 02 | Approach | Sticky aside beside a numbered step list, animated figures strip |
| 03 | Technology | Pointer-draggable horizontal rail with scroll-snap and arrow controls |
| 04 | Specialists | Greyscale-to-colour portraits, credentials revealed on hover |
| 05 | Results | Draggable before/after comparison (clip-path, keyboard accessible) |
| 06 | In their words | Auto-advancing quote rotator, pauses on hover |
| 07 | Membership | Three plans, featured card lifted with a hard mint offset |
| 08 | Questions + booking | Single-open accordion beside a sticky form with a success state |
| — | Footer | Outlined oversize wordmark, hours, department links |

## Motion

Every effect is written by hand with `IntersectionObserver` and `requestAnimationFrame`:
staggered scroll reveals, word-mask headlines, eased number counters, a scroll progress rule in
the header, magnetic buttons, and a seamless marquee. Scroll handlers are rAF-throttled and
passive.

`prefers-reduced-motion: reduce` collapses all of it — transitions drop to ~0ms, the marquee and
badge stop, counters jump to their final value, and the cursor-follow preview and magnetic
buttons are never bound at all.

## Accessibility

- Semantic landmarks, one `h1`, ordered heading levels.
- Accordion uses real buttons with `aria-expanded`; the comparison handle is a focusable
  `role="slider"` driven by arrow keys, `Home` and `End`.
- Visible `:focus-visible` ring in terracotta, `Escape` closes the mobile drawer, and the drawer
  locks body scroll while open.
- Text contrast on every surface pairing meets WCAG AA.

## Files

```
dental-template/
├── index.html
├── assets/
│   ├── css/styles.css   # tokens, components, responsive, reduced-motion
│   └── js/main.js       # 18 small independent modules, IIFE-scoped
└── README.md
```

## Customising

Change the palette and rhythm in one place — the `:root` block at the top of `styles.css`
(`--paper`, `--ink`, `--moss`, `--clay`, `--shell`, `--gutter`, `--arch`).

Photography is loaded from Unsplash CDN URLs so the file runs standalone. Swap the `src`
attributes for local assets before going live — every `<img>` carries `data-img`, and any image
that fails to load degrades to a flat paper-toned block instead of a broken icon.

Form submission is simulated client-side; wire the `submit` handler in `main.js` to a real
endpoint. Content, names, credentials, figures and case references are placeholders.
