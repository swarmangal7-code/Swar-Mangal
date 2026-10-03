import 'package:flutter_test/flutter_test.dart';
import 'package:swar_mangal/models/models.dart';
import 'package:swar_mangal/services/api_service.dart';
import 'package:swar_mangal/services/demo_api.dart';

/// Coverage for the 2026-10-03 payroll/attendance correctness pass: the
/// founder-editable settings RPCs, the payout statement workflow
/// (DRAFT->CALCULATED->FOUNDER_APPROVED), manual adjustments, the overdue
/// late-fee reminder trigger, and PayoutRow's new outcomeFlags field.
void main() {
  // The demo backend is shared across instances by design; reset it so one
  // test's statement writes do not leak into another test.
  setUp(DemoApiClient.resetSharedState);

  group('founder settings RPCs (append-only, effective-dated)', () {
    test('founderSetPayoutStatusRule returns the new rule', () async {
      final svc = ApiService(DemoApiClient());
      final r = await svc.founderSetPayoutStatusRule(outcome: 'SCHOOL_HOLIDAY', payoutPercent: 60, effectiveFrom: '2026-11-01');
      final m = r as Map<String, dynamic>;
      expect(m['ok'], true);
      expect(m['outcome'], 'SCHOOL_HOLIDAY');
      expect(m['payoutPercent'], 60);
      expect(m['demo'], true);
    });

    test('founderSetTeacherPercentSlab returns the new step', () async {
      final svc = ApiService(DemoApiClient());
      final r = await svc.founderSetTeacherPercentSlab(monthsSinceStart: 18, percent: 55);
      final m = r as Map<String, dynamic>;
      expect(m['ok'], true);
      expect(m['monthsSinceStart'], 18);
      expect(m['percent'], 55);
    });

    test('founderSetLateFeeSettings returns the new setting', () async {
      final svc = ApiService(DemoApiClient());
      final r = await svc.founderSetLateFeeSettings(graceDays: 10, dailyRate: 75);
      final m = r as Map<String, dynamic>;
      expect(m['ok'], true);
      expect(m['graceDays'], 10);
      expect(m['dailyRate'], 75);
    });
  });

  group('payout statement workflow', () {
    test('generate -> CALCULATED, then approve -> FOUNDER_APPROVED', () async {
      final svc = ApiService(DemoApiClient());
      final generated = await svc.founderGeneratePayoutStatement(teacherId: 'T-001', month: '2026-09');
      expect(generated.status, 'CALCULATED');
      expect(generated.calculatedAmount, isNotNull);

      final approved = await svc.founderApprovePayoutStatement(
        statementId: generated.statementId,
        teacherId: 'T-001',
        month: '2026-09',
      );
      expect(approved.isApproved, true);
      expect(approved.status, 'FOUNDER_APPROVED');
      expect(approved.approvedAmount, isNotNull);
    });

    test('re-approving an already-approved statement is idempotent', () async {
      final svc = ApiService(DemoApiClient());
      final generated = await svc.founderGeneratePayoutStatement(teacherId: 'T-002', month: '2026-09');
      final first = await svc.founderApprovePayoutStatement(statementId: generated.statementId, teacherId: 'T-002', month: '2026-09');
      final second = await svc.founderApprovePayoutStatement(statementId: generated.statementId, teacherId: 'T-002', month: '2026-09');
      expect(first.status, 'FOUNDER_APPROVED');
      expect(second.status, 'FOUNDER_APPROVED');
    });

    test('generating again on an approved statement surfaces ALREADY_DECIDED as a PayoutStatement, not a thrown error', () async {
      final svc = ApiService(DemoApiClient());
      final generated = await svc.founderGeneratePayoutStatement(teacherId: 'T-003', month: '2026-09');
      await svc.founderApprovePayoutStatement(statementId: generated.statementId, teacherId: 'T-003', month: '2026-09');

      final again = await svc.founderGeneratePayoutStatement(teacherId: 'T-003', month: '2026-09');
      expect(again.statementId, generated.statementId);
      expect(again.isApproved, true);
    });

    test('founderAddPayoutAdjustment carries the signed amount and reason through', () async {
      final svc = ApiService(DemoApiClient());
      final r = await svc.founderAddPayoutAdjustment(statementId: 'PSTMT-1', amount: -500, reason: 'Goodwill deduction');
      final m = r as Map<String, dynamic>;
      expect(m['ok'], true);
      expect(m['amount'], -500);
      expect(m['reason'], 'Goodwill deduction');
      // approvedBy must come from the session, never a client-supplied field —
      // the typed method takes no such parameter at all.
      expect(m['approvedBy'], isNotEmpty);
    });
  });

  group('overdue late-fee reminders', () {
    test('founderSendOverdueLateFeeReminders returns sent/failed/skipped counts', () async {
      final svc = ApiService(DemoApiClient());
      final r = await svc.founderSendOverdueLateFeeReminders();
      final m = r as Map<String, dynamic>;
      expect(m['ok'], true);
      expect(m['sent'], isA<int>());
      expect(m['failed'], isA<int>());
      expect(m['skipped'], isA<int>());
    });
  });

  group('PayoutRow.outcomeFlags', () {
    test('parses per-outcome count + configuredPercent, defaults to empty map when absent', () {
      final withFlags = PayoutRow.fromApi({
        'teacherId': 'T-1',
        'teacherName': 'Demo',
        'month': '2026-09',
        'payable': 1000,
        'outcomeFlags': {
          'SCHOOL_HOLIDAY': {'count': 2, 'configuredPercent': 50},
          'TEACHER_ABSENT': {'count': 1, 'configuredPercent': null},
        },
      });
      expect(withFlags.outcomeFlags['SCHOOL_HOLIDAY']!.count, 2);
      expect(withFlags.outcomeFlags['SCHOOL_HOLIDAY']!.configuredPercent, 50);
      expect(withFlags.outcomeFlags['TEACHER_ABSENT']!.configuredPercent, isNull);

      final withoutFlags = PayoutRow.fromApi({'teacherId': 'T-2', 'teacherName': 'Demo2', 'month': '2026-09', 'payable': 500});
      expect(withoutFlags.outcomeFlags, isEmpty);
    });
  });
}
