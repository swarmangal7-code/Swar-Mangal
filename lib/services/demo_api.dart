import '../core/api.dart';
import '../data/kandivali_timetable_seed.dart';
import '../models/models.dart';

String _slice10(dynamic v) {
  final s = v == null ? '' : v.toString();
  return s.length > 10 ? s.substring(0, 10) : s;
}

/// Offline demo backend. Returns realistic canned payloads for every call the
/// screens make, so the whole UI can be smoke-tested on a device with no
/// network and no deployed gateway. Zero real writes ever.
class DemoApiClient extends ApiClient {
  DemoApiClient({this.branch = 'ALL'})
      : super(apiUrl: 'demo://local', token: 'demo');

  final String branch;

  /// In-memory timetable, SHARED across all DemoApiClient instances in this
  /// process (simulates multiple sessions/devices seeing each other's edits).
  /// Seeded once from the Kandivali seed; founder edits are never reseeded.
  static List<TimetableEntry>? _sharedTimetable;

  List<TimetableEntry> get _tt {
    _sharedTimetable ??= kandivaliTimetableSeed.map((e) => _clone(e)).toList();
    return _sharedTimetable!;
  }

  /// School invoices, SHARED like the timetable, so an invoice generated in
  /// one session shows up in another's list.
  static List<Map<String, dynamic>>? _sharedInvoices;

  static List<Map<String, dynamic>> get _invoices {
    _sharedInvoices ??= [
      {
        'invoiceNo': 'INV-DEMO-98000',
        'invoiceDate': '2026-09-12',
        'tenure': '6 Months',
        'amount': 18000,
        'invoiceId': 'SINV-DEMO-1',
        'className': 'Keyboard',
      },
      {
        'invoiceNo': 'INV-DEMO-97887',
        'invoiceDate': '2026-06-10',
        'tenure': '3 Months',
        'amount': 9000,
        'invoiceId': 'SINV-DEMO-2',
        'className': 'Flute',
      },
    ];
    return _sharedInvoices!;
  }

  /// Payout statements (DRAFT->CALCULATED->FOUNDER_APPROVED->PAID), SHARED
  /// like the timetable, keyed by "teacherId|month" — so generating then
  /// approving a statement in demo mode behaves like the real workflow
  /// instead of resetting on every call.
  static Map<String, Map<String, dynamic>>? _sharedStatements;
  static Map<String, Map<String, dynamic>> get _statements => _sharedStatements ??= {};

  /// Shared, growable instrument picklist — same list the teacher dropdown,
  /// timetable instrument dropdown and fee rate card forms all read from.
  static List<String>? _sharedInstruments;
  static List<String> get _instruments => _sharedInstruments ??= [
        'Vocals', 'Guitar', 'Piano / Keyboard', 'Violin', 'Tabla', 'Drums', 'Flute', 'Harmonium', 'Ukulele',
      ];

  /// Founder-maintained fee rate card rows, SHARED like the timetable.
  static List<Map<String, dynamic>>? _sharedFeeRateCard;
  static List<Map<String, dynamic>> get _feeRateCard => _sharedFeeRateCard ??= [
        {
          'id': 'FRC-DEMO-1',
          'instrument': 'Guitar',
          'name': 'Standard',
          'feeAmount': 2500,
          'billingPeriod': 'Monthly',
          'notes': '',
          'active': true,
          'createdBy': 'demo', 'createdAt': '2026-10-01T00:00:00.000Z',
          'updatedBy': '', 'updatedAt': '',
        },
        {
          'id': 'FRC-DEMO-2',
          'instrument': 'Piano / Keyboard',
          'name': '1-on-1',
          'feeAmount': 3500,
          'billingPeriod': 'Monthly',
          'notes': 'Includes practice slot',
          'active': true,
          'createdBy': 'demo', 'createdAt': '2026-10-01T00:00:00.000Z',
          'updatedBy': '', 'updatedAt': '',
        },
      ];

  /// Clears the process-wide demo store. Tests call this in setUp so one
  /// test's writes cannot change what another test sees.
  static void resetSharedState() {
    _sharedTimetable = null;
    _sharedInvoices = null;
    _sharedStatements = null;
    _sharedInstruments = null;
    _sharedFeeRateCard = null;
    revisions.updateAll((k, v) => 1);
  }

  static TimetableEntry _clone(TimetableEntry e) => TimetableEntry(
        id: e.id,
        branch: e.branch,
        dayOfWeek: e.dayOfWeek,
        startTime: e.startTime,
        endTime: e.endTime,
        className: e.className,
        teacherId: e.teacherId,
        teacherName: e.teacherName,
        status: e.status,
        substituteTeacherId: e.substituteTeacherId,
        substituteTeacherName: e.substituteTeacherName,
        instrument: e.instrument,
      );

  /// Server revisions, SHARED across sessions. Each successful write bumps
  /// the relevant entity revision (never bumped for failed writes).
  static final Map<String, int> revisions = <String, int>{
    'students': 1, 'teachers': 1, 'payments': 1, 'receipts': 1, 'expenses': 1,
    'invoices': 1, 'timetable': 1, 'attendance': 1, 'inquiries': 1,
    'approvals': 1, 'sessions': 1, 'dashboard': 1, 'tasks': 1, 'payouts': 1,
    'feeRateCard': 1,
  };

  static void _bump(Iterable<String> entities) {
    revisions.updateAll((k, v) => entities.contains(k) ? v + 1 : v);
  }

  /// Which entity revisions a successful write bumps (single source; never
  /// bumped for a failed write since bumping lives in `call()` post-success).
  static const Map<String, Set<String>> _revisionByApi = {
    'api_addFeePayment': {'payments', 'receipts', 'dashboard', 'students'},
    'api_staff_prepareReceiptDraft': {'payments', 'approvals', 'dashboard', 'students'},
    'api_founder_finalisePaymentDraft': {'payments', 'receipts', 'dashboard', 'students'},
    'api_staff_finalisePaymentDraft': {'payments', 'receipts', 'dashboard', 'students'},
    'api_founder_paymentDraftApprove': {'approvals', 'payments', 'students'},
    'api_founder_paymentDraftReject': {'approvals', 'payments', 'students'},
    'api_addStudent': {'students', 'dashboard'},
    'api_staff_saveStudentDraft': {'students', 'dashboard'},
    'api_founder_editStudent': {'students', 'dashboard'},
    'api_addDemoStudent': {'students', 'dashboard'},
    'api_founder_convertDemoStudent': {'students', 'dashboard', 'tasks'},
    'api_addSchool': {'invoices'},
    'api_addExpenseEntry': {'expenses', 'dashboard'},
    'api_staff_submitExpenseDraft': {'expenses', 'approvals', 'dashboard'},
    'api_founder_expenseDraftApprove': {'expenses', 'approvals', 'dashboard'},
    'api_founder_expenseDraftReject': {'expenses', 'approvals'},
    'api_staff_inquiryQuickAdd': {'inquiries'},
    'api_staff_inquiryTransition': {'inquiries'},
    'api_staff_markAttendance': {'attendance', 'dashboard', 'sessions'},
    'api_staff_resolveTodaysClass': {'attendance', 'sessions', 'dashboard'},
    'api_staff_scheduleSession': {'sessions', 'dashboard'},
    'api_founder_setStudentStatus': {'students', 'dashboard'},
    'api_updateTeacherStatus': {'teachers'},
    'api_founder_mergeStudentDraft': {'students', 'dashboard'},
    'api_founder_studentDraftReject': {'students', 'approvals'},
    'api_updateTeacherCompensation': {'teachers', 'payouts'},
    'api_recordTeacherPayout': {'payouts', 'expenses', 'dashboard'},
    'api_assignSharedStudent': {'payouts', 'dashboard'},
    'api_founder_setPayoutStatusRule': {'payouts'},
    'api_founder_setTeacherPercentSlab': {'payouts', 'teachers'},
    'api_founder_setLateFeeSettings': {'payouts', 'students'},
    'api_founder_generatePayoutStatement': {'payouts'},
    'api_founder_approvePayoutStatement': {'payouts'},
    'api_founder_addPayoutAdjustment': {'payouts'},
    'api_founder_sendOverdueLateFeeReminders': {},
    'api_generateSchoolInvoice': {'invoices'},
    'api_timetableCreate': {'timetable'},
    'api_timetableUpdate': {'timetable'},
    'api_timetableDelete': {'timetable'},
    'api_founder_upsertFeeRateCard': {'feeRateCard'},
    'api_founder_deactivateFeeRateCard': {'feeRateCard'},
    'api_staff_submitPackageExtensionRequest': {'approvals'},
    'api_founder_packageExtensionApprove': {'approvals', 'students', 'dashboard'},
    'api_founder_packageExtensionReject': {'approvals'},
    'api_staff_submitPaymentProfileChangeRequest': {'approvals'},
    'api_founder_paymentProfileChangeApprove': {'approvals'},
    'api_founder_paymentProfileChangeReject': {'approvals'},
    'api_staff_proposeClosure': {'approvals'},
    'api_founder_authoriseClosure': {'approvals', 'sessions', 'dashboard'},
    'api_founder_closureReject': {'approvals'},
    'api_founder_revokeClosure': {'approvals', 'sessions', 'dashboard'},
    'api_staff_requestClassCorrection': {'approvals'},
    'api_founder_approveClassCorrection': {'approvals', 'sessions', 'dashboard'},
    'api_founder_rejectClassCorrection': {'approvals'},
    'api_staff_submitLateFeeWaiverRequest': {'approvals'},
    'api_founder_lateFeeWaiverApprove': {'approvals', 'students', 'dashboard'},
    'api_founder_lateFeeWaiverReject': {'approvals'},
    'api_staff_submitInstalmentPlanDraft': {'approvals'},
    'api_founder_instalmentPlanDraftApprove': {'approvals', 'students', 'payments'},
    'api_founder_instalmentPlanDraftReject': {'approvals'},
    'api_staff_generateTermsToken': {},
    'api_staff_requestManualTermsAcceptance': {'approvals'},
    'api_founder_manualTermsAcceptanceApprove': {'approvals'},
    'api_founder_manualTermsAcceptanceReject': {'approvals'},
    'api_founder_addAuthorizedEmail': {},
    'api_founder_removeAuthorizedEmail': {},
    'api_founder_revokeDeviceToken': {},
    'api_staff_requestAddTeacher': {'approvals'},
    'api_founder_addTeacherRequestApprove': {'approvals', 'teachers'},
    'api_founder_addTeacherRequestReject': {'approvals'},
  };

  /// Write endpoints that must carry DEMO provenance (no real write happens).
  static const _writes = <String>{
    'api_addStudent',
    'api_staff_saveStudentDraft',
    'api_founder_editStudent',
    'api_addDemoStudent',
    'api_founder_convertDemoStudent',
    'api_addSchool',
    'api_addFeePayment',
    'api_staff_prepareReceiptDraft',
    'api_addTeacher',
    'api_addInstrument',
    'api_addExpenseEntry',
    'api_staff_submitExpenseDraft',
    'api_founder_expenseDraftApprove',
    'api_founder_expenseDraftReject',
    'api_staff_inquiryQuickAdd',
    'api_staff_inquiryTransition',
    'api_staff_markAttendance',
    'api_staff_scheduleSession',
    'api_staff_resolveTodaysClass',
    'api_founder_setStudentStatus',
    'api_updateTeacherStatus',
    'api_recordTeacherPayout',
    'api_assignSharedStudent',
    'api_founder_setPayoutStatusRule',
    'api_founder_setTeacherPercentSlab',
    'api_founder_setLateFeeSettings',
    'api_founder_generatePayoutStatement',
    'api_founder_approvePayoutStatement',
    'api_founder_addPayoutAdjustment',
    'api_founder_sendOverdueLateFeeReminders',
    'api_founder_paymentDraftApprove',
    'api_founder_paymentDraftReject',
    'api_founder_finalisePaymentDraft',
    'api_staff_finalisePaymentDraft',
    'api_founder_mergeStudentDraft',
    'api_founder_studentDraftReject',
    'api_staff_sendWhatsApp',
    'api_staff_sendWhatsAppDocument',
    'api_staff_shareDocumentViaWhatsApp',
    'api_staff_submitSchoolInvoiceDraft',
    'api_founder_finaliseSchoolInvoiceDraft',
    'api_founder_schoolInvoiceDraftReject',
    'api_staff_requestReceiptCorrection',
    'api_founder_voidReceipt',
    'api_founder_correctionReject',
    'api_founder_closeMonth',
    'api_updateTeacherCompensation',
    'api_generateSchoolInvoice',
    'api_timetableCreate',
    'api_timetableUpdate',
    'api_timetableDelete',
    'api_founder_upsertFeeRateCard',
    'api_founder_deactivateFeeRateCard',
    'api_staff_submitPackageExtensionRequest',
    'api_founder_packageExtensionApprove',
    'api_founder_packageExtensionReject',
    'api_staff_submitPaymentProfileChangeRequest',
    'api_founder_paymentProfileChangeApprove',
    'api_founder_paymentProfileChangeReject',
    'api_staff_proposeClosure',
    'api_founder_authoriseClosure',
    'api_founder_closureReject',
    'api_founder_revokeClosure',
    'api_staff_requestClassCorrection',
    'api_founder_approveClassCorrection',
    'api_founder_rejectClassCorrection',
    'api_staff_submitLateFeeWaiverRequest',
    'api_founder_lateFeeWaiverApprove',
    'api_founder_lateFeeWaiverReject',
    'api_staff_submitInstalmentPlanDraft',
    'api_founder_instalmentPlanDraftApprove',
    'api_founder_instalmentPlanDraftReject',
    'api_staff_generateTermsToken',
    'api_staff_requestManualTermsAcceptance',
    'api_founder_manualTermsAcceptanceApprove',
    'api_founder_manualTermsAcceptanceReject',
    'api_founder_addAuthorizedEmail',
    'api_founder_removeAuthorizedEmail',
    'api_founder_revokeDeviceToken',
    'api_staff_requestAddTeacher',
    'api_founder_addTeacherRequestApprove',
    'api_founder_addTeacherRequestReject',
  };

  @override
  Future<dynamic> call(String api, [Object? arg]) async {
    final a = (arg is Map) ? Map<String, dynamic>.from(arg) : <String, dynamic>{};
    final data = _route(api, a);
    await Future<void>.delayed(const Duration(milliseconds: 350)); // feel real
    if (_writes.contains(api) && data is Map<String, dynamic>) {
      data['demo'] = true;
      data['demoNote'] = 'DEMO — no real backend write. Not persisted.';
      final bump = _revisionByApi[api];
      if (bump != null) _bump(bump); // success only — post-_route, never on throw
    }
    return data;
  }

  dynamic _route(String api, Map<String, dynamic> a) {
    switch (api) {
      case 'api_bootstrap':
        return _bootstrap();
      case 'api_staff_boot':
        return _staffBoot();
      case 'api_searchStudent':
      case 'api_staff_searchStudents':
        return _students(a);
      case 'api_staff_getStudentProfile':
        return _studentProfile(a);
      case 'api_dashboard':
        return _dashboard();
      case 'api_dueReminders':
        return _dueReminders();
      case 'api_searchReceipt':
        return _receipts(a);
      case 'api_listTeachers':
        return _teachers();
      case 'api_cashbookReport':
        return _cashbook();
      case 'api_staff_doToday':
      case 'api_staff_todaysTasks':
        return _todaysTasks();
      case 'api_staff_todaysClasses':
        return _todaysClasses(a);
      case 'api_staff_resolveTodaysClass':
        return _resolveTodaysClass(a);
      case 'api_staff_scheduleSession':
        return _scheduleSession(a);
      case 'api_staff_sessionRoster':
        return _sessionRoster();
      case 'api_staff_inquiryTransition':
        return _inquiryTransition(a);
      case 'api_founder_expenseDraftApprove':
        return {
          'ok': true,
          'changed': true,
          'draftId': a['draftId'] ?? '',
          'status': 'APPROVED',
          'note': 'demo approval — no real expense written',
        };
      case 'api_founder_expenseDraftReject':
        return {
          'ok': true,
          'changed': true,
          'draftId': a['draftId'] ?? '',
          'status': 'REJECTED',
          'note': 'demo rejection',
        };
      case 'api_founder_auditLog':
        return {
          'ok': true,
          'rows': [
            {
              'at': '2026-09-16T10:12:00Z', 'actorRole': 'OPS_USER', 'actorEmail': 'demo@staff',
              'device': 'demo', 'fn': 'api_staff_markAttendance', 'ok': true, 'code': '',
              'branch': 'KANDIVALI', 'ref': 'id=ATT-DEMO-1',
            },
            {
              'at': '2026-09-16T09:40:00Z', 'actorRole': 'FOUNDER_ADMIN', 'actorEmail': 'demo@founder',
              'device': 'demo', 'fn': 'api_founder_finalisePaymentDraft', 'ok': true, 'code': '',
              'branch': 'KANDIVALI', 'ref': 'receiptNo=SMR-DEMO-007',
            },
          ],
          'count': 2,
          'note': 'demo trail',
        };
      case 'api_founder_approvalsList':
        return _approvalsList();
      case 'api_founder_approvalItemDetail':
        return {
          'ok': true,
          'type': a['type'],
          'itemId': a['itemId'],
          'fields': {
            'id': a['itemId'],
            'status': 'SUBMITTED',
            'note': 'Demo mode shows a placeholder here — the real screen returns every column of the underlying record.',
          },
        };
      case 'api_founder_listPaymentDrafts':
        return _paymentDraftQueue();
      case 'api_founder_paymentDraftApprove':
        return {'ok': true, 'changed': true, 'draftId': a['draftId'], 'approved': true, 'note': 'demo approved'};
      case 'api_founder_paymentDraftReject':
        return {'ok': true, 'changed': true, 'draftId': a['draftId'], 'rejected': true, 'note': 'demo rejected'};
      case 'api_founder_mergeStudentDraft':
        return {'ok': true, 'created': true, 'draftId': a['draftId'], 'studentId': 'STU-DEMO-MERGED', 'note': 'demo merged'};
      case 'api_founder_finalisePaymentDraft':
      case 'api_staff_finalisePaymentDraft':
        return {
          'ok': true,
          'changed': true,
          'draftId': a['draftId'],
          'status': 'FINALISED',
          'receiptNo': 'RCP-DEMO-${9100 + (a['draftId']?.length ?? 0)}',
          'pdfUrl': '',
          'idempotent': false,
          'financialWrites': false,
          'finalisedBy': 'demo',
          'note': 'demo finalise — real money path writes receipt + ledger + due-date advance server-side',
        };
      case 'api_founder_setStudentStatus':
        return {
          'ok': true,
          'changed': true,
          'studentId': a['studentId'],
          'before': {'status': 'ACTIVE'},
          'after': {'status': a['status']},
          'reason': a['reason'],
          'auditWritten': true,
          'note': 'demo status changed',
        };
      case 'api_updateTeacherStatus':
        return {
          'ok': true,
          'teacherId': a['teacherId'],
          'oldStatus': 'ACTIVE',
          'newStatus': a['newStatus'],
          'message': 'demo teacher status updated',
        };
      case 'api_generateSchoolInvoice':
        return _schoolInvoice(a);
      case 'api_peekNextSchoolInvoiceNo':
        return {'ok': true, 'seq': _invoices.length + 1, 'invoiceNo': 'INV-DEMO-PEEK'};
      case 'api_listSchoolInvoices':
        return _schoolInvoicesList(a);
      case 'api_getSchoolInvoice':
        return _schoolInvoiceDetail(a);
      case 'api_timetableList':
        return _timetableList(a);
      case 'api_timetableCreate':
        return _timetableCreate(a);
      case 'api_timetableUpdate':
        return _timetableUpdate(a);
      case 'api_timetableDelete':
        return _timetableDelete(a);
      case 'api_listInstruments':
        return {
          'ok': true,
          'instruments': [for (final n in _instruments) {'id': 'INS-DEMO-$n', 'name': n}],
        };
      case 'api_addInstrument':
        return _addInstrument(a);
      case 'api_listFeeRateCard':
        return _listFeeRateCard(a);
      case 'api_founder_upsertFeeRateCard':
        return _upsertFeeRateCard(a);
      case 'api_founder_deactivateFeeRateCard':
        return _deactivateFeeRateCard(a);
      case 'api_staff_shareDocumentViaWhatsApp':
        return _demoWhatsApp(api, a);
      case 'api_syncChanges':
        return _syncChanges(a);
      case 'api_staff_listRecoveryCredits':
        return {'ok': true, 'count': 0, 'credits': []};
      case 'api_staff_grantRecoveryCredit':
      case 'api_staff_scheduleRecoveryCredit':
      case 'api_staff_resolveRecoveryCredit':
        return {'ok': false, 'code': 'DEMO_READ_ONLY', 'error': 'Recovery credits are not editable in demo mode.'};
      case 'api_staff_studentHub':
        return _staffStudentHub(a);
      case 'api_teacherProfile':
        return _teacherProfile(a);
      case 'api_studentProfile':
        return _studentProfileDetail(a);
      case 'api_updateTeacherCompensation':
        return {
          'ok': true,
          'changed': true,
          'teacherId': a['teacherId'],
          'oldPercentage': '40',
          'newPercentage': '${a['percentage']}',
          'effectiveFrom': a['effectiveFrom'],
          'reason': a['reason'],
          'auditWritten': true,
          'note': 'demo compensation updated',
        };
      case 'api_teacherPayoutPreview':
        return _payoutPreview(a);
      case 'api_founder_closePayoutPeriod':
        return {'ok': false, 'code': 'DEMO_READ_ONLY', 'error': 'Payout periods are not editable in demo mode.'};
      case 'api_recordTeacherPayout':
        return {
          'ok': true,
          'payoutId': 'TPO-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'teacherId': a['teacherId'] ?? '',
          'teacherName': 'Demo Teacher',
          'month': a['month'] ?? '',
          'amount': a['amount'] ?? 0,
          'paidOn': a['paidOn'] ?? '',
          'paymentMode': a['paymentMode'] ?? 'Bank Transfer',
          'totalPaidForMonth': a['amount'] ?? 0,
          'note': 'demo payout — no real money row written',
        };
      case 'api_teacherPayoutHistory':
        return {'ok': true, 'rows': const [], 'total': 0};
      case 'api_founder_setPayoutStatusRule':
        return {
          'ok': true,
          'ruleId': 'PSR-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'outcome': a['outcome'] ?? '',
          'payoutPercent': a['payoutPercent'] ?? a['percent'] ?? 0,
          'effectiveFrom': a['effectiveFrom'] ?? '2026-10-03',
          'note': 'New effective-dated rule added. Earlier rows are untouched.',
        };
      case 'api_founder_setTeacherPercentSlab':
        return {
          'ok': true,
          'slabId': 'TPS-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'monthsSinceStart': a['monthsSinceStart'] ?? 0,
          'percent': a['percent'] ?? 0,
          'effectiveFrom': a['effectiveFrom'] ?? '2026-10-03',
          'note': 'New effective-dated slab step added. Earlier rows are untouched.',
        };
      case 'api_founder_setLateFeeSettings':
        return {
          'ok': true,
          'settingId': 'LFS-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'graceDays': a['graceDays'] ?? 7,
          'dailyRate': a['dailyRate'] ?? 50,
          'effectiveFrom': a['effectiveFrom'] ?? '2026-10-03',
          'note': 'New effective-dated late-fee setting added. Fees already accrued under '
              'the earlier rate are not retroactively changed.',
        };
      case 'api_founder_listPayoutSettings':
        return {
          'ok': true,
          'payoutStatusRules': [
            {'id': 'PSR-DEMO-1', 'outcome': 'ACADEMY_CANCELLED', 'payoutPercent': 50, 'effectiveFrom': '2026-10-01', 'effectiveTo': null, 'notes': 'demo default', 'createdBy': 'demo@founder'},
            {'id': 'PSR-DEMO-2', 'outcome': 'SCHOOL_HOLIDAY', 'payoutPercent': 50, 'effectiveFrom': '2026-10-01', 'effectiveTo': null, 'notes': 'demo default', 'createdBy': 'demo@founder'},
            {'id': 'PSR-DEMO-3', 'outcome': 'STUDENT_ABSENT', 'payoutPercent': 100, 'effectiveFrom': '2026-10-01', 'effectiveTo': null, 'notes': 'demo default', 'createdBy': 'demo@founder'},
          ],
          'teacherPercentSlabs': [
            {'id': 'TPS-DEMO-1', 'monthsSinceStart': 0, 'percent': 30, 'effectiveFrom': '2026-10-01', 'createdBy': 'demo@founder'},
            {'id': 'TPS-DEMO-2', 'monthsSinceStart': 6, 'percent': 40, 'effectiveFrom': '2026-10-01', 'createdBy': 'demo@founder'},
            {'id': 'TPS-DEMO-3', 'monthsSinceStart': 12, 'percent': 50, 'effectiveFrom': '2026-10-01', 'createdBy': 'demo@founder'},
          ],
          'lateFeeSettings': [
            {'id': 'LFS-DEMO-1', 'graceDays': 7, 'dailyRate': 50, 'effectiveFrom': '2026-10-01', 'createdBy': 'demo@founder'},
          ],
        };
      case 'api_previewAccruedLateFee':
        return {'ok': true, 'studentId': a['studentId'] ?? '', 'amount': 150, 'daysLate': 3, 'overdueSince': '2026-09-30'};
      case 'api_founder_generatePayoutStatement':
        return _generatePayoutStatement(a);
      case 'api_founder_approvePayoutStatement':
        return _approvePayoutStatement(a);
      case 'api_founder_addPayoutAdjustment':
        return {
          'ok': true,
          'adjustmentId': 'PADJ-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'statementId': a['statementId'] ?? '',
          'amount': a['amount'] ?? 0,
          'reason': a['reason'] ?? '',
          'relatedEntity': a['relatedEntity'] ?? '',
          'approvedBy': 'demo@founder',
          'note': 'Adjustment recorded. It is included the next time this statement is approved.',
        };
      case 'api_founder_sendOverdueLateFeeReminders':
        return {
          'ok': true,
          'sent': 2,
          'failed': 0,
          'skipped': 1,
          'total': 3,
          'details': const [],
          'note': 'Targets only students whose late fee started accruing today.',
        };
      case 'api_assignSharedStudent':
        return {
          'ok': true,
          'month': a['month'] ?? '',
          'studentId': a['studentId'] ?? '',
          'assigned': 0,
          'remaining': 0,
          'note': 'demo split — nothing persisted',
        };
      case 'api_staff_listMyApprovals':
        return _staffMyRequests();
      case 'api_staff_commGenerate':
        return _commGenerate(a);
      case 'api_whatsappStatus':
        return {'ok': true, 'enabled': true, 'connected': false, 'note': 'demo — no gateway'};
      case 'api_staff_sendWhatsApp':
      case 'api_staff_sendWhatsAppDocument':
        return _demoWhatsApp(api, a);
      case 'api_staff_messageHistory':
        final mine = _demoMessages.where((m) => m['studentId'] == a['studentId']).toList();
        return {'ok': true, 'rows': mine, 'count': mine.length};
      case 'api_founder_studentDraftReject':
        return {
          'ok': true,
          'changed': true,
          'draftId': a['draftId'] ?? '',
          'status': 'REJECTED',
          'note': 'demo rejection',
        };
      case 'api_staff_submitSchoolInvoiceDraft':
        return {
          'ok': true,
          'draftId': 'SIDRAFT-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'status': 'SUBMITTED',
          'persisted': true,
          'note': 'Sent for approval. He allocates the invoice number when he finalises it.',
        };
      case 'api_founder_finaliseSchoolInvoiceDraft':
        return {
          'ok': true,
          'draftId': a['draftId'] ?? '',
          'changed': true,
          'invoiceId': 'SINV-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'invoiceNo': 'SMI-26-27-DEMO',
          'note': 'demo — no real invoice issued',
        };
      case 'api_founder_schoolInvoiceDraftReject':
        return {'ok': true, 'draftId': a['draftId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_staff_submitPackageExtensionRequest':
        return {
          'ok': true,
          'requestId': 'PKGEXT-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'status': 'SUBMITTED',
          'persisted': true,
          'note': 'Sent for approval.',
        };
      case 'api_founder_packageExtensionApprove':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'note': 'demo — package not really extended'};
      case 'api_founder_packageExtensionReject':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_staff_submitPaymentProfileChangeRequest':
        return {
          'ok': true,
          'requestId': 'PPCHG-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'status': 'SUBMITTED',
          'persisted': true,
          'note': 'Sent for approval.',
        };
      case 'api_founder_paymentProfileChangeApprove':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'note': 'demo — profile not really changed'};
      case 'api_founder_paymentProfileChangeReject':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_staff_proposeClosure':
        return {
          'ok': true,
          'closureId': 'CLOSURE-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'state': 'PROPOSED',
          'persisted': true,
          'note': 'Sent for approval. Classes stay as expected until he authorises it.',
        };
      case 'api_founder_authoriseClosure':
        return {'ok': true, 'closureId': a['closureId'] ?? '', 'changed': true, 'note': 'demo — no real classes affected'};
      case 'api_founder_closureReject':
        return {'ok': true, 'closureId': a['closureId'] ?? '', 'changed': true, 'state': 'REVOKED'};
      case 'api_founder_revokeClosure':
        return {'ok': true, 'closureId': a['closureId'] ?? '', 'changed': true, 'note': 'demo — closure revoked'};
      case 'api_staff_requestClassCorrection':
        return {
          'ok': true,
          'id': 'CCORR-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'eventId': a['eventId'] ?? '',
          'status': 'SUBMITTED',
          'note': 'Sent for approval. The class stays answered as it is until he decides.',
        };
      case 'api_founder_approveClassCorrection':
        return {'ok': true, 'id': a['correctionId'] ?? '', 'changed': true, 'note': 'demo — class re-opened'};
      case 'api_founder_rejectClassCorrection':
        return {'ok': true, 'id': a['correctionId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_staff_submitLateFeeWaiverRequest':
        return {
          'ok': true,
          'requestId': 'WAIVER-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'status': 'SUBMITTED',
          'persisted': true,
          'note': 'Sent for approval.',
        };
      case 'api_founder_lateFeeWaiverApprove':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'note': 'demo — no real waiver applied'};
      case 'api_founder_lateFeeWaiverReject':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_staff_submitInstalmentPlanDraft':
        return {
          'ok': true,
          'draftId': 'INSTDRAFT-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'status': 'SUBMITTED',
          'persisted': true,
          'note': 'Sent for approval.',
        };
      case 'api_founder_instalmentPlanDraftApprove':
        return {'ok': true, 'draftId': a['draftId'] ?? '', 'changed': true, 'planId': 'INSTPLAN-DEMO-1', 'note': 'demo — no real plan created'};
      case 'api_founder_instalmentPlanDraftReject':
        return {'ok': true, 'draftId': a['draftId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_instalmentPlanForStudent':
        return {'ok': true, 'hasPlan': false};
      case 'api_staff_generateTermsToken':
        return {
          'ok': true,
          'token': 'demotoken123',
          'path': '/terms/demotoken123',
          'url': '',
          'expiresInDays': 7,
          'note': 'DEMO — no real link generated.',
        };
      case 'api_staff_requestManualTermsAcceptance':
        return {
          'ok': true,
          'requestId': 'MTERMS-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'status': 'SUBMITTED',
          'persisted': true,
          'note': 'Sent for approval. This is an approval item, not a tick box.',
        };
      case 'api_founder_manualTermsAcceptanceApprove':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'status': 'APPROVED'};
      case 'api_founder_manualTermsAcceptanceReject':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_founder_listAuthorizedEmails':
        return {
          'ok': true,
          'rows': [
            {'email': 'latika@example.com', 'role': 'OPS_USER', 'branches': '', 'addedBy': 'demo founder', 'addedAt': '2026-09-01', 'note': ''},
          ],
        };
      case 'api_founder_addAuthorizedEmail':
        return {'ok': true, 'email': a['email'] ?? '', 'changed': true, 'note': 'demo — no real access added'};
      case 'api_founder_removeAuthorizedEmail':
        return {'ok': true, 'email': a['email'] ?? '', 'changed': true, 'note': 'demo — no real access removed'};
      case 'api_founder_listStaffTokens':
        return {
          'ok': true,
          'rows': [
            {
              'id': 'DEV-DEMO-1',
              'role': 'OPS_USER',
              'label': 'latika@example.com',
              'email': 'latika@example.com',
              'branches': '',
              'createdAt': '2026-09-01',
              'lastUsedAt': '2026-09-17',
              'revokedAt': '',
              'stale': false,
            },
            {
              'id': 'DEV-DEMO-2',
              'role': 'OPS_USER',
              'label': 'old-tablet@example.com',
              'email': 'old-tablet@example.com',
              'branches': '',
              'createdAt': '2026-05-01',
              'lastUsedAt': '2026-05-14',
              'revokedAt': '',
              'stale': true,
            },
          ],
        };
      case 'api_founder_revokeDeviceToken':
        return {'ok': true, 'id': a['id'] ?? '', 'changed': true, 'note': 'demo — no real device revoked'};
      case 'api_staff_requestAddTeacher':
        return {
          'ok': true,
          'requestId': 'TCHREQ-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'changed': true,
          'note': 'Sent for approval.',
        };
      case 'api_founder_addTeacherRequestApprove':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'status': 'APPROVED', 'teacherId': 'T-DEMO-NEW'};
      case 'api_founder_addTeacherRequestReject':
        return {'ok': true, 'requestId': a['requestId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_teacherAttendanceReport':
        return {
          'ok': true,
          'from': a['from'] ?? '2026-09-01',
          'to': a['to'] ?? '2026-09-18',
          'scheduledToday': 24,
          'unansweredToday': 2,
          'teachers': [
            {'teacherId': 'T-001', 'teacherName': 'Rahul Joshi', 'scheduled': 10, 'held': 8, 'cancelled': 1, 'substituted': 0, 'unanswered': 1},
            {'teacherId': 'T-002', 'teacherName': 'Meera Nair', 'scheduled': 8, 'held': 7, 'cancelled': 0, 'substituted': 1, 'unanswered': 0},
            {'teacherId': 'T-003', 'teacherName': 'Vikram Singh', 'scheduled': 6, 'held': 5, 'cancelled': 0, 'substituted': 0, 'unanswered': 1},
          ],
        };
      case 'api_termsStatusForStudent':
        return {
          'ok': true,
          'tokens': [
            {
              'token': 'DEMO-TERMS-TOKEN',
              'status': 'OPEN',
              'issuedAt': '2026-09-17',
              'expiresAt': '2026-10-01',
              'acceptedAt': '',
              'url': 'https://demo.swarmangal.app/terms/DEMO-TERMS-TOKEN',
            },
          ],
          'manualRequests': const [],
        };
      case 'api_closureCalendarList':
        return {
          'ok': true,
          'rows': [
            {
              'closureId': 'CLOSURE-DEMO-1',
              'scope': 'BRANCH',
              'branch': 'GOREGAON',
              'fromDate': '2026-10-02',
              'toDate': '2026-10-02',
              'reason': 'Gandhi Jayanti',
              'state': 'AUTHORISED',
              'backdated': false,
              'recordedBy': 'demo staff',
              'authorisedBy': 'demo founder',
            },
          ],
        };
      case 'api_listSchools':
        return {
          'ok': true,
          'schools': [
            {
              'schoolId': 'SCH-MHWS',
              'code': 'MHWS',
              'name': 'MHWS',
              'address': '',
              'contact': '',
              'active': true,
            },
            {
              'schoolId': 'SCH-MXVILLE',
              'code': 'MXVILLE',
              'name': 'MXVILLE',
              'address': '',
              'contact': '',
              'active': true,
            },
          ],
        };
      case 'api_addSchool':
        return {
          'ok': true,
          'schoolId': 'SCH-${(_s(a['code'])).toUpperCase()}',
          'code': (_s(a['code'])).toUpperCase(),
          'name': _s(a['name']),
          'note': 'School saved (demo mode). It uses the same invoice template.',
        };
      case 'api_updateSchool':
        return {'ok': true, 'note': 'School updated (demo mode).'};
      case 'api_listDemoStudents':
        return {
          'ok': true,
          'students': [
            {
              'studentId': 'STU-DEMO-TRIAL-1',
              'studentName': 'Aarav Demo',
              'phone': '9820011223',
              'email': '',
              'guardianName': 'Meera Demo',
              'guardianPhone': '9820011224',
              'instrument': 'Keyboard',
              'branch': 'KANDIVALI',
              'teacherId': 'TCH-1',
              'teacherName': 'Ravi Sir',
              'demoDate': '2026-10-04',
              'demoTime': '17:00',
            },
            {
              'studentId': 'STU-DEMO-TRIAL-2',
              'studentName': 'Sana Demo',
              'phone': '9820033445',
              'email': 'sana@example.com',
              'guardianName': 'Imran Demo',
              'guardianPhone': '9820033446',
              'instrument': 'Violin',
              'branch': 'GOREGAON',
              'teacherId': 'TCH-2',
              'teacherName': 'Nisha Ma\u2019am',
              'demoDate': '2026-10-05',
              'demoTime': '18:30',
            },
          ],
        };
      case 'api_addDemoStudent':
        return {
          'ok': true,
          'studentId': 'STU-DEMO-TRIAL-${(a['studentName'] ?? 'NEW').toString().toUpperCase()}',
          'studentName': a['studentName'] ?? '',
          'note': 'Demo student added (demo mode).',
        };
      case 'api_founder_convertDemoStudent':
        return {
          'ok': true,
          'studentId': a['studentId'] ?? '',
          'status': 'ACTIVE',
          'note': 'Converted to an admitted student (demo mode).',
        };
      case 'api_staff_requestReceiptCorrection':
        return {
          'ok': true,
          'id': 'RCORR-DEMO-${DateTime.now().millisecondsSinceEpoch}',
          'receiptNo': a['receiptNo'] ?? '',
          'status': 'SUBMITTED',
          'note': 'Sent for approval. The receipt stays as it is until he decides. (DEMO — not persisted)',
        };
      case 'api_founder_voidReceipt':
        return {
          'ok': true,
          'receiptNo': a['receiptNo'] ?? '',
          'changed': true,
          'status': 'VOID',
          'dueDateRestored': '',
          'note': 'demo void — nothing was actually changed',
        };
      case 'api_founder_correctionReject':
        return {'ok': true, 'id': a['correctionId'] ?? '', 'changed': true, 'status': 'REJECTED'};
      case 'api_founder_periodLocks':
        return {
          'ok': true,
          'rows': [
            {'month': '2026-08', 'label': 'August 2026', 'closedBy': 'demo@founder', 'closedAt': '2026-09-02 10:00', 'note': ''},
          ],
          'nextToClose': '',
          'nextToCloseLabel': '',
          'unansweredCount': 0,
          'unanswered': [],
          'expectedEventsFloor': '2026-10',
        };
      case 'api_founder_closeMonth':
        return {
          'ok': true,
          'month': a['month'] ?? '',
          'changed': true,
          'closedBy': 'demo@founder',
          'note': 'demo close — nothing was actually locked',
        };
      case 'api_registerPushToken':
        return (a['fcmToken'] ?? '').toString().isEmpty
            ? {'ok': false, 'code': 'TOKEN_REQUIRED', 'error': 'No push token given.'}
            : {'ok': true, 'registered': true};
      case 'api_unregisterPushToken':
        return (a['fcmToken'] ?? '').toString().isEmpty
            ? {'ok': false, 'code': 'TOKEN_REQUIRED', 'error': 'No push token given.'}
            : {'ok': true, 'unregistered': true};
      case 'api_pushStatus':
        return {'ok': true, 'enabled': false};
      case 'api_staff_attendanceRoster':
        return _attendanceRoster(a);
      case 'api_staff_inquiryQueue':
        return _inquiries();
      case 'api_staff_inquiryDetail':
        return _inquiryDetail(a);
      // write endpoints: demo returns success envelopes only
      case 'api_addStudent':
      case 'api_staff_saveStudentDraft':
        return {
          'ok': true,
          'studentId': 'STU-DEMO-${a['phone'] ?? a['name'] ?? ''}',
          'studentName': a['name'] ?? a['studentName'] ?? '',
          'duplicateWarning': {'hasDuplicates': false},
          'note': 'demo saved',
        };
      case 'api_founder_editStudent':
        return {
          'ok': true,
          'changed': true,
          'studentId': a['studentId'] ?? '',
          'note': 'Student updated (demo mode).',
        };
      case 'api_addFeePayment':
        return {
          'ok': true,
          'receiptNo': 'RCP-${9000 + (a['amount'] ?? 0)}',
          'note': 'demo receipt created',
        };
      case 'api_staff_prepareReceiptDraft':
        return {
          'ok': true,
          'draftId': 'PDRAFT-DEMO-1',
          'routine': {'selfServe': true},
          'receiptNo': 'RCP-DEMO-1',
          'persisted': true,
          'note': 'demo draft — self-serve routine lane',
        };
      case 'api_addTeacher':
        return {'ok': true, 'teacherId': 'T-DEMO', 'note': 'demo teacher added'};
      case 'api_addExpenseEntry':
        return {'ok': true, 'entryId': 'EXP-DEMO', 'note': 'demo expense recorded'};
      case 'api_staff_submitExpenseDraft':
        return {'ok': true, 'draftId': 'EDRAFT-DEMO-1', 'persisted': true, 'note': 'demo expense draft'};
      case 'api_staff_inquiryQuickAdd':
        return {'ok': true, 'inquiryId': 'INQ-DEMO-${a['phone'] ?? ''}', 'idempotent': false, 'note': 'demo inquiry captured'};
      case 'api_staff_markAttendance':
        return {'ok': true, 'action': 'CREATED', 'attendanceId': 'ATT-DEMO', 'state': a['state'], 'workDate': a['workDate']};
      case 'api_staff_feeDueList':
        return {'ok': true, 'counts': {'dueToday': 3, 'dueSoon': 2, 'paymentPending': 1}};
      default:
        return {'ok': false, 'code': 'DEMO_UNKNOWN', 'error': 'No demo fixture for $api'};
    }
  }

  Map<String, dynamic> _bootstrap() => {
        'ok': true,
        'email': 'sharvil87@gmail.com',
        'role': 'FOUNDER_ADMIN',
        'name': 'Sharvil (Demo)',
        'accounts': ['Kotak UPI', 'HDFC', 'Cash'],
        'paymentModes': ['Cash', 'UPI', 'Bank Transfer', 'Cheque'],
        'planTypes': ['Monthly', '3 Months', '6 Months', 'Yearly'],
        'classCodes': ['GMC', 'KMC'],
        'feeCycleTypes': ['Monthly', '3 Months', '6 Months', 'Yearly'],
        'advanceReminderDays': 3,
        'dueReminders': _dueReminders(),
      };

  Map<String, dynamic> _staffBoot() => {
        'ok': true,
        'app': 'STAFF_APP',
        'actor': 'STAFF_APP',
        'email': 'smmahavirnagar@gmail.com',
        'isOpsAccount': true,
        'branches': ['GOREGAON', 'KANDIVALI'],
        'note': 'Demo staff session.',
      };

  List<Map<String, dynamic>> _studentRows() => [
        {
          'studentId': 'STU-55DCD622',
          'studentName': 'Aarav Mehta',
          'phone': '9820011223',
          'email': 'aarav@example.com',
          'instrument': 'Keyboard',
          'teacher': 'Rahul Joshi',
          'classCode': 'GMC',
          'className': 'Goregaon Music Class',
          'location': 'GOREGAON',
          'batch': 'Morning',
          'feeCycleType': 'Monthly',
          'feeDueDay': '5',
          'nextDueDate': '2026-09-05',
          'feeStatus': 'OVERDUE',
          'lastReceiptNo': 'RCP-2401',
          'lastReceiptAmount': '5000',
          'status': 'ACTIVE',
        },
        {
          'studentId': 'STU-77FA91C0',
          'studentName': 'Diya Shah',
          'phone': '9820022334',
          'email': ' ',
          'instrument': 'Violin',
          'teacher': 'Meera Nair',
          'classCode': 'GMC',
          'className': 'Goregaon Music Class',
          'location': 'GOREGAON',
          'batch': 'Evening',
          'feeCycleType': '3 Months',
          'feeDueDay': '10',
          'nextDueDate': '2026-09-14',
          'feeStatus': 'DUE_SOON',
          'lastReceiptNo': 'RCP-2398',
          'lastReceiptAmount': '12000',
          'status': 'ACTIVE',
        },
        {
          'studentId': 'STU-31B84E07',
          'studentName': 'Ishaan Verma',
          'phone': '9820033445',
          'email': ' ',
          'instrument': 'Guitar',
          'teacher': 'Rahul Joshi',
          'classCode': 'KMC',
          'className': 'Kandivali Music Class',
          'location': 'KANDIVALI',
          'batch': 'Afternoon',
          'feeCycleType': 'Monthly',
          'feeDueDay': '2',
          'nextDueDate': '2026-09-02',
          'feeStatus': 'DUE_TODAY',
          'lastReceiptNo': 'RCP-2380',
          'lastReceiptAmount': '5500',
          'status': 'ACTIVE',
        },
        {
          'studentId': 'STU-A9C3D2F1',
          'studentName': 'Kaia Roy',
          'phone': '9820044556',
          'email': 'kaiaroy@example.com',
          'instrument': 'Tabla',
          'teacher': 'Vikram Singh',
          'classCode': 'GMC',
          'className': 'Goregaon Music Class',
          'location': 'GOREGAON',
          'batch': 'Morning',
          'feeCycleType': 'Monthly',
          'feeDueDay': '15',
          'nextDueDate': '2026-09-15',
          'feeStatus': 'PAID',
          'lastReceiptNo': 'RCP-2375',
          'lastReceiptAmount': '4500',
          'status': 'ACTIVE',
        },
        {
          'studentId': 'STU-5E7FAB12',
          'studentName': 'Veer Kulkarni',
          'phone': '9820055667',
          'email': ' ',
          'instrument': 'Tabla',
          'teacher': 'Vikram Singh',
          'classCode': 'GMC',
          'className': 'Goregaon Music Class',
          'location': 'GOREGAON',
          'batch': 'Evening',
          'feeCycleType': 'Monthly',
          'feeDueDay': '18',
          'nextDueDate': '2026-09-18',
          'feeStatus': 'DUE_SOON',
          'lastReceiptNo': '',
          'lastReceiptAmount': '',
          'status': 'ACTIVE',
        },
      ];

  Map<String, dynamic> _students(Map<String, dynamic> a) {
    final q = ((a['q'] ?? '') as String).toLowerCase().trim();
    var all = _studentRows();
    final cc = ((a['classCode'] ?? 'ALL') as String).toUpperCase();
    if (cc != 'ALL') {
      all = all.where((s) => (s['classCode'] as String) == cc).toList();
    }
    if (q.isNotEmpty) {
      all = all
          .where((s) => [
                s['studentName'],
                s['phone'],
                s['studentId'],
                s['instrument'],
              ].join(' ').toLowerCase().contains(q))
          .toList();
    }
    return {'ok': true, 'results': all, 'rows': all, 'count': all.length};
  }

  Map<String, dynamic> _studentProfile(Map<String, dynamic> a) {
    final id = (a['studentId'] ?? '').toString();
    final s = _studentRows().firstWhere(
        (r) => r['studentId'] == id,
        orElse: () => _studentRows().first);
    return {
      'ok': true,
      'profile': {...s, 'parentName': 'Parent of ${s['studentName']}'},
    };
  }

  Map<String, dynamic> _dashboard() => {
        'ok': true,
        'todayCollection': 27500,
        'monthCollection': 184500,
        'todayCount': 5,
        'monthCount': 41,
        'cashToday': 9500,
        'onlineToday': 18000,
        'scope': 'ALL',
        'consolidated': true,
        'approvalsCount': 5,
        'cards': _taskCards(forFounder: true),
        'metrics': {
          'dueTodayCount': 3,
          'overdueCount': 2,
          'termsPendingCount': 4,
        },
        ..._dashboardOverview(),
        'recent': _receiptRows().take(6).toList(),
      };

  /// The sections shared by the staff "Today" screen and the founder "Home"
  /// screen — one demo body for both, matching the real server's shape.
  Map<String, dynamic> _dashboardOverview() {
    final classes = (_todaysClasses({'date': '2026-09-11'})['rows'] as List).cast<Map<String, dynamic>>();
    final byTeacher = <String, Map<String, dynamic>>{};
    for (final c in classes) {
      final id = (c['teacherId'] ?? '').toString();
      if (id.isEmpty) continue;
      final row = byTeacher.putIfAbsent(id, () => {
            'teacherId': id,
            'teacherName': c['teacherName'] ?? '',
            'scheduled': 0,
            'held': 0,
            'cancelled': 0,
            'substituted': 0,
            'unanswered': 0,
          });
      row['scheduled'] = (row['scheduled'] as int) + 1;
      final outcome = (c['outcome'] ?? '').toString().toUpperCase();
      final resolved = c['resolved'] == true;
      if (!resolved) {
        row['unanswered'] = (row['unanswered'] as int) + 1;
      } else if (outcome == 'HELD') {
        row['held'] = (row['held'] as int) + 1;
      } else if (outcome == 'SUBSTITUTE_DELIVERED') {
        row['substituted'] = (row['substituted'] as int) + 1;
      } else if (outcome.contains('CANCELLED')) {
        row['cancelled'] = (row['cancelled'] as int) + 1;
      }
    }
    final activeStudents = _studentRows().where((r) => r['status'] == 'ACTIVE').toList();
    return {
      'feesDueToday': {
        'count': 3,
        'overdueCount': 2,
        'dueSoonCount': 2,
        'rows': activeStudents.take(3).map((s) => {
              'studentId': s['studentId'],
              'studentName': s['studentName'],
              'classCode': s['classCode'],
              'phone': s['phone'],
            }).toList(),
      },
      'todaysLectures': {
        'count': classes.length,
        'unanswered': classes.where((c) => c['resolved'] != true).length,
        'rows': classes,
      },
      'attendanceSummary': {
        'date': '2026-09-11',
        'totalActive': activeStudents.length,
        'marked': 3,
        'notMarked': activeStudents.length - 3,
        'present': 2,
        'absent': 1,
        'excused': 0,
        'late': 0,
      },
      'enquiries': {
        'openCount': 2,
        'callTodayCount': 1,
        'rows': [
          {'inquiryId': 'INQ-501', 'name': 'Riya Kapoor', 'phone': '9860011223'},
        ],
      },
      'teacherAttendance': {
        'scheduledToday': classes.length,
        'unansweredToday': classes.where((c) => c['resolved'] != true).length,
        'teachers': byTeacher.values.toList(),
      },
    };
  }

  Map<String, dynamic> _scheduleSession(Map<String, dynamic> a) {
    final kind = (a['customKind'] ?? '').toString().toUpperCase();
    if (!['SUBSTITUTE', 'REPLACEMENT', 'GOODWILL_RECOVERY'].contains(kind)) {
      return {'ok': false, 'code': 'CUSTOM_KIND_REQUIRED', 'error': 'Choose what this extra class is: a substitute, a replacement, or goodwill recovery.'};
    }
    if ((a['reason'] ?? '').toString().trim().isEmpty) {
      return {'ok': false, 'code': 'REASON_REQUIRED', 'error': 'Say why this extra class is being held.'};
    }
    if (kind != 'GOODWILL_RECOVERY' && (a['originalEventId'] ?? '').toString().trim().isEmpty) {
      return {'ok': false, 'code': 'ORIGINAL_EVENT_REQUIRED', 'error': 'A ${kind.toLowerCase()} must name the class it stands in for.'};
    }
    return {
      'ok': true,
      'scheduledSessionId': 'SCSS-DEMO-${DateTime.now().millisecondsSinceEpoch}',
      'status': 'SCHEDULED',
      'sessionDate': a['sessionDate'] ?? '',
      'customKind': kind,
      'payable': false,
      'note': kind == 'GOODWILL_RECOVERY'
          ? 'Goodwill class scheduled. It discharges nothing and is not payable.'
          : '${kind == 'SUBSTITUTE' ? 'Substitute' : 'Replacement'} class scheduled. Not payable unless Sharvil decides.',
    };
  }

  Map<String, dynamic> _dueReminders() => {
        'ok': true,
        'branch': 'ALL',
        'advanceDays': 3,
        'dueToday': _studentRows()
            .where((s) => s['feeStatus'] == 'DUE_TODAY')
            .map(_reminder)
            .toList(),
        'overdue': _studentRows()
            .where((s) => s['feeStatus'] == 'OVERDUE')
            .map(_reminder)
            .toList(),
        'dueSoon': _studentRows()
            .where((s) => s['feeStatus'] == 'DUE_SOON')
            .map(_reminder)
            .toList(),
        'gmcActive': 8,
        'kmcActive': 5,
      };

  Map<String, dynamic> _reminder(Map<String, dynamic> s) => {
        'studentId': s['studentId'],
        'studentName': s['studentName'],
        'phone': s['phone'],
        'classCode': s['classCode'],
        'instrument': s['instrument'],
        'nextDueDate': s['nextDueDate'],
        'feeStatus': s['feeStatus'],
        'lastReceiptNo': s['lastReceiptNo'],
      };

  List<Map<String, dynamic>> _receiptRows() => [
        {
          'receiptNo': 'RCP-2401',
          'studentId': 'STU-55DCD622',
          'date': '2026-09-05',
          'student': 'Aarav Mehta',
          'studentName': 'Aarav Mehta',
          'amount': 5000,
          'mode': 'UPI',
          'paymentMode': 'Online',
          'status': 'FINALISED',
          'entityId': 'ENT-GOREGAON',
          'pdfUrl': '',
          'excluded': false,
          'feePeriodFrom': '2026-09-05',
          'feePeriodTo': '2026-10-04',
          'txnId': 'UPI-88900123',
        },
        {
          'receiptNo': 'RCP-2400',
          'studentId': 'STU-77FA91C0',
          'date': '2026-09-04',
          'student': 'Diya Shah',
          'studentName': 'Diya Shah',
          'amount': 12000,
          'mode': 'Kotak UPI',
          'paymentMode': 'Online',
          'status': 'FINALISED',
          'entityId': 'ENT-GOREGAON',
          'pdfUrl': '',
          'excluded': false,
          'feePeriodFrom': '2026-09-04',
          'feePeriodTo': '2026-12-03',
          'txnId': 'UPI-7799',
        },
        {
          'receiptNo': 'RCP-2398',
          'studentId': 'STU-31B84E07',
          'date': '2026-09-03',
          'student': 'Ishaan Verma',
          'studentName': 'Ishaan Verma',
          'amount': 5500,
          'mode': 'Cash',
          'paymentMode': 'Cash',
          'status': 'APPROVED',
          'entityId': 'ENT-KANDIVALI',
          'pdfUrl': '',
          'excluded': false,
          'feePeriodFrom': '',
          'feePeriodTo': '',
          'txnId': '',
        },
        {
          'receiptNo': 'RCP-2395',
          'studentId': 'STU-A9C3D2F1',
          'date': '2026-09-01',
          'student': 'Kaia Roy',
          'studentName': 'Kaia Roy',
          'amount': 4500,
          'mode': 'UPI',
          'paymentMode': 'Online',
          'status': 'FINALISED',
          'entityId': 'ENT-GOREGAON',
          'pdfUrl': '',
          'excluded': false,
          'feePeriodFrom': '2026-09-01',
          'feePeriodTo': '2026-10-01',
          'txnId': 'UPI-112233',
        },
        {
          'receiptNo': 'RCP-2371',
          'date': '2026-08-28',
          'student': 'Rohit Pawar',
          'studentName': 'Rohit Pawar',
          'amount': 8800,
          'mode': 'Cheque',
          'paymentMode': 'Cheque',
          'status': 'VOID',
          'entityId': 'ENT-KANDIVALI',
          'pdfUrl': '',
          'excluded': true,
          'feePeriodFrom': '',
          'feePeriodTo': '',
          'txnId': '',
        },
      ];

  Map<String, dynamic> _receipts(Map<String, dynamic> a) {
    final q = ((a['q'] ?? a['studentName'] ?? a['receiptNo'] ?? '') as String)
        .toLowerCase()
        .trim();
    var rows = _receiptRows();
    if (q.isNotEmpty) {
      rows = rows
          .where((r) =>
              ('${r['receiptNo']} ${r['student']} ${r['txnId']}').toLowerCase().contains(q))
          .toList();
    }
    return {'ok': true, 'results': rows, 'total': rows.length};
  }

  Map<String, dynamic> _teachers() => {
        'ok': true,
        'teachers': [
          {
            'teacherId': 'T-001',
            'teacherName': 'Rahul Joshi',
            'academyShare': '40',

            'primaryRole': 'Guitar / Keyboard',
            'payoutStreams': 'ACADEMY|SCHOOL',
            'payoutModel': 'SHARE',
            'branchClassCode': 'GMC',
            'status': 'ACTIVE',
            'phone': '9833011223',
            'email': 'rahul.j@example.com',
          },
          {
            'teacherId': 'T-002',
            'teacherName': 'Meera Nair',
            'academyShare': '45',

            'primaryRole': 'Violin',
            'payoutStreams': 'ACADEMY',
            'payoutModel': 'SHARE',
            'branchClassCode': 'GMC',
            'status': 'ACTIVE',
            'phone': '9833022334',
            'email': 'meera.n@example.com',
          },
          {
            'teacherId': 'T-003',
            'teacherName': 'Vikram Singh',
            'academyShare': '50',

            'primaryRole': 'Tabla',
            'payoutStreams': 'ACADEMY',
            'payoutModel': 'SHARE',
            'branchClassCode': 'KMC',
            'status': 'ACTIVE',
            'phone': '9833033445',
            'email': 'vikram.s@example.com',
          },
          {
            'teacherId': 'T-004',
            'teacherName': 'Anita Deshpande',
            'primaryRole': 'Vocal Training',
            'payoutStreams': 'SCHOOL',
            'payoutModel': 'RETAINER',
            'branchClassCode': 'KMC',
            'status': 'INACTIVE',
            'phone': '9833044556',
            'email': '',
            'missingFields': ['email', 'payout rule'],
          },
        ],
      };

  Map<String, dynamic> _cashbook() => {
        'ok': true,
        'entries': [
          {
            'entryId': 'EXP-101',
            'date': '2026-09-05',
            'category': 'Rent',
            'description': 'Classroom rent — Goregaon',
            'amount': 15000,
            'type': 'EXPENSE',
            'mode': 'UPI',
            'approvalStatus': 'APPROVED',
            'status': 'ACTIVE',
          },
          {
            'entryId': 'EXP-102',
            'date': '2026-09-04',
            'category': 'Maintenance',
            'description': 'Instrument strings & repair',
            'amount': 2400,
            'type': 'EXPENSE',
            'mode': 'Cash',
            'approvalStatus': 'APPROVED',
            'status': 'ACTIVE',
          },
          {
            'entryId': 'EXP-103',
            'date': '2026-09-02',
            'category': 'School invoice',
            'description': 'MHWS school billed — September',
            'amount': 85000,
            'type': 'INFLOW',
            'mode': 'Bank Transfer',
            'approvalStatus': 'APPROVED',
            'status': 'ACTIVE',
          },
        ],
      };

  // Keys match the real server (src/lib/rpc/handlers2.ts buildTodoCards) so
  // the app's key-based filtering (fee-bucket taps, the staff to-do grid)
  // works identically in demo mode.
  List<Map<String, dynamic>> _taskCards({bool forFounder = false}) => [
        {
          'key': 'DELIVERY_NOT_MARKED',
          'title': 'Classes not answered',
          'label': 'Classes not answered',
          'priority': 'HIGH',
          'count': 2,
          'state': 'ATTENTION',
          'targetView': 'todayClasses',
          'emptyText': 'Every class this week is answered',
          'actionable': true,
        },
        {
          'key': 'FEES_OVERDUE',
          'title': 'Fees Overdue',
          'label': 'Fees Overdue',
          'priority': 'HIGH',
          'count': _studentRows().where((r) => r['feeStatus'] == 'OVERDUE').length,
          'state': 'ATTENTION',
          'targetView': 'students',
          'emptyText': 'Nothing overdue',
          'actionable': true,
          'bucket': 'OVERDUE',
        },
        {
          'key': 'FEES_DUE_TODAY',
          'title': 'Fees Due Today',
          'label': 'Fees Due Today',
          'priority': 'HIGH',
          'count': _studentRows().where((r) => r['feeStatus'] == 'DUE_TODAY').length,
          'state': 'ATTENTION',
          'targetView': 'students',
          'emptyText': 'No fees due today',
          'actionable': true,
          'bucket': 'DUE_TODAY',
        },
        {
          'key': 'FEES_DUE_SOON',
          'title': 'Fees Upcoming',
          'label': 'Fees Upcoming',
          'priority': 'MEDIUM',
          'count': _studentRows().where((r) => r['feeStatus'] == 'DUE_SOON').length,
          'state': 'OPEN',
          'targetView': 'students',
          'emptyText': 'Nothing upcoming',
          'actionable': true,
          'bucket': 'DUE_SOON',
        },
        {
          'key': 'PAYMENT_PENDING',
          'title': 'Payment Pending',
          'label': 'Payment Pending',
          'priority': 'HIGH',
          'count': 1,
          'state': 'ATTENTION',
          'targetView': 'students',
          'emptyText': 'No pending payments',
          'actionable': true,
        },
        {
          'key': 'CALL_TODAY',
          'title': 'Call these today',
          'label': 'Call these today',
          'priority': 'MEDIUM',
          'count': 1,
          'state': 'ATTENTION',
          'targetView': 'inquiries',
          'emptyText': 'Nobody to call today',
          'actionable': true,
        },
        {
          'key': 'FEE_PLAN_MISSING',
          'title': 'Fee plan not set',
          'label': 'Fee plan not set',
          'priority': 'LOW',
          'count': _studentRows().where((r) => (r['feeStatus'] ?? '') == '').length,
          'state': 'OPEN',
          'targetView': 'students',
          'emptyText': 'Every student has a plan',
          'actionable': true,
          'bucket': 'UNKNOWN',
        },
        {
          'key': 'TERMS_NOT_ACCEPTED',
          'title': 'Terms not accepted',
          'label': 'Terms not accepted',
          'priority': 'LOW',
          'count': 2,
          'state': 'OPEN',
          'targetView': 'students',
          'emptyText': 'Every active student has accepted terms',
          'actionable': true,
        },
        {
          'key': 'PAUSED_TOO_LONG',
          'title': 'Paused a while — review?',
          'label': 'Paused a while',
          'priority': 'LOW',
          'count': 1,
          'state': 'OPEN',
          'targetView': 'students',
          'emptyText': 'No long-paused students',
          'actionable': true,
        },
        if (!forFounder)
          {
            'key': 'WAITING_FOR_SHARVIL',
            'title': 'Waiting for Sharvil',
            'label': 'Waiting for Sharvil',
            'priority': 'LOW',
            'count': 5,
            'state': 'OPEN',
            'targetView': 'requests',
            'emptyText': 'Nothing waiting',
            'actionable': true,
          },
      ];

  Map<String, dynamic> _todaysClasses(Map<String, dynamic> a) {
    final date = _slice10(a['date'] ?? '2026-09-11');
    return {
      'ok': true,
      'date': date,
      'count': 3,
      'unanswered': 2,
      'outcomes': ['HELD', 'TEACHER_CANCELLED', 'ACADEMY_CANCELLED', 'SUBSTITUTE_DELIVERED', 'RESCHEDULED'],
      'rows': [
        {
          'eventId': 'E-2026-09-11-A',
          'classDate': date,
          'startTime': '18:00',
          'teacherId': 'T-003',
          'teacherName': 'Vikram Singh',
          'branch': 'KANDIVALI',
          'course': 'Tabla',
          'outcome': '',
          'deliveredBy': '',
          'payeeTeacherId': '',
          'entryDate': '',
          'recordedBy': '',
          'evidenceClass': '',
          'evidenceReason': '',
          'notRequired': false,
          'closureId': '',
          'closureReason': '',
          'customKind': '',
          'customReason': '',
          'resolved': false,
          'answerable': true,
        },
        {
          'eventId': 'E-2026-09-11-B',
          'classDate': date,
          'startTime': '17:00',
          'teacherId': 'T-001',
          'teacherName': 'Rahul Joshi',
          'branch': 'GOREGAON',
          'course': 'Keyboard',
          'outcome': '',
          'deliveredBy': '',
          'payeeTeacherId': '',
          'entryDate': '',
          'recordedBy': '',
          'evidenceClass': '',
          'evidenceReason': '',
          'notRequired': false,
          'closureId': '',
          'closureReason': '',
          'customKind': '',
          'customReason': '',
          'resolved': false,
          'answerable': true,
        },
        {
          'eventId': 'E-2026-09-11-C',
          'classDate': date,
          'startTime': '16:00',
          'teacherId': 'T-002',
          'teacherName': 'Meera Nair',
          'branch': 'GOREGAON',
          'course': 'Violin',
          'outcome': 'HELD',
          'deliveredBy': 'T-002',
          'payeeTeacherId': 'T-002',
          'entryDate': '2026-09-11',
          'recordedBy': 'ops@demo',
          'evidenceClass': 'VERIFIED',
          'evidenceReason': 'marked in the room',
          'notRequired': false,
          'closureId': '',
          'closureReason': '',
          'customKind': '',
          'customReason': '',
          'resolved': true,
          'answerable': false,
        },
      ],
      'lateHours': 48,
      'note': 'demo classes',
    };
  }

  Map<String, dynamic> _resolveTodaysClass(Map<String, dynamic> a) => {
        'ok': true,
        'eventId': a['eventId'],
        'outcome': a['outcome'],
        'evidenceClass': a['eventId'] == 'E-2026-09-11-A' ? 'VERIFIED' : 'REMEMBERED',
        'payeeTeacherId': a['deliveredBy'] ?? '',
        'note': 'demo resolve recorded',
      };

  Map<String, dynamic> _sessionRoster() => {
        'ok': true,
        'scheduledSessionId': 'SCSS-DEMO-1',
        'status': 'OPEN',
        'closed': false,
        'unanswered': true,
        'sessionDate': '2026-09-11',
        'sessionCredit': 1,
        'total': 3,
        'present': 0,
        'absent': 0,
        'excused': 0,
        'notMarked': 3,
        'rows': [
          {'studentId': 'STU-55DCD622', 'name': 'Aarav Mehta', 'instrument': 'Keyboard', 'state': 'NOT_MARKED'},
          {'studentId': 'STU-77FA91C0', 'name': 'Diya Shah', 'instrument': 'Violin', 'state': 'NOT_MARKED'},
        ],
        'note': 'demo roster',
      };

  Map<String, dynamic> _inquiryTransition(Map<String, dynamic> a) => {
        'ok': true,
        'inquiryId': a['inquiryId'],
        'action': a['action'],
        'after': {'status': a['action'] == 'LOG_CONTACT' ? 'CONTACTED' : a['action'] == 'SCHEDULE_TRIAL' ? 'TRIAL_SCHEDULED' : a['action']},
        'readBack': {'ok': true},
        'auditWritten': true,
        'note': 'demo inquiry moved',
      };

  Map<String, dynamic> _paymentDraftQueue() => {
        'ok': true,
        'count': 3,
        'waitingOnTermsCount': 1,
        'rows': [
          {
            'draftId': 'PDRAFT-DEMO-101',
            'status': 'SUBMITTED',
            'termsStatus': 'TERMS PENDING',
            'studentId': 'STU-55DCD622',
            'studentName': 'Aarav Mehta',
            'phoneMasked': '••••••1123',
            'branch': 'GOREGAON',
            'teacherName': 'Rahul Joshi',
            'instrument': 'Keyboard',
            'amount': '5000',
            'months': 1,
            'currentDueDate': '2026-09-05',
            'projectedNextDueDate': '2026-10-05',
            'paymentDate': '2026-09-11',
            'paymentMode': 'UPI',
            'completeness': {'complete': true, 'missing': []},
            'repairRequired': false,
            'submittedAt': '2026-09-11 10:00:00',
          },
          {
            'draftId': 'PDRAFT-DEMO-FIN-1',
            'status': 'APPROVED',
            'termsStatus': 'TERMS ACCEPTED',
            'studentId': 'STU-77FA91C0',
            'studentName': 'Diya Shah',
            'phoneMasked': '••••••2334',
            'branch': 'GOREGAON',
            'teacherName': 'Meera Nair',
            'instrument': 'Violin',
            'amount': '12000',
            'months': 3,
            'currentDueDate': '2026-09-14',
            'projectedNextDueDate': '2026-12-14',
            'paymentDate': '2026-09-10',
            'paymentMode': 'Kotak UPI',
            'completeness': {'complete': true, 'missing': []},
            'repairRequired': false,
            'approvalAuthority': 'FOUNDER',
            'approvedBy': 'sharvil@demo',
            'submittedAt': '2026-09-10 18:00:00',
          },
          {
            'draftId': 'PDRAFT-DEMO-103',
            'status': 'FINALISE_FAILED_REPAIR_REQUIRED',
            'termsStatus': 'TERMS ACCEPTED',
            'studentId': 'STU-31B84E07',
            'studentName': 'Ishaan Verma',
            'phoneMasked': '••••••3445',
            'branch': 'KANDIVALI',
            'teacherName': 'Vikram Singh',
            'instrument': 'Tabla',
            'amount': '5500',
            'months': 1,
            'currentDueDate': '2026-09-02',
            'projectedNextDueDate': '2026-10-02',
            'paymentDate': '2026-09-09',
            'paymentMode': 'Cash',
            'completeness': {'complete': false, 'missing': ['Monthly Fee']},
            'repairRequired': true,
            'submittedAt': '2026-09-09 09:30:00',
          },
        ],
        'note': 'demo payment draft queue',
      };

  Map<String, dynamic> _approvalsList() => {
        'ok': true,
        'build': 'RC2.57',
        'branch': 'CONSOLIDATED',
        'count': 5,
        'counts': {
          'total': 5, 'WAITING_ON_TERMS': 1, 'PAYMENT_DRAFT': 2, 'STUDENT_DRAFT': 1, 'SCHOOL_MASTER': 0, 'WAIVER': 1,
          'RECEIPT_CORRECTION': 1, 'SCHOOL_INVOICE_DRAFT': 1, 'UNKNOWN_STATUS': 0,
        },
        'empty': false,
        'items': _approvalItems(),
        'groups': [
          {'type': 'PAYMENT_DRAFT', 'label': 'Payment drafts', 'items': _approvalItems().where((i) => i['type'] == 'PAYMENT_DRAFT').toList()},
          {'type': 'STUDENT_DRAFT', 'label': 'Student drafts', 'items': _approvalItems().where((i) => i['type'] == 'STUDENT_DRAFT').toList()},
          {'type': 'RECEIPT_CORRECTION', 'label': 'Receipt corrections', 'items': _approvalItems().where((i) => i['type'] == 'RECEIPT_CORRECTION').toList()},
          {'type': 'SCHOOL_INVOICE_DRAFT', 'label': 'School invoices needing you', 'items': _approvalItems().where((i) => i['type'] == 'SCHOOL_INVOICE_DRAFT').toList()},
          {'type': 'WAIVER', 'label': 'Late-fee waivers', 'items': _approvalItems().where((i) => i['type'] == 'WAIVER').toList()},
        ],
        'note': 'demo approvals',
      };

  List<Map<String, dynamic>> _approvalItems() => [
        {
          'type': 'PAYMENT_DRAFT',
          'itemId': 'PDRAFT-DEMO-101',
          'entity': 'Aarav Mehta',
          'studentId': 'STU-55DCD622',
          'noStudentLinked': false,
          'paymentMode': 'UPI',
          'feesPeriod': '2026-09-05 → 2026-10-04',
          'amount': '5000',
          'branch': 'GOREGAON',
          'date': '2026-09-10',
          'reason': 'payment approval',
          'flags': {'backdated': false, 'incomplete': false, 'junk': false},
          'termsStatus': 'TERMS PENDING',
          'actions': ['details', 'approve', 'reject'],
        },
        {
          'type': 'PAYMENT_DRAFT',
          'itemId': 'PDRAFT-DEMO-102',
          'entity': 'Ishaan Verma',
          'studentId': 'STU-31B84E07',
          'noStudentLinked': false,
          'paymentMode': 'Cash',
          'feesPeriod': '2026-09-02 → 2026-10-01',
          'amount': '5500',
          'branch': 'KANDIVALI',
          'date': '2026-09-09',
          'reason': 'backdated entry',
          'flags': {'backdated': true, 'incomplete': false, 'junk': false},
          'termsStatus': 'TERMS ACCEPTED',
          'actions': ['details', 'approve', 'reject'],
        },
        {
          'type': 'STUDENT_DRAFT',
          'itemId': 'SD-DEMO-201',
          'entity': 'Rohan Pawar',
          'studentId': 'STU-DEMO-201',
          'noStudentLinked': false,
          'paymentMode': '',
          'feesPeriod': '',
          'amount': '5000',
          'branch': 'KANDIVALI',
          'date': '2026-09-08',
          'reason': 'student edit — merge into master',
          'flags': {'backdated': false, 'incomplete': false, 'junk': false},
          'termsStatus': '',
          'actions': ['details', 'merge', 'reject'],
        },
        {
          'type': 'WAIVER',
          'itemId': 'WVR-DEMO-301',
          'entity': 'Diya Shah',
          'studentId': 'STU-77FA91C0',
          'noStudentLinked': false,
          'paymentMode': '',
          'feesPeriod': '',
          'amount': '500',
          'branch': 'ENT-GOREGAON',
          'date': '2026-09-07',
          'reason': 'late-fee waiver',
          'flags': {'backdated': false, 'incomplete': false, 'junk': false},
          'termsStatus': '',
          'actions': ['details', 'approve', 'reject'],
        },
        {
          'type': 'RECEIPT_CORRECTION',
          'itemId': 'RCORR-DEMO-401',
          'entity': 'RCP-2401 · Aarav Mehta',
          'studentId': '',
          'noStudentLinked': false,
          'paymentMode': '',
          'feesPeriod': '',
          'amount': '5000',
          'branch': 'GOREGAON',
          'date': '2026-09-11',
          'reason': 'wrong amount entered',
          'flags': {'backdated': false, 'incomplete': false, 'junk': false},
          'termsStatus': '',
          'receiptNo': 'RCP-2401',
          'actions': ['details', 'void', 'reject'],
        },
        {
          'type': 'SCHOOL_INVOICE_DRAFT',
          'itemId': 'SIDRAFT-DEMO-501',
          'entity': 'Keyboard',
          'studentId': '',
          'noStudentLinked': false,
          'paymentMode': '',
          'feesPeriod': '6 Months',
          'amount': '18000',
          'branch': 'KANDIVALI',
          'date': '2026-09-12',
          'reason': 'school invoice',
          'flags': {'backdated': false, 'incomplete': false, 'junk': false},
          'termsStatus': '',
          'actions': ['details', 'finalise', 'reject'],
        },
      ];

  // Demo never reaches a gateway: "sent" messages live only in this list and
  // carry status DEMO so nobody mistakes them for a real send.
  static final List<Map<String, dynamic>> _demoMessages = [];

  Map<String, dynamic> _demoWhatsApp(String api, Map<String, dynamic> a) {
    final key = (a['clientIntentKey'] ?? '').toString();
    final existing = _demoMessages.where((m) => m['intent'] == key && key.isNotEmpty);
    if (existing.isNotEmpty) {
      return {'ok': true, 'duplicate': true, 'messageId': existing.first['messageId'], 'message': existing.first};
    }
    final now = DateTime.now().toIso8601String();
    final msg = <String, dynamic>{
      'messageId': 'WAM-DEMO-${DateTime.now().millisecondsSinceEpoch}',
      'intent': key,
      'studentId': a['studentId'] ?? '',
      'kind': a['kind'] ?? (api == 'api_staff_sendWhatsAppDocument' ? 'RECEIPT' : 'CUSTOM'),
      'status': 'DEMO',
      'to': 'demo',
      'body': a['body'] ?? a['caption'] ?? '',
      'fileName': a['fileName'] ?? '',
      'error': '',
      'createdAt': now,
      'sentAt': now,
      'deliveredAt': '',
      'readAt': '',
    };
    _demoMessages.insert(0, msg);
    return {'ok': true, 'messageId': msg['messageId'], 'message': msg};
  }

  Map<String, dynamic> _commGenerate(Map<String, dynamic> a) {
    final id = (a['studentId'] ?? '').toString();
    final st = _studentRows().firstWhere((r) => r['studentId'] == id, orElse: () => _studentRows().first);
    final name = st['studentName'];
    final phone = (st['phone'] ?? '').toString();
    return {
      'ok': true,
      'type': 'FEE_REMINDER',
      'subject': 'Fees due — Swar Mangal',
      'body': 'Namaste, reminder that $name\'s fees are due on ${st['nextDueDate']}. '
          'Please pay via the link shared. — Swar Mangal Music Academy',
      'recipientName': 'Parent of $name',
      'recipientType': 'parent',
      'typeRequested': 'FEE_REMINDER',
      'typeResolved': 'FEE_REMINDER',
      'typeCorrected': false,
      'typeNote': '',
      'warnings': [],
      'kind': 'FEE_REMINDER',
      'recipientPhone': phone.length == 10 ? '${phone.substring(0, 2)}••••${phone.substring(6)}' : '',
      'mode': 'WHATSAPP',
      'providerSend': 'DISABLED',
      'termsLink': '',
      'termsTokenId': '',
      'termsTokenMinted': false,
      'termsAuditIncomplete': false,
    };
  }

  Map<String, dynamic> _attendanceRoster(Map<String, dynamic> a) {
    final inst = ((a['instrument'] ?? '') as String).trim();
    final all = _studentRows().where((s) => s['status'] == 'ACTIVE').toList();
    final rows = inst.isEmpty ? all : all.where((s) => s['instrument'] == inst).toList();
    return {
      'ok': true,
      'date': a['date'] ?? '2026-09-11',
      'branch': branch,
      'count': rows.length,
      'instruments': ['Keyboard', 'Violin', 'Guitar', 'Tabla'],
      'students': rows
          .asMap()
          .entries
          .map((e) => {
                'studentId': e.value['studentId'],
                'name': e.value['studentName'],
                'instrument': e.value['instrument'],
                'teacherId': 'T-001',
                'teacherName': e.value['teacher'],
                'phone': e.value['phone'],
                'expectedToday': true,
                // A couple of rows already marked, so the badge and the
                // "already marked" button state are visible in demo mode too.
                'state': e.key == 0 ? 'PRESENT' : (e.key == 1 ? 'ABSENT' : 'NOT_MARKED'),
              })
          .toList(),
    };
  }

  // Real statuses only (OPEN/CONTACTED/DORMANT/TRIAL_SCHEDULED/TRIAL_DONE/
  // DROPPED/CONVERTED) — the server never sends NEW/FOLLOW_UP, and a demo
  // fixture using those hid a real bug in Inquiry.actionable for a while.
  Map<String, dynamic> _inquiries() => {
        'ok': true,
        'rows': [
          {
            'inquiry_id': 'INQ-501',
            'name': 'Riya Kapoor',
            'phone': '9860011223',
            'instrument': 'Guitar',
            'branch': 'GOREGAON',
            'source': 'Walk-in',
            'status': 'OPEN',
            'finalStatus': 'PENDING',
            'dormantReason': '',
            'next_contact_date': '2026-09-11',
            'created_at': '2026-09-10',
          },
          {
            'inquiry_id': 'INQ-500',
            'name': 'Aryan Shetty',
            'phone': '9860022334',
            'instrument': 'Keyboard',
            'branch': 'GOREGAON',
            'source': 'Referral',
            'status': 'CONTACTED',
            'finalStatus': 'PENDING',
            'dormantReason': '',
            'next_contact_date': '2026-09-12',
            'created_at': '2026-09-09',
          },
          {
            'inquiry_id': 'INQ-498',
            'name': 'Sana Iyer',
            'phone': '9860033445',
            'instrument': 'Violin',
            'branch': 'KANDIVALI',
            'source': 'Online/Social',
            'status': 'DROPPED',
            'finalStatus': 'REJECTED',
            'dormantReason': '',
            'next_contact_date': '',
            'created_at': '2026-09-06',
          },
          {
            'inquiry_id': 'INQ-497',
            'name': 'Karan Mehta',
            'phone': '9860044556',
            'instrument': '', // no instrument preference — a "random" general inquiry
            'branch': 'GOREGAON',
            'source': 'Walk-in',
            'status': 'OPEN',
            'finalStatus': 'PENDING',
            'dormantReason': '',
            'next_contact_date': '2026-09-13',
            'created_at': '2026-09-08',
          },
          {
            'inquiry_id': 'INQ-495',
            'name': 'Priya Nair',
            'phone': '9860055667',
            'instrument': 'Guitar',
            'branch': 'KANDIVALI',
            'source': 'Former Student',
            'status': 'OPEN',
            'finalStatus': 'PENDING',
            'dormantReason': '',
            'next_contact_date': '2026-09-14',
            'created_at': '2026-09-05',
          },
          {
            'inquiry_id': 'INQ-490',
            'name': 'Rahul Deshmukh',
            'phone': '9860066778',
            'instrument': 'Tabla',
            'branch': 'GOREGAON',
            'source': 'Walk-in',
            'status': 'DORMANT',
            'finalStatus': 'PENDING',
            'dormantReason': 'TIMEOUT',
            'next_contact_date': '',
            'created_at': '2026-08-01',
          },
        ],
      };

  Map<String, dynamic> _inquiryDetail(Map<String, dynamic> a) {
    final id = (a['inquiryId'] ?? 'INQ-501').toString();
    final byId = {
      for (final r in (_inquiries()['rows'] as List).cast<Map<String, dynamic>>()) r['inquiry_id']: r,
    };
    final row = byId[id] ?? byId['INQ-501']!;
    return {
      'ok': true,
      'inquiryId': id,
      'name': row['name'],
      'phone': row['phone'],
      'course': row['instrument'],
      'branch': row['branch'],
      'source': row['source'] ?? 'Walk-in',
      'notes': '',
      'status': row['status'],
      'finalStatus': row['finalStatus'],
      'createdAt': row['created_at'],
      'nextContactDate': row['next_contact_date'],
      'trialDate': '',
      'dropReason': row['status'] == 'DROPPED' ? 'Chose a different academy' : '',
      'convertedStudentId': '',
      'noAnswerCount': 0,
      'lastContactedAt': '',
      'dormantReason': row['dormantReason'] ?? '',
      'formerStudentId': row['source'] == 'Former Student' ? 'S-DEMO-1' : '',
      'followups': [
        {
          'id': 'FOLLOWUP-DEMO-1',
          'action': 'LOG_CONTACT',
          'description': 'Spoke to the parent; interested but comparing fees with another academy.',
          'resultingStatus': row['status'],
          'nextContactDate': row['next_contact_date'],
          'createdBy': 'demo staff',
          'createdAt': '2026-09-10T11:00:00',
        },
      ],
    };
  }

  Map<String, dynamic> _staffStudentHub(Map<String, dynamic> a) {
    final sid = _s(a['studentId'] ?? '');
    final all = _studentRows();
    final s = sid.isEmpty ? all.first : (all.where((r) => r['studentId'] == sid).isNotEmpty ? all.firstWhere((r) => r['studentId'] == sid) : all.first);
    // Scoped to this exact student, same guarantee as _studentProfileDetail.
    final myReceipts = _receiptRows().where((r) => r['studentId'] == s['studentId']).toList();
    return {
      'ok': true,
      'profile': {
        ...s,
        'parentName': 'Parent of ${s['studentName']}',
        'fee': '${s['lastReceiptAmount'] ?? 5000}',
        'dueDate': s['nextDueDate'],
      },
      'fees': {
        'available': true,
        'total': myReceipts.fold<num>(0, (a, r) => a + (r['amount'] as num? ?? 0)),
        'capped': false,
        'rows': myReceipts,
      },
      'pending': {
        'available': true,
        'rows': [
          {
            'draftId': 'PDRAFT-DEMO-FIN-1',
            'amount': '${s['lastReceiptAmount'] ?? 5000}',
            'paymentDate': '2026-09-10',
            'approvalAuthority': 'FOUNDER',
            'approvedBy': 'sharvil@demo',
            'founderDecision': true,
            'label': 'Approved by sharvil@demo',
            'repairRequired': false,
            'status': 'APPROVED',
            'canFinalise': true,
            'blockedReason': '',
          },
        ],
      },
      'terms': {'found': false, 'link': '', 'status': '', 'label': 'No terms link yet', 'note': ''},
      'note': 'demo hub',
    };
  }

  String _s(dynamic v) => v == null ? '' : v.toString();

  Map<String, dynamic> _teacherProfile(Map<String, dynamic> a) {
    final tid = _s(a['teacherId'] ?? 'T-001');
    final allT = (_teachers()['teachers'] as List).cast<Map<String, dynamic>>();
    Map<String, dynamic> t = allT.first;
    for (final x in allT) {
      if (x['teacherId'] == tid) {
        t = x;
        break;
      }
    }
    final students = _studentRows()
        .where((s) => s['teacher'] == t['teacherName'])
        .map((e) => Map<String, dynamic>.from(e))
        .toList();
    if (students.isEmpty) {
      students
        ..add(Map<String, dynamic>.from(_studentRows()[0]))
        ..add(Map<String, dynamic>.from(_studentRows()[1]));
    }
    return {
      'ok': true,
      'teacher': {
        ...t,
        'teacherId': t['teacherId'],
        'teacherName': t['teacherName'],
        'primaryRole': t['primaryRole'],
        'academyShare': t['academyShare'] ?? '40',
        'compensationPercent': t['academyShare'] ?? '40',
        'compensationEffectiveFrom': '2026-07-01',
      },
      'students': students,
      'receiptCountThisMonth': 4,
    };
  }

  Map<String, dynamic> _studentProfileDetail(Map<String, dynamic> a) {
    final sid = _s(a['studentId'] ?? '');
    final rows = _studentRows();
    final s = sid.isEmpty
        ? rows.first
        : rows.where((r) => r['studentId'] == sid).isNotEmpty
            ? rows.firstWhere((r) => r['studentId'] == sid)
            : rows.first;
    // Scoped to this exact student — matches the real backend's
    // student_id-only lookup, never a fuzzy name search.
    final myReceipts = _receiptRows().where((r) => r['studentId'] == s['studentId']).toList();
    return {
      'ok': true,
      'student': {
        ...s,
        'teacherId': s['teacherId'] ?? 'T-001',
        'teacherName': s['teacher'],
        'branch': s['location'],
      },
      'teacher': {'teacherId': s['teacherId'] ?? 'T-001', 'teacherName': s['teacher']},
      'receipts': myReceipts,
      'attendance': [],
    };
  }

  Map<String, dynamic> _schoolInvoice(Map<String, dynamic> a) {
    final no = 'INV-DEMO-${98000 + (a['amount'] as num).toInt()}';
    final id = 'SINV-DEMO-${DateTime.now().microsecondsSinceEpoch}';
    final billingMonth = _s(a['billingMonth'] ?? '');
    final bounds = _billingMonthBounds(billingMonth);
    // Keep it in the shared store so api_listSchoolInvoices shows it.
    _invoices.insert(0, {
      'invoiceNo': no,
      'invoiceDate': a['invoiceDate'] ?? '2026-09-12',
      'tenure': a['tenure'] ?? '6 Months',
      'amount': a['amount'] ?? 0,
      'invoiceId': id,
      'className': a['className'] ?? '',
      'branch': a['branch'] ?? 'KANDIVALI',
    });
    return {
      'ok': true,
      'invoiceId': id,
      'invoiceNo': no,
      'invoiceDate': a['invoiceDate'] ?? '2026-09-12',
      'billingPeriodFrom': bounds.$1,
      'billingPeriodTo': bounds.$2,
      'branch': a['branch'] ?? 'KANDIVALI',
      'schoolAddress': a['schoolAddress'] ?? '',
      'className': a['className'] ?? '',
      'amount': a['amount'] ?? 0,
      'tenure': a['tenure'] ?? '6 Months',
      'owner1': {'name': 'Sharvil Vaidya', 'id': 'OWNER-1', 'signatureUrl': '', 'title': 'Owner 1'},
      'owner2': {'name': 'Piyush Kashyap', 'id': 'OWNER-2', 'signatureUrl': '', 'title': 'Owner 2'},
      'pdfUrl': '',
    };
  }

  /// First/last day of a "YYYY-MM" billing month — mirrors the real
  /// backend's billingMonthRange (src/lib/rpc/numbering.ts).
  static (String, String) _billingMonthBounds(String billingMonth) {
    final m = RegExp(r'^(\d{4})-(\d{2})$').firstMatch(billingMonth);
    if (m == null) return ('', '');
    final year = int.parse(m.group(1)!);
    final month = int.parse(m.group(2)!);
    final from = '$year-${month.toString().padLeft(2, '0')}-01';
    final lastDay = DateTime(year, month + 1, 0).day;
    final to = '$year-${month.toString().padLeft(2, '0')}-${lastDay.toString().padLeft(2, '0')}';
    return (from, to);
  }

  Map<String, dynamic> _schoolInvoicesList(Map<String, dynamic> a) {
    return {
      'ok': true,
      'invoices': _invoices.map((e) => Map<String, dynamic>.from(e)).toList(),
    };
  }

  Map<String, dynamic> _schoolInvoiceDetail(Map<String, dynamic> a) {
    final idIn = _s(a['invoiceId'] ?? '');
    final map = _schoolInvoice({'amount': 18000, 'tenure': '6 Months', 'invoiceDate': '2026-09-12', 'className': 'Keyboard', 'branch': 'KANDIVALI'});
    map['invoiceId'] = idIn == 'SINV-DEMO-2' ? 'SINV-DEMO-2' : 'SINV-DEMO-1';
    map['invoiceNo'] = idIn == 'SINV-DEMO-2' ? 'INV-DEMO-97887' : 'INV-DEMO-98000';
    if (idIn == 'SINV-DEMO-2') {
      map['amount'] = 9000;
      map['tenure'] = '3 Months';
      map['invoiceDate'] = '2026-06-10';
      map['className'] = 'Flute';
    }
    return {'ok': true, 'invoice': map};
  }

  Map<String, dynamic> _timetableList(Map<String, dynamic> a) {
    final branch = (_s(a['branch'] ?? '') ).toUpperCase();
    final rows = _tt.where((e) => branch.isEmpty || branch == 'ALL' || e.branch == branch).toList();
    return {
      'ok': true,
      'entries': rows.map((e) => e.toWrite()).toList(),
      'seeded': true,
      'note': 'demo timetable. Seeded once; founder edits persist for this session.',
    };
  }

  Map<String, dynamic> _timetableCreate(Map<String, dynamic> a) {
    final e = TimetableEntry(
      id: 'TT-DEMO-${DateTime.now().microsecondsSinceEpoch}',
      branch: (_s(a['branch'] ?? 'KANDIVALI')).toUpperCase(),
      dayOfWeek: (a['dayOfWeek'] as num?)?.toInt() ?? 0,
      startTime: _s(a['startTime']),
      endTime: _s(a['endTime']),
      className: _s(a['className']),
      teacherId: _s(a['teacherId']),
      teacherName: _s(a['teacherName']),
      status: _s(a['status']).isEmpty ? 'ENABLED' : _s(a['status']).toUpperCase(),
      substituteTeacherId: _s(a['substituteTeacherId']),
      substituteTeacherName: _s(a['substituteTeacherName']),
      instrument: _s(a['instrument']),
    );
    _tt.add(e);
    return {'ok': true, 'entry': e.toWrite(), 'note': 'demo timetable entry added'};
  }

  Map<String, dynamic> _timetableUpdate(Map<String, dynamic> a) {
    // Conflict detection: mutable admin records carry expectedVersion. If it
    // no longer matches the timetable revision, refuse rather than overwrite
    // another user's change. Demo simulates the held backend contract.
    final expected = a['expectedVersion'];
    if (expected != null && (expected as num).toInt() != revisions['timetable']) {
      return {
        'ok': false,
        'code': 'CONFLICT',
        'error': 'This item was changed by another user. Reload the latest version before saving.',
      };
    }
    final id = _s(a['id']);
    final idx = _tt.indexWhere((e) => e.id == id);
    if (idx < 0) return {'ok': false, 'code': 'TT_ENTRY_NOT_FOUND', 'error': 'Entry not found.'};
    final cur = _tt[idx];
    final next = TimetableEntry(
      id: cur.id,
      branch: _s(a['branch'] ?? cur.branch).toUpperCase(),
      dayOfWeek: (a['dayOfWeek'] as num?)?.toInt() ?? cur.dayOfWeek,
      startTime: _s(a['startTime']).isEmpty ? cur.startTime : _s(a['startTime']),
      endTime: _s(a['endTime']).isEmpty ? cur.endTime : _s(a['endTime']),
      className: _s(a['className']).isEmpty ? cur.className : _s(a['className']),
      teacherId: _s(a['teacherId']),
      teacherName: _s(a['teacherName']),
      status: _s(a['status']).isEmpty ? cur.status : _s(a['status']).toUpperCase(),
      instrument: _s(a['instrument']).isEmpty ? cur.instrument : _s(a['instrument']),
    );
    _tt[idx] = next;
    return {'ok': true, 'entry': next.toWrite(), 'note': 'demo timetable entry updated'};
  }

  Map<String, dynamic> _timetableDelete(Map<String, dynamic> a) {
    final id = _s(a['id']);
    final before = _tt.length;
    _tt.removeWhere((e) => e.id == id);
    return {
      'ok': true,
      'deleted': before != _tt.length,
      'note': 'demo timetable entry deleted',
    };
  }

  Map<String, dynamic> _addInstrument(Map<String, dynamic> a) {
    final name = _s(a['name']).trim();
    if (name.isEmpty) return {'ok': false, 'code': 'NO_NAME', 'error': 'Instrument name required'};
    if (!_instruments.any((n) => n.toLowerCase() == name.toLowerCase())) {
      _instruments.add(name);
      _instruments.sort();
    }
    return {
      'ok': true,
      'instrument': {'id': 'INS-DEMO-$name', 'name': name},
    };
  }

  Map<String, dynamic> _listFeeRateCard(Map<String, dynamic> a) {
    final includeInactive = a['includeInactive'] == true || _s(a['includeInactive']).toLowerCase() == 'true';
    final rows = includeInactive ? _feeRateCard : _feeRateCard.where((r) => r['active'] != false).toList();
    final sorted = [...rows]
      ..sort((x, y) {
        final byInstrument = _s(x['instrument']).compareTo(_s(y['instrument']));
        return byInstrument != 0 ? byInstrument : _s(x['name']).compareTo(_s(y['name']));
      });
    return {'ok': true, 'rows': sorted};
  }

  Map<String, dynamic> _upsertFeeRateCard(Map<String, dynamic> a) {
    final instrument = _s(a['instrument']).trim();
    final name = _s(a['name']).trim();
    final feeAmount = a['feeAmount'] is num ? a['feeAmount'] as num : num.tryParse(_s(a['feeAmount'])) ?? 0;
    if (instrument.isEmpty) return {'ok': false, 'code': 'INSTRUMENT_REQUIRED', 'error': 'Choose an instrument.'};
    if (name.isEmpty) return {'ok': false, 'code': 'NAME_REQUIRED', 'error': 'Give this rate card row a name (e.g. Standard, 1-on-1).'};
    if (!(feeAmount > 0)) return {'ok': false, 'code': 'FEE_REQUIRED', 'error': 'Enter a fee amount greater than zero.'};

    final id = _s(a['id']).trim();
    final billingPeriod = _s(a['billingPeriod']).trim().isEmpty ? 'Monthly' : _s(a['billingPeriod']).trim();
    final notes = _s(a['notes']).trim();
    final now = DateTime.now().toIso8601String();

    if (id.isNotEmpty) {
      final idx = _feeRateCard.indexWhere((r) => r['id'] == id);
      if (idx < 0) return {'ok': false, 'code': 'NOT_FOUND', 'error': 'No rate card row $id'};
      _feeRateCard[idx] = {
        ..._feeRateCard[idx],
        'instrument': instrument, 'name': name, 'feeAmount': feeAmount,
        'billingPeriod': billingPeriod, 'notes': notes,
        'updatedBy': 'demo', 'updatedAt': now,
      };
      return {'ok': true, 'row': _feeRateCard[idx], 'note': 'updated'};
    }

    final row = {
      'id': 'FRC-DEMO-${DateTime.now().microsecondsSinceEpoch}',
      'instrument': instrument, 'name': name, 'feeAmount': feeAmount,
      'billingPeriod': billingPeriod, 'notes': notes, 'active': true,
      'createdBy': 'demo', 'createdAt': now, 'updatedBy': '', 'updatedAt': '',
    };
    _feeRateCard.add(row);
    return {'ok': true, 'row': row, 'note': 'created'};
  }

  Map<String, dynamic> _deactivateFeeRateCard(Map<String, dynamic> a) {
    final id = _s(a['id']).trim();
    if (id.isEmpty) return {'ok': false, 'code': 'ID_REQUIRED', 'error': 'Choose the rate card row to remove.'};
    final idx = _feeRateCard.indexWhere((r) => r['id'] == id);
    if (idx < 0) return {'ok': false, 'code': 'NOT_FOUND', 'error': 'No rate card row $id'};
    _feeRateCard[idx] = {..._feeRateCard[idx], 'active': false, 'updatedBy': 'demo', 'updatedAt': DateTime.now().toIso8601String()};
    return {'ok': true, 'row': _feeRateCard[idx], 'note': 'deactivated'};
  }

  Map<String, dynamic> _syncChanges(Map<String, dynamic> a) {
    final known = a['knownRevisions'] is Map
        ? (a['knownRevisions'] as Map).map<String, int>((k, v) => MapEntry<String, int>('$k', (v as num).toInt()))
        : <String, int>{};
    final changes = <Map<String, dynamic>>[];
    revisions.forEach((entity, ver) {
      if (known[entity] != ver) {
        changes.add({'entity': entity.toUpperCase(), 'operation': 'UPDATED', 'id': ''});
      }
    });
    return {
      'ok': true,
      'revisions': Map<String, int>.from(revisions),
      'changes': changes,
    };
  }

  Map<String, dynamic> _todaysTasks() => {
        'ok': true,
        'cards': _taskCards(),
        'mode': 'COPY_ONLY',
        'today': '2026-09-11',
        ..._dashboardOverview(),
      };

  /// G: DRAFT->CALCULATED->FOUNDER_APPROVED->PAID, mirrors
  /// api_founder_generatePayoutStatement — re-running before approval just
  /// refreshes the calculated figure; an already-decided statement refuses
  /// (ALREADY_DECIDED) but still names its id/status, exactly like the real
  /// RPC, so ApiService.founderGeneratePayoutStatement's recovery path is
  /// exercised in demo mode too.
  Map<String, dynamic> _generatePayoutStatement(Map<String, dynamic> a) {
    final teacherId = (a['teacherId'] ?? '').toString();
    final month = (a['month'] ?? a['serviceMonth'] ?? '').toString();
    final key = '$teacherId|$month';
    final existing = _statements[key];
    if (existing != null && (existing['status'] == 'FOUNDER_APPROVED' || existing['status'] == 'PAID')) {
      return {
        'ok': false,
        'code': 'ALREADY_DECIDED',
        'error': 'This statement is already ${existing['status']}. Generating again would silently change a decided figure.',
        'statementId': existing['statementId'],
        'status': existing['status'],
      };
    }
    final id = (existing?['statementId'] as String?) ?? 'PSTMT-DEMO-${DateTime.now().millisecondsSinceEpoch}';
    const amount = 7500;
    _statements[key] = {'statementId': id, 'status': 'CALCULATED', 'calculatedAmount': amount};
    return {
      'ok': true,
      'statementId': id,
      'teacherId': teacherId,
      'month': month,
      'status': 'CALCULATED',
      'calculatedAmount': amount,
      'note': 'Calculated from the live preview. Not payable until Sharvil approves it.',
    };
  }

  /// H: approves a CALCULATED demo statement, mirroring
  /// api_founder_approvePayoutStatement's idempotent-when-already-decided
  /// behaviour.
  Map<String, dynamic> _approvePayoutStatement(Map<String, dynamic> a) {
    final id = (a['statementId'] ?? '').toString();
    MapEntry<String, Map<String, dynamic>>? found;
    for (final e in _statements.entries) {
      if (e.value['statementId'] == id) {
        found = e;
        break;
      }
    }
    if (found == null) return {'ok': false, 'code': 'NOT_FOUND', 'error': 'No payout statement $id'};
    final entry = found.value;
    if (entry['status'] == 'FOUNDER_APPROVED' || entry['status'] == 'PAID') {
      return {'ok': true, 'statementId': id, 'changed': false, 'idempotent': true, 'status': entry['status']};
    }
    entry['status'] = 'FOUNDER_APPROVED';
    entry['approvedAmount'] = entry['calculatedAmount'];
    return {
      'ok': true,
      'statementId': id,
      'changed': true,
      'status': 'FOUNDER_APPROVED',
      'approvedAmount': entry['approvedAmount'],
      'note': 'Approved. recordTeacherPayout can now be used for this teacher/month.',
    };
  }

  Map<String, dynamic> _payoutPreview(Map<String, dynamic> a) => {
        'ok': true,
        'results': [
          {
            'teacherId': 'T-001',
            'teacherName': 'Rahul Joshi',
            'academyShare': '40',

            'month': a['month'] ?? '2026-09',
            'entityId': 'ENT-GOREGAON',
            'receiptCount': 4,
            'totalCollection': 22000,
            'totalTeacherShare': 11000,
            'payable': 11000,
            'alreadyPaid': 5000,
            'balance': 6000,
            'status': 'PARTIAL',
            'preCutover': false,
            'note': '',
            'outcomeFlags': {
              'SCHOOL_HOLIDAY': {'count': 1, 'configuredPercent': 50},
              'STUDENT_ABSENT': {'count': 2, 'configuredPercent': 100},
            },
          },
          {
            'teacherId': 'T-002',
            'teacherName': 'Meera Nair',
            'academyShare': '45',

            'month': a['month'] ?? '2026-09',
            'entityId': 'ENT-GOREGAON',
            'receiptCount': 3,
            'totalCollection': 15000,
            'totalTeacherShare': 7500,
            'payable': 7500,
            'alreadyPaid': 0,
            'balance': 7500,
            'status': 'UNPAID',
            'preCutover': false,
            'note': '',
          },
          {
            'teacherId': 'T-003',
            'teacherName': 'Vikram Singh',
            'academyShare': '50',

            'month': '2026-08',
            'entityId': 'ENT-KANDIVALI',
            'receiptCount': 5,
            'totalCollection': 32000,
            'totalTeacherShare': 16000,
            'payable': 16000,
            'alreadyPaid': 16000,
            'balance': 0,
            'status': 'PAID',
            'preCutover': true,
            'note': 'Pre-cutover manual settlement — balance forced to zero.',
          },
          {
            'teacherId': 'T-004',
            'teacherName': 'Sana Qureshi',
            'month': a['month'] ?? '2026-09',
            'entityId': 'ENT-KANDIVALI',
            'receiptCount': 0,
            'payable': null,
            'alreadyPaid': 0,
            'status': 'NOT_PRICED',
            'preCutover': false,
            'note': '',
            'reasons': [
              {'code': 'RATE_RULE_MISSING', 'message': 'No payout rule is set for this teacher.'}
            ],
          },
        ],
        'byEntity': {
          'ENT-GOREGAON': {'payable': 18500, 'paid': 5000, 'balance': 13500},
          'ENT-KANDIVALI': {'payable': 16000, 'paid': 16000, 'balance': 0},
        },
        'earningBaseDefined': true,
        'note': 'demo payout preview',
      };

  Map<String, dynamic> _staffMyRequests() => {
        'ok': true,
        'branch': 'GOREGAON',
        'count': 3,
        'rows': [
          {
            'type': 'PAYMENT_DRAFT',
            'id': 'PDRAFT-101',
            'status': 'SUBMITTED',
            'student': 'STU-55DCD622',
            'category': '',
            'amount': '5000',
            'when': '2026-09-11 10:00:00',
            'backdated': false,
          },
          {
            'type': 'EXPENSE_DRAFT',
            'id': 'EDRAFT-201',
            'status': 'SUBMITTED',
            'student': '',
            'category': 'Rent',
            'amount': '15000',
            'when': '2026-09-10 14:00:00',
            'backdated': false,
          },
          {
            'type': 'PAYMENT_DRAFT',
            'id': 'PDRAFT-103',
            'status': 'BACKDATED_APPROVAL_REQUIRED',
            'student': 'STU-31B84E07',
            'category': '',
            'amount': '5500',
            'when': '2026-09-09 09:30:00',
            'backdated': true,
          },
        ],
        'canApprove': false,
        'note': 'demo my requests',
      };
}