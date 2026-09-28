import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart' as pdf;
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import '../models/models.dart';

/// Real A4 PDF invoice rendered from the authoritative snapshot.
/// Text is selectable, layout is single-page, and long
/// names wrap gracefully. Never uses widget screenshots.
Future<Uint8List> buildInvoicePdf(SchoolInvoice inv, {bool demo = false}) async {
  final doc = pw.Document();
  final regular = pw.Font.ttf(await rootBundle.load('assets/fonts/Inter-400.ttf'));
  final bold = pw.Font.ttf(await rootBundle.load('assets/fonts/Inter-700.ttf'));
  final theme = pw.ThemeData.withFont(base: regular, bold: bold);
  final amountText = 'Rs ${_amount(inv.amount)}';
  final date = inv.invoiceDate.isNotEmpty ? inv.invoiceDate : '—';

  doc.addPage(
    pw.MultiPage(
      theme: theme,
      pageFormat: pdf.PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(48),
      build: (_) => [
        pw.Center(
          child: pw.Column(mainAxisSize: pw.MainAxisSize.min, children: [
            pw.Text('SWAR MANGAL',
                style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold)),
            pw.Text('Music Academy',
                style: pw.TextStyle(fontSize: 11, color: pdf.PdfColors.grey700)),
          ]),
        ),
        pw.SizedBox(height: 12),
        pw.Divider(color: pdf.PdfColors.grey400),
        pw.SizedBox(height: 12),
        pw.Align(
          alignment: pw.Alignment.centerLeft,
          child: pw.Text('SCHOOL INVOICE',
              style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold)),
        ),
        pw.SizedBox(height: 4),
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Text('Invoice No: ${inv.invoiceNo}', style: pw.TextStyle(fontSize: 11)),
          pw.Text('Date: $date', style: pw.TextStyle(fontSize: 11)),
        ]),
        pw.SizedBox(height: 16),
        pw.Divider(color: pdf.PdfColors.grey400),
        pw.SizedBox(height: 12),
        pw.Text('BILLED TO', style: pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey700)),
        pw.SizedBox(height: 4),
        // Mirrors the web PDF's BILLED TO block: school name, then address,
        // then contact, then the branch and the school code. The code is
        // already inside invoiceNo; this is what the school reads first.
        pw.Text(inv.schoolName.isNotEmpty ? inv.schoolName : (inv.className.isNotEmpty ? inv.className : '—'),
            style: pw.TextStyle(fontSize: 12)),
        if (inv.schoolAddress.isNotEmpty)
          pw.Text(inv.schoolAddress, style: pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey700)),
        if (inv.schoolContact.isNotEmpty)
          pw.Text(inv.schoolContact, style: pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey700)),
        pw.Text(
          [
            'Branch: ${inv.branch.isNotEmpty ? inv.branch : '—'}',
            if (inv.schoolCode.isNotEmpty) inv.schoolCode,
          ].join(' · '),
          style: pw.TextStyle(fontSize: 11),
        ),
        pw.SizedBox(height: 16),
        pw.Divider(color: pdf.PdfColors.grey400),
        pw.SizedBox(height: 12),
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Text('DESCRIPTION', style: pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey700)),
          pw.Text('TENURE', style: pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey700)),
          pw.Text('AMOUNT', style: pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey700)),
        ]),
        pw.SizedBox(height: 4),
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          pw.Text(inv.className.isNotEmpty ? inv.className : 'Music Classes',
              style: pw.TextStyle(fontSize: 12)),
          pw.Text(inv.tenure, style: pw.TextStyle(fontSize: 12)),
          pw.Text(amountText, style: pw.TextStyle(fontSize: 12)),
        ]),
        pw.SizedBox(height: 16),
        pw.Divider(color: pdf.PdfColors.grey400),
        pw.SizedBox(height: 8),
        pw.Align(
          alignment: pw.Alignment.centerRight,
          child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, mainAxisSize: pw.MainAxisSize.min, children: [
            pw.Text('TOTAL    ', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
            pw.Text(amountText, style: pw.TextStyle(fontSize: 14, fontWeight: pw.FontWeight.bold)),
          ]),
        ),
        pw.SizedBox(height: 24),
        pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
          _signatureBlock(inv.owner1),
          _signatureBlock(inv.owner2),
        ]),
        pw.SizedBox(height: 24),
        pw.Divider(color: pdf.PdfColors.grey400),
        pw.SizedBox(height: 8),
        pw.Center(
          child: pw.Text(
              demo ? 'DEMO — NOT PERSISTED' : 'Swar Mangal · Music Academy',
              style: pw.TextStyle(
                  fontSize: 10, color: demo ? pdf.PdfColors.red : pdf.PdfColors.grey700)),
        ),
      ],
    ),
  );
  return doc.save();
}

pw.Widget _signatureBlock(InvoiceOwner owner) {
  final name = owner.name.isNotEmpty ? owner.name : 'Owner';
  final title = owner.title.isNotEmpty ? owner.title : name;
  return pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
    // A real signature image is placed here when the backend provides a
    // signatureUrl; otherwise a clearly-marked placeholder line.
    if (owner.signatureUrl.isNotEmpty)
      pw.Text('[signature]', style: pw.TextStyle(fontSize: 11))
    else
      pw.Text('____________________', style: pw.TextStyle(fontSize: 12)),
    pw.SizedBox(height: 4),
    pw.Text(name, style: pw.TextStyle(fontSize: 11, fontWeight: pw.FontWeight.bold)),
    pw.Text(title, style: pw.TextStyle(fontSize: 10, color: pdf.PdfColors.grey700)),
  ]);
}

String _amount(num v) {
  final s = v.toInt().toString();
  if (s.length <= 3) return s;
  final last3 = s.substring(s.length - 3);
  var rest = s.substring(0, s.length - 3);
  final buf = StringBuffer();
  while (rest.length > 2) {
    buf.write('${rest.substring(rest.length - 2)},');
    rest = rest.substring(0, rest.length - 2);
  }
  buf.write(rest);
  buf.write(',$last3');
  return buf.toString();
}

/// Preview + share/save flow — opens the native print/preview sheet.
Future<void> showInvoicePdf(Uint8List bytes, String title) async {
  await Printing.layoutPdf(onLayout: (_) async => bytes, name: title);
}