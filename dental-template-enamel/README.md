# ENAMEL — dental studio template

A loud, confident dental studio site: bone paper, ink black, one safety orange, 2px borders
and hard offset shadows. Built around a four-question **smile check** that tells a visitor
which appointment to book first, and a booking panel that flips over into its own
confirmation.

Static HTML, CSS and vanilla JavaScript. No build step, no dependencies, no framework.
Open `index.html` and it runs.

---

## The design

**Palette.** Four values and nothing else: bone (`#F3F1EC`), a deeper oat (`#E7E4DB`), ink
black (`#111110`) and safety orange (`#FF4A17`). No gradients, no glows, no soft shadows —
every shadow is a solid offset block of the ink colour, so the page reads as printed matter
rather than glass.

**Type.** [Archivo](https://fonts.google.com/specimen/Archivo) at weight 800 with -0.05em
tracking for anything large, and [Space Mono](https://fonts.google.com/specimen/Space+Mono)
at 700 for every label, price tag, timestamp and micro-caption. The mono is the device that
holds the whole thing together: if it is small and uppercase, it is mono.

**Geometry.** Two shapes only. Pills (`border-radius: 100px`) for anything interactive, and
12px-radius blocks for anything containing content. Every one of them carries a 2px ink
border and a 5–8px offset shadow. Buttons physically press: hover slides them 2px into their
own shadow, active slides them the full 5px so the shadow disappears.

**Photography.** Six images, lightly punched (`contrast(1.06) saturate(1.04)`) and framed in
bordered blocks. The hero pair is deliberately rotated a degree or two and overlapped, with
an orange sticker rotated the other way, so the top of the page reads as a pinned-up
collage rather than a slideshow.

---

## Sections

| Section | What it does |
| --- | --- |
| Header | Sticky, pill nav that marks the section you are in, phone number, Book button |
| Hero | Oversized three-line headline, chip row, rotated photo collage, sticker |
| Stat band | Four numbers on black, two of them orange |
| Treatments | Horizontal rail of seven priced cards, draggable, with a progress bar |
| Smile check | The four-question quiz and its recommendation |
| How it goes | Three steps under giant outlined numerals |
| Plans | Three membership cards, the middle one inverted with a rotated flag |
| Team | Four portraits that tilt on hover |
| Reviews | Three quote cards with orange stars |
| Booking | Day strip, time grid, reason chips — flips into the confirmation |
| Questions | Six `<details>` rows with an orange plus that becomes a minus |
| Footer | Giant outlined wordmark, four columns, mono small print |
| Dock | Fixed bottom bar on phones, appears after the hero, hides over the booking form |

---

## The smile check

Four questions, then a recommendation with a price, a duration and three bullet points.

**Questions and answers** live in the `QS` array; **the five possible recommendations** live
in `OUTCOMES`. Each answer carries a short key (`pain`, `dread`, `gums`, `looks`, `colour`…)
and the verdict is a priority ladder over the collected keys rather than a score:

1. `pain` anywhere wins — emergency slot, £40, same day
2. otherwise `dread` — a gentle first visit, £65, nothing treated on the day
3. otherwise `gums` — a hygiene assessment, £75
4. otherwise anything cosmetic — a free 20-minute consultation
5. otherwise the routine check-up, £65

A ladder rather than a score is deliberate: it means pain can never be averaged away by three
cheerful answers, and every outcome is reachable and explainable.

**It hands off to the booking form.** Each outcome names a `reason`, and the quiz clicks the
matching chip in the booking panel when it finishes, so a visitor who scrolls down finds
their answer already selected.

The step counter, progress pips, Back and Start again are all wired. The panel is an
`aria-live="polite"` region, so each new question and the result are announced.

---

## The booking panel

**Days** are generated from today — the next twelve open days, Sundays skipped. Each pill
shows the weekday in mono above the date, and turns black with an orange weekday when
selected.

**Times** are a fixed twelve-slot list. Whether a slot is free comes from a small integer
hash of the day and slot indices, so roughly a third are struck through and greyed, they vary
believably from day to day, and they never shuffle between reloads. Saturdays close after
11:30 automatically.

**The summary line** under the fields restates the choice in mono as you make it, and becomes
the prompt for whatever is still missing.

**On submit** the whole card rotates 180° on the Y axis and lands on a black confirmation
face carrying the date, the clinician, the address, a reference and the number the text will
go to. `visibility` is toggled halfway through the rotation so the hidden face leaves the
accessibility tree, and focus moves to the confirmation heading. `Book another` flips it back
and clears the selections.

---

## Other interactions

**Treatment rail.** Native `scroll-snap` plus pointer-drag on desktop, wheel and swipe
everywhere, arrow keys when the rail has focus, and two nub buttons that scroll exactly one
card. The progress bar tracks `scrollLeft`. The first card lines up with the section heading
while the last bleeds off the right edge, using
`padding-inline: max(gut, (100% - wrap) / 2 + gut)`.

**Reveals.** Fifty-two elements rise 16px on entry, sequenced with `data-delay`. Plain
geometry checks throttled through `requestAnimationFrame`; revealed elements are dropped from
the list and the listener removes itself when the list is empty.

**Reduced motion.** `prefers-reduced-motion: reduce` shows everything immediately, drops
every transition including the card flip, and turns off smooth scrolling.

---

## Files

```
dental-template-enamel/
├── index.html              markup and copy
├── assets/
│   ├── css/styles.css      tokens, layout, components, responsive
│   └── js/main.js          reveals, header, rail, quiz, booking
└── README.md
```

`styles.css` is numbered in comments from tokens through to print.

---

## Customising

**Colours.** All in `:root`. `--orange` is the only accent; changing it re-themes the page.
`--sh` and `--sh-2` control the offset shadow depth, `--bd` the border.

**Prices** appear in the rail cards, the plan cards, the hero chips and the quiz outcomes.
The quiz ones are in `OUTCOMES` in `main.js`; the rest are in `index.html`.

**Quiz.** Add a question by pushing to `QS`; add an outcome by adding to `OUTCOMES` and
extending the ladder in `verdict()`. The progress pips count themselves from `QS.length`.

**Booking.** `TIMES` is the slot list, and `open()` decides availability — swap its body for
a fetch when you have a real diary. `data-form` currently prevents submission; point the
`<form>` at your endpoint and drop the `preventDefault` to make it live, keeping the
validation and the flip as the success state.

**Copy.** All in `index.html`. The studio name appears in the header, the footer wordmark and
`<title>`. ENAMEL, the Sheffield address, the phone number, the people and the reviews are
invented.

---

## Notes

- Tested at 2074px and 390px, plus the 1080px and 700px breakpoints. No horizontal overflow.
- One bug worth knowing about if you extend the form: the nowrap day strip will blow out the
  grid track it sits in unless its ancestors keep `min-width: 0` — `fieldset` also needs
  `min-inline-size: 0`, since the UA stylesheet sets it to `min-content`. Both are in
  section 2 and 16 of the stylesheet.
- Accessibility: one `h1`, ordered headings, a skip link, visible focus rings, `aria-pressed`
  on every chip and pill, `aria-live` on the quiz panel, `aria-expanded` on the mobile
  toggle, Escape closing the menu, and native `<details>` for the questions.
- Fonts come from Google Fonts over two preconnects, with system stacks standing in.
