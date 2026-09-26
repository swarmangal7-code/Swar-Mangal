import { query, queryOne, withTransaction } from "@/lib/db";
import type { RpcRole, RpcSession } from "@/lib/rpc/auth";
import { s, n, d, newId, newPersonId, nextDocNo, bumpRevisions, currentRevisions, acadStudents, acadStudentById, acadTeachers, acadTeacherById, studentToRpc, studentsToRpc, teacherToRpc, classSummary } from "@/lib/rpc/shared";
import { schoolInvoiceSeries } from "@/lib/rpc/numbering";
import { amountRupees, feeState, todayIso, daysUntil, DEFAULT_ADVANCE_DAYS, type FeeState } from "@/lib/rpc/fees";
import { normalizeIndianMobile } from "@/lib/whatsapp/phone";
import { gatewayConfigFromEnv } from "@/lib/whatsapp/gateway";
import { money, payoutStatus, payoutBalance, isServiceMonth } from "@/lib/rpc/payouts";
import {
  ALL_BRANCHES,
  branchForbidden,
  defaultBranch,
  inScope,
  makeScope,
  matchesRequestedBranch,
  moneyInScope,
  recordBranch,
  type BranchScope,
} from "@/lib/rpc/scope";
import { notifyBranch, notifyFounderGeneric } from "@/lib/push/notify";
import {
  CUSTOM_KINDS,
  DORMANT_RECALL_DAYS,
  DORMANT_RECALL_LIMIT,
  PAUSED_REVIEW_AFTER_DAYS,
  EXPECTED_EVENTS_FLOOR,
  TERMINAL_INQUIRY_STATUSES,
  addDays,
  customSessionRefusal,
  earningBaseFromEnv,
  excludedReceiptSql,
  expenseCategoryRefusal,
  inquiryFinalStatus,
  INQUIRY_DORMANT_AFTER_DAYS,
  isBackdated,
  isExcludedReceiptStatus,
  monthEndExclusive,
  monthLabel,
  noAnswerStep,
  priceTeacherLine,
  unsettleableClasses,
} from "@/lib/rpc/rules";
import { closedMonthRefusal, expectedClassesBetween, governanceApprovalItems } from "@/lib/rpc/governance";
import { notifyFounderApproval, notifyStaffDecision } from "@/lib/push/notify";

const ok = (extra: Record<string, unknown> = {}) => ({ ok: true, ...extra });

export async function dispatch2(role: RpcRole, fn: string, arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  switch (fn) {
    case "api_dashboard":
      return dashboard(arg, scope);
    case "api_dueReminders":
      return dueReminders(scope);
    case "api_cashbookReport":
      return cashbook(arg, scope);
    case "api_addExpenseEntry":
      return addExpense(arg, scope);
    case "api_staff_submitExpenseDraft":
      return submitExpenseDraft(arg, scope, session);
    case "api_founder_expenseDraftApprove":
      return expenseDraftApprove(arg, session);
    case "api_founder_expenseDraftReject":
      return expenseDraftReject(arg, session);
    case "api_listTeachers":
      return listTeachers();
    case "api_addTeacher":
      return addTeacher(arg);
    case "api_staff_requestAddTeacher":
      return requestAddTeacher(arg, scope, session);
    case "api_founder_addTeacherRequestApprove":
      return addTeacherRequestApprove(arg, session);
    case "api_founder_addTeacherRequestReject":
      return addTeacherRequestReject(arg, session);
    case "api_teacherAttendanceReport":
      return teacherAttendanceReport(arg, scope);
    case "api_teacherProfile":
      return teacherProfile(arg, scope);
    case "api_updateTeacherStatus":
      return updateTeacherStatus(arg, session);
    case "api_updateTeacherCompensation":
      return updateTeacherCompensation(arg);
    case "api_teacherPayoutPreview":
      return payoutPreview(arg);
    case "api_recordTeacherPayout":
      return recordTeacherPayout(arg, scope);
    case "api_teacherPayoutHistory":
      return payoutHistory(arg);
    case "api_assignSharedStudent":
      return assignSharedStudent(arg);
    case "api_generateSchoolInvoice":
      return generateSchoolInvoice(arg, scope);
    case "api_listSchoolInvoices":
      return listSchoolInvoices(arg, scope);
    case "api_getSchoolInvoice":
      return getSchoolInvoice(arg, scope);
    case "api_timetableList":
      return timetableList(arg, scope);
    case "api_timetableCreate":
      return timetableCreate(arg, scope);
    case "api_timetableUpdate":
      return timetableUpdate(arg, scope);
    case "api_timetableDelete":
      return timetableDelete(arg, scope);
    case "api_staff_attendanceRoster":
      return attendanceRoster(arg, scope);
    case "api_staff_markAttendance":
      return markAttendance(arg, scope, session);
    case "api_staff_todaysTasks":
    case "api_staff_doToday":
      return todaysTasks(arg, scope);
    case "api_staff_todaysClasses":
      return todaysClasses(arg, scope);
    case "api_staff_resolveTodaysClass":
      return resolveTodaysClass(arg, scope, session);
    case "api_staff_scheduleSession":
      return scheduleSession(arg, scope);
    case "api_staff_sessionRoster":
      return sessionRoster(arg, scope);
    case "api_staff_feeDueList":
      return feeDueList(arg, scope);
    case "api_staff_inquiryQueue":
      return inquiryQueue(arg, scope);
    case "api_staff_inquiryQuickAdd":
      return inquiryQuickAdd(arg, scope, session);
    case "api_staff_inquiryTransition":
      return inquiryTransition(arg, scope, session);
    case "api_staff_inquiryDetail":
      return inquiryDetail(arg, scope);
    case "api_founder_approvalsList":
      return founderApprovals();
    case "api_founder_approvalItemDetail":
      return approvalItemDetail(arg);
    case "api_founder_auditLog":
      return auditLog(arg);
    case "api_staff_listMyApprovals":
      return staffMyRequests(scope, session);
    case "api_staff_commGenerate":
      return commGenerate(arg, scope);
    case "api_syncChanges":
      return syncChanges(arg);
    case "api_founder_sendDailyDigest":
      return sendDailyDigest();
    default:
      return { ok: false, code: "UNKNOWN_API", error: `No gateway handler for ${fn}` };
  }
}

/**
 * Fees due/overdue reminders, one push per branch plus a founder-wide total.
 * Meant to be called once a day by an external cron hitting this RPC with
 * the founder token (see deploy/README.md) — nothing in this app schedules
 * anything itself (brief §2.4: no triggers). A no-op with no push tokens
 * registered or no Firebase project configured; safe to call any time.
 */
async function sendDailyDigest(): Promise<Record<string, unknown>> {
  let totalDueToday = 0;
  let totalOverdue = 0;
  for (const branch of ALL_BRANCHES) {
    const { by } = await dueBuckets(makeScope([branch]));
    totalDueToday += by.DUE_TODAY.length;
    totalOverdue += by.OVERDUE.length;
    if (by.DUE_TODAY.length === 0 && by.OVERDUE.length === 0) continue;
    const parts = [
      by.DUE_TODAY.length ? `${by.DUE_TODAY.length} due today` : "",
      by.OVERDUE.length ? `${by.OVERDUE.length} overdue` : "",
    ].filter(Boolean);
    notifyBranch(branch, "Fees today", parts.join(" · "), branch);
  }
  if (totalDueToday || totalOverdue) {
    notifyFounderGeneric(
      "Fees today",
      `Academy-wide: ${totalDueToday} due today, ${totalOverdue} overdue.`,
      "ALL",
    );
  }
  return ok({ sent: true, totalDueToday, totalOverdue });
}

// -------------------------------------------------------------- dashboard
async function dashboard(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const today = todayIso();
  const [ledAll, receiptsAll] = await Promise.all([
    query<{ inflow: string; amount: string; entry_date: string; payment_mode: string; party_name: string; branch: string }>(
      `select inflow, amount, entry_date::text, payment_mode, party_name, branch from money_ledger
       where entry_date >= date_trunc('month', current_date) and coalesce(upper(status),'ACTIVE') not like '%VOID%'
       order by entry_date desc`,
    ),
    query<{ receipt_no: string; amount: string; payment_mode: string; status: string; party_name: string; branch: string; created_at: string }>(
      `select receipt_no, amount, payment_mode, status, party_name, branch, created_at::text from receipts order by id desc limit 100`,
    ),
  ]);
  const led = ledAll.filter((r) => moneyInScope(scope, r.branch));
  const receipts = receiptsAll.filter((r) => moneyInScope(scope, r.branch)).slice(0, 12);

  // Money in only: expenses share this table as outflow rows.
  const inflowOf = (r: { inflow: string }) => (n(r.inflow) > 0 ? n(r.inflow) : 0);
  const monthCollection = led.reduce((a, r) => a + inflowOf(r), 0);
  const todayRows = led.filter((r) => d(r.entry_date) === today);
  const todayCollection = todayRows.reduce((a, r) => a + inflowOf(r), 0);
  const onlineToday = todayRows
    .filter((r) => s(r.payment_mode).toUpperCase() !== "CASH")
    .reduce((a, r) => a + inflowOf(r), 0);
  const cashToday = todayCollection - onlineToday;
  const { by: founderBy } = await dueBuckets(scope);
  const [due, approvalsCount, overview, cards] = await Promise.all([
    dueReminders(scope),
    pendingApprovalsCount(scope),
    dashboardOverviewSections(scope, today),
    buildTodoCards(scope, today, founderBy, true),
  ]);

  return ok({
    cards,
    todayCollection,
    monthCollection,
    todayCount: todayRows.filter((r) => inflowOf(r) > 0).length,
    monthCount: led.filter((r) => inflowOf(r) > 0).length,
    cashToday,
    onlineToday,
    scope: s(arg["scope"] ?? "ALL"),
    consolidated: s(arg["scope"] ?? "ALL") === "ALL",
    approvalsCount,
    metrics: {
      dueTodayCount: (due["dueToday"] as unknown[]).length,
      dueSoonCount: (due["dueSoon"] as unknown[]).length,
      overdueCount: (due["overdue"] as unknown[]).length,
      feePlanMissingCount: Number(due["notRecorded"] ?? 0),
      termsPendingCount: 0,
    },
    ...overview,
    recent: receipts.map((r) => ({
      receiptNo: s(r.receipt_no),
      date: d(r.created_at),
      student: s(r.party_name),
      studentName: s(r.party_name),
      amount: n(r.amount),
      mode: s(r.payment_mode),
      paymentMode: s(r.payment_mode),
      status: s(r.status).toUpperCase(),
      entityId: recordBranch(r.branch) === "GOREGAON" ? "ENT-GOREGAON" : "ENT-KANDIVALI",
      pdfUrl: "",
      excluded: isExcludedReceiptStatus(r.status),
      feePeriodFrom: "",
      feePeriodTo: "",
      txnId: "",
    })),
  });
}

/**
 * Splits students into real due buckets from their stored next_due_date.
 * A student with no recorded due date lands in "notRecorded" — the app says
 * so instead of calling them overdue, which is what this used to do to every
 * active student.
 */
async function dueBuckets(scope: BranchScope, requestedBranch: string = "ALL") {
  const students = (await acadStudents()).filter(
    (x) => inScope(scope, x.branch) && matchesRequestedBranch(requestedBranch, x.branch),
  );
  const today = todayIso();
  const by: Record<FeeState, typeof students> = {
    OVERDUE: [], DUE_TODAY: [], DUE_SOON: [], PAID: [], UNKNOWN: [], INACTIVE: [],
  };
  for (const x of students) by[feeState(x.next_due_date, today, { status: x.status })].push(x);
  return { students, today, by };
}

async function dueReminders(scope: BranchScope): Promise<Record<string, unknown>> {
  const { by } = await dueBuckets(scope);
  const cls = await classSummary();
  // Only the students actually being chased are expanded (bounded work).
  const rows = async (xs: Awaited<ReturnType<typeof acadStudents>>) =>
    (await studentsToRpc(xs)).map((st) => ({
      studentId: st.studentId,
      studentName: st.studentName,
      phone: st.phone,
      classCode: st.classCode,
      instrument: st.instrument,
      nextDueDate: st.nextDueDate,
      feeStatus: st.feeStatus,
      lastReceiptNo: st.lastReceiptNo,
      amount: st.monthlyFee ?? "",
    }));
  return ok({
    branch: "ALL",
    advanceDays: DEFAULT_ADVANCE_DAYS,
    dueSoon: await rows(by.DUE_SOON),
    dueToday: await rows(by.DUE_TODAY),
    overdue: await rows(by.OVERDUE),
    // Students whose fee plan the academy has not recorded yet.
    notRecorded: by.UNKNOWN.length,
    upToDate: by.PAID.length,
    gmcActive: cls.gmc,
    kmcActive: cls.kmc,
  });
}

// -------------------------------------------------------- dashboard overview
// Shared by the staff "Today" screen and the founder "Home" screen, so both
// read the exact same server-computed sections (brief: the client never
// derives a business figure; it only renders what the server sent).

/** How many staff drafts/requests are currently waiting on the founder. */
async function pendingApprovalsCount(scope: BranchScope): Promise<number> {
  const waiting = (
    await query<{ branch: string }>(
      `select branch from payment_drafts where status = 'SUBMITTED'
       union all select branch from expense_drafts where status = 'SUBMITTED'
       union all select branch from student_drafts where status = 'SUBMITTED'
       union all select branch from receipt_corrections where status = 'SUBMITTED'
       union all select branch from school_invoice_drafts where status = 'SUBMITTED'`,
    )
  ).filter((r) => inScope(scope, r.branch));
  return waiting.length;
}

/** Today's attendance marks vs the active roster — honest counts, not a guess. */
async function attendanceSummaryToday(scope: BranchScope, today: string, requestedBranch: string = "ALL"): Promise<Record<string, unknown>> {
  const active = (await acadStudents()).filter(
    (x) => inScope(scope, x.branch) && matchesRequestedBranch(requestedBranch, x.branch) && s(x.status).toUpperCase() === "ACTIVE",
  );
  const marks = (
    await query<{ student_id: string; status: string; branch: string }>(
      `select a.student_id, a.status, coalesce(s.branch, '') as branch
       from attendance_acad a left join students_acad s on s.id = a.student_id
       where a.session_date = $1`,
      [today],
    )
  ).filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(requestedBranch, r.branch));
  const byStudent = new Map(marks.map((m) => [m.student_id, s(m.status).toUpperCase()]));
  const counts = { PRESENT: 0, ABSENT: 0, EXCUSED: 0, LATE: 0 } as Record<string, number>;
  let marked = 0;
  for (const st of active) {
    const state = byStudent.get(st.id);
    if (state && state in counts) {
      counts[state]++;
      marked++;
    }
  }
  return {
    date: today,
    totalActive: active.length,
    marked,
    notMarked: Math.max(0, active.length - marked),
    present: counts.PRESENT,
    absent: counts.ABSENT,
    excused: counts.EXCUSED,
    late: counts.LATE,
  };
}

/** Today's lectures, grouped by teacher, so a gap in delivery shows by name. */
function teacherAttendanceFromClasses(rows: Record<string, unknown>[]): Record<string, unknown> {
  const byTeacher = new Map<string, { teacherId: string; teacherName: string; scheduled: number; held: number; cancelled: number; substituted: number; unanswered: number }>();
  for (const r of rows) {
    const teacherId = s(r.teacherId) || s(r.teacherName);
    if (!teacherId) continue;
    const row = byTeacher.get(teacherId) ?? {
      teacherId: s(r.teacherId), teacherName: s(r.teacherName), scheduled: 0, held: 0, cancelled: 0, substituted: 0, unanswered: 0,
    };
    row.scheduled++;
    const outcome = s(r.outcome).toUpperCase();
    if (!r.resolved) row.unanswered++;
    else if (outcome === "HELD") row.held++;
    else if (outcome === "SUBSTITUTE_DELIVERED") row.substituted++;
    else if (outcome === "TEACHER_CANCELLED" || outcome === "ACADEMY_CANCELLED") row.cancelled++;
    byTeacher.set(teacherId, row);
  }
  const teachers = [...byTeacher.values()].sort((a, b) => (a.teacherName < b.teacherName ? -1 : 1));
  return { teachers, scheduledToday: rows.length, unansweredToday: rows.filter((r) => !r.resolved).length };
}

/**
 * The dashboard's "Teacher attendance" card only ever shows today. This is
 * the same computation over any date range — a dedicated screen for
 * founder and staff alike, read-only, nothing to approve here.
 */
async function teacherAttendanceReport(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const today = todayIso();
  const from = isoDate(arg["from"]) || today.slice(0, 8) + "01";
  const to = isoDate(arg["to"]) || today;
  const teacherId = s(arg["teacherId"]).trim() || undefined;
  const classes = await expectedClassesBetween(from, addDays(to, 1), { scope, teacherId });
  const rows = classes.map((c) => ({ ...c, teacherName: c.teacher }));
  const report = teacherAttendanceFromClasses(rows as unknown as Record<string, unknown>[]);
  return ok({ from, to, ...report });
}

/** The full set of sections both dashboards render. Read-only; writes nothing. */
async function dashboardOverviewSections(scope: BranchScope, today: string, requestedBranch: string = "ALL") {
  const [classesToday, inquiryRows, { by }] = await Promise.all([
    todaysClasses({ date: today, branch: requestedBranch }, scope),
    query<Record<string, unknown>>(
      `select id, name, phone, branch, status, next_contact_date::text, last_contacted_at::text from inquiries`,
    ).then((rows) => rows.filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(requestedBranch, r.branch))),
    dueBuckets(scope, requestedBranch),
  ]);
  const classRows = (classesToday.rows as Record<string, unknown>[]) ?? [];
  const [attendance, callToday, feesDueTodaySample] = await Promise.all([
    attendanceSummaryToday(scope, today, requestedBranch),
    callTheseToday(scope, inquiryRows),
    studentsToRpc(by.DUE_TODAY.slice(0, 5)),
  ]);
  const openInquiries = inquiryRows.filter((r) => !TERMINAL_INQUIRY_STATUSES.has(s(r.status).toUpperCase()));
  return {
    feesDueToday: {
      count: by.DUE_TODAY.length,
      overdueCount: by.OVERDUE.length,
      dueSoonCount: by.DUE_SOON.length,
      rows: feesDueTodaySample.map((st) => ({ studentId: st.studentId, studentName: st.studentName, classCode: st.classCode, phone: st.phone })),
    },
    todaysLectures: {
      count: classRows.length,
      unanswered: classRows.filter((r) => !r.resolved).length,
      rows: classRows.slice(0, 8),
    },
    attendanceSummary: attendance,
    enquiries: {
      openCount: openInquiries.length,
      callTodayCount: callToday.length,
      rows: callToday.slice(0, 5).map((r) => ({ inquiryId: s(r.id), name: s(r.name), phone: s(r.phone) })),
    },
    teacherAttendance: teacherAttendanceFromClasses(classRows),
  };
}

// ---------------------------------------------------------------- teachers
async function listTeachers(): Promise<Record<string, unknown>> {
  const rows = await acadTeachers();
  return ok({ teachers: await Promise.all(rows.map(teacherToRpc)) });
}

async function addTeacher(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const name = s(arg["name"] ?? arg["teacherName"]).trim();
  if (!name) return { ok: false, code: "NO_NAME", error: "Teacher name required" };
  const instrument = s(arg["instrument"] ?? arg["primaryRole"]) || "Music";
  const id = await newPersonId("TCH", "teachers_acad", null, instrument);
  await query(
    `insert into teachers_acad (id, name, phone, email, instrument, status) values ($1,$2,$3,$4,$5,'ACTIVE') on conflict (id) do nothing`,
    [id, name, s(arg["phone"]), s(arg["email"]), instrument],
  );
  await bumpRevisions(["teachers"]);
  return ok({ teacherId: id, teacherName: name, note: "teacher created" });
}

/**
 * addTeacher above is founder-direct; this is the staff-facing proposal —
 * staff meet new teachers day to day, so they submit the details and the
 * founder approves, same draft/approve shape as every other staff request.
 */
async function requestAddTeacher(arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  const name = s(arg["teacherName"] ?? arg["name"]).trim();
  const phone = s(arg["phone"]).trim();
  const primaryRole = s(arg["primaryRole"] ?? arg["instrument"]).trim();
  const branch = s(arg["branch"]).trim();
  const intent = s(arg["clientIntentKey"]).trim() || null;
  if (!name) return { ok: false, code: "NO_NAME", error: "Teacher name required" };
  if (branch && !inScope(scope, branch)) return branchForbidden(recordBranch(branch));
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from teacher_add_requests where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ requestId: earlier.id, status: earlier.status, idempotent: true, note: "Already sent to Sharvil." });
  }
  const id = newId("TCHREQ");
  await query(
    `insert into teacher_add_requests (id, teacher_name, phone, primary_role, branch, submitted_by, client_intent_key)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [id, name, phone, primaryRole, branch, session?.deviceLabel || session?.email || "", intent],
  );
  await bumpRevisions(["approvals"]);
  notifyFounderApproval("New teacher", `${name} — submitted for approval`, id);
  return ok({ requestId: id, changed: true, note: "Sent to Sharvil for approval." });
}

async function addTeacherRequestApprove(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  if (!id) return { ok: false, code: "REQUEST_ID_REQUIRED", error: "Pick the request." };
  const req = await queryOne<{ id: string; teacher_name: string; phone: string; primary_role: string; status: string }>(
    `select id, teacher_name, phone, primary_role, status from teacher_add_requests where id = $1`,
    [id],
  );
  if (!req) return { ok: false, code: "NOT_FOUND", error: `No teacher request ${id}` };
  if (req.status === "APPROVED") return ok({ requestId: id, changed: false, idempotent: true });
  if (req.status !== "SUBMITTED") return { ok: false, code: "NOT_PENDING", error: `Request is already ${req.status}.` };
  const instrument = req.primary_role || "Music";
  const teacherId = await newPersonId("TCH", "teachers_acad", null, instrument);
  await query(
    `insert into teachers_acad (id, name, phone, email, instrument, status) values ($1,$2,$3,'',$4,'ACTIVE') on conflict (id) do nothing`,
    [teacherId, req.teacher_name, req.phone, instrument],
  );
  await query(
    `update teacher_add_requests set status = 'APPROVED', decided_by = $2, decided_at = now(), teacher_id = $3 where id = $1`,
    [id, session?.email ?? "", teacherId],
  );
  await bumpRevisions(["approvals", "teachers"]);
  return ok({ requestId: id, changed: true, status: "APPROVED", teacherId });
}

async function addTeacherRequestReject(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const id = s(arg["requestId"] ?? arg["itemId"]).trim();
  const reason = s(arg["reason"]).trim();
  if (!id) return { ok: false, code: "REQUEST_ID_REQUIRED", error: "Pick the request." };
  if (!reason) return { ok: false, code: "REASON_REQUIRED", error: "Say why this teacher isn't being added." };
  const rows = await query<{ id: string }>(
    `update teacher_add_requests set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id`,
    [id, session?.email ?? "", reason],
  );
  if (!rows.length) return { ok: false, code: "NOT_FOUND", error: `No pending teacher request ${id}` };
  await bumpRevisions(["approvals"]);
  return ok({ requestId: id, changed: true, status: "REJECTED" });
}

async function teacherProfile(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const id = s(arg["teacherId"]);
  const t = id ? await acadTeacherById(id) : (await acadTeachers())[0];
  if (!t) return { ok: false, code: "NO_TEACHER", error: `No teacher ${id}` };
  const trpc = await teacherToRpc(t);
  const students = (await acadStudents()).filter((x) => inScope(scope, x.branch));
  const myStudents = (await studentsToRpc(students)).filter((st) => st.teacherId === t.id);
  // Receipts this calendar month from the students this teacher teaches —
  // the old query counted every active receipt ever and called it a month.
  const receipts = await query<{ c: string }>(
    `select count(*)::text as c from receipts r
     where r.status = 'ACTIVE'
       and r.created_at >= date_trunc('month', current_date)
       and r.student_id in (select distinct student_id from attendance_acad
                            where teacher_id = $1 and coalesce(student_id,'') <> '')`,
    [t.id],
  );
  return ok({
    teacher: {
      ...trpc,
      compensationPercent: trpc.academyShare,
      compensationEffectiveFrom: "2026-07-01",
    },
    students: myStudents.slice(0, 50),
    receiptCountThisMonth: Number(receipts[0]?.c ?? 0),
  });
}

/**
 * Mirrors createWinBackLeadIfNeeded (handlers.ts) for teachers: when a
 * teacher's status becomes LEFT (the founder's "Delete" action), they don't
 * just disappear — they land in the same Inquiries pipeline as a re-engage
 * lead, tagged source='Former Teacher' so staff can tell them apart from
 * former-student leads. Idempotent per teacher.
 */
async function createTeacherWinBackLeadIfNeeded(teacherId: string, reason: string): Promise<void> {
  const already = await queryOne<{ id: string }>(`select id from inquiries where former_teacher_id = $1`, [teacherId]);
  if (already) return;
  const teacher = await acadTeacherById(teacherId);
  if (!teacher) return;
  await query(
    `insert into inquiries (id, name, phone, instrument, source, notes, status, created_at, next_contact_date, former_teacher_id, updated_at)
     values ($1,$2,$3,$4,'Former Teacher',$5,'OPEN',current_date,current_date + 1,$6,now())`,
    [newId("INQ"), teacher.name, teacher.phone, teacher.instrument, `Left the academy: ${reason}`, teacherId],
  );
}

async function updateTeacherStatus(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const id = s(arg["teacherId"]);
  const status = s(arg["newStatus"] ?? arg["status"]).toUpperCase();
  const reason = s(arg["reason"]).trim();
  if (!id || !status) return { ok: false, code: "MISSING", error: "teacherId and newStatus required" };
  const before = await acadTeacherById(id);
  if (!before) return { ok: false, code: "NOT_FOUND", error: `No teacher ${id}` };
  await query("update teachers_acad set status = $1 where id = $2", [status, id]);
  if (status === "LEFT") await createTeacherWinBackLeadIfNeeded(id, reason || "removed by founder");
  await bumpRevisions(["teachers", "inquiries"]);
  return ok({ teacherId: id, oldStatus: s(before.status), newStatus: status, message: reason || "updated", changedBy: session?.email ?? "" });
}

async function updateTeacherCompensation(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const id = s(arg["teacherId"]);
  const pct = n(arg["percentage"]);
  if (!id || pct < 0 || pct > 100) return { ok: false, code: "BAD_PCT", error: "percentage 0..100 required" };
  const existing = await queryOne<{ id: string }>(`select id from payout_rules where teacher_id = $1 order by id limit 1`, [id]);
  if (existing) {
    await query("update payout_rules set percentage = $1 where id = $2", [pct, existing.id]);
  } else {
    await query(
      `insert into payout_rules (id, teacher_id, teacher_name, entity_id, course, payout_type, percentage) values ($1,$2,$3,'ENT-KANDIVALI','', 'PERCENTAGE',$4)`,
      [newId("PRULE"), id, s(arg["teacherName"]), pct],
    );
  }
  await bumpRevisions(["teachers", "payouts"]);
  return ok({ changed: true, teacherId: id, oldPercentage: "", newPercentage: String(pct), effectiveFrom: s(arg["effectiveFrom"]) || "2026-07-01", reason: s(arg["reason"]), auditWritten: true, note: "compensation updated" });
}

/**
 * Teacher payout preview for one month.
 *
 * The previous version joined receipts to attendance on student NAME and
 * counted a receipt once per attendance row, so a student with twenty marked
 * classes inflated their teacher's collection twentyfold (capped at an
 * arbitrary 50 rows), and the requested month was ignored entirely.
 *
 * Now: a receipt counts once, is attributed through the student id it was
 * written with, and only counts inside the requested month. Receipts that
 * cannot be attributed are reported rather than silently dropped.
 */
async function payoutPreview(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const month = isServiceMonth(s(arg["month"])) ? s(arg["month"]) : todayIso().slice(0, 7);
  const monthStart = `${month}-01`;
  const teachers = await acadTeachers();

  const [monthLinks, links, receipts, rules, paidRows, attributions, studentNames] = await Promise.all([
    // Who actually taught this student during the month, and how often.
    query<{ teacher_id: string; student_id: string; classes: string }>(
      `select teacher_id, student_id, count(*)::text as classes from attendance_acad
       where coalesce(teacher_id,'') <> '' and coalesce(student_id,'') <> ''
         and session_date >= $1::date and session_date < ($1::date + interval '1 month')
       group by teacher_id, student_id`,
      [monthStart],
    ),
    query<{ teacher_id: string; student_id: string }>(
      `select distinct teacher_id, student_id from attendance_acad
       where coalesce(teacher_id,'') <> '' and coalesce(student_id,'') <> ''`,
    ),
    query<{ id: string; student_id: string | null; amount: string; branch: string | null }>(
      `select id, student_id, amount, branch from receipts
       where not ${excludedReceiptSql("status")} and created_at >= $1::date and created_at < ($1::date + interval '1 month')`,
      [monthStart],
    ),
    query<{ teacher_id: string; payout_type: string; percentage: string }>(
      `select distinct on (teacher_id) teacher_id, payout_type, percentage from payout_rules order by teacher_id, id`,
    ),
    query<{ teacher_id: string; paid: string; payments: string }>(
      `select teacher_id, sum(amount)::text as paid, count(*)::text as payments
       from teacher_payouts where service_month = $1 group by teacher_id`,
      [month],
    ),
    query<{ student_id: string; teacher_id: string; amount: string }>(
      `select student_id, teacher_id, amount from payout_attributions where service_month = $1`,
      [month],
    ),
    query<{ id: string; name: string }>(`select id, name from students_acad`),
  ]);
  const paidOf = new Map(paidRows.map((r) => [r.teacher_id, { paid: n(r.paid), payments: Number(r.payments) || 0 }]));
  const nameOf = new Map(studentNames.map((r) => [r.id, r.name]));

  // Teachers of a student, preferring the ones who taught them in the month.
  const monthTeachers = new Map<string, Map<string, number>>();
  for (const l of monthLinks) {
    if (!monthTeachers.has(l.student_id)) monthTeachers.set(l.student_id, new Map());
    monthTeachers.get(l.student_id)!.set(l.teacher_id, Number(l.classes) || 0);
  }
  const everTeachers = new Map<string, Set<string>>();
  for (const l of links) {
    if (!everTeachers.has(l.student_id)) everTeachers.set(l.student_id, new Set());
    everTeachers.get(l.student_id)!.add(l.teacher_id);
  }
  const teachersOf = (sid: string): string[] => {
    const inMonth = monthTeachers.get(sid);
    if (inMonth?.size) return [...inMonth.keys()];
    return [...(everTeachers.get(sid) ?? [])];
  };
  const ruleOf = new Map(rules.map((r) => [r.teacher_id, r]));

  const byStudent = new Map<string, { amount: number; count: number }>();
  let unattributed = 0;
  let unattributedAmount = 0;
  for (const r of receipts) {
    const sid = s(r.student_id);
    if (!sid) {
      unattributed++;
      unattributedAmount += n(r.amount);
      continue;
    }
    const cur = byStudent.get(sid) ?? { amount: 0, count: 0 };
    cur.amount += n(r.amount);
    cur.count += 1;
    byStudent.set(sid, cur);
  }

  // Founder decisions for shared students this month.
  const decided = new Map<string, Map<string, number>>();
  for (const a of attributions) {
    if (!decided.has(a.student_id)) decided.set(a.student_id, new Map());
    decided.get(a.student_id)!.set(a.teacher_id, n(a.amount));
  }

  // Split each paying student's fee into per-teacher credit.
  const creditOf = new Map<string, { amount: number; count: number }>();
  const credit = (tid: string, amount: number, count: number) => {
    const cur = creditOf.get(tid) ?? { amount: 0, count: 0 };
    cur.amount += amount;
    cur.count += count;
    creditOf.set(tid, cur);
  };
  const sharedOf = new Map<string, number>();
  const awaitingDecision: Record<string, unknown>[] = [];

  for (const [sid, agg] of byStudent) {
    const tids = teachersOf(sid);
    if (tids.length === 0) {
      unattributed++;
      unattributedAmount += agg.amount;
      continue;
    }
    if (tids.length === 1) {
      credit(tids[0], agg.amount, agg.count);
      continue;
    }
    // Shared: only what the founder has assigned counts for anybody.
    const decision = decided.get(sid);
    let assigned = 0;
    for (const tid of tids) {
      const share = money(decision?.get(tid) ?? 0);
      if (share <= 0) continue;
      credit(tid, share, 0);
      assigned += share;
      sharedOf.set(tid, (sharedOf.get(tid) ?? 0) + 1);
    }
    const remaining = money(agg.amount - assigned);
    if (remaining > 0.005) {
      const classes = monthTeachers.get(sid);
      awaitingDecision.push({
        studentId: sid,
        studentName: nameOf.get(sid) ?? sid,
        collected: money(agg.amount),
        assigned: money(assigned),
        remaining,
        receiptCount: agg.count,
        teachers: tids.map((tid) => ({
          teacherId: tid,
          teacherName: teachers.find((t) => t.id === tid)?.name ?? tid,
          classesThisMonth: classes?.get(tid) ?? 0,
          assigned: money(decision?.get(tid) ?? 0),
        })),
      });
    }
  }

  // Brief §8 / §15.1: a percentage of WHAT has not been ruled. Until
  // PAYOUT_EARNING_BASE names a base, no academy payout amount exists and each
  // line carries a named refusal instead of a number.
  const base = earningBaseFromEnv(process.env.PAYOUT_EARNING_BASE);
  const results = teachers.map((t) => {
    const rule = ruleOf.get(t.id) ?? null;
    const own = creditOf.get(t.id) ?? { amount: 0, count: 0 };
    const settled = paidOf.get(t.id) ?? { paid: 0, payments: 0 };
    const pricing = priceTeacherLine({
      rule: rule ? { payout_type: s(rule.payout_type), percentage: n(rule.percentage) } : null,
      base,
      baseAmount: money(own.amount),
      hasAttendanceHistoryOnly: false,
    });
    const priced = pricing.payable !== null;
    return {
      teacherId: t.id,
      teacherName: t.name,
      month,
      entityId: "ENT-KANDIVALI",
      receiptCount: base ? own.count : 0,
      // The attributed collection IS the base, so it is only shown once a base is ruled.
      totalCollection: base ? money(own.amount) : null,
      sharePercent: rule ? n(rule.percentage) : null,
      payoutType: s(rule?.payout_type),
      sharedStudentsAssigned: sharedOf.get(t.id) ?? 0,
      totalTeacherShare: pricing.payable,
      payable: pricing.payable,
      priced,
      alreadyPaid: money(settled.paid),
      balance: priced ? payoutBalance(pricing.payable as number, settled.paid) : null,
      paymentCount: settled.payments,
      status: priced ? payoutStatus(pricing.payable as number, settled.paid) : "NOT_PRICED",
      reasons: pricing.reasons,
      qualifications: pricing.qualifications,
      missingRule: rule == null,
      preCutover: month < EXPECTED_EVENTS_FLOOR,
      note: pricing.reasons[0]?.message ?? "",
    };
  });

  return ok({
    results,
    month,
    monthLabel: monthLabel(month),
    earningBase: base ?? "",
    earningBaseDefined: base != null,
    unattributedReceipts: base ? unattributed : 0,
    unattributedAmount: base ? unattributedAmount : 0,
    // Shared students only matter once there is a base to split.
    awaitingDecision: base ? awaitingDecision : [],
    awaitingDecisionAmount: base ? money(awaitingDecision.reduce((a, r) => a + Number(r.remaining), 0)) : 0,
    note: base
      ? "preview only: writes nothing"
      : "No academy payout amount exists until Sharvil rules what the percentage is a percentage of (EARNING_BASE_NOT_DEFINED).",
  });
}

/**
 * Record money actually paid to a teacher for a service month. Writes the
 * payout and a matching cashbook outflow in one transaction, so the ledger
 * and the payout history can never disagree.
 */
async function recordTeacherPayout(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const teacherId = s(arg["teacherId"]);
  const amount = n(arg["amount"]);
  const month = s(arg["month"] ?? arg["serviceMonth"]);
  if (!teacherId) return { ok: false, code: "NO_TEACHER", error: "teacherId required" };
  if (!isServiceMonth(month)) return { ok: false, code: "BAD_MONTH", error: "month must be YYYY-MM" };
  if (amount <= 0) return { ok: false, code: "BAD_AMOUNT", error: "Amount must be > 0" };

  const teacher = await acadTeacherById(teacherId);
  if (!teacher) return { ok: false, code: "NOT_FOUND", error: `No teacher ${teacherId}` };

  const branch = defaultBranch(scope, arg["branch"]);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  const paidOn = d(s(arg["paidOn"] ?? arg["date"])) || todayIso();
  const lockedPaid = await closedMonthRefusal(paidOn);
  if (lockedPaid) return lockedPaid;

  // Brief P7.4 settlement gate. From the expected-events floor a month must be
  // closed, and every class this teacher took in it must carry VERIFIED
  // evidence. The payment re-checks; it never trusts the preview.
  if (month >= EXPECTED_EVENTS_FLOOR) {
    const closed = await queryOne<{ id: string }>(`select id from period_locks where id = $1`, [month]);
    if (!closed) {
      return { ok: false, code: "MONTH_NOT_CLOSED", error: `${monthLabel(month)} is not closed yet. Close the month before paying for it.` };
    }
  }
  const monthClasses = (await expectedClassesBetween(`${month}-01`, monthEndExclusive(month)))
    .filter((c) => !c.notRequired && (month >= EXPECTED_EVENTS_FLOOR || c.resolved));
  // A class with no teacher ID could be this teacher's: joining on the name is
  // not allowed (brief §5.4), so an unlinked class blocks rather than being skipped.
  const unlinked = monthClasses.filter((c) => !c.teacherId && !c.payeeTeacherId);
  if (unlinked.length) {
    const named = unlinked.slice(0, 5).map((c) => `${c.date} ${c.startTime} ${c.course}${c.teacher ? ` (${c.teacher})` : ""}`).join("; ");
    return {
      ok: false,
      code: "TIMETABLE_TEACHER_UNLINKED",
      error: `${monthLabel(month)} cannot be settled: ${unlinked.length} class${unlinked.length === 1 ? " has" : "es have"} no teacher ID in the timetable. Pick the teacher on each: ${named}.`,
      blocking: unlinked.slice(0, 20).map((c) => ({ date: c.date, why: "no teacher ID" })),
    };
  }
  const classes = monthClasses.filter((c) => c.teacherId === teacherId || c.payeeTeacherId === teacherId);
  const blocks = unsettleableClasses(
    classes
      .filter((c) => !c.resolved || ["HELD", "SUBSTITUTE_DELIVERED"].includes(c.outcome))
      .map((c) => ({ date: c.date, resolved: c.resolved, evidenceClass: c.evidenceClass })),
  );
  if (blocks.length) {
    const named = blocks.slice(0, 5).map((b) => `${b.date} (${b.why})`).join(", ");
    return {
      ok: false,
      code: "SETTLEMENT_EVIDENCE_NOT_VERIFIED",
      error: `${teacher.name}'s ${monthLabel(month)} cannot be settled: ${blocks.length} class${blocks.length === 1 ? "" : "es"} without VERIFIED evidence: ${named}.`,
      blocking: blocks.slice(0, 20),
    };
  }
  const mode = s(arg["paymentMode"]) || "Bank Transfer";
  const reference = s(arg["reference"] ?? arg["note"]);
  const id = newId("TPO");
  const ledgerId = newId("LED");

  await withTransaction(async (tx) => {
    await tx.query(
      `insert into money_ledger (id, entry_date, party_name, category, description, outflow, amount, payment_mode, status, branch)
       values ($1, $2::date, $3, 'Teacher Payout', $4, $5, $5, $6, 'ACTIVE', $7)`,
      [ledgerId, paidOn, teacher.name, `Payout ${month}${reference ? ` · ${reference}` : ""}`, amount, mode, branch],
    );
    await tx.query(
      `insert into teacher_payouts (id, teacher_id, teacher_name, service_month, amount, paid_on, payment_mode, reference, branch, recorded_by, ledger_id)
       values ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11)`,
      [id, teacherId, teacher.name, month, amount, paidOn, mode, reference || null, branch, s(arg["recordedBy"]) || "founder", ledgerId],
    );
  });
  await bumpRevisions(["payouts", "expenses", "teachers", "dashboard"]);

  const totals = await queryOne<{ paid: string }>(
    `select coalesce(sum(amount),0)::text as paid from teacher_payouts where teacher_id = $1 and service_month = $2`,
    [teacherId, month],
  );
  return ok({
    payoutId: id,
    teacherId,
    teacherName: teacher.name,
    month,
    amount: money(amount),
    paidOn,
    paymentMode: mode,
    totalPaidForMonth: money(n(totals?.paid)),
    ledgerId,
    note: "payout recorded and posted to the cashbook",
  });
}

/**
 * Record the founder's decision on how a shared student's fee splits between
 * the teachers who taught them that month. Replaces any previous decision for
 * that student and month. The total may not exceed what the student actually
 * paid in the month.
 */
async function assignSharedStudent(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const month = s(arg["month"]);
  const studentId = s(arg["studentId"]);
  if (!isServiceMonth(month)) return { ok: false, code: "BAD_MONTH", error: "month must be YYYY-MM" };
  if (!studentId) return { ok: false, code: "NO_STUDENT", error: "studentId required" };

  const raw = Array.isArray(arg["allocations"]) ? (arg["allocations"] as Record<string, unknown>[]) : [];
  const allocations = raw
    .map((a) => ({ teacherId: s(a["teacherId"]), amount: money(n(a["amount"])) }))
    .filter((a) => a.teacherId && a.amount > 0);

  const student = await acadStudentById(studentId);
  if (!student) return { ok: false, code: "NOT_FOUND", error: `No student ${studentId}` };

  const monthStart = `${month}-01`;
  const collectedRow = await queryOne<{ total: string }>(
    `select coalesce(sum(amount),0)::text as total from receipts
     where student_id = $1 and not ${excludedReceiptSql("status")}
       and created_at >= $2::date and created_at < ($2::date + interval '1 month')`,
    [studentId, monthStart],
  );
  const collected = money(n(collectedRow?.total));
  const total = money(allocations.reduce((a, x) => a + x.amount, 0));
  if (total > collected + 0.005) {
    return {
      ok: false,
      code: "OVER_ALLOCATED",
      error: `Allocated ${total} but the student paid ${collected} in ${month}`,
    };
  }
  for (const a of allocations) {
    if (!(await acadTeacherById(a.teacherId))) {
      return { ok: false, code: "NOT_FOUND", error: `No teacher ${a.teacherId}` };
    }
  }

  await withTransaction(async (tx) => {
    await tx.query(`delete from payout_attributions where service_month = $1 and student_id = $2`, [month, studentId]);
    for (const a of allocations) {
      await tx.query(
        `insert into payout_attributions (id, service_month, student_id, teacher_id, amount, decided_by)
         values ($1,$2,$3,$4,$5,$6)`,
        [newId("PATT"), month, studentId, a.teacherId, a.amount, s(arg["decidedBy"]) || "founder"],
      );
    }
  });
  await bumpRevisions(["payouts", "dashboard"]);

  return ok({
    month,
    studentId,
    studentName: student.name,
    collected,
    assigned: total,
    remaining: money(collected - total),
    allocations,
    note: allocations.length ? "split recorded" : "split cleared",
  });
}

/** Payments already made, newest first. Optionally for one teacher/month. */
async function payoutHistory(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const teacherId = s(arg["teacherId"]);
  const month = s(arg["month"]);
  const where: string[] = [];
  const params: unknown[] = [];
  if (teacherId) {
    params.push(teacherId);
    where.push(`teacher_id = $${params.length}`);
  }
  if (isServiceMonth(month)) {
    params.push(month);
    where.push(`service_month = $${params.length}`);
  }
  const rows = await query<Record<string, unknown>>(
    `select id, teacher_id, teacher_name, service_month, amount, paid_on::text, payment_mode, reference, branch, recorded_by
     from teacher_payouts ${where.length ? `where ${where.join(" and ")}` : ""}
     order by paid_on desc, id desc limit 200`,
    params,
  );
  return ok({
    rows: rows.map((r) => ({
      payoutId: s(r.id),
      teacherId: s(r.teacher_id),
      teacherName: s(r.teacher_name),
      month: s(r.service_month),
      amount: n(r.amount),
      paidOn: d(r.paid_on),
      paymentMode: s(r.payment_mode),
      reference: s(r.reference),
      branch: s(r.branch),
      recordedBy: s(r.recorded_by),
    })),
    total: money(rows.reduce((a, r) => a + n(r.amount), 0)),
  });
}

// ------------------------------------------------------- cashbook / expenses
async function cashbook(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const rows = (
    await query<Record<string, unknown>>(
      `select id as entry_id, entry_date::text, category, description, inflow, outflow, amount, payment_mode, status, branch from money_ledger order by entry_date desc limit 200`,
    )
  ).filter((r) => moneyInScope(scope, r.branch));
  const entries = rows.map((r) => ({
    entryId: s(r.entry_id),
    date: d(r.entry_date),
    category: s(r.category) || "Student Fees",
    description: s(r.description),
    amount: n(r.inflow) > 0 ? n(r.inflow) : n(r.outflow),
    type: n(r.inflow) > 0 ? "INFLOW" : "EXPENSE",
    mode: s(r.payment_mode),
    approvalStatus: s(r.status) === "ACTIVE" ? "APPROVED" : s(r.status),
    status: s(r.status),
  }));
  return ok({ entries });
}

const isoDate = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(s(v).trim()) ? s(v).trim() : "");

async function addExpense(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const amount = amountRupees(arg);
  const payee = s(arg["paidTo"] ?? arg["vendor"] ?? arg["payee"]).trim();
  const desc = s(arg["description"] ?? arg["narrative"]).trim() || payee;
  if (amount <= 0) return { ok: false, code: "BAD_AMOUNT", error: "Enter an amount greater than zero." };
  if (!desc) return { ok: false, code: "BAD_EXPENSE", error: "Say who was paid or what it was for." };
  const categoryRefusal = expenseCategoryRefusal(s(arg["category"]), desc);
  if (categoryRefusal) return { ok: false, ...categoryRefusal };
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (intent) {
    const earlier = await queryOne<{ id: string }>(`select id from expenses where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ entryId: earlier.id, idempotent: true, note: "already recorded" });
  }
  const entryDate = isoDate(arg["entryDate"] ?? arg["expenseDate"]) || todayIso();
  const lockedExpense = await closedMonthRefusal(entryDate);
  if (lockedExpense) return lockedExpense;
  const branch = scope.unrestricted ? recordBranch(s(arg["branch"]) || "KANDIVALI") : defaultBranch(scope, arg["branch"]);
  const id = newId("EXP");
  await withTransaction(async (tx) => {
    await tx.query(
      `insert into expenses (id, expense_date, category, vendor, description, amount, approval_status, payment_reference, client_intent_key)
       values ($1, $2::date, $3, $4, $5, $6, 'APPROVED', $7, $8)`,
      [id, entryDate, s(arg["category"]) || "General", payee, desc, amount, s(arg["reference"]).trim() || null, intent],
    );
    await tx.query(
      `insert into money_ledger (id, entry_date, party_name, category, description, outflow, amount, payment_mode, account, status, branch)
       values ($1, $2::date, $3, $4, $5, $6, $6, $7, $8, 'ACTIVE', $9)`,
      [newId("LED"), entryDate, payee || "Office", s(arg["category"]) || "General", desc, amount, s(arg["paymentMode"]) || "Cash", s(arg["account"]).trim() || null, branch],
    );
  });
  await bumpRevisions(["expenses", "dashboard"]);
  return ok({ entryId: id, note: "expense recorded" });
}

/**
 * Staff submit an expense for the founder to approve. It used to return
 * "persisted: true" without writing anything; then it read `amount` while
 * the screen sends integer paise, so every submission was refused.
 */
async function submitExpenseDraft(arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  const amount = amountRupees(arg);
  const payee = s(arg["payee"] ?? arg["vendor"] ?? arg["paidTo"]).trim();
  const description = s(arg["description"] ?? arg["narrative"]).trim() || payee;
  if (amount <= 0) return { ok: false, code: "BAD_AMOUNT", error: "Enter an amount greater than zero." };
  if (!description) return { ok: false, code: "BAD_EXPENSE", error: "Say who was paid or what it was for." };
  const categoryRefusal = expenseCategoryRefusal(s(arg["category"]), description);
  if (categoryRefusal) return { ok: false, ...categoryRefusal };
  const branch = defaultBranch(scope, arg["branch"]);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  const expenseDate = isoDate(arg["expenseDate"]) || todayIso();
  if (expenseDate > todayIso()) return { ok: false, code: "FUTURE_EXPENSE_DATE", error: "The expense date is in the future. Enter the day it was paid." };
  const lockedDraft = await closedMonthRefusal(expenseDate);
  if (lockedDraft) return lockedDraft;
  const reimbursement = arg["reimbursementRequired"] === true;
  const paidBy = s(arg["paidBy"]).trim();
  if (reimbursement && !paidBy) return { ok: false, code: "PAID_BY_REQUIRED", error: "Say who paid, so the right person is reimbursed." };
  const intent = s(arg["clientIntentKey"] ?? arg["requestId"]).trim() || null;
  if (intent) {
    const earlier = await queryOne<{ id: string; status: string }>(`select id, status from expense_drafts where client_intent_key = $1`, [intent]);
    if (earlier) return ok({ draftId: earlier.id, status: earlier.status, idempotent: true, persisted: true, note: "Already sent to Sharvil." });
  }
  const id = newId("EDRAFT");
  await query(
    `insert into expense_drafts
       (id, status, category, vendor, description, amount, payment_mode, branch, submitted_by,
        expense_date, payment_reference, paid_from_account, notes, client_intent_key, paid_by_person, reimbursement_required)
     values ($1,'SUBMITTED',$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,$12,$13,$14,$15)`,
    [
      id, s(arg["category"]) || "General", payee, description, amount, s(arg["mode"] ?? arg["paymentMode"]) || "Cash", branch,
      session?.deviceLabel || session?.email || "",
      expenseDate, s(arg["reference"]).trim() || null, s(arg["sourceAccount"]).trim() || null,
      s(arg["notes"]).trim() || null, intent, paidBy || null, reimbursement,
    ],
  );
  await bumpRevisions(["expenses", "approvals", "tasks"]);
  notifyFounderApproval("Expense", "an expense draft to approve", id);
  return ok({ draftId: id, persisted: true, status: "SUBMITTED", amount, note: "Sent to Sharvil for approval." });
}

/** Founder approves: the draft becomes a real expense plus a cashbook outflow. */
async function expenseDraftApprove(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const draftId = s(arg["draftId"] ?? arg["itemId"]);
  if (!draftId) return { ok: false, code: "NO_DRAFT", error: "draftId required" };
  const result: Record<string, unknown> = await withTransaction(async (tx) => {
    const draft = await tx.queryOne<Record<string, unknown>>(
      `select * from expense_drafts where id = $1 for update`,
      [draftId],
    );
    if (!draft) return { ok: false, code: "NOT_FOUND", error: `No expense draft ${draftId}` };
    if (s(draft.status) === "APPROVED") {
      return ok({ changed: false, draftId, status: "APPROVED", expenseId: s(draft.expense_id), idempotent: true, note: "already approved" });
    }
    if (s(draft.status) !== "SUBMITTED") {
      return { ok: false, code: "NOT_SUBMITTED", error: `Draft status ${s(draft.status)}` };
    }
    const lockedApprove = await closedMonthRefusal(d(draft.expense_date) || todayIso(), tx);
    if (lockedApprove) return lockedApprove;
    const refusal = expenseCategoryRefusal(s(draft.category), s(draft.description));
    if (refusal) return { ok: false, ...refusal };
    const expenseId = newId("EXP");
    const ledgerId = newId("LED");
    const amount = n(draft.amount);
    await tx.query(
      `insert into expenses (id, expense_date, category, vendor, description, amount, approval_status, payment_reference)
       values ($1, coalesce($6::date, current_date), $2, $3, $4, $5, 'APPROVED', $7)`,
      [expenseId, s(draft.category) || "General", s(draft.vendor), s(draft.description), amount, s(draft.expense_date) || null, s(draft.payment_reference) || null],
    );
    await tx.query(
      `insert into money_ledger (id, entry_date, party_name, category, description, outflow, amount, payment_mode, account, status, branch)
       values ($1, coalesce($8::date, current_date), $2, $3, $4, $5, $5, $6, $9, 'ACTIVE', $7)`,
      [ledgerId, s(draft.vendor) || "Office", s(draft.category) || "General", s(draft.description), amount, s(draft.payment_mode) || "Cash", s(draft.branch) || null, s(draft.expense_date) || null, s(draft.paid_from_account) || null],
    );
    await tx.query(
      `update expense_drafts set status = 'APPROVED', decided_by = $2, decided_at = now(), expense_id = $3, ledger_id = $4 where id = $1`,
      [draftId, session?.email ?? "", expenseId, ledgerId],
    );
    return ok({ changed: true, draftId, status: "APPROVED", expenseId, ledgerId, amount, branch: s(draft.branch), note: "expense recorded and posted to the cashbook" });
  });
  if (result["ok"] === true && result["changed"] === true) {
    await bumpRevisions(["expenses", "approvals", "dashboard"]);
    const branch = s(result["branch"]);
    if (branch) notifyStaffDecision(recordBranch(branch), "Expense", "approved and posted", draftId);
  }
  return result;
}

async function expenseDraftReject(arg: Record<string, unknown>, session?: RpcSession): Promise<Record<string, unknown>> {
  const draftId = s(arg["draftId"] ?? arg["itemId"]);
  const reason = s(arg["reason"] ?? arg["comment"]);
  if (!draftId) return { ok: false, code: "NO_DRAFT", error: "draftId required" };
  const rows = await query<{ id: string; branch: string }>(
    `update expense_drafts set status = 'REJECTED', decided_by = $2, decided_at = now(), decision_note = $3
     where id = $1 and status = 'SUBMITTED' returning id, branch`,
    [draftId, session?.email ?? "", reason || null],
  );
  if (!rows.length) return { ok: false, code: "NOT_FOUND", error: `No pending expense draft ${draftId}` };
  await bumpRevisions(["expenses", "approvals"]);
  if (rows[0].branch) notifyStaffDecision(recordBranch(rows[0].branch), "Expense", "rejected — see the reason", draftId);
  return ok({ changed: true, draftId, status: "REJECTED", note: reason || "rejected" });
}

// ------------------------------------------------------- school invoices
async function generateSchoolInvoice(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const amount = n(arg["amount"]);
  if (amount <= 0) return { ok: false, code: "BAD_AMOUNT", error: "amount required" };
  const branch = defaultBranch(scope, arg["branch"]);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  const id = newId("SINV");
  const invoiceDate = s(arg["invoiceDate"]) || todayIso();
  const lockedInvoice = await closedMonthRefusal(invoiceDate);
  if (lockedInvoice) return lockedInvoice;
  const no = await withTransaction(async (tx) => {
    const docNo = await nextDocNo(tx, "schoolInvoice", schoolInvoiceSeries(new Date(invoiceDate)));
    await tx.query(
      `insert into school_invoices_rpc (id, invoice_no, invoice_date, branch, class_name, amount, tenure, status)
       values ($1,$2,$3,$4,$5,$6,$7,'FINAL')`,
      [id, docNo, invoiceDate, branch, s(arg["className"]), amount, s(arg["tenure"])],
    );
    return docNo;
  });
  await bumpRevisions(["invoices", "dashboard"]);
  return ok({
    invoiceId: id,
    invoiceNo: no,
    invoiceDate,
    branch,
    className: s(arg["className"]),
    amount,
    tenure: s(arg["tenure"]),
    owner1: { name: "Sharvil Vaidya", id: "OWNER-1", signatureUrl: "", title: "Owner 1" },
    owner2: { name: "Piyush Kashyap", id: "OWNER-2", signatureUrl: "", title: "Owner 2" },
    pdfUrl: "",
  });
}

async function listSchoolInvoices(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const requestedBranch = s(arg["branch"] ?? "ALL");
  const rows = (
    await query<Record<string, unknown>>(`select id, invoice_no, invoice_date, branch, class_name, amount, tenure, status from school_invoices_rpc order by id desc`)
  ).filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(requestedBranch, r.branch));
  return ok({
    invoices: rows.map((r) => ({
      invoiceId: s(r.id),
      invoiceNo: s(r.invoice_no),
      invoiceDate: s(r.invoice_date),
      branch: s(r.branch),
      className: s(r.class_name),
      amount: n(r.amount),
      tenure: s(r.tenure),
      status: s(r.status),
    })),
  });
}

async function getSchoolInvoice(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const id = s(arg["invoiceId"]);
  const r = await queryOne<Record<string, unknown>>(`select * from school_invoices_rpc where id = $1`, [id]);
  if (!r) return { ok: false, code: "NOT_FOUND", error: `No invoice ${id}` };
  if (!inScope(scope, r.branch)) return branchForbidden(recordBranch(r.branch));
  return ok({
    invoice: {
      invoiceId: s(r.id),
      invoiceNo: s(r.invoice_no),
      invoiceDate: s(r.invoice_date),
      branch: s(r.branch),
      className: s(r.class_name),
      amount: n(r.amount),
      tenure: s(r.tenure),
      pdfUrl: "",
      owner1: { name: "Sharvil Vaidya", id: "OWNER-1", signatureUrl: "", title: "Owner 1" },
      owner2: { name: "Piyush Kashyap", id: "OWNER-2", signatureUrl: "", title: "Owner 2" },
    },
  });
}

// -------------------------------------------------------------- timetable
async function timetableList(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const branch = s(arg["branch"] ?? "ALL").toUpperCase();
  // No auto-seeding here: an empty timetable stays empty rather than being
  // filled with invented classes. The real Kandivali timetable is loaded once
  // by a migration (db/apply.mjs).
  const rows = (
    await query<Record<string, unknown>>(
      `select id, branch, day_of_week, start_time, end_time, class_name, teacher_id, teacher_name, status, substitute_teacher_id, substitute_teacher_name from timetable order by day_of_week, start_time`,
    )
  ).filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(branch, r.branch));
  return ok({
    entries: rows.map((r) => ({
      id: s(r.id),
      branch: s(r.branch),
      dayOfWeek: n(r.day_of_week),
      startTime: s(r.start_time),
      endTime: s(r.end_time),
      className: s(r.class_name),
      teacherId: s(r.teacher_id),
      teacherName: s(r.teacher_name),
      status: s(r.status),
      substituteTeacherId: s(r.substitute_teacher_id),
      substituteTeacherName: s(r.substitute_teacher_name),
    })),
    seeded: rows.length > 0,
  });
}

async function timetableCreate(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const branch = defaultBranch(scope, arg["branch"]);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  const id = newId("TT");
  await query(
    `insert into timetable (id, branch, day_of_week, start_time, end_time, class_name, teacher_id, teacher_name, status, substitute_teacher_id, substitute_teacher_name)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (id) do nothing`,
    [id, branch, n(arg["dayOfWeek"]), s(arg["startTime"]), s(arg["endTime"]), s(arg["className"]), s(arg["teacherId"]), s(arg["teacherName"]), s(arg["status"]).toUpperCase() || "ENABLED", s(arg["substituteTeacherId"]) || null, s(arg["substituteTeacherName"]) || null],
  );
  await bumpRevisions(["timetable", "sessions"]);
  return ok({
    entry: {
      id, branch, dayOfWeek: n(arg["dayOfWeek"]), startTime: s(arg["startTime"]), endTime: s(arg["endTime"]), className: s(arg["className"]),
      teacherId: s(arg["teacherId"]), teacherName: s(arg["teacherName"]), status: s(arg["status"]).toUpperCase() || "ENABLED",
      substituteTeacherId: s(arg["substituteTeacherId"]), substituteTeacherName: s(arg["substituteTeacherName"]),
    },
    note: "created",
  });
}

async function timetableUpdate(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const id = s(arg["id"]);
  const cur = await queryOne<Record<string, unknown>>(`select * from timetable where id = $1`, [id]);
  if (!cur) return { ok: false, code: "TT_ENTRY_NOT_FOUND", error: "Entry not found." };
  // Both the current branch and the requested one must be in scope.
  if (!inScope(scope, cur.branch)) return branchForbidden(recordBranch(cur.branch));
  const nextBranch = recordBranch(s(arg["branch"] ?? cur.branch));
  if (!inScope(scope, nextBranch)) return branchForbidden(nextBranch);
  await query(
    `update timetable set branch=$2, day_of_week=$3, start_time=$4, end_time=$5, class_name=$6, teacher_id=$7, teacher_name=$8, status=$9, substitute_teacher_id=$10, substitute_teacher_name=$11 where id=$1`,
    [
      id, nextBranch, n(arg["dayOfWeek"] ?? cur.day_of_week), s(arg["startTime"] ?? cur.start_time), s(arg["endTime"] ?? cur.end_time), s(arg["className"] ?? cur.class_name),
      s(arg["teacherId"] ?? cur.teacher_id), s(arg["teacherName"] ?? cur.teacher_name), s(arg["status"] ?? cur.status).toUpperCase(),
      s(arg["substituteTeacherId"] ?? cur.substitute_teacher_id) || null, s(arg["substituteTeacherName"] ?? cur.substitute_teacher_name) || null,
    ],
  );
  await bumpRevisions(["timetable", "sessions"]);
  return ok({ entry: { ...cur, ...arg, id }, note: "updated" });
}

async function timetableDelete(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const id = s(arg["id"]);
  const before = await queryOne<{ id: string; branch: string }>(`select id, branch from timetable where id = $1`, [id]);
  if (before && !inScope(scope, before.branch)) return branchForbidden(recordBranch(before.branch));
  if (before) await query(`delete from timetable where id = $1`, [id]);
  if (before) await bumpRevisions(["timetable", "sessions"]);
  return ok({ deleted: before != null, note: "deleted" });
}

// -------------------------------------------------------- attendance / today
async function attendanceRoster(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const instrument = s(arg["instrument"]).trim();
  const date = isoDate(arg["date"]) || todayIso();
  const students = (await acadStudents()).filter(
    (x) => s(x.status).toUpperCase() === "ACTIVE" && inScope(scope, x.branch) && matchesRequestedBranch(arg["branch"], x.branch),
  );
  const rows = instrument ? students.filter((x) => s(x.instrument).toUpperCase() === instrument.toUpperCase()) : students;
  const instruments = Array.from(new Set(students.map((x) => s(x.instrument)).filter(Boolean)));
  // The roster used to always claim "not marked" regardless of what was
  // actually recorded — staff had no way to see who they'd already ticked
  // off today without leaving the screen.
  const marks = await query<{ student_id: string; status: string }>(
    `select student_id, status from attendance_acad where session_date = $1`,
    [date],
  );
  const stateOf = new Map(marks.map((m) => [m.student_id, s(m.status).toUpperCase()]));
  return ok({
    date,
    branch: s(arg["branch"] ?? "ALL"),
    count: rows.length,
    instruments,
    students: (await studentsToRpc(rows)).map((st, i) => ({
      studentId: st.studentId,
      name: st.studentName,
      instrument: st.instrument,
      teacherId: st.teacherId ?? "",
      teacherName: st.teacher,
      phone: s(rows[i].phone),
      expectedToday: true,
      state: stateOf.get(st.studentId) ?? "NOT_MARKED",
    })),
  });
}

const ATTENDANCE_STATES = new Set(["PRESENT", "ABSENT", "EXCUSED", "LATE"]);

async function markAttendance(arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  // The attendance screen sends ONE mark: { studentId, state: "PRESENT" }.
  // Older callers send a map or a list. Reading only the map shape saved
  // nothing while reporting success.
  let entries: { studentId: string; status: string }[] = [];
  const raw = arg["state"] ?? arg["marks"] ?? arg["rows"];
  if (typeof raw === "string" && s(arg["studentId"])) {
    entries = [{ studentId: s(arg["studentId"]), status: raw }];
  } else if (Array.isArray(raw)) {
    entries = raw.map((e) => ({ studentId: s((e as Record<string, unknown>).studentId), status: s((e as Record<string, unknown>).status ?? (e as Record<string, unknown>).state) }));
  } else if (raw && typeof raw === "object") {
    entries = Object.entries(raw as Record<string, unknown>).map(([studentId, status]) => ({ studentId, status: s(status) }));
  }
  entries = entries.filter((e) => e.studentId && e.status);
  if (!entries.length) return { ok: false, code: "NOTHING_TO_MARK", error: "No attendance marks were sent." };
  const bad = entries.find((e) => !ATTENDANCE_STATES.has(e.status.toUpperCase()));
  if (bad) return { ok: false, code: "BAD_STATE", error: `Unknown attendance state ${bad.status}` };

  const date = isoDate(arg["workDate"] ?? arg["date"]) || todayIso();
  const today = todayIso();
  if (date > today) return { ok: false, code: "FUTURE_DATE", error: "Attendance cannot be marked for a day that has not happened." };
  const backdatedReason = s(arg["backdatedReason"] ?? arg["reason"]).trim();
  if (date < today && !backdatedReason) {
    return { ok: false, code: "BACKDATED_REASON_REQUIRED", error: `This mark is for ${date}, not today. Say why it is being entered late.` };
  }
  const lockedAttendance = await closedMonthRefusal(date);
  if (lockedAttendance) return lockedAttendance;
  const students = new Map<string, Awaited<ReturnType<typeof acadStudentById>>>();
  for (const e of entries) {
    const student = await acadStudentById(e.studentId);
    if (!student) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${e.studentId}` };
    // Reject the whole batch rather than writing part of another branch's roster.
    if (!inScope(scope, student.branch)) return branchForbidden(recordBranch(student.branch));
    students.set(e.studentId, student);
  }

  for (const e of entries) {
    const student = students.get(e.studentId)!;
    const teacher = await queryOne<{ teacher_id: string; teacher_name: string }>(
      `select teacher_id, teacher_name from attendance_acad
       where student_id = $1 and coalesce(teacher_id,'') <> '' order by session_date desc limit 1`,
      [e.studentId],
    );
    // One mark per student per day: marking again corrects it instead of
    // adding a second row.
    await query(
      `insert into attendance_acad (id, session_date, student_id, student_name, teacher_id, teacher_name, instrument, status,
                                    backdated_reason, recorded_by, recorded_at)
       values ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,now())
       on conflict (id) do update set status = excluded.status, backdated_reason = coalesce(excluded.backdated_reason, attendance_acad.backdated_reason),
         recorded_by = excluded.recorded_by, recorded_at = now()`,
      [`ATT-${e.studentId}-${date}`, date, e.studentId, student!.name, s(teacher?.teacher_id), s(teacher?.teacher_name), s(student!.instrument), e.status.toUpperCase(),
       backdatedReason || null, session?.deviceLabel || session?.email || ""],
    );
  }
  await bumpRevisions(["attendance", "sessions", "tasks", "dashboard"]);
  return ok({ workDate: date, marked: entries.length, markedBy: session?.deviceLabel ?? "", state: entries });
}

/**
 * The to-do card grid — shared by the staff "Today" screen and the founder
 * "Home" screen (the founder is asked for the same operational to-do list,
 * plus approvals and revenue the staff screen doesn't carry).
 */
async function buildTodoCards(scope: BranchScope, today: string, by: Awaited<ReturnType<typeof dueBuckets>>["by"], forFounder: boolean, requestedBranch: string = "ALL") {
  const drafts = (
    await query<{ branch: string }>(`select branch from payment_drafts where status = 'SUBMITTED'`)
  ).filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(requestedBranch, r.branch));
  const state = (n: number) => (n > 0 ? "ATTENTION" : "OPEN");
  // Classes from the last week that nobody has answered (the mark that pays teachers).
  const unmarked = (await expectedClassesBetween(addDays(today, -6), addDays(today, 1), { scope }))
    .filter((c) => !c.resolved && !c.notRequired && matchesRequestedBranch(requestedBranch, c.branch));
  const inquiryRows = (await query<Record<string, unknown>>(
    `select id, name, phone, branch, status, next_contact_date::text, last_contacted_at::text from inquiries`,
  )).filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(requestedBranch, r.branch));
  const callToday = await callTheseToday(scope, inquiryRows);
  // Both computed lazily on this same read — no cron, same shape as the
  // dormancy sweep: nobody has to remember to check either of these.
  const termsNotAccepted = (
    await query<{ branch: string }>(
      `select branch from students_acad s
       where upper(coalesce(status,'')) = 'ACTIVE'
         and not exists (select 1 from terms_acceptance_tokens t where t.student_id = s.id and t.status = 'ACCEPTED')
         and not exists (select 1 from manual_terms_acceptance_requests m where m.student_id = s.id and m.status = 'APPROVED')`,
    )
  ).filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(requestedBranch, r.branch));
  const pausedTooLong = (
    await query<{ branch: string }>(
      `select branch from students_acad
       where upper(coalesce(status,'')) = 'PAUSED' and status_changed_at is not null
         and status_changed_at <= now() - ($1::int * interval '1 day')`,
      [PAUSED_REVIEW_AFTER_DAYS],
    )
  ).filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(requestedBranch, r.branch));
  const cards = [
    { key: "DELIVERY_NOT_MARKED", title: "Classes not answered", label: "Classes not answered", priority: "HIGH", count: unmarked.length, state: state(unmarked.length), targetView: "todayClasses", emptyText: "Every class this week is answered", actionable: true },
    { key: "FEES_OVERDUE", title: "Fees Overdue", label: "Fees Overdue", priority: "HIGH", count: by.OVERDUE.length, state: state(by.OVERDUE.length), targetView: "students", emptyText: "Nothing overdue", actionable: true, bucket: "OVERDUE" },
    { key: "FEES_DUE_TODAY", title: "Fees Due Today", label: "Fees Due Today", priority: "HIGH", count: by.DUE_TODAY.length, state: state(by.DUE_TODAY.length), targetView: "students", emptyText: "No fees due today", actionable: true, bucket: "DUE_TODAY" },
    { key: "FEES_DUE_SOON", title: "Fees Upcoming", label: "Fees Upcoming", priority: "MEDIUM", count: by.DUE_SOON.length, state: "OPEN", targetView: "students", emptyText: "Nothing upcoming", actionable: true, bucket: "DUE_SOON" },
    { key: "PAYMENT_PENDING", title: "Payment Pending", label: "Payment Pending", priority: "HIGH", count: drafts.length, state: state(drafts.length), targetView: "students", emptyText: "No pending payments", actionable: true },
    { key: "CALL_TODAY", title: "Call these today", label: "Call these today", priority: "MEDIUM", count: callToday.length, state: state(callToday.length), targetView: "inquiries", emptyText: "Nobody to call today", actionable: true },
    { key: "FEE_PLAN_MISSING", title: "Fee plan not set", label: "Fee plan not set", priority: "LOW", count: by.UNKNOWN.length, state: "OPEN", targetView: "students", emptyText: "Every student has a plan", actionable: true, bucket: "UNKNOWN" },
    { key: "TERMS_NOT_ACCEPTED", title: "Terms not accepted", label: "Terms not accepted", priority: "LOW", count: termsNotAccepted.length, state: "OPEN", targetView: "students", emptyText: "Every active student has accepted terms", actionable: true },
    { key: "PAUSED_TOO_LONG", title: "Paused a while — review?", label: "Paused a while", priority: "LOW", count: pausedTooLong.length, state: "OPEN", targetView: "students", emptyText: "No long-paused students", actionable: true },
  ];
  if (!forFounder) {
    const waiting = await pendingApprovalsCount(scope);
    cards.push({ key: "WAITING_FOR_SHARVIL", title: "Waiting for Sharvil", label: "Waiting for Sharvil", priority: "LOW", count: waiting, state: "OPEN", targetView: "requests", emptyText: "Nothing waiting", actionable: true });
  }
  return cards;
}

async function todaysTasks(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  // Every count below is real: no placeholder numbers.
  const requestedBranch = s(arg["branch"] ?? "ALL");
  const { by, today } = await dueBuckets(scope, requestedBranch);
  const inquiries = (
    await query<{ branch: string; status: string }>(`select branch, status from inquiries`)
  ).filter(
    (r) =>
      inScope(scope, r.branch) &&
      matchesRequestedBranch(requestedBranch, r.branch) &&
      !["CONVERTED", "LOST", "CLOSED"].includes(s(r.status).toUpperCase()),
  );
  const [cards, overview] = await Promise.all([
    buildTodoCards(scope, today, by, false, requestedBranch),
    dashboardOverviewSections(scope, today, requestedBranch),
  ]);
  return ok({ cards, mode: "COPY_ONLY", today, openInquiries: inquiries.length, readAt: new Date().toISOString(), ...overview });
}

const OUTCOMES = ["HELD", "TEACHER_CANCELLED", "ACADEMY_CANCELLED", "SUBSTITUTE_DELIVERED", "RESCHEDULED"];
const LATE_HOURS = 48;

/** Timetable rows use Monday = 0. */
function mondayIndex(date: string): number {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

async function todaysClasses(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const date = isoDate(arg["date"]) || todayIso();
  const branch = s(arg["branch"] ?? "ALL");
  const [tt, sessions] = await Promise.all([
    query<Record<string, unknown>>(
      `select * from timetable where status = 'ENABLED' and day_of_week = $1 order by start_time`,
      [mondayIndex(date)],
    ),
    query<Record<string, unknown>>(`select * from scheduled_sessions where session_date = $1`, [date]),
  ]);
  const byId = new Map(sessions.map((r) => [s(r.id), r]));

  const view = (eventId: string, base: Record<string, unknown>, rec: Record<string, unknown> | undefined) => ({
    eventId,
    classDate: date,
    startTime: s(base.start_time),
    teacherId: s(base.teacher_id),
    teacherName: s(base.teacher_name),
    branch: s(base.branch),
    course: s(base.class_name ?? base.course),
    outcome: s(rec?.outcome),
    deliveredBy: s(rec?.delivered_by),
    payeeTeacherId: s(rec?.payee_teacher_id),
    entryDate: rec?.created_at ? String(rec.created_at).slice(0, 10) : "",
    recordedBy: s(rec?.recorded_by),
    evidenceClass: s(rec?.evidence_class),
    evidenceReason: s(rec?.late_reason ?? rec?.evidence_reason),
    notRequired: rec?.not_required === true,
    closureId: "",
    closureReason: s(rec?.closure_reason),
    customKind: s(rec?.custom_kind),
    customReason: s(rec?.custom_reason),
    payable: rec?.payable === true,
    originalEventId: s(rec?.original_event_id),
    replacementEventId: s(rec?.replacement_event_id),
    resolved: rec?.resolved === true,
    answerable: rec?.resolved !== true,
  });

  // Stable id: the timetable row, not its position in the list.
  const rows = tt.map((r) => {
    const eventId = `E-${date}-${s(r.id)}`;
    return view(eventId, r, byId.get(eventId));
  });
  // Make-up / extra sessions scheduled for this date.
  for (const sess of sessions) {
    if (!s(sess.id).startsWith("SCSS-")) continue;
    rows.push(view(s(sess.id), sess, sess));
  }
  const filtered = rows.filter((r) => inScope(scope, r.branch) && (branch === "ALL" || recordBranch(r.branch) === recordBranch(branch)));
  return ok({
    date,
    count: filtered.length,
    unanswered: filtered.filter((r) => !r.resolved).length,
    outcomes: OUTCOMES,
    rows: filtered,
    lateHours: LATE_HOURS,
  });
}

/**
 * Record whether a class was taught. Answered ONCE (brief §P6.4): a second
 * answer is refused, naming who answered and when. Evidence is derived, never
 * typed: within 48 hours it is VERIFIED; later it must say why and is
 * RECONSTRUCTED.
 */
async function resolveTodaysClass(arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  const eventId = s(arg["eventId"]);
  const outcome = s(arg["outcome"]).toUpperCase();
  const deliveredBy = s(arg["deliveredBy"]).trim();
  const lateReason = s(arg["lateReason"]).trim();
  if (!OUTCOMES.includes(outcome)) return { ok: false, code: "BAD_OUTCOME", error: `Choose one of: ${OUTCOMES.join(", ")}` };
  if (outcome === "SUBSTITUTE_DELIVERED" && !deliveredBy) {
    return { ok: false, code: "SUBSTITUTE_REQUIRED", error: "Name the teacher who actually took the class." };
  }

  let base: Record<string, unknown> | null = null;
  let date = "";
  const generated = /^E-(\d{4}-\d{2}-\d{2})-(.+)$/.exec(eventId);
  if (generated) {
    date = generated[1];
    base = await queryOne<Record<string, unknown>>(`select * from timetable where id = $1`, [generated[2]]);
  } else if (eventId.startsWith("SCSS-")) {
    base = await queryOne<Record<string, unknown>>(`select * from scheduled_sessions where id = $1`, [eventId]);
    date = s(base?.session_date);
  }
  if (!base || !date) return { ok: false, code: "NOT_FOUND", error: `No class ${eventId}` };
  if (!inScope(scope, base.branch)) return branchForbidden(recordBranch(base.branch));
  if (date > todayIso()) return { ok: false, code: "CLASS_NOT_YET_DUE", error: `This class is on ${date}. Answer it on the day.` };
  const lockedClass = await closedMonthRefusal(date);
  if (lockedClass) return lockedClass;

  // Brief §10.1: a substitute who cannot be identified BLOCKS; it is never guessed.
  if (outcome === "SUBSTITUTE_DELIVERED") {
    const sub = await acadTeacherById(deliveredBy);
    if (!sub) return { ok: false, code: "SUBSTITUTE_UNIDENTIFIABLE", error: "Pick the substitute from the teacher list; a typed name cannot be paid." };
    if (s(sub.status) && s(sub.status).toUpperCase() !== "ACTIVE") {
      return { ok: false, code: "SUBSTITUTE_UNAUTHORISED", error: `${sub.name} is not an active teacher (${s(sub.status)}).` };
    }
    if (sub.id === s(base.teacher_id)) {
      return { ok: false, code: "SUBSTITUTE_IS_ASSIGNED_TEACHER", error: `${sub.name} is the assigned teacher. Choose Held instead.` };
    }
  }

  const existing = await queryOne<Record<string, unknown>>(`select resolved, outcome, recorded_by, created_at::text from scheduled_sessions where id = $1`, [eventId]);
  if (existing?.resolved === true) {
    return {
      ok: false,
      code: "ALREADY_ANSWERED",
      error: `This class was already answered as ${s(existing.outcome)} by ${s(existing.recorded_by) || "someone"} on ${s(existing.created_at).slice(0, 16)}. Corrections go through Sharvil.`,
    };
  }

  const hoursLate = -((daysUntil(date, todayIso()) ?? 0) * 24);
  const late = hoursLate > LATE_HOURS;
  if (late && !lateReason) {
    return { ok: false, code: "LATE_REASON_REQUIRED", error: `This class was more than ${LATE_HOURS} hours ago. Say why it is being recorded late.` };
  }
  const evidence = late ? "RECONSTRUCTED" : "VERIFIED";
  const payee = outcome === "SUBSTITUTE_DELIVERED" ? deliveredBy : outcome === "HELD" ? s(base.teacher_id) : "";

  await query(
    `insert into scheduled_sessions
       (id, session_date, start_time, teacher_id, teacher_name, branch, course, outcome, delivered_by, payee_teacher_id,
        recorded_by, evidence_class, evidence_reason, late_reason, resolved, answerable, timetable_id)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,true,false,$15)
     on conflict (id) do update set outcome = excluded.outcome, delivered_by = excluded.delivered_by,
       payee_teacher_id = excluded.payee_teacher_id, recorded_by = excluded.recorded_by,
       evidence_class = excluded.evidence_class, late_reason = excluded.late_reason, resolved = true, answerable = false`,
    [
      eventId, date, s(base.start_time), s(base.teacher_id), s(base.teacher_name), recordBranch(base.branch),
      s(base.class_name ?? base.course), outcome, deliveredBy || null, payee || null,
      session?.deviceLabel || session?.email || "", evidence, `${outcome} recorded`, lateReason || null,
      generated ? generated[2] : null,
    ],
  );
  await bumpRevisions(["sessions", "attendance", "tasks", "payouts"]);
  return ok({ eventId, outcome, evidenceClass: evidence, payeeTeacherId: payee, note: late ? "recorded late (reconstructed)" : "class recorded" });
}

/** Schedule a session. The id used to be returned without storing anything,
 *  so api_staff_sessionRoster could never find it again. */
async function scheduleSession(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const branch = defaultBranch(scope, arg["branch"]);
  if (!inScope(scope, branch)) return branchForbidden(branch);
  const kind = s(arg["customKind"] ?? arg["kind"]).toUpperCase();
  const reason = s(arg["customReason"] ?? arg["reason"]).trim();
  const originalEventId = s(arg["originalEventId"]).trim();
  const original = originalEventId
    ? await queryOne<{ outcome: string; replacement_event_id: string | null; resolved: boolean; branch: string }>(
        `select outcome, replacement_event_id, resolved, branch from scheduled_sessions where id = $1`,
        [originalEventId],
      )
    : null;
  if (original && !inScope(scope, original.branch)) return branchForbidden(recordBranch(original.branch));
  const refusal = customSessionRefusal({
    kind,
    reason,
    originalEventId,
    originalOutcome: original?.resolved ? s(original.outcome) : null,
    originalHasReplacement: !!original?.replacement_event_id,
  });
  if (refusal) return { ok: false, ...refusal, kinds: CUSTOM_KINDS };

  const sessionDate = isoDate(arg["sessionDate"]) || todayIso();
  const lockedSession = await closedMonthRefusal(sessionDate);
  if (lockedSession) return lockedSession;
  const teacherId = s(arg["teacherId"]);
  const teacher = teacherId ? await acadTeacherById(teacherId) : null;
  if (teacherId && !teacher) return { ok: false, code: "TEACHER_NOT_FOUND", error: `No teacher ${teacherId}` };
  const id = newId("SCSS");
  await withTransaction(async (tx) => {
    // Payable is always NO here: an extra class that silently pays is money
    // leaving on nobody's decision (brief §10.2).
    await tx.query(
      `insert into scheduled_sessions (id, session_date, start_time, teacher_id, teacher_name, branch, course, resolved, answerable,
                                       custom_kind, custom_reason, payable, original_event_id)
       values ($1,$2,$3,$4,$5,$6,$7,false,true,$8,$9,false,$10)`,
      [id, sessionDate, s(arg["startTime"]), teacherId, s(teacher?.name) || s(arg["teacherName"]), branch, s(arg["course"] ?? arg["className"] ?? arg["instrument"]), kind, reason, originalEventId || null],
    );
    if (originalEventId && kind === "REPLACEMENT") {
      await tx.query(`update scheduled_sessions set replacement_event_id = $2 where id = $1`, [originalEventId, id]);
    }
  });
  await bumpRevisions(["sessions", "tasks"]);
  return ok({
    scheduledSessionId: id,
    status: "SCHEDULED",
    sessionDate,
    branch,
    customKind: kind,
    payable: false,
    originalEventId,
    sessionCredit: n(arg["sessionCredit"]) || 1,
    durationMinutes: n(arg["durationMinutes"]) || 60,
    note: kind === "GOODWILL_RECOVERY" ? "Goodwill class scheduled. It discharges nothing and is not payable." : `${kind === "SUBSTITUTE" ? "Substitute" : "Replacement"} class scheduled. Not payable unless Sharvil decides.`,
  });
}

async function sessionRoster(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const tts = await query<Record<string, unknown>>(`select * from scheduled_sessions where id = $1`, [s(arg["scheduledSessionId"])]);
  const session = tts[0];
  const branch = s(session?.branch ?? "KANDIVALI");
  if (session && !inScope(scope, session.branch)) return branchForbidden(recordBranch(session.branch));
  const all = (await acadStudents()).filter(
    (x) => s(x.status).toUpperCase() === "ACTIVE" && inScope(scope, x.branch) && matchesRequestedBranch(branch, x.branch),
  );
  const rows = (await studentsToRpc(all.slice(0, 30))).map((st) => ({
    studentId: st.studentId,
    name: st.studentName,
    instrument: st.instrument,
    state: "NOT_MARKED",
    teacherId: st.teacherId ?? "",
    teacherName: st.teacher,
  }));
  return ok({ scheduledSessionId: s(arg["scheduledSessionId"]), status: "OPEN", closed: false, unanswered: true, sessionDate: s(session?.session_date) || todayIso(), sessionCredit: 1, total: rows.length, present: 0, absent: 0, excused: 0, notMarked: rows.length, rows });
}

async function feeDueList(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const requestedBranch = s(arg["branch"] ?? "ALL");
  const { by } = await dueBuckets(scope, requestedBranch);
  const pending = (
    await query<{ branch: string }>(`select branch from payment_drafts where status = 'SUBMITTED'`)
  ).filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(requestedBranch, r.branch));
  return ok({
    counts: {
      dueToday: by.DUE_TODAY.length,
      dueSoon: by.DUE_SOON.length,
      overdue: by.OVERDUE.length,
      notRecorded: by.UNKNOWN.length,
      paymentPending: pending.length,
    },
  });
}

// -------------------------------------------------------------- inquiries
const TERMINAL_INQUIRY = TERMINAL_INQUIRY_STATUSES;

/**
 * A lazy, read-triggered sweep (no cron exists in this system, by rule) —
 * every time the queue is opened, any lead that's been open for
 * INQUIRY_DORMANT_AFTER_DAYS without converting is timed out to DORMANT
 * with dormant_reason='TIMEOUT', tagged distinctly from a NO_ANSWER dormant
 * so it's never recalled into "call these today" (unlike that path).
 */
async function applyInquiryDormancyTimeouts(): Promise<void> {
  const today = todayIso();
  const stale = await query<{ id: string }>(
    `select id from inquiries where status = any($1::text[]) and created_at <= $2::date - ($3::int * interval '1 day')`,
    [["OPEN", "CONTACTED", "TRIAL_SCHEDULED", "TRIAL_DONE"], today, INQUIRY_DORMANT_AFTER_DAYS],
  );
  for (const row of stale) {
    await query(
      `update inquiries set status = 'DORMANT', dormant_reason = 'TIMEOUT', next_contact_date = null, updated_at = now() where id = $1`,
      [row.id],
    );
    await query(
      `insert into inquiry_followups (id, inquiry_id, action, description, resulting_status)
       values ($1,$2,'AUTO_DORMANT','No conversion after 30 days of follow-up.','DORMANT')`,
      [newId("FOLLOWUP"), row.id],
    );
  }
}

async function inquiryQueue(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  await applyInquiryDormancyTimeouts();
  const branch = s(arg["branch"] ?? "ALL");
  const rows = await query<Record<string, unknown>>(
    `select id, name, phone, instrument, branch, source, notes, status, created_at::text, next_contact_date::text,
            trial_date::text, drop_reason, converted_student_id, no_answer_count, last_contacted_at::text,
            dormant_reason, former_student_id, former_teacher_id
     from inquiries order by coalesce(next_contact_date, created_at, current_date), id desc limit 500`,
  );
  const filtered = rows.filter((r) => inScope(scope, r.branch) && matchesRequestedBranch(branch, r.branch));
  const view = (r: Record<string, unknown>) => ({
    inquiry_id: s(r.id),
    name: s(r.name),
    phone: s(r.phone),
    instrument: s(r.instrument),
    branch: s(r.branch),
    source: s(r.source),
    status: s(r.status),
    finalStatus: inquiryFinalStatus(s(r.status)),
    next_contact_date: s(r.next_contact_date),
    trialDate: s(r.trial_date),
    dropReason: s(r.drop_reason),
    convertedStudentId: s(r.converted_student_id),
    noAnswerCount: Number(r.no_answer_count) || 0,
    lastContactedAt: s(r.last_contacted_at),
    dormantReason: s(r.dormant_reason),
    formerStudentId: s(r.former_student_id),
    formerTeacherId: s(r.former_teacher_id),
    created_at: s(r.created_at),
  });
  return ok({
    rows: filtered.slice(0, 200).map(view),
    callToday: (await callTheseToday(scope, filtered)).map(view),
  });
}

/** One inquiry's contact details plus its full follow-up history. */
async function inquiryDetail(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const id = s(arg["inquiryId"]).trim();
  if (!id) return { ok: false, code: "INQUIRY_ID_REQUIRED", error: "Pick the inquiry." };
  const row = await queryOne<Record<string, unknown>>(
    `select id, name, phone, instrument, branch, source, notes, status, created_at::text, next_contact_date::text,
            trial_date::text, drop_reason, converted_student_id, no_answer_count, last_contacted_at::text,
            dormant_reason, former_student_id, former_teacher_id
     from inquiries where id = $1`,
    [id],
  );
  if (!row) return { ok: false, code: "NOT_FOUND", error: `No inquiry ${id}` };
  if (!inScope(scope, row.branch)) return branchForbidden(recordBranch(row.branch));
  const followups = await query<Record<string, unknown>>(
    `select id, action, description, resulting_status, next_contact_date::text, created_by, created_at::text
     from inquiry_followups where inquiry_id = $1 order by created_at desc`,
    [id],
  );
  return ok({
    inquiryId: s(row.id),
    name: s(row.name),
    phone: s(row.phone),
    course: s(row.instrument),
    branch: s(row.branch),
    source: s(row.source),
    notes: s(row.notes),
    status: s(row.status),
    finalStatus: inquiryFinalStatus(s(row.status)),
    createdAt: s(row.created_at),
    nextContactDate: s(row.next_contact_date),
    trialDate: s(row.trial_date),
    dropReason: s(row.drop_reason),
    convertedStudentId: s(row.converted_student_id),
    noAnswerCount: Number(row.no_answer_count) || 0,
    lastContactedAt: s(row.last_contacted_at),
    dormantReason: s(row.dormant_reason),
    formerStudentId: s(row.former_student_id),
    formerTeacherId: s(row.former_teacher_id),
    followups: followups.map((f) => ({
      id: s(f.id),
      action: s(f.action),
      description: s(f.description),
      resultingStatus: s(f.resulting_status),
      nextContactDate: s(f.next_contact_date),
      createdBy: s(f.created_by),
      createdAt: s(f.created_at),
    })),
  });
}

/**
 * Brief P1.2 "Call these today": enquiries due today or earlier first, then up
 * to ten dormant contacts, oldest-last-contacted first. Skips anyone contacted
 * in the last 90 days, anyone whose phone now belongs to a current student,
 * and anyone with no usable phone.
 */
async function callTheseToday(scope: BranchScope, rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const today = todayIso();
  const digits = (v: unknown) => s(v).replace(/\D/g, "").slice(-10);
  const studentPhones = new Set(
    (await query<{ phone: string }>(`select phone from students_acad where upper(coalesce(status,'')) in ('ACTIVE','PAUSED')`))
      .map((r) => digits(r.phone))
      .filter((p) => p.length === 10),
  );
  const usable = (r: Record<string, unknown>) => digits(r.phone).length === 10 && !studentPhones.has(digits(r.phone));
  const due = rows.filter(
    (r) => !TERMINAL_INQUIRY.has(s(r.status)) && s(r.next_contact_date) && s(r.next_contact_date) <= today && usable(r),
  );
  const recallBefore = addDays(today, -DORMANT_RECALL_DAYS);
  const dormant = rows
    .filter(
      (r) =>
        s(r.status) === "DORMANT" &&
        s(r.dormant_reason) !== "TIMEOUT" && // a 30-day timeout never resurfaces automatically
        usable(r) &&
        (!s(r.last_contacted_at) || s(r.last_contacted_at) < recallBefore),
    )
    .sort((a, b) => (s(a.last_contacted_at) < s(b.last_contacted_at) ? -1 : 1))
    .slice(0, DORMANT_RECALL_LIMIT);
  return [...due, ...dormant].filter((r) => inScope(scope, r.branch));
}

async function inquiryQuickAdd(arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  const name = s(arg["name"]).trim();
  const phone = s(arg["phone"]).trim();
  if (!name && !phone) return { ok: false, code: "NAME_OR_PHONE_REQUIRED", error: "Enter a name or a phone number." };
  const branch = defaultBranch(scope, arg["branch"]);
  if (!inScope(scope, branch)) return branchForbidden(branch);

  // Brief P1: duplicates are checked on phone, against students and open inquiries.
  const digits = phone.replace(/\D/g, "").slice(-10);
  let duplicate: Record<string, unknown> | null = null;
  if (digits.length === 10) {
    duplicate =
      (await queryOne(`select 'STUDENT' as kind, id, name from students_acad where right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 10) = $1 limit 1`, [digits])) ??
      (await queryOne(`select 'INQUIRY' as kind, id, name from inquiries where right(regexp_replace(coalesce(phone,''), '\\D', '', 'g'), 10) = $1 and status not in ('CONVERTED','DROPPED') limit 1`, [digits]));
  }
  if (duplicate) {
    return {
      ok: false,
      code: "DUPLICATE_PHONE",
      error: `This phone already belongs to ${s(duplicate.kind) === "STUDENT" ? "student" : "an open inquiry for"} ${s(duplicate.name) || s(duplicate.id)}.`,
    };
  }

  const id = newId("INQ");
  await query(
    `insert into inquiries (id, name, phone, instrument, branch, source, notes, status, created_at, next_contact_date, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,'OPEN',current_date,current_date + 1,now())`,
    [id, name, phone, s(arg["instrument"] ?? arg["course"]), branch, s(arg["source"]) || "Walk-in", s(arg["notes"]) || (session?.deviceLabel ? `added by ${session.deviceLabel}` : "")],
  );
  await bumpRevisions(["inquiries", "tasks"]);
  return ok({ inquiryId: id, status: "OPEN", nextContactDate: "tomorrow", note: "inquiry captured" });
}

/**
 * Brief P1 invariant: after ANY action an inquiry has either a FUTURE contact
 * date or a terminal status (CONVERTED / DROPPED). Never neither.
 */
async function inquiryTransition(arg: Record<string, unknown>, scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  const id = s(arg["inquiryId"]);
  const action = s(arg["action"]).toUpperCase();
  const cur = await queryOne<{ branch: string; status: string }>("select branch, status from inquiries where id = $1", [id]);
  if (!cur) return { ok: false, code: "NOT_FOUND", error: `No inquiry ${id}` };
  if (!inScope(scope, cur.branch)) return branchForbidden(recordBranch(cur.branch));

  const today = todayIso();
  const future = (v: unknown) => {
    const date = isoDate(v);
    return date && (daysUntil(date, today) ?? 0) > 0 ? date : "";
  };

  let set: {
    status: string;
    next: string | null;
    trial?: string | null;
    dropReason?: string | null;
    studentId?: string | null;
    noAnswer?: number;
    contacted?: boolean;
    dormantReason?: string | null;
  };
  switch (action) {
    case "LOG_CONTACT": {
      const next = future(arg["nextContactDate"]);
      if (!next) return { ok: false, code: "NEXT_CONTACT_REQUIRED", error: "Pick the next contact date (after today)." };
      set = { status: "CONTACTED", next, noAnswer: 0, contacted: true };
      break;
    }
    case "NO_ANSWER": {
      const misses = await queryOne<{ no_answer_count: number }>(`select no_answer_count from inquiries where id = $1`, [id]);
      const step = noAnswerStep(Number(misses?.no_answer_count) || 0, today);
      set = {
        status: step.status,
        next: step.nextContactDate,
        noAnswer: step.noAnswerCount,
        contacted: true,
        dormantReason: step.status === "DORMANT" ? "NO_ANSWER" : null,
      };
      break;
    }
    case "SCHEDULE_TRIAL": {
      const trial = isoDate(arg["trialDate"]);
      if (!trial || (daysUntil(trial, today) ?? -1) < 0) return { ok: false, code: "TRIAL_DATE_REQUIRED", error: "Pick the trial date (today or later)." };
      set = { status: "TRIAL_SCHEDULED", next: trial === today ? null : trial, trial };
      if (!set.next) set.next = future(arg["nextContactDate"]) || null;
      if (!set.next) {
        // A trial today still needs a follow-up date to satisfy the invariant.
        const d2 = new Date(`${today}T12:00:00Z`);
        d2.setUTCDate(d2.getUTCDate() + 1);
        set.next = d2.toISOString().slice(0, 10);
      }
      break;
    }
    case "TRIAL_DONE": {
      const next = future(arg["nextContactDate"]) || (() => {
        const d2 = new Date(`${today}T12:00:00Z`);
        d2.setUTCDate(d2.getUTCDate() + 2);
        return d2.toISOString().slice(0, 10);
      })();
      set = { status: "TRIAL_DONE", next };
      break;
    }
    case "DROP": {
      const reason = s(arg["reason"]).trim();
      if (!reason) return { ok: false, code: "REASON_REQUIRED", error: "Say why this inquiry is being dropped." };
      set = { status: "DROPPED", next: null, dropReason: reason };
      break;
    }
    case "REOPEN": {
      if (cur.status !== "DROPPED" && cur.status !== "DORMANT") return { ok: false, code: "NOT_CLOSED", error: "Only a dropped or dormant inquiry can be reopened." };
      const d2 = new Date(`${today}T12:00:00Z`);
      d2.setUTCDate(d2.getUTCDate() + 1);
      set = { status: "OPEN", next: d2.toISOString().slice(0, 10), dropReason: null, dormantReason: null };
      break;
    }
    case "CONVERT": {
      // Brief P1.3: "Joined" closes the enquiry and hands off. It creates nobody;
      // the student is added next (as a draft for staff). A link is optional.
      const studentRef = s(arg["studentRef"] ?? arg["studentId"]).trim();
      let studentId: string | null = null;
      if (studentRef) {
        const student = await acadStudentById(studentRef);
        if (!student) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${studentRef}` };
        studentId = student.id;
      }
      set = { status: "CONVERTED", next: null, studentId };
      break;
    }
    default:
      return { ok: false, code: "BAD_ACTION", error: `Unknown action ${action}` };
  }
  if (TERMINAL_INQUIRY.has(cur.status) && action !== "REOPEN" && !(cur.status === "DORMANT" && ["LOG_CONTACT", "NO_ANSWER", "DROP", "CONVERT"].includes(action))) {
    return { ok: false, code: "INQUIRY_CLOSED", error: `This inquiry is already ${cur.status}.` };
  }

  await query(
    `update inquiries set status = $2, next_contact_date = $3::date,
       trial_date = coalesce($4::date, trial_date),
       drop_reason = case when $2 = 'DROPPED' then $5 when $2 = 'OPEN' then null else drop_reason end,
       converted_student_id = coalesce($6, converted_student_id), updated_at = now(),
       no_answer_count = coalesce($7, no_answer_count),
       last_contacted_at = case when $8 then current_date else last_contacted_at end,
       dormant_reason = case when $2 = 'DORMANT' then $9 when $2 = 'OPEN' then null else dormant_reason end
     where id = $1`,
    [id, set.status, set.next, set.trial ?? null, set.dropReason ?? null, set.studentId ?? null, set.noAnswer ?? null, set.contacted === true, set.dormantReason ?? null],
  );
  // One row per contact/transition — what was actually discussed, kept
  // alongside the status change instead of only overwriting last_contacted_at.
  const description = s(arg["note"]).trim() || set.dropReason || "";
  await query(
    `insert into inquiry_followups (id, inquiry_id, action, description, resulting_status, next_contact_date, created_by)
     values ($1,$2,$3,$4,$5,$6::date,$7)`,
    [newId("FOLLOWUP"), id, action, description || null, set.status, set.next, session?.deviceLabel || session?.email || ""],
  );
  await bumpRevisions(["inquiries", "tasks"]);
  return ok({
    inquiryId: id,
    action,
    after: { status: set.status, nextContactDate: set.next ?? "" },
    changedBy: session?.deviceLabel ?? "",
    handOff: action === "CONVERT" && !set.studentId ? { addStudent: true } : undefined,
    note:
      set.status === "DORMANT"
        ? "Three missed calls: marked dormant. It comes back in \"Call these today\" after 90 days."
        : set.status === "CONVERTED"
          ? "Marked joined. Now add the student."
          : set.next
            ? `Next contact ${set.next}.`
            : "",
  });
}

// -------------------------------------------------------------- approvals

/** Every approval item's full underlying record — the card in the list is
 * a condensed summary; this is every column so the founder never has to
 * decide on a guess. Read-only, changes nothing. */
const APPROVAL_DETAIL_TABLE: Record<string, string> = {
  PAYMENT_DRAFT: "payment_drafts",
  EXPENSE_DRAFT: "expense_drafts",
  STUDENT_DRAFT: "student_drafts",
  RECEIPT_CORRECTION: "receipt_corrections",
  SCHOOL_INVOICE_DRAFT: "school_invoice_drafts",
  PACKAGE_EXTENSION: "package_extension_requests",
  PAYMENT_PROFILE_CHANGE: "payment_profile_change_requests",
  CLOSURE: "closure_calendar",
  CLASS_CORRECTION: "class_outcome_corrections",
  LATE_FEE_WAIVER: "late_fee_waiver_requests",
  INSTALMENT_PLAN: "instalment_plan_drafts",
  MANUAL_TERMS_ACCEPTANCE: "manual_terms_acceptance_requests",
  TEACHER_ADD_REQUEST: "teacher_add_requests",
};

async function approvalItemDetail(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const type = s(arg["type"]).trim().toUpperCase();
  const itemId = s(arg["itemId"]).trim();
  if (!type || !itemId) return { ok: false, code: "MISSING", error: "type + itemId required" };
  const table = APPROVAL_DETAIL_TABLE[type];
  if (!table) return { ok: false, code: "UNKNOWN_TYPE", error: `No detail view for ${type}` };
  const row = await queryOne<Record<string, unknown>>(`select * from ${table} where id = $1`, [itemId]);
  if (!row) return { ok: false, code: "NOT_FOUND", error: `No ${type} record ${itemId}` };
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined || v === "") continue;
    fields[k] = v instanceof Date ? v.toISOString() : String(v);
  }
  return ok({ type, itemId, fields });
}

async function founderApprovals(): Promise<Record<string, unknown>> {
  const drafts = await query<Record<string, unknown>>(
    `select id, status, student_id, student_name, amount, payment_mode, branch, terms_status, submitted_at::text,
            payment_date::text, payment_reference, physical_receipt_no
     from payment_drafts where status in ('SUBMITTED','APPROVED') order by submitted_at`,
  );
  const paymentItems = drafts.map((r) => ({
    type: "PAYMENT_DRAFT",
    itemId: s(r.id),
    entity: s(r.student_name),
    studentId: s(r.student_id),
    noStudentLinked: s(r.student_id) === "",
    paymentMode: s(r.payment_mode),
    feesPeriod: "",
    amount: s(r.amount),
    branch: s(r.branch),
    date: s(r.payment_date) || d(r.submitted_at),
    reason: [s(r.payment_reference) && `UTR ${s(r.payment_reference)}`, s(r.physical_receipt_no) && `receipt book ${s(r.physical_receipt_no)}`].filter(Boolean).join(" · ") || "payment approval",
    flags: {
      backdated: isBackdated(s(r.payment_date), d(r.submitted_at) || todayIso()),
      incomplete: !s(r.payment_reference) && !s(r.physical_receipt_no),
      junk: false,
    },
    termsStatus: s(r.terms_status),
    actions: ["details", "approve", "reject"],
  }));
  const expenseRows = await query<Record<string, unknown>>(
    `select id, category, vendor, description, amount, payment_mode, branch, submitted_by, submitted_at::text
     from expense_drafts where status = 'SUBMITTED' order by submitted_at`,
  );
  const expenseItems = expenseRows.map((r) => ({
    type: "EXPENSE_DRAFT",
    itemId: s(r.id),
    entity: s(r.vendor) || s(r.category) || "Expense",
    studentId: "",
    noStudentLinked: false,
    paymentMode: s(r.payment_mode),
    feesPeriod: "",
    amount: s(r.amount),
    branch: s(r.branch),
    date: d(r.submitted_at),
    reason: s(r.description),
    flags: { backdated: false, incomplete: false, junk: false },
    termsStatus: "",
    actions: ["details", "approve", "reject"],
  }));

  const studentRows = await query<Record<string, unknown>>(
    `select id, action, student_id, name, phone, course, branch, fee_plan, submitted_at::text, lifecycle_status, status_reason
     from student_drafts where status = 'SUBMITTED' order by submitted_at`,
  );
  const studentItems = studentRows.map((r) => ({
    type: "STUDENT_DRAFT",
    itemId: s(r.id),
    entity: s(r.name) || s(r.student_id),
    studentId: s(r.student_id),
    noStudentLinked: s(r.action) === "ADD",
    paymentMode: "",
    feesPeriod: s(r.fee_plan),
    amount: "",
    branch: s(r.branch),
    date: d(r.submitted_at),
    reason: s(r.lifecycle_status)
      ? `status → ${s(r.lifecycle_status)}: ${s(r.status_reason)}`
      : s(r.action) === "EDIT" ? "change to an existing student" : `new student · ${s(r.course) || "course not set"}`,
    flags: { backdated: false, incomplete: !s(r.phone), junk: false },
    termsStatus: "",
    actions: ["details", "merge", "reject"],
  }));

  const gov = await governanceApprovalItems();
  const items = [
    ...paymentItems,
    ...expenseItems,
    ...studentItems,
    ...gov.corrections,
    ...gov.invoices,
    ...gov.packageExtensions,
    ...gov.paymentProfileChanges,
    ...gov.closures,
    ...gov.classCorrections,
    ...gov.lateFeeWaivers,
    ...gov.instalmentPlans,
    ...gov.manualTermsAcceptances,
    ...gov.teacherAddRequests,
  ];
  const groups = [
    { type: "PAYMENT_DRAFT", label: "Fee payments to approve", items: paymentItems },
    { type: "EXPENSE_DRAFT", label: "Expenses to approve", items: expenseItems },
    { type: "STUDENT_DRAFT", label: "Student changes to review", items: studentItems },
    { type: "RECEIPT_CORRECTION", label: "Receipt corrections", items: gov.corrections },
    { type: "SCHOOL_INVOICE_DRAFT", label: "School invoices needing you", items: gov.invoices },
    { type: "PACKAGE_EXTENSION", label: "Package extensions to review", items: gov.packageExtensions },
    { type: "PAYMENT_PROFILE_CHANGE", label: "Payment profile changes", items: gov.paymentProfileChanges },
    { type: "CLOSURE", label: "Closures to authorise", items: gov.closures },
    { type: "CLASS_CORRECTION", label: "Class corrections to review", items: gov.classCorrections },
    { type: "LATE_FEE_WAIVER", label: "Late-fee waivers to review", items: gov.lateFeeWaivers },
    { type: "INSTALMENT_PLAN", label: "Instalment plans to review", items: gov.instalmentPlans },
    { type: "MANUAL_TERMS_ACCEPTANCE", label: "Manual terms acceptances", items: gov.manualTermsAcceptances },
    { type: "TEACHER_ADD_REQUEST", label: "New teachers to review", items: gov.teacherAddRequests },
  ];
  return ok({
    branch: "CONSOLIDATED",
    count: items.length,
    counts: {
      total: items.length,
      WAITING_ON_TERMS: 0,
      PAYMENT_DRAFT: paymentItems.length,
      EXPENSE_DRAFT: expenseItems.length,
      STUDENT_DRAFT: studentItems.length,
      RECEIPT_CORRECTION: gov.corrections.length,
      SCHOOL_INVOICE_DRAFT: gov.invoices.length,
      PACKAGE_EXTENSION: gov.packageExtensions.length,
      PAYMENT_PROFILE_CHANGE: gov.paymentProfileChanges.length,
      CLOSURE: gov.closures.length,
      CLASS_CORRECTION: gov.classCorrections.length,
      LATE_FEE_WAIVER: gov.lateFeeWaivers.length,
      INSTALMENT_PLAN: gov.instalmentPlans.length,
      MANUAL_TERMS_ACCEPTANCE: gov.manualTermsAcceptances.length,
      TEACHER_ADD_REQUEST: gov.teacherAddRequests.length,
      SCHOOL_MASTER: 0,
      UNKNOWN_STATUS: 0,
    },
    empty: items.length === 0,
    items,
    groups,
  });
}

/**
 * The write trail: who did what, newest first. Optionally filtered to one
 * function or to failures only. Rows hold ids, never names or amounts.
 */
async function auditLog(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const limit = Math.min(Math.max(n(arg["limit"]) || 100, 1), 500);
  const where: string[] = [];
  const params: unknown[] = [];
  const fn = s(arg["fn"]);
  if (fn) {
    params.push(fn);
    where.push(`fn = $${params.length}`);
  }
  if (arg["failuresOnly"] === true) where.push("ok = false");
  const days = n(arg["days"]);
  if (days > 0) {
    params.push(Math.round(days));
    where.push(`at >= now() - ($${params.length}::int * interval '1 day')`);
  }
  params.push(limit);

  const rows = await query<Record<string, unknown>>(
    `select at::text, actor_role, actor_email, device_label, fn, ok, code, branch, ref
     from audit_log ${where.length ? `where ${where.join(" and ")}` : ""}
     order by at desc limit $${params.length}`,
    params,
  );
  return ok({
    rows: rows.map((r) => ({
      at: s(r.at),
      actorRole: s(r.actor_role),
      actorEmail: s(r.actor_email),
      device: s(r.device_label),
      fn: s(r.fn),
      ok: r.ok === true,
      code: s(r.code),
      branch: s(r.branch),
      ref: s(r.ref),
    })),
    count: rows.length,
    note: "write trail — ids only, no names or amounts",
  });
}

async function staffMyRequests(scope: BranchScope, session?: RpcSession): Promise<Record<string, unknown>> {
  // A per-device token only sees its own submissions; the shared staff token
  // cannot tell operators apart, so it sees the branch's.
  const mine = session?.deviceLabel && !session.deviceLabel.startsWith("env:") ? session.deviceLabel : null;
  const own = (r: Record<string, unknown>) => !mine || s(r.submitted_by) === mine;

  const [payments, expenses, students, corrections, invoices, teacherRequests] = await Promise.all([
    query<Record<string, unknown>>(
      `select id, status, student_name, amount, branch, submitted_by, submitted_at::text, payment_date::text, decision_note
       from payment_drafts where submitted_at > now() - interval '60 days' order by submitted_at desc limit 100`,
    ),
    query<Record<string, unknown>>(
      `select id, status, category, description, amount, branch, submitted_by, submitted_at::text, decision_note
       from expense_drafts where submitted_at > now() - interval '60 days' order by submitted_at desc limit 100`,
    ),
    query<Record<string, unknown>>(
      `select id, status, action, name, branch, submitted_by, submitted_at::text, decision_note
       from student_drafts where submitted_at > now() - interval '60 days' order by submitted_at desc limit 100`,
    ),
    query<Record<string, unknown>>(
      `select id, status, receipt_no, reason, branch, requested_by as submitted_by, requested_at::text as submitted_at, decision_note
       from receipt_corrections where requested_at > now() - interval '60 days' order by requested_at desc limit 100`,
    ),
    query<Record<string, unknown>>(
      `select id, status, class_name, amount, branch, submitted_by, submitted_at::text, decision_note, final_invoice_no
       from school_invoice_drafts where submitted_at > now() - interval '60 days' order by submitted_at desc limit 100`,
    ),
    query<Record<string, unknown>>(
      `select id, status, teacher_name, primary_role, branch, submitted_by, submitted_at::text, decision_note
       from teacher_add_requests where submitted_at > now() - interval '60 days' order by submitted_at desc limit 100`,
    ),
  ]);
  const visible = (r: Record<string, unknown>) => inScope(scope, r.branch) && own(r);
  const out = [
    ...payments.filter(visible).map((r) => ({
      type: "PAYMENT_DRAFT", id: s(r.id), status: s(r.status), student: s(r.student_name), category: "",
      amount: s(r.amount), when: d(r.submitted_at), decisionNote: s(r.decision_note),
      backdated: !!s(r.payment_date) && (daysUntil(s(r.payment_date), d(r.submitted_at)) ?? 0) < -2,
    })),
    ...expenses.filter(visible).map((r) => ({
      type: "EXPENSE_DRAFT", id: s(r.id), status: s(r.status), student: "", category: s(r.category),
      amount: s(r.amount), when: d(r.submitted_at), decisionNote: s(r.decision_note), backdated: false,
    })),
    ...students.filter(visible).map((r) => ({
      type: "STUDENT_DRAFT", id: s(r.id), status: s(r.status), student: s(r.name), category: s(r.action),
      amount: "", when: d(r.submitted_at), decisionNote: s(r.decision_note), backdated: false,
    })),
    ...corrections.filter(visible).map((r) => ({
      type: "RECEIPT_CORRECTION", id: s(r.id), status: s(r.status), student: s(r.receipt_no), category: s(r.reason),
      amount: "", when: d(r.submitted_at), decisionNote: s(r.decision_note), backdated: false,
    })),
    ...invoices.filter(visible).map((r) => ({
      type: "SCHOOL_INVOICE_DRAFT", id: s(r.id), status: s(r.status), student: s(r.class_name), category: s(r.final_invoice_no),
      amount: s(r.amount), when: d(r.submitted_at), decisionNote: s(r.decision_note), backdated: false,
    })),
    ...teacherRequests.filter(visible).map((r) => ({
      type: "TEACHER_ADD_REQUEST", id: s(r.id), status: s(r.status), student: s(r.teacher_name), category: s(r.primary_role),
      amount: "", when: d(r.submitted_at), decisionNote: s(r.decision_note), backdated: false,
    })),
  ].sort((a, b) => (a.when < b.when ? 1 : -1));
  return ok({ count: out.length, rows: out, canApprove: false });
}

// -------------------------------------------------------------- comm / sync
const MESSAGE_KINDS: Record<string, string> = {
  FEE_REMINDER: "FEE_REMINDER",
  DUE_SOON: "FEE_REMINDER",
  DUE_TODAY: "FEE_REMINDER",
  OVERDUE_ACCRUING: "FEE_REMINDER",
  RENEWAL: "RENEWAL",
  TERMS: "TERMS",
  ABSENT_TODAY: "FOLLOW_UP",
  TEACHER_FEE_DUE: "FEE_REMINDER",
};

const inr = (v: unknown) => {
  const x = Number(v);
  return Number.isFinite(x) && x > 0 ? `₹${x.toLocaleString("en-IN")}` : "";
};
const niceDate = (iso: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, dd] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${dd} ${months[m - 1]} ${y}`;
};

/**
 * Compose a message from the student's REAL record (brief P9.1). Nothing is
 * sent here; the staff member reads it, edits if needed, and sends it with
 * one tap (api_staff_sendWhatsApp) or copies it.
 */
async function commGenerate(arg: Record<string, unknown>, scope: BranchScope): Promise<Record<string, unknown>> {
  const requested = s(arg["type"] ?? "FEE_REMINDER").toUpperCase();
  const studentId = s(arg["studentId"]);
  if (!studentId) return { ok: false, code: "STUDENT_ID_REQUIRED", error: "Open the student first, then compose." };
  const st = await acadStudentById(studentId);
  if (!st) return { ok: false, code: "STUDENT_NOT_FOUND", error: `No student ${studentId}` };
  if (!inScope(scope, st.branch)) return branchForbidden(recordBranch(st.branch));

  const warnings: string[] = [];
  const parent = s(st.guardian_name).trim();
  const greeting = parent ? `Namaste ${parent},` : "Namaste,";
  const first = s(st.name).trim();
  const fee = inr(st.monthly_fee);
  const due = niceDate(s(st.next_due_date));
  const state = feeState(st.next_due_date, todayIso(), { status: st.status });
  const sign = "— SwarMangal Music Academy";

  let subject = "";
  let body = "";
  switch (requested) {
    case "DUE_SOON":
    case "DUE_TODAY":
    case "OVERDUE_ACCRUING":
    case "FEE_REMINDER":
    case "TEACHER_FEE_DUE": {
      if (!due) warnings.push("No due date is recorded for this student, so the message does not name one.");
      if (!fee) warnings.push("No fee amount is recorded for this student, so the message does not name one.");
      const amountPart = fee ? ` of ${fee}` : "";
      if (state === "OVERDUE" || requested === "OVERDUE_ACCRUING") {
        subject = "Fee overdue";
        body = `${greeting}\n\n${first}'s fee${amountPart} ${due ? `was due on ${due}` : "is overdue"}. Please clear it at the earliest so classes continue without interruption.\n\nIf you have already paid, please share the UTR / receipt so we can update our records.\n\n${sign}`;
      } else if (state === "DUE_TODAY" || requested === "DUE_TODAY") {
        subject = "Fee due today";
        body = `${greeting}\n\nA gentle reminder that ${first}'s fee${amountPart} is due today${due ? ` (${due})` : ""}.\n\nIf you have already paid, please ignore this message.\n\n${sign}`;
      } else {
        subject = "Fee reminder";
        body = `${greeting}\n\nA gentle reminder that ${first}'s fee${amountPart} is due${due ? ` on ${due}` : " soon"}.\n\nIf you have already paid, please ignore this message.\n\n${sign}`;
      }
      if (state === "PAID" && requested !== "TEACHER_FEE_DUE") warnings.push(`${first} looks paid up (next due ${due || "not set"}). Check before sending.`);
      if (state === "INACTIVE") warnings.push(`${first} is marked ${s(st.status).toUpperCase()}. Fee reminders normally are not sent.`);
      break;
    }
    case "RENEWAL":
      subject = "Package renewal";
      body = `${greeting}\n\n${first}'s current fee package ${due ? `ends on ${due}` : "is ending soon"}. To continue classes without a break, please renew${fee ? ` (${fee})` : ""}.\n\n${sign}`;
      if (!due) warnings.push("No package end date is recorded.");
      break;
    case "ABSENT_TODAY":
      subject = "Missed class today";
      body = `${greeting}\n\nWe missed ${first} in ${s(st.instrument) || "class"} today. We hope all is well — please let us know if ${first} will be joining the next class.\n\n${sign}`;
      break;
    case "TERMS":
      subject = "Admission terms";
      body = `${greeting}\n\nPlease read and accept SwarMangal's admission terms for ${first}.\n\n${sign}`;
      warnings.push("There is no terms-acceptance link in this system yet; add the link by hand before sending.");
      break;
    default:
      return { ok: false, code: "BAD_TYPE", error: `Unknown message type ${requested}` };
  }

  const phone = normalizeIndianMobile(st.phone);
  if (!phone.ok) warnings.push(phone.code === "NO_PHONE" ? "No registered phone number — this cannot be sent on WhatsApp." : `The registered number (${phone.masked}) is not a valid Indian mobile.`);
  const whatsappReady = !!gatewayConfigFromEnv() && process.env.WA_SEND_ENABLED === "true";

  return ok({
    type: requested,
    kind: MESSAGE_KINDS[requested] ?? "CUSTOM",
    subject,
    body,
    recipientName: parent || `Parent of ${first}`,
    recipientType: "parent",
    recipientPhone: phone.ok ? phone.masked : "",
    feeState: state,
    typeRequested: requested,
    typeResolved: requested,
    typeCorrected: false,
    typeNote: "",
    warnings,
    // COPY_ONLY when the WhatsApp gateway is off; otherwise the screen offers one-tap send.
    mode: whatsappReady && phone.ok ? "WHATSAPP" : "COPY_ONLY",
    providerSend: whatsappReady ? "ENABLED" : "DISABLED",
    termsLink: "",
    termsTokenId: "",
    termsTokenMinted: false,
    termsAuditIncomplete: false,
  });
}

async function syncChanges(arg: Record<string, unknown>): Promise<Record<string, unknown>> {
  const known = (arg["knownRevisions"] as Record<string, number>) ?? {};
  // Live counters: every write handler bumps the entities it touched, so a
  // client only reloads what actually changed (this used to be a constant,
  // which meant no change was ever advertised).
  const revisions = await currentRevisions();
  const changes = Object.keys(revisions)
    .filter((k) => Number(known[k] ?? 0) !== revisions[k])
    .map((k) => ({ entity: k.toUpperCase(), operation: "UPDATED", id: "" }));
  return ok({ revisions, changes, note: "standalone sync" });
}

export { ok };