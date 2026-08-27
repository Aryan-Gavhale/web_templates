# VESPER

A template for a hospitality interiors studio — bars, restaurants and small hotels.
Oxblood, oat and brass; high-contrast Bodoni; everything on a centre line.

No build step, no framework, no dependencies. Three files.

## Running it

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8883
```

Then visit `http://127.0.0.1:8883/`.

## Files

```
index.html            markup and copy
assets/css/styles.css design tokens, layout, responsive rules
assets/js/main.js     loader, reveals, marquee, carousel, menu, form
```

Fonts come from Google Fonts, photography from Unsplash. Both are hotlinked so the
template works from a cold clone; swap them for local assets before going live.

## Design language

**Symmetry.** Every section is centred on a single axis. Headings, rules, captions,
the four detail discs, the form, the footer columns. Nothing is left-aligned to a
grid, which is what separates this from the usual studio-portfolio layout.

**Palette.** Warm oat `#F0E4D4` as the ground, oxblood `#57121F` for the full-width
bands, and two brasses — `#A0702B` on light, `#C9A05A` on dark. Photographs supply
every other colour. No gradients, no glows, no shadows anywhere.

**Type.** `Bodoni Moda` for display, at high optical contrast, italic wherever the
voice softens. `Jost` for everything functional — labels, navigation, body copy —
set small and widely tracked in uppercase so it reads as engraving rather than UI.

**Rules.** The recurring divider is a *double rule*: two hairlines with a 3px gap.
It appears under every heading and above every credential. There is also a menu
ornament — hairline, diamond, hairline — used once, above the press quote.

## Motion

Six ideas, used consistently:

| | |
|---|---|
| **Tracking-open** | Letter-spacing animates from tight to wide. Drives the loader wordmark, every eyebrow, and the giant footer signature (which runs the other way, wide to tight). |
| **Rules from the centre** | Every divider scales out from its midpoint rather than wiping in from one side. `transform-origin: 50%`. |
| **Word-mask rise** | Headlines and pull quotes are split into words, each in its own overflow-hidden box, rising on a stagger. |
| **Scroll-reactive marquee** | The venue ribbon drifts left on its own and takes an extra push from scroll velocity — scroll down and it accelerates, scroll up and it briefly reverses. Stepped on elapsed time, so it moves at the same speed on a 60Hz or 120Hz display. |
| **Coverflow** | The venue carousel centres one image at full colour and scale, with its neighbours reduced, pushed out and washed toward the page colour by a flat oat overlay. |
| **Clip wipes** | The two full-bleed photographs reveal upward with `clip-path: inset()`. |

The loader is a wine-label seal: a brass ring draws itself while the wordmark tracks
open inside it, a double rule expands beneath, and `MILANO` fades in last. The whole
panel then lifts, and the hero words rise behind it.

### One trap worth knowing about

`IntersectionObserver` computes intersection *after* clipping. An element hidden with
`clip-path: inset(0 0 100% 0)` has zero visible area, so it never reports as
intersecting and never gets the class that would reveal it. The wipe observer watches
each image's **wrapper** and adds the class to the child.

## Responsive

Breakpoints at 1180px, 900px, 640px and 400px. Verified at 390px and 360px.

- **Header** collapses to a burger on the left and the wordmark centred, opening a
  full-screen oxblood sheet with the same arrangement — close button left, wordmark
  centred — so the eye does not have to move when it toggles.
- **Carousel** widens the active slide to 78–82vw and drops the arrow buttons; drag
  and the segment dots carry the interaction. The neighbours reduce to slivers at the
  edges, which is enough to signal there is more.
- **The Card** stacks its two columns with the divider becoming a horizontal rule.
  Item names are allowed to wrap while the leader dots keep their minimum length.
- **Details** go from four discs across to one, at a smaller diameter.
- **Footer** goes four columns → two → one, and the bottom bar stacks with the
  diamond separators hidden.

## Accessibility

- `prefers-reduced-motion: reduce` disables every transition and animation, forces
  all reveals to their resting state, and stops the marquee.
- Split headings carry an `aria-label` with the full sentence, and the per-word
  fragments are `aria-hidden`, so a screen reader hears sentences rather than words.
- The carousel is a labelled group: arrow keys move it, the segments are real tabs
  with `aria-selected`, off-stage slides are `aria-hidden` and non-clickable, and the
  caption region is `aria-live="polite"`.
- The menu locks page scroll, restores the scroll position on close, moves focus to
  the close button and back to the burger, and closes on Escape.
- Form errors are announced next to their field and focus jumps to the first one.
- All decorative marks — diamonds, ornament, seal, frames — are `aria-hidden`.

## Customising

Colour, type and rhythm are all tokens at the top of `styles.css`:

```css
--oat:#F0E4D4;   --wine:#57121F;   --brass:#A0702B;   --gild:#C9A05A;
--dis:'Bodoni Moda',serif;         --ui:'Jost',sans-serif;
--pad: /* gutter */                --sec: /* section rhythm */
```

To change the carousel geometry, adjust `--gw` (slide width) and `--gs` (the step
between slides) on `.gal__stage`; the scale and dimming of the neighbours are set in
`place()` in `main.js`.

Venues are plain `<li>` items in `.gal__track` paired with `<article>` captions in
`.gal__cap` — they are matched by index, so add or remove them in both places and the
counter, segments and looping adjust themselves.

All copy, names, projects and press mentions are fictional.
