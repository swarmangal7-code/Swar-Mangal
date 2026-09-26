// Founder governance from the build brief:
//  * closed service months (§11.7, P6.7) and the close gate,
//  * receipt corrections and voids (pattern C: never edit, void and reissue),
//  * school invoice drafts (P11: only the founder allocates an SMI- number).
import { query, queryOne, withTransaction, type Tx } from "@/lib/db";
import type { RpcSession } from "@/lib/rpc/auth";
import { s, n, d, newId, nextDocNo, bumpRevisions } from "@/lib/rpc/shared";
import { randomBytes } from "crypto";
import { schoolInvoiceSeries } from "@/lib/rpc/numbering";
import { normalizeEmail, isValidEmail } from "@/lib/email/otp";
import { todayIso, addMonths, splitInstalments } from "@/lib/rpc/fees";
import {
  EXPECTED_EVENTS_FLOOR,
  addDays,
  isExcludedReceiptStatus,
  monthEndExclusive,
  monthLabel,
  periodLockedRefusal,
  serviceMonthOf,
} from "@/lib/rpc/rules";
import { isServiceMonth } from "@/lib/rpc/payouts";
import { branchForbidden, defaultBranch, inScope, moneyInScope, recordBranch, type BranchScope } from "@/lib/rpc/scope";
import { notifyFounderApproval, notifyStaffDecision } from "@/lib/push/notify";

type Result = Record<string, unknown>;
const ok = (extra: Result = {}): Result => ({ ok: true, ...extra });
const refuse = (code: string, error: string, extra: Result = {}): Result => ({ ok: false, code, error, ...extra });
const who = (session?: RpcSession) => session?.email || session?.deviceLabel || "";

export const GOVERNANCE_FUNCTIONS = new Set([
  "api_founder_periodLocks",
  "api_founder_closeMonth",
  "api_staff_requestReceiptCorrection",
  "api_founder_voidReceipt",
  "api_founder_correctionReject",
  "api_staff_submitSchoolInvoiceDraft",
  "api_founder_finaliseSchoolInvoiceDraft",
  "api_founder_schoolInvoiceDraftReject",
  "api_staff_submitPackageExtensionRequest",
  "api_founder_packageExtensionApprove",
  "api_founder_packageExtensionReject",
  "api_staff_submitPaymentProfileChangeRequest",
  "api_founder_paymentProfileChangeApprove",
  "api_founder_paymentProfileChangeReject",
  "api_staff_proposeClosure",
  "api_founder_authoriseClosure",
  "api_founder_closureReject",
  "api_founder_revokeClosure",
  "api_closureCalendarList",
  "api_staff_requestClassCorrection",
  "api_founder_approveClassCorrection",
  "api_founder_rejectClassCorrection",
  "api_staff_submitLateFeeWaiverRequest",
  "api_founder_lateFeeWaiverApprove",
  "api_founder_lateFeeWaiverReject",
  "api_staff_submitInstalmentPlanDraft",
  "api_founder_instalmentPlanDraftApprove",
  "api_founder_instalmentPlanDraftReject",
  "api_instalmentPlanForStudent",
  "api_staff_generateTermsToken",
  "api_staff_requestManualTermsAcceptance",
  "api_founder_manualTermsAcceptanceApprove",
  "api_founder_manualTermsAcceptanceReject",
  "api_termsStatusForStudent",
  "api_founder_listAuthorizedEmails",
  "api_founder_addAuthorizedEmail",
  "api_founder_removeAuthorizedEmail",
  "api_founder_listStaffTokens",
  "api_founder_revokeDeviceToken",
]);

export async function dispatchGovernance(fn: string, arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  switch (fn) {
    case "api_founder_periodLocks":
      return periodLocks();
    case "api_founder_closeMonth":
      return closeMonth(arg, session);
    case "api_staff_requestReceiptCorrection":
      return requestReceiptCorrection(arg, scope, session);
    case "api_founder_voidReceipt":
      return voidReceipt(arg, session);
    case "api_founder_correctionReject":
      return correctionReject(arg, session);
    case "api_staff_submitSchoolInvoiceDraft":
      return submitSchoolInvoiceDraft(arg, scope, session);
    case "api_founder_finaliseSchoolInvoiceDraft":
      return finaliseSchoolInvoiceDraft(arg, session);
    case "api_founder_schoolInvoiceDraftReject":
      return schoolInvoiceDraftReject(arg, session);
    case "api_staff_submitPackageExtensionRequest":
      return submitPackageExtensionRequest(arg, scope, session);
    case "api_founder_packageExtensionApprove":
      return packageExtensionApprove(arg, session);
    case "api_founder_packageExtensionReject":
      return packageExtensionReject(arg, session);
    case "api_staff_submitPaymentProfileChangeRequest":
      return submitPaymentProfileChangeRequest(arg, scope, session);
    case "api_founder_paymentProfileChangeApprove":
      return paymentProfileChangeApprove(arg, session);
    case "api_founder_paymentProfileChangeReject":
      return paymentProfileChangeReject(arg, session);
    case "api_staff_proposeClosure":
      return proposeClosure(arg, scope, session);
    case "api_founder_authoriseClosure":
      return authoriseClosure(arg, session);
    case "api_founder_closureReject":
      return closureReject(arg, session);
    case "api_founder_revokeClosure":
      return revokeClosure(arg, session);
    case "api_closureCalendarList":
      return closureCalendarList(scope);
    case "api_staff_requestClassCorrection":
      return requestClassCorrection(arg, scope, session);
    case "api_founder_approveClassCorrection":
      return approveClassCorrection(arg, session);
    case "api_founder_rejectClassCorrection":
      return rejectClassCorrection(arg, session);
    case "api_staff_submitLateFeeWaiverRequest":
      return submitLateFeeWaiverRequest(arg, scope, session);
    case "api_founder_lateFeeWaiverApprove":
      return lateFeeWaiverApprove(arg, session);
    case "api_founder_lateFeeWaiverReject":
      return lateFeeWaiverReject(arg, session);
    case "api_staff_submitInstalmentPlanDraft":
      return submitInstalmentPlanDraft(arg, scope, session);
    case "api_founder_instalmentPlanDraftApprove":
      return instalmentPlanDraftApprove(arg, session);
    case "api_founder_instalmentPlanDraftReject":
      return instalmentPlanDraftReject(arg, session);
    case "api_instalmentPlanForStudent":
      return instalmentPlanForStudent(arg);
    case "api_staff_generateTermsToken":
      return generateTermsToken(arg, scope, session);
    case "api_staff_requestManualTermsAcceptance":
      return requestManualTermsAcceptance(arg, scope, session);
    case "api_founder_manualTermsAcceptanceApprove":
      return manualTermsAcceptanceApprove(arg, session);
    case "api_founder_manualTermsAcceptanceReject":
      return manualTermsAcceptanceReject(arg, session);
    case "api_termsStatusForStudent":
      return termsStatusForStudent(arg, scope, session);
    case "api_founder_listAuthorizedEmails":
      return listAuthorizedEmails();
    case "api_founder_addAuthorizedEmail":
      return addAuthorizedEmail(arg, session);
    case "api_founder_removeAuthorizedEmail":
      return removeAuthorizedEmail(arg);
    case "api_founder_listStaffTokens":
      return listStaffTokens();
    case "api_founder_revokeDeviceToken":
      return revokeDeviceToken(arg);
    default:
      return refuse("UNKNOWN_API", `No governance handler for ${fn}`);
  }
}

// ---------------------------------------------------------------- period locks
/**
 * Refusal when a date falls in a closed month, else null. Every handler that
 * writes something dated calls this before writing.
 */
export async function closedMonthRefusal(isoDate: string, runner: Pick<Tx, "queryOne"> = { queryOne }): Promise<Result | null> {
  const month = serviceMonthOf(isoDate);
  if (!month) return null;
  const lock = await runner.queryOne<{ id: string }>(`select id from period_locks where id = $1`, [month]);
  return lock ? periodLockedRefusal(month) : null;
}

const mondayIndex = (date: string) => (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;

export interface ExpectedClass {
  eventId: string;
  date: string;
  startTime: string;
  course: string;
  teacher: string;
  teacherId: string;
  branch: string;
  resolved: boolean;
  notRequired: boolean;
  outcome: string;
  evidenceClass: string;
  payeeTeacherId: string;
}

/**
 * Every class the timetable expected between two dates (to exclusive), plus
 * extra sessions scheduled in that window, with whatever answer each has.
 */
export async function expectedClassesBetween(
  from: string,
  toExclusive: string,
  filter: { teacherId?: string; scope?: BranchScope } = {},
): Promise<ExpectedClass[]> {
  const [timetable, sessions] = await Promise.all([
    query<{ id: string; day_of_week: number; start_time: string; class_name: string; teacher_name: string; teacher_id: string; branch: string }>(
      `select id, day_of_week, start_time, class_name, teacher_name, teacher_id, branch from timetable where status = 'ENABLED'`,
    ),
    query<Record<string, unknown>>(
      `select id, session_date, start_time, course, teacher_name, teacher_id, branch, resolved, not_required, outcome, evidence_class, payee_teacher_id
       from scheduled_sessions where session_date >= $1 and session_date < $2`,
      [from, toExclusive],
    ),
  ]);
  const byId = new Map(sessions.map((r) => [s(r.id), r]));
  const out: ExpectedClass[] = [];
  const view = (eventId: string, date: string, base: Record<string, unknown>, rec: Record<string, unknown> | undefined): ExpectedClass => ({
    eventId,
    date,
    startTime: s(base.start_time),
    course: s(base.class_name ?? base.course),
    teacher: s(base.teacher_name),
    teacherId: s(base.teacher_id),
    branch: recordBranch(base.branch),
    resolved: rec?.resolved === true,
    notRequired: rec?.not_required === true,
    outcome: s(rec?.outcome),
    evidenceClass: s(rec?.evidence_class),
    payeeTeacherId: s(rec?.payee_teacher_id),
  });
  for (let day = from; day < toExclusive; day = addDays(day, 1)) {
    for (const t of timetable) {
      if (Number(t.day_of_week) !== mondayIndex(day)) continue;
      const eventId = `E-${day}-${t.id}`;
      out.push(view(eventId, day, t as unknown as Record<string, unknown>, byId.get(eventId)));
    }
  }
  for (const sess of sessions) {
    if (!s(sess.id).startsWith("SCSS-")) continue;
    out.push(view(s(sess.id), s(sess.session_date), sess, sess));
  }
  return out
    .filter((c) => !filter.scope || inScope(filter.scope, c.branch))
    .filter((c) => !filter.teacherId || c.teacherId === filter.teacherId || c.payeeTeacherId === filter.teacherId)
    .sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? -1 : 1));
}

/** Classes the timetable expected in a month that nobody has answered. */
async function unansweredClasses(month: string): Promise<ExpectedClass[]> {
  if (month < EXPECTED_EVENTS_FLOOR) return [];
  const all = await expectedClassesBetween(`${month}-01`, monthEndExclusive(month));
  return all.filter((c) => !c.resolved && !c.notRequired);
}

async function periodLocks(): Promise<Result> {
  const rows = await query<{ id: string; closed_by: string; closed_at: string; note: string }>(
    `select id, closed_by, closed_at::text, note from period_locks order by id desc`,
  );
  const today = todayIso();
  const lastMonth = serviceMonthOf(addDays(`${today.slice(0, 7)}-01`, -1));
  const closed = new Set(rows.map((r) => r.id));
  const nextToClose = closed.has(lastMonth) ? "" : lastMonth;
  const blockers = nextToClose ? await unansweredClasses(nextToClose) : [];
  return ok({
    rows: rows.map((r) => ({ month: r.id, label: monthLabel(r.id), closedBy: s(r.closed_by), closedAt: s(r.closed_at).slice(0, 16), note: s(r.note) })),
    nextToClose,
    nextToCloseLabel: nextToClose ? monthLabel(nextToClose) : "",
    unansweredCount: blockers.length,
    unanswered: blockers.slice(0, 20),
    expectedEventsFloor: EXPECTED_EVENTS_FLOOR,
  });
}

async function closeMonth(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const month = s(arg["month"]).trim();
  if (!isServiceMonth(month)) return refuse("MONTH_REQUIRED", "Pick the service month to close (YYYY-MM).");
  if (monthEndExclusive(month) > todayIso()) {
    return refuse("MONTH_NOT_ENDED", `${monthLabel(month)} has not ended yet. A month closes only after its last day.`);
  }
  const existing = await queryOne<{ closed_by: string; closed_at: string }>(`select closed_by, closed_at::text from period_locks where id = $1`, [month]);
  if (existing) {
    return ok({ month, changed: false, idempotent: true, note: `${monthLabel(month)} was already closed by ${s(existing.closed_by) || "someone"} on ${s(existing.closed_at).slice(0, 10)}.` });
  }
  const open = await unansweredClasses(month);
  if (open.length) {
    const first = open[0];
    const named = open.slice(0, 5).map((c) => `${c.date} ${c.startTime} ${c.course}${c.teacher ? ` (${c.teacher})` : ""}`).join("; ");
    return refuse(
      "UNRESOLVED_EXPECTED_CLASS",
      `${monthLabel(month)} cannot close: ${open.length} class${open.length === 1 ? " is" : "es are"} not answered, starting ${first.date}. ${named}.`,
      { month, unansweredCount: open.length, unanswered: open.slice(0, 20) },
    );
  }
  await query(`insert into period_locks (id, closed_by, note) values ($1,$2,$3) on conflict (id) do nothing`, [month, who(session), s(arg["note"]).trim() || null]);
  await bumpRevisions(["dashboard", "sessions", "attendance", "payments", "expenses"]);
  return ok({ month, changed: true, closedBy: who(session), note: `${monthLabel(month)} is closed.` });
}

// ---------------------------------------------------------------- receipt corrections
async function requestReceiptCorrection(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const receiptNo = s(arg["receiptNo"]).trim();
  const reason = s(arg["reason"]).trim();
  const intent = s(arg["clientIntentKey"]).trim() || null;
  if (!receiptNo) return refuse("RECEIPT_REQUIRED", "Pick the receipt that is wrong.");
  if (!reason) return refuse("REASON_REQUIRED", "Say what is wrong on the receipt, so Sharvil can void and reissue it.");
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from receipt_corrections where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ id: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const receipt = await queryOne<{ status: string; branch: string }>(`select status, branch from receipts where receipt_no = $1`, [receiptNo]);
  if (!receipt) return refuse("NOT_FOUND", `No receipt ${receiptNo}`);
  if (!moneyInScope(scope, receipt.branch)) return branchForbidden(recordBranch(receipt.branch));
  if (isExcludedReceiptStatus(receipt.status)) return refuse("ALREADY_VOID", `${receiptNo} is already ${receipt.status}.`);
  const pending = await queryOne<{ id: string }>(`select id from receipt_corrections where receipt_no = $1 and status = 'SUBMITTED'`, [receiptNo]);
  if (pending) return ok({ id: pending.id, status: "SUBMITTED", idempotent: true, note: "A correction for this receipt is already with Sharvil." });

  const id = newId("RCORR");
  await query(
    `insert into receipt_corrections (id, receipt_no, reason, branch, requested_by, client_intent_key) values ($1,$2,$3,$4,$5,$6)`,
    [id, receiptNo, reason, recordBranch(receipt.branch), who(session), intent],
  );
  await bumpRevisions(["approvals", "tasks"]);
  notifyFounderApproval("Receipt correction", `a request about ${receiptNo}`, id);
  return ok({ id, receiptNo, status: "SUBMITTED", note: "Sent to Sharvil. The receipt stays as it is until he decides." });
}

async function voidReceipt(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const correctionId = s(arg["correctionId"] ?? arg["itemId"]).trim();
  let receiptNo = s(arg["receiptNo"]).trim();
  let reason = s(arg["reason"]).trim();

  const result: Result = await withTransaction(async (tx) => {
    if (correctionId) {
      const c = await tx.queryOne<{ receipt_no: string; reason: string; status: string }>(
        `select receipt_no, reason, status from receipt_corrections where id = $1 for update`,
        [correctionId],
      );
      if (!c) return refuse("NOT_FOUND", `No correction request ${correctionId}`);
      if (c.status !== "SUBMITTED") return refuse("NOT_SUBMITTED", `That request is already ${c.status}.`);
      receiptNo = c.receipt_no;
      reason = reason || c.reason;
    }
    if (!receiptNo) return refuse("RECEIPT_REQUIRED", "Pick the receipt to void.");
    if (!reason) return refuse("REASON_REQUIRED", "A void needs a reason; it stays on the receipt for good.");

    const r = await tx.queryOne<Record<string, unknown>>(`select * from receipts where receipt_no = $1 for update`, [receiptNo]);
    if (!r) return refuse("NOT_FOUND", `No receipt ${receiptNo}`);
    if (isExcludedReceiptStatus(r.status)) {
      return ok({ receiptNo, changed: false, idempotent: true, status: s(r.status), note: `${receiptNo} is already ${s(r.status)}.` });
    }
    const paidOn = d(r.payment_date) || d(r.created_at);
    const locked = await closedMonthRefusal(paidOn, tx);
    if (locked) return locked;

    await tx.query(`update receipts set status = 'VOID', void_reason = $2, voided_by = $3, voided_at = now() where receipt_no = $1`, [receiptNo, reason, who(session)]);
    if (s(r.record_id)) await tx.query(`update money_ledger set status = 'VOID' where id = $1`, [s(r.record_id)]);

    // Put the due date back only if this receipt is what moved it and nothing moved it since.
    let dueDateRestored = "";
    const studentId = s(r.student_id);
    if (studentId && r.prev_next_due_date && r.advanced_next_due_date) {
      const st = await tx.queryOne<{ next_due_date: string | null }>(`select next_due_date::text from students_acad where id = $1`, [studentId]);
      if (st && d(st.next_due_date) === d(r.advanced_next_due_date)) {
        await tx.query(`update students_acad set next_due_date = $2::date where id = $1`, [studentId, d(r.prev_next_due_date)]);
        dueDateRestored = d(r.prev_next_due_date);
      }
    }
    if (correctionId) {
      await tx.query(`update receipt_corrections set status = 'VOIDED', decided_by = $2, decided_at = now(), decision_note = $3 where id = $1`, [correctionId, who(session), reason]);
    } else {
      await tx.query(`update receipt_corrections set status = 'VOIDED', decided_by = $2, decided_at = now(), decision_note = $3 where receipt_no = $1 and status = 'SUBMITTED'`, [receiptNo, who(session), reason]);
    }
    return ok({
      receiptNo,
      changed: true,
      status: "VOID",
      dueDateRestored,
      note: dueDateRestored
        ? `${receiptNo} voided; the student's next due date is back to ${dueDateRestored}. Record the payment again to issue a new receipt.`
        : `${receiptNo} voided. The student's due date was changed since, so it was left as is: check it. Record the payment again to issue a new receipt.`,
    });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["receipts", "payments", "students", "dashboard", "approvals", "tasks"]);
    const voidedBranch = await queryOne<{ branch: string }>(`select branch from receipts where receipt_no = $1`, [receiptNo]);
    if (voidedBranch?.branch) notifyStaffDecision(recordBranch(voidedBranch.branch), "Receipt correction", `${receiptNo} was voided`, receiptNo);
  }
  return result;
}

async function correctionReject(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["correctionId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("CORRECTION_ID_REQUIRED", "Pick the correction request.");
  if (!reason) return refuse("REASON_REQUIRED", "Say why the receipt stands, so staff can tell the parent.");
  const rows = await query<{ id: string; branch: string }>(
    `update receipt_corrections set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("NOT_FOUND", `No pending correction request ${id}`);
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Receipt correction", "rejected — the receipt stands", id);
  return ok({ id, changed: true, status: "REJECTED" });
}

// ---------------------------------------------------------------- school invoice drafts
async function submitSchoolInvoiceDraft(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const amount = n(arg["amount"]);
  const className = s(arg["className"]).trim();
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (amount <= 0) return refuse("BAD_AMOUNT", "Enter the invoice amount.");
  if (!className) return refuse("CLASS_REQUIRED", "Enter the school class this invoice is for.");
  if (arg["previewConfirmed"] !== true) return refuse("PREVIEW_REQUIRED", "Check the preview and confirm it before sending.");
  const branch = defaultBranch(scope, arg["branch"]);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  const invoiceDate = /^\d{4}-\d{2}-\d{2}$/.test(s(arg["invoiceDate"])) ? s(arg["invoiceDate"]) : todayIso();
  const locked = await closedMonthRefusal(invoiceDate);
  if (locked) return locked;
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from school_invoice_drafts where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ draftId: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const id = newId("SIDRAFT");
  await query(
    `insert into school_invoice_drafts (id, branch, class_name, amount, tenure, invoice_date, notes, preview_confirmed, submitted_by, client_intent_key)
     values ($1,$2,$3,$4,$5,$6::date,$7,true,$8,$9)`,
    [id, branch, className, amount, s(arg["tenure"]), invoiceDate, s(arg["notes"]).trim() || null, who(session), intent],
  );
  await bumpRevisions(["invoices", "approvals", "tasks"]);
  notifyFounderApproval("School invoice", "a draft invoice to issue", id);
  return ok({ draftId: id, status: "SUBMITTED", persisted: true, note: "Sent to Sharvil. He allocates the invoice number when he finalises it." });
}

async function finaliseSchoolInvoiceDraft(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["draftId"] ?? arg["itemId"]).trim();
  if (!id) return refuse("DRAFT_ID_REQUIRED", "Pick the invoice draft.");
  const result: Result = await withTransaction(async (tx) => {
    const draft = await tx.queryOne<Record<string, unknown>>(`select * from school_invoice_drafts where id = $1 for update`, [id]);
    if (!draft) return refuse("DRAFT_NOT_FOUND", `No school invoice draft ${id}`);
    if (s(draft.status) === "FINALISED") {
      return ok({ draftId: id, changed: false, idempotent: true, invoiceNo: s(draft.final_invoice_no), invoiceId: s(draft.final_invoice_id) });
    }
    if (s(draft.status) !== "SUBMITTED") return refuse("NOT_SUBMITTED", `Draft status ${s(draft.status)}`);
    const invoiceDate = d(draft.invoice_date) || todayIso();
    const locked = await closedMonthRefusal(invoiceDate, tx);
    if (locked) return locked;
    const invoiceId = newId("SINV");
    const invoiceNo = await nextDocNo(tx, "schoolInvoice", schoolInvoiceSeries(new Date(`${invoiceDate}T12:00:00+05:30`)));
    await tx.query(
      `insert into school_invoices_rpc (id, invoice_no, invoice_date, branch, class_name, amount, tenure, status)
       values ($1,$2,$3,$4,$5,$6,$7,'FINAL')`,
      [invoiceId, invoiceNo, invoiceDate, s(draft.branch), s(draft.class_name), n(draft.amount), s(draft.tenure)],
    );
    await tx.query(
      `update school_invoice_drafts set status = 'FINALISED', decided_by = $2, decided_at = now(), final_invoice_id = $3, final_invoice_no = $4 where id = $1`,
      [id, who(session), invoiceId, invoiceNo],
    );
    return ok({ draftId: id, changed: true, invoiceId, invoiceNo, branch: s(draft.branch), note: `Invoice ${invoiceNo} issued.` });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["invoices", "approvals", "dashboard"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "School invoice", "issued", id);
  }
  return result;
}

async function schoolInvoiceDraftReject(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["draftId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("DRAFT_ID_REQUIRED", "Pick the invoice draft.");
  if (!reason) return refuse("REASON_REQUIRED", "Give a reason so staff know what to fix.");
  const rows = await query<{ id: string; branch: string }>(
    `update school_invoice_drafts set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("DRAFT_NOT_FOUND", `No pending school invoice draft ${id}`);
  await bumpRevisions(["approvals", "invoices"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "School invoice", "rejected — see the reason", id);
  return ok({ draftId: id, changed: true, status: "REJECTED" });
}

// ---------------------------------------------------------------- package extension requests
async function submitPackageExtensionRequest(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const studentId = s(arg["studentId"]).trim();
  const extraMonths = Math.round(n(arg["extraMonths"]));
  const reason = s(arg["reason"]).trim();
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (!studentId) return refuse("STUDENT_ID_REQUIRED", "Pick the student.");
  if (!(extraMonths > 0 && extraMonths <= 24)) return refuse("BAD_MONTHS", "Enter how many extra months to add (1-24).");
  if (!reason) return refuse("REASON_REQUIRED", "Say why the package is being extended.");
  const student = await queryOne<{ name: string; branch: string }>(`select name, branch from students_acad where id = $1`, [studentId]);
  if (!student) return refuse("STUDENT_NOT_FOUND", `No student ${studentId}`);
  const branch = recordBranch(student.branch);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from package_extension_requests where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ requestId: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const newMonthlyFee = arg["newMonthlyFee"] != null && n(arg["newMonthlyFee"]) > 0 ? n(arg["newMonthlyFee"]) : null;
  const newFeePlanName = s(arg["newFeePlanName"]).trim() || null;
  const id = newId("PKGEXT");
  await query(
    `insert into package_extension_requests (id, student_id, extra_months, new_monthly_fee, new_fee_plan_name, reason, branch, submitted_by, client_intent_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, studentId, extraMonths, newMonthlyFee, newFeePlanName, reason, branch, who(session), intent],
  );
  await bumpRevisions(["approvals", "tasks"]);
  notifyFounderApproval("Package extension", `${extraMonths} month(s) for ${student.name}`, id);
  return ok({ requestId: id, status: "SUBMITTED", persisted: true, note: "Sent to Sharvil." });
}

async function packageExtensionApprove(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  if (!id) return refuse("REQUEST_ID_REQUIRED", "Pick the package extension request.");
  const result: Result = await withTransaction(async (tx) => {
    const req = await tx.queryOne<Record<string, unknown>>(`select * from package_extension_requests where id = $1 for update`, [id]);
    if (!req) return refuse("NOT_FOUND", `No package extension request ${id}`);
    if (s(req.status) === "APPROVED") return ok({ requestId: id, changed: false, idempotent: true });
    if (s(req.status) !== "SUBMITTED") return refuse("NOT_SUBMITTED", `Request status ${s(req.status)}`);
    const student = await tx.queryOne<{ next_due_date: string | null }>(`select next_due_date::text from students_acad where id = $1`, [s(req.student_id)]);
    if (!student) return refuse("STUDENT_NOT_FOUND", `No student ${s(req.student_id)}`);
    const newDue = student.next_due_date ? addMonths(student.next_due_date, n(req.extra_months)) : null;
    await tx.query(
      `update students_acad set
         next_due_date = coalesce($2::date, next_due_date),
         monthly_fee = coalesce($3, monthly_fee),
         fee_plan_name = coalesce($4, fee_plan_name)
       where id = $1`,
      [s(req.student_id), newDue, req.new_monthly_fee, req.new_fee_plan_name],
    );
    await tx.query(
      `update package_extension_requests set status = 'APPROVED', decided_by = $2, decided_at = now() where id = $1`,
      [id, who(session)],
    );
    return ok({ requestId: id, changed: true, branch: s(req.branch), studentId: s(req.student_id), note: "Package extended." });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["approvals", "students", "dashboard"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Package extension", "approved", id);
  }
  return result;
}

async function packageExtensionReject(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("REQUEST_ID_REQUIRED", "Pick the package extension request.");
  if (!reason) return refuse("REASON_REQUIRED", "Give a reason so staff know what to fix.");
  const rows = await query<{ id: string; branch: string }>(
    `update package_extension_requests set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("NOT_FOUND", `No pending package extension request ${id}`);
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Package extension", "rejected — see the reason", id);
  return ok({ requestId: id, changed: true, status: "REJECTED" });
}

// ---------------------------------------------------------------- payment profile change requests
async function submitPaymentProfileChangeRequest(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const entityId = s(arg["entityId"]).trim();
  const requestedLabel = s(arg["requestedLabel"]).trim();
  const reason = s(arg["reason"]).trim();
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (!entityId) return refuse("ENTITY_REQUIRED", "Pick the entity this payment profile belongs to.");
  if (!requestedLabel) return refuse("LABEL_REQUIRED", "Describe the new payment profile (e.g. bank + account label).");
  if (!reason) return refuse("REASON_REQUIRED", "Say why the payment profile is changing.");
  // brief §1.2: the only two entities that exist. Checked against the fixed
  // set, not the legacy `entities` table, which isn't kept populated.
  if (entityId !== "ENT-GOREGAON" && entityId !== "ENT-KANDIVALI") return refuse("ENTITY_NOT_FOUND", `No entity ${entityId}`);
  // Payment profiles are academy-wide config, not branch-scoped data — any
  // staff account can propose a change, the founder alone decides.
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from payment_profile_change_requests where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ requestId: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const id = newId("PPCHG");
  await query(
    `insert into payment_profile_change_requests (id, entity_id, requested_label, requested_masked_hint, reason, branch, submitted_by, client_intent_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, entityId, requestedLabel, s(arg["requestedMaskedHint"]).trim() || null, reason, s(arg["branch"] ?? "").trim() || null, who(session), intent],
  );
  await bumpRevisions(["approvals"]);
  notifyFounderApproval("Payment profile change", `${entityId} → ${requestedLabel}`, id);
  return ok({ requestId: id, status: "SUBMITTED", persisted: true, note: "Sent to Sharvil." });
}

async function paymentProfileChangeApprove(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  if (!id) return refuse("REQUEST_ID_REQUIRED", "Pick the payment profile change request.");
  const result: Result = await withTransaction(async (tx) => {
    const req = await tx.queryOne<Record<string, unknown>>(`select * from payment_profile_change_requests where id = $1 for update`, [id]);
    if (!req) return refuse("NOT_FOUND", `No payment profile change request ${id}`);
    if (s(req.status) === "APPROVED") return ok({ requestId: id, changed: false, idempotent: true });
    if (s(req.status) !== "SUBMITTED") return refuse("NOT_SUBMITTED", `Request status ${s(req.status)}`);
    await tx.query(
      `insert into entity_payment_profiles (entity_id, label, masked_hint, updated_by)
       values ($1,$2,$3,$4)
       on conflict (entity_id) do update set label = excluded.label, masked_hint = excluded.masked_hint,
         updated_by = excluded.updated_by, updated_at = now()`,
      [s(req.entity_id), s(req.requested_label), req.requested_masked_hint, who(session)],
    );
    await tx.query(
      `update payment_profile_change_requests set status = 'APPROVED', decided_by = $2, decided_at = now() where id = $1`,
      [id, who(session)],
    );
    return ok({ requestId: id, changed: true, branch: s(req.branch), entityId: s(req.entity_id), note: "Payment profile updated." });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["approvals"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Payment profile change", "approved", id);
  }
  return result;
}

async function paymentProfileChangeReject(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("REQUEST_ID_REQUIRED", "Pick the payment profile change request.");
  if (!reason) return refuse("REASON_REQUIRED", "Give a reason so staff know what to fix.");
  const rows = await query<{ id: string; branch: string }>(
    `update payment_profile_change_requests set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("NOT_FOUND", `No pending payment profile change request ${id}`);
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Payment profile change", "rejected — see the reason", id);
  return ok({ requestId: id, changed: true, status: "REJECTED" });
}

// ---------------------------------------------------------------- closure calendar
interface TimetableRowForClosure {
  id: string;
  day_of_week: number;
  start_time: string;
  class_name: string;
  teacher_id: string;
  teacher_name: string;
  branch: string;
}

async function timetableRowsForClosure(scopeVal: string, branch: string, tx: Tx): Promise<TimetableRowForClosure[]> {
  if (scopeVal === "BRANCH") {
    return tx.query<TimetableRowForClosure>(
      `select id, day_of_week, start_time, class_name, teacher_id, teacher_name, branch from timetable where status = 'ENABLED' and branch = $1`,
      [branch],
    );
  }
  return tx.query<TimetableRowForClosure>(
    `select id, day_of_week, start_time, class_name, teacher_id, teacher_name, branch from timetable where status = 'ENABLED'`,
  );
}

/**
 * Marks (reason != null) or clears (reason == null) not_required on every
 * timetable slot in [fromDate, toDate], skipping any class already answered
 * — a closure marks a class not required, it never overwrites an answer.
 */
async function applyClosureFlag(tx: Tx, fromDate: string, toDate: string, rows: TimetableRowForClosure[], reason: string | null): Promise<void> {
  for (let day = fromDate; day <= toDate; day = addDays(day, 1)) {
    for (const t of rows) {
      if (Number(t.day_of_week) !== mondayIndex(day)) continue;
      const eventId = `E-${day}-${t.id}`;
      if (reason !== null) {
        await tx.query(
          `insert into scheduled_sessions (id, session_date, start_time, teacher_id, teacher_name, branch, course, not_required, closure_reason, resolved, answerable)
           values ($1,$2,$3,$4,$5,$6,$7,true,$8,false,true)
           on conflict (id) do update set not_required = true, closure_reason = $8
           where scheduled_sessions.resolved = false`,
          [eventId, day, t.start_time, t.teacher_id, t.teacher_name, t.branch, t.class_name, reason],
        );
      } else {
        await tx.query(`update scheduled_sessions set not_required = false, closure_reason = '' where id = $1 and resolved = false`, [eventId]);
      }
    }
  }
}

async function proposeClosure(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const scopeVal = s(arg["scope"]).trim().toUpperCase() || "BRANCH";
  if (scopeVal !== "ACADEMY" && scopeVal !== "BRANCH") return refuse("BAD_SCOPE", "Scope must be ACADEMY or BRANCH.");
  const branch = scopeVal === "BRANCH" ? recordBranch(defaultBranch(scope, arg["branch"])) : "";
  if (scopeVal === "BRANCH" && !inScope(scope, branch)) return branchForbidden(branch);
  const fromDate = s(arg["fromDate"]).trim();
  const toDate = s(arg["toDate"]).trim() || fromDate;
  const reason = s(arg["reason"]).trim();
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate)) return refuse("DATE_REQUIRED", "Pick the closure's start date.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(toDate) || toDate < fromDate) return refuse("BAD_RANGE", "End date must be on or after the start date.");
  if (!reason) return refuse("REASON_REQUIRED", "Say why the academy or branch is closed.");
  const backdated = fromDate < todayIso();
  if (backdated) {
    const conflict = await queryOne<{ id: string }>(
      scopeVal === "BRANCH"
        ? `select id from scheduled_sessions where session_date >= $1 and session_date <= $2 and resolved = true and branch = $3 limit 1`
        : `select id from scheduled_sessions where session_date >= $1 and session_date <= $2 and resolved = true limit 1`,
      scopeVal === "BRANCH" ? [fromDate, toDate, branch] : [fromDate, toDate],
    );
    if (conflict) return refuse("ALREADY_ANSWERED", "A class in this date range is already answered. A backdated closure cannot cover it.");
  }
  if (intent) {
    const earlier = await queryOne<{ id: string; state: string }>(`select id, state from closure_calendar where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ closureId: earlier.id, state: earlier.state, idempotent: true, note: "Already sent to Sharvil." });
  }
  const id = newId("CLOSURE");
  await query(
    `insert into closure_calendar (id, scope, branch, from_date, to_date, reason, backdated, notes, recorded_by, client_intent_key)
     values ($1,$2,$3,$4::date,$5::date,$6,$7,$8,$9,$10)`,
    [id, scopeVal, branch || null, fromDate, toDate, reason, backdated, s(arg["notes"]).trim() || null, who(session), intent],
  );
  await bumpRevisions(["approvals"]);
  notifyFounderApproval("Closure", `${scopeVal === "ACADEMY" ? "academy-wide" : branch} ${fromDate}–${toDate}`, id);
  return ok({ closureId: id, state: "PROPOSED", persisted: true, note: "Sent to Sharvil. Classes stay as expected until he authorises it." });
}

async function authoriseClosure(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["closureId"] ?? arg["itemId"]).trim();
  if (!id) return refuse("CLOSURE_ID_REQUIRED", "Pick the closure request.");
  const result: Result = await withTransaction(async (tx) => {
    const c = await tx.queryOne<Record<string, unknown>>(`select * from closure_calendar where id = $1 for update`, [id]);
    if (!c) return refuse("NOT_FOUND", `No closure request ${id}`);
    if (s(c.state) === "AUTHORISED") return ok({ closureId: id, changed: false, idempotent: true });
    if (s(c.state) !== "PROPOSED") return refuse("NOT_PROPOSED", `Closure status ${s(c.state)}`);
    const rows = await timetableRowsForClosure(s(c.scope), s(c.branch), tx);
    await applyClosureFlag(tx, d(c.from_date), d(c.to_date), rows, s(c.reason));
    await tx.query(`update closure_calendar set state = 'AUTHORISED', authorised_by = $2, authorised_at = now() where id = $1`, [id, who(session)]);
    return ok({ closureId: id, changed: true, branch: s(c.branch), note: "Closure authorised." });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["approvals", "sessions", "dashboard"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Closure", "authorised", id);
  }
  return result;
}

async function closureReject(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["closureId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("CLOSURE_ID_REQUIRED", "Pick the closure request.");
  if (!reason) return refuse("REASON_REQUIRED", "Give a reason so staff know what to fix.");
  const rows = await query<{ id: string; branch: string }>(
    `update closure_calendar set state = 'REVOKED', authorised_by = $2, authorised_at = now(), decision_note = $3
     where id = $1 and state = 'PROPOSED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("NOT_FOUND", `No pending closure request ${id}`);
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Closure", "rejected — see the reason", id);
  return ok({ closureId: id, changed: true, state: "REVOKED" });
}

/** Undo an already-authorised closure: the classes in range are expected again. */
async function revokeClosure(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["closureId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("CLOSURE_ID_REQUIRED", "Pick the closure.");
  if (!reason) return refuse("REASON_REQUIRED", "Say why the closure is being revoked.");
  const result: Result = await withTransaction(async (tx) => {
    const c = await tx.queryOne<Record<string, unknown>>(`select * from closure_calendar where id = $1 for update`, [id]);
    if (!c) return refuse("NOT_FOUND", `No closure ${id}`);
    if (s(c.state) !== "AUTHORISED") return refuse("NOT_AUTHORISED", `Closure status ${s(c.state)}`);
    const rows = await timetableRowsForClosure(s(c.scope), s(c.branch), tx);
    await applyClosureFlag(tx, d(c.from_date), d(c.to_date), rows, null);
    await tx.query(`update closure_calendar set state = 'REVOKED', decision_note = $2 where id = $1`, [id, reason]);
    return ok({ closureId: id, changed: true, branch: s(c.branch), note: "Closure revoked. Those classes are expected again." });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["approvals", "sessions", "dashboard"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Closure", "revoked", id);
  }
  return result;
}

async function closureCalendarList(scope: BranchScope): Promise<Result> {
  const rows = await query<Record<string, unknown>>(`select * from closure_calendar order by recorded_at desc limit 200`);
  const visible = rows.filter((r) => s(r.scope) === "ACADEMY" || inScope(scope, s(r.branch)));
  return ok({
    rows: visible.map((r) => ({
      closureId: s(r.id),
      scope: s(r.scope),
      branch: s(r.branch),
      fromDate: d(r.from_date),
      toDate: d(r.to_date),
      reason: s(r.reason),
      state: s(r.state),
      backdated: r.backdated === true,
      recordedBy: s(r.recorded_by),
      recordedAt: s(r.recorded_at),
      authorisedBy: s(r.authorised_by),
      authorisedAt: s(r.authorised_at),
    })),
  });
}

// ---------------------------------------------------------------- class outcome corrections
/**
 * Brief §14.1: a class answered once cannot be re-answered directly —
 * resolveTodaysClass refuses a second answer and points here. Mirrors
 * requestReceiptCorrection/voidReceipt exactly: staff ask, the founder
 * decides, and the founder's approval only re-opens the row — it never sets
 * the outcome itself, so AttendanceEngine-equivalent stays the one writer.
 */
async function requestClassCorrection(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const eventId = s(arg["eventId"]).trim();
  const reason = s(arg["reason"]).trim();
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (!eventId) return refuse("EVENT_ID_REQUIRED", "Pick the class that needs correcting.");
  if (!reason) return refuse("REASON_REQUIRED", "Say what is wrong with how this class was answered.");
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from class_outcome_corrections where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ id: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const row = await queryOne<Record<string, unknown>>(`select * from scheduled_sessions where id = $1`, [eventId]);
  if (!row) return refuse("NOT_FOUND", `No class ${eventId}`);
  if (!inScope(scope, row.branch)) return branchForbidden(recordBranch(row.branch));
  if (row.resolved !== true) return refuse("NOT_RESOLVED", "This class has not been answered yet — answer it directly instead of requesting a correction.");
  const pending = await queryOne<{ id: string }>(`select id from class_outcome_corrections where event_id = $1 and status = 'SUBMITTED'`, [eventId]);
  if (pending) return ok({ id: pending.id, status: "SUBMITTED", idempotent: true, note: "A correction for this class is already with Sharvil." });
  const id = newId("CCORR");
  await query(
    `insert into class_outcome_corrections (id, event_id, reason, branch, prior_outcome, prior_evidence_class, requested_by, client_intent_key)
     values ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, eventId, reason, recordBranch(row.branch), s(row.outcome), s(row.evidence_class), who(session), intent],
  );
  await bumpRevisions(["approvals"]);
  notifyFounderApproval("Class correction", `a request about ${eventId}`, id);
  return ok({ id, eventId, status: "SUBMITTED", note: "Sent to Sharvil. The class stays answered as it is until he decides." });
}

async function approveClassCorrection(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["correctionId"] ?? arg["itemId"]).trim();
  if (!id) return refuse("CORRECTION_ID_REQUIRED", "Pick the correction request.");
  const result: Result = await withTransaction(async (tx) => {
    const c = await tx.queryOne<Record<string, unknown>>(`select * from class_outcome_corrections where id = $1 for update`, [id]);
    if (!c) return refuse("NOT_FOUND", `No correction request ${id}`);
    if (s(c.status) === "APPROVED") return ok({ id, changed: false, idempotent: true });
    if (s(c.status) !== "SUBMITTED") return refuse("NOT_SUBMITTED", `Correction status ${s(c.status)}`);
    await tx.query(
      `update scheduled_sessions set resolved = false, answerable = true, outcome = '', delivered_by = '',
         payee_teacher_id = '', evidence_class = '', evidence_reason = '', late_reason = ''
       where id = $1`,
      [s(c.event_id)],
    );
    await tx.query(`update class_outcome_corrections set status = 'APPROVED', decided_by = $2, decided_at = now() where id = $1`, [id, who(session)]);
    return ok({ id, changed: true, branch: s(c.branch), eventId: s(c.event_id), note: "The class is open to answer again." });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["approvals", "sessions", "dashboard"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Class correction", "approved — answer it again", id);
  }
  return result;
}

async function rejectClassCorrection(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["correctionId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("CORRECTION_ID_REQUIRED", "Pick the correction request.");
  if (!reason) return refuse("REASON_REQUIRED", "Say why the class's answer stands.");
  const rows = await query<{ id: string; branch: string }>(
    `update class_outcome_corrections set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("NOT_FOUND", `No pending correction request ${id}`);
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Class correction", "rejected — the answer stands", id);
  return ok({ id, changed: true, status: "REJECTED" });
}

// ---------------------------------------------------------------- late-fee waiver requests
async function submitLateFeeWaiverRequest(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const studentId = s(arg["studentId"]).trim();
  const reason = s(arg["reason"]).trim();
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (!studentId) return refuse("STUDENT_ID_REQUIRED", "Pick the student.");
  if (!reason) return refuse("REASON_REQUIRED", "Say why the late fee is being waived.");
  const student = await queryOne<{ name: string; branch: string; next_due_date: string | null }>(
    `select name, branch, next_due_date::text from students_acad where id = $1`,
    [studentId],
  );
  if (!student) return refuse("STUDENT_NOT_FOUND", `No student ${studentId}`);
  const branch = recordBranch(student.branch);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  const waivedAmount = arg["waivedAmount"] != null && n(arg["waivedAmount"]) > 0 ? n(arg["waivedAmount"]) : null;
  const newNextDueDate = /^\d{4}-\d{2}-\d{2}$/.test(s(arg["newNextDueDate"])) ? s(arg["newNextDueDate"]) : null;
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from late_fee_waiver_requests where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ requestId: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const id = newId("WAIVER");
  await query(
    `insert into late_fee_waiver_requests (id, student_id, waived_amount, new_next_due_date, reason, branch, submitted_by, client_intent_key)
     values ($1,$2,$3,$4::date,$5,$6,$7,$8)`,
    [id, studentId, waivedAmount, newNextDueDate, reason, branch, who(session), intent],
  );
  await bumpRevisions(["approvals"]);
  notifyFounderApproval("Late-fee waiver", `for ${student.name}`, id);
  return ok({ requestId: id, status: "SUBMITTED", persisted: true, note: "Sent to Sharvil." });
}

async function lateFeeWaiverApprove(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  if (!id) return refuse("REQUEST_ID_REQUIRED", "Pick the waiver request.");
  const result: Result = await withTransaction(async (tx) => {
    const req = await tx.queryOne<Record<string, unknown>>(`select * from late_fee_waiver_requests where id = $1 for update`, [id]);
    if (!req) return refuse("NOT_FOUND", `No late-fee waiver request ${id}`);
    if (s(req.status) === "APPROVED") return ok({ requestId: id, changed: false, idempotent: true });
    if (s(req.status) !== "SUBMITTED") return refuse("NOT_SUBMITTED", `Request status ${s(req.status)}`);
    if (req.new_next_due_date != null) {
      await tx.query(`update students_acad set next_due_date = $2::date where id = $1`, [s(req.student_id), d(req.new_next_due_date)]);
    }
    await tx.query(`update late_fee_waiver_requests set status = 'APPROVED', decided_by = $2, decided_at = now() where id = $1`, [id, who(session)]);
    return ok({ requestId: id, changed: true, branch: s(req.branch), studentId: s(req.student_id), note: "Late fee waived." });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["approvals", "students", "dashboard"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Late-fee waiver", "approved", id);
  }
  return result;
}

async function lateFeeWaiverReject(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("REQUEST_ID_REQUIRED", "Pick the waiver request.");
  if (!reason) return refuse("REASON_REQUIRED", "Give a reason so staff know what to fix.");
  const rows = await query<{ id: string; branch: string }>(
    `update late_fee_waiver_requests set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("NOT_FOUND", `No pending late-fee waiver request ${id}`);
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Late-fee waiver", "rejected — see the reason", id);
  return ok({ requestId: id, changed: true, status: "REJECTED" });
}

// ---------------------------------------------------------------- instalment plans
async function submitInstalmentPlanDraft(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const studentId = s(arg["studentId"]).trim();
  const totalAmount = n(arg["totalAmount"]);
  const instalmentCount = Math.round(n(arg["instalmentCount"]));
  const firstDueDate = s(arg["firstDueDate"]).trim();
  const cadenceDays = Math.round(n(arg["cadenceDays"])) || 30;
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (!studentId) return refuse("STUDENT_ID_REQUIRED", "Pick the student.");
  if (!(totalAmount > 0)) return refuse("BAD_AMOUNT", "Enter the total amount the plan covers.");
  if (!(instalmentCount >= 2 && instalmentCount <= 12)) return refuse("BAD_COUNT", "Split into 2-12 instalments.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(firstDueDate)) return refuse("DATE_REQUIRED", "Pick the first instalment's due date.");
  const student = await queryOne<{ name: string; branch: string }>(`select name, branch from students_acad where id = $1`, [studentId]);
  if (!student) return refuse("STUDENT_NOT_FOUND", `No student ${studentId}`);
  const branch = recordBranch(student.branch);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  const existing = await queryOne<{ id: string }>(`select id from instalment_plans where student_id = $1 and status = 'ACTIVE'`, [studentId]);
  if (existing) return refuse("PLAN_ALREADY_ACTIVE", `${student.name} already has an active instalment plan.`);
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from instalment_plan_drafts where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ draftId: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const id = newId("INSTDRAFT");
  await query(
    `insert into instalment_plan_drafts (id, student_id, student_name, total_amount, instalment_count, first_due_date, cadence_days, notes, branch, submitted_by, client_intent_key)
     values ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11)`,
    [id, studentId, student.name, totalAmount, instalmentCount, firstDueDate, cadenceDays, s(arg["notes"]).trim() || null, branch, who(session), intent],
  );
  await bumpRevisions(["approvals"]);
  notifyFounderApproval("Instalment plan", `${instalmentCount} instalments for ${student.name}`, id);
  return ok({ draftId: id, status: "SUBMITTED", persisted: true, note: "Sent to Sharvil." });
}

async function instalmentPlanDraftApprove(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["draftId"] ?? arg["itemId"]).trim();
  if (!id) return refuse("DRAFT_ID_REQUIRED", "Pick the instalment plan request.");
  const result: Result = await withTransaction(async (tx) => {
    const draft = await tx.queryOne<Record<string, unknown>>(`select * from instalment_plan_drafts where id = $1 for update`, [id]);
    if (!draft) return refuse("DRAFT_NOT_FOUND", `No instalment plan request ${id}`);
    if (s(draft.status) === "APPROVED") return ok({ draftId: id, changed: false, idempotent: true, planId: s(draft.plan_id) });
    if (s(draft.status) !== "SUBMITTED") return refuse("NOT_SUBMITTED", `Request status ${s(draft.status)}`);
    const count = n(draft.instalment_count);
    const total = n(draft.total_amount);
    const planId = newId("INSTPLAN");
    await tx.query(
      `insert into instalment_plans (id, student_id, total_amount, instalment_count, branch, created_by)
       values ($1,$2,$3,$4,$5,$6)`,
      [planId, s(draft.student_id), total, count, s(draft.branch), who(session)],
    );
    const amounts = splitInstalments(total, count);
    for (let i = 1; i <= count; i++) {
      const dueDate = addDays(d(draft.first_due_date), (i - 1) * n(draft.cadence_days));
      await tx.query(
        `insert into instalment_plan_items (id, plan_id, seq_no, amount, due_date) values ($1,$2,$3,$4,$5::date)`,
        [newId("INSTITEM"), planId, i, amounts[i - 1], dueDate],
      );
    }
    await tx.query(`update instalment_plan_drafts set status = 'APPROVED', decided_by = $2, decided_at = now(), plan_id = $3 where id = $1`, [id, who(session), planId]);
    return ok({ draftId: id, changed: true, planId, branch: s(draft.branch), note: "Instalment plan created." });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["approvals", "students", "payments"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Instalment plan", "approved", id);
  }
  return result;
}

async function instalmentPlanDraftReject(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["draftId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("DRAFT_ID_REQUIRED", "Pick the instalment plan request.");
  if (!reason) return refuse("REASON_REQUIRED", "Give a reason so staff know what to fix.");
  const rows = await query<{ id: string; branch: string }>(
    `update instalment_plan_drafts set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("DRAFT_NOT_FOUND", `No pending instalment plan request ${id}`);
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Instalment plan", "rejected — see the reason", id);
  return ok({ draftId: id, changed: true, status: "REJECTED" });
}

/** The student's active plan and its schedule — for the fee-collection screen. */
export async function instalmentPlanForStudent(arg: Record<string, unknown>): Promise<Result> {
  const studentId = s(arg["studentId"]).trim();
  if (!studentId) return refuse("STUDENT_ID_REQUIRED", "Pick the student.");
  const plan = await queryOne<Record<string, unknown>>(`select * from instalment_plans where student_id = $1 and status = 'ACTIVE'`, [studentId]);
  if (!plan) return ok({ hasPlan: false });
  const items = await query<Record<string, unknown>>(`select * from instalment_plan_items where plan_id = $1 order by seq_no`, [s(plan.id)]);
  const nextPending = items.find((i) => s(i.status) === "PENDING");
  return ok({
    hasPlan: true,
    planId: s(plan.id),
    totalAmount: s(plan.total_amount),
    instalmentCount: n(plan.instalment_count),
    items: items.map((i) => ({ itemId: s(i.id), seqNo: n(i.seq_no), amount: s(i.amount), dueDate: d(i.due_date), status: s(i.status), paidReceiptNo: s(i.paid_receipt_no) })),
    nextPendingItemId: nextPending ? s(nextPending.id) : "",
    nextPendingAmount: nextPending ? s(nextPending.amount) : "",
  });
}

// ---------------------------------------------------------------- admission terms (P10)
const NOT_OPERATIONAL = new Set(["TEST", "LEFT", "DUPLICATE", "ARCHIVED"]);
const TERMS_TOKEN_TTL_DAYS = 7;

async function generateTermsToken(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const studentId = s(arg["studentId"]).trim();
  if (!studentId) return refuse("STUDENT_ID_REQUIRED", "Pick the student.");
  const student = await queryOne<{ name: string; branch: string; status: string }>(`select name, branch, status from students_acad where id = $1`, [studentId]);
  if (!student) return refuse("STUDENT_NOT_FOUND", `No student ${studentId}`);
  const branch = recordBranch(student.branch);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  if (NOT_OPERATIONAL.has(s(student.status).toUpperCase())) {
    return refuse("STUDENT_NOT_OPERATIONAL", `${student.name} is marked ${s(student.status).toUpperCase()} and cannot receive a terms link.`);
  }
  const open = await query<{ id: string }>(
    `select token as id from terms_acceptance_tokens where student_id = $1 and status = 'OPEN' and expires_at > now()`,
    [studentId],
  );
  if (open.length > 1) {
    return refuse("TOO_MANY_OPEN_TOKENS", `${student.name} already has more than one open terms link. Use an existing one or ask Sharvil.`);
  }
  const token = randomBytes(24).toString("hex");
  await query(
    `insert into terms_acceptance_tokens (token, student_id, issued_by, expires_at) values ($1,$2,$3, now() + ($4::int * interval '1 day'))`,
    [token, studentId, who(session), TERMS_TOKEN_TTL_DAYS],
  );
  const domain = (process.env.APP_DOMAIN ?? "").trim();
  const base = domain ? `https://${domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : "";
  return ok({
    token,
    path: `/terms/${token}`,
    url: base ? `${base}/terms/${token}` : "",
    expiresInDays: TERMS_TOKEN_TTL_DAYS,
    note: base ? "Share this link with the parent." : "Set APP_DOMAIN to generate a full shareable link.",
  });
}

async function requestManualTermsAcceptance(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const studentId = s(arg["studentId"]).trim();
  const reason = s(arg["reason"]).trim();
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (!studentId) return refuse("STUDENT_ID_REQUIRED", "Pick the student.");
  if (!reason) return refuse("REASON_REQUIRED", "Say how the parent accepted (e.g. verbally, on paper).");
  const student = await queryOne<{ name: string; branch: string }>(`select name, branch from students_acad where id = $1`, [studentId]);
  if (!student) return refuse("STUDENT_NOT_FOUND", `No student ${studentId}`);
  const branch = recordBranch(student.branch);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from manual_terms_acceptance_requests where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ requestId: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const id = newId("MTERMS");
  await query(
    `insert into manual_terms_acceptance_requests (id, student_id, reason, branch, submitted_by, client_intent_key)
     values ($1,$2,$3,$4,$5,$6)`,
    [id, studentId, reason, branch, who(session), intent],
  );
  await bumpRevisions(["approvals"]);
  notifyFounderApproval("Manual terms acceptance", `for ${student.name}`, id);
  return ok({ requestId: id, status: "SUBMITTED", persisted: true, note: "Sent to Sharvil. This is an approval item, not a tick box." });
}

async function manualTermsAcceptanceApprove(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  if (!id) return refuse("REQUEST_ID_REQUIRED", "Pick the request.");
  const rows = await query<{ id: string; branch: string }>(
    `update manual_terms_acceptance_requests set status = 'APPROVED', decided_by = $2, decided_at = now()
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session)],
  );
  if (!rows.length) {
    const existing = await queryOne<{ status: string }>(`select status from manual_terms_acceptance_requests where id = $1`, [id]);
    if (existing?.status === "APPROVED") return ok({ requestId: id, changed: false, idempotent: true });
    return refuse("NOT_FOUND", `No pending manual terms acceptance request ${id}`);
  }
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Manual terms acceptance", "approved", id);
  return ok({ requestId: id, changed: true, status: "APPROVED" });
}

async function manualTermsAcceptanceReject(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return refuse("REQUEST_ID_REQUIRED", "Pick the request.");
  if (!reason) return refuse("REASON_REQUIRED", "Say why this cannot be accepted as-is.");
  const rows = await query<{ id: string; branch: string }>(
    `update manual_terms_acceptance_requests set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [id, who(session), reason],
  );
  if (!rows.length) return refuse("NOT_FOUND", `No pending manual terms acceptance request ${id}`);
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Manual terms acceptance", "rejected — see the reason", id);
  return ok({ requestId: id, changed: true, status: "REJECTED" });
}

/**
 * Terms links used to need a staff member to press "Generate parent link"
 * before one existed. Reading this status is itself the trigger now — an
 * operational student with no accepted terms and no still-open link gets
 * one minted right here, lazily, the same shape as the dormancy sweep
 * (no cron, computed the moment the screen that needs it is opened).
 */
async function termsStatusForStudent(arg: Record<string, unknown>, scope: BranchScope, session: RpcSession): Promise<Result> {
  const studentId = s(arg["studentId"]).trim();
  if (!studentId) return refuse("STUDENT_ID_REQUIRED", "Pick the student.");
  const student = await queryOne<{ name: string; branch: string; status: string }>(`select name, branch, status from students_acad where id = $1`, [studentId]);
  if (!student) return refuse("STUDENT_NOT_FOUND", `No student ${studentId}`);
  const branch = recordBranch(student.branch);
  if (!inScope(scope, branch)) return branchForbidden(branch);

  const alreadySettled = await queryOne<{ n: number }>(
    `select count(*)::int as n from (
       select 1 from terms_acceptance_tokens where student_id = $1 and status = 'ACCEPTED'
       union all
       select 1 from manual_terms_acceptance_requests where student_id = $1 and status = 'APPROVED'
     ) t`,
    [studentId],
  );
  const open = await query<{ id: string }>(
    `select token as id from terms_acceptance_tokens where student_id = $1 and status = 'OPEN' and expires_at > now()`,
    [studentId],
  );
  if (!NOT_OPERATIONAL.has(s(student.status).toUpperCase()) && !(alreadySettled?.n ?? 0) && open.length === 0) {
    const token = randomBytes(24).toString("hex");
    await query(
      `insert into terms_acceptance_tokens (token, student_id, issued_by, expires_at) values ($1,$2,$3, now() + ($4::int * interval '1 day'))`,
      [token, studentId, who(session), TERMS_TOKEN_TTL_DAYS],
    );
  }

  const [tokens, manual] = await Promise.all([
    query<Record<string, unknown>>(
      `select token, status, issued_at::text, expires_at::text, accepted_at::text from terms_acceptance_tokens
       where student_id = $1 order by issued_at desc limit 5`,
      [studentId],
    ),
    query<Record<string, unknown>>(
      `select id, status, reason, submitted_at::text, decided_at::text from manual_terms_acceptance_requests
       where student_id = $1 order by submitted_at desc limit 5`,
      [studentId],
    ),
  ]);
  const domain = (process.env.APP_DOMAIN ?? "").trim();
  const base = domain ? `https://${domain.replace(/^https?:\/\//, "").replace(/\/+$/, "")}` : "";
  return ok({
    tokens: tokens.map((r) => ({
      token: s(r.token),
      status: s(r.status),
      issuedAt: s(r.issued_at),
      expiresAt: s(r.expires_at),
      acceptedAt: s(r.accepted_at),
      url: base ? `${base}/terms/${s(r.token)}` : "",
    })),
    manualRequests: manual.map((r) => ({ requestId: s(r.id), status: s(r.status), reason: s(r.reason), submittedAt: s(r.submitted_at), decidedAt: s(r.decided_at) })),
  });
}

// ---------------------------------------------------------------- staff access (self-service token registration)
async function listAuthorizedEmails(): Promise<Result> {
  const rows = await query<Record<string, unknown>>(
    `select email, role, branches, added_by, added_at::text, note from authorized_emails order by added_at desc`,
  );
  return ok({
    rows: rows.map((r) => ({
      email: s(r.email),
      role: s(r.role),
      branches: s(r.branches),
      addedBy: s(r.added_by),
      addedAt: s(r.added_at),
      note: s(r.note),
    })),
  });
}

async function addAuthorizedEmail(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const email = normalizeEmail(arg["email"]);
  if (!isValidEmail(email)) return refuse("BAD_EMAIL", "Enter a valid email address.");
  const branches = s(arg["branches"]).trim().toUpperCase() || null;
  await query(
    `insert into authorized_emails (email, role, branches, added_by, note) values ($1,'OPS_USER',$2,$3,$4)
     on conflict (email) do update set branches = excluded.branches, note = excluded.note`,
    [email, branches, who(session), s(arg["note"]).trim() || null],
  );
  return ok({ email, changed: true, note: "This email can now register its own token." });
}

async function removeAuthorizedEmail(arg: Record<string, unknown>): Promise<Result> {
  const email = normalizeEmail(arg["email"]);
  if (!email) return refuse("EMAIL_REQUIRED", "Pick the email to remove.");
  await query(`delete from authorized_emails where email = $1`, [email]);
  // Removing access must also end any session already issued to it —
  // otherwise a removed person keeps working until someone remembers to
  // revoke their device separately.
  await query(`update device_tokens set revoked_at = now() where email = $1 and revoked_at is null`, [email]);
  // And any OTP already emailed to them must stop being usable too — the
  // verify endpoint re-checks the allow-list at mint time regardless, but
  // consuming it here means a stale code fails immediately, not silently.
  await query(`update email_otps set consumed_at = now() where email = $1 and consumed_at is null`, [email]);
  return ok({ email, changed: true, note: "Access removed and any active token revoked." });
}

/** A live token unused this long is flagged stale — surfaced for the founder to notice, never auto-revoked (revocation stays a deliberate click). */
const STALE_TOKEN_AFTER_DAYS = 90;

async function listStaffTokens(): Promise<Result> {
  const rows = await query<Record<string, unknown>>(
    `select id, role, label, email, branches, created_at::text, last_used_at::text, revoked_at::text,
            (revoked_at is null and coalesce(last_used_at, created_at) <= now() - ($1::int * interval '1 day')) as stale
     from device_tokens order by created_at desc`,
    [STALE_TOKEN_AFTER_DAYS],
  );
  return ok({
    rows: rows.map((r) => ({
      id: s(r.id),
      role: s(r.role),
      label: s(r.label),
      email: s(r.email),
      branches: s(r.branches),
      createdAt: s(r.created_at),
      lastUsedAt: s(r.last_used_at),
      revokedAt: s(r.revoked_at),
      stale: r.stale === true,
    })),
  });
}

async function revokeDeviceToken(arg: Record<string, unknown>): Promise<Result> {
  const id = s(arg["id"]).trim();
  if (!id) return refuse("DEVICE_ID_REQUIRED", "Pick the device to revoke.");
  const rows = await query<{ id: string }>(
    `update device_tokens set revoked_at = now() where id = $1 and revoked_at is null returning id`,
    [id],
  );
  if (!rows.length) return refuse("NOT_FOUND", `No active device ${id}`);
  return ok({ id, changed: true, note: "That device is locked out immediately." });
}

// ---------------------------------------------------------------- approvals feed
/** Items for the founder approvals centre. */
export async function governanceApprovalItems(): Promise<{
  corrections: Result[];
  invoices: Result[];
  packageExtensions: Result[];
  paymentProfileChanges: Result[];
  closures: Result[];
  classCorrections: Result[];
  lateFeeWaivers: Result[];
  instalmentPlans: Result[];
  manualTermsAcceptances: Result[];
  teacherAddRequests: Result[];
}> {
  const [corrections, invoices, packageExtensions, paymentProfileChanges, closures, classCorrections, lateFeeWaivers, instalmentPlans, manualTermsAcceptances, teacherAddRequests] = await Promise.all([
    query<Record<string, unknown>>(
      `select c.id, c.receipt_no, c.reason, c.branch, c.requested_by, c.requested_at::text, r.party_name, r.amount, r.payment_date::text
       from receipt_corrections c left join receipts r on r.receipt_no = c.receipt_no
       where c.status = 'SUBMITTED' order by c.requested_at`,
    ),
    query<Record<string, unknown>>(
      `select id, branch, class_name, amount, tenure, invoice_date::text, submitted_by, submitted_at::text, notes
       from school_invoice_drafts where status = 'SUBMITTED' order by submitted_at`,
    ),
    query<Record<string, unknown>>(
      `select p.id, p.student_id, p.extra_months, p.reason, p.branch, p.submitted_at::text, s.name as student_name
       from package_extension_requests p left join students_acad s on s.id = p.student_id
       where p.status = 'SUBMITTED' order by p.submitted_at`,
    ),
    query<Record<string, unknown>>(
      `select id, entity_id, requested_label, reason, branch, submitted_at::text
       from payment_profile_change_requests where status = 'SUBMITTED' order by submitted_at`,
    ),
    query<Record<string, unknown>>(
      `select id, scope, branch, from_date::text, to_date::text, reason, backdated, recorded_at::text
       from closure_calendar where state = 'PROPOSED' order by recorded_at`,
    ),
    query<Record<string, unknown>>(
      `select id, event_id, reason, branch, prior_outcome, requested_at::text
       from class_outcome_corrections where status = 'SUBMITTED' order by requested_at`,
    ),
    query<Record<string, unknown>>(
      `select w.id, w.student_id, w.waived_amount, w.reason, w.branch, w.submitted_at::text, s.name as student_name
       from late_fee_waiver_requests w left join students_acad s on s.id = w.student_id
       where w.status = 'SUBMITTED' order by w.submitted_at`,
    ),
    query<Record<string, unknown>>(
      `select id, student_id, student_name, total_amount, instalment_count, branch, notes, submitted_at::text
       from instalment_plan_drafts where status = 'SUBMITTED' order by submitted_at`,
    ),
    query<Record<string, unknown>>(
      `select m.id, m.student_id, m.reason, m.branch, m.submitted_at::text, s.name as student_name
       from manual_terms_acceptance_requests m left join students_acad s on s.id = m.student_id
       where m.status = 'SUBMITTED' order by m.submitted_at`,
    ),
    query<Record<string, unknown>>(
      `select id, action, teacher_id, teacher_name, phone, primary_role, branch, submitted_at::text, lifecycle_status, status_reason
       from teacher_add_requests where status = 'SUBMITTED' order by submitted_at`,
    ),
  ]);
  return {
    corrections: corrections.map((r) => ({
      type: "RECEIPT_CORRECTION",
      itemId: s(r.id),
      entity: `${s(r.receipt_no)} · ${s(r.party_name)}`,
      studentId: "",
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: "",
      amount: s(r.amount),
      branch: s(r.branch),
      date: d(r.requested_at),
      reason: s(r.reason),
      flags: { backdated: false, incomplete: false, junk: false },
      termsStatus: "",
      receiptNo: s(r.receipt_no),
      actions: ["details", "void", "reject"],
    })),
    invoices: invoices.map((r) => ({
      type: "SCHOOL_INVOICE_DRAFT",
      itemId: s(r.id),
      entity: s(r.class_name),
      studentId: "",
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: s(r.tenure),
      amount: s(r.amount),
      branch: s(r.branch),
      date: d(r.invoice_date) || d(r.submitted_at),
      reason: s(r.notes) || "school invoice",
      flags: { backdated: false, incomplete: false, junk: false },
      termsStatus: "",
      actions: ["details", "finalise", "reject"],
    })),
    packageExtensions: packageExtensions.map((r) => ({
      type: "PACKAGE_EXTENSION",
      itemId: s(r.id),
      entity: s(r.student_name) || s(r.student_id),
      studentId: s(r.student_id),
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: `${s(r.extra_months)} month(s)`,
      amount: "",
      branch: s(r.branch),
      date: d(r.submitted_at),
      reason: s(r.reason),
      flags: { backdated: false, incomplete: false, junk: false },
      termsStatus: "",
      actions: ["details", "approve", "reject"],
    })),
    paymentProfileChanges: paymentProfileChanges.map((r) => ({
      type: "PAYMENT_PROFILE_CHANGE",
      itemId: s(r.id),
      entity: `${s(r.entity_id)} → ${s(r.requested_label)}`,
      studentId: "",
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: "",
      amount: "",
      branch: s(r.branch),
      date: d(r.submitted_at),
      reason: s(r.reason),
      flags: { backdated: false, incomplete: false, junk: false },
      termsStatus: "",
      actions: ["details", "approve", "reject"],
    })),
    closures: closures.map((r) => ({
      type: "CLOSURE",
      itemId: s(r.id),
      entity: s(r.scope) === "ACADEMY" ? "Whole academy" : s(r.branch),
      studentId: "",
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: `${s(r.from_date)} – ${s(r.to_date)}`,
      amount: "",
      branch: s(r.branch),
      date: d(r.recorded_at),
      reason: s(r.reason),
      flags: { backdated: r.backdated === true, incomplete: false, junk: false },
      termsStatus: "",
      actions: ["details", "approve", "reject"],
    })),
    classCorrections: classCorrections.map((r) => ({
      type: "CLASS_CORRECTION",
      itemId: s(r.id),
      entity: s(r.event_id),
      studentId: "",
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: s(r.prior_outcome),
      amount: "",
      branch: s(r.branch),
      date: d(r.requested_at),
      reason: s(r.reason),
      flags: { backdated: false, incomplete: false, junk: false },
      termsStatus: "",
      actions: ["details", "approve", "reject"],
    })),
    lateFeeWaivers: lateFeeWaivers.map((r) => ({
      type: "LATE_FEE_WAIVER",
      itemId: s(r.id),
      entity: s(r.student_name) || s(r.student_id),
      studentId: s(r.student_id),
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: "",
      amount: s(r.waived_amount),
      branch: s(r.branch),
      date: d(r.submitted_at),
      reason: s(r.reason),
      flags: { backdated: false, incomplete: false, junk: false },
      termsStatus: "",
      actions: ["details", "approve", "reject"],
    })),
    instalmentPlans: instalmentPlans.map((r) => ({
      type: "INSTALMENT_PLAN",
      itemId: s(r.id),
      entity: s(r.student_name) || s(r.student_id),
      studentId: s(r.student_id),
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: `${s(r.instalment_count)} instalments`,
      amount: s(r.total_amount),
      branch: s(r.branch),
      date: d(r.submitted_at),
      reason: s(r.notes) || "instalment plan",
      flags: { backdated: false, incomplete: false, junk: false },
      termsStatus: "",
      actions: ["details", "approve", "reject"],
    })),
    manualTermsAcceptances: manualTermsAcceptances.map((r) => ({
      type: "MANUAL_TERMS_ACCEPTANCE",
      itemId: s(r.id),
      entity: s(r.student_name) || s(r.student_id),
      studentId: s(r.student_id),
      noStudentLinked: false,
      paymentMode: "",
      feesPeriod: "",
      amount: "",
      branch: s(r.branch),
      date: d(r.submitted_at),
      reason: s(r.reason),
      flags: { backdated: false, incomplete: false, junk: false },
      termsStatus: "",
      actions: ["details", "approve", "reject"],
    })),
    teacherAddRequests: teacherAddRequests.map((r) => {
      const isEdit = s(r.action) === "EDIT";
      const isDelete = isEdit && s(r.lifecycle_status) === "LEFT";
      const reason = isDelete
        ? `Remove teacher: ${s(r.status_reason) || "no reason given"}`
        : isEdit
          ? [s(r.primary_role), s(r.phone)].filter(Boolean).join(" · ") || "edit request"
          : [s(r.primary_role), s(r.phone)].filter(Boolean).join(" · ") || "new teacher";
      return {
        type: isEdit ? "TEACHER_EDIT_REQUEST" : "TEACHER_ADD_REQUEST",
        itemId: s(r.id),
        entity: s(r.teacher_name),
        studentId: "",
        noStudentLinked: false,
        paymentMode: "",
        feesPeriod: "",
        amount: "",
        branch: s(r.branch),
        date: d(r.submitted_at),
        reason,
        flags: { backdated: false, incomplete: !isEdit && !s(r.phone), junk: false },
        termsStatus: "",
        actions: ["details", "approve", "reject"],
      };
    }),
  };
}
