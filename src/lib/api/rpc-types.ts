// Typed mirror of the RPC `api_*` response contract. Shapes follow the Flutter
// models in lib/models/models.dart; parsing is intentionally loose (strings and
// numbers exactly as the gateway emits them) so nothing is invented client-side.

export type RpcRole = "FOUNDER_ADMIN" | "OPS_USER";
export type Branch = "GOREGAON" | "KANDIVALI" | "ALL" | "CONSOLIDATED" | (string & {});

/** Every RPC body is `{ ok: true, ... }` or `{ ok: false, code, error }`. */
export interface RpcEnvelope {
  ok: boolean;
  code?: string;
  error?: string;
}

export interface RpcPlan {
  name?: string;
  amount?: number;
  months?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------- boot

export interface BootstrapResponse extends RpcEnvelope {
  email: string;
  role: RpcRole;
  name: string;
  device: string;
  accounts: string[];
  paymentModes: string[];
  planTypes: string[];
  plans: RpcPlan[];
  classCodes: string[];
  feeCycleTypes: string[];
  advanceReminderDays: number;
  branches: string[];
}

export interface StaffBootResponse extends RpcEnvelope {
  app: "STAFF_APP" | string;
  actor: string;
  email: string;
  name: string;
  device: string;
  isOpsAccount: true;
  branches: string[];
  paymentModes: string[];
  accounts: string[];
  planTypes: string[];
  plans: RpcPlan[];
  classCodes: string[];
}

// -------------------------------------------------------------- students

export interface Student {
  studentId: string;
  studentName: string;
  phone: string;
  email: string;
  instrument: string;
  teacher: string;
  teacherId?: string;
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
  monthlyFee?: string;
  lastPaymentDate?: string;
  admissionSource?: string;
}

export interface StudentSearchResponse extends RpcEnvelope {
  results: Student[];
  rows: Student[];
  count: number;
}

export interface StudentAttendanceRow {
  date: string;
  status: string;
  teacherName: string;
  instrument: string;
}

export interface StudentProfileResponse extends RpcEnvelope {
  student: Student & { branch: string };
  teacher: { teacherId: string; teacherName: string };
  receipts: ReceiptRow[];
  attendance: StudentAttendanceRow[];
}

export interface PendingFinaliseDraft {
  draftId: string;
  amount: string;
  paymentDate: string;
  approvalAuthority: string;
  approvedBy: string;
  founderDecision: boolean;
  label: string;
  repairRequired: boolean;
  status: string;
  canFinalise: boolean;
  blockedReason: string;
}

export interface StaffStudentHubResponse extends RpcEnvelope {
  profile: Student & { parentName: string; fee: string; dueDate: string; feeStatus: string };
  fees: { available: boolean; total: number; capped: boolean; rows: ReceiptRow[] };
  pending: { available: boolean; rows: PendingFinaliseDraft[] };
  terms: { found: boolean; link: string; status: string; label: string; note: string };
}

// --------------------------------------------------------------- teachers

export interface Teacher {
  teacherId: string;
  teacherName: string;
  primaryRole: string;
  payoutStreams: string;
  payoutModel: string;
  branchClassCode: string;
  status: string;
  phone: string;
  email: string;
  academyShare: string;
  profileIncomplete?: boolean;
  missingFields: string[];
}

export interface TeacherListResponse extends RpcEnvelope {
  teachers: Teacher[];
}

export interface TeacherProfileResponse extends RpcEnvelope {
  teacher: Teacher & { compensationPercent: string; compensationEffectiveFrom: string };
  students: Student[];
  receiptCountThisMonth: number;
}

// -------------------------------------------------------------- dashboard

export interface ReceiptRow {
  receiptNo: string;
  date: string;
  student: string;
  studentName: string;
  amount: number;
  mode: string;
  paymentMode: string;
  status: string;
  entityId: string;
  pdfUrl: string;
  excluded: boolean;
  feePeriodFrom: string;
  feePeriodTo: string;
  txnId: string;
  studentId: string;
  voidReason: string;
}

export interface TaskCard {
  key: string;
  title: string;
  priority: string;
  count: number | null;
  state: string;
  label: string;
  emptyText: string;
  targetView: string;
  actionable: boolean;
}

export interface FeesDueTodayRow {
  studentId: string;
  studentName: string;
  classCode: string;
  phone: string;
}

export interface FeesDueTodaySummary {
  count: number;
  overdueCount: number;
  dueSoonCount: number;
  rows: FeesDueTodayRow[];
}

export interface TodaysClass {
  eventId: string;
  classDate: string;
  startTime: string;
  teacherId: string;
  teacherName: string;
  branch: string;
  course: string;
  outcome: string;
  deliveredBy: string;
  payeeTeacherId: string;
  entryDate: string;
  recordedBy: string;
  evidenceClass: string;
  evidenceReason: string;
  notRequired: boolean;
  closureReason: string;
  customKind: string;
  customReason: string;
  resolved: boolean;
  answerable: boolean;
}

export interface TodaysLecturesSummary {
  count: number;
  unanswered: number;
  rows: TodaysClass[];
}

export interface AttendanceTodaySummary {
  date: string;
  totalActive: number;
  marked: number;
  notMarked: number;
  present: number;
  absent: number;
  excused: number;
  late: number;
}

export interface EnquiryContact {
  inquiryId: string;
  name: string;
  phone: string;
}

export interface EnquiriesSummary {
  openCount: number;
  callTodayCount: number;
  rows: EnquiryContact[];
}

export interface TeacherAttendanceRow {
  teacherId: string;
  teacherName: string;
  scheduled: number;
  held: number;
  cancelled: number;
  substituted: number;
  unanswered: number;
}

export interface TeacherAttendanceSummary {
  scheduledToday: number;
  unansweredToday: number;
  teachers: TeacherAttendanceRow[];
}

export interface DashboardOverview {
  feesDueToday: FeesDueTodaySummary;
  todaysLectures: TodaysLecturesSummary;
  attendanceSummary: AttendanceTodaySummary;
  enquiries: EnquiriesSummary;
  teacherAttendance: TeacherAttendanceSummary;
}

export interface DashboardMetricsResponse extends RpcEnvelope, DashboardOverview {
  cards: TaskCard[];
  todayCollection: number;
  monthCollection: number;
  todayCount: number;
  monthCount: number;
  cashToday: number;
  onlineToday: number;
  scope: string;
  consolidated: boolean;
  approvalsCount: number;
  metrics: {
    dueTodayCount: number;
    dueSoonCount: number;
    overdueCount: number;
    feePlanMissingCount: number;
    termsPendingCount: number;
  };
  recent: ReceiptRow[];
}

export interface StaffTodayResponse extends RpcEnvelope, DashboardOverview {
  cards: TaskCard[];
  mode: string;
  today: string;
  openInquiries: number;
  readAt: string;
}

export interface DueReminderItem {
  studentId: string;
  studentName: string;
  phone: string;
  classCode: string;
  instrument: string;
  nextDueDate: string;
  feeStatus: string;
  lastReceiptNo: string;
  amount: string;
}

export interface DueRemindersResponse extends RpcEnvelope {
  branch: string;
  advanceDays: number;
  dueSoon: DueReminderItem[];
  dueToday: DueReminderItem[];
  overdue: DueReminderItem[];
  notRecorded: number;
  upToDate: number;
  gmcActive: number;
  kmcActive: number;
}

// -------------------------------------------------------------- receipts

export interface ReceiptSearchResponse extends RpcEnvelope {
  results: ReceiptRow[];
  rows: ReceiptRow[];
  total: number;
}

// -------------------------------------------------------------- cashbook

export interface CashbookEntry {
  entryId: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  type: "INFLOW" | "EXPENSE" | string;
  mode: string;
  approvalStatus: string;
  status: string;
}

export interface CashbookResponse extends RpcEnvelope {
  entries: CashbookEntry[];
}

// ------------------------------------------------------------- timetable

export interface TimetableEntry {
  id: string;
  branch: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  className: string;
  teacherId: string;
  teacherName: string;
  status: string;
  substituteTeacherId: string;
  substituteTeacherName: string;
}

export interface TimetableResponse extends RpcEnvelope {
  entries: TimetableEntry[];
  seeded: boolean;
}

// -------------------------------------------------------------- inquiries

export interface Inquiry {
  inquiry_id: string;
  name: string;
  phone: string;
  instrument: string;
  branch: string;
  source: string;
  status: string;
  finalStatus: string;
  next_contact_date: string;
  trialDate: string;
  dropReason: string;
  convertedStudentId: string;
  noAnswerCount: number;
  lastContactedAt: string;
  dormantReason: string;
  formerStudentId: string;
  formerTeacherId: string;
  created_at: string;
}

export interface InquiryQueueResponse extends RpcEnvelope {
  rows: Inquiry[];
  callToday: Inquiry[];
}

// -------------------------------------------------------------- approvals

export interface ApprovalItem {
  type: string;
  itemId: string;
  entity: string;
  studentId: string;
  noStudentLinked: boolean;
  paymentMode: string;
  feesPeriod: string;
  amount: string;
  branch: string;
  date: string;
  reason: string;
  flags: { backdated: boolean; incomplete: boolean; junk: boolean };
  termsStatus: string;
  actions: string[];
  receiptNo: string;
}

export interface ApprovalGroup {
  type: string;
  label: string;
  items: ApprovalItem[];
}

export interface ApprovalsResponse extends RpcEnvelope {
  branch: string;
  count: number;
  counts: Record<string, number>;
  empty: boolean;
  items: ApprovalItem[];
  groups: ApprovalGroup[];
}

export interface PaymentDraft {
  draftId: string;
  status: string;
  studentId: string;
  studentName: string;
  amount: string;
  paymentMode: string;
  branch: string;
  termsStatus: string;
  projectedNextDueDate: string;
  repairRequired: boolean;
  submittedAt: string;
  approvalAuthority: string;
  approvedBy: string;
}

export interface PaymentDraftsResponse extends RpcEnvelope {
  count: number;
  rows: PaymentDraft[];
  waitingOnTermsCount: number;
}

// --------------------------------------------------------------- invoices

export interface InvoiceOwner {
  name: string;
  id: string;
  signatureUrl: string;
  title: string;
}

export interface SchoolInvoice {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  branch: string;
  className: string;
  amount: number;
  tenure: string;
  pdfUrl: string;
  demo: boolean;
  owner1: InvoiceOwner;
  owner2: InvoiceOwner;
}

export interface InvoiceSummary {
  invoiceId: string;
  invoiceNo: string;
  invoiceDate: string;
  branch: string;
  className: string;
  amount: number;
  tenure: string;
  status: string;
}

export interface SchoolInvoiceListResponse extends RpcEnvelope {
  invoices: InvoiceSummary[];
}

export interface SchoolInvoiceResponse extends RpcEnvelope {
  invoice: SchoolInvoice;
}

// -------------------------------------------------------------- audit log

export interface AuditEntry {
  at: string;
  actorRole: string;
  actorEmail: string;
  device: string;
  fn: string;
  ok: boolean;
  code: string;
  branch: string;
  ref: string;
}

export interface AuditLogResponse extends RpcEnvelope {
  rows: AuditEntry[];
  count: number;
  note: string;
}

// ------------------------------------------------------------- attendance

export interface AttendanceRosterEntry {
  studentId: string;
  name: string;
  instrument: string;
  teacherId: string;
  teacherName: string;
  phone: string;
  expectedToday: boolean;
  state: "NOT_MARKED" | "PRESENT" | "ABSENT" | "EXCUSED" | "LATE" | string;
}

export interface AttendanceRosterResponse extends RpcEnvelope {
  date: string;
  branch: string;
  count: number;
  instruments: string[];
  students: AttendanceRosterEntry[];
}

// ----------------------------------------------------------- today classes

export interface TodaysClassesResponse extends RpcEnvelope {
  date: string;
  count: number;
  unanswered: number;
  outcomes: string[];
  rows: TodaysClass[];
  lateHours: number;
}

// ---------------------------------------------------------------- payouts

export interface PayoutRow {
  teacherId: string;
  teacherName: string;
  month: string;
  entityId: string;
  receiptCount: number;
  totalCollection: number | null;
  totalTeacherShare: number | null;
  payable: number | null;
  priced: boolean;
  alreadyPaid: number;
  balance: number | null;
  status: string;
  reasons: { message: string }[];
  qualifications: { message: string }[];
  missingRule?: boolean;
  preCutover: boolean;
  note: string;
}

export interface SharedStudentTeacher {
  teacherId: string;
  teacherName: string;
  classesThisMonth: number;
  assigned: number;
}

export interface SharedStudentDecision {
  studentId: string;
  studentName: string;
  collected: number;
  assigned: number;
  remaining: number;
  receiptCount: number;
  teachers: SharedStudentTeacher[];
}

export interface PayoutPreviewResponse extends RpcEnvelope {
  results: PayoutRow[];
  awaitingDecision: SharedStudentDecision[];
  awaitingDecisionAmount: number;
  unattributedReceipts: number;
  unattributedAmount: number;
  earningBaseDefined: boolean;
  note: string;
}

// --------------------------------------------------------------- sync

export interface SyncSnapshotResponse extends RpcEnvelope {
  revisions: Record<string, number>;
  changes: Record<string, unknown>[];
}
