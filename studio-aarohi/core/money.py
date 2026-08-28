"""Instalment maths, due-date handling and Indian currency formatting."""

import calendar
from datetime import date, datetime

# ── dates ──────────────────────────────────────────────────────────────

def parse_date(value, fallback=None):
    if isinstance(value, date):
        return value
    if not value:
        return fallback
    text = str(value).strip()[:10]
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return fallback


def add_months(start: date, months: int) -> date:
    """Month arithmetic that clamps to the end of a short month.

    31 Jan + 1 month is 28 Feb, not 3 March.
    """
    total = start.month - 1 + months
    year = start.year + total // 12
    month = total % 12 + 1
    day = min(start.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def today() -> date:
    return date.today()


def iso(d) -> str:
    return d.isoformat() if isinstance(d, date) else (str(d)[:10] if d else "")


def pretty_date(value) -> str:
    d = parse_date(value)
    return d.strftime("%d %b %Y") if d else "—"


# ── currency ───────────────────────────────────────────────────────────

def group_indian(n: int) -> str:
    """1234567 -> '12,34,567' (lakh/crore grouping)."""
    s = str(abs(int(n)))
    if len(s) <= 3:
        body = s
    else:
        head, tail = s[:-3], s[-3:]
        parts = []
        while len(head) > 2:
            parts.insert(0, head[-2:])
            head = head[:-2]
        if head:
            parts.insert(0, head)
        body = ",".join(parts) + "," + tail
    return ("-" if n < 0 else "") + body


def money(amount, symbol: str = "₹") -> str:
    try:
        v = float(amount or 0)
    except (TypeError, ValueError):
        v = 0.0
    return f"{symbol}{group_indian(round(v))}"


def compact(amount, symbol: str = "₹") -> str:
    """Short form for dashboard tiles: ₹1.2 Cr, ₹8.4 L, ₹42,000."""
    try:
        v = float(amount or 0)
    except (TypeError, ValueError):
        v = 0.0
    a = abs(v)
    sign = "-" if v < 0 else ""
    if a >= 1_00_00_000:
        return f"{sign}{symbol}{a / 1_00_00_000:.2f} Cr".replace(".00 ", " ")
    if a >= 1_00_000:
        return f"{sign}{symbol}{a / 1_00_000:.2f} L".replace(".00 ", " ")
    return f"{sign}{money(a, symbol)}"


# ── instalment schedule ────────────────────────────────────────────────

def schedule(total, discount, downpayment, interest_type, interest_pct, tenure, start):
    """Build the full instalment plan.

    Returns (rows, summary). Rows never lose or invent money: rounding drift is
    absorbed by the final instalment so the schedule sums exactly to `payable`.
    """
    total = float(total or 0)
    discount = float(discount or 0)
    downpayment = float(downpayment or 0)
    rate = float(interest_pct or 0)
    tenure = max(1, int(tenure or 1))
    start_d = parse_date(start, today())

    net = max(0.0, total - discount)
    principal = max(0.0, net - downpayment)

    if interest_type == "flat" and rate > 0:
        interest = principal * (rate / 100.0) * (tenure / 12.0)
        financed = principal + interest
        per = financed / tenure
    elif interest_type == "reducing" and rate > 0:
        r = rate / 1200.0
        factor = (1 + r) ** tenure
        per = principal * r * factor / (factor - 1)
        financed = per * tenure
        interest = financed - principal
    else:
        interest = 0.0
        financed = principal
        per = principal / tenure

    per_rounded = round(per)
    rows = []
    for i in range(1, tenure + 1):
        amount = per_rounded
        if i == tenure:  # soak up the rounding difference here
            amount = round(financed) - per_rounded * (tenure - 1)
        rows.append({
            "seq": i,
            "label": f"Instalment {i} of {tenure}",
            "due_date": iso(add_months(start_d, i)),
            "amount": float(max(0, amount)),
        })

    summary = {
        "total": round(total),
        "discount": round(discount),
        "net": round(net),
        "downpayment": round(downpayment),
        "principal": round(principal),
        "interest": round(interest),
        "financed": round(financed),
        "payable": round(downpayment + financed),
        "per_month": float(per_rounded),
        "tenure": tenure,
        "interest_type": interest_type,
        "interest_pct": rate,
        "start_date": iso(start_d),
    }
    return rows, summary


def installment_status(row, ref_day=None) -> str:
    """paid / partial / overdue / due — derived, never trusted from storage."""
    ref_day = ref_day or today()
    amount = float(row["amount"] or 0)
    paid = float(row["paid_amount"] or 0)
    if paid >= amount - 0.5 and amount > 0:
        return "paid"
    due = parse_date(row["due_date"])
    if due and due < ref_day:
        return "overdue"
    if paid > 0:
        return "partial"
    return "due"


def plan_rollup(plan, rows) -> dict:
    """Live totals for a plan from its stored instalments."""
    ref_day = today()
    billed = sum(float(r["amount"] or 0) for r in rows)
    collected = sum(float(r["paid_amount"] or 0) for r in rows)
    down = float(plan["downpayment"] or 0)

    overdue_amount = 0.0
    overdue_count = 0
    next_due = None
    paid_count = 0

    for r in sorted(rows, key=lambda x: x["seq"]):
        st = installment_status(r, ref_day)
        outstanding = max(0.0, float(r["amount"] or 0) - float(r["paid_amount"] or 0))
        if st == "paid":
            paid_count += 1
        elif st == "overdue":
            overdue_amount += outstanding
            overdue_count += 1
        if st != "paid" and next_due is None:
            # A plain dict, because this rollup is returned as JSON as well as
            # rendered, and sqlite3.Row does not survive jsonify.
            next_due = dict(r, state=st, outstanding=outstanding)

    payable = down + billed
    received = down + collected
    return {
        "billed": billed,
        "collected": collected,
        "payable": payable,
        "received": received,
        "outstanding": max(0.0, payable - received),
        "overdue_amount": overdue_amount,
        "overdue_count": overdue_count,
        "paid_count": paid_count,
        "count": len(rows),
        "next_due": next_due,
        "progress": round((received / payable) * 100) if payable > 0 else 0,
        "is_settled": len(rows) > 0 and paid_count == len(rows),
    }


INTEREST_LABELS = {
    "none": "No interest",
    "flat": "Flat rate",
    "reducing": "Reducing balance",
}

STATUS_LABELS = {
    "paid": "Paid",
    "partial": "Part paid",
    "overdue": "Overdue",
    "due": "Upcoming",
}
