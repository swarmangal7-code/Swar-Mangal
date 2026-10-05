import { test } from "node:test";
import assert from "node:assert/strict";

// Staff branches are fail-closed: set the env the deployment uses before import.
process.env.RPC_STAFF_BRANCHES = "GOREGAON,KANDIVALI";

import { authorizeRpc, authorizeBranch, roleAllowedBranches, scopeForSession, WRITE_FUNCTIONS, RPC_POLICY } from "../src/lib/rpc/authorization.ts";
import type { RpcRole } from "../src/lib/rpc/auth.ts";

const session = (role: RpcRole) =>
  ({ role, email: role === "FOUNDER_ADMIN" ? "sharvil87@gmail.com" : "smmahavirnagar@gmail.com", name: role }) as const;

const founder = session("FOUNDER_ADMIN");
const staff = session("OPS_USER");

test("authorizeRpc: founder -> founder gateway boot allowed", () => {
  const r = authorizeRpc(founder, "api_bootstrap");
  assert.equal(r.ok, true);
});

test("authorizeRpc: founder -> every founder+staff policy entry allowed", () => {
  for (const [fn] of Object.entries(RPC_POLICY)) {
    const r = authorizeRpc(founder, fn);
    assert.equal(r.ok, true, `${fn} should be allowed for FOUNDER_ADMIN`);
  }
});

test("authorizeRpc: staff -> legitimate staff endpoint allowed", () => {
  const r = authorizeRpc(staff, "api_staff_searchStudents");
  assert.equal(r.ok, true);
  const r2 = authorizeRpc(staff, "api_staff_todaysTasks");
  assert.equal(r2.ok, true);
});

test("authorizeRpc: staff -> api_teacherPayoutPreview ROLE_FORBIDDEN and handler NOT called", () => {
  let handlerRan = false;
  const r = authorizeRpc(staff, "api_teacherPayoutPreview");
  assert.equal(r.ok, false);
  assert.equal(r.code, "ROLE_FORBIDDEN");
  assert.equal(handlerRan, false); // guard: we never even reach handler path
});

test("authorizeRpc: staff -> api_updateTeacherCompensation ROLE_FORBIDDEN", () => {
  const r = authorizeRpc(staff, "api_updateTeacherCompensation");
  assert.equal(r.ok, false);
  assert.equal(r.code, "ROLE_FORBIDDEN");
});

test("authorizeRpc: staff -> api_addTeacher ROLE_FORBIDDEN", () => {
  const r = authorizeRpc(staff, "api_addTeacher");
  assert.equal(r.ok, false);
  assert.equal(r.code, "ROLE_FORBIDDEN");
});

// The timetable used to be founder-only ("staff read it"). It is now a real
// weekly calendar that both roles maintain — TimetablePolicy.canEdit is true
// for staff and the web/app staff screens both expose create/edit/delete, so
// the policy matches. Branch scope is still enforced separately by the handler.
for (const fn of ["api_timetableCreate", "api_timetableUpdate", "api_timetableDelete"]) {
  test(`authorizeRpc: staff may ${fn}, and so may the founder`, () => {
    assert.equal(authorizeRpc(staff, fn).ok, true);
    assert.equal(authorizeRpc(founder, fn).ok, true);
  });
}

test("authorizeRpc: staff reads the timetable", () => {
  assert.equal(authorizeRpc(staff, "api_timetableList").ok, true);
});

// Brief P11: only the founder allocates an SMI- number; staff send a draft.
test("authorizeRpc: staff cannot issue a school invoice, only propose one", () => {
  assert.equal(authorizeRpc(staff, "api_generateSchoolInvoice").ok, false);
  assert.equal(authorizeRpc(staff, "api_founder_finaliseSchoolInvoiceDraft").ok, false);
  assert.equal(authorizeRpc(staff, "api_staff_submitSchoolInvoiceDraft").ok, true);
  assert.equal(authorizeRpc(founder, "api_founder_finaliseSchoolInvoiceDraft").ok, true);
});

// Pattern C and §11.7: voids and month closes are founder decisions.
test("authorizeRpc: staff request corrections; only the founder voids or closes a month", () => {
  assert.equal(authorizeRpc(staff, "api_staff_requestReceiptCorrection").ok, true);
  for (const fn of ["api_founder_voidReceipt", "api_founder_correctionReject", "api_founder_closeMonth", "api_founder_periodLocks"]) {
    assert.equal(authorizeRpc(staff, fn).ok, false, fn);
    assert.equal(authorizeRpc(founder, fn).ok, true, fn);
  }
});

test("authorizeRpc: staff -> founder approval endpoint ROLE_FORBIDDEN", () => {
  const r = authorizeRpc(staff, "api_founder_approvalsList");
  assert.equal(r.ok, false);
  assert.equal(r.code, "ROLE_FORBIDDEN");
});

test("authorizeRpc: staff -> founder financial finalisation ROLE_FORBIDDEN", () => {
  const r = authorizeRpc(staff, "api_founder_finalisePaymentDraft");
  assert.equal(r.ok, false);
  assert.equal(r.code, "ROLE_FORBIDDEN");
});

test("authorizeRpc: staff -> founder expense write ROLE_FORBIDDEN", () => {
  const r = authorizeRpc(staff, "api_addExpenseEntry");
  assert.equal(r.ok, false);
});

test("unknown function with valid token -> UNKNOWN_API (fail closed)", () => {
  const r = authorizeRpc(founder, "api_doesNotExist");
  assert.equal(r.ok, false);
  assert.equal(r.code, "UNKNOWN_API");
});

test("every policy entry has founder/staff value", () => {
  for (const [fn, req] of Object.entries(RPC_POLICY)) {
    assert.ok(fn.startsWith("api_"), fn);
    assert.ok(req === "FOUNDER" || req === "STAFF", fn);
  }
});

// ---------------- branch isolation ----------------
test("authorizeBranch: founder allowed any branch", () => {
  const r = authorizeBranch(founder, { branch: "GOREGAON" });
  assert.equal(r.ok, true);
});

test("authorizeBranch: staff allowed configured branch", () => {
  const r = authorizeBranch(staff, { branch: "KANDIVALI" });
  assert.equal(r.ok, true);
});

test("authorizeBranch: staff denied unknown branch", () => {
  const r = authorizeBranch(staff, { branch: "SURAT" });
  assert.equal(r.ok, false);
  assert.equal(r.code, "BRANCH_FORBIDDEN");
});

test("authorizeBranch: staff entityId entity isolation", () => {
  const g = authorizeBranch(staff, { entityId: "ENT-GOREGAON" });
  assert.equal(g.ok, true);
  const k = authorizeBranch(staff, { entityId: "ENT-KANDIVALI" });
  assert.equal(k.ok, true);
});

test("authorizeBranch: staff classCode maps to branch", () => {
  const r = authorizeBranch(staff, { classCode: "GMC" });
  assert.equal(r.ok, true);
});

test("authorizeBranch: scope ALL is not branch-gated", () => {
  const r = authorizeBranch(staff, { scope: "ALL" });
  assert.equal(r.ok, true);
});

test("authorizeBranch: founder bypasses branch allow-list entirely", () => {
  const r = authorizeBranch(founder, { branch: "SOME_OTHER" });
  assert.equal(r.ok, true);
});
test("roleAllowedBranches: staff comes from env, founder gets everything", () => {
  assert.deepEqual(roleAllowedBranches("FOUNDER_ADMIN"), ["GOREGAON", "KANDIVALI"]);
  process.env.RPC_STAFF_BRANCHES = "KANDIVALI";
  assert.deepEqual(roleAllowedBranches("OPS_USER"), ["KANDIVALI"]);
  process.env.RPC_STAFF_BRANCHES = "GOREGAON,KANDIVALI";
});

test("roleAllowedBranches: unset env means no staff branches (fail closed)", () => {
  const saved = process.env.RPC_STAFF_BRANCHES;
  delete process.env.RPC_STAFF_BRANCHES;
  assert.deepEqual(roleAllowedBranches("OPS_USER"), []);
  // Founder is unaffected.
  assert.deepEqual(roleAllowedBranches("FOUNDER_ADMIN"), ["GOREGAON", "KANDIVALI"]);
  process.env.RPC_STAFF_BRANCHES = saved;
});

test("authorizeBranch: staff restricted to one branch is denied the other", () => {
  const saved = process.env.RPC_STAFF_BRANCHES;
  process.env.RPC_STAFF_BRANCHES = "KANDIVALI";
  const denied = authorizeBranch(staff, { branch: "GOREGAON" });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "BRANCH_FORBIDDEN");
  assert.equal(authorizeBranch(staff, { branch: "KANDIVALI" }).ok, true);
  assert.equal(authorizeBranch(staff, { entityId: "ENT-GOREGAON" }).ok, false);
  assert.equal(authorizeBranch(staff, { classCode: "GMC" }).ok, false);
  process.env.RPC_STAFF_BRANCHES = saved;
});

// ---------------- device tokens ----------------
test("scopeForSession: a device's own branch list overrides the env default", () => {
  const saved = process.env.RPC_STAFF_BRANCHES;
  process.env.RPC_STAFF_BRANCHES = "GOREGAON,KANDIVALI";
  const device = { ...staff, deviceLabel: "Latika Pixel", branches: ["KANDIVALI"] };
  const scope = scopeForSession(device);
  assert.equal(scope.unrestricted, false);
  assert.deepEqual(scope.branches, ["KANDIVALI"]);
  // Without a device list it falls back to the env allow-list.
  assert.equal(scopeForSession({ ...staff, deviceLabel: "env:staff" }).unrestricted, true);
  process.env.RPC_STAFF_BRANCHES = saved;
});

test("scopeForSession: a founder device is never narrowed by a branch list", () => {
  const scope = scopeForSession({ ...founder, deviceLabel: "dev", branches: ["KANDIVALI"] });
  assert.equal(scope.unrestricted, true);
});

test("WRITE_FUNCTIONS covers every money-moving endpoint", () => {
  for (const fn of [
    "api_addFeePayment",
    "api_founder_finalisePaymentDraft",
    "api_staff_finalisePaymentDraft",
    "api_founder_paymentDraftApprove",
    "api_addExpenseEntry",
    "api_generateSchoolInvoice",
    "api_founder_finaliseSchoolInvoiceDraft",
    "api_founder_voidReceipt",
    "api_founder_closeMonth",
    "api_updateTeacherCompensation",
  ]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
  // Reads are not audited.
  for (const fn of ["api_dashboard", "api_searchStudent", "api_syncChanges", "api_timetableList"]) {
    assert.ok(!WRITE_FUNCTIONS.has(fn), `${fn} is a read`);
  }
  // Everything audited must exist in the policy.
  for (const fn of WRITE_FUNCTIONS) assert.ok(RPC_POLICY[fn], `${fn} missing from RPC_POLICY`);
});

test("the activity log is founder-only and read-only", () => {
  assert.equal(RPC_POLICY["api_founder_auditLog"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_founder_auditLog").ok, false);
  assert.equal(authorizeRpc(founder, "api_founder_auditLog").ok, true);
  // Reading the trail is not itself an audited write.
  assert.ok(!WRITE_FUNCTIONS.has("api_founder_auditLog"));
});

test("expense drafts: staff submit, founder decides", () => {
  assert.equal(RPC_POLICY["api_staff_submitExpenseDraft"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_expenseDraftApprove"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_expenseDraftReject"], "FOUNDER");
  // Staff may propose but never approve their own spending.
  assert.equal(authorizeRpc(staff, "api_staff_submitExpenseDraft").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_expenseDraftApprove").ok, false);
  assert.equal(authorizeRpc(staff, "api_addExpenseEntry").ok, false);
  // All three change data, so all three are audited.
  for (const fn of ["api_staff_submitExpenseDraft", "api_founder_expenseDraftApprove", "api_founder_expenseDraftReject"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
});

test("package extension requests: staff submit, founder decides", () => {
  assert.equal(RPC_POLICY["api_staff_submitPackageExtensionRequest"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_packageExtensionApprove"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_packageExtensionReject"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_staff_submitPackageExtensionRequest").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_packageExtensionApprove").ok, false);
  assert.equal(authorizeRpc(staff, "api_founder_packageExtensionReject").ok, false);
  for (const fn of ["api_staff_submitPackageExtensionRequest", "api_founder_packageExtensionApprove", "api_founder_packageExtensionReject"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
});

test("payment profile change requests: staff submit, founder decides", () => {
  assert.equal(RPC_POLICY["api_staff_submitPaymentProfileChangeRequest"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_paymentProfileChangeApprove"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_paymentProfileChangeReject"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_staff_submitPaymentProfileChangeRequest").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_paymentProfileChangeApprove").ok, false);
  assert.equal(authorizeRpc(staff, "api_founder_paymentProfileChangeReject").ok, false);
  for (const fn of ["api_staff_submitPaymentProfileChangeRequest", "api_founder_paymentProfileChangeApprove", "api_founder_paymentProfileChangeReject"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
});

test("closures: staff propose, founder authorises or revokes", () => {
  assert.equal(RPC_POLICY["api_staff_proposeClosure"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_authoriseClosure"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_closureReject"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_revokeClosure"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_staff_proposeClosure").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_authoriseClosure").ok, false);
  assert.equal(authorizeRpc(staff, "api_founder_revokeClosure").ok, false);
  for (const fn of ["api_staff_proposeClosure", "api_founder_authoriseClosure", "api_founder_closureReject", "api_founder_revokeClosure"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
});

test("class outcome corrections: staff request, founder decides", () => {
  assert.equal(RPC_POLICY["api_staff_requestClassCorrection"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_approveClassCorrection"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_rejectClassCorrection"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_staff_requestClassCorrection").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_approveClassCorrection").ok, false);
  for (const fn of ["api_staff_requestClassCorrection", "api_founder_approveClassCorrection", "api_founder_rejectClassCorrection"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
});

test("late-fee waivers: staff submit, founder decides", () => {
  assert.equal(RPC_POLICY["api_staff_submitLateFeeWaiverRequest"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_lateFeeWaiverApprove"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_lateFeeWaiverReject"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_staff_submitLateFeeWaiverRequest").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_lateFeeWaiverApprove").ok, false);
  for (const fn of ["api_staff_submitLateFeeWaiverRequest", "api_founder_lateFeeWaiverApprove", "api_founder_lateFeeWaiverReject"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
});

test("instalment plans: staff submit, founder decides", () => {
  assert.equal(RPC_POLICY["api_staff_submitInstalmentPlanDraft"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_instalmentPlanDraftApprove"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_instalmentPlanDraftReject"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_staff_submitInstalmentPlanDraft").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_instalmentPlanDraftApprove").ok, false);
  for (const fn of ["api_staff_submitInstalmentPlanDraft", "api_founder_instalmentPlanDraftApprove", "api_founder_instalmentPlanDraftReject"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
});

test("admission terms: staff mint tokens or request manual acceptance, founder decides the manual path", () => {
  assert.equal(RPC_POLICY["api_staff_generateTermsToken"], "STAFF");
  assert.equal(RPC_POLICY["api_staff_requestManualTermsAcceptance"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_manualTermsAcceptanceApprove"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_manualTermsAcceptanceReject"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_staff_generateTermsToken").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_manualTermsAcceptanceApprove").ok, false);
  for (const fn of ["api_staff_generateTermsToken", "api_staff_requestManualTermsAcceptance", "api_founder_manualTermsAcceptanceApprove", "api_founder_manualTermsAcceptanceReject"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
});

test("fee rate card: both staff and founder read and write (public-facing price list, not a founder-only money decision)", () => {
  assert.equal(RPC_POLICY["api_listFeeRateCard"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_upsertFeeRateCard"], "STAFF");
  assert.equal(RPC_POLICY["api_founder_deactivateFeeRateCard"], "STAFF");
  assert.equal(authorizeRpc(staff, "api_listFeeRateCard").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_upsertFeeRateCard").ok, true);
  assert.equal(authorizeRpc(staff, "api_founder_deactivateFeeRateCard").ok, true);
  assert.equal(authorizeRpc(founder, "api_founder_upsertFeeRateCard").ok, true);
  assert.equal(authorizeRpc(founder, "api_founder_deactivateFeeRateCard").ok, true);
  for (const fn of ["api_founder_upsertFeeRateCard", "api_founder_deactivateFeeRateCard"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
  assert.ok(!WRITE_FUNCTIONS.has("api_listFeeRateCard"), "reading is not itself an audited write");
});

test("sharing a Timetable/Fee Rate Card PDF to a hand-typed number is staff-level, same as the existing document send", () => {
  assert.equal(RPC_POLICY["api_staff_shareDocumentViaWhatsApp"], "STAFF");
  assert.equal(authorizeRpc(staff, "api_staff_shareDocumentViaWhatsApp").ok, true);
  assert.equal(authorizeRpc(founder, "api_staff_shareDocumentViaWhatsApp").ok, true);
  assert.ok(WRITE_FUNCTIONS.has("api_staff_shareDocumentViaWhatsApp"), "must be audited like every other WhatsApp send");
});

test("staff access management (email allow-list + issued device tokens): founder only", () => {
  assert.equal(RPC_POLICY["api_founder_listAuthorizedEmails"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_addAuthorizedEmail"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_removeAuthorizedEmail"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_listStaffTokens"], "FOUNDER");
  assert.equal(RPC_POLICY["api_founder_revokeDeviceToken"], "FOUNDER");
  assert.equal(authorizeRpc(staff, "api_founder_addAuthorizedEmail").ok, false);
  assert.equal(authorizeRpc(staff, "api_founder_revokeDeviceToken").ok, false);
  assert.equal(authorizeRpc(founder, "api_founder_addAuthorizedEmail").ok, true);
  for (const fn of ["api_founder_addAuthorizedEmail", "api_founder_removeAuthorizedEmail", "api_founder_revokeDeviceToken"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} must be audited`);
  }
  // Reading the list is not itself an audited write.
  assert.ok(!WRITE_FUNCTIONS.has("api_founder_listAuthorizedEmails"));
  assert.ok(!WRITE_FUNCTIONS.has("api_founder_listStaffTokens"));
});
