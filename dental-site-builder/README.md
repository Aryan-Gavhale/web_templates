# dental-site-builder

One row of a spreadsheet in, one finished website out.

```
python fetch.py "<google maps link>"   # fills a row in from Google
python build.py build                  # that row becomes a website
```

Or skip the scraping and type the sheet yourself:

```
python build.py init      # create clients.csv
                          # ...fill it in...
python build.py build     # every row becomes a site in dist/
```

Building 100 sites costs the same as building one. No AI is involved at
build time, so there are no tokens to spend and nothing to review for
hallucinated copy.

---

## The idea in one paragraph

Each template carries a complete set of defaults in
`assets/js/site-config.js`. The builder never touches that file. It
copies the template folder and writes one small extra file,
`assets/js/client.js`, holding only the values from that client's CSV
row. The page loads both and merges them, so **a blank cell in the
spreadsheet means "keep whatever the template already says"**. You only
type what is actually different about this client.

```
site-config.js   full defaults, shipped with the template
      +
client.js        generated from one CSV row  ->  the finished site
```

That is also why the builder is so simple: it never has to read or
rewrite JavaScript, only add a layer on top.

---

## First run

You need Python 3.9 or newer. Nothing to install.

```
cd dental-site-builder
python build.py init
```

That writes `clients.csv` with 104 columns and two filled-in example
rows. Open it in Excel or Google Sheets, delete the examples, and add
your clients. Then:

```
python build.py build
```

Each row becomes `dist/<slug>/`, a complete standalone folder. Open
`dist/index.html` to click through everything you just built.

To rebuild a single client after a correction:

```
python build.py build --only bright-smile-pune
```

To see every column with a one-line explanation:

```
python build.py fields
```

---

## Filling a row from a Google Maps link

`fetch.py` opens the practice's Maps listing in a headless browser, reads
the panel, and writes the row for you.

```
python fetch.py "https://maps.app.goo.gl/AbC123"
python fetch.py --file links.txt --template aurelia
python fetch.py "<link>" --show          # print it, do not write the sheet
python fetch.py "<link>" --photos        # download the photos as well
```

It takes a full Maps URL, a short `maps.app.goo.gl` link, or a plain name
to search for. Rows are matched on `slug`, so re-running updates a
practice instead of duplicating it — and by default it will not overwrite
a cell you filled in by hand. Pass `--overwrite` when you do want that.

**No AI and no API key.** Google Maps builds the place panel in the
browser rather than sending it as HTML, so this drives a real Chromium
and reads the rendered panel — the same thing you would do by hand, minus
the typing. Setup is one-time:

```
pip install playwright
playwright install chromium
```

### What it fills in

Name, address split into two lines, city, phone (both the readable form
and the dial link), rating, review count, exact latitude and longitude,
opening hours in both the display and badge formats, and up to eight
photos. It also prints their own website, which is where you will find
the things Google does not carry.

### What it cannot fill in

Clinician names, bios and headshots are not on Google Maps, and neither
are prices or treatment lists. Those live on the practice's own site.

Because of that, **`fetch.py` switches the clinicians section and the
review quotes off** — if it did not, the template's demo doctors and
invented testimonials would ship on a real prospect's site under their
own logo. The star rating and review count *are* scraped and genuine, so
those stay on the page.

Fill in `team.members.*` and `reviews.items.*` and set the matching
`enabled` cells back to `true`, or pass `--keep-team` if you want the
demo content left in while you show someone the shape of the page.

### Two things to watch

**Paste the link, do not search by name.** A search returns Google's
nearest guess, which for an unlisted practice is a *different* clinic
entirely. The tool compares what you asked for against what came back and
warns you, but the warning is only a heuristic — the link is exact.

**Split shifts are approximated.** A clinic that closes for lunch
("10:30 am to 2:30 pm, 5 to 9:30 pm") keeps the full text in the printed
hours table, but the header badge spans first opening to last closing, so
it reads "open" during the break. Correct `openBadge.*` by hand if that
matters.

Everything it writes is a best guess worth eyeballing — particularly the
city, which is picked out of the address, and the business name, which is
trimmed at the first dash or pipe because listings are often
keyword-stuffed ("Apollo Dental | Best Clinic in Bengaluru | Implants").

---

## Filling in the spreadsheet

### The only two required cells

| Column | Why |
| --- | --- |
| `business.name` | Everything else can be inferred or defaulted. |
| `template` | `arogya`, `enamel` or `aurelia`. Blank means `arogya`. |

`slug` is generated from the business name if you leave it blank, so
"Bright Smile" becomes `bright-smile`. Set it yourself when you want the
folder and URL to read differently.

### The three designs

- **`arogya`** — built for Indian clinics and for a phone. On a handset
  it reads like an app: a bottom action bar with Call, WhatsApp and Book,
  swipeable rails, and a live "Open now" pill. Publishes a ₹ price list
  with filter chips. This is the default.
- **`enamel`** — bold, high-contrast, thick borders and hard shadows.
  Suits a single-location independent practice with personality.
- **`aurelia`** — quiet, editorial, numbered sections and lots of
  whitespace. Suits a larger multi-speciality clinic or hospital.

All three read the same columns, so you can switch a client from one to
the other by changing one cell and rebuilding. Differences worth
knowing: Enamel shows four headline stats and Aurelia shows three;
Aurelia numbers its sections, so its `consult.eyebrow` default is
`03 — Consultation` rather than a phrase; and the `services.*` and
`reviews.items.*` columns only appear on Arogya, so filling them in for
one of the other two designs changes nothing.

### Prices, on Arogya

`services.items.N.*` builds the price list. `category` drives the filter
chips above it, and they build themselves from whichever categories you
actually use — so four rows tagged `General` and two tagged `Braces`
gives you three chips: All, General, Braces. One category means no
chips, because a single filter is a label.

Rupee symbols are fine in the spreadsheet. `Rs 4,500` reads perfectly
well too if your CSV editor makes `₹` awkward.

### Colour

Set `brand.primary` to their brand hex and the entire page re-tones
around it — buttons, links, underlines, the mobile bar, the browser
address bar on Android. Leave `brand.ink` alone unless you have a
reason; it is the near-black used for text and dark panels.

---

## Google Maps

Three ways to place the pin, in order of precision. Use the first one
you can be bothered to collect.

1. **Exact, recommended.** On Google Maps, find the practice, then
   **Share → Embed a map → Copy HTML**, and paste *only* the URL inside
   `src="..."` into `location.mapEmbedUrl`. This pins the real business
   listing rather than a guess at the address.
2. **Coordinates.** Right-click the spot on Google Maps and click the
   latitude/longitude to copy it, then split it across
   `location.mapLat` and `location.mapLng`.
3. **Text search.** Put `Business Name, City` in `location.mapQuery`.
   Fastest to fill in, but Google occasionally lands on the wrong side
   of the street.

`location.mapZoom` defaults to 16, which shows a few surrounding
streets. Lower is wider.

The map is not loaded until the visitor scrolls near it, so a page with
a map still loads as fast as one without. The **Directions** button and
the reviews link are derived automatically — only fill in
`location.directionsUrl` or `location.reviewsUrl` to override them.

---

## Photos and doctor headshots

Both the gallery and the clinician cards accept either a full URL or a
path inside the site folder.

### Pulling photos from their Google Business Profile

Open the practice on Google Maps, click a photo to open it full size,
then right-click → **Copy image address**, and paste that URL straight
into `gallery.images.1.src`. It works immediately with no downloading.

Two cautions. Google's image URLs are not permanent and can rot after
some months, and the photos belong to whoever uploaded them. For
anything you are actually charging for, **ask the client for the files
and host them yourself**:

```
dist/bright-smile-pune/assets/img/clinic-1.jpg
```

and then reference `assets/img/clinic-1.jpg`. Same for headshots in
`team.members.N.image`.

Note that `build.py` replaces the whole site folder on every rebuild, so
put the real photos in the **template's** `assets/img/` folder if you
want them to survive rebuilds — or keep them outside and copy them in as
a last step.

### How many

- **Gallery** — eight slots. The layout is designed around four to six.
  The first photo gets the large tile, so lead with the best one, usually
  reception or the frontage. On phones the gallery becomes a swipeable
  rail. Every photo opens full-screen when tapped.
- **Clinicians** — six slots. Portrait crops look best, roughly 4:5.

Leave `gallery.enabled` or `team.enabled` set to `false` when a client
has no usable photos at all — that removes the whole section cleanly
rather than leaving a gap where broken images used to be. A single
missing image hides itself automatically, so one bad URL will not
visibly break the page.

---

## Opening hours, in two places

This is the one part of the sheet that catches people out. Hours are
entered twice because they are used for two different things.

**`hours.N.days` / `hours.N.time`** is the human-readable table printed
in the footer and beside the map. Write it however it should read:
`Mon-Fri`, `09:30 - 20:00`, `Emergency`, `On call`.

**`openBadge.*`** feeds the live "Open now / Closed" badge in the
header, so it has to be machine-readable: strictly `HH:MM-HH:MM` on a
24-hour clock, like `09:30-20:00`. Leave `openBadge.saturday` or
`openBadge.sunday` blank to mean closed that day.

Get the badge format wrong and it simply falls back to the template
default rather than showing something false.

---

## What the phone layout does

The brief was that a desktop row of three or four cards must not become
a tall column on a phone. It does not. Those rows become **horizontal
swipe rails** with snap points and a row of dots underneath, so a
four-card row stays one screen tall instead of four. This applies to
treatments, plans, clinicians, reviews and the gallery.

Also on phones: a sticky bar appears at the bottom once the visitor is
past the hero, with a call button and a book button, and it politely
hides itself when the booking form is actually on screen. Its wording
comes from `dock.label`, `dock.price` and `dock.cta`.

Form fields are set at 16px specifically so iOS Safari does not zoom in
when a field is focused.

---

## The booking section

It sits in the middle of the page in both templates — after the visitor
knows what you do but before they have to read everything — and pairs
the form with the map and the practice details, so "when can I come" and
"where is it" are answered in one screen.

Above the form are three assurance tiles. The first two are yours to set
via `consult.firstVisitPrice`, `consult.firstVisitNote` and
`consult.responseNote`. Use them for whatever removes the most doubt:
a fixed first-visit price, a callback promise, free parking.

**The form does not submit anywhere yet.** It validates and shows a
thank-you state, which demos correctly, but you must point it at a
form backend (Formspree, Basin, Netlify Forms, or their own endpoint)
before a real client goes live. Search `index.html` for `<form` and set
the `action`.

---

## Selling this at volume

A practical order of work for a cold call:

1. **Before the call**, collect their Maps links into a text file, one
   per line, and run `python fetch.py --file links.txt`. That fills in
   the name, address, phone, coordinates, rating, hours and photos for
   every one of them, so the four minutes of typing per practice becomes
   a few seconds.
2. **Build it** and send them the link. Everything you left blank still
   reads as sensible professional copy, because the template defaults
   are written to be generic rather than placeholder text. There is no
   `Lorem ipsum` and no `[YOUR NAME HERE]` to embarrass you.
3. **After they say yes**, collect the real headshots, hours, prices and
   their brand colour, fill in the rest of the row, and rebuild.

Because a blank cell is always safe, a half-filled row is a sellable
site. That is the whole point of the two-layer design.

---

## Checking a site before you send it

Optional, and worth it before a batch goes out. Requires Node.

```
npm install jsdom
node check.mjs dist/bright-smile-pune
```

It loads the built page in a headless DOM, runs the real hydration code,
and prints what actually reached the screen — the title, the merged
values, how many clinicians and photos rendered, the phone link, the map
URL — plus any JavaScript error. `errors: []` and sensible counts means
that site is fine.

It also catches the mistake worth catching: a row that silently failed
to override something, where you would otherwise post a link showing
another clinic's name.

---

## Going live

Each `dist/<slug>/` folder is plain static HTML, CSS, JS and images with
no build step and no server requirement. Drag it onto Netlify, Cloudflare
Pages, GitHub Pages, or any hosting the client already pays for.

Before invoicing, per site:

- [ ] Point the form at a real backend and send yourself a test enquiry
- [ ] Replace any Google-hosted image URLs with files you host
- [ ] Confirm the map pin is on the right building
- [ ] Check the Open/Closed badge against `openBadge.*`
- [ ] Open it on an actual phone and swipe the rails
- [ ] Read `meta.title` and `meta.description` as if they were a Google
      result, and hand-write them if the generated ones are bland

---

## File map

```
dental-site-builder/
  fetch.py       Google Maps link -> a filled-in row
  build.py       init / build / fields
  clients.csv    your client data (created by init)
  check.mjs      optional headless render check
  dist/          generated sites, safe to delete

dental-template-arogya/     India / mobile-app design (default)
dental-template-enamel/     bold design
dental-template/            editorial design (aurelia)
  index.html
  assets/css/styles.css
  assets/js/site-config.js  full defaults, edit to change all clients
  assets/js/client.js       per-client overrides, generated
  assets/js/site.js         merges the config and fills the page
  assets/js/main.js         animation, menus, sticky bar
```

### Editing without the spreadsheet

For a single one-off site, skip `build.py` entirely: copy a template
folder by hand and edit `client.js`, which is the same file the builder
writes. Only include the keys you want to change.

```js
window.SITE_CLIENT = {
  business: { name: 'Bright Smile', city: 'Pune' },
  contact:  { phoneDisplay: '098765 43210', phoneHref: '+919876543210' }
};
```

Objects merge key by key. Arrays replace wholesale, so listing two
clinicians gives you exactly two, not two layered over the template's
four.

### Changing something for every client at once

Edit the template's `site-config.js`, or its `index.html` for structure.
Every future build inherits the change. Anything a CSV row overrides
still wins.
