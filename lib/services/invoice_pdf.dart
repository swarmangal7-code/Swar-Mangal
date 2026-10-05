import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart' as pdf;
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/models.dart';

/// Handover template redesign: matches the real letterhead (maroon corporate
/// design, circular mark, authorised signatures, payment-split beneficiary
/// boxes) exactly, instead of a generic layout. Web (react-pdf) and this
/// Flutter renderer share the same source data (SchoolInvoice from the
/// backend) and the same brand assets, just two different PDF engines.
const _maroon = pdf.PdfColor.fromInt(0x7A1F2B);
const _cream = pdf.PdfColor.fromInt(0xFAF6EF);
const _border = pdf.PdfColor.fromInt(0xE6DDD3);
const _borderStrong = pdf.PdfColor.fromInt(0xECE2D5);
const _pillBg = pdf.PdfColor.fromInt(0xF3E7E6);
const _ink = pdf.PdfColor.fromInt(0x2B2B2B);
const _gray = pdf.PdfColor.fromInt(0x6B6B6B);
const _green = pdf.PdfColor.fromInt(0x2E7D32);

Future<Uint8List> buildInvoicePdf(SchoolInvoice inv, {bool demo = false}) async {
  final doc = pw.Document();
  final regular = pw.Font.ttf(await rootBundle.load('assets/fonts/Inter-400.ttf'));
  final bold = pw.Font.ttf(await rootBundle.load('assets/fonts/Inter-700.ttf'));
  final serifBold = pw.Font.ttf(await rootBundle.load('assets/fonts/PlayfairDisplay-700.ttf'));
  final theme = pw.ThemeData.withFont(base: regular, bold: bold);

  final logo = pw.MemoryImage((await rootBundle.load('assets/images/logo-mark.png')).buffer.asUint8List());
  final sigSharvil = pw.MemoryImage((await rootBundle.load('assets/images/signature-sharvil.png')).buffer.asUint8List());
  final sigPiyush = pw.MemoryImage((await rootBundle.load('assets/images/signature-piyush.png')).buffer.asUint8List());

  final period = inv.billingPeriodFrom.isNotEmpty && inv.billingPeriodTo.isNotEmpty
      ? (inv.billingPeriodFrom, inv.billingPeriodTo)
      : _previousMonthRange(inv.invoiceDate);
  final beneficiaries = inv.beneficiaries.isNotEmpty
      ? inv.beneficiaries
      : [InvoiceBeneficiaryAmount(name: inv.schoolName.isNotEmpty ? inv.schoolName : 'Swar Mangal', amount: inv.amount)];
  final split = beneficiaries.length > 1;
  final splitTotal = beneficiaries.fold<num>(0, (s, b) => s + b.amount);
  final serviceDescription = inv.serviceDescription.isNotEmpty ? inv.serviceDescription : (inv.className.isNotEmpty ? inv.className : 'Music education');
  final charges = inv.charges;
  final hasCharges = charges.isNotEmpty;
  final total = inv.total;

  doc.addPage(
    pw.MultiPage(
      theme: theme,
      pageFormat: pdf.PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(40),
      build: (_) => [
        // Header
        pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.center, children: [
              pw.Image(logo, width: 38, height: 38),
              pw.SizedBox(width: 10),
              pw.Text('Swar Mangal™', style: pw.TextStyle(font: serifBold, fontSize: 20, color: _maroon)),
            ]),
            pw.Text('INVOICE', style: pw.TextStyle(font: serifBold, fontSize: 24, color: pdf.PdfColors.grey900)),
          ],
        ),
        pw.Container(height: 2, color: _maroon, margin: const pw.EdgeInsets.only(top: 10, bottom: 12)),

        // Info box
        pw.Container(
          padding: const pw.EdgeInsets.all(10),
          decoration: pw.BoxDecoration(color: _cream, border: pw.Border.all(color: _border), borderRadius: pw.BorderRadius.circular(3)),
          child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Expanded(
              flex: 8,
              child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                _label('BILLED TO'),
                pw.Text(inv.schoolName.isNotEmpty ? inv.schoolName : (inv.className.isNotEmpty ? inv.className : '—'),
                    style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _ink)),
                if (inv.schoolAddress.isNotEmpty) _small(inv.schoolAddress),
                _small('Attn: ${inv.attn.isNotEmpty ? inv.attn : 'The Principal'}'),
              ]),
            ),
            pw.Container(width: 1, height: 58, margin: const pw.EdgeInsets.symmetric(horizontal: 12), color: _border),
            pw.Expanded(
              flex: 7,
              child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Row(children: [
                  pw.Expanded(
                    flex: 10,
                    child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                      _label('INVOICE NO.'),
                      _value(_displayInvoiceNo(inv.invoiceNo)),
                    ]),
                  ),
                  pw.Expanded(
                    flex: 11,
                    child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                      _label('INVOICE DATE'),
                      _value(_niceDate(inv.invoiceDate)),
                    ]),
                  ),
                ]),
                if (period != null) ...[
                  pw.SizedBox(height: 8),
                  _label('BILLING PERIOD'),
                  _value('${_ddmmyyyy(period.$1)} to ${_ddmmyyyy(period.$2)}'),
                ],
              ]),
            ),
          ]),
        ),
        pw.SizedBox(height: 10),

        pw.Text('Dear Sir/Madam,', style: const pw.TextStyle(fontSize: 9.5)),
        pw.SizedBox(height: 4),
        pw.Text(
          'Please find below our invoice for the monthly school music education programme services for the billing period stated above.',
          style: const pw.TextStyle(fontSize: 9.5),
        ),
        pw.SizedBox(height: 6),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 3),
          decoration: pw.BoxDecoration(color: _pillBg, borderRadius: pw.BorderRadius.circular(3)),
          child: pw.Text('Billing Basis: ${inv.billingBasis.isNotEmpty ? inv.billingBasis : 'Fixed Monthly'}',
              style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: _maroon)),
        ),

        _sectionHeading('SERVICE SUMMARY'),
        pw.Text(
          'Monthly music education services for the school programme'
          '${period != null ? ' (${_ddmmyyyy(period.$1)} to ${_ddmmyyyy(period.$2)}, fixed monthly billing)' : ''}. '
          'Instruments covered: $serviceDescription.',
          style: const pw.TextStyle(fontSize: 9, lineSpacing: 2),
        ),

        _sectionHeading('PARTICULARS'),
        pw.Container(
          color: _maroon,
          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          child: pw.Row(children: [
            pw.Expanded(flex: 3, child: _th('DESCRIPTION')),
            pw.Expanded(child: _th('QTY', align: pw.TextAlign.center)),
            pw.Expanded(flex: 2, child: _th('RATE', align: pw.TextAlign.right)),
            pw.Expanded(flex: 2, child: _th('AMOUNT', align: pw.TextAlign.right)),
          ]),
        ),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 7),
          decoration: pw.BoxDecoration(border: pw.Border.all(color: _border)),
          child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Expanded(
                flex: 3,
                child: pw.Text(
                    hasCharges ? 'Fixed amount' : 'Monthly Music Education Services — $serviceDescription',
                    style: const pw.TextStyle(fontSize: 9))),
            pw.Expanded(child: pw.Text('1', style: const pw.TextStyle(fontSize: 9), textAlign: pw.TextAlign.center)),
            pw.Expanded(flex: 2, child: pw.Text(_rs(inv.amount), style: const pw.TextStyle(fontSize: 9), textAlign: pw.TextAlign.right)),
            pw.Expanded(flex: 2, child: pw.Text(_rs(inv.amount), style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold), textAlign: pw.TextAlign.right)),
          ]),
        ),
        for (final c in charges)
          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 7),
            decoration: pw.BoxDecoration(border: pw.Border(left: pw.BorderSide(color: _border), right: pw.BorderSide(color: _border), bottom: pw.BorderSide(color: _border))),
            child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Expanded(flex: 3, child: pw.Text(c.description, style: const pw.TextStyle(fontSize: 9))),
              pw.Expanded(child: pw.Text('1', style: const pw.TextStyle(fontSize: 9), textAlign: pw.TextAlign.center)),
              pw.Expanded(flex: 2, child: pw.Text(_rs(c.amount), style: const pw.TextStyle(fontSize: 9), textAlign: pw.TextAlign.right)),
              pw.Expanded(flex: 2, child: pw.Text(_rs(c.amount), style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold), textAlign: pw.TextAlign.right)),
            ]),
          ),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: pw.BoxDecoration(border: pw.Border(left: pw.BorderSide(color: _border), right: pw.BorderSide(color: _border), bottom: pw.BorderSide(color: _border))),
          child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, children: [
            pw.Text('Subtotal', style: const pw.TextStyle(fontSize: 9, color: _gray)),
            pw.SizedBox(width: 24),
            pw.Text(_rs(total), style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
          ]),
        ),
        pw.Container(
          color: _maroon,
          padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
            pw.Text('Total due', style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: pdf.PdfColors.white)),
            pw.Text(_rs(total), style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: pdf.PdfColors.white)),
          ]),
        ),

        _sectionHeading('PAYMENT INSTRUCTIONS'),
        pw.Text(
          split ? 'Payment split as per authorised collection instruction.' : 'Payable to the ${beneficiaries.first.name} account below.',
          style: const pw.TextStyle(fontSize: 9),
        ),
        pw.SizedBox(height: 8),
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            for (var i = 0; i < beneficiaries.length; i++) ...[
              if (i > 0) pw.SizedBox(width: 10),
              pw.Expanded(child: _beneficiaryBox(beneficiaries[i])),
            ],
          ],
        ),
        if (split) ...[
          pw.SizedBox(height: 8),
          pw.Wrap(spacing: 6, runSpacing: 2, children: [
            pw.Text('Total invoice amount', style: const pw.TextStyle(fontSize: 8.5)),
            pw.Text(_rs(inv.amount), style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
            pw.Text('Split total', style: const pw.TextStyle(fontSize: 8.5)),
            pw.Text(_rs(splitTotal), style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold)),
            pw.Text(
              (splitTotal - inv.amount).abs() < 0.01 ? 'Split reconciles to the total.' : 'Split does not reconcile — check beneficiary shares.',
              style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: (splitTotal - inv.amount).abs() < 0.01 ? _green : _maroon),
            ),
          ]),
        ],

        _sectionHeading('NOTES', top: 14),
        pw.Text(
          '1. This is a finalised tax-neutral service invoice. Kindly remit the total due by the due date and quote the invoice number on your payment reference.',
          style: const pw.TextStyle(fontSize: 8, lineSpacing: 1.5, color: _ink),
        ),
        pw.SizedBox(height: 2),
        pw.Text('2. GST, if applicable, will be added as per prevailing rates and the agreed billing arrangement.', style: const pw.TextStyle(fontSize: 8, color: _ink)),

        pw.SizedBox(height: 8),
        pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.Text('AUTHORISED SIGNATORIES · FOR SWAR MANGAL™',
              style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: _gray, letterSpacing: .5)),
        ),
        pw.SizedBox(height: 8),
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, children: [
          _signatureBlock(sigSharvil, 'Sharvil Vaidya'),
          pw.SizedBox(width: 36),
          _signatureBlock(sigPiyush, 'Piyush Kashyap'),
        ]),

        pw.SizedBox(height: 10),
        pw.Container(height: 1, color: _border),
        pw.SizedBox(height: 6),
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Text('Swar Mangal™', style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold, color: _maroon)),
            pw.Text('Registered name: Swar Mangal™', style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
            pw.Text('Swar Mangal Music Academy · Branches: Goregaon | Kandivali', style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
          ]),
          pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Text('Contact: +91-9769419519 | +91-8169222089', style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
            pw.Text('swarmangal.com | @Swarmangal', style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
          ]),
        ]),

        if (demo) ...[
          pw.SizedBox(height: 8),
          pw.Center(child: pw.Text('DEMO — NOT PERSISTED', style: const pw.TextStyle(fontSize: 10, color: pdf.PdfColors.red))),
        ],
      ],
    ),
  );
  return doc.save();
}

pw.Widget _label(String text) => pw.Padding(
      padding: const pw.EdgeInsets.only(bottom: 2),
      child: pw.Text(text, style: pw.TextStyle(fontSize: 7.5, color: _gray, letterSpacing: .5)),
    );

pw.Widget _small(String text) => pw.Padding(
      padding: const pw.EdgeInsets.only(top: 1),
      child: pw.Text(text, style: const pw.TextStyle(fontSize: 8.5, color: _gray)),
    );

pw.Widget _value(String text) => pw.Text(text, style: pw.TextStyle(fontSize: 10, fontWeight: pw.FontWeight.bold, color: _ink));

pw.Widget _th(String text, {pw.TextAlign align = pw.TextAlign.left}) =>
    pw.Text(text, textAlign: align, style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: pdf.PdfColors.white, letterSpacing: .5));

pw.Widget _sectionHeading(String text, {double top = 7}) => pw.Padding(
      padding: pw.EdgeInsets.only(top: top, bottom: 4),
      child: pw.Text(text, style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: _maroon, letterSpacing: .8)),
    );

pw.Widget _beneficiaryRow(String label, String value, {bool bottomBorder = true, pdf.PdfColor? valueColor}) => pw.Container(
      padding: const pw.EdgeInsets.symmetric(vertical: 2),
      decoration: bottomBorder ? const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _borderStrong))) : null,
      child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
        pw.Text(label, style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
        pw.Text(value, style: pw.TextStyle(fontSize: 8.5, fontWeight: pw.FontWeight.bold, color: valueColor ?? _ink)),
      ]),
    );

pw.Widget _beneficiaryBox(InvoiceBeneficiaryAmount b) => pw.Container(
      padding: const pw.EdgeInsets.all(7),
      decoration: const pw.BoxDecoration(
        border: pw.Border(
          top: pw.BorderSide(color: _border),
          right: pw.BorderSide(color: _border),
          bottom: pw.BorderSide(color: _border),
          left: pw.BorderSide(color: _maroon, width: 3),
        ),
      ),
      child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
        _beneficiaryRow('Beneficiary', b.name),
        _beneficiaryRow('Amount payable', _rs(b.amount), valueColor: _maroon),
        _beneficiaryRow('Bank', b.bankName.isNotEmpty ? b.bankName : '—'),
        _beneficiaryRow('Account no.', b.accountNo.isNotEmpty ? b.accountNo : '—'),
        _beneficiaryRow('IFSC', b.ifsc.isNotEmpty ? b.ifsc : '—'),
        _beneficiaryRow('UPI', b.upi.isNotEmpty ? b.upi : '—', bottomBorder: false),
      ]),
    );

pw.Widget _signatureBlock(pw.MemoryImage sig, String name) => pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Image(sig, width: 90, height: 38, fit: pw.BoxFit.contain),
        pw.Container(width: 110, height: 1, color: _ink, margin: const pw.EdgeInsets.only(top: 2)),
        pw.SizedBox(height: 4),
        pw.Text(name, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
        pw.Text('Authorised Signatory', style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
      ],
    );

/// The bundled Inter subset used for the app's UI has no ₹ glyph, so it
/// renders invisibly — "Rs." is the same fallback the web PDF uses.
String _rs(num v) => 'Rs. ${_amount(v)}';

/// The number actually printed on the letterhead is the short series number
/// (e.g. "SMI-26-27-005") — the "_SCH_<CODE>" suffix exists only to make the
/// invoice id unique across schools sharing one sequence.
String _displayInvoiceNo(String invoiceNo) => invoiceNo.replaceAll(RegExp(r'_SCH_[A-Za-z0-9_-]+$'), '');

(String, String)? _previousMonthRange(String invoiceDateIso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(invoiceDateIso);
  final d = m != null ? DateTime.utc(int.parse(m.group(1)!), int.parse(m.group(2)!), 1) : DateTime.now();
  final firstOfInvoiceMonth = DateTime.utc(d.year, d.month, 1);
  final lastOfPrevMonth = firstOfInvoiceMonth.subtract(const Duration(days: 1));
  final firstOfPrevMonth = DateTime.utc(lastOfPrevMonth.year, lastOfPrevMonth.month, 1);
  String iso(DateTime x) => '${x.year.toString().padLeft(4, '0')}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
  return (iso(firstOfPrevMonth), iso(lastOfPrevMonth));
}

// Abbreviated month ("02 Oct 2026") — the invoice date sits in a narrow
// half-column next to the invoice number, where a full month name
// ("October") wraps the year onto its own line.
const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _niceDate(String iso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(iso);
  if (m == null) return iso.isNotEmpty ? iso : '—';
  final y = m.group(1)!, mo = int.parse(m.group(2)!), d = m.group(3)!;
  return '$d ${_months[mo - 1]} $y';
}

String _ddmmyyyy(String iso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(iso);
  if (m == null) return iso;
  return '${m.group(3)}-${m.group(2)}-${m.group(1)}';
}

/// Indian numbering (lakh/crore grouping): 100000 -> "1,00,000". Groups from
/// the right in pairs after the first three digits, built by PREPENDING each
/// group — appending them left-to-right (as this used to) reverses the
/// group order for any amount needing more than one grouping step.
String _amount(num v) {
  final s = v.toInt().toString();
  if (s.length <= 3) return s;
  final last3 = s.substring(s.length - 3);
  var rest = s.substring(0, s.length - 3);
  final parts = <String>[];
  while (rest.length > 2) {
    parts.insert(0, rest.substring(rest.length - 2));
    rest = rest.substring(0, rest.length - 2);
  }
  if (rest.isNotEmpty) parts.insert(0, rest);
  return '${parts.join(',')},$last3';
}

/// Preview + share/save flow — opens the native print/preview sheet.
Future<void> showInvoicePdf(Uint8List bytes, String title) async {
  await Printing.layoutPdf(onLayout: (_) async => bytes, name: title);
}
