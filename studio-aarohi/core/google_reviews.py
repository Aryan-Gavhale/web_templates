"""Google Business reviews.

Talks to the Places API (New) and falls back to the legacy Place Details
endpoint, because a lot of existing API keys are only enabled for the old one.

Google returns at most five reviews per place — that is a hard cap on their
side, not a limitation here. Fetched reviews are mirrored into `testimonials`
so the public theme reads one table whatever the source, and so the owner can
hide an individual review without losing it on the next sync.
"""

import hashlib
from datetime import datetime, timedelta, timezone

import requests

from . import settings as cfg
from .db import insert, now, q, q1, run, update

NEW_DETAILS = "https://places.googleapis.com/v1/places/{pid}"
NEW_SEARCH = "https://places.googleapis.com/v1/places:searchText"
LEGACY_DETAILS = "https://maps.googleapis.com/maps/api/place/details/json"
TIMEOUT = 12

DETAIL_FIELDS = "id,displayName,rating,userRatingCount,googleMapsUri,reviews"
SEARCH_FIELDS = ("places.id,places.displayName,places.formattedAddress,"
                 "places.rating,places.userRatingCount")


class GoogleError(Exception):
    """A problem worth showing to the owner verbatim."""


# ── fetching ───────────────────────────────────────────────────────────

def _friendly(status_code: int, payload: dict) -> str:
    msg = ""
    if isinstance(payload, dict):
        msg = (payload.get("error", {}) or {}).get("message") or payload.get("error_message") or ""
    if status_code in (401, 403):
        return msg or ("Google rejected the key. Check that the Places API is enabled and that "
                       "any HTTP-referrer or IP restriction on the key allows this server.")
    if status_code == 404:
        return msg or "Google has no place with that Place ID."
    if status_code == 429:
        return msg or "Google rate-limited the request. Try again shortly."
    return msg or f"Google returned HTTP {status_code}."


def _get_json(url, **kw):
    try:
        r = requests.get(url, timeout=TIMEOUT, **kw)
    except requests.exceptions.Timeout:
        raise GoogleError("Google did not respond within 12 seconds.")
    except requests.exceptions.RequestException as e:
        raise GoogleError(f"Could not reach Google: {e.__class__.__name__}.")
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code != 200:
        raise GoogleError(_friendly(r.status_code, data))
    return data


def fetch_new_api(api_key: str, place_id: str) -> dict:
    data = _get_json(
        NEW_DETAILS.format(pid=place_id.strip()),
        headers={"X-Goog-Api-Key": api_key, "X-Goog-FieldMask": DETAIL_FIELDS},
    )
    reviews = []
    for rv in data.get("reviews") or []:
        author = rv.get("authorAttribution") or {}
        reviews.append({
            "id": rv.get("name") or "",
            "author": author.get("displayName") or "Google user",
            "photo": author.get("photoUri") or "",
            "profile_url": author.get("uri") or "",
            "rating": int(rv.get("rating") or 0),
            "text": ((rv.get("originalText") or rv.get("text") or {}).get("text") or "").strip(),
            "published": rv.get("publishTime") or "",
            "relative": rv.get("relativePublishTimeDescription") or "",
        })
    return {
        "api": "new",
        "name": (data.get("displayName") or {}).get("text") or "",
        "rating": data.get("rating"),
        "total": data.get("userRatingCount"),
        "url": data.get("googleMapsUri") or "",
        "reviews": reviews,
    }


def fetch_legacy_api(api_key: str, place_id: str) -> dict:
    data = _get_json(LEGACY_DETAILS, params={
        "place_id": place_id.strip(),
        "fields": "name,rating,user_ratings_total,reviews,url",
        "reviews_sort": "newest",
        "key": api_key,
    })
    status = data.get("status")
    if status != "OK":
        raise GoogleError(data.get("error_message") or f"Google Place Details returned {status}.")
    result = data.get("result") or {}
    reviews = []
    for rv in result.get("reviews") or []:
        stamp = rv.get("time") or ""
        seed = f"{rv.get('author_name', '')}|{stamp}|{place_id}"
        published = ""
        if stamp:
            published = datetime.fromtimestamp(int(stamp), tz=timezone.utc).isoformat()
        reviews.append({
            "id": "legacy/" + hashlib.sha1(seed.encode("utf-8")).hexdigest()[:20],
            "author": rv.get("author_name") or "Google user",
            "photo": rv.get("profile_photo_url") or "",
            "profile_url": rv.get("author_url") or "",
            "rating": int(rv.get("rating") or 0),
            "text": (rv.get("text") or "").strip(),
            "published": published,
            "relative": rv.get("relative_time_description") or "",
        })
    return {
        "api": "legacy",
        "name": result.get("name") or "",
        "rating": result.get("rating"),
        "total": result.get("user_ratings_total"),
        "url": result.get("url") or "",
        "reviews": reviews,
    }


def fetch_place(api_key: str, place_id: str) -> dict:
    """New API first; quietly retry on the legacy endpoint if the key is old."""
    if not api_key:
        raise GoogleError("No Google API key has been saved yet.")
    if not place_id:
        raise GoogleError("No Google Place ID has been saved yet.")
    try:
        return fetch_new_api(api_key, place_id)
    except GoogleError as first:
        try:
            out = fetch_legacy_api(api_key, place_id)
            out["note"] = "Served by the legacy Place Details API."
            return out
        except GoogleError:
            raise first


def search_places(api_key: str, text: str) -> list:
    """Look up candidate places by name so the owner never types a Place ID."""
    if not api_key:
        raise GoogleError("Save your Google API key first, then search.")
    if not (text or "").strip():
        raise GoogleError("Type your business name and city to search.")
    try:
        r = requests.post(
            NEW_SEARCH,
            json={"textQuery": text.strip(), "maxResultCount": 8},
            headers={
                "X-Goog-Api-Key": api_key,
                "X-Goog-FieldMask": SEARCH_FIELDS,
                "Content-Type": "application/json",
            },
            timeout=TIMEOUT,
        )
    except requests.exceptions.RequestException as e:
        raise GoogleError(f"Could not reach Google: {e.__class__.__name__}.")
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code != 200:
        raise GoogleError(_friendly(r.status_code, data))
    return [{
        "place_id": p.get("id"),
        "name": (p.get("displayName") or {}).get("text") or "",
        "address": p.get("formattedAddress") or "",
        "rating": p.get("rating"),
        "total": p.get("userRatingCount"),
    } for p in (data.get("places") or [])]


# ── syncing into testimonials ──────────────────────────────────────────

def last_sync():
    return q1("SELECT * FROM google_sync ORDER BY id DESC LIMIT 1")


def is_stale() -> bool:
    row = last_sync()
    if not row or row["status"] != "ok":
        return True
    hours = max(1, cfg.get_int("google_cache_hours", 12))
    try:
        fetched = datetime.fromisoformat(row["fetched_at"])
    except (TypeError, ValueError):
        return True
    if fetched.tzinfo is None:
        fetched = fetched.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - fetched > timedelta(hours=hours)


def _record(place_id, status, message, place=None, imported=0, updated=0):
    insert("google_sync", {
        "place_id": place_id,
        "status": status,
        "rating": (place or {}).get("rating"),
        "total_ratings": (place or {}).get("total"),
        "imported": imported,
        "updated": updated,
        "message": (message or "")[:400],
        "fetched_at": now(),
    })
    q("DELETE FROM google_sync WHERE id NOT IN "
      "(SELECT id FROM google_sync ORDER BY id DESC LIMIT 40)")


def sync(force: bool = False) -> dict:
    """Pull reviews from Google and mirror them into `testimonials`.

    Owner decisions survive a re-sync: visibility, featured and position are
    only set when a review is first imported.
    """
    place_id = (cfg.get("google_place_id") or "").strip()
    api_key = (cfg.get("google_api_key") or "").strip()

    if not cfg.get_bool("google_reviews_enabled", True):
        return {"ok": False, "skipped": True, "message": "Google reviews are switched off in Settings."}
    if not api_key or not place_id:
        return {"ok": False, "skipped": True,
                "message": "Add a Google API key and Place ID in Settings to pull live reviews."}
    if not force and not is_stale():
        row = last_sync()
        return {"ok": True, "skipped": True, "cached": True,
                "message": f"Using cached reviews from {row['fetched_at'][:16].replace('T', ' ')} UTC.",
                "rating": row["rating"], "total": row["total_ratings"]}

    try:
        place = fetch_place(api_key, place_id)
    except GoogleError as e:
        _record(place_id, "error", str(e))
        return {"ok": False, "message": str(e)}

    min_rating = cfg.get_int("google_min_rating", 4)
    auto_show = cfg.get_bool("google_auto_import", True)
    imported = changed = skipped_low = 0

    for rv in place["reviews"]:
        if not rv["text"]:
            continue
        if rv["rating"] and rv["rating"] < min_rating:
            skipped_low += 1
            continue

        existing = q1("SELECT * FROM testimonials WHERE google_review_id = ?", (rv["id"],))
        if existing:
            update("testimonials", existing["id"], {
                "author": rv["author"],
                "author_photo": rv["photo"],
                "profile_url": rv["profile_url"],
                "rating": rv["rating"],
                "body": rv["text"],
                "review_time": rv["published"],
                "relative_time": rv["relative"],
            })
            changed += 1
        else:
            insert("testimonials", {
                "source": "google",
                "google_review_id": rv["id"],
                "author": rv["author"],
                "author_photo": rv["photo"],
                "profile_url": rv["profile_url"],
                "role": "Google review",
                "rating": rv["rating"],
                "body": rv["text"],
                "review_time": rv["published"],
                "relative_time": rv["relative"],
                "is_visible": 1 if auto_show else 0,
                "is_featured": 0,
                "position": 100 + imported,
                "created_at": now(),
            })
            imported += 1

    if place.get("rating") is not None:
        cfg.set("google_rating", place["rating"])
    if place.get("total") is not None:
        cfg.set("google_total_ratings", place["total"])
    if place.get("url"):
        cfg.set("google_place_url", place["url"])

    bits = [f"{imported} new"] if imported else []
    if changed:
        bits.append(f"{changed} refreshed")
    if skipped_low:
        bits.append(f"{skipped_low} below the {min_rating}★ filter")
    message = "Synced from Google — " + (", ".join(bits) if bits else "nothing new")
    if not auto_show and imported:
        message += ". New reviews are hidden until you approve them."
    if place.get("note"):
        message += f" ({place['note']})"

    _record(place_id, "ok", message, place, imported, changed)
    return {
        "ok": True, "message": message, "imported": imported, "updated": changed,
        "rating": place.get("rating"), "total": place.get("total"),
        "place_name": place.get("name"), "api": place.get("api"),
    }


def sync_if_stale() -> None:
    """Best-effort refresh on a public page view. Never raises."""
    try:
        if cfg.get_bool("google_reviews_enabled", True) and is_stale():
            sync()
    except Exception:
        pass


def summary() -> dict:
    row = last_sync()
    rating = cfg.get("google_rating") or ""
    total = cfg.get("google_total_ratings") or ""
    return {
        "configured": bool((cfg.get("google_api_key") or "").strip()
                           and (cfg.get("google_place_id") or "").strip()),
        "enabled": cfg.get_bool("google_reviews_enabled", True),
        "rating": rating,
        "total": total,
        "place_url": cfg.get("google_place_url") or "",
        "last_status": row["status"] if row else "never",
        "last_message": row["message"] if row else "",
        "last_at": row["fetched_at"] if row else "",
        "stale": is_stale(),
        "count": (q1("SELECT COUNT(*) c FROM testimonials WHERE source = 'google'") or {"c": 0})["c"],
        "showing": (q1("SELECT COUNT(*) c FROM testimonials "
                       "WHERE source = 'google' AND is_visible = 1") or {"c": 0})["c"],
    }
