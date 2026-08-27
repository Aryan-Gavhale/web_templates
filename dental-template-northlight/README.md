# Northlight Dental Hospital — website template

A photography-led template for a dental hospital, built around one idea: the building
itself is the argument. Ten photographs carry the page — a glazed corridor, the waiting
room, reception, a treatment room, the imaging suite, and the clinicians — and the
typography stays quiet enough to let them do it.

Static HTML, CSS and vanilla JavaScript. No build step, no dependencies, no framework.

```
dental-template-northlight/
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  └─ js/main.js
└─ README.md
```

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8772
```

## The design

**Tonal, not complementary.** Where most clinic sites pair a cool blue with a warm
accent, this one stays inside a single cool family: deep petrol (`#0E3138`), a sea green
for small signals (`#2F7A72`), a mist wash, porcelain, and one warm neutral sand for
section rhythm. The only real colour on the page comes from the photographs, and every
one of them is graded the same way (`--pic`) so the set reads as a single shoot rather
than a stock library.

**Light type at large sizes.** One family, Sora, from weight 200 to 500. Headlines are
set at 200 with tight negative tracking; the small labels are 10.5px uppercase with wide
letter-spacing. No serif, no display face, no second family.

**Almost no geometry.** A 2px radius, hairline rules instead of borders and cards,
generous whitespace instead of shadows. There are no gradients or glows anywhere — the
only translucency is the flat veil over the hero and quote-band photographs, which exists
for legibility rather than decoration.

## Page structure

| Section | What it does |
| --- | --- |
| Hero | Full-bleed corridor photograph, live opening state, four key facts |
| Statement | Why the building is shaped the way it is |
| Inside the hospital | Asymmetric photo mosaic with a lightbox — reception, waiting room, treatment room, imaging suite |
| Care | Nine specialities as a numbered price index |
| Quote band | Full-bleed photograph with gentle scroll parallax |
| Clinicians | Four portraits with speciality and remit |
| Standards | Four measured numbers plus accreditation marks |
| Your first visit | Four steps, none of which involve treatment |
| Visiting | Address, transport facts, and a live opening-hours table |
| Appointments | Request form with a summary panel that becomes the confirmation |
| Questions | Six answers in a hairline grid |
| Footer | Large wordmark, four columns, fine rules |

## Interactions

- **Three-stage header.** Transparent at rest over the hero, dark petrol once you start
  scrolling through it, porcelain once the hero is behind you. The middle state exists so
  the fixed bar never collides with hero content on small screens.
- **Lightbox gallery.** Any mosaic photograph opens larger with its caption and a counter.
  Escape closes, arrow keys move, focus returns to the tile you came from, and the page
  behind is scroll-locked.
- **Scroll parallax.** The quote band's photograph drifts against the scroll at roughly
  9% of the band height, computed from `getBoundingClientRect` inside a
  `requestAnimationFrame` guard.
- **Live opening hours.** One `WEEK` table in `main.js` drives the hero kicker, the state
  line on the hours card, and the highlighted row for today. Outside hours it names the
  next opening day.
- **A summary that becomes a confirmation.** The panel beside the booking form restates
  the request in prose as you type, swaps fee and appointment length per speciality,
  changes its note for returning patients, and then extends into a confirmation with a
  reference number on submit.
- **Reveals.** A single gentle fade-and-rise, staggered with `data-delay`, using a manual
  geometry check rather than `IntersectionObserver` so delays stay predictable.

## Accessibility

- Semantic landmarks and a visible skip link.
- The lightbox is a labelled `role="dialog"` with `aria-modal`, keyboard control and focus
  restoration.
- Form errors are announced through a live region and the offending field takes focus.
- The mobile menu reflects state in `aria-expanded` and closes on Escape.
- `prefers-reduced-motion: reduce` disables the parallax, reveals, blinking dot and scroll
  cue, and shows all content immediately.
- Photographs carry descriptive alternative text, and each has a fallback if it fails to
  load.

## Customising

- **Colour.** Every token is at the top of `styles.css` under `:root`. Change `--pine`,
  `--sea` and `--sand` and the whole page follows.
- **Photographs.** Replace the Unsplash URLs in `index.html`. Mosaic tiles need both the
  thumbnail `src` and the larger `data-src` used by the lightbox, plus a `data-cap`.
- **Hours.** Edit `WEEK` in `main.js` — `null` for a closed day, otherwise `[open, close]`
  in whole hours.
- **Fees.** Edit the `FEES` map in `main.js` alongside the prices in the care index.
- **Form.** `submit` is intercepted and handled locally. Point it at your own endpoint to
  make it real.

Photographs are from Unsplash and are placeholders. The hospital, its clinicians, its
address and its published figures are invented for the template.
