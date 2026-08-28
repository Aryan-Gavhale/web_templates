"""Image intake for the media library.

Uploads are re-encoded to a sane web size plus a thumbnail, so the owner can
drop a 12 MP phone photo in and the site still loads quickly.
"""

import os
import re
import uuid
from datetime import datetime

from PIL import Image, ImageOps

from .db import UPLOAD_DIR, insert, now

MAX_EDGE = 2000
THUMB_EDGE = 560
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/avif", "image/gif"}
ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}
MAX_BYTES = 12 * 1024 * 1024


def safe_stem(name: str) -> str:
    stem = os.path.splitext(os.path.basename(name or "image"))[0]
    stem = re.sub(r"[^a-zA-Z0-9]+", "-", stem).strip("-").lower()
    return (stem or "image")[:48]


def _month_dir():
    d = datetime.now()
    rel = f"{d.year:04d}/{d.month:02d}"
    os.makedirs(os.path.join(UPLOAD_DIR, rel), exist_ok=True)
    return rel


def store(file_storage, alt: str = ""):
    """Save an uploaded image. Returns (media_id, None) or (None, error)."""
    if file_storage is None or not file_storage.filename:
        return None, "No file was received."

    ext = os.path.splitext(file_storage.filename)[1].lower()
    if ext not in ALLOWED_EXT:
        return None, f"{ext or 'That file type'} is not supported. Use JPG, PNG or WebP."

    raw = file_storage.read()
    if len(raw) > MAX_BYTES:
        return None, f"That file is {len(raw) / 1048576:.1f} MB. The limit is 12 MB."
    if not raw:
        return None, "That file is empty."

    file_storage.stream.seek(0)
    try:
        img = Image.open(file_storage.stream)
        img = ImageOps.exif_transpose(img)          # honour phone rotation
        img.load()
    except Exception:
        return None, "That file could not be read as an image."

    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        flat = Image.new("RGB", img.size, (255, 255, 255))
        flat.paste(img, mask=img.split()[-1] if img.mode == "RGBA" else None)
        img = flat
    elif img.mode != "RGB":
        img = img.convert("RGB")

    rel_dir = _month_dir()
    stem = f"{safe_stem(file_storage.filename)}-{uuid.uuid4().hex[:8]}"
    main_rel = f"{rel_dir}/{stem}.jpg"
    thumb_rel = f"{rel_dir}/{stem}-t.jpg"

    web = img.copy()
    web.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
    web.save(os.path.join(UPLOAD_DIR, main_rel), "JPEG", quality=86, optimize=True, progressive=True)

    thumb = img.copy()
    thumb.thumbnail((THUMB_EDGE, THUMB_EDGE), Image.LANCZOS)
    thumb.save(os.path.join(UPLOAD_DIR, thumb_rel), "JPEG", quality=80, optimize=True)

    media_id = insert("media", {
        "kind": "local",
        "filename": main_rel,
        "thumb": thumb_rel,
        "url": "",
        "original_name": file_storage.filename[:180],
        "mime": "image/jpeg",
        "bytes": os.path.getsize(os.path.join(UPLOAD_DIR, main_rel)),
        "width": web.width,
        "height": web.height,
        "alt": (alt or "").strip()[:220],
        "created_at": now(),
    })
    return media_id, None


def remove_files(row) -> None:
    """Delete the files behind a local media row. Missing files are fine."""
    if not row or row["kind"] != "local":
        return
    for rel in (row["filename"], row["thumb"]):
        if not rel:
            continue
        path = os.path.join(UPLOAD_DIR, rel)
        try:
            if os.path.isfile(path):
                os.remove(path)
        except OSError:
            pass
