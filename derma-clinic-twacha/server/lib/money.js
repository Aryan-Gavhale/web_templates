/* =============================================================================
   Money and the EMI engine.

   Everything is INTEGER paise. Rupee amounts arriving from a form are parsed
   from their string form and never routed through parseFloat, because
   parseFloat('85000.10') * 100 is 8500009.999999999 and that eventually
   becomes a receipt somebody disputes.
   ========================================================================== */

const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const INR2 = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
});

/** '85,000.50' | '85000' | 85000 -> 8500050 paise. Returns null if unparseable. */
export function toPaise(input) {
  if (input == null || input === '') return null;
  const s = String(input).trim().replace(/[₹\s,]/g, '');
  if (!/^-?\d*(\.\d{0,2})?$/.test(s) || s === '' || s === '.' || s === '-') return null;

  const neg = s.startsWith('-');
  const [rupees, frac = ''] = s.replace('-', '').split('.');
  const paise = BigInt(rupees || '0') * 100n + BigInt((frac + '00').slice(0, 2));
  const n = Number(neg ? -paise : paise);
  return Number.isSafeInteger(n) ? n : null;
}

export const toRupees = (paise) => (paise == null ? null : paise / 100);

/** 8500050 -> '₹85,000.50'; whole rupees lose the decimals. */
export function formatPaise(paise, { symbol = true } = {}) {
  if (paise == null) return '—';
  const neg = paise < 0;
  const abs = Math.abs(paise);
  const whole = Math.trunc(abs / 100);
  const frac = abs % 100;
  const body = frac === 0 ? INR.format(whole) : INR2.format(abs / 100);
  return `${neg ? '-' : ''}${symbol ? '₹' : ''}${body}`;
}

/* --------------------------------------------------------------------------
   Dates
   -------------------------------------------------------------------------- */

/**
 * The clinic's own calendar date, not the server's. SQLite's datetime('now')
 * is UTC, so between midnight and 05:30 IST a UTC date would put a payment on
 * the previous day and quietly misreport the day's collections.
 */
export const CLINIC_TZ = process.env.CLINIC_TZ || 'Asia/Kolkata';

export function localDate(d = new Date(), tz = CLINIC_TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

export const today = () => localDate();

/** First day of the clinic-local month, as YYYY-MM-DD. */
export const monthStart = () => `${today().slice(0, 7)}-01`;

/**
 * Add whole months to a YYYY-MM-DD date, clamping to the end of the target
 * month. 31 Jan + 1 month is 28 Feb, not 3 March — which is what Date
 * arithmetic would otherwise hand you, and it would silently shift every
 * subsequent due date.
 */
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const ty = t.getUTCFullYear();
  const tm = t.getUTCMonth();
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${ty}-${String(tm + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/* --------------------------------------------------------------------------
   Schedule generation
   -------------------------------------------------------------------------- */

/**
 * Build an EMI schedule.
 *
 * rateBps is the annual rate in basis points, so 1400 means 14% p.a. and 0
 * means a genuine no-cost EMI. At zero the instalments must sum to exactly the
 * financed amount, so the final row absorbs the rounding remainder rather than
 * leaving the clinic a few paise short or over.
 *
 * Above zero, the standard reducing-balance formula applies and every
 * instalment is equal, which is what an Indian patient expects to see written
 * on the plan.
 *
 * The processing fee is treated as payable up front alongside the
 * downpayment — it is not spread across the instalments.
 */
export function buildSchedule({
  principalPaise,
  downpaymentPaise = 0,
  tenureMonths,
  rateBps = 0,
  processingFeePaise = 0,
  startDate,
}) {
  if (!Number.isInteger(principalPaise) || principalPaise <= 0) {
    throw new Error('Treatment cost must be a positive amount.');
  }
  if (!Number.isInteger(downpaymentPaise) || downpaymentPaise < 0) {
    throw new Error('Down payment cannot be negative.');
  }
  if (downpaymentPaise >= principalPaise) {
    throw new Error('Down payment must be less than the treatment cost.');
  }
  if (!Number.isInteger(tenureMonths) || tenureMonths < 1 || tenureMonths > 60) {
    throw new Error('Tenure must be between 1 and 60 months.');
  }
  if (!Number.isInteger(rateBps) || rateBps < 0 || rateBps > 5000) {
    throw new Error('Interest rate must be between 0% and 50% a year.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate))) {
    throw new Error('First instalment date must be a valid date.');
  }

  const financed = principalPaise - downpaymentPaise;
  let installment;

  if (rateBps === 0) {
    installment = Math.round(financed / tenureMonths);
  } else {
    const r = rateBps / 10000 / 12;
    const growth = Math.pow(1 + r, tenureMonths);
    installment = Math.round((financed * r * growth) / (growth - 1));
  }

  const rows = [];
  let allocated = 0;

  for (let seq = 1; seq <= tenureMonths; seq++) {
    const isLast = seq === tenureMonths;
    // Only the interest-free case is forced to reconcile to the financed sum.
    const amount = isLast && rateBps === 0 ? financed - allocated : installment;
    allocated += amount;
    rows.push({ seq, due_date: addMonths(startDate, seq - 1), amount_paise: amount });
  }

  const installmentTotal = rows.reduce((s, r) => s + r.amount_paise, 0);

  return {
    financed_paise: financed,
    installment_paise: installment,
    installment_total_paise: installmentTotal,
    interest_paise: Math.max(0, installmentTotal - financed),
    total_payable_paise: downpaymentPaise + processingFeePaise + installmentTotal,
    rows,
  };
}

/* --------------------------------------------------------------------------
   Derived state
   -------------------------------------------------------------------------- */

/**
 * 'overdue' is derived, never stored: an instalment becomes overdue purely by
 * the passage of time, and a stored flag would need a nightly job to stay
 * truthful. Only states somebody actively caused are persisted.
 */
export function installmentState(inst, asOf = today()) {
  if (inst.status === 'paid' || inst.status === 'waived') return inst.status;
  if (inst.due_date < asOf) return 'overdue';
  return inst.status;
}

export const outstandingPaise = (inst) =>
  inst.status === 'waived' ? 0 : Math.max(0, inst.amount_paise - inst.paid_paise);

/** Reference generator: TWA-P-0007, TWA-R-000123 and so on. */
export const makeRef = (prefix, id, width = 4) =>
  `${prefix}${String(id).padStart(width, '0')}`;
