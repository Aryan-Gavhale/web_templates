"""Business queries that the dashboard, enquiry board and payments pages share."""

import re
from collections import OrderedDict
from datetime import date, datetime, timedelta

from .db import q, q1
from .money import installment_status, parse_date, plan_rollup, today

ENQUIRY_STATUSES = OrderedDict([
    ("new", "New"),
    ("contacted", "Contacted"),
    ("qualified", "Qualified"),
    ("quoted", "Quoted"),
    ("won", "Won"),
    ("lost", "Lost"),
])

# Statuses that still need the owner to do something.
OPEN_STATUSES = ("new", "contacted", "qualified", "quoted")

PRIORITIES = OrderedDict([("high", "High"), ("normal", "Normal"), ("low", "Low")])

SOURCES = ["website", "google", "instagram", "referral", "walk-in", "phone", "other"]


def slugify(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", (text or "").strip().lower()).strip("-")
    return s[:80] or "item"


def unique_slug(table: str, text: str, exclude_id=None) -> str:
    base = slugify(text)
    slug = base
    n = 2
    while True:
        row = q1(f"SELECT id FROM {table} WHERE slug = ?", (slug,))
        if not row or (exclude_id and row["id"] == exclude_id):
            return slug
        slug = f"{base}-{n}"
        n += 1


# ── enquiries ──────────────────────────────────────────────────────────

def enquiry_rows(status=None, source=None, search=None, archived=0, limit=500) -> list:
    where = ["e.is_archived = ?"]
    args = [1 if archived else 0]

    if status and status in ENQUIRY_STATUSES:
        where.append("e.status = ?")
        args.append(status)
    elif status == "open":
        where.append("e.status IN (%s)" % ",".join("?" * len(OPEN_STATUSES)))
        args.extend(OPEN_STATUSES)

    if source:
        where.append("e.source = ?")
        args.append(source)

    if search:
        where.append("(e.name LIKE ? OR e.email LIKE ? OR e.phone LIKE ? "
                     "OR e.ref LIKE ? OR e.message LIKE ? OR e.city LIKE ?)")
        args.extend([f"%{search}%"] * 6)

    args.append(limit)
    return q(
        "SELECT e.*, s.title AS service_title, "
        "  (SELECT COUNT(*) FROM enquiry_notes n WHERE n.enquiry_id = e.id) AS note_count "
        "FROM enquiries e LEFT JOIN services s ON s.id = e.service_id "
        f"WHERE {' AND '.join(where)} "
        "ORDER BY CASE e.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END, "
        "         e.created_at DESC LIMIT ?", args)


def enquiry_detail(eid: int):
    row = q1("SELECT e.*, s.title AS service_title FROM enquiries e "
             "LEFT JOIN services s ON s.id = e.service_id WHERE e.id = ?", (eid,))
    if not row:
        return None
    d = dict(row)
    d["notes"] = [dict(n) for n in q(
        "SELECT * FROM enquiry_notes WHERE enquiry_id = ? ORDER BY id DESC", (eid,))]
    return d


def enquiry_counts() -> dict:
    out = {k: 0 for k in ENQUIRY_STATUSES}
    for r in q("SELECT status, COUNT(*) c FROM enquiries WHERE is_archived = 0 GROUP BY status"):
        out[r["status"]] = r["c"]
    out["open"] = sum(out.get(s, 0) for s in OPEN_STATUSES)
    out["all"] = sum(out.get(s, 0) for s in ENQUIRY_STATUSES)
    out["archived"] = (q1("SELECT COUNT(*) c FROM enquiries WHERE is_archived = 1") or {"c": 0})["c"]
    return out


def stale_enquiries(days: int = 3) -> list:
    """Open enquiries nobody has touched — the thing that actually loses work."""
    cut = (datetime.utcnow() - timedelta(days=days)).isoformat()
    return q(
        "SELECT * FROM enquiries WHERE is_archived = 0 "
        "AND status IN (%s) "
        "AND COALESCE(last_contacted_at, created_at) < ? "
        "ORDER BY COALESCE(last_contacted_at, created_at) ASC LIMIT 8"
        % ",".join("?" * len(OPEN_STATUSES)),
        list(OPEN_STATUSES) + [cut])


# ── payments ───────────────────────────────────────────────────────────

def plan_rows() -> list:
    out = []
    for p in q("SELECT p.*, c.name AS client_name, c.phone AS client_phone, "
               "c.email AS client_email FROM payment_plans p "
               "JOIN clients c ON c.id = p.client_id ORDER BY p.id DESC"):
        rows = q("SELECT * FROM installments WHERE plan_id = ? ORDER BY seq", (p["id"],))
        d = dict(p)
        d["roll"] = plan_rollup(p, rows)
        out.append(d)
    return out


def plan_detail(plan_id: int):
    p = q1("SELECT p.*, c.name AS client_name, c.email AS client_email, "
           "c.phone AS client_phone, c.address AS client_address, c.city AS client_city "
           "FROM payment_plans p JOIN clients c ON c.id = p.client_id WHERE p.id = ?", (plan_id,))
    if not p:
        return None
    rows = q("SELECT * FROM installments WHERE plan_id = ? ORDER BY seq", (plan_id,))
    d = dict(p)
    d["installments"] = []
    for r in rows:
        i = dict(r)
        i["state"] = installment_status(r)
        i["outstanding"] = max(0.0, float(r["amount"] or 0) - float(r["paid_amount"] or 0))
        d["installments"].append(i)
    d["roll"] = plan_rollup(p, rows)
    return d


def collections(window_days: int = 30) -> dict:
    """What is owed, what is late, and what lands in the next month."""
    ref = today()
    horizon = ref + timedelta(days=window_days)
    overdue = due_soon = outstanding = collected = 0.0
    overdue_rows = []
    upcoming_rows = []

    for r in q("SELECT i.*, p.ref AS plan_ref, p.title AS plan_title, p.status AS plan_status, "
               "c.name AS client_name, c.phone AS client_phone, c.email AS client_email "
               "FROM installments i JOIN payment_plans p ON p.id = i.plan_id "
               "JOIN clients c ON c.id = p.client_id ORDER BY i.due_date"):
        if r["plan_status"] == "cancelled":
            continue
        amount = float(r["amount"] or 0)
        paid = float(r["paid_amount"] or 0)
        left = max(0.0, amount - paid)
        collected += paid
        if left <= 0.5:
            continue
        outstanding += left
        due = parse_date(r["due_date"])
        if due and due < ref:
            overdue += left
            overdue_rows.append(dict(r, outstanding=left, days_late=(ref - due).days))
        elif due and due <= horizon:
            due_soon += left
            upcoming_rows.append(dict(r, outstanding=left, days_away=(due - ref).days))

    overdue_rows.sort(key=lambda x: -x["days_late"])
    upcoming_rows.sort(key=lambda x: x["days_away"])
    return {
        "overdue": overdue,
        "overdue_count": len(overdue_rows),
        "overdue_rows": overdue_rows,
        "due_soon": due_soon,
        "upcoming_rows": upcoming_rows,
        "outstanding": outstanding,
        "collected": collected,
    }


def collected_this_month() -> float:
    start = today().replace(day=1).isoformat()
    row = q1("SELECT COALESCE(SUM(paid_amount), 0) AS s FROM installments "
             "WHERE paid_on >= ?", (start,))
    return float(row["s"] or 0)


def month_series(months: int = 6) -> list:
    """Collected vs billed per month, for the dashboard bar chart."""
    ref = today().replace(day=1)
    out = []
    for back in range(months - 1, -1, -1):
        m = ref.month - back
        y = ref.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        start = date(y, m, 1)
        end = date(y + (m == 12), (m % 12) + 1, 1)
        billed = q1("SELECT COALESCE(SUM(amount),0) s FROM installments "
                    "WHERE due_date >= ? AND due_date < ?", (start.isoformat(), end.isoformat()))
        paid = q1("SELECT COALESCE(SUM(paid_amount),0) s FROM installments "
                  "WHERE paid_on >= ? AND paid_on < ?", (start.isoformat(), end.isoformat()))
        out.append({
            "label": start.strftime("%b"),
            "year": start.year,
            "billed": float(billed["s"] or 0),
            "collected": float(paid["s"] or 0),
        })
    return out


def enquiry_series(months: int = 6) -> list:
    ref = today().replace(day=1)
    out = []
    for back in range(months - 1, -1, -1):
        m = ref.month - back
        y = ref.year + (m - 1) // 12
        m = (m - 1) % 12 + 1
        start = date(y, m, 1)
        end = date(y + (m == 12), (m % 12) + 1, 1)
        row = q1("SELECT COUNT(*) c FROM enquiries WHERE created_at >= ? AND created_at < ?",
                 (start.isoformat(), end.isoformat()))
        won = q1("SELECT COUNT(*) c FROM enquiries WHERE status = 'won' "
                 "AND created_at >= ? AND created_at < ?", (start.isoformat(), end.isoformat()))
        out.append({"label": start.strftime("%b"), "count": row["c"], "won": won["c"]})
    return out


def content_health() -> list:
    """Nudges that stop the site quietly rotting."""
    notes = []
    hidden_p = q1("SELECT COUNT(*) c FROM projects WHERE is_visible = 0")["c"]
    hidden_s = q1("SELECT COUNT(*) c FROM services WHERE is_visible = 0")["c"]
    no_cover = q1("SELECT COUNT(*) c FROM projects WHERE cover_id IS NULL AND is_visible = 1")["c"]
    no_alt = q1("SELECT COUNT(*) c FROM media WHERE COALESCE(alt,'') = ''")["c"]
    live_p = q1("SELECT COUNT(*) c FROM projects WHERE is_visible = 1")["c"]
    live_r = q1("SELECT COUNT(*) c FROM testimonials WHERE is_visible = 1")["c"]

    if live_p == 0:
        notes.append(("warn", "No projects are visible on the site.", "admin.projects"))
    if no_cover:
        notes.append(("warn", f"{no_cover} live project(s) have no cover image.", "admin.projects"))
    if live_r == 0:
        notes.append(("warn", "No reviews are showing on the site.", "admin.reviews"))
    if no_alt:
        notes.append(("info", f"{no_alt} image(s) have no alt text — bad for search and screen readers.",
                      "admin.media"))
    if hidden_p:
        notes.append(("info", f"{hidden_p} project(s) are hidden.", "admin.projects"))
    if hidden_s:
        notes.append(("info", f"{hidden_s} service(s) are hidden.", "admin.services"))
    return notes
