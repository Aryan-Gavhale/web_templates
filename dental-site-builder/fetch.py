#!/usr/bin/env python3
"""
fetch.py — turn a Google Maps link into a filled-in clients.csv row.

    python fetch.py "https://maps.app.goo.gl/AbC123"
    python fetch.py "Clove Dental FC Road Pune"
    python fetch.py --file links.txt --template aurelia
    python fetch.py "<link>" --photos          # also download the photos

Accepts a full Maps URL, a short maps.app.goo.gl link, or just a name to
search for. Writes straight into clients.csv, so the next step is:

    python build.py build

No AI and no API key. Google Maps renders the place panel in the browser,
so this drives a real headless Chromium and reads the panel — the same
thing you would do by hand, minus the typing.

What it can fill in
    name, address, city, phone, website, rating, review count,
    latitude/longitude, opening hours (both display and badge formats),
    and up to eight photos

What it cannot
    Clinician names, bios and headshots are not on Google Maps. Those
    live on the practice's own site, and the website column tells you
    where to look.

Requires Playwright:
    pip install playwright && playwright install chromium
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

from build import COLUMNS, CSV_PATH, slugify

HERE = Path(__file__).resolve().parent

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36")

DAYS = ("monday", "tuesday", "wednesday", "thursday", "friday",
        "saturday", "sunday")
SHORT = {"monday": "Mon", "tuesday": "Tue", "wednesday": "Wed",
         "thursday": "Thu", "friday": "Fri", "saturday": "Sat",
         "sunday": "Sun"}

# Google pads times with narrow no-break spaces and en dashes.
def clean(text: str | None) -> str:
    if not text:
        return ""
    return (text.replace("\u202f", " ").replace("\u2009", " ")
                .replace("\u2013", "-").replace("\u2014", "-")
                .replace("\xa0", " ").strip())


# ---------------------------------------------------------------------------
# Extraction, run inside the page
# ---------------------------------------------------------------------------
EXTRACT_JS = r"""
() => {
  const q  = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const attr = (s, a) => { const e = q(s); return e ? e.getAttribute(a) : null; };

  /* The place panel is a <div role="main"> whose aria-label is the place
     name. More reliable than <h1>, which reads "Results" when you arrive
     by clicking a search result. */
  const pane = qa('div[role="main"]').find(d => d.getAttribute('aria-label'))
            || q('div[role="main"]');
  const name = pane ? pane.getAttribute('aria-label') : null;

  const itemText = (id) => {
    const el = q(`button[data-item-id="${id}"], a[data-item-id="${id}"]`);
    return el ? (el.getAttribute('aria-label') || el.textContent || '').trim() : null;
  };

  /* Rating and count. Try the compact block first, then any aria-label
     that spells it out, so a class rename does not take us down. */
  let rating = null, reviews = null;
  const nice = q('div.F7nice');
  if (nice) {
    const m = nice.textContent.replace(/\s/g, '').match(/([\d.]+)\(([\d,.]+)\)/);
    if (m) { rating = m[1]; reviews = m[2]; }
  }
  if (!rating) {
    const el = qa('[aria-label]').find(e =>
      /[\d.]+\s*stars?/i.test(e.getAttribute('aria-label') || ''));
    if (el) {
      const l = el.getAttribute('aria-label');
      const r = l.match(/([\d.]+)\s*stars?/i);
      const c = l.match(/([\d,.]+)\s*reviews?/i);
      if (r) rating = r[1];
      if (c) reviews = c[1];
    }
  }

  /* Opening hours. Google labels each day for screen readers as
     "Friday, 11 am to 7:30 pm, Copy open hours", which survives the
     class-name churn far better than table cell positions do. */
  const days = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];
  let hours = qa('[aria-label*="Copy open hours"]').map(el => {
    const m = (el.getAttribute('aria-label') || '')
                .match(/^\s*([A-Za-z]+)\s*,\s*(.+?)\s*,\s*Copy open hours/i);
    if (!m) return null;
    const day = m[1].toLowerCase();
    return days.includes(day) ? { day, time: m[2] } : null;
  }).filter(Boolean);

  /* Fallback: read the table, skipping the review histogram which is
     also built from <tr> but whose first cell is a star count. */
  if (!hours.length) {
    hours = qa('table tr').map(tr => {
      const c = [...tr.querySelectorAll('td, th')].map(x => x.textContent.trim());
      if (c.length < 2) return null;
      const day = c[0].toLowerCase().replace(/[^a-z]/g, '');
      return days.includes(day) ? { day, time: c[1] } : null;
    }).filter(Boolean);
  }

  /* Deduplicate: a day can appear both collapsed and expanded. */
  const seen = new Set();
  hours = hours.filter(h => !seen.has(h.day) && seen.add(h.day));

  /* Photos. Skip reviewer avatars (/a/ paths) and anything served at
     thumbnail size. Strip the size suffix so we can ask for a big one. */
  const photos = [...new Set(
    qa('img').map(i => i.src).filter(s =>
      s && s.includes('googleusercontent.com')
        && !s.includes('/a/')
        && !s.includes('/a-/')
        && !/=w[1-9]?\d-h[1-9]?\d/.test(s)
    ).map(s => s.split('=')[0])
  )];

  const phoneEl = q('button[data-item-id^="phone:tel:"]');

  return {
    name,
    category: (q('button[jsaction*="category"]') || {}).textContent || null,
    address:  itemText('address'),
    phoneRaw: phoneEl ? phoneEl.getAttribute('data-item-id') : null,
    /* aria-label keeps the spacing a human would dial: "Phone: 040 3824 5728" */
    phoneLabel: phoneEl ? phoneEl.getAttribute('aria-label') : null,
    website:  attr('a[data-item-id="authority"]', 'href'),
    plusCode: itemText('oloc'),
    rating, reviews, hours, photos,
    url: location.href,
  };
}
"""


# ---------------------------------------------------------------------------
# Parsing what the page gave us
# ---------------------------------------------------------------------------
def parse_latlng(url: str) -> tuple[str, str]:
    """Maps keeps the viewport centre in the URL as /@lat,lng,zoom."""
    m = re.search(r"/@(-?\d+\.\d+),(-?\d+\.\d+)", url or "")
    if m:
        return m.group(1), m.group(2)
    m = re.search(r"!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)", url or "")
    return (m.group(1), m.group(2)) if m else ("", "")


def tidy_name(raw: str | None) -> str:
    """
    Business listings are often keyword-stuffed:
        "Apollo Dental, Koramangala | Best Dental Clinic in Bengaluru | Implants"
    Keep the part before the first pipe or bullet.
    """
    name = clean(raw)
    # " - " usually separates the brand from the branch
    # ("Clove Dental Clinic - Model Colony, Pune"). The brand is what
    # belongs in a site header; the branch is already in the address.
    for sep in ("|", "·", " - ", " — "):
        if sep in name:
            name = name.split(sep)[0].strip()
            break
    return re.sub(r"[,\s]+$", "", name)


def split_address(raw: str | None) -> tuple[str, str, str, str]:
    """Return (line1, line2, city, full). Best-effort, worth eyeballing."""
    full = clean(raw)
    full = re.sub(r"^Address:\s*", "", full, flags=re.I)
    if not full:
        return "", "", "", ""

    parts = [p.strip() for p in full.split(",") if p.strip()]
    if len(parts) == 1:
        return parts[0], "", "", full

    # A bare street number on its own line reads oddly, so pull the road in.
    if re.fullmatch(r"[\d/\-]+", parts[0]) and len(parts) > 2:
        line1 = f"{parts[0]}, {parts[1]}"
        rest = parts[2:]
    else:
        line1 = parts[0]
        rest = parts[1:]
    line2 = ", ".join(rest)

    # India: the tail is "<State> <6-digit PIN>", so the city sits before it.
    city = ""
    for i, part in enumerate(parts):
        if re.search(r"\b\d{6}\b", part) and i > 0:
            city = parts[i - 1]
            break
    if not city:
        # UK/US: tail is often "<City> <postcode>".
        tail = parts[-1]
        m = re.match(r"^([A-Za-z .'-]+?)\s+[A-Z0-9]{2,4}\s?[A-Z0-9]{3}$", tail)
        city = m.group(1).strip() if m else (parts[-2] if len(parts) >= 2 else tail)

    return line1, line2, city, full


def parse_phone(raw: str | None, label: str | None, lat: str) -> tuple[str, str]:
    """
    data-item-id is digits only ('phone:tel:08050027075'); the aria-label
    keeps the spacing ('Phone: 040 3824 5728'). Prefer the readable one for
    display and the bare digits for the dial link.
    """
    if not raw:
        return "", ""
    digits_only = clean(raw.split("phone:tel:")[-1])
    pretty = re.sub(r"^Phone:\s*", "", clean(label), flags=re.I)
    number = pretty if re.search(r"\d", pretty) else digits_only

    digits = re.sub(r"[^\d+]", "", digits_only)
    if not digits:
        return "", ""

    href = digits
    if not href.startswith("+"):
        # Only guess a country code when we are confident from the coords.
        if lat and 6.0 < float(lat) < 37.0:          # India
            href = "+91" + href.lstrip("0")
        else:
            href = digits
    return number, href


def to_24h(text: str) -> str:
    """'7:30 pm' -> '19:30'. Returns '' if it cannot be read."""
    t = clean(text).lower().replace(".", "")
    m = re.match(r"^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$", t)
    if not m:
        return ""
    hour = int(m.group(1))
    minute = int(m.group(2) or 0)
    ampm = m.group(3)
    if ampm == "pm" and hour != 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    if hour > 23 or minute > 59:
        return ""
    return f"{hour:02d}:{minute:02d}"


def split_range(text: str) -> list[str]:
    """
    Google writes the range as a dash in the visible table and as the word
    'to' in the screen-reader label. Accept either.
    """
    return [p.strip() for p in re.split(r"\s+to\s+|\s*-\s*", clean(text), flags=re.I)
            if p.strip()]


def pretty_range(text: str) -> str:
    """Normalise 'to' back to a dash for the printed hours table."""
    if "," in text:                      # split shift, leave it spelled out
        return clean(text)
    parts = split_range(text)
    return f"{parts[0]} - {parts[1]}" if len(parts) == 2 else clean(text)


def parse_range(text: str) -> str:
    """'11 am to 7:30 pm' -> '11:00-19:30'. 'Closed' -> ''."""
    t = clean(text)
    low = t.lower()
    if not t or "closed" in low:
        return ""
    if "24 hours" in low or "open 24" in low:
        return "00:00-23:59"
    # Split shifts are common ("10:30 am to 2:30 pm, 5 to 9:30 pm"). The
    # badge is a single open/closed line, so span first opening to last
    # closing. It reads "open" over the lunch break, which is a smaller
    # error than falling back to an unrelated default.
    parts = split_range(t.replace(",", " "))
    if len(parts) < 2:
        return ""
    if len(parts) > 2:
        parts = [parts[0], parts[-1]]
    start, end = to_24h(parts[0]), to_24h(parts[1])
    # "11 am-7:30 pm": the opening side may omit am/pm, so infer it.
    if not start and re.match(r"^\d{1,2}(:\d{2})?$", clean(parts[0])):
        start = to_24h(parts[0] + (" pm" if "pm" in parts[1].lower()
                                   and int(re.sub(r"\D", "", parts[0])[:2] or 0) < 12
                                   else " am"))
    return f"{start}-{end}" if start and end else ""


def condense_hours(rows: list[dict]) -> list[tuple[str, str]]:
    """
    Seven Google rows into at most four display rows, collapsing runs of
    identical times: Mon-Fri / Saturday / Sunday.
    """
    by_day = {r["day"]: clean(r["time"]) for r in rows if r.get("day") in DAYS}
    if not by_day:
        return []

    ordered = [(d, by_day.get(d, "")) for d in DAYS if d in by_day]
    groups: list[list] = []
    for day, time_text in ordered:
        if groups and groups[-1][1] == time_text:
            groups[-1][0].append(day)
        else:
            groups.append([[day], time_text])

    out = []
    for days, time_text in groups:
        if len(days) == 1:
            label = days[0].capitalize()
        else:
            label = f"{SHORT[days[0]]}-{SHORT[days[-1]]}"
        out.append((label, pretty_range(time_text) if time_text else "Closed"))

    # The sheet has four slots. Merge the tail rather than dropping it.
    if len(out) > 4:
        head, tail = out[:3], out[3:]
        head.append((f"{tail[0][0]}-{tail[-1][0]}", tail[0][1]))
        out = head
    return out


def badge_hours(rows: list[dict]) -> dict:
    by_day = {r["day"]: clean(r["time"]) for r in rows if r.get("day") in DAYS}
    weekday = ""
    for day in ("monday", "tuesday", "wednesday", "thursday", "friday"):
        got = parse_range(by_day.get(day, ""))
        if got:
            weekday = got
            break
    return {
        "weekdays": weekday,
        "saturday": parse_range(by_day.get("saturday", "")),
        "sunday":   parse_range(by_day.get("sunday", "")),
    }


def size_photo(base: str, width: int = 1600, height: int = 1200) -> str:
    return f"{base}=w{width}-h{height}-k-no"


# ---------------------------------------------------------------------------
# Browser driving
# ---------------------------------------------------------------------------
def looks_like_url(text: str) -> bool:
    return text.strip().lower().startswith(("http://", "https://"))


def scrape(page, target: str, settle: float) -> dict:
    searched = not looks_like_url(target)
    if searched:
        url = ("https://www.google.com/maps/search/"
               + urllib.parse.quote_plus(target.strip()) + "?hl=en")
    else:
        url = target.strip()

    page.goto(url, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(int(settle * 1000))

    # A search can land on a results feed instead of a place. Open the first.
    if not page.query_selector('button[data-item-id="address"]'):
        link = page.query_selector('a[href*="/maps/place/"]')
        if link:
            link.click()
            page.wait_for_timeout(int(settle * 1000) + 1500)

    try:
        page.wait_for_selector('button[data-item-id="address"]', timeout=10000)
    except Exception:
        pass

    expand_hours(page)

    # Read the text before scrolling. Maps recycles panel nodes, so a pass
    # after scrolling can find the photos but lose the rating.
    place = page.evaluate(EXTRACT_JS)

    place["photos"] = merge_photos(place.get("photos", []), harvest_photos(page))
    place["searched"] = searched
    place["query"] = target.strip()
    return place


def match_looks_wrong(query: str, name: str) -> bool:
    """
    A search always returns Google's best guess, which for an unlisted
    practice is simply the nearest similar one. Compare the distinctive
    words so we can say so rather than quietly building the wrong site.
    """
    stop = {"dental", "dentist", "clinic", "care", "centre", "center",
            "hospital", "the", "and", "dr", "doctor", "smile", "teeth"}
    words = lambda s: {w for w in re.findall(r"[a-z]+", s.lower())
                       if len(w) > 2 and w not in stop}
    wanted, got = words(query), words(name)
    return bool(wanted) and not (wanted & got)


PHOTOS_JS = r"""
() => [...new Set([...document.querySelectorAll('img')].map(i => i.src)
  .filter(s => s && s.includes('googleusercontent.com')
            && !s.includes('/a/') && !s.includes('/a-/')
            && !/=w[1-9]?\d-h[1-9]?\d/.test(s))
  .map(s => s.split('=')[0]))]
"""


def merge_photos(*lists) -> list[str]:
    seen, out = set(), []
    for group in lists:
        for url in group or []:
            if url not in seen:
                seen.add(url)
                out.append(url)
    return out


def harvest_photos(page) -> list[str]:
    """
    Photos lazy-load, so a panel read on arrival sees only the few above
    the fold. Scroll through, collecting as we go rather than at the end,
    because Maps unmounts what scrolls out of view.
    """
    found: list[str] = []
    try:
        pane = page.query_selector('div[role="main"]')
        for _ in range(6):
            found = merge_photos(found, page.evaluate(PHOTOS_JS))
            if pane:
                page.evaluate(
                    "() => { const p = document.querySelector('div[role=\"main\"]');"
                    " if (p) p.scrollTop += Math.max(400, p.clientHeight); }")
            page.wait_for_timeout(350)
        found = merge_photos(found, page.evaluate(PHOTOS_JS))
        page.evaluate("() => { const p = document.querySelector('div[role=\"main\"]');"
                      " if (p) p.scrollTop = 0; }")
    except Exception:
        pass
    return found


DAY_LABELS = '[aria-label*="Copy open hours"]'


def day_count(page) -> int:
    try:
        return page.evaluate(
            "() => document.querySelectorAll('[aria-label*=\"Copy open hours\"]').length")
    except Exception:
        return 0


def wait_for_days(page, timeout_ms: int) -> bool:
    """Poll until the week is on screen. The panel streams in piecemeal."""
    deadline = time.time() + timeout_ms / 1000.0
    while time.time() < deadline:
        if day_count(page) >= 3:
            return True
        page.wait_for_timeout(400)
    return day_count(page) >= 3


def expand_hours(page) -> None:
    """
    The panel can show only today's hours with the rest behind a dropdown.
    Wait for the week first — clicking an already-open dropdown closes it,
    which is how you end up with a single day.
    """
    if wait_for_days(page, 8000):
        return

    for selector in ('[jsaction*="openhours"]',
                     'button[data-item-id="oh"]',
                     '[aria-label*="Show open hours"]'):
        node = page.query_selector(selector)
        if not node:
            continue
        try:
            node.click()
        except Exception:
            continue
        if wait_for_days(page, 4000):
            return


# ---------------------------------------------------------------------------
# Mapping onto CSV columns
# ---------------------------------------------------------------------------
def to_row(place: dict, template: str, max_photos: int, keep_team: bool) -> dict:
    lat, lng = parse_latlng(place.get("url", ""))
    name = tidy_name(place.get("name"))
    line1, line2, city, full = split_address(place.get("address"))
    display_phone, href_phone = parse_phone(
        place.get("phoneRaw"), place.get("phoneLabel"), lat)
    hours = place.get("hours") or []
    badge = badge_hours(hours)

    row = {
        "slug": slugify(f"{name} {city}" if city else name),
        "template": template,
        "business.name": name,
        "business.city": city,
        "contact.phoneDisplay": display_phone,
        "contact.phoneHref": href_phone,
        "location.line1": line1,
        "location.line2": line2,
        "location.mapQuery": full or (f"{name}, {city}" if city else name),
        "location.mapLat": lat,
        "location.mapLng": lng,
        "openBadge.weekdays": badge["weekdays"],
        "openBadge.saturday": badge["saturday"],
        "openBadge.sunday":   badge["sunday"],
        "reviewsMeta.rating": clean(place.get("rating")),
        "reviewsMeta.count":  clean(place.get("reviews")),
    }

    # Google carries no clinician data, so the template's demo doctors would
    # otherwise survive into a real prospect's site under their own logo.
    # Hide the section until someone supplies the real names.
    if not keep_team:
        row["team.enabled"] = "false"

    for i, (label, time_text) in enumerate(condense_hours(hours), start=1):
        row[f"hours.{i}.days"] = label
        row[f"hours.{i}.time"] = time_text

    for i, base in enumerate(place.get("photos", [])[:max_photos], start=1):
        row[f"gallery.images.{i}.src"] = size_photo(base)
        row[f"gallery.images.{i}.alt"] = f"{name}, photo {i}" if name else f"Photo {i}"

    return {k: v for k, v in row.items() if v not in (None, "")}


def download_photos(row: dict, slug: str, folder: Path) -> None:
    """Save Google-hosted photos locally and repoint the row at the files."""
    target = folder / slug
    target.mkdir(parents=True, exist_ok=True)

    for i in range(1, 9):
        key = f"gallery.images.{i}.src"
        url = row.get(key)
        if not url or not url.startswith("http"):
            continue
        dest = target / f"photo-{i}.jpg"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r, dest.open("wb") as fh:
                fh.write(r.read())
            row[key] = f"assets/img/{slug}/photo-{i}.jpg"
            print(f"    saved {dest.name}")
        except Exception as exc:
            print(f"    could not save photo {i}: {exc}")


# ---------------------------------------------------------------------------
# clients.csv merge
# ---------------------------------------------------------------------------
def merge_rows(new_rows: list[dict], path: Path, overwrite: bool) -> tuple[int, int]:
    existing: list[dict] = []
    if path.exists():
        with path.open(newline="", encoding="utf-8-sig") as fh:
            existing = list(csv.DictReader(fh))

    by_slug = {r.get("slug", ""): r for r in existing}
    added = updated = 0

    for row in new_rows:
        slug = row["slug"]
        if slug in by_slug:
            target = by_slug[slug]
            for key, value in row.items():
                # Never clobber something you typed by hand unless asked.
                if overwrite or not (target.get(key) or "").strip():
                    target[key] = value
            updated += 1
        else:
            existing.append(row)
            by_slug[slug] = row
            added += 1

    with path.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for row in existing:
            writer.writerow({c: row.get(c, "") for c in COLUMNS})

    return added, updated


# ---------------------------------------------------------------------------
def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="fetch.py",
        description="Fill a clients.csv row from a Google Maps link.")
    parser.add_argument("targets", nargs="*",
                        help="Maps URLs, short links, or names to search for")
    parser.add_argument("--file", metavar="PATH",
                        help="text file with one link or name per line")
    parser.add_argument("--template", default="enamel",
                        help="enamel or aurelia (default: enamel)")
    parser.add_argument("--csv", metavar="PATH",
                        help="target sheet (default: clients.csv)")
    parser.add_argument("--photos", action="store_true",
                        help="download the photos instead of hotlinking Google")
    parser.add_argument("--max-photos", type=int, default=6, metavar="N",
                        help="how many photos to keep, 1-8 (default: 6)")
    parser.add_argument("--overwrite", action="store_true",
                        help="replace cells you already filled in by hand")
    parser.add_argument("--keep-team", action="store_true",
                        help="leave the template's demo clinicians on the page "
                             "(off by default so fake names cannot ship)")
    parser.add_argument("--show", action="store_true",
                        help="print what was scraped without writing the sheet")
    parser.add_argument("--headed", action="store_true",
                        help="watch the browser, useful when something breaks")
    parser.add_argument("--settle", type=float, default=4.0, metavar="SECONDS",
                        help="pause after load; raise it on a slow connection")

    args = parser.parse_args(argv)

    targets = list(args.targets)
    if args.file:
        source = Path(args.file)
        if not source.exists():
            print(f"No such file: {source}")
            return 1
        targets += [ln.strip() for ln in source.read_text(encoding="utf-8").splitlines()
                    if ln.strip() and not ln.strip().startswith("#")]

    if not targets:
        parser.print_help()
        return 1

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright is not installed. Run:")
        print("  pip install playwright")
        print("  playwright install chromium")
        return 1

    csv_path = Path(args.csv).resolve() if args.csv else CSV_PATH
    img_root = HERE.parent / "dental-template-enamel" / "assets" / "img"

    rows: list[dict] = []
    mismatches: list[tuple[str, str]] = []
    failures = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not args.headed)
        ctx = browser.new_context(
            locale="en-GB", user_agent=UA,
            viewport={"width": 1400, "height": 1000})
        ctx.add_cookies([{"name": "CONSENT",
                          "value": "YES+cb.20210720-07-p0.en+FX+410",
                          "domain": ".google.com", "path": "/"}])
        page = ctx.new_page()

        for target in targets:
            print(f"\n> {target[:88]}")
            try:
                place = scrape(page, target, args.settle)
            except Exception as exc:
                print(f"  failed: {type(exc).__name__}: {exc}")
                failures += 1
                continue

            if not place.get("address") and not place.get("name"):
                print("  nothing found — is the link a place, not a search?")
                failures += 1
                continue

            row = to_row(place, args.template,
                         max(1, min(8, args.max_photos)), args.keep_team)
            photos = sum(1 for k in row if k.endswith(".src"))
            print(f"  {row.get('business.name', '?')}"
                  f"  ·  {row.get('business.city', 'city?')}"
                  f"  ·  {row.get('contact.phoneDisplay', 'no phone')}"
                  f"  ·  {row.get('reviewsMeta.rating', '?')}"
                  f" ({row.get('reviewsMeta.count', '?')})"
                  f"  ·  {photos} photos")

            if place.get("searched") and match_looks_wrong(
                    place.get("query", ""), row.get("business.name", "")):
                print("  !! this does not match what you searched for. Google returns")
                print("     its nearest guess, so open the listing yourself and paste")
                print("     the link instead of searching by name.")
                mismatches.append((place.get("query", ""), row.get("business.name", "")))

            if place.get("website"):
                print(f"  their site (clinician names live here): {place['website'][:80]}")

            if args.photos:
                download_photos(row, row["slug"], img_root)

            rows.append(row)
            time.sleep(1.0)   # be a considerate visitor

        browser.close()

    if not rows:
        print("\nNothing scraped.")
        return 1

    if not args.keep_team:
        print("\nClinicians section switched off — Google has no doctor names or"
              "\nheadshots. Fill team.members.* in the sheet, or pass --keep-team"
              "\nto show the template's demo clinicians.")

    if args.show:
        print("\n--- not written, --show was set ---")
        for row in rows:
            print(f"\n[{row['slug']}]")
            for key in COLUMNS:
                if row.get(key):
                    print(f"  {key:28} {row[key]}")
        return 0

    added, updated = merge_rows(rows, csv_path, args.overwrite)
    print(f"\n{csv_path.name}: {added} added, {updated} updated")

    if mismatches:
        print("\nCheck these before you build — the search found something else:")
        for query, name in mismatches:
            print(f"  you asked for {query!r} but got {name!r}")

    print("Next:  python build.py build")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
