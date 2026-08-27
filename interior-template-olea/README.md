# OLEA — Interior Design Studio Template

A soft, biophilic landing page for an interior design practice. Cream ground, deep
pine green, honey accent. Arches and pills instead of hairlines and grids.

Third of three templates in this workspace, alongside `interior-template-arche`
(warm editorial minimalism) and `interior-template-umbra` (dark Swiss-grid
brutalist-luxe). Nothing is shared between them — different palettes, typefaces,
layout logic and motion vocabulary.

## Running it

Static HTML, CSS and JS. No build step, no dependencies.

```bash
cd interior-template-olea
python -m http.server 8893
```

Then open <http://127.0.0.1:8893>. Opening `index.html` directly from disk also
works; only the Google Fonts and Unsplash images need a connection.

## Files

```
index.html            all markup and copy
assets/css/styles.css design tokens, layout, responsive rules
assets/js/main.js     loader, reveals, tabs, process, carousel, form
```

## Design language

The whole page is built from two shapes: the **arch** (a rectangle with a fully
rounded top) and the **pill**. Buttons, tabs, chips and the nav are pills; every
photograph that carries meaning is an arch. Small leaf marks — a square with two
opposite corners rounded — stand in for bullets and dots.

- **Ground** `#F6F2EA` cream, with `#FFFDF8` shell for raised cards
- **Ink** `#1D3A2F` pine for dark blocks, `#3E6B55` moss for accents
- **Accent** `#C98B3E` honey, used sparingly on the primary CTA and list marks
- **Display** Fraunces, a soft variable serif — `SOFT` and `WONK` axes are dialled
  up so the letterforms stay rounded rather than crisp
- **UI** Plus Jakarta Sans

There are no gradients, glows or drop shadows anywhere except one soft lift on
pricing card hover. Depth comes from flat colour blocks and generous radii.

## Motion

Everything is CSS transitions driven by class toggles. The only script that runs
on pointer move is the drag carousel.

| Element | Behaviour |
| --- | --- |
| Loader | A pine arch grows from the bottom edge to fill the screen, the wordmark letters rise in, then the whole panel lifts away with a curved bottom edge |
| Headline | A word rotator cycles `calm / rooted / lived-in / yours`, clipped to a fixed-width box so nothing reflows |
| Studio seal | Circular SVG text on a `textPath`, rotating continuously |
| Reveals | `[data-rise]` slides up, `[data-mask]` fades in while its image scales down from 1.16 — both fired once by an IntersectionObserver |
| Tag tape | Infinite marquee, pauses on hover |
| Counters | Ease-out count from zero when 45% visible |
| Room tabs | A pine pill slides behind the active tab; the arch image and copy panel crossfade |
| Process | A sticky arch image swaps as each step crosses the middle of the viewport, with a running `01 / 04` counter |
| Testimonials | Native scroll-snap carousel, plus pointer-drag with click suppression for mouse users |
| Cursor | A pine label follows the cursor over the carousel and reads "Drag" |

`prefers-reduced-motion: reduce` cuts every transition to near-zero, forces all
reveals visible, disables the word rotator and turns off smooth scrolling.

## Responsive

Breakpoints at **1080px**, **860px** and **560px**. Verified at 1440, 390 and 360.

- The pill nav collapses into a round menu button and a full-screen sheet with
  staggered links and a pine CTA
- The nav stops auto-hiding below 1080px, because the process section pins itself
  directly beneath it
- The process section turns into a compact sticky header — a small arch thumbnail
  with `03 / 04` and the current step name — so the image still swaps while you read
- The project grid goes from three CSS columns to two to one. It uses multi-column
  rather than grid rows so the mixed tile heights stagger instead of leaving gaps
- Room tabs scroll horizontally; the pricing grid stacks with the featured plan first
- The cursor label and hover lifts are disabled on coarse pointers

## Accessibility

- The rotating headline carries an `aria-label` with the full sentence and the
  rotator itself is `aria-hidden`, so it is never read letter by letter or announced
  on every change
- Room tabs use real `role="tab"` semantics with left/right arrow key support
- The menu locks body scroll and closes on Escape
- Every decorative image is `aria-hidden` or has empty alt; content images describe
  the room
- Form errors are marked per field with a message in the note line

## Customising

**Colours and radii** — the tokens at the top of `styles.css`. Changing `--pine`
and `--honey` re-skins the whole page.

**Type** — swap the Google Fonts link and the `--dis` / `--ui` variables. If you
replace Fraunces with a non-variable serif, remove the `font-variation-settings`
declarations.

**Images** — all photography is hot-linked from Unsplash with `auto=format&fit=crop`.
Replace the `src` values with your own; the arch and tile crops assume portrait 3:4
for the hero and process, and landscape 4:3 for the grid.

**Copy** — everything lives in `index.html`. The studio name, prices, locations and
testimonials are invented placeholders.

**The form** posts nowhere. `form()` in `main.js` validates and shows a success
message; point it at a real endpoint before launch.
