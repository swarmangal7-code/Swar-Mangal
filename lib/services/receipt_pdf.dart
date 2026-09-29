import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart' as pdf;
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/models.dart';

/// Same letterhead brand as the school invoice (buildInvoicePdf in
/// invoice_pdf.dart) — one visual identity for every document the academy
/// issues, real logo and both authorised signatures included.
const _maroon = pdf.PdfColor.fromInt(0x7A1F2B);
const _cream = pdf.PdfColor.fromInt(0xFAF6EF);
const _border = pdf.PdfColor.fromInt(0xE6DDD3);
const _pillBg = pdf.PdfColor.fromInt(0xF3E7E6);
const _ink = pdf.PdfColor.fromInt(0x2B2B2B);
const _gray = pdf.PdfColor.fromInt(0x6B6B6B);

const _months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

String _niceDate(String iso) {
  final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})').firstMatch(iso);
  if (m == null) return iso.isNotEmpty ? iso : '—';
  return '${m.group(3)} ${_months[int.parse(m.group(2)!) - 1]} ${m.group(1)}';
}

/// A5 fee receipt rendered from the server's receipt row. The app only lays
/// out figures the server already decided (amount, number, dates); it never
/// computes any of them.
Future<Uint8List> buildReceiptPdf(ReceiptRow r, {bool demo = false}) async {
  final doc = pw.Document();
  final regular = pw.Font.ttf(await rootBundle.load('assets/fonts/Inter-400.ttf'));
  final bold = pw.Font.ttf(await rootBundle.load('assets/fonts/Inter-700.ttf'));
  final serifBold = pw.Font.ttf(await rootBundle.load('assets/fonts/PlayfairDisplay-700.ttf'));
  final theme = pw.ThemeData.withFont(base: regular, bold: bold);

  final logo = pw.MemoryImage((await rootBundle.load('assets/images/logo-mark.png')).buffer.asUint8List());
  final sigSharvil = pw.MemoryImage((await rootBundle.load('assets/images/signature-sharvil.png')).buffer.asUint8List());
  final sigPiyush = pw.MemoryImage((await rootBundle.load('assets/images/signature-piyush.png')).buffer.asUint8List());

  final isVoid = r.status.toUpperCase() == 'VOID';
  final branchLabel = r.entityId == 'ENT-GOREGAON' ? 'GOREGAON' : 'KANDIVALI';

  pw.Widget row(String label, String value, {bool zebra = false, bool last = false}) => pw.Container(
        padding: const pw.EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: pw.BoxDecoration(
          color: zebra ? _cream : null,
          border: last ? null : const pw.Border(bottom: pw.BorderSide(color: _border)),
        ),
        child: pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.SizedBox(
            width: 90,
            child: pw.Text(label.toUpperCase(), style: const pw.TextStyle(fontSize: 7, color: _gray)),
          ),
          pw.Expanded(child: pw.Text(value.isEmpty ? '—' : value, style: pw.TextStyle(fontSize: 9.5, fontWeight: pw.FontWeight.bold, color: _ink))),
        ]),
      );

  final period = r.feePeriodFrom.isNotEmpty
      ? (r.feePeriodTo.isNotEmpty ? '${_niceDate(r.feePeriodFrom)} to ${_niceDate(r.feePeriodTo)}' : 'from ${_niceDate(r.feePeriodFrom)}')
      : '';

  final rows = <pw.Widget Function({required bool zebra, required bool last})>[
    ({required zebra, required last}) => row('Received from', r.student, zebra: zebra, last: last),
    ({required zebra, required last}) => row('Date', _niceDate(r.date), zebra: zebra, last: last),
    ({required zebra, required last}) => row('Payment mode', r.paymentMode.isNotEmpty ? r.paymentMode : r.mode, zebra: zebra, last: last),
    if (r.txnId.isNotEmpty) ({required zebra, required last}) => row('Reference / UTR', r.txnId, zebra: zebra, last: last),
    if (period.isNotEmpty) ({required zebra, required last}) => row('Fee period', period, zebra: zebra, last: last),
    ({required zebra, required last}) => row('Status', isVoid ? 'VOID' : 'PAID', zebra: zebra, last: last),
  ];

  doc.addPage(
    pw.Page(
      theme: theme,
      pageFormat: pdf.PdfPageFormat.a5,
      margin: const pw.EdgeInsets.all(28),
      build: (_) => pw.Stack(children: [
        pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, crossAxisAlignment: pw.CrossAxisAlignment.center, children: [
            pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.center, children: [
              pw.Image(logo, width: 26, height: 26),
              pw.SizedBox(width: 7),
              pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Text('Swar Mangal™', style: pw.TextStyle(font: serifBold, fontSize: 13, color: _maroon)),
                pw.Text('MUSIC ACADEMY · $branchLabel', style: const pw.TextStyle(fontSize: 6.5, color: _gray)),
              ]),
            ]),
            pw.Text('RECEIPT', style: pw.TextStyle(font: serifBold, fontSize: 15, color: pdf.PdfColors.grey900)),
          ]),
          pw.Container(height: 2, color: _maroon, margin: const pw.EdgeInsets.only(top: 6, bottom: 10)),

          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
            pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Container(
                padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: pw.BoxDecoration(color: _pillBg, borderRadius: pw.BorderRadius.circular(3)),
                child: pw.Text('FEE RECEIPT', style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: _maroon)),
              ),
              if (isVoid) pw.Padding(
                padding: const pw.EdgeInsets.only(top: 3),
                child: pw.Text('VOID — excluded from totals', style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: _maroon)),
              ),
            ]),
            pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
              pw.Text(r.receiptNo, style: pw.TextStyle(fontSize: 10.5, fontWeight: pw.FontWeight.bold, color: _maroon)),
              pw.Text(_niceDate(r.date), style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
            ]),
          ]),
          pw.SizedBox(height: 10),

          pw.Container(
            decoration: pw.BoxDecoration(border: pw.Border.all(color: _border), borderRadius: pw.BorderRadius.circular(3)),
            child: pw.Column(children: [
              for (var i = 0; i < rows.length; i++) rows[i](zebra: i % 2 == 1, last: i == rows.length - 1),
            ]),
          ),
          pw.SizedBox(height: 12),

          pw.Container(
            padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            decoration: const pw.BoxDecoration(
              color: _pillBg,
              border: pw.Border(left: pw.BorderSide(color: _maroon, width: 4)),
            ),
            child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
              pw.Text('AMOUNT RECEIVED', style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
              pw.Text('Rs. ${indianAmount(r.amount)}', style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: _maroon)),
            ]),
          ),
          pw.SizedBox(height: 4),
          pw.Text('Amount received as stated above.', style: const pw.TextStyle(fontSize: 7.5, color: _gray)),
          pw.SizedBox(height: 14),

          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
            _signatureBlock(sigSharvil, 'Sharvil Vaidya'),
            _signatureBlock(sigPiyush, 'Piyush Kashyap'),
          ]),

          if (demo) ...[
            pw.SizedBox(height: 10),
            pw.Center(child: pw.Text('DEMO — NOT A REAL RECEIPT', style: const pw.TextStyle(fontSize: 9, color: pdf.PdfColors.red))),
          ],

          pw.Spacer(),
          pw.Container(height: 1, color: _border),
          pw.SizedBox(height: 6),
          pw.Center(
            child: pw.Column(children: [
              pw.Text('Swar Mangal™ Music Academy', style: pw.TextStyle(fontSize: 7.5, fontWeight: pw.FontWeight.bold, color: _maroon)),
              pw.Text('Branches: Goregaon | Kandivali · +91-9769419519 | +91-8169222089', style: const pw.TextStyle(fontSize: 6.5, color: _gray)),
            ]),
          ),
        ]),
        // Painted last so it overlays every card/box instead of sitting
        // behind them — Stack paints children in order, first = bottom.
        pw.Positioned.fill(
          child: pw.Center(
            child: pw.Transform.rotateBox(
              angle: -0.38,
              child: pw.Opacity(
                opacity: 0.5,
                child: pw.Text(isVoid ? 'VOID' : 'PAID',
                    style: pw.TextStyle(font: serifBold, fontSize: 46, color: _border)),
              ),
            ),
          ),
        ),
      ]),
    ),
  );
  return doc.save();
}

pw.Widget _signatureBlock(pw.MemoryImage sig, String name) => pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.center,
      children: [
        pw.Image(sig, width: 70, height: 30, fit: pw.BoxFit.contain),
        pw.Container(width: 82, height: 1, color: _ink, margin: const pw.EdgeInsets.only(top: 2)),
        pw.SizedBox(height: 3),
        pw.Text(name, style: pw.TextStyle(fontSize: 8, fontWeight: pw.FontWeight.bold)),
        pw.Text('Authorised Signatory', style: const pw.TextStyle(fontSize: 6.5, color: _gray)),
      ],
    );

/// Indian numbering (lakh/crore grouping): 184500 -> "1,84,500"; keeps paise
/// when present.
String indianAmount(num value) {
  final whole = value.truncate();
  final paise = ((value - whole) * 100).round();
  var digits = whole.abs().toString();
  String grouped;
  if (digits.length <= 3) {
    grouped = digits;
  } else {
    final last3 = digits.substring(digits.length - 3);
    var rest = digits.substring(0, digits.length - 3);
    final parts = <String>[];
    while (rest.length > 2) {
      parts.insert(0, rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) parts.insert(0, rest);
    grouped = '${parts.join(',')},$last3';
  }
  final sign = value < 0 ? '-' : '';
  return paise == 0 ? '$sign$grouped' : '$sign$grouped.${paise.toString().padLeft(2, '0')}';
}

Future<void> showReceiptPdf(Uint8List bytes, String title) async {
  await Printing.layoutPdf(onLayout: (_) async => bytes, name: title);
}
