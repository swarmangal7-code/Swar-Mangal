import 'dart:convert';

import '../core/api.dart';
import '../models/models.dart';

/// Typed facade over the raw RPC surface of the Railway gateway. Endpoint
/// names are configured/deployed server-side (`api_*` for the founder app,
/// `api_staff_*` for the staff app).
class ApiService {
  ApiService(this._api);

  final ApiClient _api;

  // ---------------------------------------------------------- auth / boot
  Future<Bootstrap> bootstrap() async {
    final b = await _api.call('api_bootstrap');
    return Bootstrap.fromApi(b as Map<String, dynamic>);
  }

  Future<Bootstrap> staffBoot() async {
    final b = await _api.call('api_staff_boot');
    return Bootstrap.fromApi(b as Map<String, dynamic>);
  }

  // ------------------------------------------------------------- students
  Future<List<Student>> searchStudents(String q, {String classCode = 'ALL'}) async {
    final b = await _api.call('api_searchStudent', {
      'q': q,
      'classCode': classCode,
      'includeAll': true,
    });
    return ((b as Map)['results'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(Student.fromApi)
            .toList() ??
        [];
  }

  Future<List<Student>> staffSearchStudents(String q, {String branch = 'ALL'}) async {
    final b = await _api.call('api_staff_searchStudents', {
      'q': q,
      'branch': branch,
      'includeAll': true,
    });
    // Staff API returns `rows` not `results`
    final m = b as Map;
    return (m['rows'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(Student.fromApi)
            .toList() ??
        [];
  }

  Future<StaffHub> staffStudentHub(String studentId, {String branch = 'ALL'}) async {
    final b = await _api.call('api_staff_studentHub', {
      'studentId': studentId,
      'branch': branch,
    });
    return StaffHub.fromApi(b as Map<String, dynamic>);
  }

  Future<dynamic> addStudent(Map<String, dynamic> form) =>
      _api.call('api_addStudent', form);

  Future<dynamic> saveStudentDraft(Map<String, dynamic> form) =>
      _api.call('api_staff_saveStudentDraft', form);

  // ---------------------------------------------------------- demo students
  Future<dynamic> addDemoStudent(Map<String, dynamic> form) =>
      _api.call('api_addDemoStudent', form);

  Future<List<DemoStudent>> listDemoStudents({String branch = 'ALL'}) async {
    final b = await _api.call('api_listDemoStudents', {'branch': branch});
    return ((b as Map)['students'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(DemoStudent.fromApi)
            .toList() ??
        [];
  }

  Future<dynamic> convertDemoStudent(Map<String, dynamic> form) =>
      _api.call('api_founder_convertDemoStudent', form);

  // ---------------------------------------------------------------- money
  Future<dynamic> addFeePayment(Map<String, dynamic> form) =>
      _api.call('api_addFeePayment', form);

  Future<dynamic> receiptPreflight(Map<String, dynamic> form) =>
      _api.call('api_receiptPreflight', form);

  Future<List<ReceiptRow>> searchReceipts({
    String q = '',
    String studentName = '',
    String receiptNo = '',
    String classCode = 'ALL',
    String status = '',
    String dateFrom = '',
    String dateTo = '',
    int limit = 50,
    int offset = 0,
  }) async =>
      (await searchReceiptsPage(
        q: q,
        studentName: studentName,
        receiptNo: receiptNo,
        classCode: classCode,
        status: status,
        dateFrom: dateFrom,
        dateTo: dateTo,
        limit: limit,
        offset: offset,
      ))
      .rows;

  /// One page of receipts plus the server's total, so a list can paginate
  /// instead of silently stopping at `limit`.
  Future<({List<ReceiptRow> rows, int total})> searchReceiptsPage({
    String q = '',
    String studentName = '',
    String receiptNo = '',
    String classCode = 'ALL',
    String status = '',
    String dateFrom = '',
    String dateTo = '',
    int limit = 50,
    int offset = 0,
  }) async {
    final b = await _api.call('api_searchReceipt', {
      'q': q,
      'studentName': studentName,
      'receiptNo': receiptNo,
      'classCode': classCode,
      'status': status,
      'dateFrom': dateFrom,
      'dateTo': dateTo,
      'limit': limit,
      'offset': offset,
    }) as Map<String, dynamic>;
    final rows = (b['results'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(ReceiptRow.fromApi)
            .toList() ??
        [];
    final rawTotal = b['total'];
    return (rows: rows, total: rawTotal is num ? rawTotal.toInt() : rows.length);
  }

  // ------------------------------------------------------------ dashboard
  Future<DashboardMetrics> dashboard(String scope) async {
    final b = await _api.call('api_dashboard', {'scope': scope});
    return DashboardMetrics.fromApi(b as Map<String, dynamic>);
  }

  Future<DueReminders> dueReminders(String branch) async {
    final b = await _api.call('api_dueReminders', {'branch': branch});
    return DueReminders.tryFrom(b as Map<String, dynamic>) ??
        DueReminders(branch: branch, advanceDays: 0, dueSoon: [], dueToday: [],
            overdue: [], gmcActive: 0, kmcActive: 0);
  }

  // -------------------------------------------------------------- sync
  /// Near-real-time sync check: returns server revisions for every entity.
  /// READ-ONLY/invalidation only — never replays a write.
  Future<SyncSnapshot> syncChanges({
    required String branch,
    required Map<String, int> knownRevisions,
  }) async {
    final b = await _api.call('api_syncChanges', {
      'branch': branch,
      'knownRevisions': knownRevisions,
    });
    return SyncSnapshot.fromApi(b as Map<String, dynamic>);
  }

// ---------------------------------------------------------- school invoices
  /// Generates a SCHOOL-LEVEL invoice (class/amount/tenure, no student) and
  /// returns the authoritative snapshot. Backend assigns the number + persists
  /// the immutable snapshot; Flutter renders the PDF. One intent key per form
  /// prevents duplicate invoices.
  Future<SchoolInvoice> generateSchoolInvoice({
    required String className,
    required num amount,
    required String tenure,
    String invoiceDate = '',
    String branch = 'ALL',
    required String schoolId,
    required String intentKey,
  }) async {
    final b = await _api.call('api_generateSchoolInvoice', {
      'className': className,
      'amount': amount,
      'tenure': tenure,
      if (invoiceDate.isNotEmpty) 'invoiceDate': invoiceDate,
      'branch': branch,
      'schoolId': schoolId,
      'clientIntentKey': intentKey,
    });
    return SchoolInvoice.fromApi(b as Map<String, dynamic>);
  }

  /// Schools a class can be billed to. The code is what appears on the
  /// invoice number, so it is set once and never changes.
  Future<List<School>> listSchools() async {
    final b = await _api.call('api_listSchools', const {});
    return ((b as Map)['schools'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(School.fromApi)
            .toList() ??
        [];
  }

  /// Founder-only: adds a school that uses the same invoice template.
  Future<dynamic> addSchool({
    required String code,
    required String name,
    String address = '',
    String contact = '',
  }) =>
      _api.call('api_addSchool', {
        'code': code,
        'name': name,
        if (address.isNotEmpty) 'address': address,
        if (contact.isNotEmpty) 'contact': contact,
      });

  /// School-level invoice history (global). No student dimension.
  Future<List<InvoiceSummary>> listSchoolInvoices({String branch = 'ALL'}) async {
    final b = await _api.call('api_listSchoolInvoices', {'branch': branch});
    return ((b as Map)['invoices'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(InvoiceSummary.fromApi)
            .toList() ??
        [];
  }

  /// Open one stored school-invoice snapshot (immutable — never rebuilt from
  /// current configuration).
  Future<SchoolInvoice> getSchoolInvoice(String invoiceId, {String branch = 'ALL'}) async {
    final b = await _api.call('api_getSchoolInvoice', {'invoiceId': invoiceId, 'branch': branch});
    return SchoolInvoice.fromApi((b as Map)['invoice'] as Map<String, dynamic>);
  }

  // -------------------------------------------------------------- timetable
  /// Branch timetable. Seed is backend-owned and applied only when the
  /// timetable has never been initialised — founder edits are never
  /// overwritten on app start.
  Future<List<TimetableEntry>> timetableList({String branch = 'ALL'}) async {
    final b = await _api.call('api_timetableList', {'branch': branch});
    return ((b as Map)['entries'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(TimetableEntry.fromApi)
            .toList() ??
        [];
  }

  Future<dynamic> timetableCreate(Map<String, dynamic> form) =>
      _api.call('api_timetableCreate', form);

  Future<dynamic> timetableUpdate(String id, Map<String, dynamic> form) =>
      _api.call('api_timetableUpdate', {'id': id, ...form});

  Future<dynamic> timetableDelete(String id, [Map<String, dynamic>? form]) =>
      _api.call('api_timetableDelete', {'id': id, ...?form});

  /// One calendar week's worth of sessions — the base recurring pattern
  /// resolved to real dates, with any "this week only" edits merged in.
  Future<({String weekStart, String weekEnd, List<TimetableWeekEntry> entries})> timetableWeek({
    String branch = 'ALL',
    required String weekStart,
  }) async {
    final b = (await _api.call('api_timetableWeek', {'branch': branch, 'weekStart': weekStart})) as Map;
    final entries = ((b['entries'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => TimetableWeekEntry.fromApi(e.cast<String, dynamic>()))
        .toList();
    return (weekStart: (b['weekStart'] ?? '').toString(), weekEnd: (b['weekEnd'] ?? '').toString(), entries: entries);
  }

  /// Click-through for one session: teacher attendance (with a reason if
  /// absent) and the student roster for that slot, by name.
  Future<TimetableSessionDetail> timetableSessionDetail({required String timetableId, required String date}) async {
    final b = (await _api.call('api_timetableSessionDetail', {'timetableId': timetableId, 'date': date})) as Map;
    return TimetableSessionDetail.fromApi(b.cast<String, dynamic>());
  }

// -------------------------------------------------------------- teachers
  Future<List<Teacher>> listTeachers() async {
    final b = await _api.call('api_listTeachers');
    return ((b as Map)['teachers'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(Teacher.fromApi)
            .toList() ??
        [];
  }

  Future<dynamic> addTeacher(Map<String, dynamic> form) =>
      _api.call('api_addTeacher', form);

  Future<dynamic> requestAddTeacher(Map<String, dynamic> form) =>
      _api.call('api_staff_requestAddTeacher', form);

  Future<dynamic> teacherAttendanceReport(Map<String, dynamic> form) =>
      _api.call('api_teacherAttendanceReport', form);

  /// Authoritative teacher profile incl. assigned students (profile contract).
  Future<TeacherProfile> teacherProfile(String teacherId, {String branch = 'ALL'}) async {
    final b = await _api.call('api_teacherProfile', {'teacherId': teacherId, 'branch': branch});
    return TeacherProfile.fromApi(b as Map<String, dynamic>);
  }

  /// Rich student profile incl. teacher link + receipts (profile contract).
  Future<StudentProfileDetail> studentProfile(String studentId, {String branch = 'ALL'}) async {
    final b = await _api.call('api_studentProfile', {'studentId': studentId, 'branch': branch});
    return StudentProfileDetail.fromApi(b as Map<String, dynamic>);
  }

  /// Founder-only compensation write. Percentage + effective date + reason are
  /// required; intent key stays stable per form so retries cannot duplicate.
  Future<dynamic> updateTeacherCompensation({
    required String teacherId,
    required num percentage,
    required String effectiveFrom,
    required String reason,
    required String intentKey,
  }) =>
      _api.call('api_updateTeacherCompensation', {
        'teacherId': teacherId,
        'percentage': percentage,
        'effectiveFrom': effectiveFrom,
        'reason': reason,
        'clientIntentKey': intentKey,
      });

  // -------------------------------------------------------------- expenses
  Future<dynamic> addExpenseEntry(Map<String, dynamic> form) =>
      _api.call('api_addExpenseEntry', form);

  Future<List<ExpenseEntry>> cashbookReport({
    String from = '',
    String to = '',
    String branch = 'ALL',
  }) async {
    final b = await _api.call('api_cashbookReport', {
      'dateFrom': from,
      'dateTo': to,
      'branch': branch,
    });
    return ((b as Map)['entries'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(ExpenseEntry.fromApi)
            .toList() ??
        [];
  }

  // -------------------------------------------------------------- staff os
  Future<List<Inquiry>> staffInquiryQueue({String branch = 'ALL'}) async {
    final b = await _api.call('api_staff_inquiryQueue', {'branch': branch});
    final m = b as Map;
    final raw = m['rows'] ?? m['queue'] ?? m['entries'] ?? m['results'];
    return (raw as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(Inquiry.fromApi)
            .toList() ??
        [];
  }

  Future<dynamic> staffInquiryQuickAdd(Map<String, dynamic> form) =>
      _api.call('api_staff_inquiryQuickAdd', form);

  Future<dynamic> staffAttendanceRoster(Map<String, dynamic> payload) =>
      _api.call('api_staff_attendanceRoster', payload);

  Future<dynamic> staffMarkAttendance(Map<String, dynamic> payload) =>
      _api.call('api_staff_markAttendance', payload);

  Future<dynamic> staffFeeDueList({String branch = 'ALL'}) async {
    final b = await _api.call('api_staff_feeDueList', {'branch': branch});
    return b;
  }

  Future<StaffToday> staffTodaysTasks({String branch = 'ALL'}) async {
    final b = await _api.call('api_staff_todaysTasks', {'branch': branch});
    return StaffToday.fromApi(b as Map<String, dynamic>);
  }

  // ------------------------------------------------------- today's classes
  Future<TodaysClassOptions> staffTodaysClasses({
    String branch = 'ALL',
    String date = '',
  }) async {
    final b = await _api.call('api_staff_todaysClasses', {'branch': branch, 'date': date});
    return TodaysClassOptions.fromApi(b as Map<String, dynamic>);
  }

  Future<dynamic> staffResolveTodaysClass(Map<String, dynamic> payload) =>
      _api.call('api_staff_resolveTodaysClass', payload);

  Future<dynamic> staffScheduleSession(Map<String, dynamic> payload) =>
      _api.call('api_staff_scheduleSession', payload);

  Future<dynamic> staffSessionRoster({String branch = 'ALL', required String scheduledSessionId}) =>
      _api.call('api_staff_sessionRoster', {'branch': branch, 'scheduledSessionId': scheduledSessionId});

  // --------------------------------------------------------------- leads
  Future<dynamic> staffInquiryTransition(Map<String, dynamic> payload) =>
      _api.call('api_staff_inquiryTransition', payload);

  Future<InquiryDetail> staffInquiryDetail(String inquiryId) async {
    final b = await _api.call('api_staff_inquiryDetail', {'inquiryId': inquiryId});
    return InquiryDetail.fromApi(b as Map<String, dynamic>);
  }

  // ------------------------------------------------------------ approvals
  Future<ApprovalsData> founderApprovals({String branch = ''}) async {
    final b = await _api.call('api_founder_approvalsList', {'branch': branch});
    return ApprovalsData.fromApi(b as Map<String, dynamic>);
  }

  /// Every column of the record behind one approval card — read-only.
  Future<Map<String, String>> founderApprovalItemDetail(String type, String itemId) async {
    final b = await _api.call('api_founder_approvalItemDetail', {'type': type, 'itemId': itemId});
    final m = b as Map<String, dynamic>;
    if (m['ok'] != true) throw ApiException((m['error'] ?? 'Could not load details.').toString(), code: (m['code'] ?? '').toString());
    return ((m['fields'] as Map?) ?? const {}).map((k, v) => MapEntry(k.toString(), v.toString()));
  }

  /// Full payment-draft queue incl. APPROVED rows (the ones needing finalise).
  Future<List<PaymentDraftRow>> founderListPaymentDrafts({String branch = ''}) async {
    final b = await _api.call('api_founder_listPaymentDrafts', {'branch': branch});
    return ((b as Map)['rows'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(PaymentDraftRow.fromApi)
            .toList() ??
        [];
  }

  Future<dynamic> founderPaymentDraftApprove(String draftId) =>
      _api.call('api_founder_paymentDraftApprove', {'draftId': draftId});

  Future<dynamic> founderPaymentDraftReject(String draftId, String comment) =>
      _api.call('api_founder_paymentDraftReject', {'draftId': draftId, 'comment': comment});

  /// REAL MONEY — finalises an APPROVED payment draft on the founder side.
  /// Reserves a receipt number, writes STUDENT_RECEIPTS + MONEY_LEDGER,
  /// advances next_due_date, renders PDF. Founder only. Idempotent.
  /// No override flag: the server refuses anything but an APPROVED draft, and
  /// an incomplete student is fixed in the record, not forced past.
  Future<dynamic> founderFinalisePaymentDraft(String draftId) =>
      _api.call('api_founder_finalisePaymentDraft', {'draftId': draftId});

  /// REAL MONEY (gated) — staff executes a founder-APPROVED draft's receipt.
  /// Server refuses unless STAFF_FINALISE_ENABLED + ops account + verified
  /// authority + APPROVED status. Idempotent; never double-writes.
  Future<dynamic> staffFinalisePaymentDraft(String draftId) =>
      _api.call('api_staff_finalisePaymentDraft', {'draftId': draftId});

  /// Founder-only lifecycle status change. Reason is MANDATORY and audited.
  /// The student row is never deleted — archive is a status change.
  Future<dynamic> founderSetStudentStatus(String studentId, String status, String reason) =>
      _api.call('api_founder_setStudentStatus', {
        'studentId': studentId,
        'status': status,
        'reason': reason,
      });

  /// Founder-only: flag a duplicate student record and link it to the
  /// survivor. History (receipts/attendance) stays on the duplicate's own id.
  Future<dynamic> founderMergeDuplicateStudent(String studentId, String survivorId) =>
      _api.call('api_founder_mergeDuplicateStudent', {
        'studentId': studentId,
        'survivorId': survivorId,
      });

  /// Handover spec §8.4: recovery credits. Package validity never extends —
  /// an eligible missed class gets a separate credit with its own use-by date.
  Future<List<RecoveryCredit>> listRecoveryCredits(String studentId) async {
    final b = await _api.call('api_staff_listRecoveryCredits', {'studentId': studentId});
    return ((b as Map)['credits'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(RecoveryCredit.fromApi)
            .toList() ??
        [];
  }

  Future<dynamic> grantRecoveryCredit(String studentId, String reason, String useByDate) =>
      _api.call('api_staff_grantRecoveryCredit', {
        'studentId': studentId,
        'reason': reason,
        'useByDate': useByDate,
      });

  Future<dynamic> scheduleRecoveryCredit(String creditId, String sessionDate, String teacherId) =>
      _api.call('api_staff_scheduleRecoveryCredit', {
        'creditId': creditId,
        'sessionDate': sessionDate,
        'teacherId': teacherId,
      });

  Future<dynamic> resolveRecoveryCredit(String creditId, String outcome) =>
      _api.call('api_staff_resolveRecoveryCredit', {
        'creditId': creditId,
        'outcome': outcome,
      });

  /// Founder-only teacher payout preview (server-computed payable). Never compute on client.
  Future<List<PayoutRow>> founderPayoutPreview(String month, {String? entityId}) async =>
      (await founderPayoutPreviewFull(month, entityId: entityId)).rows;

  /// The full preview: rows plus the shared students awaiting a decision.
  Future<PayoutPreview> founderPayoutPreviewFull(String month, {String? entityId}) async {
    final b = await _api.call('api_teacherPayoutPreview', {
      if (month.isNotEmpty) 'month': month,
      if (entityId != null && entityId.isNotEmpty) 'entityId': entityId,
    });
    return PayoutPreview.fromApi(b as Map<String, dynamic>);
  }

  /// Founder-only: freeze a month's payout figures (handover spec §10). A
  /// closed period is no longer PROJECTED — it returns exactly what was
  /// computed at close time even if rules or records change later.
  Future<dynamic> founderClosePayoutPeriod(String month) =>
      _api.call('api_founder_closePayoutPeriod', {'month': month});

  /// Founder-only: approve a staff expense draft. The backend turns it into
  /// a real expense plus the matching cashbook outflow.
  Future<dynamic> founderExpenseDraftApprove(String draftId) =>
      _api.call('api_founder_expenseDraftApprove', {'draftId': draftId});

  /// Founder-only: reject a staff expense draft, with a reason.
  Future<dynamic> founderExpenseDraftReject(String draftId, String reason) =>
      _api.call('api_founder_expenseDraftReject', {'draftId': draftId, 'reason': reason});

  /// Founder-only: the write trail (who changed what, newest first).
  Future<List<AuditEntry>> founderAuditLog({int limit = 100, String fn = '', bool failuresOnly = false}) async {
    final b = await _api.call('api_founder_auditLog', {
      'limit': limit,
      if (fn.isNotEmpty) 'fn': fn,
      if (failuresOnly) 'failuresOnly': true,
    });
    return ((b as Map)['rows'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(AuditEntry.fromApi)
            .toList() ??
        [];
  }

  /// Founder-only: decide how a shared student's fee splits between the
  /// teachers who taught them that month. Amounts must not exceed what the
  /// student paid; an empty list clears the decision.
  Future<void> assignSharedStudent({
    required String month,
    required String studentId,
    required Map<String, num> allocations,
  }) async {
    await _api.call('api_assignSharedStudent', {
      'month': month,
      'studentId': studentId,
      'allocations': [
        for (final e in allocations.entries)
          if (e.value > 0) {'teacherId': e.key, 'amount': e.value},
      ],
    });
  }

  /// Founder-only: record money actually paid to a teacher for a service
  /// month. The backend posts the cashbook entry; the app never computes it.
  Future<PayoutPayment> recordTeacherPayout({
    required String teacherId,
    required String month,
    required num amount,
    String paidOn = '',
    String paymentMode = 'Bank Transfer',
    String reference = '',
    String branch = '',
  }) async {
    final b = await _api.call('api_recordTeacherPayout', {
      'teacherId': teacherId,
      'month': month,
      'amount': amount,
      if (paidOn.isNotEmpty) 'paidOn': paidOn,
      'paymentMode': paymentMode,
      if (reference.isNotEmpty) 'reference': reference,
      if (branch.isNotEmpty) 'branch': branch,
    });
    return PayoutPayment.fromApi(b as Map<String, dynamic>);
  }

  /// Founder-only: payments already made, newest first.
  Future<List<PayoutPayment>> teacherPayoutHistory({String teacherId = '', String month = ''}) async {
    final b = await _api.call('api_teacherPayoutHistory', {
      if (teacherId.isNotEmpty) 'teacherId': teacherId,
      if (month.isNotEmpty) 'month': month,
    });
    return ((b as Map)['rows'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(PayoutPayment.fromApi)
            .toList() ??
        [];
  }

  /// Staff — persisted drafts awaiting (or resolved by) founder approval.
  Future<List<ApprovalRequestRow>> staffMyRequests({String branch = ''}) async {
    final b = await _api.call('api_staff_listMyApprovals', {'branch': branch});
    return ((b as Map)['rows'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(ApprovalRequestRow.fromApi)
            .toList() ??
        [];
  }

  /// Founder-only teacher status change (ACTIVE / INACTIVE / HOLD).
  Future<dynamic> founderUpdateTeacherStatus(String teacherId, String newStatus, String reason) =>
      _api.call('api_updateTeacherStatus', {
        'teacherId': teacherId,
        'newStatus': newStatus,
        'reason': reason,
      });

  Future<dynamic> founderMergeStudentDraft(String draftId) =>
      _api.call('api_founder_mergeStudentDraft', {'draftId': draftId});

  Future<dynamic> founderStudentDraftReject(String draftId, String reason) =>
      _api.call('api_founder_studentDraftReject', {'draftId': draftId, 'reason': reason});

  // ------------------------------------------------------------ whatsapp
  /// One tap, one message, to the student's REGISTERED number (the server
  /// looks it up). Reuse [clientIntentKey] on retry so it can never send twice.
  Future<WaMessage> sendWhatsApp({
    required String studentId,
    required String kind,
    required String body,
    required String clientIntentKey,
  }) async {
    final b = await _api.call('api_staff_sendWhatsApp', {
      'studentId': studentId,
      'kind': kind.isEmpty ? 'CUSTOM' : kind,
      'body': body,
      'clientIntentKey': clientIntentKey,
    });
    return WaMessage.fromApi((b as Map)['message'] as Map<String, dynamic>);
  }

  /// Send a PDF (e.g. a receipt) as a WhatsApp document.
  Future<WaMessage> sendWhatsAppDocument({
    required String studentId,
    required String fileName,
    required String fileBase64,
    required String caption,
    required String clientIntentKey,
    String kind = 'RECEIPT',
  }) async {
    final b = await _api.call('api_staff_sendWhatsAppDocument', {
      'studentId': studentId,
      'kind': kind,
      'fileName': fileName,
      'fileBase64': fileBase64,
      'mimeType': 'application/pdf',
      'caption': caption,
      'clientIntentKey': clientIntentKey,
    });
    return WaMessage.fromApi((b as Map)['message'] as Map<String, dynamic>);
  }

  Future<List<WaMessage>> messageHistory(String studentId) async {
    final b = await _api.call('api_staff_messageHistory', {'studentId': studentId});
    return ((b as Map)['rows'] as List?)
            ?.whereType<Map<String, dynamic>>()
            .map(WaMessage.fromApi)
            .toList() ??
        [];
  }

  // ----------------------------------------------------------- messaging
  Future<CommMessage> staffCommGenerate(Map<String, dynamic> params) async {
    final b = await _api.call('api_staff_commGenerate', params);
    return CommMessage.fromApi(b as Map<String, dynamic>);
  }

  // ------------------------------------------------------------- push
  /// Registers (or refreshes) this device's push token against the signed-in
  /// session. Safe to call every launch — the server upserts on the token.
  Future<bool> registerPushToken({required String fcmToken, String platform = 'android'}) async {
    final b = await _api.call('api_registerPushToken', {'fcmToken': fcmToken, 'platform': platform});
    return (b as Map)['ok'] == true;
  }

  /// Called on sign-out so a shared/reset device stops receiving this
  /// session's notifications.
  Future<void> unregisterPushToken(String fcmToken) => _api.call('api_unregisterPushToken', {'fcmToken': fcmToken});

  /// Whether the server has a Firebase project configured at all. Lets the
  /// app skip asking for notification permission when push can't work yet.
  Future<bool> pushEnabled() async {
    final b = await _api.call('api_pushStatus');
    return (b as Map)['enabled'] == true;
  }

  // ---------------------------------------------------------------- misc
  Future<dynamic> raw(String api, [Object? arg]) => _api.call(api, arg);
}

/// Debug helper: pretty-print a server payload for a failure sheet.
String prettyPayload(dynamic v) {
  try {
    return const JsonEncoder.withIndent('  ').convert(v);
  } catch (_) {
    return '$v';
  }
}