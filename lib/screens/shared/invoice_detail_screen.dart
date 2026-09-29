import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../services/invoice_pdf.dart';
import '../../widgets/atoms.dart';

/// One stored invoice snapshot. Read-only — issuing is immutable. Open / share
/// re-renders from the snapshot, never from the student's current profile.
class InvoiceDetailScreen extends StatefulWidget {
  const InvoiceDetailScreen({super.key, required this.invoiceId, required this.staff});
  final String invoiceId;
  final bool staff;
  @override
  State<InvoiceDetailScreen> createState() => _InvoiceDetailScreenState();
}

class _InvoiceDetailScreenState extends State<InvoiceDetailScreen> {
  SchoolInvoice? _inv;
  String? _error;
  bool _busy = true;
  bool _pdfBusy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final inv = await auth.service!.getSchoolInvoice(
        widget.invoiceId,
        branch: auth.branch ?? 'ALL',
      );
      if (!mounted) return;
      setState(() {
        _inv = inv;
        _busy = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _busy = false;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _busy = false;
      });
    }
  }

  Future<void> _openPdf() async {
    final inv = _inv;
    if (inv == null || _pdfBusy) return;
    setState(() => _pdfBusy = true);
    final bytes = await buildInvoicePdf(inv, demo: inv.demo);
    await showInvoicePdf(bytes, '${inv.invoiceNo}.pdf');
    if (mounted) setState(() => _pdfBusy = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) return const Scaffold(body: Center(child: CircularProgressIndicator()));
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Invoice')),
        body: Padding(padding: const EdgeInsets.all(AppSpace.s4), child: ErrorView(_error!, onRetry: _load)),
      );
    }
    final inv = _inv!;
    return Scaffold(
      appBar: AppBar(title: Text(inv.invoiceNo)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          // Same maroon letterhead as the downloaded PDF, so this preview
          // doesn't look like a different, generic document.
          Card(
            clipBehavior: Clip.antiAlias,
            child: Column(children: [
              Container(
                color: _maroon,
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Image.asset('assets/images/logo-mark.png', width: 28, height: 28),
                    const SizedBox(width: AppSpace.s2),
                    const Text('Swar Mangal™', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
                  ]),
                  const SizedBox(height: 2),
                  const Text('SCHOOL INVOICE', style: TextStyle(color: Colors.white70, fontWeight: FontWeight.w700, letterSpacing: 1.2, fontSize: 11)),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  AmountText(inv.amount),
                  const SizedBox(height: AppSpace.s2),
                  StatusBadge(inv.demo ? 'DEMO' : 'ISSUED'),
                ]),
              ),
            ]),
          ),
          const SectionTitle('Issued to'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(children: [
                InfoRow('Class', inv.className.isNotEmpty ? inv.className : '—'),
                InfoRow('Branch', inv.branch.isNotEmpty ? inv.branch : '—'),
                InfoRow('Invoice date', inv.invoiceDate.isNotEmpty ? inv.invoiceDate : '—'),
              ]),
            ),
          ),
          const SectionTitle('Fee'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(children: [
                InfoRow('Description', 'Music Classes'),
                InfoRow('Tenure', inv.tenure),
                InfoRow('Amount', inr(inv.amount), money: true),
              ]),
            ),
          ),
          const SectionTitle('Authorised signatories'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Row(children: [
                Expanded(child: _owner(inv.owner1, 'assets/images/signature-sharvil.png')),
                Expanded(child: _owner(inv.owner2, 'assets/images/signature-piyush.png')),
              ]),
            ),
          ),
          const SizedBox(height: AppSpace.s4),
          FilledButton.icon(
            onPressed: _pdfBusy ? null : _openPdf,
            icon: _pdfBusy
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.picture_as_pdf_outlined),
            label: const Text('Open / Share PDF'),
          ),
          const SizedBox(height: AppSpace.s3),
          Text(
            'This view is a stored snapshot — edited student data is never used to re-render an '
            'issued invoice. Issued invoices are immutable.',
            style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _owner(InvoiceOwner o, String signatureAsset) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        SizedBox(height: 32, child: Image.asset(signatureAsset, fit: BoxFit.contain, alignment: Alignment.centerLeft)),
        const SizedBox(height: 2),
        Container(height: 1, width: 70, color: Theme.of(context).colorScheme.outline),
        const SizedBox(height: 4),
        Text(o.name.isNotEmpty ? o.name : 'Owner', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
        Text(o.title.isNotEmpty ? o.title : 'Authorised Signatory', style: const TextStyle(fontSize: 11, color: AppColors.muted)),
      ]);
}

const _maroon = Color(0xFF7A1F2B);