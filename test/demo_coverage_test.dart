import 'package:flutter_test/flutter_test.dart';

import 'package:swar_mangal/models/models.dart';
import 'package:swar_mangal/services/demo_api.dart';
import 'package:swar_mangal/core/api.dart';

/// Contract-coverage suite over the full DemoApiClient surface.
/// Every read the screens use must return `ok:true` plus the key the screen
/// relies on (catch 'rows vs results' style drift); every model must parse
/// the fixture it receives.
Map<String, dynamic> asMap(dynamic v) => v as Map<String, dynamic>;

void main() {
  group('DemoApiClient — full read surface resolves true (ok + shape)', () {
    late DemoApiClient d;

    setUp(() => d = DemoApiClient());

    Future<Map<String, dynamic>> call(String api, [Map<String, dynamic>? arg]) async =>
        asMap(await d.call(api, arg ?? const {}));

    test('api_bootstrap — role, paymentModes, classCodes', () async {
      final b = await call('api_bootstrap');
      expect(b['ok'], true);
      expect(b['role'], 'FOUNDER_ADMIN');
      expect(b['paymentModes'], isNotEmpty);
      expect(b['classCodes'], contains('GMC'));
    });

    test('api_staff_boot — branches + isOpsAccount', () async {
      final b = await call('api_staff_boot');
      expect(b['ok'], true);
      expect(b['isOpsAccount'], true);
      expect(b['branches'], containsAll(['GOREGAON', 'KANDIVALI']));
    });

    test('api_instalmentPlanForStudent — hasPlan', () async {
      final b = await call('api_instalmentPlanForStudent', {'studentId': 'S1'});
      expect(b['ok'], true);
      expect(b['hasPlan'], isNotNull);
    });

    test('api_termsStatusForStudent — tokens + manualRequests', () async {
      final b = await call('api_termsStatusForStudent', {'studentId': 'S1'});
      expect(b['ok'], true);
      expect(b['tokens'], isA<List>());
      expect(b['manualRequests'], isA<List>());
    });

    test('api_founder_listAuthorizedEmails — rows', () async {
      final b = await call('api_founder_listAuthorizedEmails');
      expect(b['ok'], true);
      expect(b['rows'], isNotEmpty);
    });

    test('api_founder_listStaffTokens — rows', () async {
      final b = await call('api_founder_listStaffTokens');
      expect(b['ok'], true);
      expect(b['rows'], isNotEmpty);
    });

    test('api_closureCalendarList — rows', () async {
      final b = await call('api_closureCalendarList');
      expect(b['ok'], true);
      expect(b['rows'], isNotEmpty);
    });

    test('api_searchStudent — results', () async {
      final b = await call('api_searchStudent', {'q': '', 'includeAll': true});
      expect(b['ok'], true);
      expect(b['results'], isA<List>());
      expect(b['results'], isNotEmpty);
    });

    test('api_searchReceipt — results', () async {
      final b = await call('api_searchReceipt', const {});
      expect(b['results'], isNotEmpty);
    });

    test('api_listTeachers — teachers', () async {
      final b = await call('api_listTeachers');
      expect(b['teachers'], isNotEmpty);
    });

    test('api_dashboard — todayCollection + metrics', () async {
      final b = await call('api_dashboard', {'scope': ''});
      expect(b['ok'], true);
      expect(b['todayCollection'], isA<num>());
      expect(b['metrics'], isA<Map>());
      expect(b['recent'], isA<List>());
    });

    test('api_dueReminders — three buckets', () async {
      final b = await call('api_dueReminders', {'branch': 'ALL'});
      expect(b['dueSoon'], isA<List>());
      expect(b['dueToday'], isA<List>());
      expect(b['overdue'], isA<List>());
    });

    test('api_cashbookReport — entries', () async {
      final b = await call('api_cashbookReport', const {});
      expect(b['entries'], isNotEmpty);
    });

    test('api_staff_todaysTasks — cards', () async {
      final b = await call('api_staff_todaysTasks', {'branch': 'GOREGAON'});
      expect(b['cards'], isNotEmpty);
    });

    test('api_staff_todaysClasses — rows + outcomes', () async {
      final b = await call('api_staff_todaysClasses', {'branch': 'GOREGAON', 'date': '2026-09-11'});
      expect(b['rows'], isNotEmpty);
      expect(b['outcomes'], contains('HELD'));
    });

    test('api_staff_attendanceRoster — students + instruments', () async {
      final b = await call('api_staff_attendanceRoster', {'branch': 'GOREGAON', 'date': '2026-09-11'});
      expect(b['students'], isNotEmpty);
      expect(b['instruments'], isNotEmpty);
    });

    test('api_staff_inquiryQueue — rows', () async {
      final b = await call('api_staff_inquiryQueue', {'branch': 'GOREGAON'});
      expect(b['rows'], isNotEmpty);
    });

    test('api_staff_inquiryDetail — followups', () async {
      final b = await call('api_staff_inquiryDetail', {'inquiryId': 'INQ-501'});
      expect(b['ok'], true);
      expect(b['followups'], isNotEmpty);
    });

    test('api_founder_approvalsList — groups + items', () async {
      final b = await call('api_founder_approvalsList', const {});
      expect(b['groups'], isNotEmpty);
      expect(b['items'], isNotEmpty);
    });

    test('api_founder_listPaymentDrafts — rows incl APPROVED authority', () async {
      final b = await call('api_founder_listPaymentDrafts', const {});
      final rows = (b['rows'] as List).cast<Map<String, dynamic>>();
      expect(rows, isNotEmpty);
      expect(
        rows.where((r) => r['status'] == 'APPROVED').first,
        containsPair('approvalAuthority', 'FOUNDER'),
      );
    });

    test('api_teacherPayoutPreview — results', () async {
      final b = await call('api_teacherPayoutPreview', {'month': '2026-09'});
      expect(b['results'], isNotEmpty);
    });

    test('api_staff_listMyApprovals — rows', () async {
      final b = await call('api_staff_listMyApprovals', {'branch': 'GOREGAON'});
      expect(b['rows'], isNotEmpty);
    });

    test('api_staff_studentHub — profile + pending.canFinalise', () async {
      final b = await call('api_staff_studentHub', {'studentId': 'STU-55DCD622', 'branch': 'GOREGAON'});
      expect(b['profile'], isA<Map>());
      final pending = asMap(b['pending']);
      final rows = (pending['rows'] as List).cast<Map<String, dynamic>>();
      expect(rows.firstWhere((r) => r['canFinalise'] == true), isNotEmpty);
    });

    test('api_staff_commGenerate — subject + body + WhatsApp mode, provider never used', () async {
      final b = await call('api_staff_commGenerate', {'type': 'FEE_REMINDER'});
      expect(b['subject'], isNotEmpty);
      expect(b['body'], isNotEmpty);
      expect(b['mode'], 'WHATSAPP');
      expect(b['providerSend'], contains('DISABLED'));
    });

    test('demo WhatsApp send is marked DEMO, idempotent per key, and listed in history', () async {
      const args = {'studentId': 'STU-1', 'kind': 'FEE_REMINDER', 'body': 'hi', 'clientIntentKey': 'K-demo-1'};
      final first = await call('api_staff_sendWhatsApp', args);
      final again = await call('api_staff_sendWhatsApp', args);
      expect(first['demo'], true);
      expect(asMap(first['message'])['status'], 'DEMO');
      expect(again['messageId'], first['messageId']);
      final hist = await call('api_staff_messageHistory', {'studentId': 'STU-1'});
      expect((hist['rows'] as List).where((r) => (r as Map)['messageId'] == first['messageId']).length, 1);
    });

    test('api_staff_sessionRoster — rows', () async {
      final b = await call('api_staff_sessionRoster', {'branch': 'GOREGAON', 'scheduledSessionId': 'SCSS-DEMO-1'});
      expect(b['rows'], isNotEmpty);
    });

    test('api_listDemoStudents — students parse into DemoStudent', () async {      final b = await call('api_listDemoStudents', {'branch': 'ALL'});
      expect(b['ok'], true);
      final rows = (b['students'] as List).cast<Map<String, dynamic>>();
      expect(rows, isNotEmpty);
      final d = DemoStudent.fromApi(rows.first);
      expect(d.studentId, isNotEmpty);
      expect(d.studentName, isNotEmpty);
      expect(d.guardianName, isNotEmpty, reason: 'a demo student records the guardian, not a fee plan');
      expect(d.instrument, isNotEmpty);
      expect(d.demoDate, isNotEmpty);
      expect(d.demoTime, isNotEmpty);
    });

    test('DemoStudent is the pre-fee-plan shape — it has no money fields at all', () {
      // A trial student is not an admitted one, so the model deliberately
      // offers no feePlan / monthlyFee / nextDueDate. If someone adds them
      // back, the "demo before fee plan" rule has quietly been broken.
      final d = DemoStudent.fromApi(const {
        'studentId': 'STU-DEMO-1',
        'studentName': 'Trial',
        'guardianName': 'G',
        'guardianPhone': '9',
        'instrument': 'Keyboard',
        'branch': 'KANDIVALI',
        'demoDate': '2026-10-04',
        'demoTime': '17:00',
      });
      expect(d.studentId, 'STU-DEMO-1');
      expect(d.demoDate, '2026-10-04');
      expect(d.demoTime, '17:00');
    });

    test('api_listSchools — schools parse, and the code is what an invoice carries', () async {
      final b = await call('api_listSchools');
      expect(b['ok'], true);
      final rows = (b['schools'] as List).cast<Map<String, dynamic>>();
      expect(rows.map((s) => s['code']).toList(), ['MHWS', 'MXVILLE']);
      final s = School.fromApi(rows.first);
      expect(s.schoolId, isNotEmpty);
      expect(s.code, 'MHWS');
      // The label falls back to the bare code until a real name is set, so a
      // picker never renders an empty row.
      expect(s.label, isNotEmpty);
    });
  });

  group('DemoApiClient — writes always carry demo provenance', () {
    const writes = <String, String>{
      'api_addStudent': '{}',
      'api_staff_saveStudentDraft': '{"branch":"GOREGAON"}',
      'api_addFeePayment': '{"amount":5000}',
      'api_staff_prepareReceiptDraft': '{"studentId":"S1","amountPaise":500000}',
      'api_addTeacher': '{}',
      'api_addExpenseEntry': '{"amount":100}',
      'api_staff_submitExpenseDraft': '{"amountPaise":10000,"branch":"GOREGAON"}',
      'api_staff_inquiryQuickAdd': '{"name":"N","phone":"9"}',
      'api_staff_inquiryTransition': '{"inquiryId":"Q","action":"LOG_CONTACT"}',
      'api_staff_markAttendance': '{"studentId":"S","state":"PRESENT"}',
      'api_staff_scheduleSession': '{}',
      'api_staff_resolveTodaysClass': '{"eventId":"E","outcome":"HELD"}',
      'api_founder_setStudentStatus': '{"studentId":"S","status":"LEFT","reason":"r"}',
      'api_updateTeacherStatus': '{"teacherId":"T","newStatus":"INACTIVE","reason":"r"}',
      'api_founder_paymentDraftApprove': '{"draftId":"D"}',
      'api_founder_paymentDraftReject': '{"draftId":"D","comment":"c"}',
      'api_founder_finalisePaymentDraft': '{"draftId":"D"}',
      'api_staff_finalisePaymentDraft': '{"draftId":"D"}',
      'api_founder_mergeStudentDraft': '{"draftId":"D"}',
      'api_staff_submitPackageExtensionRequest': '{"studentId":"S1","extraMonths":1,"reason":"r"}',
      'api_founder_packageExtensionApprove': '{"requestId":"R"}',
      'api_founder_packageExtensionReject': '{"requestId":"R","reason":"r"}',
      'api_staff_submitPaymentProfileChangeRequest': '{"entityId":"ENT-GOREGAON","requestedLabel":"L","reason":"r"}',
      'api_founder_paymentProfileChangeApprove': '{"requestId":"R"}',
      'api_founder_paymentProfileChangeReject': '{"requestId":"R","reason":"r"}',
      'api_staff_proposeClosure': '{"scope":"BRANCH","branch":"GOREGAON","fromDate":"2026-10-02","toDate":"2026-10-02","reason":"r"}',
      'api_founder_authoriseClosure': '{"closureId":"C"}',
      'api_founder_closureReject': '{"closureId":"C","reason":"r"}',
      'api_founder_revokeClosure': '{"closureId":"C","reason":"r"}',
      'api_staff_requestClassCorrection': '{"eventId":"E-2026-10-02-T1","reason":"r"}',
      'api_founder_approveClassCorrection': '{"correctionId":"CC"}',
      'api_founder_rejectClassCorrection': '{"correctionId":"CC","reason":"r"}',
      'api_staff_submitLateFeeWaiverRequest': '{"studentId":"S1","reason":"r"}',
      'api_founder_lateFeeWaiverApprove': '{"requestId":"R"}',
      'api_founder_lateFeeWaiverReject': '{"requestId":"R","reason":"r"}',
      'api_staff_submitInstalmentPlanDraft': '{"studentId":"S1","totalAmount":1000,"instalmentCount":3,"firstDueDate":"2026-10-01"}',
      'api_founder_instalmentPlanDraftApprove': '{"draftId":"D"}',
      'api_founder_instalmentPlanDraftReject': '{"draftId":"D","reason":"r"}',
      'api_staff_generateTermsToken': '{"studentId":"S1"}',
      'api_staff_requestManualTermsAcceptance': '{"studentId":"S1","reason":"r"}',
      'api_founder_manualTermsAcceptanceApprove': '{"requestId":"R"}',
      'api_founder_manualTermsAcceptanceReject': '{"requestId":"R","reason":"r"}',
      'api_founder_addAuthorizedEmail': '{"email":"new@example.com"}',
      'api_founder_removeAuthorizedEmail': '{"email":"new@example.com"}',
      'api_founder_revokeDeviceToken': '{"id":"DEV-1"}',
      'api_addDemoStudent': '{"studentName":"Trial","phone":"9"}',
      'api_founder_convertDemoStudent': '{"studentId":"STU-DEMO-1"}',
      'api_addSchool': '{"code":"NEWCO","name":"New School"}',
    };

    for (final entry in writes.entries) {
      test('${entry.key} is stamped demo, never claims persistence', () async {
        final m = asMap(await DemoApiClient().call(entry.key, const {}));
        expect(m['demo'], true, reason: '${entry.key} must be marked demo');
        expect((m['demoNote'] ?? '').toString(), contains('Not persisted'));
      });
    }
  });

  group('Model parsing — fixture contract shapes (no drift)', () {
    late DemoApiClient d;
    setUp(() => d = DemoApiClient());
    Future<Map<String, dynamic>> call(String api, [Map<String, dynamic>? arg]) async =>
        asMap(await d.call(api, arg ?? const {}));

    test('Student.fromApi parses search results', () async {
      final b = await call('api_searchStudent', {'q': '', 'includeAll': true});
      final s = Student.fromApi((b['results'] as List).cast<Map<String, dynamic>>().first);
      expect(s.studentId, isNotEmpty);
      expect(s.studentName, isNotEmpty);
    });

    test('ReceiptRow.fromApi parses search receipts', () async {
      final b = await call('api_searchReceipt', const {});
      final r = ReceiptRow.fromApi((b['results'] as List).cast<Map<String, dynamic>>().first);
      expect(r.receiptNo, isNotEmpty);
    });

    test('Teacher.fromApi parses teacher list', () async {
      final b = await call('api_listTeachers');
      final t = Teacher.fromApi((b['teachers'] as List).cast<Map<String, dynamic>>().first);
      expect(t.teacherId, isNotEmpty);
      expect(t.teacherName, isNotEmpty);
    });

    test('ExpenseEntry.fromApi parses cashbook', () async {
      final b = await call('api_cashbookReport', const {});
      final e = ExpenseEntry.fromApi((b['entries'] as List).cast<Map<String, dynamic>>().first);
      expect(e.entryId, isNotEmpty);
      expect(e.amount, greaterThan(0));
    });

    test('TodaysClassOptions.fromApi parses classes', () async {
      final b = await call('api_staff_todaysClasses', {'branch': 'GOREGAON', 'date': '2026-09-11'});
      final o = TodaysClassOptions.fromApi(b);
      expect(o.rows, isNotEmpty);
      expect(o.outcomes, isNotEmpty);
      for (final c in o.rows.take(1)) {
        expect(c.eventId, isNotEmpty);
      }
    });

    test('TaskCard.fromApi parses today cards', () async {
      final b = await call('api_staff_todaysTasks', {'branch': 'GOREGAON'});
      final c = TaskCard.fromApi((b['cards'] as List).cast<Map<String, dynamic>>().first);
      expect(c.key, isNotEmpty);
      expect(c.label, isNotEmpty);
    });

    test('ApprovalsData.fromApi parses groups', () async {
      final b = await call('api_founder_approvalsList', const {});
      final a = ApprovalsData.fromApi(b);
      expect(a.groups, isNotEmpty);
      expect(a.groups.first.items, isNotEmpty);
      expect(a.groups.first.items.first.itemId, isNotEmpty);
    });

    test('PaymentDraftRow authority label is honest about ROUTINE_LANE', () async {
      final b = await call('api_founder_listPaymentDrafts', const {});
      final rows = (b['rows'] as List).cast<Map<String, dynamic>>();
      final founder = rows.firstWhere((r) => r['status'] == 'APPROVED');
      final founderRow = PaymentDraftRow.fromApi(founder);
      expect(founderRow.authorityLabel, contains('sharvil@demo'));
      // ROUTINE_LANE must never render a human approver.
      final routine = PaymentDraftRow.fromApi({
        'draftId': 'D', 'status': 'APPROVED',
        'approvalAuthority': 'ROUTINE_LANE', 'approvedBy': '',
      });
      expect(routine.authorityLabel, isNot(contains('Approved by')));
      expect(routine.authorityLabel, contains('Routine'));
    });

    test('PayoutRow.fromApi parses preview results', () async {
      final b = await call('api_teacherPayoutPreview', {'month': '2026-09'});
      final rows = (b['results'] as List).cast<Map<String, dynamic>>();
      final r = PayoutRow.fromApi(rows.first);
      expect(r.teacherName, isNotEmpty);
      expect(r.payable, greaterThanOrEqualTo(0));
    });

    test('ApprovalRequestRow.fromApi parses staff requests', () async {
      final b = await call('api_staff_listMyApprovals', {'branch': 'GOREGAON'});
      final r = ApprovalRequestRow.fromApi((b['rows'] as List).cast<Map<String, dynamic>>().first);
      expect(r.id, isNotEmpty);
      expect(r.type, isNotEmpty);
    });

    test('StaffHub.fromApi parses hub w/ pending finalisable', () async {
      final b = await call('api_staff_studentHub', {'studentId': 'STU-55DCD622', 'branch': 'GOREGAON'});
      final hub = StaffHub.fromApi(b);
      expect(hub.profile.studentId, isNotEmpty);
      expect(hub.pending.where((p) => p.canFinalise), isNotEmpty);
    });

    test('CommMessage.fromApi parses generated message', () async {
      final b = await call('api_staff_commGenerate', {'type': 'FEE_REMINDER'});
      final m = CommMessage.fromApi(b);
      expect(m.subject, isNotEmpty);
      expect(m.body, isNotEmpty);
      expect(m.canWhatsApp, true);
      expect(m.kind, 'FEE_REMINDER');
    });

    test('DashboardMetrics.fromApi parses dashboard', () async {
      final b = await call('api_dashboard', {'scope': ''});
      final m = DashboardMetrics.fromApi(b);
      expect(m.todayCollection, greaterThanOrEqualTo(0));
      expect(m.recent, isA<List>());
    });

    test('Bootstrap.fromApi parses founder boot', () async {
      final b = await call('api_bootstrap');
      final boot = Bootstrap.fromApi(b);
      expect(boot.operator.isFounder, true);
      expect(boot.operator.isStaff, false);
      expect(boot.classCodes, isNotEmpty);
    });

    test('Inquiry.fromApi parses leads with real server statuses (never NEW/FOLLOW_UP)', () async {
      final b = await call('api_staff_inquiryQueue', {'branch': 'GOREGAON'});
      final rows = (b['rows'] as List).cast<Map<String, dynamic>>();
      final q = Inquiry.fromApi(rows.first);
      expect(q.inquiryId, isNotEmpty);
      expect(q.name, isNotEmpty);
      expect(q.status, isNot(anyOf('NEW', 'FOLLOW_UP')));
      expect(q.actionable, true, reason: 'a fresh OPEN inquiry must be actionable');
      final dropped = rows.firstWhere((r) => r['status'] == 'DROPPED');
      final d = Inquiry.fromApi(dropped);
      expect(d.actionable, false);
      expect(d.finalStatus, 'REJECTED');
    });

    test('InquiryDetail.fromApi parses contact profile + follow-up history', () async {
      final b = await call('api_staff_inquiryDetail', {'inquiryId': 'INQ-501'});
      final detail = InquiryDetail.fromApi(b);
      expect(detail.inquiryId, isNotEmpty);
      expect(detail.followups, isNotEmpty);
      expect(detail.followups.first.description, isNotEmpty);
    });

    test('Inquiry.fromApi distinguishes a former-student win-back lead from a fresh one', () async {
      final b = await call('api_staff_inquiryQueue', {'branch': 'KANDIVALI'});
      final rows = (b['rows'] as List).cast<Map<String, dynamic>>();
      final winBack = Inquiry.fromApi(rows.firstWhere((r) => r['source'] == 'Former Student'));
      expect(winBack.isFormerStudent, true);
      final fresh = Inquiry.fromApi(rows.firstWhere((r) => r['source'] != 'Former Student'));
      expect(fresh.isFormerStudent, false);
    });

    test('Inquiry.fromApi treats a blank instrument as no preference, a DORMANT/TIMEOUT lead as never actionable', () async {
      final b = await call('api_staff_inquiryQueue', {'branch': 'GOREGAON'});
      final rows = (b['rows'] as List).cast<Map<String, dynamic>>();
      final noPreference = Inquiry.fromApi(rows.firstWhere((r) => (r['instrument'] ?? '').toString().isEmpty));
      expect(noPreference.hasInstrumentPreference, false);
      final timedOut = Inquiry.fromApi(rows.firstWhere((r) => r['dormantReason'] == 'TIMEOUT'));
      expect(timedOut.actionable, false, reason: 'DORMANT must be terminal client-side too, matching the server');
      expect(timedOut.dormantReason, 'TIMEOUT');
    });
  });

  group('Error contract', () {
    test('ApiException carries server code + message', () {
      final e = ApiException('Student not found.', code: 'STUDENT_NOT_FOUND');
      expect(e.code, 'STUDENT_NOT_FOUND');
      expect(e.toString(), contains('STUDENT_NOT_FOUND'));
    });

    test('ApiUnreachable is a distinct transport failure', () {
      expect(ApiUnreachable('timeout').toString(), contains('timeout'));
    });
  });
}