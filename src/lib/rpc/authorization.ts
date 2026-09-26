import type { RpcRole, RpcSession } from "@/lib/rpc/auth";
import { makeScope, type BranchScope } from "./scope.ts";

// ============================================================
// CENTRALIZED RPC AUTHORIZATION (fail-closed)
//
// Every RPC function exposed through POST /api/rpc must have EXACTLY ONE
// entry in ALLOWED_BY. If a function is missing from the map, or a role is
// below the required one, the request is rejected BEFORE the handler runs.
//
// Role hierarchy:  FOUNDER_ADMIN >= OPS_USER.
//   - FOUNDER_ADMIN may call anything.
//   - OPS_USER may call only entries marked OPS_USER.
//
// This is the PRIMARY authorization boundary. Handlers never re-audit role
// beyond what the policy already guarantees. Unknown functions fail closed.
// ============================================================

export type RequiredRole = "FOUNDER" | "STAFF";

const ROLE_RANK: Record<RpcRole, number> = { FOUNDER_ADMIN: 2, OPS_USER: 1 };

export const STAFF = "STAFF" as const;
export const FOUNDER = "FOUNDER" as const;

/**
 * Every RPC function the gateway may execute, with the minimum role required.
 * Derived from:
 *  - function name (api_founder_* = founder-only, api_staff_* = staff)
 *  - Flutter shared screens that branch on the staff flag
 *  - money/financial business rules (founder === money authority)
 *  - existing ApiService + demo_api + shell nav usage
 */
export const RPC_POLICY: Record<string, RequiredRole> = {
  // ------------------------------------------------------------ boot
  api_bootstrap: FOUNDER,
  api_staff_boot: STAFF,

  // ---------------------------------------------------------- students
  // api_searchStudent / api_studentProfile: founder surface; staff has
  // dedicated api_staff_* equivalents.
  api_searchStudent: FOUNDER,
  // Read-only and branch-scoped in the handler; the staff profile screen calls it too.
  api_studentProfile: STAFF,
  api_staff_searchStudents: STAFF,
  api_staff_getStudentProfile: STAFF,
  api_staff_studentHub: STAFF,
  api_staff_saveStudentDraft: STAFF,
  // api_addStudent is founder-only (staff drafts, founder merges).
  api_addStudent: FOUNDER,
  api_founder_setStudentStatus: FOUNDER,
  api_founder_mergeStudentDraft: FOUNDER,
  api_founder_studentDraftReject: FOUNDER,

  // -------------------------------------------------- receipts / money
  // Money creation/approval/finalisation = founder.
  api_addFeePayment: FOUNDER,
  api_receiptPreflight: FOUNDER,
  api_founder_listPaymentDrafts: FOUNDER,
  api_founder_paymentDraftApprove: FOUNDER,
  api_founder_paymentDraftReject: FOUNDER,
  api_founder_finalisePaymentDraft: FOUNDER,
  // Staff can SEARCH receipts (shared receipts screen), propose drafts, and
  // execute a founder-APPROVED draft's finalisation where the backend allows.
  api_searchReceipt: STAFF,
  api_staff_prepareReceiptDraft: STAFF,
  api_staff_finalisePaymentDraft: STAFF,

  // ---------------------------------------------------------- dashboard
  // Shared dashboard shell (both roles see operational + collection figures).
  api_dashboard: STAFF,
  api_dueReminders: STAFF,

  // ------------------------------------------------------------ teachers
  // Teacher list/profile are read surfaces reachable from both shells.
  api_listTeachers: STAFF,
  api_teacherProfile: STAFF,
  // Teacher WRITES + payouts = founder only.
  api_addTeacher: FOUNDER,
  api_staff_requestAddTeacher: STAFF,
  api_founder_addTeacherRequestApprove: FOUNDER,
  api_founder_addTeacherRequestReject: FOUNDER,
  api_teacherAttendanceReport: STAFF,
  api_updateTeacherStatus: FOUNDER,
  api_updateTeacherCompensation: FOUNDER,
  api_teacherPayoutPreview: FOUNDER,
  // Paying a teacher is money leaving the academy: founder only.
  api_recordTeacherPayout: FOUNDER,
  api_teacherPayoutHistory: FOUNDER,
  // Deciding how a shared student's fee splits between teachers.
  api_assignSharedStudent: FOUNDER,

  // ------------------------------------------------- cashbook / expenses
  // Staff submits an expense DRAFT; founder records real expense + ledger read.
  api_cashbookReport: STAFF,
  api_staff_submitExpenseDraft: STAFF,
  api_addExpenseEntry: FOUNDER,
  // Founder decides on a staff expense draft.
  api_founder_expenseDraftApprove: FOUNDER,
  api_founder_expenseDraftReject: FOUNDER,

  // ------------------------------------------------------- school invoices
  // Brief P11: only the founder allocates an SMI- number. Staff send a draft.
  api_generateSchoolInvoice: FOUNDER,
  api_staff_submitSchoolInvoiceDraft: STAFF,
  api_founder_finaliseSchoolInvoiceDraft: FOUNDER,
  api_founder_schoolInvoiceDraftReject: FOUNDER,
  api_listSchoolInvoices: STAFF,
  api_getSchoolInvoice: STAFF,

  // Brief §2.2: staff propose a package extension or a payment-profile
  // change; only the founder decides.
  api_staff_submitPackageExtensionRequest: STAFF,
  api_founder_packageExtensionApprove: FOUNDER,
  api_founder_packageExtensionReject: FOUNDER,
  api_staff_submitPaymentProfileChangeRequest: STAFF,
  api_founder_paymentProfileChangeApprove: FOUNDER,
  api_founder_paymentProfileChangeReject: FOUNDER,

  // Brief §P6.6/§6.8: staff record a closure as PROPOSED; only the founder
  // authorises or revokes it.
  api_staff_proposeClosure: STAFF,
  api_founder_authoriseClosure: FOUNDER,
  api_founder_closureReject: FOUNDER,
  api_founder_revokeClosure: FOUNDER,
  api_closureCalendarList: STAFF,

  // Brief §14.1 (Ruling C.5): a class answered once cannot be re-answered
  // directly; staff request a correction, only the founder approves it.
  api_staff_requestClassCorrection: STAFF,
  api_founder_approveClassCorrection: FOUNDER,
  api_founder_rejectClassCorrection: FOUNDER,

  // Brief §2.2: staff propose a late-fee waiver; only the founder decides.
  api_staff_submitLateFeeWaiverRequest: STAFF,
  api_founder_lateFeeWaiverApprove: FOUNDER,
  api_founder_lateFeeWaiverReject: FOUNDER,

  // Brief §6.1/§2.6: staff propose an instalment plan; only the founder
  // creates the real schedule.
  api_staff_submitInstalmentPlanDraft: STAFF,
  api_founder_instalmentPlanDraftApprove: FOUNDER,
  api_founder_instalmentPlanDraftReject: FOUNDER,
  api_instalmentPlanForStudent: STAFF,

  // Brief §P10: staff mint a one-time terms token, or request a manual
  // acceptance the founder must decide.
  api_staff_generateTermsToken: STAFF,
  api_staff_requestManualTermsAcceptance: STAFF,
  api_founder_manualTermsAcceptanceApprove: FOUNDER,
  api_founder_manualTermsAcceptanceReject: FOUNDER,
  api_termsStatusForStudent: STAFF,

  // Self-service email+OTP token registration/reset (src/app/api/auth/otp/*
  // handles the OTP round trip itself, outside this RPC gateway entirely —
  // these are the founder-only management functions over the allow-list and
  // the issued device_tokens rows).
  api_founder_listAuthorizedEmails: FOUNDER,
  api_founder_addAuthorizedEmail: FOUNDER,
  api_founder_removeAuthorizedEmail: FOUNDER,
  api_founder_listStaffTokens: FOUNDER,
  api_founder_revokeDeviceToken: FOUNDER,

  // ------------------------------------------------------------ timetable
  // Founder request 2026-09-26: staff can add/edit/delete timetable slots
  // too, not just read them (was founder-only under brief P6.1).
  api_timetableList: STAFF,
  api_timetableCreate: STAFF,
  api_timetableUpdate: STAFF,
  api_timetableDelete: STAFF,

  // ------------------------------------------------- periods / corrections
  // Brief §11.7, P6.7: closing a service month is founder-only.
  api_founder_periodLocks: FOUNDER,
  api_founder_closeMonth: FOUNDER,
  // Pattern C: staff ask for a correction; the founder voids.
  api_staff_requestReceiptCorrection: STAFF,
  api_founder_voidReceipt: FOUNDER,
  api_founder_correctionReject: FOUNDER,

  // ------------------------------------------------------ attendance/today
  api_staff_attendanceRoster: STAFF,
  api_staff_markAttendance: STAFF,
  api_staff_todaysTasks: STAFF,
  api_staff_doToday: STAFF,
  api_staff_todaysClasses: STAFF,
  api_staff_resolveTodaysClass: STAFF,
  api_staff_scheduleSession: STAFF,
  api_staff_sessionRoster: STAFF,
  api_staff_feeDueList: STAFF,

  // ------------------------------------------------------------- inquiries
  api_staff_inquiryQueue: STAFF,
  api_staff_inquiryQuickAdd: STAFF,
  api_staff_inquiryTransition: STAFF,
  api_staff_inquiryDetail: STAFF,

  // -------------------------------------------------------------- approvals
  api_founder_approvalsList: FOUNDER, // founder approval centre
  api_founder_approvalItemDetail: FOUNDER, // full record behind any approval card, read-only
  // Who did what: founder-only, read-only.
  api_founder_auditLog: FOUNDER,
  api_staff_listMyApprovals: STAFF, // staff sees own requests only

  // -------------------------------------------------------------- comm
  api_staff_commGenerate: STAFF,
  // WhatsApp via the WA-AKG gateway: one human click, one message, to the
  // student's registered number. Opt-outs are founder-managed.
  api_staff_sendWhatsApp: STAFF,
  api_staff_sendWhatsAppDocument: STAFF,
  api_staff_messageHistory: STAFF,
  api_whatsappStatus: STAFF,
  api_founder_whatsappOptOut: FOUNDER,

  // -------------------------------------------------------------- sync
  // Revision sync is used by both shells on their own entity sets.
  api_syncChanges: STAFF,

  // ---------------------------------------------------------------- push
  // Registering/unregistering a device's own push token is not a business
  // action — both roles may call it for themselves.
  api_registerPushToken: STAFF,
  api_unregisterPushToken: STAFF,
  api_pushStatus: STAFF,
  // Founder-only: this is the endpoint an external cron calls once a day
  // (with the founder token) to fire the fees due/overdue reminder.
  api_founder_sendDailyDigest: FOUNDER,
};

export interface AuthzResult {
  ok: boolean;
  code: "ROLE_FORBIDDEN" | "UNKNOWN_API" | "BRANCH_FORBIDDEN";
  required?: RequiredRole;
  message?: string;
}

/** True when the session role satisfies the policy's required role. */
export function satisfiesRole(sessionRole: RpcRole, required: RequiredRole): boolean {
  const requiredRank = required === "FOUNDER" ? 2 : 1;
  return ROLE_RANK[sessionRole] >= requiredRank;
}

/**
 * Fail-closed authorization gate. Returns ok only when:
 *  - the function exists in RPC_POLICY, AND
 *  - the authenticated role meets the required role.
 * Unknown functions return UNKNOWN_API (never executed).
 */
export function authorizeRpc(session: RpcSession, functionName: string): AuthzResult {
  const required = RPC_POLICY[functionName];
  if (!required) {
    return { ok: false, code: "UNKNOWN_API", message: `No policy for ${functionName}` };
  }
  if (!satisfiesRole(session.role, required)) {
    return {
      ok: false,
      code: "ROLE_FORBIDDEN",
      required,
      message: `${session.role} is not allowed to call ${functionName} (requires ${required})`,
    };
  }
  return { ok: true, code: "ROLE_FORBIDDEN" as const };
}

// ============================================================
// BRANCH / ENTITY ISOLATION
//
// Separate axis from role. Staff must stay in their branch; founder may be
// broader. The session's branch allow-list comes from the token mapping
// (auth.ts). Client-supplied branch/entity/scope values are NEVER trusted
// for isolation — they are checked against the session's allowed branches.
// ============================================================

/**
 * Staff branches come only from RPC_STAFF_BRANCHES (e.g. "KANDIVALI" or
 * "GOREGAON,KANDIVALI"). Unset means NO branches — fail closed.
 */
export function roleAllowedBranches(role: RpcRole): string[] {
  if (role === "FOUNDER_ADMIN") return ["GOREGAON", "KANDIVALI"];
  const env = process.env.RPC_STAFF_BRANCHES || "";
  return env.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
}

/** Record-level scope handed to handlers (see scope.ts). */
export function scopeForSession(session: RpcSession): BranchScope {
  // A device token may carry its own allow-list; otherwise fall back to the
  // role default (founder: all, staff: RPC_STAFF_BRANCHES).
  if (session.role !== "FOUNDER_ADMIN" && session.branches?.length) {
    return makeScope(session.branches);
  }
  return makeScope(roleAllowedBranches(session.role));
}

/**
 * Functions that change data. Used for the audit trail, and to decide what is
 * worth recording; reads are not logged.
 */
export const WRITE_FUNCTIONS = new Set<string>([
  "api_addStudent", "api_staff_saveStudentDraft", "api_founder_setStudentStatus", "api_founder_mergeStudentDraft", "api_founder_studentDraftReject",
  "api_addFeePayment", "api_staff_prepareReceiptDraft",
  "api_founder_paymentDraftApprove", "api_founder_paymentDraftReject",
  "api_founder_finalisePaymentDraft", "api_staff_finalisePaymentDraft",
  "api_addTeacher", "api_staff_requestAddTeacher", "api_founder_addTeacherRequestApprove", "api_founder_addTeacherRequestReject",
  "api_updateTeacherStatus", "api_updateTeacherCompensation", "api_recordTeacherPayout", "api_assignSharedStudent",
  "api_addExpenseEntry", "api_staff_submitExpenseDraft",
  "api_founder_expenseDraftApprove", "api_founder_expenseDraftReject",
  "api_generateSchoolInvoice", "api_staff_submitSchoolInvoiceDraft", "api_founder_finaliseSchoolInvoiceDraft", "api_founder_schoolInvoiceDraftReject",
  "api_founder_closeMonth", "api_staff_requestReceiptCorrection", "api_founder_voidReceipt", "api_founder_correctionReject",
  "api_staff_submitPackageExtensionRequest", "api_founder_packageExtensionApprove", "api_founder_packageExtensionReject",
  "api_staff_submitPaymentProfileChangeRequest", "api_founder_paymentProfileChangeApprove", "api_founder_paymentProfileChangeReject",
  "api_staff_proposeClosure", "api_founder_authoriseClosure", "api_founder_closureReject", "api_founder_revokeClosure",
  "api_staff_requestClassCorrection", "api_founder_approveClassCorrection", "api_founder_rejectClassCorrection",
  "api_staff_submitLateFeeWaiverRequest", "api_founder_lateFeeWaiverApprove", "api_founder_lateFeeWaiverReject",
  "api_staff_submitInstalmentPlanDraft", "api_founder_instalmentPlanDraftApprove", "api_founder_instalmentPlanDraftReject",
  "api_staff_generateTermsToken", "api_staff_requestManualTermsAcceptance",
  "api_founder_manualTermsAcceptanceApprove", "api_founder_manualTermsAcceptanceReject",
  "api_founder_addAuthorizedEmail", "api_founder_removeAuthorizedEmail", "api_founder_revokeDeviceToken",
  "api_timetableCreate", "api_timetableUpdate", "api_timetableDelete",
  "api_staff_markAttendance", "api_staff_resolveTodaysClass", "api_staff_scheduleSession",
  "api_staff_inquiryQuickAdd", "api_staff_inquiryTransition",
  "api_staff_sendWhatsApp", "api_staff_sendWhatsAppDocument", "api_founder_whatsappOptOut",
]);

/**
 * Resolve the branch implied by an RPC argument (branch/scope/entityId).
 * Returns '' when the argument carries no enforceable branch (e.g. 'ALL').
 */
export function impliedBranch(arg: Record<string, unknown>): string {
  const v = (k: string) => {
    const x = arg[k];
    return x == null ? "" : String(x).toUpperCase();
  };
  const branch = v("branch");
  if (branch && branch !== "ALL") return branch;
  const scope = v("scope");
  if (scope && scope !== "ALL" && scope !== "CONSOLIDATED") return scope;
  const entity = v("entityId") || v("entity_id");
  if (entity) {
    if (entity.startsWith("ENT-GOREGAON")) return "GOREGAON";
    if (entity.startsWith("ENT-KANDIVALI")) return "KANDIVALI";
  }
  const classCode = v("classCode");
  if (classCode === "GMC") return "GOREGAON";
  if (classCode === "KMC") return "KANDIVALI";
  const location = v("location");
  if (location && location !== "ALL") return location;
  return "";
}

/**
 * Enforce branch isolation for a staff session. Founder is allowed all
 * branches by policy. Returns ok only when an implied branch is inside the
 * session's allowed set (or no branch is implied).
 */
export function authorizeBranch(session: RpcSession, arg: Record<string, unknown>): AuthzResult {
  if (session.role === "FOUNDER_ADMIN") return { ok: true, code: "BRANCH_FORBIDDEN" as const };
  const allowed = roleAllowedBranches(session.role);
  const implied = impliedBranch(arg);
  if (!implied) return { ok: true, code: "BRANCH_FORBIDDEN" as const };
  if (allowed.includes(implied)) return { ok: true, code: "BRANCH_FORBIDDEN" as const };
  return {
    ok: false,
    code: "BRANCH_FORBIDDEN",
    message: `OPS_USER is not authorised for branch ${implied} (allowed: ${allowed.join(", ")})`,
  };
}