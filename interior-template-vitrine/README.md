# VITRINE

A template for an interior design studio working in **retail, flagship and exhibition**
interiors — a fictional Antwerp practice whose pitch is that a shop says everything it is
going to say in the first three metres.

Static HTML, CSS and JavaScript. No build step, no framework, no dependencies.

## Running it

Open `index.html`, or serve the folder:

```bash
python -m http.server 8882
```

Then visit <http://127.0.0.1:8882>.

## Files

```
index.html            markup and copy
assets/css/styles.css design tokens, layout, responsive rules
assets/js/main.js     loader, reveals, header, menu, work index, form
```

## Design language

**Split, not centred.** The page is built on a vertical division: the hero, the approach
statement, the work index and the contact section are all two halves with a hairline
between them. Everything is set hard to the left of its column. On phones the split turns
horizontal and the halves stack in the same order.

**Achromatic, with one voice raised.** Pure white ground, near-black ink, a scale of greys
for the hairlines and secondary text, and a single signal red used sparingly — a 6px square
before each label, the full stop after a headline, the progress rail, the fill that floods a
service cell on hover.

**Photography is greyscale.** Every image on the page is desaturated, which makes the one
place colour appears — the live preview beside the work index — the strongest thing on the
screen. On phones there is no hover, so the row nearest the middle of the viewport takes
the colour instead, and it passes from card to card as you scroll.

**Type does the shouting.** `Big Shoulders Display` is extremely narrow, so it is set very
large: the hero fills its column edge to edge, and the footer wordmark spans the full page
width and is cropped by the bottom of the document. `Schibsted Grotesk` handles everything
functional — labels are small, uppercase and widely tracked.

No gradients, no glows, no shadows, no rounded corners. Every division is a 1px rule.

## Motion

Six mechanics, used consistently:

| | |
|---|---|
| **Panel split** | The loader is two black halves. A counter runs to 100 while the wordmark fills in from the left, then the halves slide apart to the edges of the screen. |
| **Line clip** | Headlines are typeset one line per `.ln` and rise out of their own clipping box, staggered 80ms apart. |
| **Wipe** | Full-bleed photographs reveal left to right with `clip-path: inset()`. |
| **Hover preview** | Moving down the work index swaps the pinned image beside it and rewrites the caption under it; unhovered rows drop to 38% and the live title turns red and steps right. |
| **Cell flood** | A service cell fills with red from its bottom edge, and its text inverts. |
| **Live section name** | The header carries the name of the section you are currently in, cross-fading as you pass each boundary. A red rail across the top tracks reading progress. |

Scroll-linked work runs through `requestAnimationFrame`; one-shot reveals use
`IntersectionObserver`. Note that an element hidden by `clip-path` has no box to intersect,
so the wipe observer watches each image's **parent**.

## Responsive

Breakpoints at 1180, 940, 640 and 400.

- **1180** — services and figures drop to two columns; contact stops being a split.
- **940** — every split stacks. The header collapses to a wordmark and a burger; the menu is
  a full-screen black sheet that clips open. The pinned preview is a pointer affordance, so
  it is removed and each index row grows its own image instead.
- **640** — the sector bar becomes 2×2, services and figures become single column, form
  inputs go to 16px so iOS does not zoom the viewport on focus.

Because `Big Shoulders Display` is so condensed, the stacked layouts need a **much** larger
type floor than the split ones — otherwise the display face reads as body copy. Every
display size is set from measured glyph widths against the available column, at roughly 90%
fill, which is what lets `.ln > span` carry `white-space: nowrap` and keep the intended line
breaks deterministic. Verified free of clipping and horizontal overflow from 320px to 1920px.

## Accessibility

- `prefers-reduced-motion: reduce` reveals everything immediately and skips the loader.
- Index rows are real links, so the preview responds to keyboard focus as well as hover.
  The preview panel itself is `aria-hidden` — it duplicates information the rows already carry.
- The menu locks the background, restores the exact scroll position on close, moves focus in
  and back out, and closes on Escape.
- Form errors are written next to their field and focus moves to the first one.
- Decorative squares, slashes and the oversized footer wordmark are `aria-hidden`.

## Customising

Colour, type and rhythm are tokens at the top of `styles.css`:

```css
--paper:#FFFFFF;   --ink:#0B0B0C;   --red:#EB2A0E;
--g1:#6E6E73;      --g2:#D6D6DA;    --g3:#F2F2F4;
--dis:'Big Shoulders Display';      --ui:'Schibsted Grotesk';
--pad: …;          --sec: …;        --top-h:62px;
```

Swapping `--red` re-tints every accent on the page. Dropping `--grey` (the
`grayscale(1) contrast(1.04)` filter) returns all photography to colour and neutralises the
work-index reveal.

Projects live as `<li class="row">` entries in the index, each carrying `data-i`, a
`data-meta` string for the caption, and its own image for narrow screens; the matching
`<figure class="shot">` in the preview frame must stay in the same order.

Photographs are hot-linked from Unsplash for demonstration and should be replaced with
licensed assets. All names, addresses, contact details and project data are fictional.
