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
  });
}