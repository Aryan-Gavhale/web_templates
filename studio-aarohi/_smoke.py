"""Walk every admin and public route with a logged-in test client."""

import re
import sys

from app import app
from core.seed import DEMO_EMAIL, DEMO_PASSWORD

PAGES = [
    "/", "/admin", "/admin/sections", "/admin/services", "/admin/projects",
    "/admin/process", "/admin/media", "/admin/reviews", "/admin/enquiries",
    "/admin/enquiries?status=all", "/admin/enquiries?archived=1",
    "/admin/payments", "/admin/clients", "/admin/settings", "/admin/activity",
]

failures = 0
with app.test_client() as c:
    r = c.post("/admin/login", data={"email": DEMO_EMAIL, "password": DEMO_PASSWORD})
    print(f"login              {r.status_code} -> {r.headers.get('Location')}")
    if r.status_code != 302:
        sys.exit("login failed")

    # Follow the first project and plan too.
    from core.db import q1
    pid = q1("SELECT id FROM projects ORDER BY id LIMIT 1")
    plan = q1("SELECT id FROM payment_plans ORDER BY id LIMIT 1")
    pages = list(PAGES)
    if pid:
        pages.append(f"/admin/projects/{pid['id']}")
    if plan:
        pages.append(f"/admin/payments/{plan['id']}")

    for path in pages:
        r = c.get(path, follow_redirects=True)
        body = r.get_data(as_text=True)
        note = ""
        if r.status_code != 200:
            failures += 1
            m = re.search(r"<title>(.*?)</title>", body, re.S)
            note = (m.group(1).strip()[:120] if m else body[:160]).replace("\n", " ")
        print(f"{path:34} {r.status_code}  {len(body):>7} bytes  {note}")

    for path in ["/api/media", "/api/enquiries.csv", "/api/payments.csv"]:
        r = c.get(path)
        if r.status_code != 200:
            failures += 1
        print(f"{path:34} {r.status_code}")

print("\nFAILURES:", failures)
sys.exit(1 if failures else 0)
