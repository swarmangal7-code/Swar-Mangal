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
  bool _voidBusy = false;
  String? _voidError;

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

  /// Founder-only: a school invoice is never deleted or edited in place —
  /// only voided (mirrors receipt void exactly). Permanent; keeps the
  /// invoice number. "Editing" means voiding this one and generating a
  /// fresh, correct one with the generate-invoice screen.
  Future<void> _voidInvoice() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null || _inv == null) return;
    final reasonCtl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Void ${_inv!.invoiceNo}'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            'An invoice is never edited in place or deleted — voiding keeps the number '
            '(it\'s never reused) and excludes it from totals. To issue a corrected invoice, '
            'void this one and generate a fresh one.',
            style: TextStyle(fontSize: 12, color: AppColors.adaptive(ctx, AppColors.muted)),
          ),
          const SizedBox(height: AppSpace.s3),
          TextField(controller: reasonCtl, decoration: const InputDecoration(labelText: 'Reason (required)')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.adaptive(ctx, AppColors.blockFg)),
            onPressed: () => reasonCtl.text.trim().isEmpty ? null : Navigator.pop(ctx, true),
            child: const Text('Void'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _voidBusy = true;
      _voidError = null;
    });
    try {
      final res = await auth.service!.voidSchoolInvoice(invoiceId: widget.invoiceId, reason: reasonCtl.text.trim());
      if (!mounted) return;
      if (res['ok'] == true) {
        await _load();
      } else {
        setState(() => _voidError = (res['error'] ?? 'Could not void the invoice.').toString());
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _voidError = e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _voidError = e.message);
    } finally {
      if (mounted) setState(() => _voidBusy = false);
    }
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
    final auth = context.watch<AuthProvider>();
    final isVoid = inv.status.toUpperCase() == 'VOID';
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
                  AmountText(inv.total),
                  const SizedBox(height: AppSpace.s2),
                  Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, alignment: WrapAlignment.center, children: [
                    StatusBadge(inv.demo ? 'DEMO' : 'ISSUED'),
                    if (isVoid) const StatusBadge('VOID'),
                  ]),
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
                if (isVoid && inv.voidReason.isNotEmpty) InfoRow('Void reason', inv.voidReason),
              ]),
            ),
          ),
          if (isVoid)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s2),
              child: Text(
                'This invoice is void. It is excluded from every total. Generate a new '
                'invoice to issue a corrected one — the number is never reused.',
                style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.blockFg), fontWeight: FontWeight.w600),
              ),
            ),
          const SectionTitle('Fee'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(children: [
                InfoRow('Description', 'Music Classes'),
                InfoRow('Tenure', inv.tenure),
                InfoRow(inv.charges.isEmpty ? 'Amount' : 'Fixed amount', inr(inv.amount), money: true),
                if (inv.charges.isNotEmpty) ...[
                  for (final c in inv.charges)
                    InfoRow(c.description.isNotEmpty ? c.description : '—', inr(c.amount), money: true),
                  const Divider(),
                  InfoRow('Total', inr(inv.total), money: true),
                ],
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
          if (auth.isFounder && !isVoid) ...[
            const SizedBox(height: AppSpace.s3),
            // Never deleted or edited in place — only voided. "Editing" an
            // invoice means voiding this one and generating a fresh one.
            OutlinedButton.icon(
              onPressed: _voidBusy ? null : _voidInvoice,
              icon: _voidBusy
                  ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                  : Icon(Icons.block_outlined, color: AppColors.adaptive(context, AppColors.blockFg)),
              label: Text('Void invoice', style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg))),
              style: OutlinedButton.styleFrom(side: BorderSide(color: AppColors.adaptive(context, AppColors.blockFg))),
            ),
          ],
          if (_voidError != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s3),
              child: ErrorView(_voidError!, compact: true),
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