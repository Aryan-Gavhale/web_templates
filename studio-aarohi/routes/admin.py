"""Admin console pages. Mutation lives in routes/api.py; these render state."""

from datetime import datetime

from flask import Blueprint, abort, redirect, render_template, request, url_for

from core import activity, content, google_reviews, ops
from core import settings as cfg
from core.auth import current_user, find_by_email, login, login_required, logout, verify
from core.db import q, q1
from core.money import INTEREST_LABELS, STATUS_LABELS, iso, today
from core.seed import DEMO_EMAIL, DEMO_PASSWORD

bp = Blueprint("admin", __name__)

NAV = [
    ("Overview", [
        ("admin.dashboard", "Dashboard", "grid"),
    ]),
    ("Website", [
        ("admin.sections", "Page sections", "layout"),
        ("admin.services", "Services", "layers"),
        ("admin.projects", "Projects", "image"),
        ("admin.process", "Process & figures", "steps"),
        ("admin.media", "Media library", "photo"),
        ("admin.reviews", "Reviews", "star"),
    ]),
    ("Business", [
        ("admin.enquiries", "Enquiries", "inbox"),
        ("admin.payments", "Payments & EMI", "rupee"),
        ("admin.clients", "Clients", "users"),
    ]),
    ("Studio", [
        ("admin.settings", "Settings", "cog"),
        ("admin.activity_log", "Activity", "clock"),
    ]),
]


@bp.app_context_processor
def inject():
    user = current_user()
    return {
        "nav_groups": NAV,
        "nav_counts": _nav_counts() if user else {},
        "me": user,
        "site_name": cfg.get("site_name"),
        "currency": cfg.get("currency_symbol", "₹"),
        "here": request.endpoint,
    }


def _nav_counts() -> dict:
    """Rail badges. Only things that need the owner's attention get a number."""
    if not (request.endpoint or "").startswith("admin."):
        return {}
    new = q1("SELECT COUNT(*) c FROM enquiries WHERE is_archived = 0 AND status = 'new'")
    late = q1("SELECT COUNT(*) c FROM installments i "
              "JOIN payment_plans p ON p.id = i.plan_id "
              "WHERE p.status <> 'cancelled' AND i.due_date < ? "
              "AND i.paid_amount < i.amount - 0.5", (iso(today()),))
    return {"admin.enquiries": new["c"], "admin.payments": late["c"]}


def page(template, title, **ctx):
    return render_template(f"admin/{template}", page_title=title, **ctx)


# ── auth ───────────────────────────────────────────────────────────────

@bp.route("/login", methods=["GET", "POST"], endpoint="login")
def login_view():
    if current_user():
        return redirect(url_for("admin.dashboard"))

    error = None
    email = ""
    if request.method == "POST":
        email = (request.form.get("email") or "").strip()
        user = find_by_email(email)
        if user and verify(user, request.form.get("password") or ""):
            login(user)
            activity.log("login", "users", user["id"], f"{user['name']} signed in", user)
            nxt = request.args.get("next") or request.form.get("next") or ""
            if nxt.startswith("/admin"):
                return redirect(nxt)
            return redirect(url_for("admin.dashboard"))
        error = "That email and password do not match an account."

    return render_template("admin/login.html", error=error, email=email,
                           demo_email=DEMO_EMAIL, demo_password=DEMO_PASSWORD,
                           site_name=cfg.get("site_name"),
                           next=request.args.get("next", ""))


@bp.route("/logout", methods=["GET", "POST"], endpoint="logout")
def logout_view():
    logout()
    return redirect(url_for("admin.login"))


# ── dashboard ──────────────────────────────────────────────────────────

@bp.route("/")
@login_required
def dashboard():
    counts = ops.enquiry_counts()
    money = ops.collections()
    return page(
        "dashboard.html", "Dashboard",
        counts=counts,
        recent=ops.enquiry_rows(limit=6),
        stale=ops.stale_enquiries(),
        money=money,
        collected_month=ops.collected_this_month(),
        months=ops.month_series(6),
        enq_months=ops.enquiry_series(6),
        health=ops.content_health(),
        acts=activity.recent(9),
        google=google_reviews.summary(),
        statuses=ops.ENQUIRY_STATUSES,
        reminder_template=cfg.get("reminder_template"),
        studio=cfg.get("site_name"),
    )


# ── website content ────────────────────────────────────────────────────

@bp.route("/sections")
@login_required
def sections():
    rows = q("SELECT * FROM sections ORDER BY position, id")
    items = []
    for r in rows:
        d = dict(r)
        d["image"] = content.media_url(r["image_id"], thumb=True)
        items.append(d)
    return page("sections.html", "Page sections", items=items,
                media=[m for m in content.all_media()])


@bp.route("/services")
@login_required
def services():
    return page("services.html", "Services",
                items=content.services(visible_only=False),
                media=content.all_media())


@bp.route("/projects")
@login_required
def projects():
    return page("projects.html", "Projects",
                items=content.projects(visible_only=False),
                media=content.all_media())


@bp.route("/projects/<int:pid>")
@login_required
def project_edit(pid):
    row = q1("SELECT * FROM projects WHERE id = ?", (pid,))
    if not row:
        abort(404)
    item = dict(row)
    item["cover"] = content.media_url(row["cover_id"], thumb=True)
    return page("project_edit.html", row["title"], item=item,
                images=content.project_images(pid), media=content.all_media())


@bp.route("/process")
@login_required
def process():
    return page("process.html", "Process & figures",
                steps=content.process_steps(visible_only=False),
                stats=content.stats(visible_only=False))


@bp.route("/media")
@login_required
def media():
    items = [{
        "id": m["id"], "kind": m["kind"], "src": content.media_src(m),
        "thumb": content.media_src(m, True), "alt": m["alt"] or "",
        "name": m["original_name"] or "", "width": m["width"], "height": m["height"],
        "bytes": m["bytes"], "created_at": m["created_at"],
    } for m in content.all_media()]
    return page("media.html", "Media library", items=items)


@bp.route("/reviews")
@login_required
def reviews():
    return page("reviews.html", "Reviews",
                items=content.testimonials(visible_only=False),
                google=google_reviews.summary(),
                history=q("SELECT * FROM google_sync ORDER BY id DESC LIMIT 6"))


# ── business ───────────────────────────────────────────────────────────

@bp.route("/enquiries")
@login_required
def enquiries():
    status = request.args.get("status", "open")
    search = (request.args.get("q") or "").strip()
    archived = request.args.get("archived") == "1"
    rows = ops.enquiry_rows(status=None if status == "all" else status,
                            search=search or None, archived=archived)
    return page("enquiries.html", "Enquiries",
                items=[dict(r) for r in rows],
                counts=ops.enquiry_counts(),
                statuses=ops.ENQUIRY_STATUSES, priorities=ops.PRIORITIES,
                active=status, search=search, archived=archived,
                reply_template=cfg.get("reply_template"),
                studio=cfg.get("site_name"))


@bp.route("/payments")
@login_required
def payments():
    return page("payments.html", "Payments & EMI",
                plans=ops.plan_rows(),
                clients=q("SELECT * FROM clients ORDER BY name"),
                money=ops.collections(),
                interest_labels=INTEREST_LABELS,
                today=iso(today()),
                reminder_template=cfg.get("reminder_template"),
                studio=cfg.get("site_name"))


@bp.route("/payments/<int:plan_id>")
@login_required
def plan_view(plan_id):
    plan = ops.plan_detail(plan_id)
    if not plan:
        abort(404)
    return page("plan.html", plan["title"], plan=plan,
                interest_labels=INTEREST_LABELS, status_labels=STATUS_LABELS,
                today=iso(today()),
                reminder_template=cfg.get("reminder_template"),
                studio=cfg.get("site_name"))


@bp.route("/clients")
@login_required
def clients():
    rows = q("SELECT c.*, "
             "(SELECT COUNT(*) FROM payment_plans p WHERE p.client_id = c.id) AS plans "
             "FROM clients c ORDER BY c.name")
    return page("clients.html", "Clients", items=[dict(r) for r in rows])


# ── studio ─────────────────────────────────────────────────────────────

@bp.route("/settings")
@login_required
def settings():
    return page("settings.html", "Settings",
                values=cfg.all_settings(),
                masked_key=cfg.masked("google_api_key"),
                google=google_reviews.summary(),
                user=current_user())


@bp.route("/activity")
@login_required
def activity_log():
    return page("activity.html", "Activity", items=activity.recent(200))


@bp.app_template_filter("since")
def since(value):
    """'3 days ago' style stamps for the activity feed."""
    if not value:
        return ""
    try:
        when = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return str(value)[:16]
    if when.tzinfo:
        when = when.replace(tzinfo=None)
    gap = (datetime.utcnow() - when).total_seconds()
    if gap < 60:
        return "just now"
    if gap < 3600:
        return f"{int(gap // 60)} min ago"
    if gap < 86400:
        return f"{int(gap // 3600)} hr ago"
    if gap < 86400 * 7:
        return f"{int(gap // 86400)} d ago"
    return when.strftime("%d %b %Y")
