# Muskaan Dental Hospital — brand-led template

A landing page for an Indian multi-centre dental hospital, built around a visible brand
identity rather than photography. Static HTML, CSS and vanilla JavaScript. No build step,
no dependencies — open `index.html` or serve the folder.

## The idea

An Indian dental chain sells trust before it sells dentistry, and it sells it in a specific
language: fixed prices, no-cost EMI, NABH accreditation, walk-ins welcome, a WhatsApp number
that a real dentist answers. The page is written in that voice, in rupees, with Indian digit
grouping (`3.2 lakh`, `₹1,50,000`), and it carries a Hindi toggle because that is how the
front desk actually talks.

"Brand-led" here means the identity does the visual work: a tooth monogram used at four
sizes, a three-colour system applied consistently to cards, badges and monograms, sticker
badges pinned at slight angles, and a repeating monogram tile in the footer. Where the other
templates lean on photographs, this one leans on colour blocks, icons and initials.

## Identity

| Token | Value | Used for |
| --- | --- | --- |
| Brand magenta | `#D92B6B` | Primary actions, logo mark, 5-star bar, prices |
| Mint | `#0FB89E` | Second accent, "₹0 interest", centre tags, confirmation tick |
| Marigold | `#FFC24B` | Badges, headline underline, footer headings, slider thumb |
| Plum ink | `#2B0F1E` | Type, dark cards, footer, emergency card |
| Blush cream | `#FFF6F2` | Alternating section bands, form panel |
| WhatsApp green | `#1FA855` | WhatsApp actions only, never decoration |

Type is **Plus Jakarta Sans** (400–800) throughout, with **Baloo 2** carrying every
Devanagari string. Geometry is deliberately round — 16px, 26px and 34px radii plus full
pills — which is what separates it visually from the squarer templates in this set.

Flat colour only. No gradients, no glows, no drop shadows except a 1px hairline ring on
sticker badges.

## Structure

1. **Utility strip** — opening hours, accreditation, phone, language toggle
2. **Header** — monogram, wordmark, nav with scroll-spy, booking pill
3. **Hero** — rating pill, headline with marigold underline, dual CTA, three trust figures, photo with three sticker badges
4. **Accreditation strip** — NABH, DCI, ISO 9001, languages spoken
5. **The Muskaan promise** — four cards, one per brand colour
6. **Treatments** — eight cards with line icons and `from ₹` pricing, including a dark 24×7 emergency card
7. **No-cost EMI** — interactive calculator on a full-bleed magenta band
8. **Google rating** — 4.8 summary plus an animated star-distribution breakdown
9. **Inside a centre** — three captioned photographs
10. **Our dentists** — monogram cards instead of portraits
11. **Centres** — city filter over eight branch cards
12. **Patient stories** — three review cards with initials avatars
13. **Booking** — validated call-back form with a contact, insurance and camps sidebar
14. **Questions** — six-card grid ending in a WhatsApp prompt
15. **Footer** — brand block over a monogram tile, four link columns
16. **Floating actions** — call and WhatsApp buttons, the Indian web convention

## Interactions

- **EMI calculator** — pick a treatment, drag the tenure slider, and the monthly figure, total and tenure update live. Formatted with `toLocaleString('en-IN')`, so ₹1,50,000 groups the Indian way.
- **Language toggle** — swaps every element carrying `data-hi` between English and Hindi, sets `<html lang>`, switches those strings to Baloo 2 and drops the uppercasing that would otherwise mangle Devanagari matras.
- **City filter** — filters the branch grid and announces the result through a live region.
- **Rating bars** — each bar fills to its share when it scrolls into view.
- **Booking form** — validates name and a 10-digit mobile inline, then covers the form with a confirmation that repeats the centre, the treatment and the day in plain words, with a reference number.
- **Scroll reveal** — a short rise-and-settle on a slightly overshooting curve, staggered by `data-delay`.
- **Scroll-spy nav**, animated hamburger, full-screen drawer that closes on Escape, on link click, and when the viewport widens past the breakpoint.

## Accessibility

Semantic landmarks and one `h1`. The language button is a real `aria-pressed` toggle. The
tenure slider is a native `range` with a visually hidden label. Filter results and form
errors are announced through live regions. Star ratings carry text alternatives. Icons are
`aria-hidden`, decorative photographs have descriptive `alt` text, focus is visible on every
control, and `prefers-reduced-motion` disables the reveals, the pulsing dot and the sticker
tilts.

## Files

```
dental-template-muskaan/
├── index.html
├── assets/
│   ├── css/styles.css
│   └── js/main.js
└── README.md
```

## Customising

- **Colours** — the six tokens at the top of `styles.css`. Swapping `--brand` alone re-skins the page; the tinted variants (`--brand-tint`, `--mint-tint`, `--sun-tint`) are the light card fills.
- **Prices** — hard-coded in the treatment cards, and in `data-cost` on the EMI chips. Keep the two in step.
- **Centres** — copy a `.br` article and give it a `data-c` city key, then add a matching chip to `[data-city]`.
- **Hindi strings** — add `data-hi="…"` to any element. The script captures the English text at load, so nothing else is needed.
- **Dentists** — the monogram colour cycles through `.doc`, `.doc--mint`, `.doc--sun`, `.doc--dark`.
- **Images** — three Unsplash URLs in `index.html`. Each has a `data-img` hook that swaps in a blush placeholder if the image fails.
