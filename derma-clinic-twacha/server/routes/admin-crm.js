/* =============================================================================
   Admin — dashboard, enquiries, EMI plans, instalments, payments, exports.

   This is the half of the panel that touches money, so the rules are stricter:
   every amount is integer paise, every mutation is wrapped in a transaction,
   nothing is deleted once a payment exists against it, and a voided receipt
   reverses its allocation rather than vanishing.
   ========================================================================== */

import express from 'express';
import { all, get, run, tx } from '../db.js';
import { wrap, bad, notFound, forbidden } from '../lib/http.js';
import * as v from '../lib/validate.js';
import * as google from '../lib/google.js';
import { log, recent } from '../lib/activity.js';
import {
  toPaise, formatPaise, buildSchedule, addMonths,
  installmentState, outstandingPaise, today, monthStart, makeRef,
} from '../lib/money.js';

export const router = express.Router();

/* =============================================================================
   Dashboard
   ========================================================================== */

router.get('/dashboard', wrap(async (_req, res) => {
  const day = today();
  const month = monthStart();
  const week = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);

  const paid = `is_void = 0 AND kind != 'refund'`;

  const collected = (from, to) => get(
    `SELECT COALESCE(SUM(amount_paise), 0) AS n FROM payments
      WHERE ${paid} AND received_on BETWEEN ? AND ?`, from, to
  ).n;

  const refunded = get(
    `SELECT COALESCE(SUM(amount_paise), 0) AS n FROM payments
      WHERE is_void = 0 AND kind = 'refund' AND received_on >= ?`, month
  ).n;

  /* Outstanding and overdue are computed from instalments on live plans only —
     a cancelled plan's unpaid rows are not money anybody is owed. */
  const live = `p.status IN ('active','defaulted')`;

  const outstanding = get(
    `SELECT COALESCE(SUM(i.amount_paise - i.paid_paise), 0) AS n
       FROM installments i JOIN emi_plans p ON p.id = i.plan_id
      WHERE ${live} AND i.status IN ('due','partial')`
  ).n;

  const overdue = get(
    `SELECT COUNT(*) AS c, COALESCE(SUM(i.amount_paise - i.paid_paise), 0) AS n
       FROM installments i JOIN emi_plans p ON p.id = i.plan_id
      WHERE ${live} AND i.status IN ('due','partial') AND i.due_date < ?`, day
  );

  const dueSoon = all(
    `SELECT i.id, i.seq, i.due_date, i.amount_paise, i.paid_paise, i.status,
            p.ref AS plan_ref, p.title, pt.name AS patient_name, pt.phone
       FROM installments i
       JOIN emi_plans p ON p.id = i.plan_id
       JOIN patients pt ON pt.id = p.patient_id
      WHERE ${live} AND i.status IN ('due','partial')
        AND i.due_date BETWEEN ? AND ?
      ORDER BY i.due_date ASC LIMIT 12`,
    day, addMonths(day, 1)
  );

  const overdueList = all(
    `SELECT i.id, i.seq, i.due_date, i.amount_paise, i.paid_paise, i.status,
            p.ref AS plan_ref, p.title, pt.name AS patient_name, pt.phone
       FROM installments i
       JOIN emi_plans p ON p.id = i.plan_id
       JOIN patients pt ON pt.id = p.patient_id
      WHERE ${live} AND i.status IN ('due','partial') AND i.due_date < ?
      ORDER BY i.due_date ASC LIMIT 12`, day
  );

  res.json({
    as_of: day,
    enquiries: {
      new: get(`SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new'`).n,
      high_priority: get(`SELECT COUNT(*) AS n FROM enquiries WHERE status = 'new' AND priority = 'high'`).n,
      this_week: get(`SELECT COUNT(*) AS n FROM enquiries WHERE date(created_at) >= ?`, week).n,
      wants_emi: get(`SELECT COUNT(*) AS n FROM enquiries WHERE wants_emi = 1 AND status IN ('new','contacted')`).n,
      by_status: all(`SELECT status, COUNT(*) AS n FROM enquiries GROUP BY status`),
      recent: all(
        `SELECT e.id, e.name, e.phone, e.status, e.priority, e.wants_emi, e.created_at,
                s.name AS service_name
           FROM enquiries e LEFT JOIN services s ON s.id = e.service_id
          ORDER BY e.created_at DESC, e.id DESC LIMIT 8`
      ),
    },
    money: {
      collected_today: collected(day, day),
      collected_month: collected(month, day),
      refunded_month: refunded,
      outstanding,
      overdue_amount: overdue.n,
      overdue_count: overdue.c,
      active_plans: get(`SELECT COUNT(*) AS n FROM emi_plans WHERE status = 'active'`).n,
      completed_plans: get(`SELECT COUNT(*) AS n FROM emi_plans WHERE status = 'completed'`).n,
      patients: get('SELECT COUNT(*) AS n FROM patients').n,
      recent_payments: all(
        `SELECT y.id, y.receipt_no, y.amount_paise, y.method, y.kind, y.received_on,
                pt.name AS patient_name
           FROM payments y JOIN patients pt ON pt.id = y.patient_id
          WHERE y.is_void = 0
          ORDER BY y.received_on DESC, y.id DESC LIMIT 8`
      ),
      collections_by_month: all(
        `SELECT substr(received_on, 1, 7) AS month, SUM(amount_paise) AS n
           FROM payments WHERE ${paid}
          GROUP BY month ORDER BY month DESC LIMIT 6`
      ),
    },
    schedule: { due_soon: dueSoon, overdue: overdueList },
    content: {
      services: get(`SELECT COUNT(*) AS n FROM services WHERE is_published = 1`).n,
      services_hidden: get(`SELECT COUNT(*) AS n FROM services WHERE is_published = 0`).n,
      doctors: get(`SELECT COUNT(*) AS n FROM doctors WHERE is_published = 1`).n,
      locations: get(`SELECT COUNT(*) AS n FROM locations WHERE is_published = 1`).n,
      testimonials: get(`SELECT COUNT(*) AS n FROM testimonials WHERE is_published = 1`).n,
      sections: get(`SELECT COUNT(*) AS n FROM sections`).n,
      media: get('SELECT COUNT(*) AS n FROM media').n,
    },
    google: google.status(),
    activity: recent(8),
  });
}));

router.get('/activity', wrap(async (req, res) => {
  res.json({ items: recent(v.int(req.query, 'limit', { min: 1, max: 500 }) ?? 120) });
}));

/* =============================================================================
   Enquiries
   ========================================================================== */

const ENQ_STATUS = ['new', 'contacted', 'booked', 'completed', 'closed', 'spam'];

router.get('/enquiries', wrap(async (req, res) => {
  const limit = Math.min(v.int(req.query, 'limit', { min: 1, max: 500 }) ?? 100, 500);
  const offset = v.int(req.query, 'offset', { min: 0 }) ?? 0;

  const where = [];
  const params = [];

  const status = v.str(req.query, 'status', { max: 20 });
  if (status && status !== 'all') {
    if (!ENQ_STATUS.includes(status)) throw bad('Unknown status filter.');
    where.push('e.status = ?');
    params.push(status);
  }

  const q = v.str(req.query, 'q', { max: 120 });
  if (q) {
    where.push('(e.name LIKE ? OR e.phone LIKE ? OR e.email LIKE ? OR e.message LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }

  if (v.str(req.query, 'emi_only', { max: 4 }) === '1') where.push('e.wants_emi = 1');

  const from = v.date(req.query, 'from', { label: 'From date' });
  if (from) { where.push('date(e.created_at) >= ?'); params.push(from); }
  const to = v.date(req.query, 'to', { label: 'To date' });
  if (to) { where.push('date(e.created_at) <= ?'); params.push(to); }

  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const items = all(
    `SELECT e.*, s.name AS service_name, l.name AS location_name,
            u.name AS assignee_name, p.name AS patient_name,
            (SELECT COUNT(*) FROM enquiry_notes n WHERE n.enquiry_id = e.id) AS note_count
       FROM enquiries e
       LEFT JOIN services s ON s.id = e.service_id
       LEFT JOIN locations l ON l.id = e.location_id
       LEFT JOIN users u ON u.id = e.assigned_to
       LEFT JOIN patients p ON p.id = e.patient_id
       ${clause}
      ORDER BY CASE e.priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
               e.created_at DESC, e.id DESC
      LIMIT ? OFFSET ?`,
    ...params, limit, offset
  );

  const total = get(`SELECT COUNT(*) AS n FROM enquiries e${clause}`, ...params).n;
  res.json({ items, total, limit, offset });
}));

router.get('/enquiries/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const row = get(
    `SELECT e.*, s.name AS service_name, l.name AS location_name,
            u.name AS assignee_name, p.name AS patient_name, p.ref AS patient_ref
       FROM enquiries e
       LEFT JOIN services s ON s.id = e.service_id
       LEFT JOIN locations l ON l.id = e.location_id
       LEFT JOIN users u ON u.id = e.assigned_to
       LEFT JOIN patients p ON p.id = e.patient_id
      WHERE e.id = ?`, id
  );
  if (!row) throw notFound('That enquiry no longer exists.');

  row.notes = all(
    `SELECT n.id, n.note, n.created_at, u.name AS user_name
       FROM enquiry_notes n LEFT JOIN users u ON u.id = n.user_id
      WHERE n.enquiry_id = ? ORDER BY n.created_at ASC, n.id ASC`, id
  );
  res.json(row);
}));

router.patch('/enquiries/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const existing = get('SELECT * FROM enquiries WHERE id = ?', id);
  if (!existing) throw notFound('That enquiry no longer exists.');

  const b = req.body || {};
  const patch = {};

  if (Object.hasOwn(b, 'status')) patch.status = v.pick(b, 'status', ENQ_STATUS, { required: true, label: 'Status' });
  if (Object.hasOwn(b, 'priority')) patch.priority = v.pick(b, 'priority', ['low', 'normal', 'high'], { required: true, label: 'Priority' });
  if (Object.hasOwn(b, 'assigned_to')) {
    patch.assigned_to = b.assigned_to === null || b.assigned_to === ''
      ? null : v.fk(b, 'assigned_to', 'users', get, { label: 'Assignee' });
  }
  if (Object.hasOwn(b, 'preferred_time')) patch.preferred_time = v.str(b, 'preferred_time', { max: 120 });
  if (Object.hasOwn(b, 'service_id')) {
    patch.service_id = b.service_id === null || b.service_id === ''
      ? null : v.fk(b, 'service_id', 'services', get, { label: 'Treatment' });
  }

  if (!Object.keys(patch).length) throw bad('Nothing to update.');

  const cols = Object.keys(patch);
  run(
    `UPDATE enquiries SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now')
      WHERE id = ?`,
    ...cols.map((c) => patch[c]), id
  );

  log(req, 'update', 'enquiries', id, patch);
  res.json({ ok: true });
}));

router.post('/enquiries/:id/notes', wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (!get('SELECT id FROM enquiries WHERE id = ?', id)) throw notFound('That enquiry no longer exists.');

  const note = v.str(req.body, 'note', { required: true, max: 4000, label: 'Note' });
  const r = run(
    'INSERT INTO enquiry_notes (enquiry_id, user_id, note) VALUES (?, ?, ?)',
    id, req.user.id, note
  );
  run(`UPDATE enquiries SET updated_at = datetime('now') WHERE id = ?`, id);

  log(req, 'note', 'enquiries', id, null);
  res.status(201).json({ ok: true, id: Number(r.lastInsertRowid) });
}));

/**
 * Turn an enquiry into a patient record. Matches on phone number first, so a
 * returning patient does not end up duplicated in the ledger.
 */
router.post('/enquiries/:id/convert', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const e = get('SELECT * FROM enquiries WHERE id = ?', id);
  if (!e) throw notFound('That enquiry no longer exists.');
  if (e.patient_id) {
    const existing = get('SELECT id, ref, name FROM patients WHERE id = ?', e.patient_id);
    if (existing) return res.json({ ok: true, patient: existing, created: false, matched: 'already-linked' });
  }

  const result = tx(() => {
    let patient = get('SELECT id, ref, name FROM patients WHERE phone = ?', e.phone);
    let created = false;

    if (!patient) {
      const r = run(
        'INSERT INTO patients (name, phone, email, notes) VALUES (?, ?, ?, ?)',
        e.name, e.phone, e.email,
        `Created from website enquiry #${id} on ${today()}.`
      );
      const pid = Number(r.lastInsertRowid);
      run('UPDATE patients SET ref = ? WHERE id = ?', makeRef('PT-', pid), pid);
      patient = get('SELECT id, ref, name FROM patients WHERE id = ?', pid);
      created = true;
    }

    run(
      `UPDATE enquiries
          SET patient_id = ?, status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END,
              updated_at = datetime('now')
        WHERE id = ?`,
      patient.id, id
    );
    return { patient, created };
  });

  log(req, 'convert', 'enquiries', id, {
    patient: `${result.patient.name} ${result.patient.ref || ''}`.trim(),
    record: result.created ? 'new patient created' : 'matched an existing phone number',
  });
  res.json({
    ok: true,
    ...result,
    matched: result.created ? 'new' : 'existing-phone',
  });
}));

/* =============================================================================
   Patient detail — plans, instalments and receipts in one view
   ========================================================================== */

router.get('/patient-file/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const patient = get('SELECT * FROM patients WHERE id = ?', id);
  if (!patient) throw notFound('No such patient.');

  const plans = all('SELECT * FROM emi_plans WHERE patient_id = ? ORDER BY id DESC', id)
    .map((p) => ({ ...p, ...planRollup(p.id) }));

  res.json({
    patient,
    plans,
    payments: all(
      `SELECT y.*, p.ref AS plan_ref, u.name AS received_by_name
         FROM payments y
         LEFT JOIN emi_plans p ON p.id = y.plan_id
         LEFT JOIN users u ON u.id = y.received_by
        WHERE y.patient_id = ? ORDER BY y.received_on DESC, y.id DESC`, id
    ),
    enquiries: all(
      `SELECT e.id, e.status, e.created_at, s.name AS service_name
         FROM enquiries e LEFT JOIN services s ON s.id = e.service_id
        WHERE e.patient_id = ? ORDER BY e.created_at DESC`, id
    ),
    totals: {
      paid: get(`SELECT COALESCE(SUM(amount_paise),0) AS n FROM payments
                  WHERE patient_id = ? AND is_void = 0 AND kind != 'refund'`, id).n,
      refunded: get(`SELECT COALESCE(SUM(amount_paise),0) AS n FROM payments
                      WHERE patient_id = ? AND is_void = 0 AND kind = 'refund'`, id).n,
    },
  });
}));

/* =============================================================================
   EMI plans
   ========================================================================== */

function parsePlanInput(b) {
  return {
    principal: v.paiseField(b, 'principal', toPaise, { required: true, min: 100, max: 500_000_000, label: 'Treatment cost' }),
    downpayment: v.paiseField(b, 'downpayment', toPaise, { min: 0, max: 500_000_000, label: 'Down payment' }) ?? 0,
    tenure: v.int(b, 'tenure_months', { required: true, min: 1, max: 60, label: 'Tenure' }),
    rateBps: v.int(b, 'interest_rate_bps', { min: 0, max: 5000, label: 'Interest rate' }) ?? 0,
    fee: v.paiseField(b, 'processing_fee', toPaise, { min: 0, max: 10_000_000, label: 'Processing fee' }) ?? 0,
    startDate: v.date(b, 'start_date', { required: true, label: 'First instalment date' }),
  };
}

/** Dry run: show the owner the schedule before anything is written. */
router.post('/emi-plans/preview', wrap(async (req, res) => {
  const p = parsePlanInput(req.body || {});
  let schedule;
  try {
    schedule = buildSchedule({
      principalPaise: p.principal,
      downpaymentPaise: p.downpayment,
      tenureMonths: p.tenure,
      rateBps: p.rateBps,
      processingFeePaise: p.fee,
      startDate: p.startDate,
    });
  } catch (err) {
    throw bad(err.message);
  }

  res.json({
    ok: true,
    ...schedule,
    display: {
      installment: formatPaise(schedule.installment_paise),
      financed: formatPaise(schedule.financed_paise),
      interest: formatPaise(schedule.interest_paise),
      total: formatPaise(schedule.total_payable_paise),
    },
    is_no_cost: p.rateBps === 0,
  });
}));

router.get('/emi-plans', wrap(async (req, res) => {
  const limit = Math.min(v.int(req.query, 'limit', { min: 1, max: 500 }) ?? 100, 500);
  const where = [];
  const params = [];

  const status = v.str(req.query, 'status', { max: 20 });
  if (status && status !== 'all') {
    where.push('p.status = ?');
    params.push(v.pick({ status }, 'status', ['active', 'completed', 'cancelled', 'defaulted'], { required: true, label: 'Status' }));
  }
  const q = v.str(req.query, 'q', { max: 120 });
  if (q) {
    where.push('(pt.name LIKE ? OR pt.phone LIKE ? OR p.ref LIKE ? OR p.title LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const rows = all(
    `SELECT p.*, pt.name AS patient_name, pt.phone, pt.ref AS patient_ref, s.name AS service_name
       FROM emi_plans p
       JOIN patients pt ON pt.id = p.patient_id
       LEFT JOIN services s ON s.id = p.service_id
       ${clause}
      ORDER BY p.id DESC LIMIT ?`, ...params, limit
  ).map((p) => ({ ...p, ...planRollup(p.id) }));

  res.json({
    items: rows,
    total: get(`SELECT COUNT(*) AS n FROM emi_plans p JOIN patients pt ON pt.id = p.patient_id${clause}`, ...params).n,
  });
}));

/** Per-plan aggregate: what is paid, what is left, what is late, what is next. */
function planRollup(planId) {
  const day = today();
  const agg = get(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'paid'   THEN 1 ELSE 0 END) AS paid_count,
            SUM(CASE WHEN status = 'waived' THEN 1 ELSE 0 END) AS waived_count,
            COALESCE(SUM(paid_paise), 0) AS paid_paise,
            COALESCE(SUM(CASE WHEN status IN ('due','partial')
                              THEN amount_paise - paid_paise ELSE 0 END), 0) AS outstanding_paise,
            COALESCE(SUM(CASE WHEN status IN ('due','partial') AND due_date < ?
                              THEN amount_paise - paid_paise ELSE 0 END), 0) AS overdue_paise,
            SUM(CASE WHEN status IN ('due','partial') AND due_date < ? THEN 1 ELSE 0 END) AS overdue_count
       FROM installments WHERE plan_id = ?`, day, day, planId
  );
  const next = get(
    `SELECT seq, due_date, amount_paise - paid_paise AS amount_paise
       FROM installments
      WHERE plan_id = ? AND status IN ('due','partial')
      ORDER BY due_date ASC LIMIT 1`, planId
  );
  return { rollup: { ...agg, next_due: next || null } };
}

router.get('/emi-plans/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const plan = get(
    `SELECT p.*, pt.name AS patient_name, pt.phone, pt.email, pt.ref AS patient_ref,
            s.name AS service_name, u.name AS created_by_name
       FROM emi_plans p
       JOIN patients pt ON pt.id = p.patient_id
       LEFT JOIN services s ON s.id = p.service_id
       LEFT JOIN users u ON u.id = p.created_by
      WHERE p.id = ?`, id
  );
  if (!plan) throw notFound('That plan no longer exists.');

  const day = today();
  plan.installments = all(
    'SELECT * FROM installments WHERE plan_id = ? ORDER BY seq ASC', id
  ).map((i) => ({
    ...i,
    state: installmentState(i, day),
    outstanding_paise: outstandingPaise(i),
  }));

  plan.payments = all(
    `SELECT y.*, u.name AS received_by_name
       FROM payments y LEFT JOIN users u ON u.id = y.received_by
      WHERE y.plan_id = ? ORDER BY y.received_on DESC, y.id DESC`, id
  );

  Object.assign(plan, planRollup(id));
  res.json(plan);
}));

router.post('/emi-plans', wrap(async (req, res) => {
  const b = req.body || {};
  const patientId = v.fk(b, 'patient_id', 'patients', get, { required: true, label: 'Patient' });
  const serviceId = v.fk(b, 'service_id', 'services', get, { label: 'Treatment' });
  const title = v.str(b, 'title', { required: true, max: 200, label: 'Plan name' });
  const notes = v.str(b, 'notes', { max: 4000 });
  const p = parsePlanInput(b);
  const collectDown = v.bool(b, 'record_downpayment');

  let schedule;
  try {
    schedule = buildSchedule({
      principalPaise: p.principal,
      downpaymentPaise: p.downpayment,
      tenureMonths: p.tenure,
      rateBps: p.rateBps,
      processingFeePaise: p.fee,
      startDate: p.startDate,
    });
  } catch (err) {
    throw bad(err.message);
  }

  const planId = tx(() => {
    const r = run(
      `INSERT INTO emi_plans
         (patient_id, service_id, title, principal_paise, downpayment_paise,
          financed_paise, tenure_months, interest_rate_bps, processing_fee_paise,
          installment_paise, total_payable_paise, start_date, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      patientId, serviceId, title, p.principal, p.downpayment,
      schedule.financed_paise, p.tenure, p.rateBps, p.fee,
      schedule.installment_paise, schedule.total_payable_paise,
      p.startDate, notes, req.user.id
    );
    const pid = Number(r.lastInsertRowid);
    run('UPDATE emi_plans SET ref = ? WHERE id = ?', makeRef('EMI-', pid), pid);

    for (const row of schedule.rows) {
      run(
        'INSERT INTO installments (plan_id, seq, due_date, amount_paise) VALUES (?,?,?,?)',
        pid, row.seq, row.due_date, row.amount_paise
      );
    }

    if (collectDown && p.downpayment > 0) {
      const py = run(
        `INSERT INTO payments (patient_id, plan_id, amount_paise, kind, method, received_on, received_by, notes)
         VALUES (?, ?, ?, 'downpayment', ?, ?, ?, ?)`,
        patientId, pid, p.downpayment,
        v.pick(b, 'downpayment_method', ['cash', 'upi', 'card', 'netbanking', 'neft', 'cheque', 'other'], { fallback: 'upi' }),
        today(), req.user.id, 'Down payment recorded with plan creation.'
      );
      const pyId = Number(py.lastInsertRowid);
      run('UPDATE payments SET receipt_no = ? WHERE id = ?', makeRef('RC-', pyId, 5), pyId);
    }

    return pid;
  });

  log(req, 'create', 'emi_plans', planId, {
    ref: makeRef('EMI-', planId),
    patient: get('SELECT name FROM patients WHERE id = ?', patientId)?.name || null,
    principal: p.principal,
    tenure: `${p.tenure} months`,
    rate: p.rateBps ? `${(p.rateBps / 100).toFixed(2)}% p.a.` : 'no-cost',
  });

  res.status(201).json({ ok: true, id: planId, ref: makeRef('EMI-', planId) });
}));

router.patch('/emi-plans/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const plan = get('SELECT * FROM emi_plans WHERE id = ?', id);
  if (!plan) throw notFound('That plan no longer exists.');

  const b = req.body || {};
  const patch = {};
  if (Object.hasOwn(b, 'title')) patch.title = v.str(b, 'title', { required: true, max: 200, label: 'Plan name' });
  if (Object.hasOwn(b, 'notes')) patch.notes = v.str(b, 'notes', { max: 4000 });
  if (Object.hasOwn(b, 'status')) {
    patch.status = v.pick(b, 'status', ['active', 'completed', 'cancelled', 'defaulted'], { required: true, label: 'Status' });
    if (patch.status === 'cancelled') {
      const paid = get(
        `SELECT COALESCE(SUM(paid_paise),0) AS n FROM installments WHERE plan_id = ?`, id
      ).n;
      if (paid > 0 && !v.bool(b, 'confirm_cancel')) {
        throw bad(
          `${formatPaise(paid)} has already been collected against this plan. ` +
          'Cancelling leaves those receipts in place — confirm to proceed.',
          { needs: 'confirm_cancel' }
        );
      }
    }
  }

  /* The financial terms are deliberately immutable. Changing a rate or tenure
     after instalments exist would rewrite a schedule the patient has already
     been given, so the answer is to cancel and re-issue. */
  for (const locked of ['principal', 'tenure_months', 'interest_rate_bps', 'start_date', 'downpayment']) {
    if (Object.hasOwn(b, locked)) {
      throw bad('The financial terms of a plan cannot be edited once it exists. Cancel it and create a replacement.');
    }
  }

  if (!Object.keys(patch).length) throw bad('Nothing to update.');
  const cols = Object.keys(patch);
  run(
    `UPDATE emi_plans SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`,
    ...cols.map((c) => patch[c]), id
  );

  log(req, 'update', 'emi_plans', id, patch);
  res.json({ ok: true });
}));

router.delete('/emi-plans/:id', wrap(async (req, res) => {
  if (!['owner', 'manager'].includes(req.user.role)) {
    throw forbidden('Only an owner or manager can delete a plan.');
  }
  const id = Number(req.params.id);
  const plan = get('SELECT * FROM emi_plans WHERE id = ?', id);
  if (!plan) throw notFound('That plan no longer exists.');

  const receipts = get('SELECT COUNT(*) AS n FROM payments WHERE plan_id = ?', id).n;
  if (receipts > 0) {
    throw bad(
      `This plan has ${receipts} receipt${receipts > 1 ? 's' : ''} against it and cannot be deleted. ` +
      'Set its status to cancelled instead — the record stays, which is what an audit needs.'
    );
  }

  run('DELETE FROM emi_plans WHERE id = ?', id);
  log(req, 'delete', 'emi_plans', id, { ref: plan.ref });
  res.json({ ok: true });
}));

/* =============================================================================
   Instalments
   ========================================================================== */

router.get('/installments', wrap(async (req, res) => {
  const day = today();
  const limit = Math.min(v.int(req.query, 'limit', { min: 1, max: 500 }) ?? 200, 500);

  const where = [`p.status IN ('active','defaulted')`];
  const params = [];

  const view = v.pick(req.query, 'view', ['all', 'overdue', 'due', 'paid', 'month'], { fallback: 'all' });
  if (view === 'overdue') { where.push(`i.status IN ('due','partial') AND i.due_date < ?`); params.push(day); }
  if (view === 'due') { where.push(`i.status IN ('due','partial') AND i.due_date >= ?`); params.push(day); }
  if (view === 'paid') where.push(`i.status = 'paid'`);
  if (view === 'month') { where.push('substr(i.due_date, 1, 7) = ?'); params.push(day.slice(0, 7)); }

  const q = v.str(req.query, 'q', { max: 120 });
  if (q) { where.push('(pt.name LIKE ? OR pt.phone LIKE ? OR p.ref LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }

  const rows = all(
    `SELECT i.*, p.ref AS plan_ref, p.title, p.id AS plan_id,
            pt.id AS patient_id, pt.name AS patient_name, pt.phone, pt.ref AS patient_ref
       FROM installments i
       JOIN emi_plans p ON p.id = i.plan_id
       JOIN patients pt ON pt.id = p.patient_id
      WHERE ${where.join(' AND ')}
      ORDER BY i.due_date ASC, i.seq ASC LIMIT ?`, ...params, limit
  ).map((i) => ({ ...i, state: installmentState(i, day), outstanding_paise: outstandingPaise(i) }));

  res.json({ items: rows, total: rows.length, as_of: day });
}));

router.patch('/installments/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  const inst = get('SELECT * FROM installments WHERE id = ?', id);
  if (!inst) throw notFound('That instalment no longer exists.');

  const b = req.body || {};
  const patch = {};

  if (Object.hasOwn(b, 'due_date')) patch.due_date = v.date(b, 'due_date', { required: true, label: 'Due date' });
  if (Object.hasOwn(b, 'notes')) patch.notes = v.str(b, 'notes', { max: 1000 });

  if (Object.hasOwn(b, 'waive')) {
    if (v.bool(b, 'waive')) {
      if (inst.paid_paise > 0) {
        throw bad(`${formatPaise(inst.paid_paise)} has already been received against this instalment. Void that receipt first.`);
      }
      patch.status = 'waived';
    } else if (inst.status === 'waived') {
      patch.status = 'due';
    }
  }

  if (!Object.keys(patch).length) throw bad('Nothing to update.');

  tx(() => {
    const cols = Object.keys(patch);
    run(
      `UPDATE installments SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`,
      ...cols.map((c) => patch[c]), id
    );
    refreshPlanStatus(inst.plan_id);
  });

  log(req, 'update', 'installments', id, patch);
  res.json({ ok: true });
}));

/* =============================================================================
   Payments
   ========================================================================== */

const METHODS = ['cash', 'upi', 'card', 'netbanking', 'neft', 'cheque', 'other'];
const KINDS = ['installment', 'downpayment', 'consultation', 'procedure', 'other', 'refund'];

router.get('/payments', wrap(async (req, res) => {
  const limit = Math.min(v.int(req.query, 'limit', { min: 1, max: 500 }) ?? 150, 500);
  const where = [];
  const params = [];

  if (v.str(req.query, 'include_void', { max: 4 }) !== '1') where.push('y.is_void = 0');

  const from = v.date(req.query, 'from', { label: 'From date' });
  if (from) { where.push('y.received_on >= ?'); params.push(from); }
  const to = v.date(req.query, 'to', { label: 'To date' });
  if (to) { where.push('y.received_on <= ?'); params.push(to); }

  const method = v.str(req.query, 'method', { max: 20 });
  if (method && method !== 'all') { where.push('y.method = ?'); params.push(v.pick({ method }, 'method', METHODS, { required: true, label: 'Method' })); }

  const q = v.str(req.query, 'q', { max: 120 });
  if (q) { where.push('(pt.name LIKE ? OR pt.phone LIKE ? OR y.receipt_no LIKE ? OR y.reference LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }

  const clause = where.length ? ` WHERE ${where.join(' AND ')}` : '';

  const items = all(
    `SELECT y.*, pt.name AS patient_name, pt.phone, pt.ref AS patient_ref,
            p.ref AS plan_ref, i.seq AS installment_seq, u.name AS received_by_name
       FROM payments y
       JOIN patients pt ON pt.id = y.patient_id
       LEFT JOIN emi_plans p ON p.id = y.plan_id
       LEFT JOIN installments i ON i.id = y.installment_id
       LEFT JOIN users u ON u.id = y.received_by
       ${clause}
      ORDER BY y.received_on DESC, y.id DESC LIMIT ?`, ...params, limit
  );

  const totals = get(
    `SELECT COALESCE(SUM(CASE WHEN y.kind != 'refund' THEN y.amount_paise ELSE 0 END), 0) AS collected,
            COALESCE(SUM(CASE WHEN y.kind  = 'refund' THEN y.amount_paise ELSE 0 END), 0) AS refunded,
            COUNT(*) AS n
       FROM payments y JOIN patients pt ON pt.id = y.patient_id${clause}`, ...params
  );

  res.json({ items, totals, by_method: all(
    `SELECT y.method, COUNT(*) AS n, SUM(y.amount_paise) AS amount
       FROM payments y JOIN patients pt ON pt.id = y.patient_id${clause}
      GROUP BY y.method ORDER BY amount DESC`, ...params
  ) });
}));

router.post('/payments', wrap(async (req, res) => {
  const b = req.body || {};
  const patientId = v.fk(b, 'patient_id', 'patients', get, { required: true, label: 'Patient' });
  const amount = v.paiseField(b, 'amount', toPaise, { required: true, min: 1, max: 500_000_000, label: 'Amount' });
  const kind = v.pick(b, 'kind', KINDS, { fallback: 'installment', label: 'Type' });
  const method = v.pick(b, 'method', METHODS, { fallback: 'upi', label: 'Method' });
  const reference = v.str(b, 'reference', { max: 120 });
  const notes = v.str(b, 'notes', { max: 1000 });
  const receivedOn = v.date(b, 'received_on', { label: 'Date received' }) || today();

  if (receivedOn > today()) throw bad('A payment cannot be dated in the future.', { field: 'received_on' });

  const installmentId = v.int(b, 'installment_id', { min: 1, label: 'Instalment' });
  let planId = v.int(b, 'plan_id', { min: 1, label: 'Plan' });
  let inst = null;

  if (installmentId) {
    inst = get(
      `SELECT i.*, p.patient_id, p.id AS plan_id, p.ref AS plan_ref
         FROM installments i JOIN emi_plans p ON p.id = i.plan_id WHERE i.id = ?`, installmentId
    );
    if (!inst) throw notFound('That instalment no longer exists.');
    if (inst.patient_id !== patientId) {
      throw bad('That instalment belongs to a different patient.', { field: 'installment_id' });
    }
    if (inst.status === 'waived') throw bad('That instalment has been waived. Un-waive it before recording a payment.');
    if (inst.status === 'paid') throw bad(`Instalment ${inst.seq} is already settled in full.`);

    const owing = inst.amount_paise - inst.paid_paise;
    if (amount > owing) {
      throw bad(
        `That is more than the ${formatPaise(owing)} outstanding on instalment ${inst.seq}. ` +
        'Record the exact amount here and enter any surplus as a separate payment against the next instalment.',
        { field: 'amount', outstanding_paise: owing }
      );
    }
    planId = inst.plan_id;
  } else if (planId) {
    const plan = get('SELECT id, patient_id FROM emi_plans WHERE id = ?', planId);
    if (!plan) throw notFound('That plan no longer exists.');
    if (plan.patient_id !== patientId) throw bad('That plan belongs to a different patient.', { field: 'plan_id' });
  }

  const paymentId = tx(() => {
    const r = run(
      `INSERT INTO payments
         (patient_id, plan_id, installment_id, amount_paise, kind, method,
          reference, received_on, received_by, notes)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      patientId, planId || null, installmentId || null, amount, kind, method,
      reference, receivedOn, req.user.id, notes
    );
    const pid = Number(r.lastInsertRowid);
    run('UPDATE payments SET receipt_no = ? WHERE id = ?', makeRef('RC-', pid, 5), pid);

    if (inst) {
      const paid = inst.paid_paise + amount;
      run(
        `UPDATE installments SET paid_paise = ?, status = ?, paid_on = ? WHERE id = ?`,
        paid,
        paid >= inst.amount_paise ? 'paid' : 'partial',
        paid >= inst.amount_paise ? receivedOn : null,
        inst.id
      );
      refreshPlanStatus(inst.plan_id);
    }
    return pid;
  });

  /* Names and references, not primary keys. Somebody auditing a disputed
     receipt is holding a receipt number and a patient's name, and has no way to
     turn `patient_id=2` into either. */
  log(req, 'payment', 'payments', paymentId, {
    receipt: makeRef('RC-', paymentId, 5),
    patient: get('SELECT name FROM patients WHERE id = ?', patientId)?.name || null,
    amount,
    method,
    kind,
    instalment: inst ? `${inst.plan_ref} no. ${inst.seq}` : null,
  });

  res.status(201).json({
    ok: true,
    id: paymentId,
    receipt_no: makeRef('RC-', paymentId, 5),
    amount_display: formatPaise(amount),
  });
}));

/**
 * Void rather than delete. The receipt number stays spent and the reason is on
 * the record, which is the difference between a correction and a cover-up.
 */
router.post('/payments/:id/void', wrap(async (req, res) => {
  if (!['owner', 'manager'].includes(req.user.role)) {
    throw forbidden('Only an owner or manager can void a receipt.');
  }
  const id = Number(req.params.id);
  const pay = get('SELECT * FROM payments WHERE id = ?', id);
  if (!pay) throw notFound('No such receipt.');
  if (pay.is_void) throw bad('That receipt is already void.');

  const reason = v.str(req.body, 'reason', { required: true, min: 4, max: 500, label: 'Reason' });

  tx(() => {
    run('UPDATE payments SET is_void = 1, void_reason = ? WHERE id = ?', reason, id);

    if (pay.installment_id) {
      const inst = get('SELECT * FROM installments WHERE id = ?', pay.installment_id);
      if (inst) {
        const paid = Math.max(0, inst.paid_paise - pay.amount_paise);
        run(
          `UPDATE installments SET paid_paise = ?, status = ?, paid_on = ? WHERE id = ?`,
          paid,
          paid === 0 ? 'due' : (paid >= inst.amount_paise ? 'paid' : 'partial'),
          paid >= inst.amount_paise ? inst.paid_on : null,
          inst.id
        );
        refreshPlanStatus(inst.plan_id);
      }
    } else if (pay.plan_id) {
      refreshPlanStatus(pay.plan_id);
    }
  });

  log(req, 'void', 'payments', id, {
    receipt: pay.receipt_no, amount: pay.amount_paise, reason,
  });
  res.json({ ok: true });
}));

/**
 * A plan is complete when nothing is left owing, and drops back to active if a
 * void re-opens an instalment. Cancelled and defaulted are human decisions and
 * are never overwritten here.
 */
function refreshPlanStatus(planId) {
  const plan = get('SELECT status FROM emi_plans WHERE id = ?', planId);
  if (!plan || ['cancelled', 'defaulted'].includes(plan.status)) return;

  const open = get(
    `SELECT COUNT(*) AS n FROM installments WHERE plan_id = ? AND status IN ('due','partial')`, planId
  ).n;

  const next = open === 0 ? 'completed' : 'active';
  if (next !== plan.status) {
    run(`UPDATE emi_plans SET status = ?, updated_at = datetime('now') WHERE id = ?`, next, planId);
  }
}

/* =============================================================================
   CSV export
   ========================================================================== */

/* Excel opens a bare CSV in the system encoding and mangles ₹ and Devanagari,
   so a BOM goes on the front. The leading-character guard stops a cell that
   begins with =, +, - or @ from being run as a formula. */
const csvCell = (val) => {
  if (val == null) return '';
  let s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function sendCsv(res, filename, headers, rows) {
  const body = [headers.join(','), ...rows.map((r) => r.map(csvCell).join(','))].join('\r\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(`\uFEFF${body}`);
}

router.get('/export/enquiries.csv', wrap(async (req, res) => {
  const rows = all(
    `SELECT e.id, e.created_at, e.name, e.phone, e.email, s.name AS service,
            l.name AS clinic, e.status, e.priority, e.wants_emi,
            e.preferred_time, e.message, u.name AS assignee
       FROM enquiries e
       LEFT JOIN services s ON s.id = e.service_id
       LEFT JOIN locations l ON l.id = e.location_id
       LEFT JOIN users u ON u.id = e.assigned_to
      ORDER BY e.created_at DESC`
  );
  log(req, 'export', 'enquiries', null, { rows: rows.length });
  sendCsv(res, `enquiries-${today()}.csv`,
    ['ID', 'Received', 'Name', 'Phone', 'Email', 'Treatment', 'Clinic', 'Status',
      'Priority', 'Wants EMI', 'Preferred time', 'Message', 'Assigned to'],
    rows.map((r) => [r.id, r.created_at, r.name, r.phone, r.email, r.service, r.clinic,
      r.status, r.priority, r.wants_emi ? 'Yes' : 'No', r.preferred_time, r.message, r.assignee])
  );
}));

router.get('/export/payments.csv', wrap(async (req, res) => {
  const rows = all(
    `SELECT y.receipt_no, y.received_on, pt.name AS patient, pt.phone, p.ref AS plan,
            i.seq AS installment, y.kind, y.method, y.amount_paise, y.reference,
            y.is_void, y.void_reason, u.name AS received_by
       FROM payments y
       JOIN patients pt ON pt.id = y.patient_id
       LEFT JOIN emi_plans p ON p.id = y.plan_id
       LEFT JOIN installments i ON i.id = y.installment_id
       LEFT JOIN users u ON u.id = y.received_by
      ORDER BY y.received_on DESC, y.id DESC`
  );
  log(req, 'export', 'payments', null, { rows: rows.length });
  sendCsv(res, `payments-${today()}.csv`,
    ['Receipt', 'Date', 'Patient', 'Phone', 'Plan', 'Instalment', 'Type', 'Method',
      'Amount (INR)', 'Reference', 'Void', 'Void reason', 'Received by'],
    rows.map((r) => [r.receipt_no, r.received_on, r.patient, r.phone, r.plan, r.installment,
      r.kind, r.method, (r.amount_paise / 100).toFixed(2), r.reference,
      r.is_void ? 'VOID' : '', r.void_reason, r.received_by])
  );
}));

router.get('/export/installments.csv', wrap(async (req, res) => {
  const day = today();
  const rows = all(
    `SELECT p.ref AS plan, pt.name AS patient, pt.phone, i.seq, i.due_date,
            i.amount_paise, i.paid_paise, i.status, i.paid_on, p.status AS plan_status
       FROM installments i
       JOIN emi_plans p ON p.id = i.plan_id
       JOIN patients pt ON pt.id = p.patient_id
      ORDER BY i.due_date ASC`
  );
  log(req, 'export', 'installments', null, { rows: rows.length });
  sendCsv(res, `installments-${day}.csv`,
    ['Plan', 'Patient', 'Phone', 'No.', 'Due date', 'Amount (INR)', 'Paid (INR)',
      'Outstanding (INR)', 'State', 'Paid on', 'Plan status'],
    rows.map((r) => [r.plan, r.patient, r.phone, r.seq, r.due_date,
      (r.amount_paise / 100).toFixed(2), (r.paid_paise / 100).toFixed(2),
      (outstandingPaise(r) / 100).toFixed(2),
      installmentState(r, day), r.paid_on, r.plan_status])
  );
}));
