"""Read helpers shared by the public theme and the admin."""

from .db import q, q1

PLACEHOLDER = ("https://images.unsplash.com/photo-1503389152951-9f343605f61e"
               "?auto=format&fit=crop&w=1600&q=80")


def media_src(row, thumb: bool = False) -> str:
    """Resolve a media row to a URL, whether it is remote or uploaded."""
    if not row:
        return ""
    kind = row["kind"] if "kind" in row.keys() else "local"
    if kind == "remote":
        if thumb and row["thumb"]:
            return row["thumb"]
        return row["url"] or row["thumb"] or ""
    rel = (row["thumb"] if thumb and row["thumb"] else row["filename"]) or ""
    return f"/uploads/{rel}" if rel else ""


def media(media_id):
    return q1("SELECT * FROM media WHERE id = ?", (media_id,)) if media_id else None


def media_url(media_id, thumb: bool = False) -> str:
    return media_src(media(media_id), thumb)


def all_media(limit: int = 400) -> list:
    return q("SELECT * FROM media ORDER BY id DESC LIMIT ?", (limit,))


# ── sections ───────────────────────────────────────────────────────────

def sections_map() -> dict:
    """Every section keyed by its slug, with the image resolved.

    Missing or hidden sections return a blank stand-in so the template can
    always read `sec.hero.heading` without guarding.
    """
    out = {}
    for row in q("SELECT * FROM sections ORDER BY position, id"):
        d = dict(row)
        d["image"] = media_url(row["image_id"])
        d["visible"] = bool(row["is_visible"])
        out[row["key"]] = d
    return _Defaulting(out)


class _Defaulting(dict):
    BLANK = {"key": "", "name": "", "eyebrow": "", "heading": "", "body": "",
             "cta_label": "", "cta_href": "", "extra": "", "image": "",
             "visible": False, "is_visible": 0}

    def __missing__(self, key):
        return dict(self.BLANK, key=key)

    def __getattr__(self, key):
        # Dunder lookups (Jinja probes for __html__, copy protocols and so on)
        # must still raise, or the caller gets a dict where it expected a method.
        if key.startswith("__") and key.endswith("__"):
            raise AttributeError(key)
        return self[key]


# ── lists ──────────────────────────────────────────────────────────────

def services(visible_only: bool = True) -> list:
    sql = "SELECT * FROM services"
    if visible_only:
        sql += " WHERE is_visible = 1"
    sql += " ORDER BY position, id"
    out = []
    for r in q(sql):
        d = dict(r)
        d["image"] = media_url(r["image_id"])
        d["thumb"] = media_url(r["image_id"], thumb=True)
        out.append(d)
    return out


def projects(visible_only: bool = True, featured_only: bool = False, limit=None) -> list:
    where = []
    if visible_only:
        where.append("is_visible = 1")
    if featured_only:
        where.append("is_featured = 1")
    sql = "SELECT * FROM projects"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY position, id"
    if limit:
        sql += f" LIMIT {int(limit)}"
    out = []
    for r in q(sql):
        d = dict(r)
        d["cover"] = media_url(r["cover_id"]) or PLACEHOLDER
        d["thumb"] = media_url(r["cover_id"], thumb=True) or PLACEHOLDER
        out.append(d)
    return out


def project_by_slug(slug: str):
    row = q1("SELECT * FROM projects WHERE slug = ? AND is_visible = 1", (slug,))
    if not row:
        return None
    d = dict(row)
    d["cover"] = media_url(row["cover_id"]) or PLACEHOLDER
    d["gallery"] = [{
        "src": media_src(g, False),
        "thumb": media_src(g, True),
        "alt": g["alt"] or d["title"],
        "caption": g["caption"],
    } for g in q(
        "SELECT m.*, pi.caption, pi.position FROM project_images pi "
        "JOIN media m ON m.id = pi.media_id WHERE pi.project_id = ? "
        "ORDER BY pi.position, pi.id", (row["id"],))]
    return d


def project_images(project_id: int) -> list:
    return [{
        "id": g["pi_id"], "media_id": g["id"], "src": media_src(g, True),
        "alt": g["alt"], "caption": g["caption"], "position": g["position"],
    } for g in q(
        "SELECT m.*, pi.id AS pi_id, pi.caption, pi.position FROM project_images pi "
        "JOIN media m ON m.id = pi.media_id WHERE pi.project_id = ? "
        "ORDER BY pi.position, pi.id", (project_id,))]


def process_steps(visible_only: bool = True) -> list:
    sql = "SELECT * FROM process_steps"
    if visible_only:
        sql += " WHERE is_visible = 1"
    return q(sql + " ORDER BY position, id")


def stats(visible_only: bool = True) -> list:
    sql = "SELECT * FROM stats"
    if visible_only:
        sql += " WHERE is_visible = 1"
    return q(sql + " ORDER BY position, id")


def testimonials(visible_only: bool = True, limit=None) -> list:
    sql = "SELECT * FROM testimonials"
    if visible_only:
        sql += " WHERE is_visible = 1"
    sql += " ORDER BY is_featured DESC, position, id"
    if limit:
        sql += f" LIMIT {int(limit)}"
    return q(sql)


def tile_spans(count: int) -> list:
    """Column spans that always tile the 6-column work grid completely.

    Rows alternate wide-then-narrow so the rhythm never repeats, and a lone
    trailing project takes the full width rather than leaving a hole.
    """
    spans = []
    i = 0
    flip = False
    while i < count:
        if count - i == 1:
            spans.append(6)
            i += 1
        else:
            spans.extend([2, 4] if flip else [4, 2])
            i += 2
            flip = not flip
    return spans


def categories() -> list:
    rows = q("SELECT DISTINCT category FROM projects "
             "WHERE is_visible = 1 AND category <> '' ORDER BY category")
    return [r["category"] for r in rows]
