import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:swar_mangal/models/models.dart';
import 'package:swar_mangal/services/demo_api.dart';
import 'package:swar_mangal/services/invoice_pdf.dart';

Map<String, dynamic> _map(dynamic v) => v as Map<String, dynamic>;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  group('SchoolInvoice — school-level model (NO student dependency)', () {
    test('does not expose student fields', () {
      final inv = SchoolInvoice.fromApi({
        'invoiceId': 'SINV-1', 'invoiceNo': 'SMI-2026-00001', 'invoiceDate': '2026-09-12',
        'branch': 'KANDIVALI', 'className': 'Keyboard', 'amount': 18000, 'tenure': '6 Months',
      });
      expect(inv.className, 'Keyboard');
      expect(inv.amount, 18000);
    });

    test('parses demo generation snapshot clean', () async {
      final b = _map(await DemoApiClient().call('api_generateSchoolInvoice',
          {'className': 'Flute', 'amount': 12000, 'tenure': '3 Months'}));
      expect(b['demo'], true);
      final inv = SchoolInvoice.fromApi(b);
      expect(inv.invoiceNo, startsWith('INV-DEMO'));
      expect(inv.amount, 12000);
      expect(inv.tenure, '3 Months');
      expect(inv.owner1.name, isNotEmpty);
      expect(inv.owner2.name, isNotEmpty);
    });
  });

  group('InvoiceSummary — school history rows', () {
    test('parses class + no student', () {
      final s = InvoiceSummary.fromApi({
        'invoiceNo': 'INV-001', 'invoiceDate': '2026-06-10', 'tenure': '3 Months',
        'amount': 9000, 'invoiceId': 'I1', 'className': 'Flute',
      });
      expect(s.className, 'Flute');
      expect(s.amount, 9000);
      expect(s.charges, isEmpty);
      expect(s.total, 9000);
    });
  });

  group('ExtraCharge / charges+total on a school invoice', () {
    test('SchoolInvoice.fromApi parses charges and the server-computed total', () {
      final inv = SchoolInvoice.fromApi({
        'invoiceId': 'SINV-1', 'invoiceNo': 'SMI-2026-00001', 'invoiceDate': '2026-09-12',
        'branch': 'KANDIVALI', 'className': 'Keyboard', 'amount': 18000, 'tenure': '6 Months',
        'charges': [
          {'description': 'Diwali decoration', 'amount': 500},
          {'description': 'Annual day costume', 'amount': 1200},
        ],
        'total': 19700,
      });
      expect(inv.charges, hasLength(2));
      expect(inv.charges.first.description, 'Diwali decoration');
      expect(inv.charges.first.amount, 500);
      expect(inv.total, 19700);
    });

    test('SchoolInvoice computes total client-side when the backend omits it (legacy snapshot)', () {
      final inv = SchoolInvoice.fromApi({
        'invoiceId': 'SINV-1', 'invoiceNo': 'SMI-2026-00001', 'invoiceDate': '2026-09-12',
        'branch': 'KANDIVALI', 'className': 'Keyboard', 'amount': 18000, 'tenure': '6 Months',
      });
      expect(inv.charges, isEmpty);
      expect(inv.total, 18000);
    });

    test('InvoiceSummary.fromApi parses charges and total the same way', () {
      final s = InvoiceSummary.fromApi({
        'invoiceNo': 'INV-001', 'invoiceDate': '2026-06-10', 'tenure': '3 Months',
        'amount': 9000, 'invoiceId': 'I1', 'className': 'Flute',
        'charges': [{'description': 'Extra', 'amount': 1000}],
        'total': 10000,
      });
      expect(s.charges, hasLength(1));
      expect(s.total, 10000);
    });
  });

  group('InvoiceValidator — extra charges (mirrors the backend\'s parseExtraCharges)', () {
    test('a fully blank row is valid (an unused "Add charge" slot)', () {
      expect(InvoiceValidator.chargesValid([('', '')]), true);
    });
    test('a fully filled row is valid', () {
      expect(InvoiceValidator.chargesValid([('Diwali decoration', '500')]), true);
    });
    test('description without amount is rejected', () {
      expect(InvoiceValidator.chargesValid([('Diwali decoration', '')]), false);
    });
    test('amount without description is rejected', () {
      expect(InvoiceValidator.chargesValid([('', '500')]), false);
    });
    test('a zero or negative amount with a description is rejected', () {
      expect(InvoiceValidator.chargesValid([('Diwali decoration', '0')]), false);
      expect(InvoiceValidator.chargesValid([('Diwali decoration', '-5')]), false);
    });
    test('one bad row among several good ones still fails the whole list', () {
      expect(
        InvoiceValidator.chargesValid([('Diwali decoration', '500'), ('', '200')]),
        false,
      );
    });
    test('cleanCharges drops blank rows and keeps only valid ones', () {
      final cleaned = InvoiceValidator.cleanCharges([
        ('', ''),
        ('Diwali decoration', '500'),
        ('Annual day costume', '1,200'),
      ]);
      expect(cleaned, hasLength(2));
      expect(cleaned[0].description, 'Diwali decoration');
      expect(cleaned[0].amount, 500);
      expect(cleaned[1].amount, 1200);
    });
  });

  group('InvoiceValidator', () {
    test('zero / negative / non-numeric rejected; valid + comma ok', () {
      expect(InvoiceValidator.amount('0').ok, false);
      expect(InvoiceValidator.amount('-5').ok, false);
      expect(InvoiceValidator.amount('abc').ok, false);
      expect(InvoiceValidator.amount('18000').ok, true);
      expect(InvoiceValidator.amount('18,000').amount, 18000);
    });
    test('tenure required', () {
      expect(InvoiceValidator.tenure(''), isNotNull);
      expect(InvoiceValidator.tenure('6 Months'), isNull);
    });
  });

  group('PDF generation', () {
    test('produces a real %PDF document', () async {
      final inv = SchoolInvoice.fromApi({
        'invoiceId': 'S', 'invoiceNo': 'INV-PDF-1', 'invoiceDate': '2026-09-12',
        'branch': 'KANDIVALI', 'className': 'Keyboard', 'amount': 18000, 'tenure': '6 Months',
      });
      final bytes = await buildInvoicePdf(inv, demo: true);
      expect(bytes.length, greaterThan(1000));
      expect(latin1.decode(bytes.sublist(0, 5)), '%PDF-');
    });

    test('still produces a valid PDF with itemized extra charges', () async {
      final inv = SchoolInvoice.fromApi({
        'invoiceId': 'S', 'invoiceNo': 'INV-PDF-2', 'invoiceDate': '2026-09-12',
        'branch': 'KANDIVALI', 'className': 'Keyboard', 'amount': 18000, 'tenure': '6 Months',
        'charges': [
          {'description': 'Diwali decoration', 'amount': 500},
          {'description': 'Annual day costume', 'amount': 1200},
        ],
        'total': 19700,
      });
      final bytes = await buildInvoicePdf(inv, demo: true);
      expect(bytes.length, greaterThan(1000));
      expect(latin1.decode(bytes.sublist(0, 5)), '%PDF-');
    });
  });

  group('SchoolInvoice — void fields (never deleted or edited in place)', () {
    test('defaults to empty status/void fields when the backend omits them', () {
      final inv = SchoolInvoice.fromApi({
        'invoiceId': 'SINV-1', 'invoiceNo': 'SMI-2026-00001', 'invoiceDate': '2026-09-12',
        'branch': 'KANDIVALI', 'className': 'Keyboard', 'amount': 18000, 'tenure': '6 Months',
      });
      expect(inv.status, isEmpty);
      expect(inv.voidReason, isEmpty);
      expect(inv.voidedBy, isEmpty);
      expect(inv.voidedAt, isEmpty);
    });

    test('parses status/voidReason/voidedBy/voidedAt from the backend exactly', () {
      final inv = SchoolInvoice.fromApi({
        'invoiceId': 'SINV-1', 'invoiceNo': 'SMI-2026-00001', 'invoiceDate': '2026-09-12',
        'branch': 'KANDIVALI', 'className': 'Keyboard', 'amount': 18000, 'tenure': '6 Months',
        'status': 'VOID', 'voidReason': 'wrong school', 'voidedBy': 'sharvil', 'voidedAt': '2026-10-05T00:00:00.000Z',
      });
      expect(inv.status, 'VOID');
      expect(inv.voidReason, 'wrong school');
      expect(inv.voidedBy, 'sharvil');
      expect(inv.voidedAt, '2026-10-05T00:00:00.000Z');
    });
  });

  group('Demo api_founder_voidSchoolInvoice', () {
    test('returns a demo-stamped, non-persisted VOID result', () async {
      final b = _map(await DemoApiClient().call('api_founder_voidSchoolInvoice', {
        'invoiceId': 'SINV-DEMO-1',
        'reason': 'wrong amount',
      }));
      expect(b['ok'], true);
      expect(b['changed'], true);
      expect(b['status'], 'VOID');
      expect(b['demo'], true);
      expect((b['demoNote'] ?? '').toString(), contains('Not persisted'));
    });
  });

  group('PDF generation — VOID watermark', () {
    test('a VOID invoice still produces a valid PDF (watermarked)', () async {
      final inv = SchoolInvoice.fromApi({
        'invoiceId': 'S', 'invoiceNo': 'INV-PDF-VOID', 'invoiceDate': '2026-09-12',
        'branch': 'KANDIVALI', 'className': 'Keyboard', 'amount': 18000, 'tenure': '6 Months',
        'status': 'VOID', 'voidReason': 'duplicate',
      });
      final bytes = await buildInvoicePdf(inv, demo: true);
      expect(bytes.length, greaterThan(1000));
      expect(latin1.decode(bytes.sublist(0, 5)), '%PDF-');
    });
  });

  group('Demo invoice behavior', () {
    late DemoApiClient d;
    setUp(() => d = DemoApiClient());
    test('generation is demo-stamped', () async {
      final b = _map(await d.call('api_generateSchoolInvoice', {'className': 'Tabla', 'amount': 9000, 'tenure': '1 Month'}));
      expect(b['demo'], true);
      expect((b['demoNote'] ?? '').toString(), contains('Not persisted'));
    });
    test('history + snapshot are school-level', () async {
      final list = _map(await d.call('api_listSchoolInvoices', {'branch': 'ALL'}));
      expect(list['invoices'], isNotEmpty);
      final det = _map(await d.call('api_getSchoolInvoice', {'invoiceId': 'SINV-DEMO-1'}));
      final inv = SchoolInvoice.fromApi(det['invoice'] as Map<String, dynamic>);
      expect(inv.className, isNotEmpty);
    });

    test('generation echoes extraCharges back as charges + a computed total', () async {
      final b = _map(await d.call('api_generateSchoolInvoice', {
        'className': 'Tabla',
        'amount': 9000,
        'tenure': '1 Month',
        'extraCharges': [
          {'description': 'Diwali decoration', 'amount': 500},
          {'description': 'Blank slot', 'amount': ''}, // half-filled — dropped, not sent as-is by the real form
        ],
      }));
      final inv = SchoolInvoice.fromApi(b);
      expect(inv.charges, hasLength(1));
      expect(inv.charges.first.description, 'Diwali decoration');
      expect(inv.total, 9500);
    });

    test('generation with no extraCharges leaves charges empty and total == amount', () async {
      final b = _map(await d.call('api_generateSchoolInvoice', {'className': 'Tabla', 'amount': 9000, 'tenure': '1 Month'}));
      final inv = SchoolInvoice.fromApi(b);
      expect(inv.charges, isEmpty);
      expect(inv.total, 9000);
    });
  });
}