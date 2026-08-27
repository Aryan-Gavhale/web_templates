# KILN — Interior Design Studio Template

A colour-blocked landing page for a hospitality and workplace interiors practice.
Bone paper, ink type, terracotta slabs. Poster typography and hard edges — no
rounded corners anywhere on the page.

Fourth of four templates in this workspace, alongside `interior-template-arche`
(warm editorial minimalism), `interior-template-umbra` (dark Swiss-grid
brutalist-luxe) and `interior-template-olea` (soft biophilic arches and pills).
Nothing is shared between them — different palettes, typefaces, layout logic and
motion vocabulary.

## Running it

Static HTML, CSS and JS. No build step, no dependencies.

```bash
cd interior-template-kiln
python -m http.server 8887
```

Then open <http://127.0.0.1:8887>. Opening `index.html` directly from disk also
works; only the Google Fonts and Unsplash images need a connection.

## Files

```
index.html            all markup and copy
assets/css/styles.css design tokens, layout, responsive rules
assets/js/main.js     loader, reveals, drift, viewer, slider, swatches, form
```

## Design language

Where the other three templates soften their edges, this one refuses to. Every
corner is square, every rule is 2px, and the page is organised as flat planes of
colour rather than as cards floating on a background:

```
bone hero → terracotta statement → bone work, comparison, materials, awards → ink contact + footer
```

- **Ground** `#EDE7DE` bone, `#F5F1EA` paper for hover states
- **Ink** `#17140F`, used for the whole bottom third of the page
- **Accent** `#B4573C` terracotta, with `#8E3F2B` rust for button hovers
- **Display** Bricolage Grotesque, run narrow (`wdth` 84–100) and heavy so the
  headlines set as posters rather than as text
- **UI** Manrope

No gradients, glows or drop shadows. Contrast does all the work.

## Motion

Everything is CSS transitions driven by class toggles. One `requestAnimationFrame`
loop handles the single scroll-linked effect; the rest is `IntersectionObserver`.

| Element | Behaviour |
| --- | --- |
| Loader | Two identical full-viewport layers sit on top of each other. The upper one is terracotta on bone and is wiped in with `clip-path`, so the wordmark inverts exactly where the colour edge passes over it, then the whole screen lifts |
| Reveals | `[data-up]` slides up and fades; `[data-wipe]` runs a hard top-down `clip-path` wipe while the image scales down from 1.12 |
| Hero strip | The three images drift apart horizontally as the section scrolls, bleeding slightly past the text gutter |
| Counters | Ease-out count from zero when 60% visible |
| Project viewer | Clicking a card measures its image, opens the dialog, measures the destination frame, and animates a fixed clone between the two rects — so the photograph appears to fly into place. Reverses on close, and falls back to a plain fade when the card has scrolled out of view |
| Shell / fitted | Pointer-captured drag over the whole frame, `clip-path` on the overlay image, with arrow-key and Home/End support on the handle |
| Materials | A flex accordion — the hovered sample grows to `flex-grow: 3.2` and its caption plate expands |
| Cards, nav, buttons | Terracotta rules that scale in from the left, image scale on hover |

`prefers-reduced-motion: reduce` cuts every transition to near-zero, forces all
reveals visible, skips the loader and the strip drift, and swaps the viewer's
fly-in for an instant open.

## Responsive

Breakpoints at **1760px**, **1080px**, **860px** and **560px**. Verified at 2074,
1440, 390 and 360.

- Above 1760px the padding grows to cap the content at 1680px, so the full-bleed
  rules and statistics don't stretch into unreadable rows
- The nav collapses into a full-screen terracotta menu that wipes down, with
  staggered links and the studio address pinned to the bottom
- The project grid goes three columns → two → one, dropping the staggered offsets
  at phone width
- The comparison frame changes from 16:9 to 4:3 so the two states stay legible
- The materials accordion has no room to expand on a phone, so it becomes a
  scroll-snapped swipe strip with every caption already open
- Stacked, the project dialog is taller than the screen, so the overlay scrolls
  rather than the panel — otherwise the grid squeezes the image row — and the
  close button pins to the corner
- Hover-only affordances are replaced on coarse pointers: cards get a permanent
  divider rule, and the two hint lines swap "Click"/"Hover" for "Tap"/"Swipe"

## Accessibility

- The comparison handle is a real `role="slider"` with `aria-valuenow`, arrow keys
  and Home/End
- The dialog is `aria-modal`, closes on Escape or scrim click, locks body scroll
  with scrollbar-width compensation so nothing shifts, and returns focus to the
  card that opened it
- The decorative footer wordmark is `aria-hidden`; content images describe the room
- Form errors are marked per field with a message in the note line

## Customising

**Colours** — the tokens at the top of `styles.css`. Changing `--clay` and `--ink`
re-skins the whole page.

**Type** — swap the Google Fonts link and the `--dis` / `--ui` variables. If you
replace Bricolage Grotesque with a non-variable face, remove the
`font-variation-settings` declarations; the `wdth` axis is what keeps the headlines
narrow.

**Images** — all photography is hot-linked from Unsplash with `auto=format&fit=crop`.
Replace the `src` values with your own. Project cards crop to 4:5 (4:3 on phones),
the hero strip to 4:3, and the material samples fill their column.

The shell/fitted pair is two different rooms standing in for a real before/after.
Swap in a matched pair shot from the same position and the wipe will read as one
space rather than two.

**Copy** — everything lives in `index.html`. Each project card carries its dialog
content in `data-` attributes, so adding a project means copying one `<button>`
block. The studio name, awards, addresses and testimonial are invented placeholders.

**The form** posts nowhere. `form()` in `main.js` validates and shows a success
message; point it at a real endpoint before launch.
