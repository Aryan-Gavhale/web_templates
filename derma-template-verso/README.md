# VERSO — Dermatology & Skin Cancer Medicine

A front-end template for a dermatology practice, built as a **broadsheet
newspaper** rather than a website. Newsprint paper stock, hairline column
rules, a Didone masthead, flowed and justified columns, folio numbers, a
running head, dot leaders on the tariff, letters to the editor, and a
tear-out that genuinely prints.

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8961
```

---

## The idea

The practice positions itself as a **publisher**. Australia has the highest
rate of skin cancer in the world and one of the best survival records, and
the difference between those two facts is whether somebody looked in time.
A clinic whose entire argument is *come earlier and read the plain facts*
has a reason to look like a printed paper, so the site is set as one:
Issue No. 41, seven numbered pages, a dateline, and a UV index box where a
newspaper would put the weather.

Every device on the page is a print device. Nothing is a card, a hero
banner, a pill, or a modal.

## Palette

Four values, and one of them is the spot colour.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#EFEAE0` | newsprint stock |
| `--ink` | `#191714` | text, hairlines, heavy rules |
| `--red` | `#B23A2B` | the one spot ink — folios, labels, "you pay", ticks |
| `--rule` | `#C6BEAD` | secondary hairlines and column rules |
| `--wash` | `#E6E0D2` | the tear-out panel only |

No gradients, no glows, no drop shadows, no rounded corners, no dark mode.
Photographs are `grayscale(1) contrast(1.08)`, because newsprint pictures
are halftones.

## Typography

Three families, mixed the way a paper mixes them.

- **Bodoni Moda** (variable `opsz`, `wght`) — masthead, headlines, section
  heads, drop caps, folio letters. A Didone is the correct answer for a
  masthead and the wrong answer for body text.
- **Newsreader** (variable `opsz`, `wght`, italic) — all body copy,
  standfirsts, captions, letters, table figures. Designed for news setting.
- **Oswald** — every piece of furniture: dateline, department labels,
  bylines, folios, box heads, form labels, buttons. Condensed, uppercase,
  tracked.

Body copy is justified with `hyphens: auto` and old-style figures; tables
switch to tabular figures. Below 700px the justification is dropped for
flush left, because a phone column is too narrow to justify without rivers.

## The pages

| Folio | Page | What is on it |
| --- | --- | --- |
| 01 | The lead | Masthead, dateline, contents bar, lead article in two flowed columns with a drop cap, staff photograph, UV index box, "In this issue" |
| 02 | Clinics | Six clinics in a three-column ruled grid, one per fixed day |
| 03 | The examination | Five numbered steps with Tufte-style margin notes, then the tear-out self-examination |
| 04 | Letters | Testimonials set as letters to the editor, signed with initials and suburb |
| 05 | The rooms | The dermatologist, a hairline appointments table, one plate and two standing notices |
| 06 | Tariff | Ten fees with dot leaders, Medicare rebate and out-of-pocket, then four notices |
| 07 | Notices & appointments | The appointment coupon, plus address, hours, transport and held appointments |
| — | Colophon | Contents again, particulars, and what the paper is set in |

## Signature details

**Running head.** No sticky navbar. Once the masthead scrolls away a thin
rule appears carrying the paper's name, the current department, and the
folio number — the way a book marks your place. The department and folio
update from `data-dept` / `data-folio` on each page via
`IntersectionObserver`.

**Press run.** Rules draw left to right (`transform: scaleX`) and type sets
behind them, staggered in document order rather than all at once. There is
no loading screen; a newspaper does not animate in.

**Dot leaders.** The tariff uses a real leader — an absolutely positioned
dotted border starting at the end of the item name and clipped by the cell
— so the eye is carried across to the money columns instead of jumping a
gap. The money columns are fixed width so all the slack goes to the leader.

**Margin notes.** The three footnotes on page three sit in the right margin
at their paragraph, always visible, no interaction required. Below 1180px
they fold down into bordered blocks under the paragraph.

**The tear-out.** The ABCDE self-examination is set between dashed cut
lines with hand-drawn `×` checkboxes (drawn in CSS, not glyphs), a live
count that changes its wording at one tick, and a **Print this page**
button.

**UV index.** Where the weather box goes. Ten hairline bars, the peak hours
in the spot colour, hour labels underneath, and the Cancer Council rule
about index 3 spelled out.

**The coupon.** Booking is a classified coupon, not a wizard: baseline-rule
inputs, "complete in block letters", `×` checkboxes for urgent symptoms.
Ticking one changes both the priority line and the confirmation copy. On
submit the coupon is replaced in place by a "Received" panel.

## It prints

There is a real `@media print` stylesheet. The running head, contents bar
and buttons are dropped, paper goes white and ink black, the lead flows to
three columns, margin notes come inline, the tear-out starts on a fresh
page, and `break-inside: avoid` keeps letters, boxes, clinics and the
coupon from splitting across sheets. `@page { margin: 16mm 14mm }`.

## Accessibility

- Semantic landmarks and a real heading order; tables use `<caption>`,
  `scope`, and `<th>` row headers.
- `prefers-reduced-motion: reduce` disables rule draws, the press-in, the
  UV bars and smooth scrolling.
- Focus is visible everywhere (`2px` spot-colour outline, offset).
- The contents sheet traps nothing but moves focus to Close, closes on
  `Escape`, locks scroll, and returns focus to the Index button.
- The tick count is `aria-live="polite"`; the confirmation panel is
  `role="status"`; the validation notice is `role="alert"`.
- Everything reads and works without JavaScript. Without it, all rules and
  copy are visible immediately, the coupon posts as a normal form, and the
  self-examination is a plain checklist.
- Contrast: ink on paper is roughly 14:1, the spot red on paper roughly
  5.4:1 — both pass AA at the sizes used.

---

## Before this goes anywhere near a real practice

Everything below is invented for the template and **must be replaced**.

- **Clinical figures.** "Two in three Australians by 70", the UV index
  numbers, the sites melanoma favours, and the 6mm threshold are stated in
  the voice of settled public-health advice. Verify every one of them
  against the current Cancer Council and Australasian College of
  Dermatologists guidance, and have a clinician sign off the copy. Do not
  ship medical claims you have not checked.
- **Fees and Medicare rebates.** Every amount in the tariff, including the
  schedule rebates and out-of-pocket figures, is fabricated. Replace with
  current MBS item numbers and amounts.
- **The practitioner.** Dr Amrita Shroff, the AHPRA number, the college
  fellowship, the hospital appointment and the biography are fictional.
- **Practice details.** The Carlton address, phone number, email, hours and
  tram routes are invented.
- **Letters.** All four are written, not received. Real testimonials need
  written consent, and health-practitioner advertising rules in Australia
  restrict testimonials about clinical care — check AHPRA's advertising
  guidance before publishing any.
- **Photographs.** Two Unsplash placeholders (a portrait and a room), hot-
  linked. Licence and self-host your own, and never publish patient images
  without consent.
- **The coupon does not send.** Submission is intercepted in JavaScript and
  rendered locally. Wire it to a real endpoint, and note that symptom ticks
  and free-text make this health information — it needs HTTPS, a lawful
  basis, a privacy notice, and Australian Privacy Principles compliance.
  The three placeholder legal links go nowhere.
- **Issue No. 41** and the dateline are decorative. If you keep the
  conceit, something has to update them.

## Files

```
derma-template-verso/
├── index.html
├── README.md
└── assets/
    ├── css/styles.css
    └── js/main.js
```

No build step, no dependencies, no framework. Two Google Fonts requests and
two images are the only external calls.
