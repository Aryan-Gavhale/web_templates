# Ashbourne & Wade — dental practice template

A heritage-practice website for a dental surgery: oat paper, oxblood, arched frames and a
fee list set with dot leaders. Its centrepiece is an interactive tooth chart — you point at
a tooth and the panel tells you what the practice does to it and what it costs.

Static HTML, CSS and vanilla JavaScript. No build step, no dependencies, no framework.
Open `index.html` and it runs.

---

## The design

**Palette.** Warm oat paper (`#F8F3EA` / `#F0E8DA`) against a warm near-black (`#1C1614`),
with oxblood (`#6B1F26`) as the only accent. There is no second accent colour and no
gradient or glow anywhere — every fill is flat, and every divider is a real one-pixel rule.

**Type.** Two families. [Fraunces](https://fonts.google.com/specimen/Fraunces) carries every
headline, price and year, at weight 300–400 with optical sizing on. [Karla](https://fonts.google.com/specimen/Karla)
at weight 300 carries body copy, and at 500 with 0.18–0.22em tracking it carries the small
caps labels.

**Geometry.** Arches. Every photograph sits in a frame with a semicircular top
(`border-radius: 999px 999px 3px 3px`), which is what makes the page read as a period
building rather than a clinic brochure. Everything else is square: 3px radii, hairline
rules, and 3px `double` borders at the top of each ledger.

**Devices carried through the page.** Dot leaders on every priced row. Small-caps labels in
oxblood. A drop cap opening the practice statement. A round `Est. 1908` seal in the footer.
A rubber stamp answering the booking form.

**Photography.** Six images, all pushed through one grade
(`sepia(0.14) saturate(0.8) contrast(1.04) brightness(1.02)`) so a set of stock shots reads
as one commission. Any image that fails to load hides itself and leaves its oat frame
behind, rather than showing a broken icon.

---

## Sections

| Section | What it does |
| --- | --- |
| Masthead | Symmetrical: nav, centred wordmark, nav. Condenses on scroll |
| Hero | Copy left, arched photograph right, four-fact ledger strip below |
| The practice | Drop-cap statement with a smaller arch alongside |
| Tooth by tooth | The interactive chart and its treatment panel |
| Fees | Eleven priced rows with dot leaders, on a double rule |
| Quote | Full-bleed oxblood band |
| Surgeons | Three arched portraits with GDC numbers |
| Since 1908 | Four milestones in a ruled row |
| Visiting | Wide arched photograph, address, travel facts, hours card |
| Appointments | Ledger form that resolves into a stamp |
| Questions | Six answers in a ruled three-column grid |
| Footer | Wordmark, seal, four link columns |

---

## The tooth chart

The signature interaction, and the reason this template exists. It is built in
`assets/js/main.js`, not in the markup.

**How it is drawn.** Thirty-two teeth are placed with trigonometry rather than by hand.
Sixteen sit on the upper arch and sixteen on the lower, each spread across 150° of an
ellipse (`rx: 205, ry: 132`) and rotated to face outward. The 150° span — rather than a full
half-turn — is what makes the two arches read as horseshoes facing each other instead of one
closed ring.

Each position is assigned to a group by `PATTERN`, which runs temple to temple:

```
wisdom · molar · molar · premolar · premolar · canine ·
incisor × 4 ·
canine · premolar · premolar · molar · molar · wisdom
```

Two arches of that give the anatomically correct count: 8 incisors, 4 canines, 8 premolars,
8 molars, 4 wisdom teeth. Tooth widths and heights vary by group, so molars are visibly
broader than incisors.

**How it behaves.** Clicking any tooth selects its whole group: the group fills oxblood, the
chip below turns on, and the panel swaps in the group's name, count, description and priced
treatment list. Each tooth also carries an invisible pad slightly larger than itself, so the
small shapes stay easy to hit on a phone.

**Accessibility.** The SVG is `aria-hidden` and the five chips beneath it are the real
control — ordinary buttons, reachable by keyboard, carrying `aria-pressed`. The panel is an
`aria-live="polite"` region, so a change is announced whichever route triggered it. Nothing
in the chart is the only way to reach information.

**Editing it.** Everything you would want to change lives in the `GROUPS` object at the top
of the chart code — group names, tooth counts, descriptions and the priced rows. The chart
redraws itself from `PATTERN` and `SIZE`; you do not need to touch any coordinates.

---

## Other interactions

**Masthead.** Symmetrical at rest, at 98px tall with the wordmark centred and
`DENTAL SURGEONS · EST. 1908` beneath it. Past 90px of scroll it condenses to 64px, the
wordmark shrinks and the subline collapses. The nav also underlines whichever section you
are currently in.

**Booking form.** Validates a name and at least nine digits of telephone number, then hides
itself and stamps the request: a rotated double-ruled oxblood box with today's date and a
reference number, plus a sentence restating the request in prose — who will be rung, about
what, starting which day, morning or afternoon, and whether they are already a patient. A
returning-patient answer changes the closing line. `Send another request` restores the form.

**Radio buttons** are drawn as small squares that take an ✕ when chosen, in keeping with a
practice that still writes things down.

**Reveals.** Sixty-four elements rise 20px as they enter the viewport, ordered by a
`data-delay` attribute so rows arrive in sequence. The check is a plain geometry test on
scroll, throttled through `requestAnimationFrame`; elements are dropped from the list once
revealed, and the listener removes itself when the list empties.

**Reduced motion.** `prefers-reduced-motion: reduce` shows everything immediately, drops all
transitions and turns off smooth scrolling.

---

## Files

```
dental-template-ashbourne/
├── index.html              markup and copy
├── assets/
│   ├── css/styles.css      tokens, layout, components, responsive
│   └── js/main.js          reveals, masthead, drawer, chart, booking
└── README.md
```

`styles.css` is ordered and numbered in comments, from tokens through to print, so a section
is quick to find.

---

## Customising

**Colours.** All in `:root`. `--ox` is the accent, `--paper` and `--oat` the two backgrounds,
`--ink` the text and footer, `--line` and `--line-2` the rules. Changing `--ox` alone
re-themes the page.

**Photographs.** Six `<img>` tags, all Unsplash URLs. Swap the `src` and the `alt`; the arch
frame, the aspect ratio and the grade are applied by CSS, so any reasonably tall crop works.
The grade is the `--pic` token.

**Prices.** In two places, deliberately: the fee list in `index.html`, and the per-group
lists in the `GROUPS` object in `main.js`.

**Copy.** All in `index.html`. Practice name in the masthead, footer wordmark, stamp and
`<title>`. The name `Ashbourne & Wade`, the address, the telephone number, the GDC numbers
and the people are invented.

**Form.** `data-form` currently prevents submission and stamps locally. To make it real,
point the `<form>` at your endpoint and remove the `preventDefault` — the validation and the
stamp can stay as the success state.

---

## Notes

- Tested at 2074px, 1440px and 390px. No horizontal overflow at any of them.
- Fonts come from Google Fonts over two preconnects; Georgia and the system sans stand in
  while they load.
- Accessibility: one `h1`, ordered headings throughout, a skip link, visible focus rings,
  `aria-pressed` on the chart chips, a live region on the chart panel, `aria-expanded` on the
  mobile toggle, and Escape closing the drawer.
- The date input renders in the visitor's locale, so it will show `mm/dd/yyyy` on a US
  machine and `dd/mm/yyyy` on a British one. The confirmation always spells the day out.
