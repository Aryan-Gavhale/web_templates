"""EMI: plans, applications, generated schedules, payments, receipts and the ledger.

The instalment book is kept in-house. `PAYMENT_ADAPTERS` is the seam where a
gateway would slot in: record_payment() already stores a provider and provider
reference, so a Razorpay or Cashfree callback would only have to call it.
"""

from __future__ import annotations

import csv
import io
from datetime import date

from flask import (Response, abort, flash, redirect, render_template, request,
                   url_for)

from core import audit, crud, db, emi as emi_core, settings
from core.auth import current_user, require_role, verify_csrf
from core.crud import Field, Resource
from core.util import parse_date, parse_float, parse_int

PLANS = Resource(
    key="emi_plans", table="emi_plans", label="EMI plan", label_plural="EMI plans",
    area="emi", sortable=True, publishable=False, searchable=("name", "provider", "notes"),
    intro="These drive the public calculator directly. Set the interest rate to 0 for a "
          "genuine no-cost plan.",
    list_columns=[("name", "Plan"), ("tenure_months", "Months"), ("rate_label", "Interest"),
                  ("band", "Amount band")],
    fields=[
        Field("name", "Name", "text", required=True, span=8,
              placeholder="12 months, no cost"),
        Field("provider", "Provider", "text", span=4, default="In-house"),
        Field("tenure_months", "Tenure", "int", span=3, required=True, suffix="months"),
        Field("interest_rate", "Interest rate", "number", span=3, step="0.1", suffix="% a year",
              help="0 means no-cost EMI."),
        Field("processing_fee_pct", "Processing fee", "number", span=3, step="0.1", suffix="%"),
        Field("downpayment_pct", "Downpayment", "number", span=3, step="1", suffix="%"),
        Field("min_amount", "Minimum treatment amount", "money", span=6, prefix="\u20b9"),
        Field("max_amount", "Maximum treatment amount", "money", span=6, prefix="\u20b9",
              help="0 means no ceiling."),
        Field("notes", "Note shown on hover", "textarea", rows=2),
        Field("is_active", "Active", "checkbox", span=6, default=1),
    ],
)

PAYMENT_METHODS = [("upi", "UPI"), ("cash", "Cash"), ("card", "Card"),
                   ("netbanking", "Net banking"), ("cheque", "Cheque"), ("gateway", "Gateway")]


def register(bp) -> None:
    crud.register(bp, PLANS)

    # ── applications ────────────────────────────────────────────────────────
    @bp.route("/emi/applications")
    @require_role("emi")
    def emi_applications():
        status = request.args.get("status", "")
        search = (request.args.get("q") or "").strip()
        sql = ("SELECT a.*, "
               "(SELECT COALESCE(SUM(amount), 0) FROM emi_installments i "
               " WHERE i.application_id = a.id AND i.status = 'due') AS outstanding, "
               "(SELECT COUNT(*) FROM emi_installments i WHERE i.application_id = a.id "
               " AND i.status = 'due' AND i.due_date < date('now')) AS overdue_n "
               "FROM emi_applications a WHERE 1 = 1")
        args: list = []
        if status:
            sql += " AND a.status = ?"
            args.append(status)
        if search:
            sql += " AND (a.applicant_name LIKE ? OR a.phone LIKE ? OR a.ref LIKE ?)"
            args += [f"%{search}%"] * 3
        sql += " ORDER BY a.id DESC LIMIT 200"

        return render_template(
            "admin/emi_applications.html", title="EMI applications",
            rows=db.query(sql, args), status=status, search=search,
            labels=emi_core.STATUS_LABELS, tone=emi_core.STATUS_TONE,
            counts={r["status"]: r["n"] for r in db.query(
                "SELECT status, COUNT(*) AS n FROM emi_applications GROUP BY status")},
            totals={
                "outstanding": db.scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM emi_installments WHERE status = 'due'", (), 0),
                "overdue": db.scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM emi_installments "
                    "WHERE status = 'due' AND due_date < date('now')", (), 0),
                "collected": db.scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid'", (), 0),
            })

    @bp.route("/emi/applications/new", methods=["GET", "POST"])
    @require_role("emi")
    def emi_application_new():
        if request.method == "POST":
            verify_csrf()
            name = (request.form.get("applicant_name") or "").strip()
            amount = parse_float(request.form.get("treatment_amount"), 0)
            plan = db.one("SELECT * FROM emi_plans WHERE id = ?",
                          (parse_int(request.form.get("plan_id"), 0),))
            if not name or amount <= 0 or not plan:
                flash("A name, an amount and a plan are needed.", "error")
                return redirect(url_for("admin.emi_application_new"))

            q = emi_core.quote_for_plan(amount, plan)
            service_id = parse_int(request.form.get("service_id"), 0) or None
            app_id = db.insert("emi_applications", {
                "ref": emi_core.new_application_ref(),
                "applicant_name": name,
                "phone": (request.form.get("phone") or "").strip(),
                "email": (request.form.get("email") or "").strip(),
                "service_id": service_id,
                "treatment_label": db.scalar("SELECT name FROM services WHERE id = ?",
                                             (service_id,)) or "",
                "treatment_amount": amount, "plan_id": plan["id"], "plan_label": plan["name"],
                "tenure_months": plan["tenure_months"], "interest_rate": plan["interest_rate"],
                "processing_fee": q["processing_fee"], "downpayment": q["downpayment"],
                "financed": q["financed"], "monthly_emi": q["monthly_emi"],
                "total_payable": q["total_payable"],
                "status": request.form.get("status") or "under_review",
                "start_date": (request.form.get("start_date") or date.today().isoformat()),
                "notes": (request.form.get("notes") or "").strip(),
            })
            audit.log("create", "emi_applications", app_id, name)
            flash("Application created.", "ok")
            return redirect(url_for("admin.emi_application_detail", app_id=app_id))

        return render_template(
            "admin/emi_application_form.html", title="New EMI application",
            plans=emi_core.active_plans(),
            services=db.query("SELECT id, name, price_from FROM services ORDER BY name"),
            statuses=emi_core.STATUS_LABELS)

    @bp.route("/emi/applications/<int:app_id>")
    @require_role("emi")
    def emi_application_detail(app_id):
        row = db.one(
            "SELECT a.*, s.name AS service_name, e.ref AS enquiry_ref, e.id AS enquiry_row "
            "FROM emi_applications a "
            "LEFT JOIN services s ON s.id = a.service_id "
            "LEFT JOIN enquiries e ON e.id = a.enquiry_id WHERE a.id = ?", (app_id,))
        if not row:
            abort(404)
        return render_template(
            "admin/emi_application_detail.html", title=row["applicant_name"], row=row,
            schedule=emi_core.schedule(app_id), totals=emi_core.totals(app_id),
            payments=db.query(
                "SELECT p.*, u.name AS by_name FROM payments p "
                "LEFT JOIN users u ON u.id = p.recorded_by "
                "WHERE p.application_id = ? ORDER BY p.id DESC", (app_id,)),
            next_states=emi_core.STATUS_FLOW.get(row["status"], []),
            labels=emi_core.STATUS_LABELS, tone=emi_core.STATUS_TONE,
            methods=PAYMENT_METHODS, plans=emi_core.active_plans())

    @bp.route("/emi/applications/<int:app_id>/update", methods=["POST"])
    @require_role("emi")
    def emi_application_update(app_id):
        verify_csrf()
        row = db.one("SELECT * FROM emi_applications WHERE id = ?", (app_id,))
        if not row:
            abort(404)

        data: dict = {"updated_at": db.scalar("SELECT datetime('now')")}
        status = request.form.get("status")
        if status and status != row["status"]:
            allowed = emi_core.STATUS_FLOW.get(row["status"], [])
            if status not in allowed:
                flash(f"An application at {emi_core.STATUS_LABELS.get(row['status'], row['status'])} "
                      f"cannot move straight to {emi_core.STATUS_LABELS.get(status, status)}.", "error")
                return redirect(url_for("admin.emi_application_detail", app_id=app_id))
            data["status"] = status

        for field in ("kyc_notes", "notes"):
            if field in request.form:
                data[field] = (request.form.get(field) or "").strip()

        start = request.form.get("start_date")
        if start and start != row["start_date"]:
            data["start_date"] = start

        plan_id = parse_int(request.form.get("plan_id"), 0)
        amount = parse_float(request.form.get("treatment_amount"), row["treatment_amount"])
        if plan_id and (plan_id != row["plan_id"] or amount != row["treatment_amount"]):
            plan = db.one("SELECT * FROM emi_plans WHERE id = ?", (plan_id,))
            if plan:
                paid = int(db.scalar(
                    "SELECT COUNT(*) FROM emi_installments WHERE application_id = ? AND status = 'paid'",
                    (app_id,), 0))
                if paid:
                    flash("Payments have already been recorded, so the plan and amount are locked. "
                          "Cancel this application and raise a new one instead.", "error")
                    return redirect(url_for("admin.emi_application_detail", app_id=app_id))
                q = emi_core.quote_for_plan(amount, plan)
                data.update({
                    "plan_id": plan["id"], "plan_label": plan["name"],
                    "tenure_months": plan["tenure_months"], "interest_rate": plan["interest_rate"],
                    "treatment_amount": amount, "processing_fee": q["processing_fee"],
                    "downpayment": q["downpayment"], "financed": q["financed"],
                    "monthly_emi": q["monthly_emi"], "total_payable": q["total_payable"],
                })

        db.update("emi_applications", app_id, data)
        audit.log("update", "emi_applications", app_id, row["applicant_name"],
                  before=row, after=data)

        needs_schedule = data.get("status") in ("approved", "active") or "start_date" in data \
            or "plan_id" in data
        if needs_schedule:
            count = emi_core.build_schedule(app_id)
            if count:
                flash(f"Application updated and a {count}-instalment schedule generated.", "ok")
            else:
                flash("Application updated. The existing schedule was kept because payments "
                      "are recorded against it.", "ok")
        else:
            flash("Application updated.", "ok")
        return redirect(url_for("admin.emi_application_detail", app_id=app_id))

    @bp.route("/emi/applications/<int:app_id>/schedule", methods=["POST"])
    @require_role("emi")
    def emi_build_schedule(app_id):
        verify_csrf()
        count = emi_core.build_schedule(app_id)
        if count:
            audit.log("update", "emi_applications", app_id, f"schedule rebuilt, {count} rows")
            flash(f"{count} instalments generated.", "ok")
        else:
            flash("Nothing generated: payments already exist against this schedule.", "error")
        return redirect(url_for("admin.emi_application_detail", app_id=app_id))

    @bp.route("/emi/applications/<int:app_id>/delete", methods=["POST"])
    @require_role("emi")
    def emi_application_delete(app_id):
        verify_csrf()
        row = db.one("SELECT * FROM emi_applications WHERE id = ?", (app_id,))
        if not row:
            abort(404)
        paid = int(db.scalar(
            "SELECT COUNT(*) FROM payments WHERE application_id = ? AND status = 'paid'",
            (app_id,), 0))
        if paid:
            flash("Money has been received against this application, so it cannot be "
                  "deleted. Cancel it instead, which keeps the record.", "error")
            return redirect(url_for("admin.emi_application_detail", app_id=app_id))
        db.delete("emi_applications", app_id)
        audit.log("delete", "emi_applications", app_id, row["applicant_name"], before=row)
        flash("Application deleted.", "ok")
        return redirect(url_for("admin.emi_applications"))

    # ── payments ────────────────────────────────────────────────────────────
    @bp.route("/emi/payments/record", methods=["POST"])
    @require_role("emi")
    def emi_record_payment():
        verify_csrf()
        app_id = parse_int(request.form.get("application_id"), 0)
        inst_id = parse_int(request.form.get("installment_id"), 0) or None
        amount = parse_float(request.form.get("amount"), 0)
        app_row = db.one("SELECT * FROM emi_applications WHERE id = ?", (app_id,))
        if not app_row or amount <= 0:
            flash("A valid application and amount are needed.", "error")
            return redirect(url_for("admin.emi_applications"))

        inst = db.one("SELECT * FROM emi_installments WHERE id = ?", (inst_id,)) if inst_id else None
        if inst and inst["status"] == "paid":
            flash("That instalment is already marked paid.", "error")
            return redirect(url_for("admin.emi_application_detail", app_id=app_id))

        user = current_user()
        receipt = emi_core.next_receipt_no(str(settings.get("emi.receipt_prefix", "ANV")))
        paid_at = (request.form.get("paid_at") or "").strip() or db.scalar("SELECT datetime('now')")
        pay_id = db.insert("payments", {
            "receipt_no": receipt, "application_id": app_id, "installment_id": inst_id,
            "enquiry_id": app_row["enquiry_id"], "payer_name": app_row["applicant_name"],
            "amount": amount, "method": request.form.get("method") or "upi",
            "provider": (request.form.get("provider") or "").strip(),
            "provider_ref": (request.form.get("provider_ref") or "").strip(),
            "status": "paid", "paid_at": paid_at,
            "notes": (request.form.get("notes") or "").strip(),
            "recorded_by": user["id"] if user else None,
        })
        if inst:
            db.update("emi_installments", inst["id"],
                      {"status": "paid", "paid_at": paid_at, "payment_id": pay_id})

        remaining = int(db.scalar(
            "SELECT COUNT(*) FROM emi_installments WHERE application_id = ? AND status = 'due'",
            (app_id,), 0))
        scheduled = int(db.scalar(
            "SELECT COUNT(*) FROM emi_installments WHERE application_id = ?", (app_id,), 0))
        if scheduled and not remaining and app_row["status"] in ("active", "approved"):
            db.update("emi_applications", app_id, {"status": "completed"})
            flash("Final instalment recorded, the application is now complete.", "ok")
        elif app_row["status"] == "approved":
            db.update("emi_applications", app_id, {"status": "active"})

        audit.log("payment", "payments", pay_id,
                  f"{receipt} for {app_row['applicant_name']}", after={"amount": amount})
        flash(f"Payment recorded. Receipt {receipt}.", "ok")
        return redirect(url_for("admin.emi_receipt", payment_id=pay_id))

    @bp.route("/emi/payments/<int:payment_id>/void", methods=["POST"])
    @require_role("emi")
    def emi_void_payment(payment_id):
        verify_csrf()
        row = db.one("SELECT * FROM payments WHERE id = ?", (payment_id,))
        if not row:
            abort(404)
        if row["installment_id"]:
            db.update("emi_installments", row["installment_id"],
                      {"status": "due", "paid_at": None, "payment_id": None})
        db.update("payments", payment_id, {"status": "refunded"})
        audit.log("update", "payments", payment_id, f"voided {row['receipt_no']}", before=row)
        flash(f"{row['receipt_no']} voided and the instalment reopened.", "ok")
        return redirect(url_for("admin.emi_application_detail", app_id=row["application_id"]))

    @bp.route("/emi/receipt/<int:payment_id>")
    @require_role("emi")
    def emi_receipt(payment_id):
        row = db.one(
            "SELECT p.*, a.ref AS app_ref, a.applicant_name, a.phone, a.email, a.treatment_label, "
            "a.plan_label, a.tenure_months, i.seq, i.due_date, u.name AS by_name "
            "FROM payments p "
            "LEFT JOIN emi_applications a ON a.id = p.application_id "
            "LEFT JOIN emi_installments i ON i.id = p.installment_id "
            "LEFT JOIN users u ON u.id = p.recorded_by WHERE p.id = ?", (payment_id,))
        if not row:
            abort(404)
        totals = emi_core.totals(row["application_id"]) if row["application_id"] else {}
        return render_template("admin/receipt.html", title=row["receipt_no"], row=row,
                               totals=totals)

    # ── ledger ──────────────────────────────────────────────────────────────
    @bp.route("/emi/ledger")
    @require_role("emi")
    def emi_ledger():
        view = request.args.get("view", "payments")
        month = request.args.get("month", "")

        payments_sql = (
            "SELECT p.*, a.ref AS app_ref, a.applicant_name, u.name AS by_name "
            "FROM payments p LEFT JOIN emi_applications a ON a.id = p.application_id "
            "LEFT JOIN users u ON u.id = p.recorded_by WHERE 1 = 1")
        args: list = []
        if month:
            payments_sql += " AND strftime('%Y-%m', p.paid_at) = ?"
            args.append(month)
        payments_sql += " ORDER BY p.id DESC LIMIT 300"

        overdue = db.query(
            "SELECT i.*, a.ref, a.applicant_name, a.phone, a.status AS app_status, "
            "CAST(julianday('now') - julianday(i.due_date) AS INTEGER) AS days_late "
            "FROM emi_installments i JOIN emi_applications a ON a.id = i.application_id "
            "WHERE i.status = 'due' AND i.due_date < date('now') ORDER BY i.due_date")
        upcoming = db.query(
            "SELECT i.*, a.ref, a.applicant_name, a.phone FROM emi_installments i "
            "JOIN emi_applications a ON a.id = i.application_id "
            "WHERE i.status = 'due' AND i.due_date >= date('now') "
            "AND i.due_date <= date('now', '+45 days') ORDER BY i.due_date")

        return render_template(
            "admin/emi_ledger.html", title="Payments ledger", view=view, month=month,
            payments=db.query(payments_sql, args), overdue=overdue, upcoming=upcoming,
            months=db.query("SELECT DISTINCT strftime('%Y-%m', paid_at) AS m FROM payments "
                            "ORDER BY m DESC LIMIT 24"),
            summary={
                "collected": db.scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid'", (), 0),
                "month": db.scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE status = 'paid' "
                    "AND strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')", (), 0),
                "outstanding": db.scalar(
                    "SELECT COALESCE(SUM(amount), 0) FROM emi_installments WHERE status = 'due'", (), 0),
                "overdue": sum(r["amount"] for r in overdue),
            })

    @bp.route("/emi/ledger/export")
    @require_role("emi")
    def emi_ledger_export():
        which = request.args.get("what", "payments")
        buffer = io.StringIO()
        writer = csv.writer(buffer)

        if which == "outstanding":
            rows = db.query(
                "SELECT a.ref, a.applicant_name, a.phone, a.plan_label, i.seq, i.due_date, "
                "i.amount, i.status FROM emi_installments i "
                "JOIN emi_applications a ON a.id = i.application_id "
                "WHERE i.status = 'due' ORDER BY i.due_date")
            writer.writerow(["Application", "Patient", "Phone", "Plan", "Instalment",
                             "Due date", "Amount", "Status"])
            for r in rows:
                writer.writerow([r["ref"], r["applicant_name"], r["phone"], r["plan_label"],
                                 r["seq"], r["due_date"], r["amount"], r["status"]])
            name = "emi-outstanding"
        else:
            rows = db.query(
                "SELECT p.receipt_no, p.paid_at, a.ref, p.payer_name, p.amount, p.method, "
                "p.provider_ref, p.status FROM payments p "
                "LEFT JOIN emi_applications a ON a.id = p.application_id ORDER BY p.id DESC")
            writer.writerow(["Receipt", "Paid at", "Application", "Payer", "Amount",
                             "Method", "Provider ref", "Status"])
            for r in rows:
                writer.writerow([r["receipt_no"], r["paid_at"], r["ref"] or "", r["payer_name"],
                                 r["amount"], r["method"], r["provider_ref"], r["status"]])
            name = "emi-payments"

        audit.log("export", "payments", "", f"CSV of {len(rows)} {which} rows")
        stamp = date.today().isoformat()
        return Response(buffer.getvalue(), mimetype="text/csv",
                        headers={"Content-Disposition":
                                 f'attachment; filename="{name}-{stamp}.csv"'})
