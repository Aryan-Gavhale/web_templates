# Wobble — children's dentistry

The eighth dental template, and the first one built for a practice that only sees children. It is
illustration-led rather than photography-led, and the page is laid out as a run of flat colour
blocks joined by wave dividers instead of the usual single background with alternating tints.

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8123
```

No build step, no dependencies, vanilla JavaScript.

## The design

**Palette** — flat colour only, no gradients and no glows. Cream `#FFF7EA` is the base, with sky
`#A9DBEF`, butter `#FFD64A`, coral `#FF6A55` and mint `#A7E3C3` owning whole sections. Type and
line work are deep plum `#241F3A` rather than black, which keeps the contrast strong without going
cold.

**Type** — Fredoka for anything display-sized (headings, numbers, prices, buttons) and Nunito for
body copy. Both are rounded without being childish, which is the line this brand has to walk.

**Geometry** — 22–32px radii on every panel, pill buttons, and no borders or drop shadows on cards.
The only outlines in the design belong to the illustrations, which is what makes them read as
drawings rather than decoration.

**Voice** — two audiences on one page. Headings and the storyboard talk to the child ("the chair
goes up and down"); every step also carries a *For grown-ups* note with the clinical detail a parent
actually wants. The questions section is written for the parent alone.

## Sections

| Section | Colour | What it does |
| --- | --- | --- |
| Hero | cream | Illustrated tooth, sun, cloud and toothbrush, with a rotating "first visit free" sticker |
| At a glance | butter | Four facts — ages seen, free first visit, years open, Saturday hours |
| First visit | sky | The five-step illustrated storyboard |
| Brushing | mint | The working two-minute timer |
| Why parents pick us | cream | Bento grid — practice, photo, stat, quote, reassurance, live opening hours |
| What it costs | white | Plain price list with the NHS route stated first |
| Who you'll meet | cream | Four clinicians, each portrait on its own colour |
| Questions parents ask | butter | Six honest answers, including nervous children and SEND support |
| Book a first visit | coral | Booking form that resolves into a bravery certificate |
| Footer | ink | Address, hours, care links, small print |

## The illustrations

Everything drawn is inline SVG built from three reusable pieces defined once in a sprite at the top
of `index.html`:

- `#tooth` — the tooth body path
- `#face` — the same path with eyes and a smile
- `#star` — a five-point star

Scenes reference them with `<use href="#face" transform="translate(x y) scale(s)">`. Colour comes
from classes on the `use` element (`f-white`, `f-sky-2`, `f-butter`, `f-coral`, `f-mint`) and the
outline from `s-ink`, both of which inherit into the referenced shape. The paths carry
`vector-effect="non-scaling-stroke"` so line weight stays identical whether a tooth is drawn at
0.8× in a storyboard panel or 2.4× in the hero.

To draw a new prop, add plain shapes to a scene's `<svg>` with the same paint classes. To recolour
the whole illustration set, change the tokens in `:root`.

## The two-minute timer

`timer()` in `main.js`. Two minutes split into four thirty-second quadrants.

- The ring is a single `<circle>` with `stroke-dasharray: 641` (its circumference) and an animated
  `stroke-dashoffset`, rotated -90° so it fills from the top.
- Elapsed time is measured from `Date.now()` rather than counted in ticks, so pausing, resuming and
  a throttled background tab all stay accurate. The interval only repaints.
- Quadrant pills move through *next → now → done*, the ring turns mint on completion, and the
  button cycles Start → Pause → Keep going → Go again.
- Each quadrant change is announced once through a live region, so a screen reader user hears "now
  brush the bottom left" without the countdown being read aloud continuously.

`TOTAL` and `SPAN` at the top of the function are the only numbers to change if you want a
different length or a different number of zones. `ZONES` holds the labels.

## The first-visit storyboard

`story()` runs five illustrated panels against five text blocks. Previous and next, the dot rail,
and left/right arrow keys anywhere inside the card all drive the same `draw()` call, which also
moves focus to the new step's heading so keyboard and screen reader users are not left behind.
Both ends disable rather than wrap, so the sequence stays a sequence.

## The bravery certificate

The booking form validates on submit, then hides itself and reveals a dashed certificate carrying
the child's name, today's date in `en-GB`, five stars and a signature. The summary line above the
button rebuilds live from the name, age band and any flags chosen.

`Print the certificate` calls `window.print()`; the `@media print` block strips the site down to the
certificate alone so it comes out of a home printer as a single tidy page. `Book another child`
resets the form, the chips and the age band and returns focus to the name field.

## Other behaviour

- **Header island** — the header starts transparent over the hero, then becomes a floating white
  pill inset from the edges once you scroll. The section links highlight as you pass each one.
- **Live opening hours** — `hours()` marks today's row and prints either "Open now, until 18.00" or
  "Closed · opens tomorrow at 8.30", walking the week forward to find the next open day.
- **Counter** — the 94% stat counts up once, when it first scrolls into view.
- **Reveal** — a light pop (fade, 16px rise, faint scale) with a small stagger between siblings.
- **Mobile** — nav collapses into a rounded tray, a sticky dock appears after the hero, and the
  booking card's age buttons drop to a 2×2 grid.
- **Reduced motion** — `prefers-reduced-motion` disables the reveal, the sticker sway, the counter
  and every transition. The timer still works; it simply stops animating.

## Files

```
dental-template-wobble/
├── index.html            markup, including the SVG sprite and all five scenes
├── assets/
│   ├── css/styles.css    15 numbered sections, tokens at the top
│   └── js/main.js        7 numbered modules, each independent
└── README.md
```

## Customising

- **Colour** — the `:root` tokens. Section colours are applied with `block--cream`, `block--sky`,
  `block--butter`, `block--mint`, `block--coral`, `block--white`; a wave divider is a `<svg>` with
  `wave wave--<next section's colour>` as the last child of a section.
- **Prices** — the `.rates` list. `rates__p--free` is the mint pill.
- **Opening hours** — the `week` map in `hours()` uses decimal hours (`8.5` is 8.30). Keep the
  `<dl>` rows in `.hrs` in step with it.
- **Photography** — four portraits and one room shot, all from Unsplash. Each portrait sits on a
  colour with `mix-blend-mode: multiply`, so replacements want plain, evenly lit backgrounds.

Every clinician, price, review and phone number is invented for the demo.
