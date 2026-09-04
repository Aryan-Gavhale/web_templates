# AROGYA

A dental landing page for Indian clinics. Designed for a phone first —
on a handset it reads like an app, with a bottom action bar, swipeable
rails and tap targets sized for thumbs. On a desktop the same markup
opens out into a wide two-column layout.

Nothing is built, bundled or compiled. Three files, no dependencies
beyond one CDN script that the page works fine without.

```
index.html
assets/css/styles.css
assets/js/site-config.js   <- the only file you normally edit
assets/js/client.js        <- written by the bulk builder
assets/js/site.js          <- shared hydration, identical in every template
assets/js/main.js          <- animation and interaction
```

## Editing one site by hand

Open `assets/js/site-config.js` and change the values. Every section is
commented. Leave a value as `''` to keep what the template ships with,
and set a section's `enabled: false` to remove it from the page.

The only field that needs care is `openBadge`, which drives the live
"Open now" pill. It has to be strict 24-hour `HH:MM-HH:MM`, because it
is parsed rather than printed. An empty string means closed that day.

```js
openBadge: {
  weekdays: '09:30-20:30',
  saturday: '09:30-19:00',
  sunday:   ''              // closed Sundays
}
```

## Building many sites

This template is registered with `../dental-site-builder` as `arogya`,
and it is the default. Put `arogya` in the `template` column of
`clients.csv`, or leave the cell blank.

```
cd ../dental-site-builder
python fetch.py "<google maps url>"   # fills a row from their listing
python build.py build
```

## What is specific to India

- Prices are on the page rather than behind an enquiry form, because
  that is the first thing patients compare. `services.items` drives the
  list, and `category` builds the filter chips above it — reuse the same
  few words across rows and they group themselves.
- WhatsApp sits beside the phone number everywhere, including the bottom
  bar. Leave `contact.whatsapp` blank and every WhatsApp button removes
  itself rather than leaving a dead link.
- No-cost EMI and cashless insurance have their own slots, in the price
  list footnote and the FAQ.
- The team section mentions which languages are spoken.

## Before you send one to a client

The template ships with demo content so a half-filled config still looks
like a finished page. Most of it is harmless, but some defaults make
claims of fact, and those need to be true of the actual clinic or
replaced. `fetch.py` already switches off the two worst offenders —
clinicians and review quotes — because Google cannot tell us either.

Check these:

| Field | Why |
| --- | --- |
| `services.footnote` | Promises no-cost EMI and cashless insurance |
| `trust.items` | Sterilisation, pricing and language claims |
| `faq.items` | Answers about EMI, insurance and walk-ins |
| `consult.firstVisitPrice` / `responseNote` | A price and a callback promise |
| `openBadge.closedNote` | Says only "Closed right now" by default; keep it that way unless an emergency line really is answered |
| `business.openNote` | The "Open all 7 days" chip in the hero |

The booking form has no backend. It validates and shows a confirmation
panel, which is enough for a demo, but point the `<form>` at something
real before the clinic starts taking appointments through it.

## Animation

Scrolling is smoothed by [Lenis](https://github.com/darkroomengineering/lenis),
loaded from a CDN at the end of `index.html`. If that request fails the
page falls back to native scrolling and everything else still works.

`main.js` wraps each feature in its own try/catch and adds the `anim`
class to `<html>` before hiding anything, so a script error cannot leave
a section invisible. There is also a four-second failsafe that reveals
everything regardless. `prefers-reduced-motion` disables the lot.
