"""Site settings — a typed key/value store on top of the settings table."""

import json

from .db import db, now, q, q1

# Every key the app understands, with its default. Anything not listed here is
# ignored by the admin form, which keeps stray keys out of the table.
DEFAULTS = {
    # identity
    "site_name": "Studio Aarohi",
    "site_tagline": "Interior design & turnkey execution",
    "site_description": "Studio Aarohi is a Bengaluru interior design practice designing calm, "
                        "well-made homes and workplaces — drawn in detail and delivered turnkey.",
    "logo_text": "AAROHI",
    "founded_year": "2014",

    # contact
    "email": "studio@aarohi.design",
    "phone": "+91 80 4123 8800",
    "whatsapp": "+919845012345",
    "address_line1": "3rd Floor, Ashwin House, 12 Richmond Road",
    "address_line2": "Bengaluru 560025, Karnataka",
    "map_url": "https://maps.google.com/?q=Richmond+Road+Bengaluru",
    "hours": "Mon–Sat, 10.00–19.00 IST",

    # social
    "instagram": "https://instagram.com/",
    "linkedin": "https://linkedin.com/",
    "pinterest": "https://pinterest.com/",

    # theme
    "accent": "#9C6B33",
    "ink": "#141414",
    "paper": "#F7F4EF",

    # google reviews
    "google_api_key": "",
    "google_place_id": "",
    "google_reviews_enabled": "1",
    "google_auto_import": "1",
    "google_min_rating": "4",
    "google_cache_hours": "12",
    "google_rating": "",
    "google_total_ratings": "",
    "google_place_url": "",

    # forms
    "enquiry_success_message": "Thank you — we have your enquiry and will reply within one working day.",
    "budget_bands": "Under ₹5 L\n₹5–15 L\n₹15–30 L\n₹30–60 L\nAbove ₹60 L\nNot sure yet",
    "timelines": "Immediately\nWithin 3 months\n3–6 months\nJust exploring",

    # operations
    "currency_symbol": "₹",
    # {name} {amount} {due} {ref} {studio} are filled in before sending.
    "reminder_template": "Hello {name}, a gentle reminder that {amount} on {ref} was due on "
                         "{due}. You can pay to the account on your agreement. "
                         "Thank you — {studio}.",
    # {name} {service} {ref} {studio} are filled in before sending.
    "reply_template": "Hi {name},\n\nThank you for reaching out to {studio}. We'd love to hear "
                      "more about {service}.\n\nWould a short call this week suit you? Reply "
                      "with a time that works and we'll ring you.\n\n"
                      "Warm regards,\n{studio}\n\nYour reference: {ref}",
}

# Keys that must never be echoed back to the browser in full.
SECRET_KEYS = {"google_api_key"}


def all_settings() -> dict:
    stored = {r["key"]: r["value"] for r in q("SELECT key, value FROM settings")}
    merged = dict(DEFAULTS)
    for k, v in stored.items():
        if v is not None:
            merged[k] = v
    return merged


def get(key: str, default=None):
    row = q1("SELECT value FROM settings WHERE key = ?", (key,))
    if row and row["value"] is not None:
        return row["value"]
    return DEFAULTS.get(key, default)


def get_int(key: str, default: int = 0) -> int:
    try:
        return int(str(get(key, default)).strip())
    except (TypeError, ValueError):
        return default


def get_bool(key: str, default: bool = False) -> bool:
    v = str(get(key, "1" if default else "0")).strip().lower()
    return v in ("1", "true", "yes", "on")


def get_list(key: str) -> list:
    raw = get(key, "") or ""
    return [line.strip() for line in raw.splitlines() if line.strip()]


def set(key: str, value) -> None:
    if value is None:
        value = ""
    db().execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        (key, str(value), now()),
    )
    db().commit()


def set_many(data: dict) -> list:
    """Write only recognised keys. Returns the keys that were actually saved."""
    saved = []
    for k, v in data.items():
        if k in DEFAULTS:
            set(k, v)
            saved.append(k)
    return saved


def public_settings() -> dict:
    """Settings safe to expose to the public template."""
    s = all_settings()
    for k in SECRET_KEYS:
        s.pop(k, None)
    return s


def masked(key: str) -> str:
    """A redacted preview of a secret, for showing in the admin form."""
    v = get(key, "") or ""
    if not v:
        return ""
    if len(v) <= 8:
        return "•" * len(v)
    return v[:4] + "•" * (len(v) - 8) + v[-4:]


def as_json() -> str:
    return json.dumps(all_settings(), ensure_ascii=False)
