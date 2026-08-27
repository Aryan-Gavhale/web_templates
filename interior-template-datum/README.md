# DATUM

A one-page site for an interior architecture practice, built as a **drafting sheet**:
chalk graph paper, ink type, cobalt drawing lines, dimension annotations, crop marks
and a real title block at the foot of the page.

Static HTML, CSS and JavaScript. No framework, no build step, no dependencies.

---

## Running it

Open `index.html`, or serve the folder:

```bash
python -m http.server 8884
```

Then visit <http://127.0.0.1:8884/>.

Fonts come from Google Fonts and photography from Unsplash, so the first load needs a
network connection. Everything else is local.

---

## Files

```
index.html              markup, including the hand-written floor plan SVG
assets/css/styles.css   tokens, layout, responsive rules
assets/js/main.js       loader, reveals, line-draw, index filter, counters, form
```

---

## Design language

**Ground.** A two-layer graph paper drawn as inline SVG in `background-image` — a 24 px
minor grid at 5.5% and a 120 px major grid at 14%. It reads as squared paper rather
than as decoration, and it costs nothing.

**Colour.** Chalk `#F1F1EC`, ink `#10161C`, cobalt `#2B44D0` for everything that would
be a drawn line on a real sheet, and a single revision red `#C7382E` used exactly twice
— the required-field asterisks and the `Rev` cell in the title block. No gradients, no
glows, no shadows anywhere.

**Type.** Space Grotesk for display and UI, IBM Plex Mono for every annotation, sheet
reference, dimension and table label, Inter Tight for body copy. The mono is what makes
the page read as a drawing rather than as a portfolio.

**Rules.** Everything is a 1 px hairline. Emphasis comes from colour and position, never
from weight.

**Recurring devices.**

- Sheet references (`A-00` … `A-05`) label every section
- The dimension line — two ticked rules with a measured value between them
- Crop marks sit on the paper just outside each photograph, not on top of it, so they
  read the same whatever the image is doing
- The registration cross in the wordmark

---

## Motion

| Where | What happens |
|---|---|
| Loader | Four registration marks fly in from the corners, the wordmark fades up, a cobalt dimension line draws out from behind it and counts to the wordmark's own measured pixel width, the coordinates scramble and settle |
| Hero plan | Every stroke is measured with `getTotalLength()`, then drawn with `stroke-dashoffset`. Long walls take longer than a door tick, so the whole plan draws at one pen speed. Labels fade in once the linework lands |
| Sections | Fade-and-rise on `IntersectionObserver`, with per-element delays set from `data-delay` |
| Plate | The photograph wipes in left to right under a `clip-path` |
| Index | Rows deal out in sequence the first time the register comes into view |
| Filter | Chips re-run the stagger on whatever survives, and the record count updates |
| Record | Rows expand in place using a `grid-template-rows: 0fr → 1fr` transition, which animates to the exact content height with no measured pixel values |
| Figures | Counters ease out from zero, thousands separated with a thin space |

Two things worth knowing if you edit the plan:

- Do **not** put `vector-effect: non-scaling-stroke` on the drawn paths. It measures the
  dash pattern in screen pixels while `getTotalLength()` reports user units, and every
  stroke renders as a partial dash.
- The wipe `clip-path` lives on the `img`, not on the observed element. A fully clipped
  box reports itself as off-screen and the observer never fires.

---

## Responsive

Breakpoints at **1080**, **860** and **560** px, with content capped at 1620 px above
1720 px so the register does not stretch on a wide monitor.

- The nav collapses into a full-screen sheet menu with numbered links and sheet refs
- The hero stacks, and the plan grows its line weights and annotation sizes so it
  survives being drawn at roughly half scale
- The seven-column register becomes a card per record: number, title, one inline meta
  run, expand marker. The meta spans use `display: contents` so they are grid columns on
  desktop and a single flowing line on a phone
- The detail strip is already a scroll-snapped swipe row and simply widens its plates
- The form and the title block go to one and two columns respectively
- Hover-only hints swap to touch wording under `(hover: none), (pointer: coarse)`

Checked at 390 px and 360 px.

---

## Accessibility

- `prefers-reduced-motion: reduce` disables the loader sequence, the line draw, the
  reveals and the smooth scrolling, and shows every element in its final state
- The plan SVG carries `role="img"` and a description of what it shows
- Records are real `<button>`s with `aria-expanded`; collapsed panels are `inert`
- Filter chips are `aria-pressed` and the visible count reports the result
- The menu traps page scroll and closes on Escape, returning focus to the trigger
- Form errors mark the offending cell, report a count and move focus to the first one

---

## Customising

Almost everything is a token at the top of `styles.css`:

```css
--paper  --card  --ink  --blue  --rev  --mute
--line   --line-2   --rule-on   --on-ink
--dis    --ui       --mono
--pad    --bar-h    --ez        --ez2
```

**The grid paper.** Both layers are data-URI SVGs in the `body` rule. Change the `width`
and `height` for the spacing and `stroke-opacity` for the weight.

**The floor plan.** It is hand-written SVG in `index.html` on a `0 0 660 470` viewBox —
a polygon for the outer walls, lines for partitions and windows, arcs for door swings,
and separate groups for the dimensions and the north point. Add a `dl` class to anything
you want drawn and a `dt` class to anything you want faded in; the JavaScript measures
and sequences it automatically.

**Records.** Copy any `.rec` block. `data-cat` must match a chip's `data-chip` value, and
the "of 8" in the count readout is plain text in the markup.

**Photographs.** Swap the Unsplash URLs for your own. Sizes are set by CSS
`aspect-ratio`, so any reasonably large landscape image will crop correctly.
