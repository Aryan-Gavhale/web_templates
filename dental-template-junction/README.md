# Junction Dental — a dental practice drawn as a transit network

A tenth dental template, and a deliberately different one. Instead of the usual
hero-plus-services layout, the whole practice is presented as a **wayfinding system**: four
colour-coded routes, an interchange where two of them meet, a departure board, a fares table
and a live service-status board.

The idea behind it is a real one. Most people who say they are frightened of the dentist are
really saying they do not know what happens next. So the site's central promise —
*every appointment, mapped before you sit down* — is delivered literally, by a map.

```
dental-template-junction/
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

No build step, no dependencies. Open `index.html`, or serve the folder:

```bash
python -m http.server 8113
```

## The design system

**Signage, not decoration.** Colour carries meaning here rather than mood: each of the four
treatment routes owns a colour, and that colour then appears wherever the route is mentioned —
in the map, on the departure board, on the fare plates, on a clinician's badge, in the booking
confirmation. Nothing is coloured for the sake of it.

| Token | Value | Used for |
| --- | --- | --- |
| `--plate` | `#F6F4EF` | Page ground, enamel-plate white |
| `--ink` | `#14181F` | Type, rules, board panels |
| `--g` | `#157A4C` | Routine route |
| `--b` | `#0B5AA6` | Restore route |
| `--a` | `#E6960A` | Straighten route |
| `--r` | `#D42D22` | Replace route |
| `--amber-l` | `#F2B233` | Board times, on dark only |

**Type** is one superfamily, the way a real signage system would be specified: Barlow
Condensed for headings and board times, Barlow Semi Condensed for labels and station names,
Barlow for body copy. Headings are uppercase and tightly leaded; labels are uppercase with
wide tracking.

**Geometry** is pill-based throughout — round line caps, 999px buttons, 20–28px panel radii —
which is what stops a four-colour palette from reading as a warning sign. Rules are 2px and
solid rather than hairline.

## Sections

| # | Section | What it does |
| --- | --- | --- |
| — | Hero | Proposition, plus a live departure board of today's clinics with status pills and a running station clock |
| 01 | The map | The signature graphic. Four routes, one interchange each side, every stop selectable |
| 02 | Plan a journey | Four plain-language starting points that resolve into a full itinerary |
| — | Plate | One wide practice photograph in a bordered plate |
| 03 | Fares | Private fees and NHS bands, grouped by route |
| 04 | Service information | Per-route status board plus opening hours, with one live row |
| 05 | Crew | Four clinicians, each badged with the route they run |
| 06 | Notices | Six signage-style notices with pictograms |
| 07 | Book | Form that resolves into a departure-board confirmation row |

## The map

Hand-plotted SVG on a 1200 × 540 grid. Four horizontal lines leave a single rounded
**interchange box** (`Consultation`) at the left, each with four intermediate stops and a
terminus. Two genuine interchanges are drawn with a vertical connector between the lines they
join:

- **X-rays** — served by Routine and Restore
- **Review** — served by Straighten and Replace

Stops are white rings with a thick ink stroke; termini are larger. Each stop is a
`role="button"` group with an invisible 26px hit circle, so the target is comfortable even
though the ring is small.

Interactions:

- **Click or Enter** on a stop selects it and fills the ring; the information plate below
  shows what happens there, the chair time, the fare, and which routes serve it.
- **Arrow keys** walk along the current route rather than through the DOM, which is how a map
  should behave. The selection wraps at both ends.
- **Route filter** chips dim everything that is not on the chosen route — lines, route names,
  stops and interchange connectors all fade to 14–22% — and select that route's first stop.
- The selected stop is announced through a live region, and every stop carries an
  `aria-label` that states its route and position ("Restore route, stop 4: Treatment").

On narrow screens the map becomes a horizontally scrollable panel with a 1000px minimum
width, which is exactly how you read a network map on a phone. A hint line appears below the
filters at that size.

## Other behaviour

- **Station clock** — real time, ticking, in the board header. Tabular numerals so it does not
  jitter.
- **Journey planner** — choosing one of four starting points builds the itinerary from the
  same route data the map uses: every stop with its one-line summary, the summed chair time,
  and a fare range. It also filters the map to that route and pre-selects the route in the
  booking form, so the three components stay in agreement.
- **Live service status** — the first row of the status board is computed from the opening
  hours: open now with a closing time, closed but opening later this morning, or closed with
  the next opening day named.
- **Booking** — validated client-side, then the form is replaced by a departure-board row
  carrying the reference, the time band, the route colour and the date. "Change something"
  returns you to the form with its values intact.
- **Reveal** — a small translate-and-fade on scroll, staggered between siblings, and entirely
  disabled under `prefers-reduced-motion`.

## Editing it

**Routes and stops** live in one place: the `LINES` and `STOPS` objects at the top of
`assets/js/main.js`. `LINES` gives each route its name, colour letter, chip class, fare range
and ordered stop list; `STOPS` holds each stop's name, one-line summary, description, chair
time and fare. The information plate, the keyboard walk and the planner itinerary are all
driven from these, so adding a stop means adding an entry and a marker group in the SVG.

**Adding a stop to the map** — copy an existing `.stop` group, set `data-stop` to the new id,
`data-line` to the routes that serve it, and place the `hit` circle, `ring` circle and `slab`
label at the new coordinates. Labels sit 28px above the line for the top two routes and 38px
below for the bottom two.

**Recolouring a route** — change the one custom property (`--g`, `--b`, `--a`, `--r`). The
line, the route name, the chips, the board markers, the pictograms and the itinerary markers
all follow.

**Hours** — the `week` array in `status()`, indexed from Sunday, as `[open, close]` in whole
hours, with `null` for a closed day. Keep the `Hours` table in the markup in step with it.

## Notes

Every name, fee, GDC number and status in here is invented, and the photographs are from
Unsplash. The status board, the clock and the booking reference are demonstrations rather than
a real diary integration — the form has no back end and never leaves the page.
