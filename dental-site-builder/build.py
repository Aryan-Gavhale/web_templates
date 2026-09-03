#!/usr/bin/env python3
"""
dental-site-builder
===================

Turns one row of a spreadsheet into one finished website.

    python build.py init            # write a blank clients.csv to fill in
    python build.py build           # build every row into dist/
    python build.py build --only smile-dental
    python build.py fields          # print every column and what it does

No AI, no network, no tokens. It copies a template folder and writes a
single small JavaScript file into it, so building 100 sites costs the
same as building one.

How the two config layers fit together
--------------------------------------
Each template ships assets/js/site-config.js holding a complete set of
defaults. This script never touches that file. It writes
assets/js/client.js instead, containing only the values from the CSV
row, and the page deep-merges the two at load time.

That is the whole reason this script does not need to parse or re-emit
JavaScript: it only ever writes the small overlay.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

TEMPLATES = {
    "enamel":  ROOT / "dental-template-enamel",
    "aurelia": ROOT / "dental-template",
}
DEFAULT_TEMPLATE = "enamel"

CSV_PATH = HERE / "clients.csv"
DIST = HERE / "dist"

# Files that belong to the template's own repo, not to a built site.
SKIP_NAMES = {"README.md", ".git", ".gitignore", "__pycache__"}


# ---------------------------------------------------------------------------
# Column definitions — the single source of truth
#
# (column, help). A numeric segment in a column name means "index into a
# list", so team.members.1.name is the first clinician. Leave any cell
# blank to keep whatever the template already ships with.
# ---------------------------------------------------------------------------
FIELDS: list[tuple[str, str]] = [
    ("slug",     "Folder + URL name. Blank = generated from the business name."),
    ("template", "enamel (bold) or aurelia (editorial). Blank = enamel."),

    ("business.name",      "Shown in the header, footer wordmark and map card."),
    ("business.tagline",   "Small line under the logo, e.g. 'dental studio'."),
    ("business.legalName", "Copyright line, e.g. 'Bright Smile Dental Pvt Ltd'."),
    ("business.city",      "City shown in the hero pill."),
    ("business.openNote",  "Second half of the hero pill, e.g. 'Open Sundays'."),

    ("brand.primary", "Accent colour as hex, e.g. #1677FF. Drives the whole page."),
    ("brand.ink",     "Darkest text/background colour as hex. Usually leave blank."),

    ("contact.phoneDisplay", "Phone exactly as it should read on screen."),
    ("contact.phoneHref",    "Same number, digits only with country code: +919876543210."),
    ("contact.email",        "Public enquiries address."),
    ("contact.whatsapp",     "Digits only. Blank hides the WhatsApp action."),

    ("location.line1",         "Street address, first line."),
    ("location.line2",         "Area, city and postcode."),
    ("location.mapQuery",      "What to search Google for. Usually 'Business Name, City'."),
    ("location.mapEmbedUrl",   "Optional. The src=\"...\" from Google Maps > Share > Embed a map."),
    ("location.mapLat",        "Optional. Exact latitude, when the address is ambiguous."),
    ("location.mapLng",        "Optional. Exact longitude."),
    ("location.mapZoom",       "Map zoom, 1-20. Blank = 16."),
    ("location.directionsUrl", "Optional. Blank = generated from the address."),
    ("location.reviewsUrl",    "Optional. Link to their Google reviews. Blank = generated."),
    ("location.parkingNote",   "One line on parking or how to find the door."),

    ("openBadge.weekdays",   "Mon-Fri opening as HH:MM-HH:MM, e.g. 09:00-19:00."),
    ("openBadge.saturday",   "Saturday opening as HH:MM-HH:MM. Blank = closed."),
    ("openBadge.sunday",     "Sunday opening as HH:MM-HH:MM. Blank = closed."),
    ("openBadge.closedNote", "What the badge says out of hours."),

    ("hours.1.days", "Label for the first hours row, e.g. 'Mon-Fri'."),
    ("hours.1.time", "Times for the first row, e.g. '09:00 - 19:00'."),
    ("hours.2.days", "Second hours row label."),
    ("hours.2.time", "Second hours row times."),
    ("hours.3.days", "Third hours row label."),
    ("hours.3.time", "Third hours row times."),
    ("hours.4.days", "Fourth hours row label, e.g. 'Sunday'."),
    ("hours.4.time", "Fourth hours row times, e.g. 'Closed'."),

    ("consult.eyebrow",         "Small label above the booking heading."),
    ("consult.heading",         "Booking section heading."),
    ("consult.blurb",           "Two lines explaining how booking works."),
    ("consult.firstVisitPrice", "Big number in the first assurance tile, e.g. 'Rs 500'."),
    ("consult.firstVisitNote",  "Caption under it, e.g. 'First visit, 30 minutes'."),
    ("consult.responseNote",    "Caption for the second assurance tile."),
    ("consult.ctaLabel",        "Text on the submit button."),

    ("stats.1.value", "First headline number, e.g. '12'."),
    ("stats.1.label", "What it counts, e.g. 'Years open'."),
    ("stats.2.value", "Second headline number."),
    ("stats.2.label", "Second label."),
    ("stats.3.value", "Third headline number."),
    ("stats.3.label", "Third label."),
    ("stats.4.value", "Fourth number. Aurelia shows 3, Enamel shows 4."),
    ("stats.4.label", "Fourth label."),

    ("team.enabled", "false removes the whole clinicians section."),
    ("team.heading", "Clinicians section heading. Basic HTML allowed."),
    ("team.note",    "Paragraph beside the clinicians heading."),
]

# Six clinician slots and eight photo slots. Generated rather than typed
# out so the columns cannot drift out of step with each other.
for _i in range(1, 7):
    FIELDS += [
        (f"team.members.{_i}.name",  f"Clinician {_i} full name, e.g. 'Dr. Anita Rao'."),
        (f"team.members.{_i}.role",  f"Clinician {_i} role, e.g. 'Implantologist'."),
        (f"team.members.{_i}.bio",   f"Clinician {_i} one-line bio or credentials."),
        (f"team.members.{_i}.image", f"Clinician {_i} photo. URL, or assets/img/name.jpg."),
    ]

FIELDS += [
    ("gallery.enabled", "false removes the whole photo section."),
    ("gallery.heading", "Photo section heading. Basic HTML allowed."),
    ("gallery.note",    "Paragraph beside the photo heading."),
]

for _i in range(1, 9):
    FIELDS += [
        (f"gallery.images.{_i}.src", f"Photo {_i}. A Google Business photo URL or a local path."),
        (f"gallery.images.{_i}.alt", f"Photo {_i} description, for search engines and screen readers."),
    ]

FIELDS += [
    ("reviewsMeta.rating",  "Google star rating, e.g. '4.8'."),
    ("reviewsMeta.count",   "How many Google reviews, e.g. '327'."),
    ("reviewsMeta.heading", "Optional custom heading for the reviews section."),

    ("dock.label", "Label on the sticky phone bar, e.g. 'Consultation'."),
    ("dock.price", "Figure on the sticky phone bar, e.g. 'Rs 500'."),
    ("dock.cta",   "Button text on the sticky phone bar."),

    ("meta.title",       "Browser tab + Google result title. Blank = generated."),
    ("meta.description", "Google result snippet, ~155 characters. Blank = generated."),
]

COLUMNS = [name for name, _ in FIELDS]

# Cells that are not plain strings.
BOOL_COLUMNS = {"team.enabled", "gallery.enabled"}
INT_COLUMNS = {"location.mapZoom"}

TRUE = {"true", "yes", "y", "1", "on"}
FALSE = {"false", "no", "n", "0", "off"}


# ---------------------------------------------------------------------------
# Example rows, written by `init` so the format is obvious
# ---------------------------------------------------------------------------
EXAMPLES: list[dict[str, str]] = [
    {
        "slug": "bright-smile-pune",
        "template": "enamel",
        "business.name": "Bright Smile",
        "business.tagline": "dental studio",
        "business.legalName": "Bright Smile Dental Care",
        "business.city": "Pune",
        "business.openNote": "Open Sundays",
        "brand.primary": "#1677FF",
        "contact.phoneDisplay": "098765 43210",
        "contact.phoneHref": "+919876543210",
        "contact.email": "hello@brightsmile.example",
        "contact.whatsapp": "919876543210",
        "location.line1": "12 Fergusson College Road",
        "location.line2": "Shivajinagar, Pune 411005",
        "location.mapQuery": "Fergusson College Road, Shivajinagar, Pune 411005",
        "location.parkingNote": "Parking behind the building, entrance on the side lane.",
        "openBadge.weekdays": "09:30-20:00",
        "openBadge.saturday": "09:30-18:00",
        "openBadge.sunday": "10:00-14:00",
        "hours.1.days": "Mon-Fri", "hours.1.time": "09:30 - 20:00",
        "hours.2.days": "Saturday", "hours.2.time": "09:30 - 18:00",
        "hours.3.days": "Sunday", "hours.3.time": "10:00 - 14:00",
        "hours.4.days": "Emergency", "hours.4.time": "On call",
        "consult.firstVisitPrice": "Rs 500",
        "consult.firstVisitNote": "First visit, 30 minutes",
        "consult.responseNote": "Confirmed on WhatsApp within the hour",
        "stats.1.value": "12", "stats.1.label": "Years open",
        "stats.2.value": "9,000", "stats.2.label": "Patients",
        "stats.3.value": "4.8", "stats.3.label": "Out of five",
        "stats.4.value": "0", "stats.4.label": "Hidden charges",
        "team.members.1.name": "Dr. Anita Rao",
        "team.members.1.role": "Principal dentist",
        "team.members.1.bio": "BDS, MDS Prosthodontics. Sixteen years in practice.",
        "team.members.1.image": "assets/img/dr-anita-rao.jpg",
        "team.members.2.name": "Dr. Kunal Mehta",
        "team.members.2.role": "Orthodontist",
        "team.members.2.bio": "Aligners and fixed braces. Plans every case himself.",
        "team.members.2.image": "assets/img/dr-kunal-mehta.jpg",
        "gallery.images.1.src": "assets/img/clinic-1.jpg",
        "gallery.images.1.alt": "Reception at Bright Smile",
        "gallery.images.2.src": "assets/img/clinic-2.jpg",
        "gallery.images.2.alt": "Treatment room",
        "reviewsMeta.rating": "4.8",
        "reviewsMeta.count": "327",
        "dock.label": "Check-up",
        "dock.price": "Rs 500",
        "dock.cta": "Book a visit",
    },
    {
        "slug": "aurelia-demo-hospital",
        "template": "aurelia",
        "business.name": "Meridian",
        "business.tagline": "Dental Hospital",
        "business.legalName": "Meridian Dental Hospital",
        "business.city": "Bengaluru",
        "business.openNote": "Est. 2004 - Multi-speciality dental hospital",
        "brand.primary": "#1D4A3D",
        "contact.phoneDisplay": "080 4123 9000",
        "contact.phoneHref": "+918041239000",
        "contact.email": "reception@meridian.example",
        "location.line1": "44 Lavelle Road",
        "location.line2": "Bengaluru 560001",
        "location.mapQuery": "Lavelle Road, Bengaluru 560001",
        "location.parkingNote": "Basement parking, lift to the third floor reception.",
        "openBadge.weekdays": "08:00-20:00",
        "openBadge.saturday": "09:00-17:00",
        "hours.1.days": "Mon-Fri", "hours.1.time": "08:00 - 20:00",
        "hours.2.days": "Saturday", "hours.2.time": "09:00 - 17:00",
        "hours.3.days": "Sunday", "hours.3.time": "Closed",
        "hours.4.days": "Emergency", "hours.4.time": "24 hours",
        "consult.firstVisitPrice": "60 min",
        "consult.firstVisitNote": "First consultation length",
        "stats.1.value": "21", "stats.1.label": "Years of care",
        "stats.2.value": "28", "stats.2.label": "Specialists",
        "stats.3.value": "4.9", "stats.3.label": "Patient rating",
        "reviewsMeta.rating": "4.9",
        "reviewsMeta.count": "1,102",
        "dock.label": "Consultation",
        "dock.price": "60 min",
    },
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def slugify(text: str) -> str:
    out = re.sub(r"[^a-z0-9]+", "-", (text or "").strip().lower())
    return out.strip("-") or "site"


def coerce(column: str, raw: str):
    """Turn a CSV cell into the JSON type the template expects."""
    value = (raw or "").strip()
    if value == "":
        return None
    if column in BOOL_COLUMNS:
        low = value.lower()
        if low in TRUE:
            return True
        if low in FALSE:
            return False
        raise ValueError(f"{column}: expected true or false, got {value!r}")
    if column in INT_COLUMNS:
        try:
            return int(value)
        except ValueError as exc:
            raise ValueError(f"{column}: expected a whole number, got {value!r}") from exc
    return value


def assign(root: dict, path: str, value) -> None:
    """
    Write value into root at a dotted path. A numeric segment means the
    parent key is a list: team.members.2.name is the second clinician.
    """
    parts = path.split(".")
    node = root

    i = 0
    while i < len(parts):
        part = parts[i]
        nxt = parts[i + 1] if i + 1 < len(parts) else None

        if nxt is not None and nxt.isdigit():
            lst = node.setdefault(part, [])
            if not isinstance(lst, list):
                raise ValueError(f"{path}: {part} is both a value and a list")
            index = int(nxt) - 1
            while len(lst) <= index:
                lst.append({})
            rest = parts[i + 2:]
            if not rest:
                lst[index] = value
                return
            assign(lst[index], ".".join(rest), value)
            return

        if nxt is None:
            node[part] = value
            return

        node = node.setdefault(part, {})
        if not isinstance(node, dict):
            raise ValueError(f"{path}: {part} is both a value and an object")
        i += 1


def prune(node):
    """
    Drop empty objects, and drop list slots the row never filled in, so a
    sheet listing clinicians 1 and 3 does not leave a hole at 2.
    """
    if isinstance(node, dict):
        cleaned = {}
        for key, value in node.items():
            value = prune(value)
            if value is None or value == {} or value == []:
                continue
            cleaned[key] = value
        return cleaned
    if isinstance(node, list):
        return [item for item in (prune(v) for v in node)
                if item is not None and item != {} and item != []]
    return node


def row_to_config(row: dict[str, str]) -> dict:
    config: dict = {}
    for column in COLUMNS:
        if column in ("slug", "template"):
            continue
        value = coerce(column, row.get(column, ""))
        if value is None:
            continue
        assign(config, column, value)
    return prune(config)


def autofill_meta(config: dict, row: dict[str, str]) -> None:
    """Write a sensible title and description when the sheet leaves them blank."""
    business = config.get("business", {})
    name = business.get("name")
    city = business.get("city")
    if not name:
        return

    meta = config.setdefault("meta", {})
    if not meta.get("title"):
        meta["title"] = f"{name} — Dental Clinic in {city}" if city else f"{name} — Dental Clinic"
    if not meta.get("description"):
        where = f" in {city}" if city else ""
        phone = config.get("contact", {}).get("phoneDisplay")
        tail = f" Call {phone}." if phone else ""
        meta["description"] = (
            f"{name} is a dental practice{where}. Book a consultation online, "
            f"see our clinicians, opening hours and location.{tail}"
        ).strip()

    brand = config.get("brand", {})
    if brand.get("primary") and not meta.get("themeColor"):
        meta["themeColor"] = brand["primary"]


def copy_template(src: Path, dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    shutil.copytree(
        src, dest,
        ignore=shutil.ignore_patterns(*SKIP_NAMES),
    )


def write_client_js(dest: Path, config: dict, slug: str) -> None:
    body = json.dumps(config, indent=2, ensure_ascii=False)
    text = (
        "/* =========================================================\n"
        f"   Per-customer overrides — {slug}\n"
        "   ---------------------------------------------------------\n"
        "   Generated by dental-site-builder/build.py. Regenerating\n"
        "   overwrites this file, so put lasting edits in clients.csv.\n"
        "\n"
        "   Anything set here wins over assets/js/site-config.js.\n"
        "   ========================================================= */\n"
        f"window.SITE_CLIENT = {body};\n"
    )
    target = dest / "assets" / "js" / "client.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


MANIFEST = ".sites.json"


def record_and_list(built: list[tuple[str, str, str]], out: Path) -> list[tuple[str, str, str]]:
    """
    Fold this run into a small manifest and return every site still on
    disk, so a --only rebuild does not drop the others off the index.
    """
    known: dict[str, list[str]] = {}
    path = out / MANIFEST
    if path.exists():
        try:
            known = json.loads(path.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            known = {}

    for slug, name, template in built:
        known[slug] = [name, template]

    known = {slug: v for slug, v in known.items() if (out / slug / "index.html").exists()}
    path.write_text(json.dumps(known, indent=2, ensure_ascii=False), encoding="utf-8")

    return [(slug, v[0], v[1]) for slug, v in sorted(known.items())]


def write_index(built: list[tuple[str, str, str]], out: Path) -> None:
    """A contact sheet of everything built, so you can click through them."""
    cards = "\n".join(
        f'      <li><a href="{slug}/index.html"><b>{name or slug}</b>'
        f'<span>{slug} &middot; {template}</span></a></li>'
        for slug, name, template in built
    )
    out.joinpath("index.html").write_text(
        "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n"
        "<meta charset=\"UTF-8\" />\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />\n"
        "<title>Built sites</title>\n"
        "<style>\n"
        "  body{font:16px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
        "background:#f3f1ec;color:#111110;margin:0;padding:48px 24px}\n"
        "  h1{font-size:28px;letter-spacing:-.03em;margin:0 0 6px;max-width:960px;"
        "margin-inline:auto}\n"
        "  p.count{color:#4c4c47;max-width:960px;margin:0 auto 28px}\n"
        "  ul{list-style:none;padding:0;margin:0 auto;max-width:960px;display:grid;"
        "grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}\n"
        "  a{display:block;padding:18px 20px;background:#fff;border:2px solid #111110;"
        "border-radius:12px;box-shadow:4px 4px 0 #111110;text-decoration:none;color:inherit}\n"
        "  a:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 #111110}\n"
        "  b{display:block;font-size:18px;letter-spacing:-.02em}\n"
        "  span{display:block;margin-top:6px;font-size:12px;color:#86867e;"
        "font-family:ui-monospace,Menlo,monospace}\n"
        "</style>\n</head>\n<body>\n"
        "  <h1>Built sites</h1>\n"
        f"  <p class=\"count\">{len(built)} generated from clients.csv.</p>\n"
        "  <ul>\n" + cards + "\n  </ul>\n"
        "</body>\n</html>\n",
        encoding="utf-8",
    )


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
def cmd_init(args) -> int:
    if CSV_PATH.exists() and not args.force:
        print(f"{CSV_PATH.name} already exists. Pass --force to overwrite it.")
        return 1

    with CSV_PATH.open("w", newline="", encoding="utf-8-sig") as fh:
        writer = csv.DictWriter(fh, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for example in EXAMPLES:
            writer.writerow(example)

    print(f"Wrote {CSV_PATH} with {len(COLUMNS)} columns and "
          f"{len(EXAMPLES)} example rows.")
    print("Open it in Excel, replace the examples with real clients, then:")
    print("  python build.py build")
    return 0


def cmd_fields(args) -> int:
    width = max(len(name) for name in COLUMNS)
    for name, help_text in FIELDS:
        print(f"{name.ljust(width)}  {help_text}")
    print(f"\n{len(COLUMNS)} columns. Blank cells keep the template default.")
    return 0


def cmd_build(args) -> int:
    if not CSV_PATH.exists():
        print(f"No {CSV_PATH.name} found. Run: python build.py init")
        return 1

    out = Path(args.out).resolve() if args.out else DIST
    out.mkdir(parents=True, exist_ok=True)

    with CSV_PATH.open(newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.DictReader(fh))

    if not rows:
        print("clients.csv has a header but no rows.")
        return 1

    unknown = set(rows[0].keys()) - set(COLUMNS) - {None, ""}
    if unknown:
        print("Warning: these columns are not recognised and will be ignored:")
        for name in sorted(unknown):
            print(f"  {name}")

    built: list[tuple[str, str, str]] = []
    seen: set[str] = set()
    failures = 0

    for number, row in enumerate(rows, start=2):  # row 1 is the header
        name = (row.get("business.name") or "").strip()
        slug = slugify(row.get("slug") or name)

        if not name and not (row.get("slug") or "").strip():
            continue  # blank spacer row

        if args.only and slug != slugify(args.only):
            continue

        if slug in seen:
            print(f"row {number}: duplicate slug {slug!r}, skipped")
            failures += 1
            continue
        seen.add(slug)

        key = (row.get("template") or DEFAULT_TEMPLATE).strip().lower()
        template = TEMPLATES.get(key)
        if template is None:
            print(f"row {number} ({slug}): unknown template {key!r}. "
                  f"Use one of: {', '.join(TEMPLATES)}")
            failures += 1
            continue
        if not template.exists():
            print(f"row {number} ({slug}): template folder missing at {template}")
            failures += 1
            continue

        try:
            config = row_to_config(row)
            autofill_meta(config, row)
        except ValueError as exc:
            print(f"row {number} ({slug}): {exc}")
            failures += 1
            continue

        dest = out / slug
        copy_template(template, dest)
        write_client_js(dest, config, slug)
        built.append((slug, name, key))
        print(f"built {slug}  ({key})")

    if built:
        everything = record_and_list(built, out)
        write_index(everything, out)
        print(f"\n{len(built)} site(s) built, {len(everything)} in {out}")
        print(f"Open {out / 'index.html'} to click through them.")
    else:
        print("\nNothing built.")

    if failures:
        print(f"{failures} row(s) skipped because of the problems above.")
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="build.py",
        description="Build one dental website per row of clients.csv.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    p_init = sub.add_parser("init", help="write a blank clients.csv")
    p_init.add_argument("--force", action="store_true",
                        help="overwrite an existing clients.csv")
    p_init.set_defaults(func=cmd_init)

    p_fields = sub.add_parser("fields", help="list every column and what it does")
    p_fields.set_defaults(func=cmd_fields)

    p_build = sub.add_parser("build", help="build every row into dist/")
    p_build.add_argument("--only", metavar="SLUG",
                         help="build a single row instead of all of them")
    p_build.add_argument("--out", metavar="DIR",
                         help="output folder (default: dental-site-builder/dist)")
    p_build.set_defaults(func=cmd_build)

    args = parser.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
