import { query, queryOne, withTransaction, type Tx } from "@/lib/db";
import type { RpcRole, RpcSession } from "@/lib/rpc/auth";
import { s, n, d, newId, newPersonId, nextDocNo, bumpRevisions, acadStudents, acadStudentById, studentToRpc, studentsToRpc } from "@/lib/rpc/shared";
import { receiptSeries } from "@/lib/rpc/numbering";
import {
  advanceCycle,
  amountRupees,
  branchFromClient,
  referenceRuleViolation,
  resolvePlan,
  todayIso,
  DEFAULT_ADVANCE_DAYS,
  PLAN_CATALOG,
} from "@/lib/rpc/fees";
import {
  ALL_BRANCHES,
  branchForbidden,
  defaultBranch,
  inScope,
  matchesRequestedBranch,
  moneyInScope,
  recordBranch,
  type BranchScope,
} from "@/lib/rpc/scope";
import { isBackdated, isExcludedReceiptStatus, studentIncompleteFields } from "@/lib/rpc/rules";
import { closedMonthRefusal } from "@/lib/rpc/governance";
import { notifyFounderApproval, notifyStaffDecision, notifyFounderGeneric, notifyBranch } from "@/lib/push/notify";

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra });

const PAYMENT_MODES = ["Cash", "UPI", "Bank Transfer", "Cheque"];
const ACCOUNTS = ["Kotak UPI", "HDFC", "Cash Box", "Sharvil Service Account"];
const PLAN_TYPES = ["Monthly", "3 Months", "6 Months", "Yearly"];
const CLASS_CODES = ["GMC", "KMC"];
const BRANCHES = [...ALL_BRANCHES];

/**
 * Every function this dispatcher handles — route.ts uses this to decide
 * whether a call belongs here or falls through to handlers2.ts's dispatcher.
 * Kept as a literal set alongside the switch below (not derived from it)
 * so both can be visually diffed against each other; a function added to
 * one without the other fails loudly ("No gateway handler") instead of
 * silently misrouting to the wrong dispatcher's default case.
 */
export const HANDLERS1_FUNCTIONS = new Set([
  "api_bootstrap", "api_staff_boot",
  "api_searchStudent", "api_staff_searchStudents", "api_staff_getStudentProfile", "api_studentProfile",
  "api_staff_studentHub", "api_addStudent", "api_addDemoStudent", "api_listDemoStudents", "api_founder_convertDemoStudent",
  "api_staff_saveStudentDraft", "api_founder_editStudent", "api_founder_setStudentStatus", "api_founder_mergeDuplicateStudent", "api_founder_mergeStudentDraft",
  "api_searchReceipt", "api_receiptPreflight", "api_addFeePayment", "api_staff_prepareReceiptDraft",
  "api_founder_listPaymentDrafts", "api_founder_paymentDraftApprove", "api_founder_paymentDraftReject",
  "api_founder_finalisePaymentDraft", "api_staff_finalisePaymentDraft", "api_founder_studentDraftReject",
]);

export async function rpcDispatch(role: RpcRole, fn: string, arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession) {
  switch (fn) {
    // ------------------------------------------------------------ boot
    case "api_bootstrap":
      return ok(bootstrapPayload(role, session));
    case "api_staff_boot":
      return ok(staffBootPayload(scope, session));

    // ---------------------------------------------------------- students
    case "api_searchStudent":
    case "api_staff_searchStudents":
      return studentsSearch(arg, scope);
    case "api_staff_getStudentProfile":
    case "api_studentProfile":
      return studentProfile(arg, scope);
    case "api_staff_studentHub":
      return staffStudentHub(arg, scope);
    case "api_addStudent":
      return addStudent(arg, scope);
    case "api_addDemoStudent":
      return addDemoStudent(arg, scope);
    case "api_listDemoStudents":
      return listDemoStudents(arg, scope);
    case "api_founder_convertDemoStudent":
      return convertDemoStudent(arg, scope);
    case "api_staff_saveStudentDraft":
      return saveStudentDraft(arg, scope, session);
    case "api_founder_editStudent":
      return founderEditStudent(arg, scope);
    case "api_founder_setStudentStatus":
      return setStudentStatus(arg);
    case "api_founder_mergeDuplicateStudent":
      return mergeDuplicateStudent(arg, scope);
    case "api_founder_mergeStudentDraft":
      return mergeStudentDraft(arg, session);
    case "api_founder_studentDraftReject":
      return studentDraftReject(arg, session);

    // -------------------------------------------------- receipts / money
    case "api_searchReceipt":
      return searchReceipts(arg, scope);
    case "api_receiptPreflight":
      return receiptPreflight(arg, role);
    case "api_addFeePayment":
      return addFeePayment(arg, scope);
    case "api_staff_prepareReceiptDraft":
      return prepareReceiptDraft(arg, scope, session);
    case "api_founder_listPaymentDrafts":
      return listPaymentDrafts(arg);
    case "api_founder_paymentDraftApprove":
      return paymentDraftApprove(arg, session);
    case "api_founder_paymentDraftReject":
      return paymentDraftReject(arg, session);
    case "api_founder_finalisePaymentDraft":
      return finalisePaymentDraft(arg, role, scope, session);
    case "api_staff_finalisePaymentDraft":
      return finalisePaymentDraft(arg, role, scope, session);

    default:
      return { ok: false, code: "UNKNOWN_API", error: `No gateway handler for ${fn}` };
  }
}

// ------------------------------------------------------------------ boots
/** Who is signed in comes from the device token, not from a hardcoded name. */
function bootstrapPayload(role: RpcRole, session?: RpcSession): Record<string, unknown> {
  return {
    email: session?.email ?? "",
    role,
    name: session?.name ?? "",
    device: session?.deviceLabel ?? "",
    accounts: ACCOUNTS,
    paymentModes: PAYMENT_MODES,
    planTypes: PLAN_TYPES,
    plans: PLAN_CATALOG,
    classCodes: CLASS_CODES,
    feeCycleTypes: PLAN_TYPES,
    advanceReminderDays: DEFAULT_ADVANCE_DAYS,
    branches: BRANCHES,
  };
}

function staffBootPayload(scope: BranchScope, session?: RpcSession): Record<string, unknown> {
  return {
    app: "STAFF_APP",
    actor: "STAFF_APP",
    email: session?.email ?? "",
    name: session?.name ?? "",
    device: session?.deviceLabel ?? "",
    isOpsAccount: true,
    // Only the branches this staff token may open.
    branches: scope.unrestricted ? BRANCHES : scope.branches,
    paymentModes: PAYMENT_MODES,
    accounts: ACCOUNTS,
    planTypes: PLAN_TYPES,
    plans: PLAN_CATALOG,
    classCodes: CLASS_CODES,
  };
}

// ---------------------------------------------------------------- students
async function studentsSearch(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const q = s(arg["q"] ?? arg["query"] ?? "");
  const branch = s(arg["branch"] ?? "ALL");
  const cc = s(arg["classCode"] ?? "ALL").toUpperCase();
  const all = await acadStudents(q);
  const matching = all.filter((x) => {
    if (!inScope(scope, x.branch)) return false;
    if (!matchesRequestedBranch(branch, x.branch)) return false;
    if (cc === "ALL") return true;
    const isGmc = cc === "GMC" && recordBranch(x.branch) === "GOREGAON";
    const isKmc = cc === "KMC" && recordBranch(x.branch) !== "GOREGAON";
    return isGmc || isKmc;
  });
  const rows = (await studentsToRpc(matching)) as unknown as Record<string, unknown>[];
  return ok({ results: rows, rows, count: rows.length });
}

async function studentProfile(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const id = s(arg["studentId"]);
  if (!id) return { ok: false, code: "NO_STUDENT", error: "studentId required" };
  const x = await acadStudentById(id);
  if (!x) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${id}` };
  if (!inScope(scope, x.branch)) return branchForbidden(recordBranch(x.branch));
  const st = await studentToRpc(x);
  const receipts = await recentReceipts(id, x.name);
  const attendance = await query<Record<string, unknown>>(
    `select session_date::text as date, status, teacher_name, instrument from attendance_acad
     where student_id = $1 order by session_date desc limit 30`,
    [id],
  );
  // Surfaced so staff/founder see it every time they open the record, not
  // only at the moment of admission — a shared phone can be noticed weeks
  // later when someone else opens the wrong profile.
  const duplicateOf = x.duplicate_of_id ? await acadStudentById(x.duplicate_of_id) : null;
  const possibleDuplicates =
    s(x.status).toUpperCase() !== "DUPLICATE" ? await phoneMatches(x.phone, id) : [];
  return ok({
    student: { ...st, teacherName: st.teacher, branch: s(x.branch).toUpperCase() },
    teacher: { teacherId: st.teacherId ?? "", teacherName: st.teacher },
    receipts,
    attendance: attendance.map((a) => ({
      date: s(a.date),
      status: s(a.status),
      teacherName: s(a.teacher_name),
      instrument: s(a.instrument),
    })),
    duplicateOf: duplicateOf ? { studentId: duplicateOf.id, name: duplicateOf.name } : null,
    possibleDuplicates,
  });
}

/**
 * Handover spec: retire a duplicate student record instead of deleting it or
 * rewriting its history. The duplicate keeps its own id, receipts,
 * attendance and payout rows exactly as recorded; it is only flagged
 * DUPLICATE and linked to the survivor so anyone opening either profile sees
 * the connection.
 */
async function mergeDuplicateStudent(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const duplicateId = s(arg["studentId"]);
  const survivorId = s(arg["survivorId"]);
  if (!duplicateId || !survivorId) return { ok: false, code: "MISSING", error: "studentId + survivorId required" };
  if (duplicateId === survivorId) return { ok: false, code: "SAME_STUDENT", error: "Pick two different students to merge." };
  const [duplicate, survivor] = await Promise.all([acadStudentById(duplicateId), acadStudentById(survivorId)]);
  if (!duplicate) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${duplicateId}` };
  if (!survivor) return { ok: false, code: "SURVIVOR_NOT_FOUND", error: `No student ${survivorId}` };
  if (!inScope(scope, duplicate.branch)) return branchForbidden(recordBranch(duplicate.branch));
  if (!inScope(scope, survivor.branch)) return branchForbidden(recordBranch(survivor.branch));
  await query(
    `update students_acad set status = 'DUPLICATE', duplicate_of_id = $1,
       notes = coalesce(notes,'') || '[Merged into ' || $1 || ' (' || $2 || ')]'
     where id = $3`,
    [survivorId, survivor.name, duplicateId],
  );
  await bumpRevisions(["students", "dashboard"]);
  notifyBranch(recordBranch(survivor.branch), "Students merged", `${duplicate.name} merged into ${survivor.name}`, survivorId);
  return ok({
    merged: true,
    studentId: duplicateId,
    survivorId,
    survivorName: survivor.name,
    note: `${duplicate.name} marked as a duplicate of ${survivor.name}. Their receipts and attendance stay on record under ${duplicateId}.`,
  });
}

async function staffStudentHub(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const id = s(arg["studentId"]);
  const x = await acadStudentById(id);
  if (!x) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${id}` };
  if (!inScope(scope, x.branch)) return branchForbidden(recordBranch(x.branch));
  const st = await studentToRpc(x);
  const [drafts, receipts] = await Promise.all([
    query<Record<string, unknown>>(
      `select id as draft_id, amount, payment_date::text, approval_authority, approved_by, repair_required, status
       from payment_drafts where student_id = $1 and status = 'APPROVED' order by submitted_at desc`,
      [id],
    ),
    recentReceipts(id, x.name),
  ]);
  const paid = receipts.filter((r) => !isExcludedReceiptStatus(r.status));
  return ok({
    profile: { ...st, parentName: s(x.guardian_name), fee: st.monthlyFee || st.lastReceiptAmount || "", dueDate: st.nextDueDate, feeStatus: st.feeStatus },
    fees: {
      available: true,
      total: paid.reduce((a, r) => a + Number(r.amount ?? 0), 0),
      capped: receipts.length >= 20,
      rows: receipts,
    },
    pending: {
      available: drafts.length > 0,
      rows: drafts.map((r) => {
        // Brief §11.9: a blank approver is UNKNOWN, never "approved by Sharvil".
        const approvedBy = s(r.approved_by);
        return {
          draftId: s(r.draft_id),
          amount: s(r.amount),
          paymentDate: s(r.payment_date),
          approvalAuthority: s(r.approval_authority),
          approvedBy,
          founderDecision: s(r.approval_authority) === "FOUNDER",
          label: approvedBy ? `Approved by ${approvedBy}` : "Approved (approver not recorded)",
          repairRequired: r.repair_required === true,
          status: s(r.status),
          canFinalise: s(r.status) === "APPROVED",
          blockedReason: "",
        };
      }),
    },
    terms: { found: false, link: "", status: "", label: "No terms link yet", note: "" },
  });
}

/** Brief-adjacent, founder-requested 2026-09-17: how the lead became an
 * admission, for intake reporting. Optional; blank on older students. */
const ADMISSION_SOURCES = ["WALK_IN", "FOLLOW_UP", "REFERRAL", "ONLINE_SOCIAL", "OTHER"];

interface StudentFields {
  name: string;
  phone: string;
  email: string;
  parentName: string;
  guardianPhone: string;
  course: string;
  branch: string;
  batch: string;
  planText: string;
  feeDueDay: number | null;
  notes: string;
  admissionSource: string;
  teacherId: string;
  enrollmentDate: string | null;
}

/** "2026-09-24" only — anything else (blank, malformed) becomes null rather than a bad date literal reaching SQL. */
function isoDateOrNull(v: unknown): string | null {
  const t = s(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

function studentFieldsFrom(arg: Record<string, unknown>): StudentFields {
  const dueDay = Number(arg["feeDueDay"]);
  const admissionSource = s(arg["admissionSource"]).trim().toUpperCase();
  return {
    name: s(arg["name"] ?? arg["studentName"]).trim(),
    phone: s(arg["phone"]).trim(),
    email: s(arg["email"]).trim(),
    parentName: s(arg["parentName"] ?? arg["guardianName"]).trim(),
    guardianPhone: s(arg["guardianPhone"]).trim(),
    course: s(arg["instrument"] ?? arg["course"]).trim(),
    branch: branchFromClient(arg),
    batch: s(arg["batch"]).trim(),
    planText: s(arg["feeCycleType"] ?? arg["planType"] ?? arg["feePlan"]).trim(),
    teacherId: s(arg["teacherId"]).trim(),
    feeDueDay: Number.isInteger(dueDay) && dueDay >= 1 && dueDay <= 31 ? dueDay : null,
    notes: s(arg["notes"]).trim(),
    admissionSource: ADMISSION_SOURCES.includes(admissionSource) ? admissionSource : "",
    // `joiningDate` is the key the Flutter app already sends (currently always
    // empty — a vestigial, never-wired field); accepting it here as an alias
    // means wiring up that screen later needs no server-side change.
    enrollmentDate: isoDateOrNull(arg["enrollmentDate"] ?? arg["joiningDate"]),
  };
}

/** Students already registered on this phone (brief P1: duplicates are checked on phone). */
async function phoneMatches(phone: string, exceptId = ""): Promise<{ studentId: string; name: string }[]> {
  const digits = phone.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return [];
  const rows = await query<{ id: string; name: string }>(
    `select id, name from students_acad
     where right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 10) = $1 and id <> $2 limit 5`,
    [digits, exceptId],
  );
  return rows.map((r) => ({ studentId: r.id, name: r.name }));
}

/** The one place a student row is created (founder add, or a merged staff draft). */
async function createStudent(f: StudentFields, runner: { query: typeof query } = { query }): Promise<string> {
  const id = await newPersonId("STU", "students_acad", f.enrollmentDate, f.course, runner);
  const plan = resolvePlan(f.planText);
  await runner.query(
    `insert into students_acad
       (id, name, guardian_name, guardian_phone, phone, email, instrument, branch, batch, fee_plan, status, notes,
        fee_plan_name, monthly_fee, fee_cycle_months, fee_due_day, next_due_date, admission_source, assigned_teacher_id, enrollment_date)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'ACTIVE',$11,$12,$13,$14,$15,$16::date,$17,$18,$19::date)`,
    [
      id, f.name, f.parentName, f.guardianPhone || null, f.phone, f.email, f.course || "Music", f.branch, f.batch, f.planText, f.notes,
      plan?.name ?? (f.planText || null),
      plan?.amount ?? null,
      plan?.months ?? null,
      f.feeDueDay,
      // With a plan, the first fee is due on joining; without one, it is "not set".
      plan ? todayIso() : null,
      f.admissionSource || null,
      f.teacherId || null,
      f.enrollmentDate,
    ],
  );
  return id;
}

async function addStudent(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const f = studentFieldsFrom(arg);
  if (!f.name) return { ok: false, code: "NO_NAME", error: "Student name required" };
  f.branch = f.branch || defaultBranch(scope, undefined);
  if (!inScope(scope, f.branch)) return branchForbidden(f.branch);
  const matches = await phoneMatches(f.phone);
  const id = await createStudent(f);
  await bumpRevisions(["students", "dashboard", "tasks"]);
  notifyBranch(f.branch, "New student", `${f.name} added`, id);
  return ok({
    studentId: id,
    studentName: f.name,
    duplicateWarning: { hasDuplicates: matches.length > 0, matches },
    note: matches.length ? `created — this phone is also registered to ${matches.map((m) => m.name).join(", ")}` : "student created",
  });
}

/**
 * Demo Students: a trial-class stage before real admission (founder request
 * 2026-09-28). Low-risk and non-money, so either role can add one directly —
 * no draft/approval, matching how staff already manage inquiries directly.
 * No fee plan is collected here; that only happens on conversion.
 */
async function addDemoStudent(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const name = s(arg["studentName"] ?? arg["name"]).trim();
  if (!name) return { ok: false, code: "NO_NAME", error: "Student name required" };
  const phone = s(arg["phone"]).trim();
  const guardianName = s(arg["guardianName"] ?? arg["parentName"]).trim();
  const guardianPhone = s(arg["guardianPhone"]).trim();
  const instrument = s(arg["instrument"]).trim();
  const teacherId = s(arg["teacherId"]).trim();
  const demoDate = isoDateOrNull(arg["demoDate"]) || todayIso();
  const demoTime = s(arg["demoTime"]).trim();
  const branch = defaultBranch(scope, arg["branch"]);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  if (!phone) return { ok: false, code: "PHONE_REQUIRED", error: "Phone is required." };
  if (!guardianName) return { ok: false, code: "GUARDIAN_REQUIRED", error: "Guardian name is required." };
  if (!guardianPhone) return { ok: false, code: "GUARDIAN_PHONE_REQUIRED", error: "Guardian contact number is required." };
  if (!instrument) return { ok: false, code: "INSTRUMENT_REQUIRED", error: "Instrument / course is required." };
  if (!teacherId) return { ok: false, code: "TEACHER_REQUIRED", error: "Pick a teacher." };
  if (!demoTime) return { ok: false, code: "DEMO_TIME_REQUIRED", error: "Pick the demo session time." };

  const id = await newPersonId("STU", "students_acad", demoDate, instrument);
  await query(
    `insert into students_acad (id, name, guardian_name, guardian_phone, phone, email, instrument, branch, status, assigned_teacher_id, demo_date, demo_time)
     values ($1,$2,$3,$4,$5,$6,$7,$8,'DEMO',$9,$10::date,$11)`,
    [id, name, guardianName, guardianPhone, phone, s(arg["email"]).trim() || null, instrument, branch, teacherId, demoDate, demoTime],
  );
  await bumpRevisions(["students", "dashboard"]);
  notifyFounderGeneric("New demo student", `${name} (${instrument}) at ${recordBranch(branch)}`, id);
  return ok({ studentId: id, studentName: name, note: "Demo student added." });
}

async function listDemoStudents(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const branch = s(arg["branch"] ?? "ALL");
  const rows = await query<Record<string, unknown>>(
    `select s.id, s.name, s.phone, s.email, s.guardian_name, s.guardian_phone, s.instrument, s.branch,
            s.assigned_teacher_id, t.name as teacher_name, s.demo_date::text, s.demo_time
     from students_acad s
     left join teachers_acad t on t.id = s.assigned_teacher_id
     where s.status = 'DEMO'
     order by s.demo_date asc nulls last, s.demo_time asc nulls last`,
  );
  const visible = rows.filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(branch, r.branch));
  return ok({
    students: visible.map((r) => ({
      studentId: s(r.id),
      studentName: s(r.name),
      phone: s(r.phone),
      email: s(r.email),
      guardianName: s(r.guardian_name),
      guardianPhone: s(r.guardian_phone),
      instrument: s(r.instrument),
      branch: s(r.branch),
      teacherId: s(r.assigned_teacher_id),
      teacherName: s(r.teacher_name),
      demoDate: s(r.demo_date),
      demoTime: s(r.demo_time),
    })),
  });
}

/** Founder-only: fills in the fee plan and admits a demo student for real. Same row, same id — not a copy. */
async function convertDemoStudent(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const studentId = s(arg["studentId"]).trim();
  if (!studentId) return { ok: false, code: "STUDENT_ID_REQUIRED", error: "Pick the demo student." };
  const cur = await queryOne<{ status: string; branch: string }>(`select status, branch from students_acad where id = $1`, [studentId]);
  if (!cur) return { ok: false, code: "NOT_FOUND", error: `No student ${studentId}` };
  if (!inScope(scope, cur.branch)) return branchForbidden(cur.branch);
  if (s(cur.status).toUpperCase() !== "DEMO") return { ok: false, code: "NOT_DEMO", error: `${studentId} is not a demo student (status ${cur.status}).` };

  const planText = s(arg["feeCycleType"] ?? arg["planType"] ?? arg["feePlan"]).trim();
  if (!planText) return { ok: false, code: "PLAN_REQUIRED", error: "Pick a fee plan." };
  const dueDayNum = Number(arg["feeDueDay"]);
  const feeDueDay = Number.isInteger(dueDayNum) && dueDayNum >= 1 && dueDayNum <= 31 ? dueDayNum : null;
  if (!feeDueDay) return { ok: false, code: "DUE_DAY_REQUIRED", error: "Enter a fee due day from 1 to 31." };
  const enrollmentDate = isoDateOrNull(arg["enrollmentDate"]) || todayIso();
  const batch = s(arg["batch"]).trim();
  const plan = resolvePlan(planText);

  await query(
    `update students_acad set
       status = 'ACTIVE', fee_plan = $2, fee_plan_name = $3, monthly_fee = $4, fee_cycle_months = $5,
       fee_due_day = $6, next_due_date = $7::date, enrollment_date = $8::date, batch = coalesce(nullif($9,''), batch)
     where id = $1`,
    [studentId, planText, plan?.name ?? planText, plan?.amount ?? null, plan?.months ?? null, feeDueDay, todayIso(), enrollmentDate, batch],
  );
  await bumpRevisions(["students", "dashboard", "tasks"]);
  notifyBranch(cur.branch, "Demo student converted", `${studentId} is now an admitted student`, studentId);
  return ok({ studentId, note: "Converted to an admitted student." });
}

/** The one place an existing student row's fields are actually written —
 *  shared by the founder's direct edit and a merged staff draft, so both
 *  paths update exactly the same columns the exact same way. */
async function applyStudentFieldEdit(studentId: string, f: StudentFields, runner: Pick<Tx, "query"> = { query }): Promise<void> {
  const plan = resolvePlan(f.planText);
  await runner.query(
    `update students_acad set
       name = coalesce(nullif($2,''), name), phone = coalesce(nullif($3,''), phone),
       email = coalesce(nullif($4,''), email), guardian_name = coalesce(nullif($5,''), guardian_name),
       guardian_phone = coalesce(nullif($6,''), guardian_phone),
       instrument = coalesce(nullif($7,''), instrument), batch = coalesce(nullif($8,''), batch),
       notes = coalesce(nullif($9,''), notes),
       fee_plan_name = coalesce($10, fee_plan_name), monthly_fee = coalesce($11, monthly_fee),
       fee_cycle_months = coalesce($12, fee_cycle_months),
       admission_source = coalesce(nullif($13,''), admission_source),
       assigned_teacher_id = coalesce(nullif($14,''), assigned_teacher_id),
       enrollment_date = coalesce($15::date, enrollment_date)
     where id = $1`,
    [studentId, f.name, f.phone, f.email, f.parentName, f.guardianPhone, f.course, f.batch, f.notes, plan?.name ?? null, plan?.amount ?? null, plan?.months ?? null, f.admissionSource, f.teacherId, f.enrollmentDate],
  );
}

async function applyStudentLifecycleChange(studentId: string, status: string, reason: string, runner: Pick<Tx, "query" | "queryOne"> = { query, queryOne }): Promise<void> {
  await runner.query(
    "update students_acad set status = $2, notes = coalesce(notes,'') || ' [' || $3 || ']', status_changed_at = case when status is distinct from $2 then now() else status_changed_at end where id = $1",
    [studentId, status, `${status}: ${reason}`],
  );
  if (status === "LEFT") await createWinBackLeadIfNeeded(studentId, reason, runner);
}

/**
 * Founder edit — applies immediately, no approval queue. The founder is
 * already the approval authority, so routing their own edit through
 * student_drafts just meant they had to separately go approve themselves.
 * A confirmation popup on the client is the only gate; the write still goes
 * through the normal audit_log (WRITE_FUNCTIONS) so there is a record.
 */
async function founderEditStudent(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const editingId = s(arg["studentId"]).trim();
  if (!editingId) return { ok: false, code: "STUDENT_ID_REQUIRED", error: "studentId required" };
  const existing = await acadStudentById(editingId);
  if (!existing) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${editingId}` };
  if (!inScope(scope, existing.branch)) return branchForbidden(recordBranch(existing.branch));

  const lifecycle = s(arg["lifecycleStatus"]).trim().toUpperCase();
  const statusReason = s(arg["statusReason"]).trim();
  if (lifecycle) {
    if (!STUDENT_STATUSES.includes(lifecycle)) return { ok: false, code: "BAD_STATUS", error: `Status must be one of ${STUDENT_STATUSES.join(", ")}.` };
    if (!statusReason) return { ok: false, code: "REASON_REQUIRED", error: "Say why the status should change." };
  }

  const f = studentFieldsFrom(arg);
  await withTransaction(async (tx) => {
    await applyStudentFieldEdit(editingId, f, tx);
    if (lifecycle) await applyStudentLifecycleChange(editingId, lifecycle, statusReason, tx);
  });
  await bumpRevisions(["students", "dashboard", "tasks", "inquiries"]);
  notifyBranch(recordBranch(existing.branch), "Student updated", `${existing.name} edited by Sharvil`, editingId);
  return ok({ changed: true, studentId: editingId, note: "Student updated." });
}

/**
 * Staff add/edit is a PROPOSAL (brief pattern B). It lands in student_drafts
 * for the founder to merge; it never creates or changes a student directly.
 */
async function saveStudentDraft(arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  const f = studentFieldsFrom(arg);
  const editingId = s(arg["studentId"]).trim();
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;

  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from student_drafts where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ draftId: earlier.id, status: earlier.status, idempotent: true, note: "Already sent for approval." });
  }

  let branch = f.branch;
  if (editingId) {
    const existing = await acadStudentById(editingId);
    if (!existing) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${editingId}` };
    if (!inScope(scope, existing.branch)) return branchForbidden(recordBranch(existing.branch));
    branch = recordBranch(existing.branch);
  } else {
    if (!f.name) return { ok: false, code: "NO_NAME", error: "Student name required" };
    branch = branch || defaultBranch(scope, undefined);
    if (!inScope(scope, branch)) return branchForbidden(branch);
  }

  const lifecycle = s(arg["lifecycleStatus"]).trim().toUpperCase();
  const statusReason = s(arg["statusReason"]).trim();
  if (lifecycle) {
    if (!editingId) return { ok: false, code: "STUDENT_ID_REQUIRED", error: "A status change is for an existing student." };
    if (!STUDENT_STATUSES.includes(lifecycle)) return { ok: false, code: "BAD_STATUS", error: `Status must be one of ${STUDENT_STATUSES.join(", ")}.` };
    if (!statusReason) return { ok: false, code: "REASON_REQUIRED", error: "Say why the status should change." };
  }

  const matches = editingId ? [] : await phoneMatches(f.phone);
  const draftId = newId("SDRAFT");
  await query(
    `insert into student_drafts
       (id, status, action, student_id, name, phone, email, parent_name, guardian_phone, course, branch, batch, fee_plan, notes, submitted_by, client_intent_key,
        lifecycle_status, status_reason, admission_source, teacher_id, enrollment_date)
     values ($1,'SUBMITTED',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::date)`,
    [draftId, editingId ? "EDIT" : "ADD", editingId || null, f.name, f.phone, f.email, f.parentName, f.guardianPhone || null, f.course, branch, f.batch, f.planText, f.notes, session?.deviceLabel || session?.email || "", intent,
     lifecycle || null, statusReason || null, f.admissionSource || null, f.teacherId || null, f.enrollmentDate],
  );
  await bumpRevisions(["approvals", "tasks"]);
  notifyFounderApproval("Student change", editingId ? "an edit to review" : "a new student to review", draftId);
  return ok({
    draftId,
    status: "SUBMITTED",
    duplicateWarning: { hasDuplicates: matches.length > 0, matches },
    // Brief pattern B: never "Saved" — the founder has not decided yet.
    note: "Sent for approval.",
  });
}

/** Founder merges a staff draft: ADD creates the student, EDIT updates the fields that were filled in. */
async function mergeStudentDraft(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const draftId = s(arg["draftId"] ?? arg["itemId"]);
  if (!draftId) return { ok: false, code: "DRAFT_ID_REQUIRED", error: "draftId required" };
  const result: Record<string, unknown> = await withTransaction(async (tx) => {
    const draft = await tx.queryOne<Record<string, unknown>>(`select * from student_drafts where id = $1 for update`, [draftId]);
    if (!draft) return { ok: false, code: "DRAFT_NOT_FOUND", error: `No student draft ${draftId}` };
    if (s(draft.status) === "MERGED") {
      return ok({ changed: false, draftId, studentId: s(draft.student_id), idempotent: true, note: "already merged" });
    }
    if (s(draft.status) !== "SUBMITTED") return { ok: false, code: "NOT_SUBMITTED", error: `Draft status ${s(draft.status)}` };

    const f: StudentFields = {
      name: s(draft.name), phone: s(draft.phone), email: s(draft.email), parentName: s(draft.parent_name),
      guardianPhone: s(draft.guardian_phone),
      course: s(draft.course), branch: s(draft.branch), batch: s(draft.batch), planText: s(draft.fee_plan),
      feeDueDay: null, notes: s(draft.notes), admissionSource: s(draft.admission_source), teacherId: s(draft.teacher_id),
      enrollmentDate: isoDateOrNull(draft.enrollment_date),
    };
    let studentId = s(draft.student_id);
    if (s(draft.action) === "EDIT") {
      await applyStudentFieldEdit(studentId, f, tx);
      if (s(draft.lifecycle_status)) {
        await applyStudentLifecycleChange(studentId, s(draft.lifecycle_status), s(draft.status_reason), tx);
      }
    } else {
      studentId = await createStudent(f, tx);
    }
    await tx.query(
      `update student_drafts set status = 'MERGED', student_id = $2, decided_by = $3, decided_at = now() where id = $1`,
      [draftId, studentId, session?.email ?? ""],
    );
    return ok({ changed: true, created: s(draft.action) !== "EDIT", draftId, studentId, branch: s(draft.branch) });
  });
  if (result["changed"] === true) {
    await bumpRevisions(["students", "approvals", "dashboard", "tasks", "inquiries"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Student change", "merged into the master", draftId);
  }
  return result;
}

async function studentDraftReject(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const draftId = s(arg["draftId"] ?? arg["itemId"]);
  const reason = s(arg["reason"] ?? arg["comment"]).trim();
  if (!draftId) return { ok: false, code: "DRAFT_ID_REQUIRED", error: "draftId required" };
  if (!reason) return { ok: false, code: "REASON_REQUIRED", error: "Give a reason so staff know what to fix." };
  const rows = await query<{ id: string; branch: string }>(
    `update student_drafts set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [draftId, session?.email ?? "", reason],
  );
  if (!rows.length) return { ok: false, code: "DRAFT_NOT_FOUND", error: `No pending student draft ${draftId}` };
  await bumpRevisions(["approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Student change", "rejected — see the reason", draftId);
  return ok({ changed: true, draftId, status: "REJECTED" });
}

/**
 * When a student leaves, they don't just disappear — they re-enter the
 * follow-up pipeline as a "win-back" lead, tagged distinctly from a fresh
 * inquiry (source='Former Student', former_student_id set) so staff can
 * work on re-enrolling them. Idempotent: never creates a second one for the
 * same student, however many times they pause/leave/rejoin.
 */
async function createWinBackLeadIfNeeded(
  studentId: string,
  reason: string,
  runner: Pick<Tx, "query" | "queryOne"> = { query, queryOne },
): Promise<void> {
  const already = await runner.queryOne<{ id: string }>(`select id from inquiries where former_student_id = $1`, [studentId]);
  if (already) return;
  const student = await runner.queryOne<{ name: string; phone: string; instrument: string; branch: string }>(
    `select name, phone, instrument, branch from students_acad where id = $1`,
    [studentId],
  );
  if (!student) return;
  await runner.query(
    `insert into inquiries (id, name, phone, instrument, branch, source, notes, status, created_at, next_contact_date, former_student_id, updated_at)
     values ($1,$2,$3,$4,$5,'Former Student',$6,'OPEN',current_date,current_date + 1,$7,now())`,
    [newId("INQ"), student.name, student.phone, student.instrument, student.branch, `Left the academy: ${reason}`, studentId],
  );
}

async function setStudentStatus(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const id = s(arg["studentId"]);
  const status = s(arg["status"]).toUpperCase();
  const reason = s(arg["reason"]).trim();
  if (!id || !status) return { ok: false, code: "MISSING", error: "studentId + status required" };
  if (!STUDENT_STATUSES.includes(status)) return { ok: false, code: "BAD_STATUS", error: `Status must be one of ${STUDENT_STATUSES.join(", ")}.` };
  if (!reason) return { ok: false, code: "REASON_REQUIRED", error: "Say why the status is changing." };
  const before = await acadStudentById(id);
  if (!before) return { ok: false, code: "NOT_FOUND", error: `No student ${id}` };
  await query(
    "update students_acad set status = $1, notes = coalesce(notes,'') || '[' || $2 || ']', status_changed_at = case when status is distinct from $1 then now() else status_changed_at end where id = $3",
    [status.toUpperCase(), reason, id],
  );
  if (status === "LEFT") await createWinBackLeadIfNeeded(id, reason);
  const after = await acadStudentById(id);
  await bumpRevisions(["students", "dashboard", "inquiries"]);
  notifyBranch(recordBranch(before.branch), "Student status changed", `${before.name} → ${status}: ${reason}`, id);
  return ok({
    changed: true,
    studentId: id,
    before: { status: before.status },
    after: { status: after?.status },
    reason,
    auditWritten: true,
    note: "status changed",
  });
}


/** Brief §10.5. Only ACTIVE counts for money. */
const STUDENT_STATUSES = ["ACTIVE", "PAUSED", "LEFT", "TEST", "DUPLICATE", "ARCHIVED"];

// -------------------------------------------------------------- receipts
const RECEIPT_GUARD: Record<string, string> = {
  ACTIVE: "FINALISED",
  FINALISED: "FINALISED",
  PENDING: "APPROVED",
  APPROVED: "APPROVED",
};

const entityOf = (branch: unknown) => (recordBranch(branch) === "GOREGAON" ? "ENT-GOREGAON" : "ENT-KANDIVALI");

async function recentReceipts(studentId: string, name: string): Promise<Record<string, unknown>[]> {
  const rows = await query<Record<string, unknown>>(
    `select id, receipt_no, amount, status, payment_mode, linked_url, branch, created_at::text, payment_date::text, student_id,
            txn_id, fee_period_from::text, fee_period_to::text, void_reason from receipts
     where student_id = $1 or (student_id is null and party_name = $2) order by id desc limit 20`,
    [studentId, name],
  );
  return rows.map((r) => ({
    receiptNo: s(r.receipt_no),
    studentId: s(r.student_id),
    date: d(r.payment_date) || d(r.created_at),
    student: name,
    amount: n(r.amount),
    mode: s(r.payment_mode),
    paymentMode: s(r.payment_mode),
    status: s(r.status).toUpperCase() in RECEIPT_GUARD ? RECEIPT_GUARD[s(r.status).toUpperCase()] : s(r.status).toUpperCase(),
    entityId: entityOf(r.branch),
    pdfUrl: s(r.linked_url),
    excluded: isExcludedReceiptStatus(r.status),
    voidReason: s(r.void_reason),
    feePeriodFrom: s(r.fee_period_from),
    feePeriodTo: s(r.fee_period_to),
    txnId: s(r.txn_id),
  }));
}

async function searchReceipts(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const q = s(arg["q"] ?? arg["studentName"] ?? arg["receiptNo"] ?? "");
  const status = s(arg["status"]);
  const cc = s(arg["classCode"] ?? "ALL").toUpperCase();
  let sql = `select id, receipt_no, party_name, amount, payment_mode, linked_url, status, branch, created_at::text, student_id,
                    payment_date::text, txn_id, fee_period_from::text, fee_period_to::text, void_reason from receipts where 1=1`;
  const params: unknown[] = [];
  if (status) {
    params.push(status);
    sql += ` and status ilike $${params.length}`;
  }
  const rows = (await query<Record<string, unknown>>(sql, params)).filter((r) => {
    if (!moneyInScope(scope, r.branch)) return false;
    if (cc === "ALL") return true;
    const isGmc = cc === "GMC" && recordBranch(r.branch) === "GOREGAON";
    const isKmc = cc === "KMC" && recordBranch(r.branch) !== "GOREGAON";
    return isGmc || isKmc;
  });
  let filtered = rows.map((r) => ({
    receiptNo: s(r.receipt_no),
    studentId: s(r.student_id),
    date: d(r.payment_date) || d(r.created_at),
    student: s(r.party_name),
    studentName: s(r.party_name),
    amount: n(r.amount),
    mode: s(r.payment_mode),
    paymentMode: s(r.payment_mode),
    status: s(r.status).toUpperCase() in RECEIPT_GUARD ? RECEIPT_GUARD[s(r.status).toUpperCase()] : s(r.status).toUpperCase(),
    entityId: entityOf(r.branch),
    pdfUrl: s(r.linked_url),
    excluded: isExcludedReceiptStatus(r.status),
    voidReason: s(r.void_reason),
    feePeriodFrom: s(r.fee_period_from),
    feePeriodTo: s(r.fee_period_to),
    txnId: s(r.txn_id),
  }));
  if (q) {
    const ql = q.toLowerCase();
    filtered = filtered.filter((r) => [r.receiptNo, r.student, r.studentName, r.txnId].join(" ").toLowerCase().includes(ql));
  }
  // Paging happens AFTER the text filter so a page never mixes in rows the
  // filter would have removed. `total` is the full filtered count, which is
  // what lets both clients show "showing X-Y of Z" honestly.
  const total = filtered.length;
  const limit = Math.min(Math.max(Number(arg["limit"]) || 50, 1), 200);
  const offset = Math.max(Number(arg["offset"]) || 0, 0);
  const page = filtered.slice(offset, offset + limit);
  return ok({ results: page, rows: page, total, limit, offset });
}

async function receiptPreflight(arg: Record<string, unknown>, role: RpcRole): Promise<Record<string, unknown>> {
  const amount = n(arg["amount"]);
  if (amount <= 0) return { ok: false, code: "BAD_AMOUNT", error: "Amount must be > 0" };
  return ok({
    preview: true,
    amount,
    mode: s(arg["paymentMode"] ?? "UPI"),
    studentName: s(arg["studentName"]),
    feePeriodFrom: s(arg["feePeriodFrom"]),
    feePeriodTo: s(arg["feePeriodTo"]),
    nextDueDate: s(arg["nextDueDate"]),
    warnings: [],
  });
}

/**
 * Move the student's fee cycle on after a payment. This is what makes the
 * "due date advanced" note true — it previously only said so.
 */
async function advanceStudentCycle(tx: Tx, studentId: string, paidOn: string, receiptNo = ""): Promise<string | null> {
  if (!studentId) return null;
  const st = await tx.queryOne<{ next_due_date: string | null; fee_cycle_months: number | null }>(
    `select next_due_date::text, fee_cycle_months from students_acad where id = $1`,
    [studentId],
  );
  if (!st) return null;
  const c = advanceCycle(st.next_due_date, paidOn, st.fee_cycle_months);
  await tx.query(
    `update students_acad
     set next_due_date = $2::date, cycle_start = $3::date, cycle_end = $4::date, last_payment_date = $5::date
     where id = $1`,
    [studentId, c.nextDueDate, c.cycleStart, c.cycleEnd, paidOn],
  );
  if (receiptNo) {
    // Lets a later void put the due date back without guessing.
    await tx.query(
      `update receipts set prev_next_due_date = $2::date, advanced_next_due_date = $3::date where receipt_no = $1`,
      [receiptNo, st.next_due_date || null, c.nextDueDate],
    );
  }
  return c.nextDueDate;
}

interface ReceiptFacts {
  studentId: string;
  studentName: string;
  amount: number;
  mode: string;
  branch: string;
  paidOn: string;
  txnId: string;
  receiptBookNo: string;
  periodFrom: string;
  periodTo: string;
  intentKey: string | null;
  description: (receiptNo: string) => string;
}

/** Receipt + matching ledger inflow, written in the caller's transaction. */
async function writeReceipt(tx: Tx, p: ReceiptFacts): Promise<string> {
  const receiptNo = await nextDocNo(tx, "receipt", receiptSeries(new Date(`${p.paidOn}T12:00:00+05:30`)));
  const ledgerId = newId("LED");
  await tx.query(
    `insert into money_ledger (id, entry_date, party_name, category, description, inflow, amount, payment_mode, status, branch)
     values ($1, $2::date, $3, 'Student Fees', $4, $5, $5, $6, 'ACTIVE', $7)`,
    [ledgerId, p.paidOn, p.studentName, p.description(receiptNo), p.amount, p.mode, p.branch || null],
  );
  await tx.query(
    `insert into receipts (id, receipt_no, party_name, amount, payment_mode, status, record_id, student_id, branch, created_at,
                           payment_date, txn_id, physical_receipt_no, fee_period_from, fee_period_to, client_intent_key)
     values ($1,$2,$3,$4,$5,'ACTIVE',$6,$7,$8,now(),$9::date,$10,$11,$12::date,$13::date,$14)`,
    [
      newId("REC"), receiptNo, p.studentName, p.amount, p.mode, ledgerId, p.studentId || null, p.branch || null,
      p.paidOn, p.txnId || null, p.receiptBookNo || null, p.periodFrom || null, p.periodTo || null, p.intentKey,
    ],
  );
  return receiptNo;
}

/** Brief P3.2: a payment for an incomplete student is refused, naming the gaps. */
async function incompleteStudentRefusal(studentId: string): Promise<Record<string, unknown> | null> {
  const st = await queryOne<{ name: string; monthly_fee: string; fee_cycle_months: number; next_due_date: string }>(
    `select name, monthly_fee, fee_cycle_months, next_due_date::text from students_acad where id = $1`,
    [studentId],
  );
  if (!st) return null;
  const missing = studentIncompleteFields(st);
  if (!missing.length) return null;
  return {
    ok: false,
    code: "STUDENT_INCOMPLETE",
    error: `${st.name}'s record is missing: ${missing.join(", ")}. Ask Sharvil to set the fee plan before recording a payment.`,
    missing,
  };
}

/** Whole days from b to a (positive when a is later). */
const daysBetween = (a: string, b: string) => {
  const x = Date.parse(`${a}T00:00:00Z`);
  const y = Date.parse(`${b}T00:00:00Z`);
  return Number.isFinite(x) && Number.isFinite(y) ? Math.round((x - y) / 86400000) : 0;
};

const isoDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(s(v).trim()) ? s(v).trim() : "");

async function addFeePayment(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const amount = amountRupees(arg);
  const studentId = s(arg["studentId"]);
  if (amount <= 0) return { ok: false, code: "BAD_AMOUNT", error: "Enter an amount greater than zero." };
  if (!studentId) return { ok: false, code: "STUDENT_ID_REQUIRED", error: "Pick the student this payment is for." };
  const student = await acadStudentById(studentId);
  if (!student) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${studentId}` };
  if (!inScope(scope, student.branch)) return branchForbidden(recordBranch(student.branch));

  const txnId = s(arg["txnId"] ?? arg["paymentReference"]).trim();
  const receiptBookNo = s(arg["physicalReceiptNo"]).trim();
  const refRule = referenceRuleViolation(txnId, receiptBookNo);
  if (refRule) return { ok: false, code: "REFERENCE_REQUIRED", error: refRule };

  const intentKey = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  const incompleteFounder = await incompleteStudentRefusal(student.id);
  if (incompleteFounder) return incompleteFounder;
  const lockedPay = await closedMonthRefusal(isoDate(arg["paymentDate"]) || isoDate(arg["dueDate"]) || todayIso());
  if (lockedPay) return lockedPay;
  if (intentKey) {
    const earlier = await queryOne<{ receipt_no: string }>(`select receipt_no from receipts where client_intent_key = $1`, [intentKey]);
    if (earlier) return ok({ receiptNo: earlier.receipt_no, idempotent: true, note: "already recorded" });
  }

  // The screen's "payment date" field is sent as dueDate; the date money came in.
  const paidOn = isoDate(arg["paymentDate"]) || isoDate(arg["dueDate"]) || todayIso();
  const { receiptNo, nextDueDate } = await withTransaction(async (tx) => {
    const no = await writeReceipt(tx, {
      studentId: student.id,
      studentName: student.name,
      amount,
      mode: s(arg["paymentMode"]) || "UPI",
      branch: recordBranch(student.branch),
      paidOn,
      txnId,
      receiptBookNo,
      periodFrom: isoDate(arg["feeFrom"] ?? arg["feePeriodFrom"]),
      periodTo: isoDate(arg["feeTo"] ?? arg["feePeriodTo"]),
      intentKey,
      description: (rno) => `Fee receipt ${rno}`,
    });
    const due = await advanceStudentCycle(tx, student.id, paidOn, no);
    return { receiptNo: no, nextDueDate: due };
  });
  await bumpRevisions(["receipts", "payments", "students", "dashboard", "tasks"]);
  notifyBranch(recordBranch(student.branch), "Fee payment recorded", `₹${amount} from ${student.name} — ${receiptNo}`, receiptNo);
  return ok({ receiptNo, nextDueDate: nextDueDate ?? "", note: "receipt created" });
}

async function prepareReceiptDraft(arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  // The staff screen sends integer paise; reading `amount` saved every draft as ₹0.
  const amount = amountRupees(arg);
  const studentId = s(arg["studentId"]);
  if (amount <= 0) return { ok: false, code: "BAD_AMOUNT", error: "Enter an amount greater than zero." };
  if (!studentId) return { ok: false, code: "STUDENT_ID_REQUIRED", error: "Pick the student this payment is for." };
  const student = await acadStudentById(studentId);
  if (!student) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${studentId}` };
  // The student's stored branch wins over whatever the client sent.
  const branch = recordBranch(student.branch);
  if (!inScope(scope, branch)) return branchForbidden(branch);

  const reference = s(arg["paymentReference"] ?? arg["txnId"]).trim();
  const receiptBookNo = s(arg["physicalReceiptNo"]).trim();
  const refRule = referenceRuleViolation(reference, receiptBookNo);
  if (refRule) return { ok: false, code: "REFERENCE_REQUIRED", error: refRule };

  const intentKey = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (intentKey) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from payment_drafts where client_intent_key = $1`, [intentKey]);
    if (earlier) return ok({ draftId: earlier.id, status: earlier.status, idempotent: true, persisted: true, note: "Already sent for approval." });
  }
  const incomplete = await incompleteStudentRefusal(student.id);
  if (incomplete) return incomplete;
  const paymentDate = isoDate(arg["paymentDate"]) || todayIso();
  if (daysBetween(paymentDate, todayIso()) > 0) {
    return { ok: false, code: "FUTURE_PAYMENT_DATE", error: "The payment date is in the future. Enter the day the money actually came in." };
  }
  const lockedDraft = await closedMonthRefusal(paymentDate);
  if (lockedDraft) return lockedDraft;

  // Brief §6.1/§1.3: a payment against an instalment plan is its own
  // schedule, verified against the server's own item, not trusted from the
  // client — a mismatched amount is refused, never silently accepted.
  const instalmentItemId = s(arg["instalmentItemId"]).trim();
  let instalmentPlanId: string | null = null;
  if (instalmentItemId) {
    const item = await queryOne<{ id: string; plan_id: string; amount: string; status: string; plan_student_id: string; plan_status: string }>(
      `select i.id, i.plan_id, i.amount, i.status, p.student_id as plan_student_id, p.status as plan_status
       from instalment_plan_items i join instalment_plans p on p.id = i.plan_id
       where i.id = $1`,
      [instalmentItemId],
    );
    if (!item || item.plan_student_id !== student.id || item.plan_status !== "ACTIVE") {
      return { ok: false, code: "INSTALMENT_ITEM_INVALID", error: "This instalment does not belong to an active plan for this student." };
    }
    if (item.status !== "PENDING") return { ok: false, code: "INSTALMENT_ALREADY_PAID", error: "This instalment is already paid." };
    if (Math.round(n(item.amount) * 100) !== Math.round(amount * 100)) {
      return { ok: false, code: "AMOUNT_MISMATCH", error: `This instalment is ₹${item.amount}, not ₹${amount}.` };
    }
    instalmentPlanId = item.plan_id;
  }

  const months = Number(arg["monthsPaid"]);
  const draftId = newId("PDRAFT");
  await query(
    `insert into payment_drafts
       (id, status, student_id, student_name, amount, payment_mode, branch, terms_status, repair_required, submitted_by,
        payment_date, payment_reference, physical_receipt_no, package_start_date, months_paid, notes, client_intent_key,
        instalment_plan_id, instalment_item_id)
     values ($1,'SUBMITTED',$2,$3,$4,$5,$6,'',false,$7,$8::date,$9,$10,$11::date,$12,$13,$14,$15,$16)`,
    [
      draftId, student.id, student.name, amount, s(arg["paymentMode"]) || "UPI", branch,
      session?.deviceLabel || session?.email || "",
      paymentDate, reference || null, receiptBookNo || null,
      isoDate(arg["packageStartDate"]) || null, Number.isInteger(months) && months > 0 ? months : null,
      s(arg["notes"]).trim() || null, intentKey,
      instalmentPlanId, instalmentItemId || null,
    ],
  );
  await bumpRevisions(["payments", "approvals", "tasks"]);
  notifyFounderApproval("Fee payment", "a payment draft to approve", draftId);
  return ok({
    draftId,
    status: "SUBMITTED",
    amount,
    studentName: student.name,
    routine: { selfServe: false },
    backdated: isBackdated(paymentDate, todayIso()),
    receiptNo: "",
    persisted: true,
    // Brief pattern B: a proposal, not a saved payment.
    note: "Sent for approval.",
  });
}

async function listPaymentDrafts(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const rows = await query<Record<string, unknown>>(
    `select id, status, student_id, student_name, amount, payment_mode, branch, terms_status, projected_next_due_date, repair_required, submitted_by, submitted_at, approval_authority, approved_by
     from payment_drafts order by submitted_at desc limit 200`,
  );
  const out = rows.map((r) => ({
    draftId: s(r.id),
    status: s(r.status),
    studentId: s(r.student_id),
    studentName: s(r.student_name),
    amount: s(r.amount),
    paymentMode: s(r.payment_mode),
    branch: s(r.branch),
    // Blank means not recorded — never "accepted" (brief §11.9).
    termsStatus: s(r.terms_status),
    projectedNextDueDate: s(r.projected_next_due_date),
    repairRequired: r.repair_required === true,
    submittedAt: d(r.submitted_at),
    approvalAuthority: s(r.approval_authority) || "FOUNDER",
    approvedBy: s(r.approved_by),
  }));
  return ok({ count: out.length, rows: out, waitingOnTermsCount: 0 });
}

async function paymentDraftApprove(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const draftId = s(arg["draftId"]);
  if (!draftId) return { ok: false, code: "DRAFT_ID_REQUIRED", error: "draftId required" };
  const current = await queryOne<{ status: string; approved_by: string; branch: string }>(`select status, approved_by, branch from payment_drafts where id = $1`, [draftId]);
  if (!current) return { ok: false, code: "DRAFT_NOT_FOUND", error: `No payment draft ${draftId}` };
  if (current.status === "APPROVED" || current.status === "FINALISED") {
    return ok({ changed: false, draftId, status: current.status, approvedBy: current.approved_by, idempotent: true });
  }
  if (current.status !== "SUBMITTED") return { ok: false, code: "NOT_SUBMITTED", error: `Draft status ${current.status}` };
  await query(
    `update payment_drafts set status = 'APPROVED', approval_authority = 'FOUNDER', approved_by = $2, approved_at = now()
     where id = $1 and status = 'SUBMITTED'`,
    [draftId, session?.email ?? ""],
  );
  await bumpRevisions(["payments", "approvals"]);
  if (current.branch) notifyStaffDecision(recordBranch(current.branch), "Fee payment", "approved — ready to finalise", draftId);
  return ok({ changed: true, draftId, approved: true, approvedBy: session?.email ?? "", note: "draft approved" });
}

async function paymentDraftReject(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const draftId = s(arg["draftId"]);
  const comment = s(arg["comment"] ?? arg["reason"]).trim();
  if (!draftId) return { ok: false, code: "DRAFT_ID_REQUIRED", error: "draftId required" };
  if (!comment) return { ok: false, code: "REASON_REQUIRED", error: "Give a reason so staff know what to fix." };
  const rows = await query<{ id: string; branch: string }>(
    `update payment_drafts set status = 'REJECTED', decision_note = $2, approved_by = $3, approved_at = now()
     where id = $1 and status in ('SUBMITTED','APPROVED') returning id, branch`,
    [draftId, comment, session?.email ?? ""],
  );
  if (!rows.length) return { ok: false, code: "DRAFT_NOT_FOUND", error: `No payment draft ${draftId} awaiting a decision` };
  await bumpRevisions(["payments", "approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Fee payment", "rejected — see the reason", draftId);
  return ok({ changed: true, draftId, rejected: true, note: comment });
}

async function finalisePaymentDraft(arg: Record<string, unknown>, role: RpcRole, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  const draftId = s(arg["draftId"]);
  if (!draftId) return { ok: false, code: "NO_DRAFT", error: "draftId required" };
  return withTransaction(async (tx) => {
    // Row lock: a second finalise of the same draft waits, then sees FINALISED.
    const draft = await tx.queryOne<Record<string, unknown>>(`select * from payment_drafts where id = $1 for update`, [draftId]);
    if (!draft) return { ok: false, code: "NOT_FOUND", error: `No draft ${draftId}` };
    if (!inScope(scope, draft.branch)) return branchForbidden(recordBranch(draft.branch));
    if (s(draft.status) === "FINALISED" && s(draft.finalised_receipt_no)) {
      return ok({ changed: false, draftId, status: "FINALISED", receiptNo: s(draft.finalised_receipt_no), finalisedBy: s(draft.approved_by), idempotent: true, financialWrites: false, note: "already finalised (idempotent revisit)" });
    }
    if (s(draft.status) !== "APPROVED") {
      return { ok: false, code: "NOT_APPROVED", error: `Draft status ${s(draft.status)} — only APPROVED drafts can finalise` };
    }
    const studentId = s(draft.student_id);
    const paidOn = d(s(draft.payment_date)) || todayIso();
    const locked = await closedMonthRefusal(paidOn, tx);
    if (locked) return locked;
    const receiptNo = await writeReceipt(tx, {
      studentId,
      studentName: s(draft.student_name),
      amount: n(draft.amount),
      mode: s(draft.payment_mode) || "UPI",
      branch: recordBranch(draft.branch),
      paidOn,
      txnId: s(draft.payment_reference),
      receiptBookNo: s(draft.physical_receipt_no),
      periodFrom: s(draft.package_start_date),
      periodTo: "",
      intentKey: null,
      description: (no) => `Receipt ${no} finalised from draft ${draftId}`,
    });
    await tx.query(
      "update payment_drafts set status = 'FINALISED', finalised_receipt_no = $2, finalised_at = now() where id = $1",
      [draftId, receiptNo],
    );
    const instalmentItemId = s(draft.instalment_item_id);
    let nextDueDate: string | null = null;
    if (studentId) {
      // A first payment starts a new admission; it never overrides a status the
      // founder set (PAUSED, LEFT, ...), which is a separate decision (brief P2).
      await tx.query("update students_acad set status = 'ACTIVE' where id = $1 and coalesce(status,'') in ('','NEW','PENDING')", [studentId]);
      // An instalment plan runs on its own schedule — it never advances the
      // student's regular monthly due-date cycle (brief §1.3: two truths,
      // never merged).
      if (!instalmentItemId) {
        nextDueDate = await advanceStudentCycle(tx, studentId, paidOn, receiptNo);
      }
    }
    if (instalmentItemId) {
      await tx.query(`update instalment_plan_items set status = 'PAID', paid_receipt_no = $2 where id = $1`, [instalmentItemId, receiptNo]);
      const planId = s(draft.instalment_plan_id);
      const remaining = await tx.queryOne<{ count: string }>(`select count(*)::text as count from instalment_plan_items where plan_id = $1 and status = 'PENDING'`, [planId]);
      if (n(remaining?.count) === 0) {
        await tx.query(`update instalment_plans set status = 'COMPLETED' where id = $1`, [planId]);
      }
    }
    await bumpRevisions(["receipts", "payments", "approvals", "students", "dashboard", "tasks"], tx);
    notifyBranch(recordBranch(draft.branch), "Receipt issued", `${receiptNo} · ${s(draft.student_name)} · ₹${n(draft.amount)}`, receiptNo);
    return ok({
      changed: true,
      draftId,
      status: "FINALISED",
      receiptNo,
      pdfUrl: "",
      idempotent: false,
      financialWrites: true,
      nextDueDate: nextDueDate ?? "",
      finalisedBy: session?.email ?? (role === "FOUNDER_ADMIN" ? "founder" : "staff"),
      note: nextDueDate ? `receipt + ledger written; next due ${nextDueDate}` : "receipt + ledger written",
    });
  });
}

// --------------------------------------------------------------- helpers re-export used across handlers
export { ok, s, n, d };


