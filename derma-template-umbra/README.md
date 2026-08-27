# UMBRA — Clínica de Dermatologia, Lisboa

A front-end template for a dermatology practice, built around one idea: **a
clinic website should answer the question the patient arrived with, not list
what the clinic sells.**

Everything above the practical sections is a question in a patient's own words,
answered the way a good consultation answers it — the short answer first, in
one line, and the long one only if you ask for it.

```
derma-template-umbra/
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

No build step, no dependencies, no framework. Open `index.html`, or serve the
folder with anything (`python -m http.server`).

---

## The idea

Ten questions, numbered, in the order people actually ask them:

| | |
|---|---|
| 01 | Is this mole normal? |
| 02 | Will you tell me if it is cancer? |
| 03 | Why has my acne come back at thirty-four? |
| 04 | How long is this going to take? |
| 05 | Is it going to scar? |
| 06 | Do I actually need sunscreen in winter? |
| 07 | Is it contagious? |
| 08 | Can you just look at a photograph? |
| 09 | Will you try to sell me something? |
| 10 | What if I cannot afford it? |

The information architecture *is* the content. There is no services menu,
because a services menu is the clinic's mental model rather than the patient's.

`Umbra` is Latin for shade — which is the first sunscreen, works on everybody,
and has never been out of stock. That is the whole brand argument.

---

## Design

**Warm dark.** The ground is a warm umber (`#15110E`), not a neutral black.
Type is a warm cream, and there is exactly one accent — amber — which is used
for three things and nothing else: the short answer, labels, and anything you
can act on.

```
--night  #15110E   ground
--raise  #1E1815   filled panels
--cream  #F1E8DB   primary type
--dim    #B6A896   secondary type
--amber  #DE9A46   the answer, the label, the action
--clay   #9A6449   quiet marks
--flag   #D2705A   validation failures only
--line   #342C25   hairlines
```

Every pairing clears WCAG AA against the ground; cream is about 15:1, dim and
amber both comfortably above 7:1.

**Two typefaces.** *DM Serif Display* carries every question, every short
answer, the fee figures and the booking sentence. *Karla* carries prose,
labels and controls. Nothing else.

**The silhouette.** One corner is cut off every filled panel — a 16–20px
chamfer via `clip-path`. It is the only ornament in the template and it is
applied nowhere else, so the page has a recognisable shape without a single
gradient, shadow, glow or rounded rectangle.

**Layout.** Each answer is an asymmetric two-column grid: the number, the
question and the short answer on the left; the prose on the right. A fourth,
empty grid row absorbs the slack, which is what keeps a question locked to its
own short answer no matter how long the essay beside it runs.

---

## Behaviour

**Filter the questions.** `What brought you here?` narrows the index live as
you type, matching both the question text and a keyword set carried on each
section (`data-k`). Type `scar`, `seguro`, `melanoma`, `child`, `photo`. The
count updates in words, and an empty result points at the booking note instead
of a dead end.

**Short answer, then long.** The disclosure collapses with
`grid-template-rows: 0fr → 1fr`, so it animates a real height. While shut the
inner wrapper is `visibility: hidden`, which keeps the closed prose out of the
accessibility tree rather than merely clipped.

**Read marks.** A question that has properly been on screen gets a small amber
tick against it in the index — in the hero and in the overlay. Session only,
nothing stored.

**The recall.** One floating chip, bottom left, showing the question you are
in front of. It appears only while an answer is on screen *and* the hero index
is not, so it is never redundant at the top and never sitting on top of the
fee list further down. It opens a full index overlay with focus trapping,
Escape to close, and focus returned to where it came from.

**The booking form is a sentence.** *My name is ⎯⎯, you can reach me on ⎯⎯…*
Each field is a real labelled input with visually hidden label text, and each
one is sized to its contents so the line stays a sentence instead of becoming
a row of boxes. Selects are the awkward case — a browser sizes them to their
longest option, which leaves a rule hanging past the words — so they are
measured against an offscreen ruler and re-measured once webfonts land.
Validation marks the offending gaps and the form is replaced in place by a
confirmation slip.

**Degradation.** With JavaScript off: every long answer is open, the toggle
buttons are hidden, the hero index is still the index, the overlay and recall
stay out of the way, and the form submits as an ordinary form. Nothing is
hidden behind a script.

**Motion.** A single fade-and-rise on entry, cancelled entirely under
`prefers-reduced-motion: reduce`, with a 2.4-second safety net that reveals
anything still in view in case an observer never fires.

**Print.** A dedicated stylesheet drops the chrome, the search, the buttons and
the portrait, forces every long answer open, inverts to black on white, and
keeps answers and panels from breaking across pages. The whole thing prints as
a readable patient-information leaflet.

---

## Everything in here is placeholder

**Nothing in this template is real, and none of it is medical advice.**

- **Clinical content.** The ten answers are written to read like a real
  dermatologist's answers, and the general shape of them is sound — but the
  specifics (twelve weeks to assess acne, five to seven months of
  isotretinoin, UV index 3, twelve to eighteen months of scar remodelling,
  which conditions are transmissible) must be reviewed and signed off by the
  clinician whose name goes on the site. Timelines and thresholds are the sort
  of thing that varies by guideline, country and patient.
- **The practitioner.** *Dra. Inês Salgado Bettencourt*, her training, the
  Ordem dos Médicos number (`céd. 48 219`) and the society membership are all
  invented.
- **The practice.** The address on Rua do Alecrim, the telephone number, the
  email, the opening hours and the transport notes are invented.
- **The fees.** Every euro figure is invented. So are the insurer names as
  applied here (ADSE, Médis, Multicare, AdvanceCare, SAMS are real Portuguese
  schemes; their acceptance by this fictional clinic is not), the student and
  pensioner reduction, and the two held 08.30 appointments.
- **The portrait.** A stock photograph from Unsplash, warmed and dropped with
  a CSS filter so its studio white sits inside the palette. Replace it with
  the real clinician. The filter values in `.who__fig img` will need retuning
  for a different photograph.
- **The form goes nowhere.** Submission is intercepted and answered entirely
  in the browser. Wire it to a real endpoint before it takes a single patient
  detail, and treat everything it collects as health data: consent copy, a
  lawful basis, transport encryption, retention limits, and somewhere secure
  for it to land.
- **Language.** Deliberately mixed — Portuguese for the things a Lisbon clinic
  would say in Portuguese (`Marcações`, `Preços`, `Horário`, `Seguros e
  subsistemas`) and English for the answers. Pick one, or do it properly with
  two locales.
- **Legal links.** `Privacidade`, `Direitos do doente` and `Livro de
  reclamações` are `href="#"`. The last one is a genuine Portuguese legal
  requirement and needs to point at the real thing.
