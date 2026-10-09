// ============================================================
// FEE CYCLES AND DUE DATES
//
// Every figure here comes from data stored per student (next_due_date,
// fee_cycle_months, ...). Where a student has no due date the state is
// UNKNOWN — the apps show "not set" rather than a made-up number.
//
// Pure module (no runtime imports) so backend-tests can load it directly.
// ============================================================

export type FeeState = "PAID" | "DUE_SOON" | "DUE_TODAY" | "OVERDUE" | "UNKNOWN" | "INACTIVE";

/** Days before the due date that a fee starts showing as "due soon". */
export const DEFAULT_ADVANCE_DAYS = 3;

const NOT_CHASED = new Set(["LEFT", "INACTIVE", "DUPLICATE", "TEST"]);

const DAY_MS = 86400000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today in the academy's timezone (IST), as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function parseIso(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
}

/** Whole days from today to the due date: negative when overdue. */
export function daysUntil(dueDate: string, today: string): number | null {
  const due = parseIso(dueDate);
  const now = parseIso(today);
  if (due == null || now == null) return null;
  return Math.round((due - now) / DAY_MS);
}

/**
 * Fee state for one student. `status` is the enrolment status: a student who
 * has left is never chased for fees.
 */
export function feeState(
  dueDate: string | null | undefined,
  today: string,
  opts: { status?: string; advanceDays?: number } = {},
): FeeState {
  // Left, duplicated and test records are not real enrolments to chase.
  const status = (opts.status ?? "").toUpperCase();
  if (NOT_CHASED.has(status)) return "INACTIVE";
  const advance = opts.advanceDays ?? DEFAULT_ADVANCE_DAYS;
  if (!dueDate) return "UNKNOWN";
  const days = daysUntil(dueDate, today);
  if (days == null) return "UNKNOWN";
  if (days < 0) return "OVERDUE";
  if (days === 0) return "DUE_TODAY";
  if (days <= advance) return "DUE_SOON";
  return "PAID";
}

/** Add whole months, clamping to the end of a shorter month (31 Jan + 1m = 28 Feb). */
export function addMonths(date: string, months: number): string {
  const ms = parseIso(date);
  if (ms == null) return date;
  const d = new Date(ms);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d.toISOString().slice(0, 10);
}

export interface CycleAdvance {
  cycleStart: string;
  cycleEnd: string;
  nextDueDate: string;
}

/** Fee due date lands on this day of the month when a student has no
 *  per-student fee_due_day of their own (founder request 2026-10-07). */
export const DEFAULT_FEE_DUE_DAY = 5;

/** Add whole months, then pin the result to `dueDay` of that month (clamped
 *  to the month's last day) — unlike addMonths, which keeps the original
 *  day-of-month. Every renewal lands on the student's fixed due day
 *  regardless of which day within the month the triggering payment fell on. */
function monthsFromPinnedToDueDay(date: string, months: number, dueDay: number): string {
  const ms = parseIso(date);
  if (ms == null) return date;
  const d = new Date(ms);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(dueDay, lastDay));
  return d.toISOString().slice(0, 10);
}

/**
 * Move a student's fee cycle on after a payment. The new cycle always
 * starts at the actual payment date — not at whatever next_due_date happens
 * to already be stored, which the student may never have actually paid for
 * (an estimate from enrollment, a founder correction, or a one-time
 * backfill). Founder request 2026-10-09, after exactly that: a payment made
 * 1 Sep on a monthly plan landed the due date on 5 Nov instead of 5 Oct,
 * because an earlier "don't shorten a cycle they already paid for"
 * protection kept extending from a stored due date that was never actually
 * paid for. Every payment now unconditionally means "paid through one
 * cycle from today" — simpler, and the one thing this field is for. The
 * cycle length (`cycleMonths`) is read fresh from the student's current
 * plan at the time of each payment, so a plan change (e.g. monthly ->
 * 3-month) takes effect on the very next payment with no separate
 * migration.
 *
 * The due date itself always lands on `dueDay` of its target month (the
 * student's own fee_due_day, or the academy default of the 5th) rather than
 * drifting to whatever day the payment happened to be made on.
 */
export function advanceCycle(
  paidOn: string,
  cycleMonths: number | null | undefined,
  dueDay?: number | null,
): CycleAdvance {
  const months = cycleMonths && cycleMonths > 0 && cycleMonths <= 36 ? cycleMonths : 1;
  const day = dueDay && dueDay >= 1 && dueDay <= 31 ? dueDay : DEFAULT_FEE_DUE_DAY;
  const end = monthsFromPinnedToDueDay(paidOn, months, day);
  return { cycleStart: paidOn, cycleEnd: end, nextDueDate: end };
}

/**
 * Split a total into `count` instalment amounts that sum to EXACTLY the
 * total (never a paisa short or over) — the last instalment absorbs the
 * rounding remainder instead of it silently disappearing.
 */
export function splitInstalments(total: number, count: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor((total / count) * 100) / 100;
  const amounts: number[] = [];
  let running = 0;
  for (let i = 1; i <= count; i++) {
    const amount = i === count ? Math.round((total - running) * 100) / 100 : base;
    amounts.push(amount);
    running += amount;
  }
  return amounts;
}

// ---------------------------------------------------------------- plans

export interface FeePlan {
  name: string;
  /** Length of one paid cycle in months. */
  months: number;
  /** Fee for one cycle in rupees, when the plan fixes it. */
  amount: number | null;
}

/**
 * The academy's plans, owned by the SERVER (brief §0.4: the client never
 * decides money). The app's picker shows these same four.
 */
export const PLAN_CATALOG: FeePlan[] = [
  { name: "Plan 1", months: 1, amount: 2500 },
  { name: "Plan 2", months: 1, amount: 3600 },
  { name: "Plan 3", months: 3, amount: 6500 },
  { name: "Plan 4", months: 3, amount: 9500 },
];

/**
 * "Plan 3", "Plan 3 · 1 session/week…", "3 Months", "Monthly", "Yearly" ->
 * a plan. Unknown text returns null rather than a guessed cycle.
 */
export function resolvePlan(raw: unknown): FeePlan | null {
  const text = raw == null ? "" : String(raw).trim();
  if (!text) return null;
  const upper = text.toUpperCase();
  const planMatch = /^PLAN\s*([1-4])\b/.exec(upper);
  if (planMatch) return PLAN_CATALOG[Number(planMatch[1]) - 1];
  if (upper === "MONTHLY" || upper === "1 MONTH" || upper === "1M") return { name: "Monthly", months: 1, amount: null };
  if (upper === "YEARLY" || upper === "12 MONTHS" || upper === "12M") return { name: "Yearly", months: 12, amount: null };
  const months = /^(\d{1,2})\s*(M|MONTH|MONTHS)$/.exec(upper);
  if (months && Number(months[1]) >= 1 && Number(months[1]) <= 36) {
    return { name: `${Number(months[1])} Months`, months: Number(months[1]), amount: null };
  }
  return null;
}

/**
 * Money arriving from the app. The app sends integer PAISE (brief §5.7);
 * older screens send rupees as `amount`. Returns rupees, or 0 when absent,
 * non-numeric or not a whole number of paise.
 */
export function amountRupees(arg: Record<string, unknown>): number {
  const paise = arg["amountPaise"];
  if (paise !== undefined && paise !== null && String(paise).trim() !== "") {
    const p = Number(paise);
    return Number.isInteger(p) && p > 0 ? p / 100 : 0;
  }
  const rupees = Number(String(arg["amount"] ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(rupees) && rupees > 0 ? Math.round(rupees * 100) / 100 : 0;
}

/** GMC/KMC and branch names -> branch; blank when nothing usable was sent. */
export function branchFromClient(arg: Record<string, unknown>): string {
  const code = String(arg["classCode"] ?? "").trim().toUpperCase();
  if (code === "GMC") return "GOREGAON";
  if (code === "KMC") return "KANDIVALI";
  const b = String(arg["branch"] ?? arg["location"] ?? "").trim().toUpperCase();
  if (b.includes("GOR")) return "GOREGAON";
  if (b.includes("KAN")) return "KANDIVALI";
  return "";
}

/**
 * Owner rule: every fee payment carries a UTR (bank/UPI reference) or a
 * physical receipt-book number — never neither. Returns the refusal text, or
 * null when the rule is met.
 */
export function referenceRuleViolation(reference: string, receiptBookNo: string): string | null {
  if (reference.trim() || receiptBookNo.trim()) return null;
  return "Enter the UTR / transaction reference, or the receipt-book number for cash. A fee payment cannot have neither.";
}

// ---------------------------------------------------------------- late fees
// Founder request 2026-10-03: a genuinely overdue balance accrues a
// configurable daily late fee once a configurable grace period has passed.
// Both numbers live in `late_fee_settings` (effective-dated, founder-editable
// — see setLateFeeSettings), never hardcoded here. The fee is computed on
// read from the due date + today's date; nothing is stored as a running
// balance, so there is nothing to migrate and nothing that can drift out of
// sync with the settings history. A rate change only affects days accrued
// from its own effective_from onward — days already accrued under an earlier
// rate keep that earlier rate (non-retroactive).

export interface LateFeeSetting {
  graceDays: number;
  dailyRate: number;
  effectiveFrom: string;
}

export interface LateFeeAccrual {
  /** Total late fee accrued as of `today`, under whichever rate(s) applied on each day. */
  amount: number;
  /** Number of days the fee has been accruing (0 if still inside grace or not overdue). */
  daysLate: number;
  /** The grace period actually used (the one effective on the due date). */
  graceDays: number;
  /** The first date the fee would actually start accruing, or null if no due date/settings. */
  overdueSince: string | null;
}

/** Local day arithmetic — kept inside this module so fees.ts never imports
 *  from rules.ts (rules.ts already imports FROM fees.ts; importing back
 *  would create a cycle). */
function addDaysLocal(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** The setting effective on a given date: the latest effective_from that is
 *  not after it. Null when no setting has started yet by that date. */
function lateFeeSettingAsOf(settings: LateFeeSetting[], onDate: string): LateFeeSetting | null {
  const applicable = settings.filter((s) => s.effectiveFrom <= onDate);
  if (!applicable.length) return null;
  return applicable.slice().sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

/**
 * Day-by-day accrual: the grace period is the one effective on the due date
 * itself (it decides when accrual starts); each day's rate after that is
 * whichever setting was effective on that specific day — so a founder
 * changing the daily rate today never rewrites fee already accrued on
 * earlier days.
 */
export function accruedLateFee(
  dueDate: string | null | undefined,
  today: string,
  settings: LateFeeSetting[],
): LateFeeAccrual {
  if (!dueDate || !settings.length) return { amount: 0, daysLate: 0, graceDays: 0, overdueSince: null };
  const atDue = lateFeeSettingAsOf(settings, dueDate) ?? settings.slice().sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
  const graceDays = atDue.graceDays;
  const overdueSince = addDaysLocal(dueDate, graceDays + 1);
  const days = daysUntil(overdueSince, today);
  if (days == null || days > 0) return { amount: 0, daysLate: 0, graceDays, overdueSince };
  const daysLate = -days + 1; // inclusive of both overdueSince and today
  let amount = 0;
  for (let i = 0; i < daysLate; i++) {
    const day = addDaysLocal(overdueSince, i);
    const setting = lateFeeSettingAsOf(settings, day) ?? atDue;
    amount += setting.dailyRate;
  }
  return { amount: Math.round(amount * 100) / 100, daysLate, graceDays, overdueSince };
}
