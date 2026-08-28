"""JSON API behind the admin console.

Everything here requires a session. Handlers validate, write, log to the
activity trail and answer `{ok: true, ...}` or `{ok: false, error: "..."}`.
"""

import csv
import io
from datetime import date, datetime

from flask import Blueprint, Response, jsonify, request

from core import activity, content, google_reviews, ops, uploads
from core import settings as cfg
from core.auth import change_password, current_user, login_required, password_problem
from core.db import delete, insert, now, q, q1, run, update
from core.money import iso, parse_date, plan_rollup, schedule, today

bp = Blueprint("api", __name__)
bp.before_request(login_required(lambda: None))


# ── input helpers ──────────────────────────────────────────────────────

def data() -> dict:
    return request.get_json(silent=True) or request.form.to_dict() or {}


def s(src, key, maxlen=400, default="") -> str:
    return str(src.get(key, default) or "").strip()[:maxlen]


def i(src, key, default=None):
    raw = src.get(key)
    if raw in (None, "", "null"):
        return default
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return default


def f(src, key, default=0.0) -> float:
    raw = src.get(key)
    if raw in (None, "", "null"):
        return default
    try:
        return float(str(raw).replace(",", ""))
    except (TypeError, ValueError):
        return default


def b(src, key, default=False) -> int:
    raw = src.get(key, default)
    if isinstance(raw, bool):
        return int(raw)
    return int(str(raw).strip().lower() in ("1", "true", "yes", "on"))


def fail(message, code=400):
    return jsonify(ok=False, error=message), code


def done(**extra):
    return jsonify(ok=True, **extra)


def me():
    return current_user()


def log(action, entity="", entity_id=None, summary=""):
    activity.log(action, entity, entity_id, summary, me())


# ── media ──────────────────────────────────────────────────────────────

def media_json(row) -> dict:
    return {
        "id": row["id"], "kind": row["kind"],
        "src": content.media_src(row), "thumb": content.media_src(row, True),
        "alt": row["alt"] or "", "name": row["original_name"] or "",
        "width": row["width"], "height": row["height"],
        "bytes": row["bytes"], "created_at": row["created_at"],
    }


@bp.get("/media")
def media_list():
    return done(items=[media_json(m) for m in content.all_media()])


@bp.post("/media")
def media_upload():
    files = request.files.getlist("file") or request.files.getlist("files")
    if not files:
        return fail("Choose at least one image to upload.")
    saved, errors = [], []
    for fs in files:
        mid, err = uploads.store(fs, request.form.get("alt", ""))
        if err:
            errors.append(f"{fs.filename}: {err}")
        else:
            saved.append(media_json(q1("SELECT * FROM media WHERE id = ?", (mid,))))
    if saved:
        log("upload", "media", None, f"Uploaded {len(saved)} image(s)")
    if not saved:
        return fail(" ".join(errors) or "Nothing was uploaded.")
    return done(items=saved, warnings=errors)


@bp.post("/media/remote")
def media_remote():
    d = data()
    url = s(d, "url", 800)
    if not url.startswith(("http://", "https://")):
        return fail("Paste a full image URL beginning with https://")
    mid = insert("media", {
        "kind": "remote", "filename": "", "thumb": url, "url": url,
        "original_name": url.rsplit("/", 1)[-1][:180], "mime": "image/*", "bytes": 0,
        "width": 0, "height": 0, "alt": s(d, "alt", 220), "created_at": now(),
    })
    log("create", "media", mid, "Linked an image by URL")
    return done(item=media_json(q1("SELECT * FROM media WHERE id = ?", (mid,))))


@bp.patch("/media/<int:mid>")
def media_patch(mid):
    row = q1("SELECT * FROM media WHERE id = ?", (mid,))
    if not row:
        return fail("That image no longer exists.", 404)
    update("media", mid, {"alt": s(data(), "alt", 220)})
    return done()


@bp.delete("/media/<int:mid>")
def media_delete(mid):
    row = q1("SELECT * FROM media WHERE id = ?", (mid,))
    if not row:
        return fail("That image no longer exists.", 404)
    used = (q1("SELECT COUNT(*) c FROM projects WHERE cover_id = ?", (mid,))["c"]
            + q1("SELECT COUNT(*) c FROM project_images WHERE media_id = ?", (mid,))["c"]
            + q1("SELECT COUNT(*) c FROM services WHERE image_id = ?", (mid,))["c"]
            + q1("SELECT COUNT(*) c FROM sections WHERE image_id = ?", (mid,))["c"])
    if used and not b(data(), "force"):
        return fail(f"That image is used in {used} place(s). Delete it anyway?", 409)
    uploads.remove_files(row)
    delete("media", mid)
    log("delete", "media", mid, f"Deleted image {row['original_name']}")
    return done()


# ── sections ───────────────────────────────────────────────────────────

@bp.put("/sections/<int:sid>")
def section_save(sid):
    row = q1("SELECT * FROM sections WHERE id = ?", (sid,))
    if not row:
        return fail("That section no longer exists.", 404)
    d = data()
    update("sections", sid, {
        "eyebrow": s(d, "eyebrow", 160),
        "heading": s(d, "heading", 300),
        "body": s(d, "body", 4000),
        "cta_label": s(d, "cta_label", 80),
        "cta_href": s(d, "cta_href", 300),
        "extra": s(d, "extra", 300),
        "image_id": i(d, "image_id"),
        "is_visible": b(d, "is_visible", True),
        "updated_at": now(),
    })
    log("update", "sections", sid, f"Edited the {row['name']} section")
    return done()


# ── services ───────────────────────────────────────────────────────────

def service_payload(d, sid=None):
    title = s(d, "title", 140)
    if not title:
        return None, "Give the service a title."
    return {
        "title": title,
        "slug": ops.unique_slug("services", s(d, "slug", 140) or title, sid),
        "summary": s(d, "summary", 500),
        "body": s(d, "body", 6000),
        "price_from": i(d, "price_from"),
        "price_note": s(d, "price_note", 120),
        "image_id": i(d, "image_id"),
        "is_visible": b(d, "is_visible", True),
        "updated_at": now(),
    }, None


@bp.post("/services")
def service_create():
    payload, err = service_payload(data())
    if err:
        return fail(err)
    payload["created_at"] = now()
    payload["position"] = (q1("SELECT COALESCE(MAX(position),0)+1 n FROM services") or {"n": 1})["n"]
    sid = insert("services", payload)
    log("create", "services", sid, f"Added service “{payload['title']}”")
    return done(id=sid)


@bp.put("/services/<int:sid>")
def service_update(sid):
    if not q1("SELECT id FROM services WHERE id = ?", (sid,)):
        return fail("That service no longer exists.", 404)
    payload, err = service_payload(data(), sid)
    if err:
        return fail(err)
    update("services", sid, payload)
    log("update", "services", sid, f"Edited service “{payload['title']}”")
    return done()


@bp.delete("/services/<int:sid>")
def service_delete(sid):
    row = q1("SELECT * FROM services WHERE id = ?", (sid,))
    if not row:
        return fail("That service no longer exists.", 404)
    delete("services", sid)
    log("delete", "services", sid, f"Deleted service “{row['title']}”")
    return done()


# ── projects ───────────────────────────────────────────────────────────

def project_payload(d, pid=None):
    title = s(d, "title", 160)
    if not title:
        return None, "Give the project a title."
    return {
        "title": title,
        "slug": ops.unique_slug("projects", s(d, "slug", 160) or title, pid),
        "category": s(d, "category", 80),
        "location": s(d, "location", 120),
        "year": s(d, "year", 20),
        "area": s(d, "area", 60),
        "summary": s(d, "summary", 600),
        "body": s(d, "body", 8000),
        "cover_id": i(d, "cover_id"),
        "is_visible": b(d, "is_visible", True),
        "is_featured": b(d, "is_featured"),
        "updated_at": now(),
    }, None


@bp.post("/projects")
def project_create():
    payload, err = project_payload(data())
    if err:
        return fail(err)
    payload["created_at"] = now()
    payload["position"] = (q1("SELECT COALESCE(MAX(position),0)+1 n FROM projects") or {"n": 1})["n"]
    pid = insert("projects", payload)
    log("create", "projects", pid, f"Added project “{payload['title']}”")
    return done(id=pid, slug=payload["slug"])


@bp.put("/projects/<int:pid>")
def project_update(pid):
    if not q1("SELECT id FROM projects WHERE id = ?", (pid,)):
        return fail("That project no longer exists.", 404)
    payload, err = project_payload(data(), pid)
    if err:
        return fail(err)
    update("projects", pid, payload)
    log("update", "projects", pid, f"Edited project “{payload['title']}”")
    return done(slug=payload["slug"])


@bp.delete("/projects/<int:pid>")
def project_delete(pid):
    row = q1("SELECT * FROM projects WHERE id = ?", (pid,))
    if not row:
        return fail("That project no longer exists.", 404)
    delete("projects", pid)
    log("delete", "projects", pid, f"Deleted project “{row['title']}”")
    return done()


@bp.post("/projects/<int:pid>/images")
def project_add_images(pid):
    if not q1("SELECT id FROM projects WHERE id = ?", (pid,)):
        return fail("That project no longer exists.", 404)
    ids = data().get("media_ids") or []
    if isinstance(ids, str):
        ids = [x for x in ids.split(",") if x.strip()]
    added = 0
    nxt = (q1("SELECT COALESCE(MAX(position),0)+1 n FROM project_images WHERE project_id = ?",
              (pid,)) or {"n": 1})["n"]
    for mid in ids:
        try:
            mid = int(mid)
        except (TypeError, ValueError):
            continue
        if not q1("SELECT id FROM media WHERE id = ?", (mid,)):
            continue
        if q1("SELECT id FROM project_images WHERE project_id = ? AND media_id = ?", (pid, mid)):
            continue
        m = q1("SELECT alt FROM media WHERE id = ?", (mid,))
        insert("project_images", {"project_id": pid, "media_id": mid,
                                  "caption": m["alt"] or "", "position": nxt + added})
        added += 1
    return done(added=added, images=content.project_images(pid))


@bp.patch("/project-images/<int:iid>")
def project_image_patch(iid):
    if not q1("SELECT id FROM project_images WHERE id = ?", (iid,)):
        return fail("That image is no longer attached.", 404)
    update("project_images", iid, {"caption": s(data(), "caption", 300)})
    return done()


@bp.delete("/project-images/<int:iid>")
def project_image_delete(iid):
    row = q1("SELECT * FROM project_images WHERE id = ?", (iid,))
    if not row:
        return fail("That image is no longer attached.", 404)
    delete("project_images", iid)
    return done(images=content.project_images(row["project_id"]))


# ── process steps and stats ────────────────────────────────────────────

@bp.post("/process")
def process_create():
    d = data()
    title = s(d, "title", 140)
    if not title:
        return fail("Give the step a title.")
    sid = insert("process_steps", {
        "title": title, "body": s(d, "body", 2000), "duration": s(d, "duration", 60),
        "is_visible": b(d, "is_visible", True),
        "position": (q1("SELECT COALESCE(MAX(position),0)+1 n FROM process_steps") or {"n": 1})["n"],
    })
    log("create", "process_steps", sid, f"Added process step “{title}”")
    return done(id=sid)


@bp.put("/process/<int:sid>")
def process_update(sid):
    if not q1("SELECT id FROM process_steps WHERE id = ?", (sid,)):
        return fail("That step no longer exists.", 404)
    d = data()
    update("process_steps", sid, {
        "title": s(d, "title", 140), "body": s(d, "body", 2000),
        "duration": s(d, "duration", 60), "is_visible": b(d, "is_visible", True),
    })
    log("update", "process_steps", sid, "Edited a process step")
    return done()


@bp.delete("/process/<int:sid>")
def process_delete(sid):
    delete("process_steps", sid)
    log("delete", "process_steps", sid, "Deleted a process step")
    return done()


@bp.post("/stats")
def stat_create():
    d = data()
    if not s(d, "label", 80):
        return fail("Give the figure a label.")
    sid = insert("stats", {
        "label": s(d, "label", 80), "value": s(d, "value", 20), "suffix": s(d, "suffix", 10),
        "is_visible": b(d, "is_visible", True),
        "position": (q1("SELECT COALESCE(MAX(position),0)+1 n FROM stats") or {"n": 1})["n"],
    })
    return done(id=sid)


@bp.put("/stats/<int:sid>")
def stat_update(sid):
    if not q1("SELECT id FROM stats WHERE id = ?", (sid,)):
        return fail("That figure no longer exists.", 404)
    d = data()
    update("stats", sid, {"label": s(d, "label", 80), "value": s(d, "value", 20),
                          "suffix": s(d, "suffix", 10), "is_visible": b(d, "is_visible", True)})
    return done()


@bp.delete("/stats/<int:sid>")
def stat_delete(sid):
    delete("stats", sid)
    return done()


# ── reordering ─────────────────────────────────────────────────────────

REORDERABLE = {"services", "projects", "process_steps", "stats", "testimonials",
               "sections", "project_images"}


@bp.post("/reorder")
def reorder():
    d = data()
    table = s(d, "table", 40)
    ids = d.get("ids") or []
    if table not in REORDERABLE:
        return fail("That list cannot be reordered.")
    for pos, rid in enumerate(ids, start=1):
        try:
            run(f"UPDATE {table} SET position = ? WHERE id = ?", (pos, int(rid)))
        except (TypeError, ValueError):
            continue
    return done()


@bp.post("/toggle")
def toggle():
    """Flip a visible/featured flag on any content row."""
    d = data()
    table = s(d, "table", 40)
    field = s(d, "field", 30)
    rid = i(d, "id")
    if table not in REORDERABLE or field not in ("is_visible", "is_featured"):
        return fail("That switch is not available here.")
    row = q1(f"SELECT * FROM {table} WHERE id = ?", (rid,))
    if not row:
        return fail("That item no longer exists.", 404)
    value = b(d, "value", not row[field])
    run(f"UPDATE {table} SET {field} = ? WHERE id = ?", (value, rid))
    return done(value=value)


# ── testimonials and Google ────────────────────────────────────────────

@bp.post("/testimonials")
def testimonial_create():
    d = data()
    author = s(d, "author", 120)
    body = s(d, "body", 3000)
    if not author or not body:
        return fail("A review needs a name and some words.")
    tid = insert("testimonials", {
        "source": "manual", "google_review_id": None, "author": author,
        "author_photo": s(d, "author_photo", 500), "role": s(d, "role", 140),
        "rating": max(1, min(5, i(d, "rating", 5))), "body": body,
        "review_time": s(d, "review_time", 30) or iso(today()),
        "relative_time": s(d, "relative_time", 60), "profile_url": s(d, "profile_url", 500),
        "is_visible": b(d, "is_visible", True), "is_featured": b(d, "is_featured"),
        "position": (q1("SELECT COALESCE(MAX(position),0)+1 n FROM testimonials") or {"n": 1})["n"],
        "created_at": now(),
    })
    log("create", "testimonials", tid, f"Added a review from {author}")
    return done(id=tid)


@bp.put("/testimonials/<int:tid>")
def testimonial_update(tid):
    row = q1("SELECT * FROM testimonials WHERE id = ?", (tid,))
    if not row:
        return fail("That review no longer exists.", 404)
    d = data()
    payload = {
        "role": s(d, "role", 140),
        "is_visible": b(d, "is_visible", True),
        "is_featured": b(d, "is_featured"),
    }
    # Google's own text is left alone — editing it would misrepresent the review.
    if row["source"] == "manual":
        payload.update({
            "author": s(d, "author", 120) or row["author"],
            "body": s(d, "body", 3000) or row["body"],
            "rating": max(1, min(5, i(d, "rating", row["rating"]))),
            "author_photo": s(d, "author_photo", 500),
        })
    update("testimonials", tid, payload)
    log("update", "testimonials", tid, f"Edited the review from {row['author']}")
    return done()


@bp.delete("/testimonials/<int:tid>")
def testimonial_delete(tid):
    row = q1("SELECT * FROM testimonials WHERE id = ?", (tid,))
    if not row:
        return fail("That review no longer exists.", 404)
    if row["source"] == "google":
        return fail("Google reviews come back on the next sync. Hide it instead.", 409)
    delete("testimonials", tid)
    log("delete", "testimonials", tid, f"Deleted the review from {row['author']}")
    return done()


@bp.post("/google/sync")
def google_sync():
    result = google_reviews.sync(force=True)
    if result.get("ok"):
        log("sync", "testimonials", None, result.get("message", "Synced Google reviews"))
    return jsonify(dict(result, summary=google_reviews.summary()))


@bp.post("/google/search")
def google_search():
    d = data()
    key = s(d, "api_key", 200) or (cfg.get("google_api_key") or "")
    try:
        return done(places=google_reviews.search_places(key, s(d, "query", 200)))
    except google_reviews.GoogleError as e:
        return fail(str(e))


@bp.post("/google/test")
def google_test():
    d = data()
    key = s(d, "api_key", 200) or (cfg.get("google_api_key") or "")
    pid = s(d, "place_id", 200) or (cfg.get("google_place_id") or "")
    try:
        place = google_reviews.fetch_place(key, pid)
    except google_reviews.GoogleError as e:
        return fail(str(e))
    return done(name=place["name"], rating=place["rating"], total=place["total"],
                reviews=len(place["reviews"]), api=place["api"])


# ── enquiries ──────────────────────────────────────────────────────────

@bp.patch("/enquiries/<int:eid>")
def enquiry_patch(eid):
    row = q1("SELECT * FROM enquiries WHERE id = ?", (eid,))
    if not row:
        return fail("That enquiry no longer exists.", 404)
    d = data()
    payload = {"updated_at": now()}
    bits = []

    if "status" in d:
        st = s(d, "status", 20)
        if st not in ops.ENQUIRY_STATUSES:
            return fail("That is not a status we track.")
        payload["status"] = st
        if st != "new":
            payload["last_contacted_at"] = now()
        bits.append(f"status → {ops.ENQUIRY_STATUSES[st]}")
    if "priority" in d:
        pr = s(d, "priority", 20)
        if pr not in ops.PRIORITIES:
            return fail("That is not a priority we track.")
        payload["priority"] = pr
        bits.append(f"priority → {ops.PRIORITIES[pr]}")
    if "is_archived" in d:
        payload["is_archived"] = b(d, "is_archived")
        bits.append("archived" if payload["is_archived"] else "restored")
    if "contacted" in d:
        payload["last_contacted_at"] = now()
        bits.append("marked as contacted")

    update("enquiries", eid, payload)
    log("update", "enquiries", eid, f"{row['ref']} — " + (", ".join(bits) or "updated"))
    return done(enquiry=ops.enquiry_detail(eid))


@bp.post("/enquiries/<int:eid>/notes")
def enquiry_note(eid):
    if not q1("SELECT id FROM enquiries WHERE id = ?", (eid,)):
        return fail("That enquiry no longer exists.", 404)
    body = s(data(), "body", 3000)
    if not body:
        return fail("Type a note first.")
    user = me()
    insert("enquiry_notes", {
        "enquiry_id": eid, "body": body,
        "author": (user["name"] if user else "Studio"), "created_at": now(),
    })
    run("UPDATE enquiries SET updated_at = ? WHERE id = ?", (now(), eid))
    return done(enquiry=ops.enquiry_detail(eid))


@bp.delete("/enquiries/<int:eid>")
def enquiry_delete(eid):
    row = q1("SELECT * FROM enquiries WHERE id = ?", (eid,))
    if not row:
        return fail("That enquiry no longer exists.", 404)
    delete("enquiries", eid)
    log("delete", "enquiries", eid, f"Deleted enquiry {row['ref']}")
    return done()


@bp.get("/enquiries/<int:eid>")
def enquiry_get(eid):
    row = ops.enquiry_detail(eid)
    if not row:
        return fail("That enquiry no longer exists.", 404)
    return done(enquiry=row)


@bp.post("/enquiries/<int:eid>/convert")
def enquiry_convert(eid):
    """Turn a won enquiry into a client record without retyping anything."""
    row = q1("SELECT * FROM enquiries WHERE id = ?", (eid,))
    if not row:
        return fail("That enquiry no longer exists.", 404)
    existing = None
    if row["email"]:
        existing = q1("SELECT * FROM clients WHERE lower(email) = lower(?)", (row["email"],))
    if existing:
        return done(id=existing["id"], existed=True, name=existing["name"])
    cid = insert("clients", {
        "name": row["name"], "email": row["email"], "phone": row["phone"],
        "address": "", "city": row["city"],
        "notes": f"From enquiry {row['ref']}.", "created_at": now(),
    })
    update("enquiries", eid, {"status": "won", "updated_at": now()})
    log("create", "clients", cid, f"Created client {row['name']} from {row['ref']}")
    return done(id=cid, existed=False, name=row["name"])


@bp.get("/enquiries.csv")
def enquiries_csv():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Reference", "Received", "Name", "Email", "Phone", "City", "Service",
                "Budget", "Timeline", "Source", "Status", "Priority", "Message"])
    for r in ops.enquiry_rows(status=request.args.get("status"), limit=5000):
        w.writerow([r["ref"], (r["created_at"] or "")[:10], r["name"], r["email"], r["phone"],
                    r["city"], r["service_title"] or "", r["budget_band"], r["timeline"],
                    r["source"], ops.ENQUIRY_STATUSES.get(r["status"], r["status"]),
                    r["priority"], (r["message"] or "").replace("\n", " ")])
    stamp = date.today().isoformat()
    return Response(buf.getvalue(), mimetype="text/csv", headers={
        "Content-Disposition": f'attachment; filename="enquiries-{stamp}.csv"'})


# ── clients ────────────────────────────────────────────────────────────

@bp.post("/clients")
def client_create():
    d = data()
    name = s(d, "name", 140)
    if not name:
        return fail("Give the client a name.")
    cid = insert("clients", {
        "name": name, "email": s(d, "email", 160), "phone": s(d, "phone", 40),
        "address": s(d, "address", 300), "city": s(d, "city", 80),
        "notes": s(d, "notes", 2000), "created_at": now(),
    })
    log("create", "clients", cid, f"Added client {name}")
    return done(id=cid)


@bp.put("/clients/<int:cid>")
def client_update(cid):
    if not q1("SELECT id FROM clients WHERE id = ?", (cid,)):
        return fail("That client no longer exists.", 404)
    d = data()
    update("clients", cid, {
        "name": s(d, "name", 140), "email": s(d, "email", 160), "phone": s(d, "phone", 40),
        "address": s(d, "address", 300), "city": s(d, "city", 80), "notes": s(d, "notes", 2000),
    })
    log("update", "clients", cid, "Edited a client")
    return done()


@bp.delete("/clients/<int:cid>")
def client_delete(cid):
    row = q1("SELECT * FROM clients WHERE id = ?", (cid,))
    if not row:
        return fail("That client no longer exists.", 404)
    plans = q1("SELECT COUNT(*) c FROM payment_plans WHERE client_id = ?", (cid,))["c"]
    if plans and not b(data(), "force"):
        return fail(f"{row['name']} has {plans} payment plan(s). "
                    "Deleting the client removes them too. Continue?", 409)
    delete("clients", cid)
    log("delete", "clients", cid, f"Deleted client {row['name']}")
    return done()


# ── payment plans ──────────────────────────────────────────────────────

def plan_inputs(d):
    return dict(
        total=f(d, "total_amount"),
        discount=f(d, "discount"),
        downpayment=f(d, "downpayment"),
        interest_type=(s(d, "interest_type", 20) or "none"),
        interest_pct=f(d, "interest_pct"),
        tenure=max(1, min(120, i(d, "tenure_months", 6) or 6)),
        start=s(d, "start_date", 20) or iso(today()),
    )


@bp.post("/plans/preview")
def plan_preview():
    p = plan_inputs(data())
    if p["total"] <= 0:
        return fail("Enter the project value first.")
    if p["downpayment"] > p["total"] - p["discount"]:
        return fail("The advance cannot be more than the project value.")
    rows, summary = schedule(p["total"], p["discount"], p["downpayment"],
                             p["interest_type"], p["interest_pct"], p["tenure"], p["start"])
    return done(rows=rows, summary=summary)


@bp.post("/plans")
def plan_create():
    d = data()
    cid = i(d, "client_id")
    if not cid or not q1("SELECT id FROM clients WHERE id = ?", (cid,)):
        return fail("Choose a client for this plan.")
    title = s(d, "title", 200)
    if not title:
        return fail("Give the plan a title, such as the project name.")
    p = plan_inputs(d)
    if p["total"] <= 0:
        return fail("Enter the project value first.")
    if p["downpayment"] > p["total"] - p["discount"]:
        return fail("The advance cannot be more than the project value.")

    rows, _ = schedule(p["total"], p["discount"], p["downpayment"], p["interest_type"],
                       p["interest_pct"], p["tenure"], p["start"])
    year = date.today().year
    seq = (q1("SELECT COUNT(*) c FROM payment_plans WHERE ref LIKE ?",
              (f"PLAN-{year}-%",)) or {"c": 0})["c"] + 1
    plan_id = insert("payment_plans", {
        "ref": f"PLAN-{year}-{seq:03d}", "client_id": cid, "title": title,
        "total_amount": p["total"], "discount": p["discount"], "downpayment": p["downpayment"],
        "interest_type": p["interest_type"], "interest_pct": p["interest_pct"],
        "tenure_months": p["tenure"], "start_date": p["start"], "status": "active",
        "note": s(d, "note", 2000), "created_at": now(), "updated_at": now(),
    })
    for r in rows:
        insert("installments", {
            "plan_id": plan_id, "seq": r["seq"], "label": r["label"],
            "due_date": r["due_date"], "amount": r["amount"], "paid_amount": 0,
            "paid_on": None, "method": "", "reference": "", "note": "",
        })
    log("create", "payment_plans", plan_id, f"Created payment plan “{title}”")
    return done(id=plan_id)


@bp.put("/plans/<int:plan_id>")
def plan_update(plan_id):
    row = q1("SELECT * FROM payment_plans WHERE id = ?", (plan_id,))
    if not row:
        return fail("That plan no longer exists.", 404)
    d = data()
    payload = {"title": s(d, "title", 200) or row["title"],
               "note": s(d, "note", 2000), "updated_at": now()}
    if "status" in d:
        st = s(d, "status", 20)
        if st not in ("active", "completed", "cancelled"):
            return fail("That is not a plan status.")
        payload["status"] = st
    update("payment_plans", plan_id, payload)
    log("update", "payment_plans", plan_id, f"Edited plan {row['ref']}")
    return done()


@bp.post("/plans/<int:plan_id>/reschedule")
def plan_reschedule(plan_id):
    """Rebuild the unpaid tail of a schedule after a change of terms."""
    row = q1("SELECT * FROM payment_plans WHERE id = ?", (plan_id,))
    if not row:
        return fail("That plan no longer exists.", 404)
    paid = q("SELECT * FROM installments WHERE plan_id = ? AND paid_amount > 0 ORDER BY seq",
             (plan_id,))
    p = plan_inputs(data())
    collected = sum(float(r["paid_amount"] or 0) for r in paid)
    if p["total"] <= 0:
        return fail("Enter the project value first.")

    rows, _ = schedule(p["total"], p["discount"], p["downpayment"] + collected,
                       p["interest_type"], p["interest_pct"], p["tenure"], p["start"])
    run("DELETE FROM installments WHERE plan_id = ? AND paid_amount <= 0", (plan_id,))
    offset = len(paid)
    for r in rows:
        insert("installments", {
            "plan_id": plan_id, "seq": offset + r["seq"],
            "label": f"Instalment {offset + r['seq']}", "due_date": r["due_date"],
            "amount": r["amount"], "paid_amount": 0, "paid_on": None,
            "method": "", "reference": "", "note": "",
        })
    update("payment_plans", plan_id, {
        "total_amount": p["total"], "discount": p["discount"], "downpayment": p["downpayment"],
        "interest_type": p["interest_type"], "interest_pct": p["interest_pct"],
        "tenure_months": p["tenure"], "start_date": p["start"], "updated_at": now(),
    })
    log("update", "payment_plans", plan_id, f"Rescheduled the unpaid part of {row['ref']}")
    return done(plan=ops.plan_detail(plan_id))


@bp.delete("/plans/<int:plan_id>")
def plan_delete(plan_id):
    row = q1("SELECT * FROM payment_plans WHERE id = ?", (plan_id,))
    if not row:
        return fail("That plan no longer exists.", 404)
    delete("payment_plans", plan_id)
    log("delete", "payment_plans", plan_id, f"Deleted plan {row['ref']}")
    return done()


@bp.patch("/installments/<int:inst_id>")
def installment_patch(inst_id):
    row = q1("SELECT i.*, p.ref AS plan_ref, p.id AS pid FROM installments i "
             "JOIN payment_plans p ON p.id = i.plan_id WHERE i.id = ?", (inst_id,))
    if not row:
        return fail("That instalment no longer exists.", 404)
    d = data()
    payload = {}

    if "full" in d and b(d, "full"):
        payload["paid_amount"] = float(row["amount"] or 0)
        payload["paid_on"] = s(d, "paid_on", 20) or iso(today())
    elif "paid_amount" in d:
        amount = f(d, "paid_amount")
        if amount < 0:
            return fail("A payment cannot be negative.")
        if amount > float(row["amount"] or 0) + 0.5:
            return fail("That is more than this instalment. Reduce it, or edit the plan.")
        payload["paid_amount"] = amount
        payload["paid_on"] = (s(d, "paid_on", 20) or iso(today())) if amount > 0 else None

    if "clear" in d and b(d, "clear"):
        payload.update({"paid_amount": 0, "paid_on": None, "method": "", "reference": ""})
    if "method" in d:
        payload["method"] = s(d, "method", 40)
    if "reference" in d:
        payload["reference"] = s(d, "reference", 80)
    if "note" in d:
        payload["note"] = s(d, "note", 400)
    if "due_date" in d:
        due = parse_date(s(d, "due_date", 20))
        if not due:
            return fail("That due date could not be read.")
        payload["due_date"] = iso(due)

    if not payload:
        return fail("Nothing to change.")
    update("installments", inst_id, payload)

    plan = ops.plan_detail(row["pid"])
    # Close the plan automatically once the last rupee lands.
    if plan and plan["roll"]["is_settled"] and plan["status"] == "active":
        update("payment_plans", row["pid"], {"status": "completed", "updated_at": now()})
        plan = ops.plan_detail(row["pid"])
    log("payment", "installments", inst_id,
        f"{row['plan_ref']} instalment {row['seq']} updated")
    return done(plan=plan)


@bp.get("/payments.csv")
def payments_csv():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["Plan", "Client", "Project", "Instalment", "Due", "Amount",
                "Paid", "Paid on", "Method", "Reference", "Status"])
    for r in q("SELECT i.*, p.ref, p.title, c.name FROM installments i "
               "JOIN payment_plans p ON p.id = i.plan_id "
               "JOIN clients c ON c.id = p.client_id ORDER BY p.id, i.seq"):
        from core.money import installment_status as st
        w.writerow([r["ref"], r["name"], r["title"], r["seq"], r["due_date"],
                    r["amount"], r["paid_amount"], r["paid_on"] or "", r["method"],
                    r["reference"], st(r)])
    stamp = date.today().isoformat()
    return Response(buf.getvalue(), mimetype="text/csv", headers={
        "Content-Disposition": f'attachment; filename="payments-{stamp}.csv"'})


# ── settings and account ───────────────────────────────────────────────

@bp.post("/settings")
def settings_save():
    d = data()
    # An unchanged masked secret must not overwrite the real one.
    if "google_api_key" in d and set(str(d["google_api_key"])) <= {"•"} and d["google_api_key"]:
        d.pop("google_api_key")
    saved = cfg.set_many(d)
    log("update", "settings", None, f"Updated {len(saved)} setting(s)")
    return done(saved=saved, google=google_reviews.summary())


@bp.post("/account/password")
def account_password():
    d = data()
    user = me()
    from core.auth import verify
    if not verify(user, s(d, "current", 200)):
        return fail("That is not your current password.")
    new = s(d, "next", 200)
    problem = password_problem(new)
    if problem:
        return fail(problem)
    if new != s(d, "confirm", 200):
        return fail("The two new passwords do not match.")
    change_password(user["id"], new)
    log("update", "users", user["id"], "Changed the account password")
    return done()


@bp.post("/account/profile")
def account_profile():
    d = data()
    user = me()
    name = s(d, "name", 120)
    email = s(d, "email", 160)
    if not name or not email:
        return fail("Both a name and an email are needed.")
    clash = q1("SELECT id FROM users WHERE lower(email) = lower(?) AND id <> ?",
               (email, user["id"]))
    if clash:
        return fail("Another account already uses that email.")
    update("users", user["id"], {"name": name, "email": email})
    log("update", "users", user["id"], "Updated the account profile")
    return done()
