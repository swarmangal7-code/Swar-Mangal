// Business rules from the build brief that more than one handler needs.
// Pure module (no runtime imports) so backend-tests can load it directly.
// Every function here refuses by NAMING the reason; none of them guesses.

import { addMonths, daysUntil } from "./fees.ts";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ------------------------------------------------------------ receipts
/**
 * Brief §10.6: any status containing VOID, REVERS or DRAFT is excluded from
 * every income and payout total. Search may still show such rows.
 */
export function isExcludedReceiptStatus(status: unknown): boolean {
  const s = String(status ?? "").toUpperCase();
  return s.includes("VOID") || s.includes("REVERS") || s.includes("DRAFT");
}

/** SQL twin of isExcludedReceiptStatus for a status column. */
export function excludedReceiptSql(column: string): string {
  return `(upper(coalesce(${column},'')) like '%VOID%' or upper(coalesce(${column},'')) like '%REVERS%' or upper(coalesce(${column},'')) like '%DRAFT%')`;
}

// ------------------------------------------------------------ service months
/** "2026-09-17" -> "2026-09". Service month = the month the thing happened. */
export function serviceMonthOf(isoDate: string): string {
  return /^\d{4}-\d{2}/.test(isoDate) ? isoDate.slice(0, 7) : "";
}

/** "2026-09" -> "September 2026". */
export function monthLabel(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(month);
  if (!m) return month;
  const idx = Number(m[2]) - 1;
  return idx >= 0 && idx < 12 ? `${MONTHS[idx]} ${m[1]}` : month;
}

/** Brief §11.7: the refusal names the closed month. */
export function periodLockedRefusal(month: string) {
  return {
    ok: false as const,
    code: "PERIOD_LOCKED",
    error: `${monthLabel(month)} is closed. Nothing dated in a closed month can be added or changed. Tell Sharvil what needs correcting and why.`,
    month,
  };
}

/** Expected-class generation starts here (brief §6.9); earlier months have no expected events. */
export const EXPECTED_EVENTS_FLOOR = "2026-10";

// ------------------------------------------------------------ inquiries
export interface NoAnswerStep {
  status: "CONTACTED" | "DORMANT";
  nextContactDate: string | null;
  noAnswerCount: number;
}

/**
 * Brief P1 no-answer ladder: first miss -> try again in 3 days, second -> in 7
 * days, third -> DORMANT (terminal until reopened).
 */
export function noAnswerStep(previousMisses: number, today: string): NoAnswerStep {
  const count = Math.max(0, Math.floor(previousMisses)) + 1;
  if (count >= 3) return { status: "DORMANT", nextContactDate: null, noAnswerCount: count };
  return { status: "CONTACTED", nextContactDate: addDays(today, count === 1 ? 3 : 7), noAnswerCount: count };
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

export const TERMINAL_INQUIRY_STATUSES = new Set(["CONVERTED", "DROPPED", "DORMANT"]);

/**
 * The parent's actual decision, derived from the workflow status rather than
 * stored separately — a second field here could drift from `status`.
 * APPROVED = wants to join, REJECTED = doesn't, PENDING = not decided yet.
 */
export function inquiryFinalStatus(status: string): "APPROVED" | "REJECTED" | "PENDING" {
  if (status === "CONVERTED") return "APPROVED";
  if (status === "DROPPED") return "REJECTED";
  return "PENDING";
}

/** "Call these today" skips anyone contacted within this many days. */
export const DORMANT_RECALL_DAYS = 90;
export const DORMANT_RECALL_LIMIT = 10;

/** A PAUSED student surfaces on the "Paused a while" reminder after this long — informational only, never an automatic status change. */
export const PAUSED_REVIEW_AFTER_DAYS = 30;

/**
 * A lead followed up for this long without converting goes DORMANT even if
 * it was never missed 3 times — this path is tagged dormant_reason=TIMEOUT
 * and, unlike a NO_ANSWER dormant, is never recalled into "call these
 * today" again.
 */
export const INQUIRY_DORMANT_AFTER_DAYS = 30;

/**
 * True once an inquiry created this long ago should time out, if still
 * open. daysUntil(dueDate, today) = dueDate - today, so daysUntil(today,
 * createdAt) = today - createdAt — the age of the inquiry in days.
 */
export function inquiryDormancyDue(createdAt: string, today: string): boolean {
  return (daysUntil(today, createdAt) ?? -1) >= INQUIRY_DORMANT_AFTER_DAYS;
}

// ------------------------------------------------------------ custom sessions
/** Brief §10.2: three kinds that are NOT synonyms. */
export const CUSTOM_KINDS = ["SUBSTITUTE", "REPLACEMENT", "GOODWILL_RECOVERY"] as const;
export type CustomKind = (typeof CUSTOM_KINDS)[number];

/** Outcomes after which a class is owed a replacement. TEACHER_ABSENT behaves
 *  like TEACHER_CANCELLED for the student's side: the academy failed to
 *  deliver, so the student is still owed the class. SCHOOL_HOLIDAY and
 *  STUDENT_ABSENT are not the academy's failure, so neither owes one. */
const OWED_OUTCOMES = new Set(["TEACHER_CANCELLED", "ACADEMY_CANCELLED", "RESCHEDULED", "TEACHER_ABSENT"]);

export function customSessionRefusal(input: {
  kind: string;
  reason: string;
  originalEventId: string;
  originalOutcome: string | null;
  originalHasReplacement: boolean;
}): { code: string; error: string } | null {
  const kind = input.kind.toUpperCase();
  if (!(CUSTOM_KINDS as readonly string[]).includes(kind)) {
    return { code: "CUSTOM_KIND_REQUIRED", error: "Choose what this extra class is: a substitute, a replacement, or goodwill recovery." };
  }
  if (!input.reason.trim()) return { code: "REASON_REQUIRED", error: "Say why this extra class is being held." };
  if (kind === "GOODWILL_RECOVERY") return null; // discharges nothing, links to nothing
  if (!input.originalEventId) {
    return { code: "ORIGINAL_EVENT_REQUIRED", error: `A ${kind.toLowerCase()} must name the class it stands in for.` };
  }
  if (input.originalOutcome === null) {
    return { code: "ORIGINAL_EVENT_NOT_FOUND", error: `No answered class ${input.originalEventId}. Answer that class first.` };
  }
  if (kind === "REPLACEMENT") {
    if (!OWED_OUTCOMES.has(input.originalOutcome)) {
      return {
        code: "NOTHING_OWED",
        error: `That class was answered ${input.originalOutcome || "not yet"}; only a cancelled or rescheduled class is owed a replacement.`,
      };
    }
    if (input.originalHasReplacement) {
      return { code: "ALREADY_REPLACED", error: "That class already has a replacement scheduled." };
    }
  }
  return null;
}

// ------------------------------------------------------------ expenses
/** Brief P8 gate: a teacher payout can never be smuggled through as an expense. */
export function expenseCategoryRefusal(category: string, description = ""): { code: string; error: string } | null {
  const text = `${category} ${description}`.toLowerCase();
  if (/\bteacher\b|\bpayout\b|\bpay-?out\b/.test(text)) {
    return {
      code: "PAYOUT_NOT_AN_EXPENSE",
      error: "Teacher pay is not an expense. Sharvil records it under Teacher Payouts for its service month.",
    };
  }
  return null;
}

// ------------------------------------------------------------ fee payments
/**
 * Brief P3.2: completeness is derived, never stored. A payment is refused
 * until the student has a monthly fee, a package length and a real due date;
 * the refusal names what is missing.
 */
export function studentIncompleteFields(st: { monthly_fee?: unknown; fee_cycle_months?: unknown; next_due_date?: unknown }): string[] {
  const missing: string[] = [];
  if (!(Number(st.monthly_fee) > 0)) missing.push("monthly fee");
  if (!(Number(st.fee_cycle_months) >= 1)) missing.push("package months");
  if (!/^\d{4}-\d{2}-\d{2}/.test(String(st.next_due_date ?? ""))) missing.push("next due date");
  return missing;
}

/** Backdated = paid more than two days before it was entered. */
export function isBackdated(paymentDate: string, enteredOn: string): boolean {
  return !!paymentDate && (daysUntil(paymentDate, enteredOn) ?? 0) < -2;
}

// ------------------------------------------------------------ teacher payouts
/** Brief §8: nobody at SwarMangal takes more than 50%. */
export const PAYOUT_PERCENT_CEILING = 50;

/**
 * What a percentage is a percentage OF has not been ruled (brief §15.1).
 * Until PAYOUT_EARNING_BASE names one, no academy payout amount exists.
 */
export const EARNING_BASES = ["COLLECTED_RECEIPTS"] as const;
export type EarningBase = (typeof EARNING_BASES)[number];

export function earningBaseFromEnv(raw: string | undefined): EarningBase | null {
  const v = String(raw ?? "").trim().toUpperCase();
  return (EARNING_BASES as readonly string[]).includes(v) ? (v as EarningBase) : null;
}

export interface PayoutLinePricing {
  /** null = not priced. Rendered as a dash, never as 0. */
  payable: number | null;
  /** Blocking: why no amount exists. */
  reasons: { code: string; message: string }[];
  /** Advisory caveats that sit next to a REAL amount (finding (a)). */
  qualifications: { code: string; message: string }[];
}

export function priceTeacherLine(input: {
  rule: { payout_type: string; percentage: number } | null;
  base: EarningBase | null;
  baseAmount: number;
  hasAttendanceHistoryOnly: boolean;
}): PayoutLinePricing {
  const reasons: PayoutLinePricing["reasons"] = [];
  const qualifications: PayoutLinePricing["qualifications"] = [];
  const rule = input.rule;
  if (!rule) {
    return { payable: null, reasons: [{ code: "RATE_RULE_MISSING", message: "No payout rule is set for this teacher." }], qualifications };
  }
  const type = String(rule.payout_type || "").toUpperCase();
  const pct = Number(rule.percentage);
  if (type === "OWNER_DIRECT") {
    return {
      payable: 0,
      reasons,
      qualifications: [{ code: "OWNER_DIRECT", message: "Owner-direct arrangement: the academy pays nothing for this teacher." }],
    };
  }
  if (!Number.isFinite(pct) || pct < 0) {
    return { payable: null, reasons: [{ code: "RATE_RULE_INVALID", message: "The payout rule has no usable percentage." }], qualifications };
  }
  if (pct > PAYOUT_PERCENT_CEILING) {
    return {
      payable: null,
      reasons: [{ code: "RATE_ABOVE_CEILING", message: `The rule says ${pct}%, above the ${PAYOUT_PERCENT_CEILING}% ceiling. The data is wrong; fix the rule.` }],
      qualifications,
    };
  }
  if (!input.base) {
    return {
      payable: null,
      reasons: [{ code: "EARNING_BASE_NOT_DEFINED", message: `The rule sets ${pct}%, but what it is a percentage of has not been decided.` }],
      qualifications,
    };
  }
  if (input.hasAttendanceHistoryOnly) {
    qualifications.push({ code: "TEACHER_FROM_HISTORY", message: "Students linked from earlier attendance, not from this month's classes." });
  }
  const payable = Math.round(input.baseAmount * pct) / 100;
  return { payable, reasons, qualifications };
}

/** Brief P7.4: only VERIFIED evidence settles. Returns the class dates that block. */
export function unsettleableClasses(
  classes: { date: string; resolved: boolean; evidenceClass: string }[],
): { date: string; why: string }[] {
  return classes
    .filter((c) => !c.resolved || c.evidenceClass !== "VERIFIED")
    .map((c) => ({
      date: c.date,
      why: !c.resolved ? "not answered" : c.evidenceClass ? c.evidenceClass.toLowerCase() : "no evidence class",
    }));
}

/** First day of the month after a service month, for range queries. */
export function monthEndExclusive(month: string): string {
  return addMonths(`${month}-01`, 1);
}

// ------------------------------------------------- effective-dated settings
// Founder request 2026-10-03: payout_status_rules, teacher_percent_slabs and
// late_fee_settings are all append-only, effective-dated tables (new rows,
// never edited/deleted rows) so a future rate/slab/fee change can never
// silently reshape a past month's numbers. These two lookups are the shared
// "which row applies on this date" logic both settings use.

export interface EffectiveDatedRow {
  effectiveFrom: string;
  effectiveTo?: string | null;
}

/** The row effective on `onDate`: the latest effective_from <= onDate whose
 *  effective_to (if any) is still in the future of onDate. Null when none. */
export function effectiveRowOn<T extends EffectiveDatedRow>(rows: T[], onDate: string): T | null {
  const applicable = rows.filter((r) => r.effectiveFrom <= onDate && (!r.effectiveTo || r.effectiveTo > onDate));
  if (!applicable.length) return null;
  return applicable.slice().sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0];
}

export interface PayoutStatusRule extends EffectiveDatedRow {
  outcome: string;
  payoutPercent: number;
}

/** What % of the normal rate a teacher is paid for a given class outcome, as
 *  of `onDate` (brief: SCHOOL_HOLIDAY/ACADEMY_CANCELLED retainer %, etc —
 *  see payout_status_rules seed defaults in db/schema.sql). Null when the
 *  founder has not configured a rule for that outcome yet. */
export function payoutPercentForOutcome(rules: PayoutStatusRule[], outcome: string, onDate: string): number | null {
  const row = effectiveRowOn(
    rules.filter((r) => r.outcome === outcome),
    onDate,
  );
  return row ? row.payoutPercent : null;
}

export interface TeacherPercentSlab extends EffectiveDatedRow {
  monthsSinceStart: number;
  percent: number;
}

/**
 * The slab-ramp percent for a teacher `monthsSinceStart` months into their
 * tenure, using the slab schedule as it stood on `onDate` — a founder
 * changing the ramp later never rewrites an already-computed month. Only
 * used for a teacher the founder has explicitly opted into the slab model
 * (teachers_acad.uses_percent_slab); legacy teachers never reach this.
 */
export function slabPercentFor(slabs: TeacherPercentSlab[], monthsSinceStart: number, onDate: string): number | null {
  const byStep = new Map<number, TeacherPercentSlab>();
  for (const row of slabs) {
    if (row.effectiveFrom > onDate) continue;
    const cur = byStep.get(row.monthsSinceStart);
    if (!cur || row.effectiveFrom > cur.effectiveFrom) byStep.set(row.monthsSinceStart, row);
  }
  const steps = [...byStep.values()].filter((r) => r.monthsSinceStart <= monthsSinceStart).sort((a, b) => b.monthsSinceStart - a.monthsSinceStart);
  return steps.length ? steps[0].percent : null;
}
