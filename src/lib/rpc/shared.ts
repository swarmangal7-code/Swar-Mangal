import { randomBytes } from "crypto";
import { query, queryOne, type Tx } from "@/lib/db";
import { formatDocNo } from "@/lib/rpc/numbering";
import { feeState, todayIso } from "@/lib/rpc/fees";

const s = (v: unknown): string => (v == null ? "" : String(v));
const n = (v: unknown): number => {
  const x = Number(String(v ?? "").replace(/[^\d.\-]/g, "") || 0);
  return Number.isFinite(x) ? x : 0;
};
const d = (v: unknown): string => {
  const x = s(v);
  return x.length > 10 ? x.slice(0, 10) : x;
};

export { s, n, d };

/** Unique, time-ordered id: PREFIX-<ms>-<random>. */
export function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** "OCT-26" for the given ISO date, or today when no date is given. */
function monthYearCode(iso?: string | null): string {
  const dt = iso ? new Date(`${iso}T00:00:00Z`) : new Date();
  const valid = Number.isNaN(dt.getTime()) ? new Date() : dt;
  return `${MONTH_ABBR[valid.getUTCMonth()]}-${String(valid.getUTCFullYear()).slice(-2)}`;
}

/**
 * Founder request 2026-09-27: student/teacher IDs read as
 * MON-YY + [T for teacher] + instrument-letter-code + serial, e.g. a
 * student joining October 2026 for Vocals is OCT-26V1; a teacher joining
 * the same month for Vocals is OCT-26TV1. The letter code starts as just
 * the instrument's first letter and only grows (V -> VI -> ...) when a
 * DIFFERENT instrument already claimed that exact code this period —
 * found by checking what instrument existing ids with that code recorded,
 * not from a separate lookup table.
 */
export async function newPersonId(
  kind: "STU" | "TCH",
  table: "students_acad" | "teachers_acad",
  joinIso: string | null | undefined,
  instrument: string,
  runner: { query: typeof query } = { query },
): Promise<string> {
  const period = monthYearCode(joinIso);
  const infix = kind === "TCH" ? "T" : "";
  const name = (instrument || "Music").trim().toUpperCase();
  const letters = name.replace(/[^A-Z]/g, "") || "X";

  let code = letters.slice(0, 1);
  for (let len = 1; len <= letters.length; len++) {
    const candidate = letters.slice(0, len);
    const rows = await runner.query<{ instrument: string | null }>(
      `select instrument from ${table} where id ~ $1`,
      [`^${period}${infix}${candidate}[0-9]+$`],
    );
    const collides = rows.some((r) => (r.instrument || "Music").trim().toUpperCase() !== name);
    code = candidate;
    if (!collides) break;
  }

  const prefix = `${period}${infix}${code}`;
  const row = await runner.query<{ last_no: number }>(
    `insert into doc_counters (series, last_no)
     values ($1, coalesce((select max(substring(id from '([0-9]+)$')::int)
                           from ${table} where id ~ $2), 0) + 1)
     on conflict (series) do update set last_no = doc_counters.last_no + 1
     returning last_no`,
    [`PID-${table}-${prefix}`, `^${prefix}[0-9]+$`],
  );
  return `${prefix}${row[0]!.last_no}`;
}

// Existing documents a series continues from, when its counter row is new.
const DOC_SOURCES = {
  receipt: { table: "receipts", column: "receipt_no" },
  schoolInvoice: { table: "school_invoices_rpc", column: "invoice_no" },
} as const;

/**
 * Pulls the sequence number out of a document number by anchoring on the
 * series prefix rather than on "digits before the end of the string".
 *
 * The old `substring(no from '-([0-9]+)$')` only matched numbers that END in
 * digits. School invoices carry a school suffix (SMI-26-27-006_SCH_MXVILLE),
 * so every one of them read as NULL, the series silently fell back to the
 * handful of unsuffixed rows, and the next invoice was minted as a number that
 * already existed. Anchoring on `SERIES-` reads both shapes correctly.
 */
export const DOC_NO_SEQ = `substring({column} from '^[A-Z]+-[0-9]{2}-[0-9]{2}-([0-9]+)')`;

/**
 * Next sequence number in a series (e.g. 7 for SMR-26-27), as a number so a
 * caller can compose its own document number from it. Must run inside the
 * transaction that writes the document: the counter row stays locked until
 * commit, so concurrent writers queue instead of getting the same number.
 */
export async function nextDocSeq(tx: Tx, kind: keyof typeof DOC_SOURCES, series: string): Promise<number> {
  const { table, column } = DOC_SOURCES[kind];
  const seq = DOC_NO_SEQ.replace("{column}", column);
  const row = await tx.queryOne<{ last_no: number }>(
    `insert into doc_counters (series, last_no)
     values ($1, coalesce((select max(${seq}::int)
                           from ${table} where ${column} like $1 || '-%'), 0) + 1)
     on conflict (series) do update set last_no = doc_counters.last_no + 1
     returning last_no`,
    [series],
  );
  return Number(row!.last_no);
}

/** Next complete document number in a series (e.g. SMR-26-27-007). */
export async function nextDocNo(tx: Tx, kind: keyof typeof DOC_SOURCES, series: string): Promise<string> {
  return formatDocNo(series, await nextDocSeq(tx, kind, series));
}

/**
 * Read-only preview of what nextDocSeq would hand out right now — for
 * showing a suggested invoice number in a form before it's actually
 * generated. Takes no lock and reserves nothing, so it can go stale if
 * another invoice is raised in between; the real number is still decided by
 * nextDocSeq (or a manual override) inside the write transaction.
 */
export async function peekNextDocSeq(kind: keyof typeof DOC_SOURCES, series: string): Promise<number> {
  const { table, column } = DOC_SOURCES[kind];
  const seq = DOC_NO_SEQ.replace("{column}", column);
  const counter = await queryOne<{ last_no: number }>(`select last_no from doc_counters where series = $1`, [series]);
  if (counter) return Number(counter.last_no) + 1;
  const fallback = await queryOne<{ max_no: number }>(
    `select coalesce(max(${seq}::int), 0) as max_no from ${table} where ${column} like $1 || '-%'`,
    [series],
  );
  return Number(fallback?.max_no ?? 0) + 1;
}

// --------------------------------------------------------------------------
// revision counters (api_syncChanges)
// --------------------------------------------------------------------------

/** Entities the Flutter clients track. Keep in sync with SyncManager. */
export const SYNC_ENTITIES = [
  "students", "receipts", "teachers", "payments", "expenses", "invoices", "timetable",
  "attendance", "inquiries", "approvals", "sessions", "dashboard", "tasks", "payouts",
] as const;

export type SyncEntity = (typeof SYNC_ENTITIES)[number];

/**
 * Bump the revision of each entity a write touched, so polling clients
 * reload exactly those. Never throws: a failed bump must not fail the write
 * (the next successful bump, or a client restart, catches the change up).
 */
export async function bumpRevisions(entities: SyncEntity[], tx?: Tx): Promise<void> {
  if (!entities.length) return;
  const run = tx ? tx.query.bind(tx) : query;
  try {
    await run(
      `insert into entity_revisions (entity, revision) select unnest($1::text[]), 1
       on conflict (entity) do update set revision = entity_revisions.revision + 1, updated_at = now()`,
      [entities],
    );
  } catch (e) {
    console.error(`[revision-bump-failed] entities=${entities.join(",")}`);
  }
}

export async function currentRevisions(): Promise<Record<string, number>> {
  const rows = await query<{ entity: string; revision: string }>(`select entity, revision from entity_revisions`);
  // An entity never written to is 0, so the very first bump (which inserts 1)
  // still reads as a change to a client that synced before it.
  const out: Record<string, number> = {};
  for (const e of SYNC_ENTITIES) out[e] = 0;
  for (const r of rows) out[r.entity] = Number(r.revision) || 0;
  return out;
}

export interface AcadStudent {
  id: string;
  name: string;
  guardian_name: string;
  phone: string;
  email: string;
  instrument: string;
  branch: string;
  batch: string;
  fee_plan: string;
  status: string;
  notes: string;
  // Fee cycle: null where the academy has not recorded it yet.
  fee_plan_name: string | null;
  monthly_fee: string | null;
  fee_cycle_months: number | null;
  fee_due_day: number | null;
  next_due_date: string | null;
  cycle_start: string | null;
  cycle_end: string | null;
  last_payment_date: string | null;
  admission_source: string | null;
  assigned_teacher_id: string | null;
  duplicate_of_id: string | null;
}

const STUDENT_COLUMNS = `id, name, guardian_name, phone, email, instrument, branch, batch, fee_plan, status, notes,
     fee_plan_name, monthly_fee, fee_cycle_months, fee_due_day,
     next_due_date::text, cycle_start::text, cycle_end::text, last_payment_date::text, admission_source, assigned_teacher_id, duplicate_of_id`;

export interface AcadTeacher {
  id: string;
  name: string;
  phone: string;
  email: string;
  instrument: string;
  status: string;
}

/** A school, as it appears on an invoice: code, name, address, contact. */
export interface School {
  id: string;
  code: string;
  name: string;
  address: string;
  contact: string;
  attn: string;
  billingBasis: string;
  serviceDescription: string;
}

export interface SchoolBeneficiary {
  id: string;
  seq: number;
  beneficiaryName: string;
  sharePercent: number;
  bankName: string;
  accountNo: string;
  ifsc: string;
  upi: string;
}

/**
 * Resolves a school from an id, code or exact name. Both the founder-raised
 * path and the staff-draft path mint invoice numbers, so they must agree on
 * which school a value means — that lookup lives here, once.
 */
export async function schoolByIdOrCode(ref: string): Promise<School | null> {
  const key = s(ref).trim();
  if (!key) return null;
  const row = await queryOne<Record<string, unknown>>(
    `select id, code, name, address, contact, attn, billing_basis, service_description from schools
     where upper(coalesce(code,'')) = upper($1) or id = $1 or upper(coalesce(name,'')) = upper($1)
     limit 1`,
    [key],
  );
  if (!row) return null;
  return {
    id: s(row.id),
    code: s(row.code).toUpperCase(),
    name: s(row.name),
    address: s(row.address),
    contact: s(row.contact),
    attn: s(row.attn) || "The Principal",
    billingBasis: s(row.billing_basis) || "Fixed Monthly",
    serviceDescription: s(row.service_description),
  };
}

/** Payment split for a school, ordered the way it should print on the invoice. */
export async function schoolBeneficiaries(schoolId: string): Promise<SchoolBeneficiary[]> {
  const rows = await query<Record<string, unknown>>(
    `select id, seq, beneficiary_name, share_percent, bank_name, account_no, ifsc, upi
     from school_payment_beneficiaries where school_id = $1 order by seq, id`,
    [schoolId],
  );
  return rows.map((r) => ({
    id: s(r.id),
    seq: n(r.seq),
    beneficiaryName: s(r.beneficiary_name),
    sharePercent: n(r.share_percent),
    bankName: s(r.bank_name),
    accountNo: s(r.account_no),
    ifsc: s(r.ifsc),
    upi: s(r.upi),
  }));
}

/**
 * Turns each beneficiary's percentage share into an actual rupee amount for
 * one invoice's total. Rounds to paise, then folds the leftover paisa (from
 * rounding several shares independently) into the LAST beneficiary, so the
 * printed split always reconciles exactly to the printed total — never off
 * by a paisa because two people's rounded shares didn't quite add up.
 */
export function computeBeneficiaryAmounts(totalAmount: number, beneficiaries: SchoolBeneficiary[]): { name: string; amount: number; bankName: string; accountNo: string; ifsc: string; upi: string }[] {
  if (beneficiaries.length === 0) return [];
  const rounded = beneficiaries.map((b) => Math.round(totalAmount * (b.sharePercent / 100) * 100) / 100);
  const sum = rounded.reduce((a, v) => a + v, 0);
  const drift = Math.round((totalAmount - sum) * 100) / 100;
  rounded[rounded.length - 1] = Math.round((rounded[rounded.length - 1] + drift) * 100) / 100;
  return beneficiaries.map((b, i) => ({
    name: b.beneficiaryName,
    amount: rounded[i],
    bankName: b.bankName,
    accountNo: b.accountNo,
    ifsc: b.ifsc,
    upi: b.upi,
  }));
}

// A demo student (status 'DEMO') is a trial-stage record, not an admitted one:
// no fee plan, no due date, no receipt. Every admitted-student surface goes
// through acadStudents(), so excluding them here is what keeps them out of
// student search, fee buckets, payouts, teacher rosters and class rosters in
// one place instead of a status check per call site. Their own list reads
// status='DEMO' directly (listDemoStudents in handlers.ts).
export const NOT_ADMITTED = `upper(coalesce(status,'')) <> 'DEMO'`;

export async function acadStudents(filter = ""): Promise<AcadStudent[]> {
  if (!filter) {
    return query<AcadStudent>(`select ${STUDENT_COLUMNS} from students_acad where ${NOT_ADMITTED} order by name`);
  }
  return query<AcadStudent>(
    `select ${STUDENT_COLUMNS}
     from students_acad
     where ${NOT_ADMITTED} and (id ilike $1 or name ilike $1 or phone ilike $1 or instrument ilike $1)
     order by name`,
    [`%${filter}%`],
  );
}

export async function acadStudentById(id: string): Promise<AcadStudent | null> {
  return queryOne<AcadStudent>(`select ${STUDENT_COLUMNS} from students_acad where id = $1`, [id]);
}

export async function acadTeachers(): Promise<AcadTeacher[]> {
  return query<AcadTeacher>(`select id, name, phone, email, instrument, status from teachers_acad order by name`);
}

export async function acadTeacherById(id: string): Promise<AcadTeacher | null> {
  return queryOne<AcadTeacher>(`select id, name, phone, email, instrument, status from teachers_acad where id = $1`, [id]);
}

// --------------------------------------------------------------------------
// student RPC shape (mirrors api_searchStudent / api_staff_* row contract)
// --------------------------------------------------------------------------
export interface StudentRpc {
  studentId: string;
  studentName: string;
  phone: string;
  email: string;
  guardianName: string;
  instrument: string;
  teacher: string;
  classCode: string;
  className: string;
  location: string;
  batch: string;
  feePlan: string;
  feeCycleType: string;
  feeDueDay: string;
  nextDueDate: string;
  feeStatus: string;
  lastReceiptNo: string;
  lastReceiptAmount: string;
  status: string;
  teacherId?: string;
  monthlyFee?: string;
  lastPaymentDate?: string;
  admissionSource?: string;
}

export function cycleLabel(months: number): string {
  if (months === 1) return "Monthly";
  if (months === 12) return "Yearly";
  return `${months} Months`;
}

interface StudentSideData {
  teacherName: string;
  teacherId: string;
  lastReceiptNo: string;
  lastReceiptAmount: string;
}

/**
 * Teacher + last receipt for many students in a fixed number of queries.
 * Doing this per student cost two round trips each (~700 for a full list).
 */
async function sideDataFor(xs: AcadStudent[]): Promise<Map<string, StudentSideData>> {
  const out = new Map<string, StudentSideData>();
  if (!xs.length) return out;
  const ids = xs.map((x) => x.id);
  const names = xs.map((x) => x.name);
  const blank = (): StudentSideData => ({ teacherName: "", teacherId: "", lastReceiptNo: "", lastReceiptAmount: "" });
  for (const x of xs) out.set(x.id, blank());

  const teachers = await query<{ student_id: string; teacher_name: string | null; teacher_id: string | null }>(
    `select student_id,
            (array_agg(teacher_name) filter (where coalesce(teacher_name,'') <> ''))[1] as teacher_name,
            (array_agg(teacher_id)   filter (where coalesce(teacher_id,'')   <> ''))[1] as teacher_id
     from attendance_acad where student_id = any($1) group by student_id`,
    [ids],
  );
  for (const t of teachers) {
    const row = out.get(t.student_id);
    if (row) {
      row.teacherName = s(t.teacher_name);
      row.teacherId = s(t.teacher_id);
    }
  }

  const linked = await query<{ student_id: string; receipt_no: string; amount: string }>(
    `select distinct on (student_id) student_id, receipt_no, amount from receipts
     where student_id = any($1) order by student_id, id desc`,
    [ids],
  );
  for (const r of linked) {
    const row = out.get(r.student_id);
    if (row) {
      row.lastReceiptNo = s(r.receipt_no);
      row.lastReceiptAmount = String(n(r.amount));
    }
  }

  // Legacy rows that were never linked to a student id, matched by name.
  const byName = await query<{ party_name: string; receipt_no: string; amount: string }>(
    `select distinct on (party_name) party_name, receipt_no, amount from receipts
     where student_id is null and party_name = any($1) order by party_name, id desc`,
    [names],
  );
  const nameMap = new Map(byName.map((r) => [r.party_name, r]));
  for (const x of xs) {
    const row = out.get(x.id)!;
    if (row.lastReceiptNo) continue;
    const r = nameMap.get(x.name);
    if (r) {
      row.lastReceiptNo = s(r.receipt_no);
      row.lastReceiptAmount = String(n(r.amount));
    }
  }

  // Fallback only — a student with no attendance yet has no real
  // "who taught them" to derive, so show the teacher picked at add-time
  // instead of leaving the profile blank. Once real attendance exists,
  // that stays authoritative for payroll and is never overwritten by this.
  const needsAssigned = xs.filter((x) => !out.get(x.id)!.teacherId && s(x.assigned_teacher_id));
  if (needsAssigned.length) {
    const assignedIds = [...new Set(needsAssigned.map((x) => s(x.assigned_teacher_id)))];
    const assignedTeachers = await query<{ id: string; name: string }>(
      `select id, name from teachers_acad where id = any($1)`,
      [assignedIds],
    );
    const teacherNameById = new Map(assignedTeachers.map((t) => [t.id, t.name]));
    for (const x of needsAssigned) {
      const row = out.get(x.id)!;
      const id = s(x.assigned_teacher_id);
      row.teacherId = id;
      row.teacherName = teacherNameById.get(id) ?? "";
    }
  }
  return out;
}

function composeStudentRpc(x: AcadStudent, side: StudentSideData, today = todayIso()): StudentRpc {
  const status = s(x.status).toUpperCase();
  return {
    studentId: x.id,
    studentName: x.name,
    phone: s(x.phone),
    email: s(x.email),
    guardianName: s(x.guardian_name),
    instrument: s(x.instrument),
    teacher: side.teacherName,
    teacherId: side.teacherId,
    classCode: (s(x.branch) || "KANDIVALI").toUpperCase(),
    className: s(x.branch) === "GOREGAON" ? "Goregaon Music Class" : "Kandivali Music Class",
    location: s(x.branch).toUpperCase(),
    batch: s(x.batch),
    feePlan: s(x.fee_plan_name) || s(x.fee_plan),
    feeCycleType: x.fee_cycle_months ? cycleLabel(x.fee_cycle_months) : feeCycleFromPlan(s(x.fee_plan)),
    feeDueDay: x.fee_due_day ? String(x.fee_due_day) : "",
    nextDueDate: s(x.next_due_date),
    // Derived from the stored due date, not from the enrolment status.
    feeStatus: feeState(x.next_due_date, today, { status }),
    monthlyFee: x.monthly_fee ? String(n(x.monthly_fee)) : "",
    lastPaymentDate: s(x.last_payment_date),
    lastReceiptNo: side.lastReceiptNo,
    lastReceiptAmount: side.lastReceiptAmount,
    status,
    admissionSource: s(x.admission_source),
  };
}

/** Batch version of studentToRpc — use this for any list. */
export async function studentsToRpc(xs: AcadStudent[]): Promise<StudentRpc[]> {
  const side = await sideDataFor(xs);
  const today = todayIso();
  return xs.map((x) => composeStudentRpc(x, side.get(x.id)!, today));
}

/** Single-student convenience wrapper. Prefer studentsToRpc for lists. */
export async function studentToRpc(x: AcadStudent): Promise<StudentRpc> {
  return (await studentsToRpc([x]))[0];
}

export function feeCycleFromPlan(plan: string): string {
  const p = plan.toUpperCase();
  if (p.includes("3 MONTH") || p.includes("THREE") || p.includes("PLAN 3") || p.includes("PLAN 4")) return "3 Months";
  if (p.includes("6 MONTH") || p.includes("SIX")) return "6 Months";
  if (p.includes("YEAR") || p.includes("12")) return "Yearly";
  return "Monthly";
}

export async function teacherToRpc(x: AcadTeacher): Promise<Record<string, unknown>> {
  const rule = await queryOne<{ payout_type: string; percentage: string }>(
    `select payout_type, percentage from payout_rules where teacher_id = $1 order by id limit 1`,
    [x.id],
  );
  const streams = rule?.payout_type === "OWNER_DIRECT" ? "SCHOOL" : rule?.payout_type === "SCHOOL_CONTRACT" ? "ACADEMY|SCHOOL" : "ACADEMY";
  const academyShare = rule ? `${s(rule.percentage) || "50"}` : "";
  // Flagged, never fixed automatically — filling these in is still a
  // deliberate edit, this just saves someone from having to notice by eye.
  const missingFields = [
    !s(x.phone) ? "phone" : null,
    !s(x.email) ? "email" : null,
    !academyShare ? "payout rule" : null,
  ].filter((v): v is string => v !== null);
  return {
    teacherId: x.id,
    teacherName: x.name,
    phone: s(x.phone),
    email: s(x.email),
    primaryRole: s(x.instrument),
    payoutStreams: streams,
    payoutModel: rule?.payout_type === "PERCENTAGE" ? "SHARE" : rule?.payout_type === "OWNER_DIRECT" ? "OWNER_DIRECT" : "SHARE",
    branchClassCode: "KMC",
    status: s(x.status),
    academyShare,
    profileIncomplete: missingFields.length > 0,
    missingFields,
  };
}

export async function classSummary(): Promise<{ gmc: number; kmc: number }> {
  const r = await query<{ branch: string; c: string }>(
    `select coalesce(nullif(branch,''),'KANDIVALI') as branch, count(*)::text as c from students_acad where ${NOT_ADMITTED} group by branch`,
  );
  let gmc = 0;
  let kmc = 0;
  for (const row of r) {
    if (s(row.branch).toUpperCase().includes("GOR")) gmc = Number(row.c) || 0;
    else kmc = Number(row.c) || 0;
  }
  return { gmc, kmc };
}
