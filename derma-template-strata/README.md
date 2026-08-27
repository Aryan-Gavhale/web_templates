# STRATA — Hudklinik, København

A dermatology practice template built as a **depth atlas of the skin**. The
page is not organised into the usual services / about / contact blocks; it is
organised from the surface downward, because depth is what actually decides
the questions a dermatologist answers — what a lesion is, whether it matters,
what will reach it, and what removing it involves.

There is **not one photograph in the template**. Every illustration — the
vertical section, the lesion, the treatment-depth bars, the Breslow scale — is
drawn in CSS. That is a deliberate choice, not a placeholder: an atlas is line
work and type, and a clinic that refuses cosmetic work has no business
decorating itself with spa stock photography.

```
derma-template-strata/
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

Open `index.html` directly, or serve the folder:

```bash
python -m http.server 8971 --directory derma-template-strata
```

---

## The idea

Everything a dermatologist treats sits somewhere in about four millimetres.
The site takes that literally:

| Section | Depth | What it answers |
| --- | --- | --- |
| Surface | 0.00 mm | the premise, and a section through the skin |
| What you can see | 0.02 mm | self-examination — the ABCDE demonstrator |
| Epidermis | 0.10 mm | the three skin cancers, and what reaches how far |
| Dermis | 0.60 mm | acne, rosacea, eczema, hidradenitis, hair |
| Depth that decides | 3.00 mm | Breslow thickness and surgical margins |
| The clinic · Priser · Aftale | — | the practical half |

A fixed **depth gauge** on the right edge reads out where in the skin the
reader currently is. It is a measuring scale, not a navigation menu: a spine
with minor ticks every 13 px, major ticks carrying millimetre values, a
travelling crosshair, and the current stratum set vertically.

## Palette

Four values and one accent. No gradients, no glows, no shadows, no rounded
corners except where a drawing needs a curve.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#EFF1F0` | ground — cool, not cream |
| `--ink` | `#14191A` | type, heavy rules |
| `--pet` | `#10585F` | petrol — depths, labels, the basement membrane, actions |
| `--line` | `#C6CCCB` | hairlines |
| `--t1`…`--t5` | `#E4E8E7` → `#98A5A4` | flat tint screens standing in for tissue |
| `--mole` etc. | `#6E4A33`, `#3A2418`, `#AD8560` | the only warm values in the file; they exist to draw one mole |

Ink on paper is about 14:1 and petrol on paper about 6:1 — both pass AA
comfortably.

## Type

- **Spectral** — display and body. Set at 200 weight for headings, which is
  the opposite move from the heavy display faces most clinic sites reach for:
  large, light and quiet. Old-style figures in running copy.
- **Jost** — a geometric sans for everything instrumental: depth values,
  labels, table headers, buttons, the gauge. Uppercase and widely tracked, the
  way annotations are set on a scientific plate. Lining figures.

## The four drawings

**The vertical section.** Five tinted bands with a bracketed key. Each stratum
opens, and when it opens *the band itself thickens* — the layer you are
reading about visibly grows. The scale is deliberately broken at 0.10 mm and
says so in the caption, because at true scale the epidermis would be a
hairline.

**The lesion.** An ABCDE demonstrator built entirely from `border-radius`,
flat-colour child blobs and paper-coloured "bites" out of the edge. Mark
Asymmetry, Border, Colour, Diameter or Evolving and the drawn spot changes
accordingly: it goes lopsided, its edge goes ragged, a second and third tone
appear inside it, it grows, and a dashed ring shows where it sat six months
ago. A measuring bracket tracks the spot's width and reads out in millimetres,
and the verdict beneath escalates with the count. There is no photograph of a
mole anywhere in it, so nothing on screen can be mistaken for a diagnosis.

**What reaches how far.** Eight treatments, each with a bar showing how deep
it can actually work, drawn against a common 0–4 mm axis. Emollients get a
1-pixel sliver. That is the point.

**The Breslow scale.** A horizontal 0–4 mm scale with the management
thresholds pinned on it (0.8, 1.0, 2.0) and the axis labels staggered so the
two close values do not collide.

## Behaviour

- Depth gauge tracks scroll, updates its numeric readout, moves its crosshair,
  and drops the unit where no depth applies.
- Plate strata expand and contract; the band height follows.
- The lesion demonstrator, with a live feature list and an escalating verdict.
- The appointment form validates in place, marks the offending cells, and is
  replaced by a confirmation slip on success.
- Below 1080 px the gauge is replaced by a top bar and a full-screen contents
  sheet with focus trapping, Escape to close, and focus return.

Everything degrades. With JavaScript off nothing is hidden, the plate notes
simply sit closed, the form posts as an ordinary form, and the reveal
animations never apply because the hidden state is gated on `html.js`, which
is set by a one-line inline script in `<head>` — so no content is ever painted
and then hidden again.

`prefers-reduced-motion: reduce` collapses every transition and shows
everything immediately. Focus is visible everywhere, at a 2 px petrol outline.

## Printing

`@media print` turns it into a clinic handout: the gauge, bar, buttons and
chips drop out, every stratum's note is forced open, elements are kept off
page breaks, and the appointment form prints as a blank slip somebody can fill
in with a pen.

---

## Before this goes anywhere near a real practice

Everything below is invented to make the template read like a real clinic.
None of it is verified, and several parts of it would be regulated claims.

- **Clinical content is illustrative.** Layer depths, treatment penetration
  depths, the Breslow thresholds and the ABCDE descriptions are written to be
  broadly accurate and readable, not to be a clinical reference. Have a
  dermatologist review every number and sentence before publishing. The page
  says twice that it is not a diagnosis or a treatment plan; keep those notes.
- **Fees are fabricated,** including the claim that gruppe 1 with a referral
  costs nothing. Danish sygesikring rules, the gruppe 1 / gruppe 2 split,
  refund levels and what a speciallæge may charge all need checking against
  current regulation and your own agreement.
- **The practitioner does not exist.** Dr. Mette Krogh Lindhardt, the
  authorisation number, the training history and the society memberships are
  invented. Publishing an unverified authorisation number is a real problem.
- **Practice details are invented** — address, telephone, email, opening
  hours, waiting times, the two held 08.00 slots, the courier schedule, the
  referral pathway to Rigshospitalet, and the five-working-day results
  promise. Every one of those is an operational commitment.
- **The form posts nowhere.** It intercepts submission and renders a
  confirmation client-side. Wire it to a real endpoint before use, and treat
  what it collects as health data: consent, retention, lawful basis, GDPR.
  Danish practices will also need the patient-rights and complaints links in
  the footer to point somewhere real.
- **Danish and English are mixed** deliberately, the way many Copenhagen
  clinic pages are. Have a native speaker check the Danish, and decide whether
  you want a proper language switch rather than a bilingual single page.
- Fonts load from Google Fonts. Self-host them if you would rather not make
  that request, or need to for privacy reasons.
