// Plain data models mirroring the Railway RPC `api_*` response shapes.
// All parsing is defensive: unknown/missing fields fall back to '' or 0.

String _s(dynamic v) => v == null ? '' : v.toString();
num _n(dynamic v) {
  if (v is num) return v;
  final s = v == null ? '' : v.toString().replaceAll(RegExp(r'[^\d.\-]'), '');
  final d = double.tryParse(s);
  return d ?? 0;
}

class Operator {
  Operator({required this.email, required this.role, required this.name, this.branches = const []});
  factory Operator.fromApi(Map<String, dynamic> b) {
    // Staff boot: {ok, email, isOpsAccount, branches}
    final bool isOps = b['isOpsAccount'] == true;
    final role = isOps ? 'OPS_USER' : _s(b['role']).ifEmpty('FOUNDER_ADMIN');
    final branches = (b['branches'] as List?)?.map((e) => _s(e)).toList() ?? const <String>[];
    return Operator(
      email: _s(b['email']),
      role: role,
      name: _s(b['name']).ifEmpty(_s(b['email']).split('@').first),
      branches: branches,
    );
  }
  final String email;
  final String role;
  final String name;
  final List<String> branches;
  bool get isFounder => role == 'FOUNDER_ADMIN';
  bool get isStaff => role == 'OPS_USER';
}

extension _StringExt on String {
  String ifEmpty(String fallback) => isEmpty ? fallback : this;
}

class Bootstrap {
  Bootstrap({
    required this.operator,
    required this.accounts,
    required this.paymentModes,
    required this.planTypes,
    required this.classCodes,
    this.branches,
    this.dueReminders,
  });
  factory Bootstrap.fromApi(Map<String, dynamic> b) {
    return Bootstrap(
      operator: Operator.fromApi(b),
      accounts: List<String>.from((b['accounts'] as List?) ?? const []),
      paymentModes:
          List<String>.from((b['paymentModes'] as List?) ?? const []),
      planTypes: List<String>.from((b['planTypes'] as List?) ?? const []),
      classCodes: List<String>.from((b['classCodes'] as List?) ?? const []),
      branches: (b['branches'] as List?)?.map((e) => _s(e)).toList(),
      dueReminders: DueReminders.tryFrom(b['dueReminders']),
    );
  }
  final Operator operator;
  final List<String> accounts;
  final List<String> paymentModes;
  final List<String> planTypes;
  final List<String> classCodes;
  final List<String>? branches;
  final DueReminders? dueReminders;
}

class Student {
  Student({
    required this.studentId,
    required this.studentName,
    required this.phone,
    required this.email,
    this.guardianName = '',
    required this.instrument,
    required this.teacher,
    required this.classCode,
    required this.className,
    required this.location,
    required this.batch,
    required this.feePlan,
    required this.feeCycleType,
    this.feeDueDay = '',
    required this.nextDueDate,
    required this.feeStatus,
    required this.lastReceiptNo,
    this.lastReceiptAmount = '',
    required this.status,
    this.admissionSource,
    this.teacherId = '',
    this.monthlyFee = '',
  });
  factory Student.fromApi(Map<String, dynamic> b) => Student(
        studentId: _s(b['studentId'] ?? b['id']),
        studentName: _s(b['studentName'] ?? b['name']),
        phone: _s(b['phone']),
        email: _s(b['email']),
        guardianName: _s(b['guardianName'] ?? b['parentName'] ?? b['guardian_name']),
        instrument: _s(b['instrument'] ?? b['course']),
        teacher: _s(b['teacher']),
        classCode: _s(b['classCode']).toUpperCase(),
        className: _s(b['className']),
        location: _s(b['location'] ?? b['branch']),
        batch: _s(b['batch']),
        feePlan: _s(b['feePlan']),
        feeCycleType: _s(b['feeCycleType']),
        feeDueDay: _s(b['feeDueDay']),
        nextDueDate: _s(b['nextDueDate']),
        feeStatus: _s(b['feeStatus']),
        lastReceiptNo: _s(b['lastReceiptNo']),
        lastReceiptAmount: _s(b['lastReceiptAmount']),
        status: _s(b['status']),
        admissionSource: _s(b['admissionSource']).isEmpty ? null : _s(b['admissionSource']),
        teacherId: _s(b['teacherId']),
        monthlyFee: _s(b['monthlyFee']),
      );

  final String studentId;
  final String studentName;
  final String phone;
  final String email;
  final String guardianName;
  final String instrument;
  final String teacher;
  final String classCode;
  final String className;
  final String location;
  final String batch;
  final String feePlan;
  final String feeCycleType;
  final String feeDueDay;
  final String nextDueDate;
  final String feeStatus;
  final String lastReceiptNo;
  final String lastReceiptAmount;
  final String status;
  final String? admissionSource;
  final String teacherId;
  final String monthlyFee;

  bool get operational => status.isEmpty || status.toUpperCase() == 'ACTIVE';
}

/// Founder request 2026-09-28: a trial stage before real admission. Same
/// students_acad row as a real Student once converted — this is just the
/// lighter shape the Demo Students list/add form works with (no fee plan
/// exists yet).
class DemoStudent {
  const DemoStudent({
    required this.studentId,
    required this.studentName,
    required this.phone,
    this.email = '',
    required this.guardianName,
    required this.guardianPhone,
    required this.instrument,
    required this.branch,
    this.teacherId = '',
    this.teacherName = '',
    required this.demoDate,
    required this.demoTime,
  });
  factory DemoStudent.fromApi(Map<String, dynamic> b) => DemoStudent(
        studentId: _s(b['studentId']),
        studentName: _s(b['studentName']),
        phone: _s(b['phone']),
        email: _s(b['email']),
        guardianName: _s(b['guardianName']),
        guardianPhone: _s(b['guardianPhone']),
        instrument: _s(b['instrument']),
        branch: _s(b['branch']),
        teacherId: _s(b['teacherId']),
        teacherName: _s(b['teacherName']),
        demoDate: _s(b['demoDate']),
        demoTime: _s(b['demoTime']),
      );
  final String studentId;
  final String studentName;
  final String phone;
  final String email;
  final String guardianName;
  final String guardianPhone;
  final String instrument;
  final String branch;
  final String teacherId;
  final String teacherName;
  final String demoDate;
  final String demoTime;
}

/// Brief-adjacent, founder-requested 2026-09-17: how a lead became an
/// admission. Optional on every student — blank on older records.
class AdmissionSource {
  const AdmissionSource(this.value, this.label);
  final String value;
  final String label;
}

const admissionSources = [
  AdmissionSource('WALK_IN', 'Walk-in'),
  AdmissionSource('FOLLOW_UP', 'Follow-up'),
  AdmissionSource('REFERRAL', 'Referral'),
  AdmissionSource('ONLINE_SOCIAL', 'Online / Social'),
  AdmissionSource('OTHER', 'Other'),
];

String admissionSourceLabel(String? value) {
  if (value == null || value.isEmpty) return '';
  for (final s in admissionSources) {
    if (s.value == value) return s.label;
  }
  return value;
}

class DueReminderItem {
  DueReminderItem({
    this.studentId = '',
    required this.studentName,
    required this.phone,
    required this.classCode,
    required this.instrument,
    required this.nextDueDate,
    required this.feeStatus,
    required this.lastReceiptNo,
  });
  factory DueReminderItem.fromApi(Map<String, dynamic> b) => DueReminderItem(
        studentId: _s(b['studentId']),
        studentName: _s(b['studentName']),
        phone: _s(b['phone']),
        classCode: _s(b['classCode']),
        instrument: _s(b['instrument']),
        nextDueDate: _s(b['nextDueDate']),
        feeStatus: _s(b['feeStatus']),
        lastReceiptNo: _s(b['lastReceiptNo']),
      );
  final String studentId;
  final String studentName;
  final String phone;
  final String classCode;
  final String instrument;
  final String nextDueDate;
  final String feeStatus;
  final String lastReceiptNo;
}

class DueReminders {
  DueReminders({
    required this.branch,
    required this.advanceDays,
    required this.dueSoon,
    required this.dueToday,
    required this.overdue,
    required this.gmcActive,
    required this.kmcActive,
  });
  static DueReminders? tryFrom(dynamic b) {
    if (b is! Map<String, dynamic> || b['ok'] != true) return null;
    List<DueReminderItem> items(String k) =>
        ((b[k] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(DueReminderItem.fromApi)
            .toList();
    return DueReminders(
      branch: _s(b['branch']),
      advanceDays: (b['advanceDays'] as num?)?.toInt() ?? 0,
      dueSoon: items('dueSoon'),
      dueToday: items('dueToday'),
      overdue: items('overdue'),
      gmcActive: (b['gmcActive'] as num?)?.toInt() ?? 0,
      kmcActive: (b['kmcActive'] as num?)?.toInt() ?? 0,
    );
  }
  final String branch;
  final int advanceDays;
  final List<DueReminderItem> dueSoon;
  final List<DueReminderItem> dueToday;
  final List<DueReminderItem> overdue;
  final int gmcActive;
  final int kmcActive;

  int get count => dueSoon.length + dueToday.length + overdue.length;
}

class DashboardMetrics {
  DashboardMetrics({
    required this.todayCollection,
    required this.monthCollection,
    required this.todayCount,
    required this.monthCount,
    required this.cashToday,
    required this.onlineToday,
    required this.recent,
    required this.scope,
    required this.consolidated,
    required this.dueTodayCount,
    required this.overdueCount,
    required this.termsPendingCount,
    required this.approvalsCount,
    required this.overview,
    required this.cards,
  });
  factory DashboardMetrics.fromApi(Map<String, dynamic> b) {
    final m = (b['metrics'] is Map<String, dynamic>)
        ? b['metrics'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return DashboardMetrics(
      todayCollection: _n(b['todayCollection']),
      monthCollection: _n(b['monthCollection']),
      todayCount: (b['todayCount'] as num?)?.toInt() ?? 0,
      monthCount: (b['monthCount'] as num?)?.toInt() ?? 0,
      cashToday: _n(b['cashToday']),
      onlineToday: _n(b['onlineToday']),
      recent: ((b['recent'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ReceiptRow.fromApi)
          .toList(),
      scope: _s(b['scope']),
      consolidated: b['consolidated'] == true,
      dueTodayCount: (m['dueTodayCount'] as num?)?.toInt() ?? 0,
      overdueCount: (m['overdueCount'] as num?)?.toInt() ?? 0,
      termsPendingCount: (m['termsPendingCount'] as num?)?.toInt() ?? 0,
      approvalsCount: (b['approvalsCount'] as num?)?.toInt() ?? 0,
      overview: DashboardOverview.fromApi(b),
      cards: ((b['cards'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(TaskCard.fromApi).toList(),
    );
  }
  final num todayCollection;
  final num monthCollection;
  final int todayCount;
  final int monthCount;
  final num cashToday;
  final num onlineToday;
  final List<ReceiptRow> recent;
  final String scope;
  final bool consolidated;
  final int dueTodayCount;
  final int overdueCount;
  final int termsPendingCount;
  final int approvalsCount;
  final DashboardOverview overview;
  final List<TaskCard> cards;
}

class ReceiptRow {
  ReceiptRow({
    required this.receiptNo,
    required this.date,
    required this.student,
    required this.amount,
    required this.mode,
    required this.paymentMode,
    required this.status,
    required this.entityId,
    required this.pdfUrl,
    required this.excluded,
    this.feePeriodFrom = '',
    this.feePeriodTo = '',
    this.txnId = '',
    this.studentId = '',
    this.voidReason = '',
  });
  factory ReceiptRow.fromApi(Map<String, dynamic> b) => ReceiptRow(
        receiptNo: _s(b['receiptNo']),
        date: _s(b['date']),
        student: _s(b['student'] ?? b['studentName']),
        amount: _n(b['amount']),
        mode: _s(b['mode']),
        paymentMode: _s(b['paymentMode']),
        status: _s(b['status']),
        entityId: _s(b['entityId']),
        pdfUrl: _s(b['pdfUrl']),
        excluded: b['excluded'] == true,
        feePeriodFrom: _s(b['feePeriodFrom']),
        feePeriodTo: _s(b['feePeriodTo']),
        txnId: _s(b['txnId']),
        studentId: _s(b['studentId']),
        voidReason: _s(b['voidReason']),
      );
  final String receiptNo;
  final String date;
  final String student;
  final num amount;
  final String mode;
  final String paymentMode;
  final String status;
  final String entityId;
  final String pdfUrl;
  final bool excluded;
  final String feePeriodFrom;
  final String feePeriodTo;
  final String txnId;
  /// Empty for older receipts that were never linked to a student.
  final String studentId;
  final String voidReason;
}

/// One WhatsApp message a person chose to send (api_staff_sendWhatsApp).
class WaMessage {
  WaMessage({
    required this.messageId,
    required this.kind,
    required this.status,
    required this.to,
    required this.body,
    required this.fileName,
    required this.error,
    required this.createdAt,
    required this.sentAt,
    required this.deliveredAt,
    required this.readAt,
  });
  factory WaMessage.fromApi(Map<String, dynamic> b) => WaMessage(
        messageId: _s(b['messageId']),
        kind: _s(b['kind']),
        status: _s(b['status']),
        to: _s(b['to']),
        body: _s(b['body']),
        fileName: _s(b['fileName']),
        error: _s(b['error']),
        createdAt: _s(b['createdAt']),
        sentAt: _s(b['sentAt']),
        deliveredAt: _s(b['deliveredAt']),
        readAt: _s(b['readAt']),
      );
  final String messageId;
  final String kind;
  /// SENDING, SENT, DELIVERED, READ or FAILED.
  final String status;
  /// Masked number, e.g. 98••••1223 — the app never holds the full number.
  final String to;
  final String body;
  final String fileName;
  final String error;
  final String createdAt;
  final String sentAt;
  final String deliveredAt;
  final String readAt;

  bool get delivered => status == 'DELIVERED' || status == 'READ';

  String get when {
    final t = sentAt.isNotEmpty ? sentAt : createdAt;
    return t.length >= 16 ? t.substring(0, 16).replaceFirst('T', ' ') : t;
  }
}

class Teacher {
  Teacher({
    required this.teacherId,
    required this.teacherName,
    required this.primaryRole,
    required this.payoutStreams,
    required this.payoutModel,
    required this.branchClassCode,
    required this.status,
    required this.phone,
    required this.email,
    this.academyShare = '',
    this.missingFields = const [],
  });
  factory Teacher.fromApi(Map<String, dynamic> b) => Teacher(
        teacherId: _s(b['teacherId']),
        teacherName: _s(b['teacherName']),
        primaryRole: _s(b['primaryRole']),
        payoutStreams: _s(b['payoutStreams']),
        payoutModel: _s(b['payoutModel']),
        branchClassCode: _s(b['branchClassCode']),
        status: _s(b['status']),
        phone: _s(b['phone']),
        email: _s(b['email']),
        academyShare: _s(b['academyShare']),
        missingFields: ((b['missingFields'] as List?) ?? const []).map((e) => e.toString()).toList(),
      );
  final String teacherId;
  final String teacherName;
  final String primaryRole;
  final String payoutStreams;
  final String payoutModel;
  final String branchClassCode;
  final String status;
  final String phone;
  final String email;
  final String academyShare;
  /// e.g. ['phone', 'payout rule'] — flagged automatically, never auto-filled.
  final List<String> missingFields;
  bool get profileIncomplete => missingFields.isNotEmpty;

  String get shareLabel => academyShare.isEmpty ? '' : (academyShare.endsWith('%') ? academyShare : '$academyShare%');
}

class ExpenseEntry {
  ExpenseEntry({
    required this.entryId,
    required this.date,
    required this.category,
    required this.description,
    required this.amount,
    required this.type,
    required this.mode,
    required this.approvalStatus,
    required this.status,
  });
  factory ExpenseEntry.fromApi(Map<String, dynamic> b) => ExpenseEntry(
        entryId: _s(b['entryId'] ?? b['id'] ?? ''),
        date: _s(b['date']),
        category: _s(b['category']),
        description: _s(b['description'] ?? b['narrative']),
        amount: _n(b['amount']),
        type: _s(b['type'] ?? b['flow']),
        mode: _s(b['mode']),
        approvalStatus: _s(b['approvalStatus']),
        status: _s(b['status']),
      );
  final String entryId;
  final String date;
  final String category;
  final String description;
  final num amount;
  final String type;
  final String mode;
  final String approvalStatus;
  final String status;
}

/// Statuses the server can send (handlers2.ts inquiryTransition) — not the
/// legacy NEW/FOLLOW_UP names, which the server never actually returns.
/// Matches the server's own TERMINAL_INQUIRY_STATUSES (rules.ts) exactly —
/// DORMANT belongs here too, or a dormant lead still shows as actionable.
const _kInquiryTerminalStatuses = {'CONVERTED', 'DROPPED', 'DORMANT'};

/// The `source` value stamped on a lead auto-created because a student's
/// status became LEFT (handlers.ts createWinBackLeadIfNeeded).
const kFormerStudentSource = 'Former Student';

class Inquiry {
  Inquiry({
    required this.inquiryId,
    required this.name,
    required this.phone,
    required this.course,
    required this.branch,
    required this.source,
    required this.status,
    required this.finalStatus,
    required this.dormantReason,
    required this.followUpDate,
    required this.createdAt,
  });
  factory Inquiry.fromApi(Map<String, dynamic> b) => Inquiry(
        inquiryId: _s(b['inquiryId'] ?? b['id'] ?? b['inquiry_id']),
        name: _s(b['name'] ?? b['studentName']),
        phone: _s(b['phone']),
        course: _s(b['course'] ?? b['instrument']),
        branch: _s(b['branch']),
        source: _s(b['source']),
        status: _s(b['status']),
        finalStatus: _s(b['finalStatus']).isNotEmpty ? _s(b['finalStatus']) : _deriveFinalStatus(_s(b['status'])),
        dormantReason: _s(b['dormantReason']),
        followUpDate: _s(b['followUpDate'] ?? b['followUp'] ?? b['next_contact_date']),
        createdAt: _s(b['createdAt'] ?? b['created_at']),
      );
  final String inquiryId;
  final String name;
  final String phone;
  final String course;
  final String branch;
  /// How this lead came in — e.g. Walk-in, Referral, or "Former Student"
  /// for a win-back lead auto-created when a student's status became LEFT.
  final String source;
  /// The workflow state: OPEN, CONTACTED, DORMANT, TRIAL_SCHEDULED,
  /// TRIAL_DONE, DROPPED or CONVERTED.
  final String status;
  /// The parent's actual decision: APPROVED (wants to join), REJECTED
  /// (doesn't), or PENDING (not decided yet) — derived server-side from
  /// [status], never a second source of truth.
  final String finalStatus;
  /// NO_ANSWER (3 missed calls, recalled after 90 days) or TIMEOUT (30 days
  /// without conversion, never recalled automatically) — only set when
  /// [status] is DORMANT.
  final String dormantReason;
  final String followUpDate;
  final String createdAt;
  bool get actionable => !_kInquiryTerminalStatuses.contains(status.toUpperCase());
  bool get isFormerStudent => source == kFormerStudentSource;
  bool get hasInstrumentPreference => course.trim().isNotEmpty;

  static String _deriveFinalStatus(String status) {
    final s = status.toUpperCase();
    if (s == 'CONVERTED') return 'APPROVED';
    if (s == 'DROPPED') return 'REJECTED';
    return 'PENDING';
  }
}

class InquiryFollowup {
  InquiryFollowup({
    required this.id,
    required this.action,
    required this.description,
    required this.resultingStatus,
    required this.nextContactDate,
    required this.createdBy,
    required this.createdAt,
  });
  factory InquiryFollowup.fromApi(Map<String, dynamic> b) => InquiryFollowup(
        id: _s(b['id']),
        action: _s(b['action']),
        description: _s(b['description']),
        resultingStatus: _s(b['resultingStatus']),
        nextContactDate: _s(b['nextContactDate']),
        createdBy: _s(b['createdBy']),
        createdAt: _s(b['createdAt']),
      );
  final String id;
  final String action;
  final String description;
  final String resultingStatus;
  final String nextContactDate;
  final String createdBy;
  final String createdAt;
}

class InquiryDetail {
  InquiryDetail({
    required this.inquiryId,
    required this.name,
    required this.phone,
    required this.course,
    required this.branch,
    required this.source,
    required this.notes,
    required this.status,
    required this.finalStatus,
    required this.createdAt,
    required this.nextContactDate,
    required this.trialDate,
    required this.dropReason,
    required this.convertedStudentId,
    required this.noAnswerCount,
    required this.lastContactedAt,
    required this.dormantReason,
    required this.formerStudentId,
    required this.followups,
  });
  factory InquiryDetail.fromApi(Map<String, dynamic> b) => InquiryDetail(
        inquiryId: _s(b['inquiryId']),
        name: _s(b['name']),
        phone: _s(b['phone']),
        course: _s(b['course']),
        branch: _s(b['branch']),
        source: _s(b['source']),
        notes: _s(b['notes']),
        status: _s(b['status']),
        finalStatus: _s(b['finalStatus']),
        createdAt: _s(b['createdAt']),
        nextContactDate: _s(b['nextContactDate']),
        trialDate: _s(b['trialDate']),
        dropReason: _s(b['dropReason']),
        convertedStudentId: _s(b['convertedStudentId']),
        noAnswerCount: (b['noAnswerCount'] as num?)?.toInt() ?? 0,
        lastContactedAt: _s(b['lastContactedAt']),
        dormantReason: _s(b['dormantReason']),
        formerStudentId: _s(b['formerStudentId']),
        followups: ((b['followups'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(InquiryFollowup.fromApi)
            .toList(),
      );
  final String inquiryId;
  final String name;
  final String phone;
  final String course;
  final String branch;
  final String source;
  final String notes;
  final String status;
  final String finalStatus;
  final String createdAt;
  final String nextContactDate;
  final String trialDate;
  final String dropReason;
  final String convertedStudentId;
  final int noAnswerCount;
  final String lastContactedAt;
  final String dormantReason;
  final String formerStudentId;
  final List<InquiryFollowup> followups;
  bool get isFormerStudent => source == kFormerStudentSource;
}

class TaskCard {
  TaskCard({
    required this.key,
    required this.title,
    required this.priority,
    required this.count,
    required this.state,
    required this.label,
    required this.emptyText,
    required this.targetView,
    required this.actionable,
  });
  factory TaskCard.fromApi(Map<String, dynamic> b) => TaskCard(
        key: _s(b['key']),
        title: _s(b['title'] ?? b['label']),
        priority: _s(b['priority']),
        count: (b['count'] as num?)?.toInt(),
        state: _s(b['state']),
        label: _s(b['label']),
        emptyText: _s(b['emptyText']),
        targetView: _s(b['targetView'] ?? b['destination']),
        actionable: b['actionable'] == true,
      );
  final String key;
  final String title;
  final String priority;
  final int? count;
  final String state;
  final String label;
  final String emptyText;
  final String targetView;
  final bool actionable;

  bool get needsAttention => state == 'ATTENTION' || (count ?? 0) > 0;
}

class TodaysClass {
  TodaysClass({
    required this.eventId,
    required this.classDate,
    required this.startTime,
    required this.teacherId,
    this.teacherName = '',
    required this.branch,
    required this.course,
    required this.outcome,
    required this.deliveredBy,
    required this.payeeTeacherId,
    required this.entryDate,
    required this.recordedBy,
    required this.evidenceClass,
    required this.evidenceReason,
    required this.notRequired,
    required this.closureReason,
    required this.customKind,
    required this.customReason,
    required this.resolved,
    required this.answerable,
  });
  factory TodaysClass.fromApi(Map<String, dynamic> b) => TodaysClass(
        eventId: _s(b['eventId']),
        classDate: _s(b['classDate']),
        startTime: _s(b['startTime']),
        teacherId: _s(b['teacherId']),
        teacherName: _s(b['teacherName']),
        branch: _s(b['branch']),
        course: _s(b['course']),
        outcome: _s(b['outcome']),
        deliveredBy: _s(b['deliveredBy']),
        payeeTeacherId: _s(b['payeeTeacherId']),
        entryDate: _s(b['entryDate']),
        recordedBy: _s(b['recordedBy']),
        evidenceClass: _s(b['evidenceClass']),
        evidenceReason: _s(b['evidenceReason']),
        notRequired: b['notRequired'] == true,
        closureReason: _s(b['closureReason']),
        customKind: _s(b['customKind']),
        customReason: _s(b['customReason']),
        resolved: b['resolved'] == true,
        answerable: b['answerable'] == true,
      );
  final String eventId;
  final String classDate;
  final String startTime;
  final String teacherId;
  final String teacherName;
  final String branch;
  final String course;
  final String outcome;
  final String deliveredBy;
  final String payeeTeacherId;
  final String entryDate;
  final String recordedBy;
  final String evidenceClass;
  final String evidenceReason;
  final bool notRequired;
  final String closureReason;
  final String customKind;
  final String customReason;
  final bool resolved;
  final bool answerable;

  bool get isHeld => outcome.toUpperCase() == 'HELD';
  bool get isCancelled => ['TEACHER_CANCELLED', 'ACADEMY_CANCELLED'].contains(outcome.toUpperCase());
  bool get isSubstituted => outcome.toUpperCase() == 'SUBSTITUTE_DELIVERED';
}

class TodaysClassOptions {
  TodaysClassOptions({
    required this.date,
    required this.rows,
    required this.count,
    required this.unanswered,
    required this.outcomes,
  });
  factory TodaysClassOptions.fromApi(Map<String, dynamic> b) => TodaysClassOptions(
        date: _s(b['date']),
        rows: ((b['rows'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(TodaysClass.fromApi)
            .toList(),
        count: (b['count'] as num?)?.toInt() ?? 0,
        unanswered: (b['unanswered'] as num?)?.toInt() ?? 0,
        outcomes: ((b['outcomes'] as List?) ?? const []).map((e) => _s(e)).toList(),
      );
  final String date;
  final List<TodaysClass> rows;
  final int count;
  final int unanswered;
  final List<String> outcomes;
}

class ApprovalItem {
  ApprovalItem({
    required this.type,
    required this.itemId,
    required this.entity,
    required this.studentId,
    required this.noStudentLinked,
    required this.paymentMode,
    required this.feesPeriod,
    required this.amount,
    required this.branch,
    required this.date,
    required this.reason,
    required this.backdated,
    required this.incomplete,
    required this.junk,
    required this.termsStatus,
    required this.actions,
    this.receiptNo = '',
  });
  factory ApprovalItem.fromApi(Map<String, dynamic> b) {
    final f = b['flags'] is Map<String, dynamic>
        ? b['flags'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return ApprovalItem(
      type: _s(b['type']),
      itemId: _s(b['itemId']),
      entity: _s(b['entity']),
      studentId: _s(b['studentId']),
      noStudentLinked: b['noStudentLinked'] == true,
      paymentMode: _s(b['paymentMode']),
      feesPeriod: _s(b['feesPeriod']),
      amount: _s(b['amount']),
      branch: _s(b['branch']),
      date: _s(b['date']),
      reason: _s(b['reason']),
      backdated: f['backdated'] == true,
      incomplete: f['incomplete'] == true,
      junk: f['junk'] == true,
      termsStatus: _s(b['termsStatus']),
      actions: ((b['actions'] as List?) ?? const []).map((e) => _s(e)).toList(),
      receiptNo: _s(b['receiptNo']),
    );
  }
  final String type;
  final String itemId;
  final String entity;
  final String studentId;
  final bool noStudentLinked;
  final String paymentMode;
  final String feesPeriod;
  final String amount;
  final String branch;
  final String date;
  final String reason;
  final bool backdated;
  final bool incomplete;
  final bool junk;
  final String termsStatus;
  final List<String> actions;
  final String receiptNo;

  bool get isPayment => type == 'PAYMENT_DRAFT';
  bool get isStudent => type == 'STUDENT_DRAFT';

  /// Short human label for the approval type, so a card says what it is
  /// rather than only which group it arrived under. Mirrors the web
  /// APPROVAL_TYPE_LABEL map.
  String get typeLabel => switch (type) {
        'PAYMENT_DRAFT' => 'Fee payment',
        'EXPENSE_DRAFT' => 'Expense',
        'STUDENT_DRAFT' => 'Student',
        'RECEIPT_CORRECTION' => 'Receipt correction',
        'SCHOOL_INVOICE_DRAFT' => 'School invoice',
        'PACKAGE_EXTENSION' => 'Package extension',
        'PAYMENT_PROFILE_CHANGE' => 'Payment profile',
        'CLOSURE' => 'Closure / holiday',
        'CLASS_CORRECTION' => 'Class correction',
        'LATE_FEE_WAIVER' => 'Late-fee waiver',
        'INSTALMENT_PLAN' => 'Instalment plan',
        'MANUAL_TERMS_ACCEPTANCE' => 'Terms acceptance',
        'TEACHER_ADD_REQUEST' => 'New teacher',
        'TEACHER_EDIT_REQUEST' => 'Teacher change',
        _ => type.replaceAll('_', ' '),
      };
}

class ApprovalGroup {
  ApprovalGroup({required this.type, required this.label, required this.items});
  factory ApprovalGroup.fromApi(Map<String, dynamic> b) => ApprovalGroup(
        type: _s(b['type']),
        label: _s(b['label']),
        items: ((b['items'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(ApprovalItem.fromApi)
            .toList(),
      );
  final String type;
  final String label;
  final List<ApprovalItem> items;
}

class ApprovalsData {
  ApprovalsData({required this.count, required this.groups, required this.empty});
  factory ApprovalsData.fromApi(Map<String, dynamic> b) => ApprovalsData(
        count: (b['count'] as num?)?.toInt() ?? 0,
        groups: ((b['groups'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(ApprovalGroup.fromApi)
            .toList(),
        empty: b['empty'] == true,
      );
  final int count;
  final List<ApprovalGroup> groups;
  final bool empty;
}

class CommMessage {
  CommMessage({
    required this.type,
    required this.subject,
    required this.body,
    required this.recipientName,
    required this.recipientType,
    required this.typeRequested,
    required this.typeResolved,
    required this.typeCorrected,
    required this.typeNote,
    required this.mode,
    required this.providerSend,
    required this.termsLink,
    required this.warnings,
    this.kind = '',
    this.recipientPhone = '',
  });
  factory CommMessage.fromApi(Map<String, dynamic> b) => CommMessage(
        type: _s(b['type']),
        subject: _s(b['subject']),
        body: _s(b['body']),
        recipientName: _s(b['recipientName']),
        recipientType: _s(b['recipientType']),
        typeRequested: _s(b['typeRequested']),
        typeResolved: _s(b['typeResolved']),
        typeCorrected: b['typeCorrected'] == true,
        typeNote: _s(b['typeNote']),
        mode: _s(b['mode']),
        providerSend: _s(b['providerSend']),
        termsLink: _s(b['termsLink']),
        warnings: ((b['warnings'] as List?) ?? const []).map((e) => _s(e)).toList(),
        kind: _s(b['kind']),
        recipientPhone: _s(b['recipientPhone']),
      );
  /// Message kind for the send log (FEE_REMINDER, RENEWAL, ...).
  final String kind;
  /// Masked registered number the message would go to.
  final String recipientPhone;
  /// The server offers one-tap WhatsApp send for this message.
  bool get canWhatsApp => mode == 'WHATSAPP';
  final String type;
  final String subject;
  final String body;
  final String recipientName;
  final String recipientType;
  final String typeRequested;
  final String typeResolved;
  final bool typeCorrected;
  final String typeNote;
  final String mode;
  final String providerSend;
  final String termsLink;
  final List<String> warnings;

  bool get copyOnly => mode.toUpperCase().contains('COPY_ONLY');
  bool get sendDisabled => providerSend.toUpperCase().contains('DISABLED');
}

/// Machine-readable money formatting shared across the app.
String inr(num amount) {
  final v = amount.toDouble();
  final sign = v < 0 ? '-' : '';
  final av = v.abs();
  final parts = av.toStringAsFixed(0).split('.');
  final last3 = parts[0].length > 3 ? parts[0].substring(parts[0].length - 3) : parts[0];
  final rest = parts[0].length > 3 ? parts[0].substring(0, parts[0].length - 3) : '';
  String grouped = rest.isEmpty ? last3 : '${_group2(rest)},$last3';
  return '$sign₹$grouped';
}

String _group2(String s) {
  final buf = StringBuffer();
  for (var i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 2 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return buf.toString();
}

String moneyRounded(num amount) {
  final v = _n(amount);
  return (v % 1 == 0) ? v.toStringAsFixed(0) : v.toStringAsFixed(2);
}

/// A staff-approved payment draft ("approved, receipt not yet created").
class PendingFinaliseDraft {
  PendingFinaliseDraft({
    required this.draftId,
    required this.amount,
    required this.paymentDate,
    required this.approvalAuthority,
    required this.approvedBy,
    required this.founderDecision,
    required this.label,
    required this.repairRequired,
    required this.status,
    required this.canFinalise,
    required this.blockedReason,
  });
  factory PendingFinaliseDraft.fromApi(Map<String, dynamic> b) =>
      PendingFinaliseDraft(
        draftId: _s(b['draftId']),
        amount: _s(b['amount']),
        paymentDate: _s(b['paymentDate']),
        approvalAuthority: _s(b['approvalAuthority']),
        approvedBy: _s(b['approvedBy']),
        founderDecision: b['founderDecision'] == true,
        label: _s(b['label']),
        repairRequired: b['repairRequired'] == true,
        status: _s(b['status']),
        canFinalise: b['canFinalise'] == true,
        blockedReason: _s(b['blockedReason']),
      );
  final String draftId;
  final String amount;
  final String paymentDate;
  final String approvalAuthority;
  final String approvedBy;
  final bool founderDecision;
  final String label;
  final bool repairRequired;
  final String status;
  final bool canFinalise;
  final String blockedReason;
}

/// Staff Student Hub — one call carrying profile + pending receipts + terms.
/// A founder payment-draft queue row (SUBMITTED → approve/reject;
/// APPROVED → finalise into a real receipt). From api_founder_listPaymentDrafts.
class PaymentDraftRow {
  PaymentDraftRow({
    required this.draftId,
    required this.status,
    required this.studentId,
    required this.studentName,
    required this.amount,
    required this.paymentMode,
    required this.branch,
    required this.termsStatus,
    required this.projectNextDueDate,
    required this.repairRequired,
    required this.submittedAt,
    this.approvalAuthority = '',
    this.approvedBy = '',
  });
  factory PaymentDraftRow.fromApi(Map<String, dynamic> b) {
    return PaymentDraftRow(
      draftId: _s(b['draftId']),
      status: _s(b['status']),
      studentId: _s(b['studentId']),
      studentName: _s(b['studentName']),
      amount: _s(b['amount']),
      paymentMode: _s(b['paymentMode']),
      branch: _s(b['branch']),
      termsStatus: _s(b['termsStatus']),
      projectNextDueDate: _s(b['projectedNextDueDate']),
      repairRequired: b['repairRequired'] == true,
      submittedAt: _s(b['submittedAt']),
      approvalAuthority: _s(b['approvalAuthority']),
      approvedBy: _s(b['approvedBy']),
    );
  }
  final String draftId;
  final String status;
  final String studentId;
  final String studentName;
  final String amount;
  final String paymentMode;
  final String branch;
  final String termsStatus;
  final String projectNextDueDate;
  final bool repairRequired;
  final String submittedAt;
  final String approvalAuthority;
  final String approvedBy;

  bool get approved => status.toUpperCase() == 'APPROVED';
  bool get waitingTerms => status.toUpperCase() == 'PENDING_TERMS_AND_APPROVAL';

  /// Honest authority label — never invent a founder name for ROUTINE_LANE.
  String get authorityLabel {
    final a = approvalAuthority.toUpperCase();
    if (a == 'ROUTINE_LANE') return 'Routine lane (system rules — no founder)';
    if (a == 'FOUNDER' && approvedBy.isNotEmpty) return 'Approved by $approvedBy';
    if (a == 'FOUNDER') return 'Approved by founder';
    return '—';
  }
}

/// A single founder teacher-payout preview row (server-computed payable).
/// Never compute payouts on the device — display only.
/// One recorded write from the backend audit trail (api_founder_auditLog).
class AuditEntry {
  AuditEntry({
    required this.at,
    required this.actorRole,
    required this.actorEmail,
    required this.device,
    required this.fn,
    required this.ok,
    required this.code,
    required this.branch,
    required this.ref,
  });
  factory AuditEntry.fromApi(Map<String, dynamic> b) => AuditEntry(
        at: _s(b['at']),
        actorRole: _s(b['actorRole']),
        actorEmail: _s(b['actorEmail']),
        device: _s(b['device']),
        fn: _s(b['fn']),
        ok: b['ok'] == true,
        code: _s(b['code']),
        branch: _s(b['branch']),
        ref: _s(b['ref']),
      );
  final String at;
  final String actorRole;
  final String actorEmail;
  final String device;
  final String fn;
  final bool ok;
  final String code;
  final String branch;
  final String ref;

  /// "api_staff_markAttendance" -> "Mark attendance".
  String get action {
    var name = fn.replaceFirst('api_', '').replaceFirst('founder_', '').replaceFirst('staff_', '');
    name = name.replaceAllMapped(RegExp(r'([a-z])([A-Z])'), (m) => '${m[1]} ${m[2]}').toLowerCase();
    return name.isEmpty ? fn : '${name[0].toUpperCase()}${name.substring(1)}';
  }

  /// "2026-09-16T18:04:11.123Z" -> "2026-09-16 18:04".
  String get whenLabel => at.length >= 16 ? at.substring(0, 16).replaceFirst('T', ' ') : at;
}

/// A student taught by more than one teacher in a month. Their fee counts
/// for nobody until the founder decides the split.
class SharedStudentDecision {
  SharedStudentDecision({
    required this.studentId,
    required this.studentName,
    required this.collected,
    required this.assigned,
    required this.remaining,
    required this.teachers,
  });
  factory SharedStudentDecision.fromApi(Map<String, dynamic> b) {
    num n(dynamic v) {
      final s = v == null ? '' : v.toString().replaceAll(RegExp(r'[^\d.\-]'), '');
      return double.tryParse(s) ?? 0;
    }
    return SharedStudentDecision(
      studentId: _s(b['studentId']),
      studentName: _s(b['studentName']),
      collected: n(b['collected']),
      assigned: n(b['assigned']),
      remaining: n(b['remaining']),
      teachers: ((b['teachers'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(SharedStudentTeacher.fromApi)
          .toList(),
    );
  }
  final String studentId;
  final String studentName;
  final num collected;
  final num assigned;
  final num remaining;
  final List<SharedStudentTeacher> teachers;
}

class SharedStudentTeacher {
  SharedStudentTeacher({
    required this.teacherId,
    required this.teacherName,
    required this.classesThisMonth,
    required this.assigned,
  });
  factory SharedStudentTeacher.fromApi(Map<String, dynamic> b) {
    num n(dynamic v) {
      final s = v == null ? '' : v.toString().replaceAll(RegExp(r'[^\d.\-]'), '');
      return double.tryParse(s) ?? 0;
    }
    return SharedStudentTeacher(
      teacherId: _s(b['teacherId']),
      teacherName: _s(b['teacherName']),
      classesThisMonth: (b['classesThisMonth'] as num?)?.toInt() ?? 0,
      assigned: n(b['assigned']),
    );
  }
  final String teacherId;
  final String teacherName;
  final int classesThisMonth;
  final num assigned;
}

/// Everything api_teacherPayoutPreview returns for a month.
class PayoutPreview {
  PayoutPreview({
    required this.rows,
    required this.awaitingDecision,
    required this.awaitingAmount,
    required this.unattributedReceipts,
    required this.unattributedAmount,
    this.earningBaseDefined = false,
    this.note = '',
    this.projected = true,
    this.closed = false,
    this.closedAt = '',
    this.closedBy = '',
  });
  factory PayoutPreview.fromApi(Map<String, dynamic> b) {
    num n(dynamic v) {
      final s = v == null ? '' : v.toString().replaceAll(RegExp(r'[^\d.\-]'), '');
      return double.tryParse(s) ?? 0;
    }
    return PayoutPreview(
      rows: ((b['results'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PayoutRow.fromApi)
          .toList(),
      awaitingDecision: ((b['awaitingDecision'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(SharedStudentDecision.fromApi)
          .toList(),
      awaitingAmount: n(b['awaitingDecisionAmount']),
      unattributedReceipts: (b['unattributedReceipts'] as num?)?.toInt() ?? 0,
      unattributedAmount: n(b['unattributedAmount']),
      earningBaseDefined: b['earningBaseDefined'] == true,
      note: _s(b['note']),
      projected: b['projected'] != false,
      closed: b['closed'] == true,
      closedAt: _s(b['closedAt']),
      closedBy: _s(b['closedBy']),
    );
  }
  final List<PayoutRow> rows;
  final List<SharedStudentDecision> awaitingDecision;
  final num awaitingAmount;
  final int unattributedReceipts;
  final num unattributedAmount;
  /// False until Sharvil rules what a payout percentage is a percentage of
  /// (brief §15.1). While false, every row above is a named refusal.
  final bool earningBaseDefined;
  final String note;
  /// Handover spec §10: PROJECTED (live, recomputed every read) until the
  /// period is closed, after which it is a frozen snapshot.
  final bool projected;
  final bool closed;
  final String closedAt;
  final String closedBy;
}

/// One payment actually made to a teacher (api_recordTeacherPayout /
/// api_teacherPayoutHistory).
class PayoutPayment {
  PayoutPayment({
    required this.payoutId,
    required this.teacherId,
    required this.teacherName,
    required this.month,
    required this.amount,
    required this.paidOn,
    required this.paymentMode,
    required this.reference,
  });
  factory PayoutPayment.fromApi(Map<String, dynamic> b) {
    num n(dynamic v) {
      final s = v == null ? '' : v.toString().replaceAll(RegExp(r'[^\d.\-]'), '');
      return double.tryParse(s) ?? 0;
    }
    return PayoutPayment(
      payoutId: _s(b['payoutId']),
      teacherId: _s(b['teacherId']),
      teacherName: _s(b['teacherName']),
      month: _s(b['month']),
      amount: n(b['amount']),
      paidOn: _s(b['paidOn']),
      paymentMode: _s(b['paymentMode']),
      reference: _s(b['reference']),
    );
  }
  final String payoutId;
  final String teacherId;
  final String teacherName;
  final String month;
  final num amount;
  final String paidOn;
  final String paymentMode;
  final String reference;
}

class PayoutRow {
  PayoutRow({
    required this.teacherId,
    required this.teacherName,
    required this.month,
    required this.entityId,
    required this.receiptCount,
    required this.totalCollection,
    required this.totalTeacherShare,
    required this.payable,
    required this.priced,
    required this.alreadyPaid,
    required this.balance,
    required this.status,
    required this.preCutover,
    required this.note,
    this.reasons = const [],
    this.qualifications = const [],
    this.outcomeFlags = const {},
  });
  factory PayoutRow.fromApi(Map<String, dynamic> b) {
    num n(dynamic v) {
      final s = v == null ? '' : v.toString().replaceAll(RegExp(r'[^\d.\-]'), '');
      return double.tryParse(s) ?? 0;
    }
    // A refused line carries payable: null. Never coerced to 0 — the server
    // says no amount exists, and the screen must say the same.
    final priced = b['payable'] != null;
    return PayoutRow(
      teacherId: _s(b['teacherId']),
      teacherName: _s(b['teacherName']),
      month: _s(b['month']),
      entityId: _s(b['entityId']),
      receiptCount: (b['receiptCount'] as num?)?.toInt() ?? 0,
      totalCollection: n(b['totalCollection']),
      totalTeacherShare: n(b['totalTeacherShare']),
      payable: priced ? n(b['payable']) : 0,
      priced: priced,
      alreadyPaid: n(b['alreadyPaid'] ?? b['paid']),
      balance: priced ? n(b['balance']) : 0,
      status: _s(b['status']),
      preCutover: b['preCutover'] == true,
      note: _s(b['note']),
      reasons: ((b['reasons'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map((r) => _s(r['message']))
          .where((m) => m.isNotEmpty)
          .toList(),
      qualifications: ((b['qualifications'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map((r) => _s(r['message']))
          .where((m) => m.isNotEmpty)
          .toList(),
      outcomeFlags: ((b['outcomeFlags'] as Map?) ?? const {}).map(
        (k, v) => MapEntry(_s(k), OutcomeFlag.fromApi((v as Map<String, dynamic>?) ?? const {})),
      ),
    );
  }
  final String teacherId;
  final String teacherName;
  final String month;
  final String entityId;
  final int receiptCount;
  final num totalCollection;
  final num totalTeacherShare;
  final num payable;
  /// False when the server refused to compute an amount (e.g. the earning
  /// base is undefined). The screen must show the refusal, never ₹0.
  final bool priced;
  final num alreadyPaid;
  final num balance;
  final String status;
  final bool preCutover;
  final String note;
  final List<String> reasons;
  final List<String> qualifications;
  /// Informational-only counts of TEACHER_ABSENT/SCHOOL_HOLIDAY/STUDENT_ABSENT
  /// classes this month, keyed by outcome, each with the founder-configured
  /// payout_status_rules percent (if any). Never blended into `payable` —
  /// the backend prices payouts as a % of collected fees, not per class, so
  /// there is no reliable per-class rupee base to multiply against. A real
  /// correction goes through a payout_adjustments row instead.
  final Map<String, OutcomeFlag> outcomeFlags;
}

/// One entry of [PayoutRow.outcomeFlags] — a class-outcome count this month
/// plus whatever % payout_status_rules has configured for it (null if the
/// founder hasn't set a rule for that outcome).
class OutcomeFlag {
  OutcomeFlag({required this.count, required this.configuredPercent});
  factory OutcomeFlag.fromApi(Map<String, dynamic> b) => OutcomeFlag(
        count: (b['count'] as num?)?.toInt() ?? 0,
        configuredPercent: b['configuredPercent'] == null ? null : _n(b['configuredPercent']),
      );
  final int count;
  final num? configuredPercent;
}

/// Month-end teacher payout statement (api_founder_generatePayoutStatement /
/// api_founder_approvePayoutStatement). Workflow: DRAFT -> CALCULATED ->
/// FOUNDER_APPROVED -> PAID. recordTeacherPayout requires FOUNDER_APPROVED
/// for service months from the expected-events floor onward (see
/// [PayoutRow.preCutover] — pre-cutover months are not gated).
class PayoutStatement {
  PayoutStatement({
    required this.statementId,
    required this.teacherId,
    required this.month,
    required this.status,
    this.calculatedAmount,
    this.approvedAmount,
    this.note = '',
  });

  /// Builds from either api_founder_generatePayoutStatement's success body,
  /// its ALREADY_DECIDED refusal payload (still names statementId/status),
  /// or api_founder_approvePayoutStatement's body. teacherId/month fall back
  /// to what the caller asked for, since not every response shape repeats
  /// them.
  factory PayoutStatement.fromApi(Map<String, dynamic> b, {required String teacherId, required String month}) {
    return PayoutStatement(
      statementId: _s(b['statementId']),
      teacherId: _s(b['teacherId']).ifEmpty(teacherId),
      month: _s(b['month']).ifEmpty(month),
      status: _s(b['status']),
      calculatedAmount: b['calculatedAmount'] == null ? null : _n(b['calculatedAmount']),
      approvedAmount: b['approvedAmount'] == null ? null : _n(b['approvedAmount']),
      note: _s(b['note']),
    );
  }

  final String statementId;
  final String teacherId;
  final String month;
  final String status;
  final num? calculatedAmount;
  final num? approvedAmount;
  final String note;

  bool get isCalculated => status == 'CALCULATED';
  bool get isApproved => status == 'FOUNDER_APPROVED' || status == 'PAID';
}

/// One recorded attendance mark for a student (api_studentProfile).
class AttendanceMark {
  AttendanceMark({
    required this.date,
    required this.status,
    required this.teacherName,
    required this.instrument,
  });
  factory AttendanceMark.fromApi(Map<String, dynamic> b) => AttendanceMark(
        date: _s(b['date']),
        status: _s(b['status']).toUpperCase(),
        teacherName: _s(b['teacherName']),
        instrument: _s(b['instrument']),
      );
  final String date;
  final String status;
  final String teacherName;
  final String instrument;

  bool get isPresent => status == 'PRESENT';
  bool get isLate => status == 'LATE';
  bool get isAbsent => status == 'ABSENT';
  bool get isExcused => status == 'EXCUSED';
}

/// Staff "My Requests" — persisted drafts awaiting (or resolved by) founder.
class ApprovalRequestRow {
  ApprovalRequestRow({
    required this.type,
    required this.id,
    required this.status,
    required this.student,
    required this.category,
    required this.amount,
    required this.when,
    required this.backdated,
    required this.decisionNote,
  });
  factory ApprovalRequestRow.fromApi(Map<String, dynamic> b) => ApprovalRequestRow(
        type: _s(b['type']),
        id: _s(b['id']),
        status: _s(b['status']),
        student: _s(b['student']),
        category: _s(b['category']),
        amount: _s(b['amount']),
        when: _s(b['when']),
        backdated: b['backdated'] == true,
        // Why the founder said no. Without this a rejected request is a dead end.
        decisionNote: _s(b['decisionNote']),
      );
  final String type;
  final String id;
  final String status;
  final String student;
  final String category;
  final String amount;
  final String when;
  final bool backdated;
  final String decisionNote;

  bool get waiting => status.toUpperCase() == 'SUBMITTED' ||
      status.toUpperCase() == 'PENDING_TERMS_AND_APPROVAL' ||
      status.toUpperCase() == 'BACKDATED_APPROVAL_REQUIRED';

  bool get approved => const ['APPROVED', 'MERGED', 'FINALISED', 'AUTHORISED'].contains(status.toUpperCase());
  bool get rejected => status.toUpperCase() == 'REJECTED' || status.toUpperCase() == 'REVOKED';

  /// Same wording the web My Requests screen uses, so a request reads the
  /// same whichever side you open it on.
  String get typeLabel => switch (type) {
        'PAYMENT_DRAFT' => 'Fee payment',
        'EXPENSE_DRAFT' => 'Expense',
        'STUDENT_DRAFT' => 'Student',
        'RECEIPT_CORRECTION' => 'Receipt correction',
        'SCHOOL_INVOICE_DRAFT' => 'School invoice',
        'TEACHER_ADD_REQUEST' => 'New teacher',
        'TEACHER_EDIT_REQUEST' => 'Teacher change',
        'PACKAGE_EXTENSION' => 'Package extension',
        'PAYMENT_PROFILE_CHANGE' => 'Payment profile',
        'CLOSURE' => 'Closure / holiday',
        'CLASS_CORRECTION' => 'Class correction',
        'LATE_FEE_WAIVER' => 'Late-fee waiver',
        'INSTALMENT_PLAN' => 'Instalment plan',
        'MANUAL_TERMS_ACCEPTANCE' => 'Terms acceptance',
        _ => type.replaceAll('_', ' '),
      };
}

class StaffHub {
  StaffHub({
    required this.profile,
    required this.pending,
    required this.feesTotal,
    required this.feeStatus,
    required this.dueDate,
    required this.canonicalFee,
    this.receipts = const [],
  });
  factory StaffHub.fromApi(Map<String, dynamic> b) {
    final p = b['profile'] is Map<String, dynamic>
        ? b['profile'] as Map<String, dynamic>
        : <String, dynamic>{};
    final pending =
        b['pending'] is Map<String, dynamic> ? b['pending'] as Map<String, dynamic> : const <String, dynamic>{};
    final fees = b['fees'] is Map<String, dynamic> ? b['fees'] as Map<String, dynamic> : const <String, dynamic>{};
    return StaffHub(
      profile: Student.fromApi({
        ...p,
        'studentId': _s(p['studentId']),
        'feeStatus': _s(p['feeStatus']),
      }),
      pending: ((pending['rows'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(PendingFinaliseDraft.fromApi)
          .toList(),
      feesTotal: _n(fees['total']).toString(),
      feeStatus: _s(p['feeStatus']),
      dueDate: _s(p['dueDate']),
      canonicalFee: _s(p['fee']),
      // Scoped server-side to this exact studentId (recentReceipts), same
      // guarantee as StudentProfileDetail.receipts.
      receipts: ((fees['rows'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ReceiptRow.fromApi)
          .toList(),
    );
  }
  final Student profile;
  final List<PendingFinaliseDraft> pending;
  final String feesTotal;
  final String feeStatus;
  final String dueDate;
  final String canonicalFee;
  final List<ReceiptRow> receipts;
}

/// Authoritative teacher profile (+ assigned students) from the profile
/// endpoint contract. Display-only financial fields come from the server.
class TeacherProfile {
  TeacherProfile({
    required this.teacher,
    required this.students,
    required this.receiptCountThisMonth,
  });
  factory TeacherProfile.fromApi(Map<String, dynamic> b) {
    final t = b['teacher'] is Map<String, dynamic>
        ? b['teacher'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return TeacherProfile(
      teacher: Teacher.fromApi({
        ...t,
        'teacherId': _s(t['teacherId']),
        'teacherName': _s(t['teacherName'] ?? t['name']),
        'primaryRole': _s(t['primaryRole'] ?? t['instrument'] ?? t['role']),
        'status': _s(t['status']),
        'academyShare': _s(t['compensationPercent'] ?? t['feeSharePercent'] ?? t['academyShare']),
        'payoutStreams': _s(t['payoutStreams']),
        'payoutModel': _s(t['payoutModel']),
      }),
      students: ((b['students'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(Student.fromApi)
          .toList(),
      receiptCountThisMonth: (b['receiptCountThisMonth'] as num?)?.toInt() ?? 0,
    );
  }
  final Teacher teacher;
  final List<Student> students;
  final int receiptCountThisMonth;

  /// Server-provided compensation percentage, if any ('' = unset).
  String get sharePercent => _share(teacher.academyShare);

  static String _share(String v) => v.isEmpty ? '' : (v.endsWith('%') ? v : '$v%');

  bool get hasStudents => students.isNotEmpty;
}

/// Rich, role-appropriate student profile detail.
/// Handover spec §8.4 "Goodwill recovery window": AVAILABLE -> SCHEDULED ->
/// DELIVERED / NO_SHOW, or AVAILABLE -> LAPSED if the use-by date passes.
class RecoveryCredit {
  const RecoveryCredit({
    required this.creditId,
    required this.studentId,
    required this.studentName,
    required this.reason,
    required this.status,
    required this.useByDate,
    this.scheduledDate = '',
    this.teacherName = '',
  });
  factory RecoveryCredit.fromApi(Map<String, dynamic> b) => RecoveryCredit(
        creditId: _s(b['creditId']),
        studentId: _s(b['studentId']),
        studentName: _s(b['studentName']),
        reason: _s(b['reason']),
        status: _s(b['status']),
        useByDate: _s(b['useByDate']),
        scheduledDate: _s(b['scheduledDate']),
        teacherName: _s(b['teacherName']),
      );
  final String creditId;
  final String studentId;
  final String studentName;
  final String reason;
  final String status;
  final String useByDate;
  final String scheduledDate;
  final String teacherName;
}

class DuplicateStudentRef {
  const DuplicateStudentRef({required this.studentId, required this.name});
  factory DuplicateStudentRef.fromApi(Map<String, dynamic> b) =>
      DuplicateStudentRef(studentId: _s(b['studentId']), name: _s(b['name']));
  final String studentId;
  final String name;
}

class StudentProfileDetail {
  StudentProfileDetail({
    required this.student,
    required this.teacher,
    required this.teacherId,
    required this.branch,
    this.receipts = const [],
    this.attendance = const [],
    this.duplicateOf,
    this.possibleDuplicates = const [],
  });
  factory StudentProfileDetail.fromApi(Map<String, dynamic> b) {
    final s = b['student'] is Map<String, dynamic>
        ? b['student'] as Map<String, dynamic>
        : const <String, dynamic>{};
    final t = b['teacher'] is Map<String, dynamic>
        ? b['teacher'] as Map<String, dynamic>
        : const <String, dynamic>{};
    return StudentProfileDetail(
      student: Student.fromApi({
        ...s,
        'teacher': _s(s['teacherName'] ?? t['teacherName'] ?? s['teacher']),
      }),
      teacher: t['teacherName'] != null || t['teacherId'] != null
          ? t
          : null,
      teacherId: _s(s['teacherId'] ?? t['teacherId']),
      branch: _s(s['branch'] ?? s['location']),
      // Scoped server-side to this exact studentId — never a fuzzy name
      // search, so no other student's receipts can leak in here.
      receipts: ((b['receipts'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ReceiptRow.fromApi)
          .toList(),
      // Last 30 sessions, also scoped server-side to this studentId.
      attendance: ((b['attendance'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(AttendanceMark.fromApi)
          .toList(),
      duplicateOf: b['duplicateOf'] is Map<String, dynamic>
          ? DuplicateStudentRef.fromApi(b['duplicateOf'] as Map<String, dynamic>)
          : null,
      possibleDuplicates: ((b['possibleDuplicates'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(DuplicateStudentRef.fromApi)
          .toList(),
    );
  }
  final Student student;

  /// Raw teacher map when the backend returned one (kept untyped-avoidable).
  final Map<String, dynamic>? teacher;
  final String teacherId;
  final String branch;
  final List<ReceiptRow> receipts;
  final List<AttendanceMark> attendance;
  final DuplicateStudentRef? duplicateOf;
  final List<DuplicateStudentRef> possibleDuplicates;

  bool get hasTeacherId => teacherId.isNotEmpty && teacherId != '0' && teacherId != 'null';
  bool get hasTeacherName => student.teacher.isNotEmpty;
  bool get hasAssignedTeacher => hasTeacherId || hasTeacherName;

  /// True when the profile carries no teacher link at all.
  bool get noTeacherAssigned => !hasAssignedTeacher;

  String get teacherName => student.teacher;
}

/// Founder's compensation edit contract validation — percentages bounded 0..100.
class TeacherCompensationValidator {
  TeacherCompensationValidator._();

  static ({bool ok, String? error, num? value}) validate(String raw) {
    final v = num.tryParse(raw.trim());
    if (v == null) return (ok: false, error: 'Enter a whole number between 0 and 100.', value: null);
    if (v < 0 || v > 100) return (ok: false, error: 'Percentage must be between 0 and 100.', value: v);
    return (ok: true, error: null, value: v);
  }
}

/// UI access policy — compensation editing is founder-only. This is a
/// convenience layer: the BACKEND remains the authoritative gate.
class ProfilePolicy {
  ProfilePolicy._();

  static bool canEditCompensation({required bool staff}) => !staff;
}

/// Authorised signatory (owner) of a school invoice.
class InvoiceOwner {
  InvoiceOwner({required this.name, required this.id, required this.signatureUrl, this.title = ''});
  factory InvoiceOwner.fromApi(Map<String, dynamic> b) => InvoiceOwner(
        name: _s(b['name'] ?? b['ownerName']),
        id: _s(b['id'] ?? b['ownerId']),
        signatureUrl: _s(b['signatureUrl'] ?? b['signature']),
        title: _s(b['title']),
      );
  final String name;
  final String id;
  final String signatureUrl;
  final String title;
}

/// One optional "Other charges" line on a school invoice, on top of the
/// fixed `amount` — e.g. "Diwali decoration" / 500. Matches the backend's
/// ExtraCharge shape exactly (src/lib/api/rpc-types.ts, src/lib/rpc/extraCharges.ts):
/// a row must carry BOTH a non-empty description and an amount > 0, or it's
/// not sent — the backend rejects a half-filled row (EXTRA_CHARGE_INCOMPLETE).
class ExtraCharge {
  const ExtraCharge({required this.description, required this.amount});
  factory ExtraCharge.fromApi(Map<String, dynamic> b) => ExtraCharge(
        description: _s(b['description']),
        amount: _n(b['amount']),
      );
  final String description;
  final num amount;

  Map<String, dynamic> toApi() => {'description': description, 'amount': amount};
}

/// One payee on a school invoice's payment split, already resolved to a
/// rupee amount for this specific invoice (handover template redesign).
class InvoiceBeneficiaryAmount {
  const InvoiceBeneficiaryAmount({
    required this.name,
    required this.amount,
    this.bankName = '',
    this.accountNo = '',
    this.ifsc = '',
    this.upi = '',
  });
  factory InvoiceBeneficiaryAmount.fromApi(Map<String, dynamic> b) => InvoiceBeneficiaryAmount(
        name: _s(b['name']),
        amount: _n(b['amount']),
        bankName: _s(b['bankName']),
        accountNo: _s(b['accountNo']),
        ifsc: _s(b['ifsc']),
        upi: _s(b['upi']),
      );
  final String name;
  final num amount;
  final String bankName;
  final String accountNo;
  final String ifsc;
  final String upi;
}

/// Authoritative SCHOOL-LEVEL invoice snapshot. No student dependency: the
/// document bills a CLASS, not a student, at the school level.
class SchoolInvoice {
  SchoolInvoice({
    required this.invoiceId,
    required this.invoiceNo,
    required this.invoiceDate,
    required this.branch,
    required this.className,
    required this.amount,
    required this.tenure,
    required this.owner1,
    required this.owner2,
    this.billingPeriodFrom = '',
    this.billingPeriodTo = '',
    this.schoolCode = '',
    this.schoolName = '',
    this.schoolAddress = '',
    this.schoolContact = '',
    this.attn = 'The Principal',
    this.billingBasis = 'Fixed Monthly',
    this.serviceDescription = '',
    this.charges = const [],
    num? total,
    this.beneficiaries = const [],
    this.pdfUrl = '',
    this.demo = false,
    this.status = '',
    this.voidReason = '',
    this.voidedBy = '',
    this.voidedAt = '',
  }) : total = total ?? (amount + charges.fold<num>(0, (sum, c) => sum + c.amount));
  factory SchoolInvoice.fromApi(Map<String, dynamic> b) {
    final o1 = b['owner1'] is Map<String, dynamic>
        ? InvoiceOwner.fromApi(b['owner1'] as Map<String, dynamic>)
        : InvoiceOwner(name: _s(b['owner1Name']), id: '', signatureUrl: _s(b['owner1SignatureUrl']));
    final o2 = b['owner2'] is Map<String, dynamic>
        ? InvoiceOwner.fromApi(b['owner2'] as Map<String, dynamic>)
        : InvoiceOwner(name: _s(b['owner2Name']), id: '', signatureUrl: _s(b['owner2SignatureUrl']));
    return SchoolInvoice(
      invoiceId: _s(b['invoiceId']),
      invoiceNo: _s(b['invoiceNo']),
      invoiceDate: _s(b['invoiceDate']),
      billingPeriodFrom: _s(b['billingPeriodFrom']),
      billingPeriodTo: _s(b['billingPeriodTo']),
      branch: _s(b['branch'] ?? b['classCode']),
      className: _s(b['className']),
      amount: _n(b['amount']),
      tenure: _s(b['tenure']),
      schoolCode: _s(b['schoolCode']),
      schoolName: _s(b['schoolName']),
      schoolAddress: _s(b['schoolAddress']),
      schoolContact: _s(b['schoolContact']),
      attn: _s(b['attn']).isEmpty ? 'The Principal' : _s(b['attn']),
      billingBasis: _s(b['billingBasis']).isEmpty ? 'Fixed Monthly' : _s(b['billingBasis']),
      serviceDescription: _s(b['serviceDescription']),
      charges: ((b['charges'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(ExtraCharge.fromApi)
          .toList(),
      total: b['total'] is num ? b['total'] as num : null,
      beneficiaries: ((b['beneficiaries'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .map(InvoiceBeneficiaryAmount.fromApi)
          .toList(),
      pdfUrl: _s(b['pdfUrl']),
      demo: b['demo'] == true,
      owner1: o1,
      owner2: o2,
      status: _s(b['status']),
      voidReason: _s(b['voidReason']),
      voidedBy: _s(b['voidedBy']),
      voidedAt: _s(b['voidedAt']),
    );
  }
  final String invoiceId;
  final String invoiceNo;
  final String invoiceDate;
  final String billingPeriodFrom;
  final String billingPeriodTo;
  final String branch;
  final String className;
  final num amount;
  final String tenure;
  /// The school being billed. The code is already inside invoiceNo; these are
  /// what the school reads on the invoice itself.
  final String schoolCode;
  final String schoolName;
  final String schoolAddress;
  final String schoolContact;
  final String attn;
  final String billingBasis;
  final String serviceDescription;
  /// Optional "Other charges" on top of `amount` (the fixed amount).
  final List<ExtraCharge> charges;
  /// amount + sum(charges) — computed client-side when the backend omits it
  /// (e.g. a legacy snapshot with no charges column).
  final num total;
  final List<InvoiceBeneficiaryAmount> beneficiaries;
  final String pdfUrl;
  final bool demo;
  final InvoiceOwner owner1;
  final InvoiceOwner owner2;
  /// "" or "FINAL" (default) prints normally. "VOID" — never deleted or
  /// edited in place, only voided; the invoice number is never reused.
  final String status;
  final String voidReason;
  final String voidedBy;
  final String voidedAt;
}

/// One payee on a school's invoice split — a percentage of each month's total.
class SchoolBeneficiary {
  const SchoolBeneficiary({
    required this.beneficiaryName,
    required this.sharePercent,
    this.bankName = '',
    this.accountNo = '',
    this.ifsc = '',
    this.upi = '',
  });
  factory SchoolBeneficiary.fromApi(Map<String, dynamic> b) => SchoolBeneficiary(
        beneficiaryName: _s(b['beneficiaryName']),
        sharePercent: _n(b['sharePercent']),
        bankName: _s(b['bankName']),
        accountNo: _s(b['accountNo']),
        ifsc: _s(b['ifsc']),
        upi: _s(b['upi']),
      );
  final String beneficiaryName;
  final num sharePercent;
  final String bankName;
  final String accountNo;
  final String ifsc;
  final String upi;
}

/// A school a class can be billed to. Code is what goes in the invoice number.
class School {
  const School({
    required this.schoolId,
    required this.code,
    required this.name,
    this.address = '',
    this.contact = '',
    this.attn = 'The Principal',
    this.billingBasis = 'Fixed Monthly',
    this.serviceDescription = '',
    this.active = true,
    this.beneficiaries = const [],
  });
  factory School.fromApi(Map<String, dynamic> b) => School(
        schoolId: _s(b['schoolId'] ?? b['id']),
        code: _s(b['code']).toUpperCase(),
        name: _s(b['name']),
        address: _s(b['address']),
        contact: _s(b['contact']),
        attn: _s(b['attn']).isEmpty ? 'The Principal' : _s(b['attn']),
        billingBasis: _s(b['billingBasis']).isEmpty ? 'Fixed Monthly' : _s(b['billingBasis']),
        serviceDescription: _s(b['serviceDescription']),
        active: b['active'] != false,
        beneficiaries: ((b['beneficiaries'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(SchoolBeneficiary.fromApi)
            .toList(),
      );
  final String schoolId;
  final String code;
  final String name;
  final String address;
  final String contact;
  final String attn;
  final String billingBasis;
  final String serviceDescription;
  final bool active;
  final List<SchoolBeneficiary> beneficiaries;

  String get label => name.isNotEmpty && name != code ? '$name ($code)' : code;
}

/// Invoice list row (school-level history, no student).
class InvoiceSummary {
  InvoiceSummary({
    required this.invoiceNo,
    required this.invoiceDate,
    required this.tenure,
    required this.amount,
    required this.invoiceId,
    required this.className,
    this.schoolName = '',
    this.schoolCode = '',
    this.charges = const [],
    num? total,
  }) : total = total ?? (amount + charges.fold<num>(0, (sum, c) => sum + c.amount));
  factory InvoiceSummary.fromApi(Map<String, dynamic> b) => InvoiceSummary(
        invoiceNo: _s(b['invoiceNo']),
        invoiceDate: _s(b['invoiceDate']),
        tenure: _s(b['tenure']),
        amount: _n(b['amount']),
        invoiceId: _s(b['invoiceId']),
        className: _s(b['className']),
        schoolName: _s(b['schoolName']),
        schoolCode: _s(b['schoolCode']),
        charges: ((b['charges'] as List?) ?? const [])
            .whereType<Map<String, dynamic>>()
            .map(ExtraCharge.fromApi)
            .toList(),
        total: b['total'] is num ? b['total'] as num : null,
      );
  final String invoiceNo;
  final String invoiceDate;
  final String tenure;
  final num amount;
  final String invoiceId;
  final String className;
  /// Who the invoice was billed to. The code is already inside invoiceNo.
  final String schoolName;
  final String schoolCode;
  /// Optional "Other charges" on top of `amount`.
  final List<ExtraCharge> charges;
  /// amount + sum(charges).
  final num total;
}

/// Invoice input validation — amount numeric > 0, tenure required.
class InvoiceValidator {
  InvoiceValidator._();

  static ({bool ok, String? error, num? amount}) amount(String raw) {
    final v = num.tryParse(raw.trim().replaceAll(',', ''));
    if (v == null) return (ok: false, error: 'Enter a valid amount (INR).', amount: null);
    if (v <= 0) return (ok: false, error: 'Amount must be greater than zero.', amount: v);
    return (ok: true, error: null, amount: v);
  }

  static String? tenure(String raw) => raw.trim().isEmpty ? 'Pick a tenure.' : null;

  /// Same rule as the backend's parseExtraCharges (src/lib/rpc/extraCharges.ts):
  /// a charge row needs BOTH a description and an amount > 0, or neither — a
  /// fully-blank row (an unused "Add charge" slot) is fine, a half-filled one
  /// is not. Returns true if every row is fully filled or fully blank.
  static bool chargesValid(List<(String, String)> rows) {
    for (final (description, amountRaw) in rows) {
      final hasDescription = description.trim().isNotEmpty;
      final amount = num.tryParse(amountRaw.trim().replaceAll(',', '')) ?? 0;
      final hasAmount = amountRaw.trim().isNotEmpty && amount > 0;
      if (hasDescription != hasAmount) return false;
    }
    return true;
  }

  /// Only rows with BOTH a description and a positive amount count — a blank
  /// "Add charge" row that was never filled in is dropped, never sent.
  static List<ExtraCharge> cleanCharges(List<(String, String)> rows) {
    final out = <ExtraCharge>[];
    for (final (description, amountRaw) in rows) {
      final d = description.trim();
      final amount = num.tryParse(amountRaw.trim().replaceAll(',', '')) ?? 0;
      if (d.isNotEmpty && amount > 0) out.add(ExtraCharge(description: d, amount: amount));
    }
    return out;
  }
}

/// Day-of-week for the timetable (0 = Monday … 6 = Sunday, ISO).
const timetableDayNames = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/// One scheduled class on the branch timetable.
class TimetableEntry {
  const TimetableEntry({
    required this.id,
    required this.branch,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    required this.className,
    this.teacherId = '',
    this.teacherName = '',
    this.status = 'ENABLED',
    this.substituteTeacherId = '',
    this.substituteTeacherName = '',
    this.instrument = '',
  });
  factory TimetableEntry.fromApi(Map<String, dynamic> b) => TimetableEntry(
        id: _s(b['id']),
        branch: _s(b['branch']),
        dayOfWeek: (b['dayOfWeek'] as num?)?.toInt() ?? 0,
        startTime: _s(b['startTime']),
        endTime: _s(b['endTime']),
        className: _s(b['className'] ?? b['instrument']),
        teacherId: _s(b['teacherId']),
        teacherName: _s(b['teacherName'] ?? b['teacher']),
        status: _s(b['status']).toUpperCase().isEmpty ? 'ENABLED' : _s(b['status']).toUpperCase(),
        substituteTeacherId: _s(b['substituteTeacherId']),
        substituteTeacherName: _s(b['substituteTeacherName']),
        instrument: _s(b['instrument']),
      );
  Map<String, dynamic> toWrite() => {
        'id': id,
        'branch': branch,
        'dayOfWeek': dayOfWeek,
        'startTime': startTime,
        'endTime': endTime,
        'className': className,
        'teacherId': teacherId,
        'teacherName': teacherName,
        'status': status,
        'substituteTeacherId': substituteTeacherId,
        'substituteTeacherName': substituteTeacherName,
        'instrument': instrument,
      };
  final String id;
  final String branch;
  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final String className;
  final String teacherId;
  final String teacherName;
  final String status;
  /// Real instrument tag on this slot (2026-10-05), sourced from the shared
  /// instrument_options picklist — separate from the free-text [className].
  final String instrument;
  /// Who covers this slot instead. The server validates it differs from the
  /// assigned teacher; the app only collects it.
  final String substituteTeacherId;
  final String substituteTeacherName;

  String get dayLabel => dayOfWeek >= 0 && dayOfWeek < timetableDayNames.length ? timetableDayNames[dayOfWeek] : '?';
  bool get enabled => status == 'ENABLED';

  /// Human time "5:00 PM" from a "17:00" (HH:mm) value.
  String get timeLabelStart => time12(startTime);
  String get timeLabelEnd => time12(endTime);

  static String time12(String t) {
    final p = t.split(':');
    if (p.length < 2) return t;
    final h = int.tryParse(p[0]) ?? 0;
    final m = p[1];
    final suffix = h >= 12 ? 'PM' : 'AM';
    final hh = h % 12 == 0 ? 12 : h % 12;
    return '$hh:$m $suffix';
  }
}

/// One calendar-week instance of a recurring `TimetableEntry`, resolved to a
/// real date by `api_timetableWeek`. `overridden` means this week's fields
/// were changed via a "this week only" edit — the base slot is unchanged.
class TimetableWeekEntry extends TimetableEntry {
  const TimetableWeekEntry({
    required super.id,
    required super.branch,
    required super.dayOfWeek,
    required super.startTime,
    required super.endTime,
    required super.className,
    super.teacherId,
    super.teacherName,
    super.status,
    super.substituteTeacherId,
    super.substituteTeacherName,
    super.instrument,
    required this.weekStart,
    required this.date,
    this.overridden = false,
  });
  factory TimetableWeekEntry.fromApi(Map<String, dynamic> b) => TimetableWeekEntry(
        id: _s(b['id']),
        branch: _s(b['branch']),
        dayOfWeek: (b['dayOfWeek'] as num?)?.toInt() ?? 0,
        startTime: _s(b['startTime']),
        endTime: _s(b['endTime']),
        className: _s(b['className']),
        teacherId: _s(b['teacherId']),
        teacherName: _s(b['teacherName']),
        status: _s(b['status']).toUpperCase().isEmpty ? 'ENABLED' : _s(b['status']).toUpperCase(),
        substituteTeacherId: _s(b['substituteTeacherId']),
        substituteTeacherName: _s(b['substituteTeacherName']),
        instrument: _s(b['instrument']),
        weekStart: _s(b['weekStart']),
        date: _s(b['date']),
        overridden: b['overridden'] == true,
      );
  final String weekStart;
  final String date;
  final bool overridden;
}

class TimetableSessionStudent {
  const TimetableSessionStudent({required this.studentId, required this.name, required this.status, this.absenceReason = ''});
  factory TimetableSessionStudent.fromApi(Map<String, dynamic> b) => TimetableSessionStudent(
        studentId: _s(b['studentId']),
        name: _s(b['name']),
        status: _s(b['status']),
        absenceReason: _s(b['absenceReason']),
      );
  final String studentId;
  final String name;
  final String status;
  final String absenceReason;
}

class TimetableSessionDetail {
  const TimetableSessionDetail({
    required this.teacherName,
    required this.recorded,
    required this.outcome,
    required this.deliveredBy,
    required this.reason,
    required this.students,
  });
  factory TimetableSessionDetail.fromApi(Map<String, dynamic> b) {
    final ta = (b['teacherAttendance'] as Map?)?.cast<String, dynamic>() ?? const {};
    return TimetableSessionDetail(
      teacherName: _s((b['slot'] as Map?)?['teacherName']),
      recorded: ta['recorded'] == true,
      outcome: _s(ta['outcome']),
      deliveredBy: _s(ta['deliveredBy']),
      reason: _s(ta['reason']),
      students: ((b['students'] as List?) ?? const [])
          .map((e) => TimetableSessionStudent.fromApi((e as Map).cast<String, dynamic>()))
          .toList(),
    );
  }
  final String teacherName;
  final bool recorded;
  final String outcome;
  final String deliveredBy;
  final String reason;
  final List<TimetableSessionStudent> students;
}

/// Timetable edit validation — time ordering + required fields.
class TimetableValidator {
  TimetableValidator._();

  static String? time(String raw) {
    if (!RegExp(r'^\d{2}:\d{2}$').hasMatch(raw.trim())) return 'Time must be HH:mm.';
    final p = raw.split(':');
    final h = int.parse(p[0]);
    final m = int.parse(p[1]);
    if (h < 0 || h > 23 || m < 0 || m > 59) return 'Time out of range.';
    return null;
  }

  static ({bool ok, String? error}) range(String start, String end) {
    if (time(start) != null) return (ok: false, error: 'Start: ${time(start)}');
    if (time(end) != null) return (ok: false, error: 'End: ${time(end)}');
    if (start.compareTo(end) >= 0) return (ok: false, error: 'End time must be after start time.');
    return (ok: true, error: null);
  }

  static String? className(String raw) => raw.trim().isEmpty ? 'Class / instrument is required.' : null;
}

/// Timetable edit access policy (UI convenience; backend stays authoritative).
class TimetablePolicy {
  TimetablePolicy._();

  static bool canEdit({required bool staff}) => true;
}

/// Founder-maintained quotable price list per instrument (2026-10-05) —
/// entirely separate from what any individual student actually pays. Rows
/// are edited/deactivated directly (never effective-dated/append-only like
/// the payout settings tables).
class FeeRateCardRow {
  const FeeRateCardRow({
    required this.id,
    required this.instrument,
    required this.name,
    required this.feeAmount,
    this.billingPeriod = 'Monthly',
    this.notes = '',
    this.active = true,
    this.createdBy = '',
    this.createdAt = '',
    this.updatedBy = '',
    this.updatedAt = '',
  });
  factory FeeRateCardRow.fromApi(Map<String, dynamic> b) => FeeRateCardRow(
        id: _s(b['id']),
        instrument: _s(b['instrument']),
        name: _s(b['name']),
        feeAmount: _n(b['feeAmount']),
        billingPeriod: _s(b['billingPeriod']).ifEmpty('Monthly'),
        notes: _s(b['notes']),
        active: b['active'] != false,
        createdBy: _s(b['createdBy']),
        createdAt: _s(b['createdAt']),
        updatedBy: _s(b['updatedBy']),
        updatedAt: _s(b['updatedAt']),
      );
  final String id;
  final String instrument;
  final String name;
  final num feeAmount;
  final String billingPeriod;
  final String notes;
  final bool active;
  final String createdBy;
  final String createdAt;
  final String updatedBy;
  final String updatedAt;
}

/// Academy fee-plan catalog: 4 plans (display + add/edit picker).
const academyPlans = <({String key, String sessions, String amount, int months})>[
  (key: 'Plan 1', sessions: '1 session/week · 4/month', amount: '2,500', months: 0),
  (key: 'Plan 2', sessions: '2 sessions/week · 8/month', amount: '3,600', months: 0),
  (key: 'Plan 3', sessions: '1 session/week · 4/month for 3 months', amount: '6,500', months: 3),
  (key: 'Plan 4', sessions: '2 sessions/week · 8/month for 3 months', amount: '9,500', months: 3),
];

/// One-line plan description for the profile. Falls back to raw plan text.
String planSummary(String plan) {
  for (final p in academyPlans) {
    if (plan.toUpperCase().contains(p.key.toUpperCase())) {
      return '${p.key} · ${p.sessions} · ₹${p.amount}${p.months > 0 ? ' / ${p.months} mo' : ' / mo'}';
    }
  }
  return plan.trim().isEmpty ? '—' : plan;
}

/// Result of `api_syncChanges`: current server revisions + change markers.
/// The client compares against its known set and reloads ONLY changed
/// entities. Sync is a READ/INVALIDATION operation — it never writes.
class SyncSnapshot {
  SyncSnapshot({required this.revisions, required this.changes, required this.ok});
  factory SyncSnapshot.fromApi(Map<String, dynamic> b) {
    final revs = <String, int>{};
    final raw = b['revisions'];
    if (raw is Map) {
      raw.forEach((k, v) {
        final n = (v as num?)?.toInt();
        if (n != null) revs['$k'] = n;
      });
    }
    return SyncSnapshot(
      ok: b['ok'] == true,
      revisions: revs,
      changes: ((b['changes'] as List?) ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList(),
    );
  }
  final bool ok;
  final Map<String, int> revisions;
  final List<Map<String, dynamic>> changes;
}

// ---------------------------------------------------------------------------
// Dashboard overview — the sections both the staff "Today" screen and the
// founder "Home" screen render. Both api_staff_todaysTasks and api_dashboard
// return these same top-level keys, so one parser serves both.
// ---------------------------------------------------------------------------

class FeesDueTodayRow {
  FeesDueTodayRow({required this.studentId, required this.studentName, required this.classCode, required this.phone});
  factory FeesDueTodayRow.fromApi(Map<String, dynamic> b) => FeesDueTodayRow(
        studentId: _s(b['studentId']),
        studentName: _s(b['studentName']),
        classCode: _s(b['classCode']),
        phone: _s(b['phone']),
      );
  final String studentId;
  final String studentName;
  final String classCode;
  final String phone;
}

class FeesDueTodaySummary {
  FeesDueTodaySummary({required this.count, required this.overdueCount, required this.dueSoonCount, required this.rows});
  factory FeesDueTodaySummary.fromApi(Map<String, dynamic>? b) {
    if (b == null) return FeesDueTodaySummary(count: 0, overdueCount: 0, dueSoonCount: 0, rows: const []);
    return FeesDueTodaySummary(
      count: (b['count'] as num?)?.toInt() ?? 0,
      overdueCount: (b['overdueCount'] as num?)?.toInt() ?? 0,
      dueSoonCount: (b['dueSoonCount'] as num?)?.toInt() ?? 0,
      rows: ((b['rows'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(FeesDueTodayRow.fromApi).toList(),
    );
  }
  final int count;
  final int overdueCount;
  final int dueSoonCount;
  final List<FeesDueTodayRow> rows;
}

class TodaysLecturesSummary {
  TodaysLecturesSummary({required this.count, required this.unanswered, required this.rows});
  factory TodaysLecturesSummary.fromApi(Map<String, dynamic>? b) {
    if (b == null) return TodaysLecturesSummary(count: 0, unanswered: 0, rows: const []);
    return TodaysLecturesSummary(
      count: (b['count'] as num?)?.toInt() ?? 0,
      unanswered: (b['unanswered'] as num?)?.toInt() ?? 0,
      rows: ((b['rows'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(TodaysClass.fromApi).toList(),
    );
  }
  final int count;
  final int unanswered;
  final List<TodaysClass> rows;
}

class AttendanceTodaySummary {
  AttendanceTodaySummary({
    required this.date,
    required this.totalActive,
    required this.marked,
    required this.notMarked,
    required this.present,
    required this.absent,
    required this.excused,
    required this.late,
  });
  factory AttendanceTodaySummary.fromApi(Map<String, dynamic>? b) {
    if (b == null) {
      return AttendanceTodaySummary(date: '', totalActive: 0, marked: 0, notMarked: 0, present: 0, absent: 0, excused: 0, late: 0);
    }
    return AttendanceTodaySummary(
      date: _s(b['date']),
      totalActive: (b['totalActive'] as num?)?.toInt() ?? 0,
      marked: (b['marked'] as num?)?.toInt() ?? 0,
      notMarked: (b['notMarked'] as num?)?.toInt() ?? 0,
      present: (b['present'] as num?)?.toInt() ?? 0,
      absent: (b['absent'] as num?)?.toInt() ?? 0,
      excused: (b['excused'] as num?)?.toInt() ?? 0,
      late: (b['late'] as num?)?.toInt() ?? 0,
    );
  }
  final String date;
  final int totalActive;
  final int marked;
  final int notMarked;
  final int present;
  final int absent;
  final int excused;
  final int late;
}

class EnquiryContact {
  EnquiryContact({required this.inquiryId, required this.name, required this.phone});
  factory EnquiryContact.fromApi(Map<String, dynamic> b) =>
      EnquiryContact(inquiryId: _s(b['inquiryId']), name: _s(b['name']), phone: _s(b['phone']));
  final String inquiryId;
  final String name;
  final String phone;
}

class EnquiriesSummary {
  EnquiriesSummary({required this.openCount, required this.callTodayCount, required this.rows});
  factory EnquiriesSummary.fromApi(Map<String, dynamic>? b) {
    if (b == null) return EnquiriesSummary(openCount: 0, callTodayCount: 0, rows: const []);
    return EnquiriesSummary(
      openCount: (b['openCount'] as num?)?.toInt() ?? 0,
      callTodayCount: (b['callTodayCount'] as num?)?.toInt() ?? 0,
      rows: ((b['rows'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(EnquiryContact.fromApi).toList(),
    );
  }
  final int openCount;
  final int callTodayCount;
  final List<EnquiryContact> rows;
}

class TeacherAttendanceRow {
  TeacherAttendanceRow({
    required this.teacherId,
    required this.teacherName,
    required this.scheduled,
    required this.held,
    required this.cancelled,
    required this.substituted,
    required this.unanswered,
  });
  factory TeacherAttendanceRow.fromApi(Map<String, dynamic> b) => TeacherAttendanceRow(
        teacherId: _s(b['teacherId']),
        teacherName: _s(b['teacherName']),
        scheduled: (b['scheduled'] as num?)?.toInt() ?? 0,
        held: (b['held'] as num?)?.toInt() ?? 0,
        cancelled: (b['cancelled'] as num?)?.toInt() ?? 0,
        substituted: (b['substituted'] as num?)?.toInt() ?? 0,
        unanswered: (b['unanswered'] as num?)?.toInt() ?? 0,
      );
  final String teacherId;
  final String teacherName;
  final int scheduled;
  final int held;
  final int cancelled;
  final int substituted;
  final int unanswered;

  /// Every scheduled class today has an outcome recorded.
  bool get fullyAnswered => unanswered == 0;
}

class TeacherAttendanceSummary {
  TeacherAttendanceSummary({required this.scheduledToday, required this.unansweredToday, required this.teachers});
  factory TeacherAttendanceSummary.fromApi(Map<String, dynamic>? b) {
    if (b == null) return TeacherAttendanceSummary(scheduledToday: 0, unansweredToday: 0, teachers: const []);
    return TeacherAttendanceSummary(
      scheduledToday: (b['scheduledToday'] as num?)?.toInt() ?? 0,
      unansweredToday: (b['unansweredToday'] as num?)?.toInt() ?? 0,
      teachers: ((b['teachers'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(TeacherAttendanceRow.fromApi).toList(),
    );
  }
  final int scheduledToday;
  final int unansweredToday;
  final List<TeacherAttendanceRow> teachers;
}

/// The shared sections. Parsed from the same top-level object as
/// api_staff_todaysTasks or api_dashboard — both carry these keys.
class DashboardOverview {
  DashboardOverview({
    required this.feesDueToday,
    required this.todaysLectures,
    required this.attendance,
    required this.enquiries,
    required this.teacherAttendance,
  });
  factory DashboardOverview.fromApi(Map<String, dynamic> b) => DashboardOverview(
        feesDueToday: FeesDueTodaySummary.fromApi(b['feesDueToday'] as Map<String, dynamic>?),
        todaysLectures: TodaysLecturesSummary.fromApi(b['todaysLectures'] as Map<String, dynamic>?),
        attendance: AttendanceTodaySummary.fromApi(b['attendanceSummary'] as Map<String, dynamic>?),
        enquiries: EnquiriesSummary.fromApi(b['enquiries'] as Map<String, dynamic>?),
        teacherAttendance: TeacherAttendanceSummary.fromApi(b['teacherAttendance'] as Map<String, dynamic>?),
      );
  final FeesDueTodaySummary feesDueToday;
  final TodaysLecturesSummary todaysLectures;
  final AttendanceTodaySummary attendance;
  final EnquiriesSummary enquiries;
  final TeacherAttendanceSummary teacherAttendance;
}

/// api_staff_todaysTasks now returns the task cards AND the shared overview
/// sections in one round trip.
class StaffToday {
  StaffToday({required this.cards, required this.overview});
  factory StaffToday.fromApi(Map<String, dynamic> b) => StaffToday(
        cards: ((b['cards'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(TaskCard.fromApi).toList(),
        overview: DashboardOverview.fromApi(b),
      );
  final List<TaskCard> cards;
  final DashboardOverview overview;
}