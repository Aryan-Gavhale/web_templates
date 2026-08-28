"""The public website. Every string on it comes out of the database."""

import re
from datetime import date

from flask import (Blueprint, abort, jsonify, redirect, render_template,
                   request, url_for)

from core import activity, content, google_reviews
from core import settings as cfg
from core.db import insert, now, q1

bp = Blueprint("public", __name__)

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[a-zA-Z]{2,}$")
PHONE_RE = re.compile(r"^[+()\d][\d\s\-()]{7,19}$")


def theme():
    """The bundle every public page needs."""
    s = cfg.public_settings()
    return {
        "s": s,
        "sec": content.sections_map(),
        "services": content.services(),
        "year": date.today().year,
        "google": google_reviews.summary(),
    }


@bp.route("/")
def home():
    google_reviews.sync_if_stale()
    ctx = theme()
    ctx.update(
        projects=content.projects(limit=6),
        steps=content.process_steps(),
        stats=content.stats(),
        reviews=content.testimonials(limit=12),
        budgets=cfg.get_list("budget_bands"),
        timelines=cfg.get_list("timelines"),
    )
    return render_template("public/home.html", **ctx)


@bp.route("/work/<slug>")
def project(slug):
    proj = content.project_by_slug(slug)
    if not proj:
        abort(404)
    others = [p for p in content.projects() if p["slug"] != slug][:3]
    ctx = theme()
    ctx.update(p=proj, others=others)
    return render_template("public/project.html", **ctx)


@bp.route("/services/<slug>")
def service(slug):
    row = q1("SELECT * FROM services WHERE slug = ? AND is_visible = 1", (slug,))
    if not row:
        abort(404)
    item = dict(row)
    item["image"] = content.media_url(row["image_id"]) or content.PLACEHOLDER
    ctx = theme()
    ctx.update(
        item=item,
        others=[x for x in ctx["services"] if x["slug"] != slug][:3],
        projects=content.projects(limit=3),
        budgets=cfg.get_list("budget_bands"),
        timelines=cfg.get_list("timelines"),
    )
    return render_template("public/service.html", **ctx)


def _next_ref() -> str:
    stamp = date.today().strftime("%y%m")
    row = q1("SELECT COUNT(*) AS c FROM enquiries WHERE ref LIKE ?", (f"ENQ-{stamp}-%",))
    return f"ENQ-{stamp}-{(row['c'] if row else 0) + 1:03d}"


@bp.route("/enquiry", methods=["POST"])
def enquiry():
    """Accepts the contact form. Answers JSON so the page never reloads."""
    f = request.form
    if (f.get("company") or "").strip():          # honeypot
        return jsonify(ok=True, message=cfg.get("enquiry_success_message"))

    name = (f.get("name") or "").strip()
    email = (f.get("email") or "").strip()
    phone = (f.get("phone") or "").strip()
    message = (f.get("message") or "").strip()

    errors = {}
    if len(name) < 2:
        errors["name"] = "Please tell us your name."
    if not email and not phone:
        errors["email"] = "Leave an email or a phone number so we can reply."
    elif email and not EMAIL_RE.match(email):
        errors["email"] = "That email address doesn't look right."
    if phone and not PHONE_RE.match(phone):
        errors["phone"] = "That phone number doesn't look right."
    if len(message) < 10:
        errors["message"] = "A sentence or two about the space would help."
    if errors:
        return jsonify(ok=False, errors=errors), 422

    service_id = None
    if (f.get("service") or "").isdigit():
        hit = q1("SELECT id FROM services WHERE id = ?", (int(f["service"]),))
        service_id = hit["id"] if hit else None

    ref = _next_ref()
    eid = insert("enquiries", {
        "ref": ref, "name": name[:120], "email": email[:160], "phone": phone[:40],
        "city": (f.get("city") or "").strip()[:80], "service_id": service_id,
        "budget_band": (f.get("budget") or "").strip()[:60],
        "timeline": (f.get("timeline") or "").strip()[:60],
        "message": message[:4000],
        "source": (f.get("source") or "website").strip()[:40],
        "status": "new", "priority": "normal", "is_archived": 0,
        "created_at": now(), "updated_at": now(),
    })
    activity.log("enquiry", "enquiries", eid, f"{ref} — new enquiry from {name}")
    return jsonify(ok=True, ref=ref, message=cfg.get("enquiry_success_message"))


@bp.route("/robots.txt")
def robots():
    body = "User-agent: *\nDisallow: /admin\nDisallow: /api\nAllow: /\n"
    return body, 200, {"Content-Type": "text/plain"}


@bp.app_errorhandler(404)
def not_found(_e):
    try:
        return render_template("public/404.html", **theme()), 404
    except Exception:
        return redirect(url_for("public.home"))
