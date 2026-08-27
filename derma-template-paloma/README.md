# PALOMA — Dermatología, Roma Norte

A front-end template for a dermatology practice, built around one idea: **the page
holds a single flat colour at a time, and that colour changes as you scroll.**

Not a variation on the other two derm templates in this workspace. `derma-template-sera`
is quiet porcelain and editorial serif; `derma-template-calibre` is near-black and
instrument-grade. This one is saturated, warm and architectural — colour is the
structure, not the decoration.

```
derma-template-paloma/
├─ index.html
├─ assets/
│  ├─ css/styles.css
│  └─ js/main.js
└─ README.md
```

No build step, no dependencies. Open `index.html`, or serve the folder:

```bash
python -m http.server 8955
```

---

## The idea

Luis Barragán, applied to a clinic. Large planes of flat saturated colour, hard edges,
generous emptiness, and light doing the work that shadows usually do. Every section is
a **room** with its own palette; scrolling past its midpoint repaints the whole page —
background, text, rules, navigation — in that room's colours.

Two shapes are allowed anywhere in the design: **the rectangle and the circle.** No
rounded corners between the two, no arches, no pills.

There are no gradients, no glows, no drop shadows and no blur, at any breakpoint.

### The rooms

| Room  | Background | Text on it | Used for |
|-------|-----------|------------|----------|
| cal   | `#F5EEE2` | ink        | hero, phototype, treatments, questions |
| rosa  | `#E86A80` | ink        | the numbers band |
| ocre  | `#EBA83F` | ink        | method |
| lila  | `#A192D6` | ink        | the practice and the doctor |
| terra | `#A8462F` | cream      | patient voices |
| tinta | `#1E1917` | cream      | booking, footer |

Every pairing clears WCAG AA for the text size it carries. The active room also
rewrites `<meta name="theme-color">`, so mobile browser chrome moves with the page.

The five treatment slabs carry their own colours independently of the room system,
because they scroll as a stack rather than as sections.

### Type

- **Bricolage Grotesque** (variable: `opsz`, `wdth`, `wght`) for everything structural.
  Slightly narrowed at display sizes, tight tracking, heavy weight.
- **Figtree** for body copy, labels and interface text.
- No monospace anywhere — that is Calibre's voice, not this one.

Section numbers are Spanish ordinals (*Uno, Dos, Tres…*), which is how a CDMX practice
would label them.

---

## Sections

1. **Hero** — three-line headline, revealed by a coloured block wiping across each line
   in turn. Circular portrait crop with an ochre disc behind and a lilac disc in front.
2. **Numbers** — four counters that animate once, on the rosa field.
3. **Uno · Phototype** — a Fitzpatrick I–VI selector. Six flat swatches; picking one
   repaints the plate and rewrites four guidance rows (sun, lasers, pigment, screening).
   Keyboard-navigable with arrow keys, wired as a proper tablist.
4. **Dos · Care** — five treatments as sticky slabs that stack into a deck as you scroll,
   each a full-bleed colour plane with its own price.
5. **Tres · Method** — four steps in outlined circles.
6. **Cuatro · Practice** — the dermatologist in a circular crop, credentials as ruled
   rows, then two clinic photographs and one flat colour statement panel.
7. **Cinco · Voices** — one large pull-quote at a time on burnt sienna, auto-advancing
   every 6.5 s, with arrows and dot indicators. Auto-advance stops on any manual move.
8. **Seis · Questions** — accordion, one open at a time, `+` rotating 135° to `×`.
9. **Siete · Book** — a four-step wizard (concern → phototype → timing → contact) with
   a progress bar, per-step validation, and an in-place confirmation that echoes the
   three choices back.
10. **Footer** — the wordmark at display size, four columns, legal bar.

## Motion

- **Curtain**: three coloured planes lift off the stage in sequence on load, then the
  hero headline wipes in. Pure CSS, so it still resolves if JavaScript never runs.
- **Room changes** cross-fade `background-color` and `color` over 0.85 s. Everything
  else inherits `currentColor` or is mixed from it with `color-mix()`, so rules,
  borders and tags recolour for free.
- Reveals, counters, meters and the room observer all run on `IntersectionObserver`;
  there is no scroll handler on the page at all.

## Accessibility

- `prefers-reduced-motion: reduce` removes the curtain, the headline wipe, the reveals
  and the quote auto-advance, and un-sticks the treatment slabs into a plain stack.
- Phototype selector is a real `tablist`/`tab`/`tabpanel` with arrow-key movement and
  a live region on the panel.
- The accordion, wizard and menu all report state through `aria-expanded` /
  `aria-hidden` / `aria-current`.
- Focus is visible everywhere via a 3 px `currentColor` outline, which stays legible in
  all six rooms.
- The fixed wordmark sits on a bar filled with the current room colour, so text never
  scrolls underneath it — invisible by design, but it stops the collision.
- Without JavaScript: every section renders in the cream palette, all copy is present,
  the wizard degrades to a long form, and nothing is hidden behind an interaction.

---

## Placeholder content — replace before use

Everything below is invented for the template and must be swapped out.

- **The practice.** "Paloma", Dra. Renata Villalba, cédula 8471203, Calle Colima 214,
  the telephone number, the email and the 2017 founding date are all fictional.
- **The prices.** The MXN figures are illustrative.
- **The clinical guidance.** The Fitzpatrick text, the laser and wavelength notes, the
  screening intervals and the answers in the questions section are plausible but
  **not medical advice and not reviewed by a clinician.** Any real deployment needs
  this written or signed off by the practising dermatologist, and the claims about
  turnaround times, insurers and appointment holds need to be true.
- **The testimonials.** Written for the template. Real patient quotes need consent,
  and most jurisdictions regulate what a medical practice may publish.
- **The photographs.** Hot-linked from Unsplash for preview only. Licence and host
  your own, and use images of your actual clinic and staff.
- **The form.** The wizard validates and then renders a confirmation panel locally.
  Nothing is transmitted. Wire it to a real endpoint, and note that appointment
  requests carry health information — you need consent language, transport security
  and a retention policy before it goes live.
- **Legal.** Aviso de privacidad, términos and the cédula link go nowhere.
