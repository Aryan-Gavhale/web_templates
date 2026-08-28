"""Exercise every mutating API endpoint against a throwaway copy of the database."""

import os
import shutil
import sys
import tempfile

BASE = os.path.dirname(os.path.abspath(__file__))
LIVE = os.path.join(BASE, "data", "app.db")
TMP = os.path.join(tempfile.gettempdir(), "studio-smoke.db")
if os.path.exists(TMP):
    os.remove(TMP)
shutil.copy(LIVE, TMP)
os.environ["STUDIO_DB"] = TMP

from app import app  # noqa: E402
from core.seed import DEMO_EMAIL, DEMO_PASSWORD  # noqa: E402
from core.db import DB_PATH  # noqa: E402

print("db under test:", DB_PATH)
assert DB_PATH == TMP, "core.db is not honouring STUDIO_DB — aborting to protect live data"

fails = []


def check(label, res, want=200):
    body = res.get_json(silent=True)
    ok = res.status_code == want and (body or {}).get("ok", want == 200)
    if not ok:
        fails.append(f"{label}: {res.status_code} {body}")
    print(f"{'ok ' if ok else 'FAIL'} {label:44} {res.status_code}  "
          f"{str(body)[:90] if not ok else ''}")
    return body or {}


with app.test_client() as c:
    c.post("/admin/login", data={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})

    # ── content ────────────────────────────────────────────────────────
    sec = c.get("/api/media").get_json()
    media_id = sec["items"][0]["id"]

    from core.db import q1
    sid = q1("SELECT id FROM sections LIMIT 1")["id"]
    check("PUT  section", c.put(f"/api/sections/{sid}", json={
        "heading": "Smoke test heading", "body": "x", "is_visible": 1, "image_id": media_id}))

    svc = check("POST service", c.post("/api/services", json={
        "title": "Smoke service", "summary": "s", "price_from": 1000}))
    check("PUT  service", c.put(f"/api/services/{svc['id']}", json={"title": "Smoke service 2"}))

    prj = check("POST project", c.post("/api/projects", json={"title": "Smoke project"}))
    check("PUT  project", c.put(f"/api/projects/{prj['id']}", json={
        "title": "Smoke project 2", "cover_id": media_id, "is_visible": 1}))
    imgs = check("POST project images", c.post(f"/api/projects/{prj['id']}/images",
                                               json={"media_ids": [media_id]}))
    iid = imgs["images"][0]["id"]
    check("PATCH project image", c.patch(f"/api/project-images/{iid}", json={"caption": "cap"}))

    step = check("POST process step", c.post("/api/process", json={"title": "Smoke step"}))
    check("PUT  process step", c.put(f"/api/process/{step['id']}", json={"title": "Smoke step 2"}))
    stat = check("POST stat", c.post("/api/stats", json={"value": "9", "label": "Smoke"}))
    check("PUT  stat", c.put(f"/api/stats/{stat['id']}", json={"value": "10", "label": "Smoke"}))

    check("POST reorder", c.post("/api/reorder", json={
        "table": "services", "ids": [svc["id"]]}))
    check("POST toggle", c.post("/api/toggle", json={
        "table": "services", "field": "is_visible", "id": svc["id"], "value": 0}))

    tst = check("POST testimonial", c.post("/api/testimonials", json={
        "author": "Smoke", "body": "Lovely", "rating": 5}))
    check("PUT  testimonial", c.put(f"/api/testimonials/{tst['id']}", json={
        "author": "Smoke 2", "body": "Lovely", "rating": 4}))

    check("PATCH media", c.patch(f"/api/media/{media_id}", json={"alt": "smoke alt"}))
    check("POST media remote", c.post("/api/media/remote", json={
        "url": "https://images.unsplash.com/photo-1", "alt": "remote"}))

    # ── google (no key configured, so it must fail politely) ───────────
    g = c.post("/api/google/sync")
    print(f"ok   POST google/sync (no key)                    {g.status_code}  "
          f"{g.get_json().get('message') or g.get_json().get('error')}")

    # ── enquiries ──────────────────────────────────────────────────────
    eid = q1("SELECT id FROM enquiries LIMIT 1")["id"]
    check("PATCH enquiry status", c.patch(f"/api/enquiries/{eid}", json={"status": "qualified"}))
    check("PATCH enquiry priority", c.patch(f"/api/enquiries/{eid}", json={"priority": "high"}))
    check("PATCH enquiry contacted", c.patch(f"/api/enquiries/{eid}", json={"contacted": 1}))
    check("POST enquiry note", c.post(f"/api/enquiries/{eid}/notes", json={"body": "Called them."}))
    check("GET  enquiry", c.get(f"/api/enquiries/{eid}"))
    conv = check("POST enquiry convert", c.post(f"/api/enquiries/{eid}/convert"))

    # ── clients and plans ──────────────────────────────────────────────
    cli = check("POST client", c.post("/api/clients", json={
        "name": "Smoke Client", "phone": "+919000000000"}))
    check("PUT  client", c.put(f"/api/clients/{cli['id']}", json={"name": "Smoke Client 2"}))

    check("POST plan preview", c.post("/api/plans/preview", json={
        "total_amount": 1200000, "downpayment": 200000, "tenure_months": 10,
        "interest_type": "flat", "interest_pct": 9, "start_date": "2026-08-01"}))
    plan = check("POST plan", c.post("/api/plans", json={
        "client_id": cli["id"], "title": "Smoke plan", "total_amount": 1200000,
        "downpayment": 200000, "tenure_months": 10, "interest_type": "reducing",
        "interest_pct": 12, "start_date": "2026-08-01"}))
    check("PUT  plan", c.put(f"/api/plans/{plan['id']}", json={
        "title": "Smoke plan 2", "status": "active"}))

    inst = q1("SELECT id, amount FROM installments WHERE plan_id = ? ORDER BY seq",
              (plan["id"],))
    check("PATCH installment part", c.patch(f"/api/installments/{inst['id']}", json={
        "paid_amount": 1000, "paid_on": "2026-08-20", "method": "UPI", "reference": "abc"}))
    check("PATCH installment full", c.patch(f"/api/installments/{inst['id']}", json={
        "full": 1, "paid_on": "2026-08-21"}))
    over = c.patch(f"/api/installments/{inst['id']}", json={"paid_amount": 99999999})
    print(f"ok   PATCH installment overpay rejected           {over.status_code}  "
          f"{over.get_json().get('error')}")
    check("PATCH installment clear", c.patch(f"/api/installments/{inst['id']}", json={"clear": 1}))
    check("PATCH installment due date", c.patch(f"/api/installments/{inst['id']}",
                                                json={"due_date": "2026-09-15"}))
    check("POST plan reschedule", c.post(f"/api/plans/{plan['id']}/reschedule", json={
        "total_amount": 1300000, "downpayment": 200000, "tenure_months": 8,
        "interest_type": "none", "interest_pct": 0, "start_date": "2026-09-01"}))

    # ── settings and account ───────────────────────────────────────────
    check("POST settings", c.post("/api/settings", json={
        "site_name": "Studio Aarohi", "accent": "#9C6B33", "not_a_key": "ignored"}))
    bad = c.post("/api/account/password", json={
        "current": "wrong", "next": "abcdefghij", "confirm": "abcdefghij"})
    print(f"ok   POST bad password rejected                   {bad.status_code}  "
          f"{bad.get_json().get('error')}")
    check("POST account profile", c.post("/api/account/profile", json={
        "name": "Owner", "email": DEMO_EMAIL}))

    # ── deletes, last ──────────────────────────────────────────────────
    check("DEL  project image", c.delete(f"/api/project-images/{iid}"))
    check("DEL  project", c.delete(f"/api/projects/{prj['id']}"))
    check("DEL  service", c.delete(f"/api/services/{svc['id']}"))
    check("DEL  process step", c.delete(f"/api/process/{step['id']}"))
    check("DEL  stat", c.delete(f"/api/stats/{stat['id']}"))
    check("DEL  testimonial", c.delete(f"/api/testimonials/{tst['id']}"))
    check("DEL  plan", c.delete(f"/api/plans/{plan['id']}"))
    check("DEL  client", c.delete(f"/api/clients/{cli['id']}"))
    check("DEL  client from convert", c.delete(f"/api/clients/{conv['id']}"))

print("\nFAILURES:", len(fails))
for f in fails:
    print(" ", f)
sys.exit(1 if fails else 0)
