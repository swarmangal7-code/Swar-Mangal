import { test } from "node:test";
import assert from "node:assert/strict";

import {
  isExcludedReceiptStatus,
  monthLabel,
  periodLockedRefusal,
  noAnswerStep,
  customSessionRefusal,
  expenseCategoryRefusal,
  studentIncompleteFields,
  priceTeacherLine,
  earningBaseFromEnv,
  unsettleableClasses,
  monthEndExclusive,
  addDays,
  inquiryFinalStatus,
  inquiryDormancyDue,
  INQUIRY_DORMANT_AFTER_DAYS,
  effectiveRowOn,
  payoutPercentForOutcome,
  slabPercentFor,
  type PayoutStatusRule,
  type TeacherPercentSlab,
} from "../src/lib/rpc/rules.ts";

test("receipt exclusion covers VOID, REVERS and DRAFT anywhere in the status", () => {
  for (const s of ["VOID", "VOID_TEST", "void", "REVERSED", "REVERSAL", "DRAFT", "PRE_DRAFT"]) {
    assert.equal(isExcludedReceiptStatus(s), true, s);
  }
  for (const s of ["ACTIVE", "FINALISED", "", null]) assert.equal(isExcludedReceiptStatus(s), false, String(s));
});

test("a period lock refusal names the month", () => {
  assert.equal(monthLabel("2026-09"), "September 2026");
  const r = periodLockedRefusal("2026-10");
  assert.equal(r.code, "PERIOD_LOCKED");
  assert.match(r.error, /October 2026 is closed/);
});

test("no-answer ladder: +3 days, then +7 days, then DORMANT", () => {
  assert.deepEqual(noAnswerStep(0, "2026-09-17"), { status: "CONTACTED", nextContactDate: "2026-09-20", noAnswerCount: 1 });
  assert.deepEqual(noAnswerStep(1, "2026-09-28"), { status: "CONTACTED", nextContactDate: "2026-10-05", noAnswerCount: 2 });
  assert.deepEqual(noAnswerStep(2, "2026-10-05"), { status: "DORMANT", nextContactDate: null, noAnswerCount: 3 });
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
});

test("an inquiry times out to dormant after 30 days, never a day sooner or a day of drift", () => {
  assert.equal(INQUIRY_DORMANT_AFTER_DAYS, 30);
  assert.equal(inquiryDormancyDue("2026-09-01", "2026-09-30"), false); // 29 days old
  assert.equal(inquiryDormancyDue("2026-09-01", "2026-10-01"), true); // exactly 30 days old
  assert.equal(inquiryDormancyDue("2026-09-01", "2026-09-01"), false); // brand new
});

test("an inquiry's final status is derived from its workflow status, never a second stored field", () => {
  assert.equal(inquiryFinalStatus("CONVERTED"), "APPROVED");
  assert.equal(inquiryFinalStatus("DROPPED"), "REJECTED");
  for (const status of ["OPEN", "CONTACTED", "DORMANT", "TRIAL_SCHEDULED", "TRIAL_DONE", ""]) {
    assert.equal(inquiryFinalStatus(status), "PENDING", status);
  }
});

test("custom session kinds are not synonyms", () => {
  const base = { reason: "extra", originalEventId: "", originalOutcome: null, originalHasReplacement: false };
  assert.equal(customSessionRefusal({ ...base, kind: "EXTRA" })?.code, "CUSTOM_KIND_REQUIRED");
  assert.equal(customSessionRefusal({ ...base, kind: "GOODWILL_RECOVERY", reason: "" })?.code, "REASON_REQUIRED");
  assert.equal(customSessionRefusal({ ...base, kind: "GOODWILL_RECOVERY" }), null, "goodwill links to nothing");
  assert.equal(customSessionRefusal({ ...base, kind: "REPLACEMENT" })?.code, "ORIGINAL_EVENT_REQUIRED");
  assert.equal(customSessionRefusal({ ...base, kind: "REPLACEMENT", originalEventId: "E-1" })?.code, "ORIGINAL_EVENT_NOT_FOUND");
  assert.equal(
    customSessionRefusal({ ...base, kind: "REPLACEMENT", originalEventId: "E-1", originalOutcome: "HELD" })?.code,
    "NOTHING_OWED",
    "a delivered class is owed nothing",
  );
  assert.equal(
    customSessionRefusal({ ...base, kind: "REPLACEMENT", originalEventId: "E-1", originalOutcome: "TEACHER_CANCELLED", originalHasReplacement: true })?.code,
    "ALREADY_REPLACED",
  );
  assert.equal(customSessionRefusal({ ...base, kind: "REPLACEMENT", originalEventId: "E-1", originalOutcome: "RESCHEDULED" }), null);
});

test("teacher pay cannot be booked as an expense", () => {
  assert.equal(expenseCategoryRefusal("Teacher payout")?.code, "PAYOUT_NOT_AN_EXPENSE");
  assert.equal(expenseCategoryRefusal("Other", "payout for Ravi sir")?.code, "PAYOUT_NOT_AN_EXPENSE");
  assert.equal(expenseCategoryRefusal("Salary", "office assistant"), null, "staff salary is a real expense");
  assert.equal(expenseCategoryRefusal("Rent"), null);
});

test("student completeness is derived and names what is missing", () => {
  assert.deepEqual(studentIncompleteFields({ monthly_fee: 2500, fee_cycle_months: 1, next_due_date: "2026-10-01" }), []);
  assert.deepEqual(studentIncompleteFields({}), ["monthly fee", "package months", "next due date"]);
  assert.deepEqual(studentIncompleteFields({ monthly_fee: "0", fee_cycle_months: 3, next_due_date: null }), ["monthly fee", "next due date"]);
});

test("payout pricing refuses by name and never shows a guessed zero", () => {
  const rule = { payout_type: "ACADEMY_FIXED", percentage: 40 };
  const noBase = priceTeacherLine({ rule, base: null, baseAmount: 10000, hasAttendanceHistoryOnly: false });
  assert.equal(noBase.payable, null);
  assert.equal(noBase.reasons[0].code, "EARNING_BASE_NOT_DEFINED");

  assert.equal(priceTeacherLine({ rule: null, base: "COLLECTED_RECEIPTS", baseAmount: 1, hasAttendanceHistoryOnly: false }).reasons[0].code, "RATE_RULE_MISSING");
  assert.equal(
    priceTeacherLine({ rule: { payout_type: "ACADEMY_FIXED", percentage: 60 }, base: "COLLECTED_RECEIPTS", baseAmount: 1, hasAttendanceHistoryOnly: false }).reasons[0].code,
    "RATE_ABOVE_CEILING",
  );

  const owner = priceTeacherLine({ rule: { payout_type: "OWNER_DIRECT", percentage: 0 }, base: null, baseAmount: 5000, hasAttendanceHistoryOnly: false });
  assert.equal(owner.payable, 0, "owner-direct is a real zero, not a refusal");
  assert.equal(owner.reasons.length, 0);

  // Finding (a): a caveat sits beside a real amount without becoming a refusal.
  const priced = priceTeacherLine({ rule, base: "COLLECTED_RECEIPTS", baseAmount: 10000, hasAttendanceHistoryOnly: true });
  assert.equal(priced.payable, 4000);
  assert.equal(priced.reasons.length, 0);
  assert.equal(priced.qualifications[0].code, "TEACHER_FROM_HISTORY");

  assert.equal(earningBaseFromEnv(undefined), null);
  assert.equal(earningBaseFromEnv("guess"), null);
  assert.equal(earningBaseFromEnv("collected_receipts"), "COLLECTED_RECEIPTS");
});

test("effectiveRowOn picks the latest row that has started and not yet ended", () => {
  const rows = [
    { effectiveFrom: "2020-01-01", label: "a" },
    { effectiveFrom: "2026-01-01", label: "b" },
    { effectiveFrom: "2026-06-01", label: "c" },
  ];
  assert.equal(effectiveRowOn(rows, "2025-12-31")?.label, "a");
  assert.equal(effectiveRowOn(rows, "2026-01-01")?.label, "b");
  assert.equal(effectiveRowOn(rows, "2026-05-31")?.label, "b");
  assert.equal(effectiveRowOn(rows, "2026-06-01")?.label, "c");
  assert.equal(effectiveRowOn([], "2026-06-01"), null);
});

test("effectiveRowOn respects effective_to", () => {
  const rows = [{ effectiveFrom: "2020-01-01", effectiveTo: "2026-01-01", label: "old" }];
  assert.equal(effectiveRowOn(rows, "2025-12-31")?.label, "old");
  assert.equal(effectiveRowOn(rows, "2026-01-01"), null, "effective_to is exclusive");
});

test("payoutPercentForOutcome: a status rule change never rewrites a past month's %", () => {
  const rules: PayoutStatusRule[] = [
    { outcome: "SCHOOL_HOLIDAY", payoutPercent: 50, effectiveFrom: "2020-01-01" },
    { outcome: "SCHOOL_HOLIDAY", payoutPercent: 75, effectiveFrom: "2026-11-01" },
    { outcome: "ACADEMY_CANCELLED", payoutPercent: 50, effectiveFrom: "2020-01-01" },
  ];
  assert.equal(payoutPercentForOutcome(rules, "SCHOOL_HOLIDAY", "2026-10-01"), 50);
  assert.equal(payoutPercentForOutcome(rules, "SCHOOL_HOLIDAY", "2026-11-01"), 75);
  assert.equal(payoutPercentForOutcome(rules, "TEACHER_ABSENT", "2026-10-01"), null, "no rule configured yet");
});

test("slabPercentFor: a new-teacher ramp picks the highest step reached, as of the ramp schedule's own effective date", () => {
  const slabs: TeacherPercentSlab[] = [
    { monthsSinceStart: 0, percent: 30, effectiveFrom: "2020-01-01" },
    { monthsSinceStart: 6, percent: 40, effectiveFrom: "2020-01-01" },
    { monthsSinceStart: 12, percent: 50, effectiveFrom: "2020-01-01" },
  ];
  assert.equal(slabPercentFor(slabs, 0, "2026-10-01"), 30);
  assert.equal(slabPercentFor(slabs, 5, "2026-10-01"), 30);
  assert.equal(slabPercentFor(slabs, 6, "2026-10-01"), 40);
  assert.equal(slabPercentFor(slabs, 11, "2026-10-01"), 40);
  assert.equal(slabPercentFor(slabs, 12, "2026-10-01"), 50);
  assert.equal(slabPercentFor(slabs, 99, "2026-10-01"), 50);
});

test("slabPercentFor: a ramp change the founder makes later does not rewrite an already-computed earlier month", () => {
  const slabs: TeacherPercentSlab[] = [
    { monthsSinceStart: 0, percent: 30, effectiveFrom: "2020-01-01" },
    // Founder raises the month-0 step to 35%, but only from 2026-11-01 on.
    { monthsSinceStart: 0, percent: 35, effectiveFrom: "2026-11-01" },
  ];
  assert.equal(slabPercentFor(slabs, 0, "2026-10-01"), 30);
  assert.equal(slabPercentFor(slabs, 0, "2026-11-01"), 35);
});

test("slabPercentFor: no slab configured yet for that step returns null, never a guess", () => {
  assert.equal(slabPercentFor([], 0, "2026-10-01"), null);
});

test("only VERIFIED classes settle", () => {
  const blocks = unsettleableClasses([
    { date: "2026-10-01", resolved: true, evidenceClass: "VERIFIED" },
    { date: "2026-10-02", resolved: true, evidenceClass: "RECONSTRUCTED" },
    { date: "2026-10-03", resolved: true, evidenceClass: "" },
    { date: "2026-10-04", resolved: false, evidenceClass: "" },
  ]);
  assert.deepEqual(blocks.map((b) => `${b.date}:${b.why}`), [
    "2026-10-02:reconstructed",
    "2026-10-03:no evidence class",
    "2026-10-04:not answered",
  ]);
  assert.equal(monthEndExclusive("2026-12"), "2027-01-01");
});
