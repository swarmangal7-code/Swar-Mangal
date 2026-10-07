import { test } from "node:test";
import assert from "node:assert/strict";

import { feeState, daysUntil, addMonths, advanceCycle, todayIso, DEFAULT_ADVANCE_DAYS, splitInstalments } from "../src/lib/rpc/fees.ts";

const TODAY = "2026-09-16";

test("fee state follows the stored due date", () => {
  assert.equal(feeState("2026-09-10", TODAY), "OVERDUE");
  assert.equal(feeState("2026-09-15", TODAY), "OVERDUE");
  assert.equal(feeState("2026-09-16", TODAY), "DUE_TODAY");
  assert.equal(feeState("2026-09-17", TODAY), "DUE_SOON");
  assert.equal(feeState("2026-09-19", TODAY), "DUE_SOON"); // 3 days = advance window
  assert.equal(feeState("2026-09-20", TODAY), "PAID");
  assert.equal(feeState("2026-12-01", TODAY), "PAID");
});

test("a student with no recorded due date is UNKNOWN, never overdue", () => {
  // The old code called every active student OVERDUE.
  assert.equal(feeState(null, TODAY), "UNKNOWN");
  assert.equal(feeState("", TODAY), "UNKNOWN");
  assert.equal(feeState("not-a-date", TODAY), "UNKNOWN");
});

test("students who left are not chased", () => {
  assert.equal(feeState("2026-01-01", TODAY, { status: "LEFT" }), "INACTIVE");
  assert.equal(feeState(null, TODAY, { status: "LEFT" }), "INACTIVE");
  assert.equal(feeState("2026-01-01", TODAY, { status: "ACTIVE" }), "OVERDUE");
});

test("the advance window is configurable", () => {
  assert.equal(DEFAULT_ADVANCE_DAYS, 3);
  assert.equal(feeState("2026-09-23", TODAY, { advanceDays: 7 }), "DUE_SOON");
  assert.equal(feeState("2026-09-23", TODAY, { advanceDays: 3 }), "PAID");
});

test("daysUntil counts whole days in both directions", () => {
  assert.equal(daysUntil("2026-09-16", TODAY), 0);
  assert.equal(daysUntil("2026-09-26", TODAY), 10);
  assert.equal(daysUntil("2026-09-06", TODAY), -10);
  assert.equal(daysUntil("bad", TODAY), null);
});

test("addMonths clamps to the end of a shorter month", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-01-15", 3), "2026-04-15");
  assert.equal(addMonths("2026-12-15", 1), "2027-01-15");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
});

test("paying on time extends from the due date, so cycles do not drift — and always lands on the 5th by default", () => {
  const c = advanceCycle("2026-09-20", "2026-09-16", 1);
  assert.equal(c.cycleStart, "2026-09-20");
  assert.equal(c.nextDueDate, "2026-10-05");
});

test("paying late restarts from the payment date, not the missed due date", () => {
  const c = advanceCycle("2026-07-01", "2026-09-16", 1);
  assert.equal(c.cycleStart, "2026-09-16");
  assert.equal(c.nextDueDate, "2026-10-05");
  // and the student is no longer overdue afterwards
  assert.equal(feeState(c.nextDueDate, "2026-09-16"), "PAID");
});

test("a 3-month plan advances by three months, still landing on the 5th", () => {
  assert.equal(advanceCycle("2026-09-16", "2026-09-16", 3).nextDueDate, "2026-12-05");
});

test("a missing or silly cycle length falls back to one month", () => {
  assert.equal(advanceCycle("2026-09-16", "2026-09-16", null).nextDueDate, "2026-10-05");
  assert.equal(advanceCycle("2026-09-16", "2026-09-16", 0).nextDueDate, "2026-10-05");
  assert.equal(advanceCycle("2026-09-16", "2026-09-16", 999).nextDueDate, "2026-10-05");
});

test("a first payment with no prior due date starts the cycle today", () => {
  const c = advanceCycle(null, "2026-09-16", 1);
  assert.equal(c.cycleStart, "2026-09-16");
  assert.equal(c.nextDueDate, "2026-10-05");
});

test("a student's own fee_due_day overrides the academy default of the 5th", () => {
  assert.equal(advanceCycle("2026-09-16", "2026-09-16", 1, 18).nextDueDate, "2026-10-18");
  assert.equal(advanceCycle("2026-09-16", "2026-09-16", 3, 1).nextDueDate, "2026-12-01");
  // an out-of-range value falls back to the default rather than erroring
  assert.equal(advanceCycle("2026-09-16", "2026-09-16", 1, 0).nextDueDate, "2026-10-05");
  assert.equal(advanceCycle("2026-09-16", "2026-09-16", 1, 32).nextDueDate, "2026-10-05");
});

test("a flexible plan change (monthly then 3-month) takes effect on the very next payment", () => {
  // Student was on a monthly plan, due 2026-09-05; they then switch to a
  // 3-month plan before their next payment. advanceCycle reads whatever
  // cycleMonths is passed in "now" -- the caller already re-reads it fresh
  // from students_acad before each call, so no separate migration is needed.
  const monthly = advanceCycle(null, "2026-08-05", 1);
  assert.equal(monthly.nextDueDate, "2026-09-05");
  const switchedToQuarterly = advanceCycle(monthly.nextDueDate, "2026-09-05", 3);
  assert.equal(switchedToQuarterly.nextDueDate, "2026-12-05");
});

test("today is measured in IST, not UTC", () => {
  // 2026-09-16 20:00 UTC is already the 17th in Mumbai.
  assert.equal(todayIso(new Date("2026-09-16T20:00:00Z")), "2026-09-17");
  assert.equal(todayIso(new Date("2026-09-16T10:00:00Z")), "2026-09-16");
});

test("duplicate and test records are not chased either", () => {
  assert.equal(feeState("2026-01-01", TODAY, { status: "DUPLICATE" }), "INACTIVE");
  assert.equal(feeState("2026-01-01", TODAY, { status: "TEST" }), "INACTIVE");
});

test("an instalment split always sums to exactly the total, never a paisa short or over", () => {
  const amounts = splitInstalments(1000, 3);
  assert.equal(amounts.length, 3);
  assert.equal(amounts.reduce((a, b) => a + b, 0), 1000);
  // 1000/3 = 333.33...; the last instalment absorbs the remainder.
  assert.deepEqual(amounts, [333.33, 333.33, 333.34]);
});

test("an even split gives equal instalments", () => {
  assert.deepEqual(splitInstalments(900, 3), [300, 300, 300]);
});

import { resolvePlan, amountRupees, branchFromClient, referenceRuleViolation, PLAN_CATALOG } from "../src/lib/rpc/fees.ts";

test("plans resolve from the app's labels, never guessed", () => {
  assert.deepEqual(resolvePlan("Plan 3"), PLAN_CATALOG[2]);
  assert.deepEqual(resolvePlan("Plan 4 · 2 sessions/week · 8/month for 3 months · ₹9,500 / 3 mo"), PLAN_CATALOG[3]);
  assert.equal(resolvePlan("3 Months")?.months, 3);
  assert.equal(resolvePlan("Monthly")?.months, 1);
  assert.equal(resolvePlan("Yearly")?.months, 12);
  assert.equal(resolvePlan("flute sessions"), null);
  assert.equal(resolvePlan(""), null);
});

test("amounts: integer paise from the app, rupees from older screens", () => {
  // the staff fee screen sends amountPaise; reading `amount` saved ₹0 drafts
  assert.equal(amountRupees({ amountPaise: 360000 }), 3600);
  assert.equal(amountRupees({ amountPaise: "950000" }), 9500);
  assert.equal(amountRupees({ amountPaise: 12.5 }), 0, "paise must be whole");
  assert.equal(amountRupees({ amountPaise: -100 }), 0);
  assert.equal(amountRupees({ amount: "2,500" }), 2500);
  assert.equal(amountRupees({}), 0);
});

test("branch comes from class code or branch name", () => {
  assert.equal(branchFromClient({ classCode: "GMC" }), "GOREGAON");
  assert.equal(branchFromClient({ classCode: "kmc" }), "KANDIVALI");
  assert.equal(branchFromClient({ branch: "Goregaon West" }), "GOREGAON");
  assert.equal(branchFromClient({}), "");
});

test("a fee payment needs a UTR or a receipt-book number", () => {
  assert.equal(referenceRuleViolation("UTR123", ""), null);
  assert.equal(referenceRuleViolation("", "BK-0042"), null);
  assert.match(referenceRuleViolation("", " ") ?? "", /never neither|cannot have neither/i);
});

import { accruedLateFee, type LateFeeSetting } from "../src/lib/rpc/fees.ts";

const LFS: LateFeeSetting[] = [{ graceDays: 7, dailyRate: 50, effectiveFrom: "2020-01-01" }];

test("late fee: nothing accrues inside the grace period", () => {
  // Due 2026-09-01, 7-day grace -> accrual starts 2026-09-09.
  assert.deepEqual(accruedLateFee("2026-09-01", "2026-09-05", LFS), { amount: 0, daysLate: 0, graceDays: 7, overdueSince: "2026-09-09" });
  assert.equal(accruedLateFee("2026-09-01", "2026-09-08", LFS).amount, 0);
});

test("late fee: accrual starts the day after grace ends and counts inclusively", () => {
  const first = accruedLateFee("2026-09-01", "2026-09-09", LFS);
  assert.equal(first.daysLate, 1);
  assert.equal(first.amount, 50);
  const fifth = accruedLateFee("2026-09-01", "2026-09-13", LFS);
  assert.equal(fifth.daysLate, 5);
  assert.equal(fifth.amount, 250);
});

test("late fee: no due date or no settings means nothing accrues", () => {
  assert.deepEqual(accruedLateFee(null, "2026-09-13", LFS), { amount: 0, daysLate: 0, graceDays: 0, overdueSince: null });
  assert.deepEqual(accruedLateFee("2026-09-01", "2026-09-13", []), { amount: 0, daysLate: 0, graceDays: 0, overdueSince: null });
});

test("late fee: a later rate change never rewrites days already accrued under the earlier rate", () => {
  const changing: LateFeeSetting[] = [
    { graceDays: 7, dailyRate: 50, effectiveFrom: "2020-01-01" },
    { graceDays: 7, dailyRate: 100, effectiveFrom: "2026-09-11" },
  ];
  // Accrual starts 2026-09-09 at ₹50/day for the 9th and 10th, then ₹100/day
  // from the 11th onward once the new rate takes effect.
  const r = accruedLateFee("2026-09-01", "2026-09-13", changing);
  assert.equal(r.daysLate, 5);
  assert.equal(r.amount, 50 + 50 + 100 + 100 + 100); // 9,10 @50 + 11,12,13 @100
});

test("late fee: the grace period used is the one effective on the due date, not on today", () => {
  const graceChange: LateFeeSetting[] = [
    { graceDays: 7, dailyRate: 50, effectiveFrom: "2020-01-01" },
    { graceDays: 3, dailyRate: 50, effectiveFrom: "2026-09-10" },
  ];
  // Due 2026-09-01 is before the grace change, so the 7-day grace still applies.
  assert.equal(accruedLateFee("2026-09-01", "2026-09-09", graceChange).overdueSince, "2026-09-09");
});
