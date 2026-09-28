import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../services/receipt_pdf.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Receipt detail — the row, a printable PDF, and one-tap WhatsApp to the
/// student's registered number.
class ReceiptDetailScreen extends StatefulWidget {
  const ReceiptDetailScreen({super.key, required this.receipt});
  final ReceiptRow receipt;

  @override
  State<ReceiptDetailScreen> createState() => _ReceiptDetailScreenState();
}

class _ReceiptDetailScreenState extends State<ReceiptDetailScreen> {
  bool _busy = false;
  WaMessage? _sent;
  String? _error;
  String? _correctionNote;
  // One key for this receipt screen: a retry after a network failure returns
  // the original message instead of sending the PDF twice.
  final String _intentKey = 'RCPT-WA-${DateTime.now().microsecondsSinceEpoch}';
  final String _correctionIntentKey = 'RCORR-${DateTime.now().microsecondsSinceEpoch}';

  ReceiptRow get r => widget.receipt;

  Future<void> _openPdf() async {
    final demo = context.read<AuthProvider>().isDemo;
    setState(() => _busy = true);
    try {
      final bytes = await buildReceiptPdf(r, demo: demo);
      await showReceiptPdf(bytes, r.receiptNo);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _sendWhatsApp() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send receipt on WhatsApp?'),
        content: Text(
            'Receipt ${r.receiptNo} goes to ${r.student}\'s registered WhatsApp number. It cannot be unsent.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Send')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final bytes = await buildReceiptPdf(r, demo: auth.isDemo);
      final msg = await auth.service!.sendWhatsAppDocument(
        studentId: r.studentId,
        fileName: '${r.receiptNo}.pdf',
        fileBase64: base64Encode(bytes),
        caption: 'Fee receipt ${r.receiptNo} - Rs ${indianAmount(r.amount)}. Thank you! - SwarMangal Music Academy',
        clientIntentKey: _intentKey,
      );
      if (!mounted) return;
      setState(() => _sent = msg);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _error = '${e.message} Nothing was sent; try again when online.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Pattern C: a receipt is never edited. Staff ask for a correction; the
  /// founder decides — void and reissue, or reject with a reason.
  Future<void> _requestCorrection() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final reasonCtl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Request a correction for ${r.receiptNo}'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('This receipt is never edited. Say what is wrong; Sharvil decides whether to void and reissue it.',
              style: TextStyle(fontSize: 12, color: AppColors.adaptive(ctx, AppColors.muted))),
          const SizedBox(height: AppSpace.s3),
          TextField(controller: reasonCtl, maxLines: 3, decoration: const InputDecoration(labelText: 'What is wrong')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => reasonCtl.text.trim().isEmpty ? null : Navigator.pop(ctx, reasonCtl.text.trim()),
            child: const Text('Send for approval'),
          ),
        ],
      ),
    );
    if (reason == null || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await auth.service!.raw('api_staff_requestReceiptCorrection', {
        'receiptNo': r.receiptNo,
        'reason': reason,
        'clientIntentKey': _correctionIntentKey,
      });
      final m = res as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _correctionNote = m['ok'] == true ? (m['note'] ?? 'Sent for approval.').toString() : (m['error'] ?? 'Could not send the request.').toString());
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Founder-only: void directly, no request needed. Permanent; keeps the number.
  Future<void> _voidDirectly() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final reasonCtl = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Void ${r.receiptNo}'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Permanent. Excluded from every total. Record the payment again to issue a new receipt.',
              style: TextStyle(fontSize: 12, color: AppColors.adaptive(ctx, AppColors.muted))),
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
      _busy = true;
      _error = null;
    });
    try {
      final res = await auth.service!.raw('api_founder_voidReceipt', {'receiptNo': r.receiptNo, 'reason': reasonCtl.text.trim()});
      final m = res as Map<String, dynamic>;
      if (!mounted) return;
      if (m['ok'] == true) {
        setState(() => _correctionNote = (m['note'] ?? 'Voided.').toString());
      } else {
        setState(() => _error = (m['error'] ?? 'Could not void the receipt.').toString());
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final isVoid = r.excluded || r.status.toUpperCase().contains('VOID');
    return Scaffold(
      appBar: AppBar(title: Text(r.receiptNo)),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(children: [
                AmountText(r.amount),
                const SizedBox(height: AppSpace.s2),
                Text(r.student, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
                const SizedBox(height: AppSpace.s2),
                Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
                  StatusBadge(r.status),
                  if (r.excluded) const StatusBadge('EXCLUDED FROM ACCOUNTS'),
                ]),
              ]),
            ),
          ),
          const SectionTitle('Details'),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(children: [
                InfoRow('Receipt no', r.receiptNo),
                InfoRow('Date', r.date.isEmpty ? '—' : r.date),
                InfoRow('Student', r.student),
                InfoRow('Mode', r.mode.isEmpty ? '—' : r.mode),
                InfoRow('Reference / UTR', r.txnId.isEmpty ? '—' : r.txnId),
                InfoRow('Entity', r.entityId.isEmpty ? '—' : r.entityId),
                InfoRow('Fee period', r.feePeriodFrom.isNotEmpty
                    ? '${r.feePeriodFrom} → ${r.feePeriodTo.isEmpty ? '…' : r.feePeriodTo}'
                    : '—'),
                if (r.voidReason.isNotEmpty) InfoRow('Void reason', r.voidReason),
              ]),
            ),
          ),
          if (isVoid)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s2),
              child: Text(
                'This receipt is void. It is excluded from every income and payout total.',
                style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.blockFg), fontWeight: FontWeight.w600),
              ),
            ),
          const SectionTitle('Actions'),
          OutlinedButton.icon(
            onPressed: _busy ? null : _openPdf,
            icon: const Icon(Icons.picture_as_pdf_outlined),
            label: const Text('View / print PDF'),
          ),
          const SizedBox(height: AppSpace.s2),
          if (r.studentId.isEmpty)
            Text(
              'This older receipt is not linked to a student record, so it cannot be sent on WhatsApp from here.',
              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
            )
          else
            LoadingButton(
              label: _sent == null ? 'Send receipt on WhatsApp' : 'Sent ✓',
              icon: Icons.send_outlined,
              busy: _busy,
              onPressed: _sent == null ? _sendWhatsApp : null,
            ),
          if (_sent != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s3),
              child: Card(
                color: AppColors.adaptive(context, _sent!.status == 'DEMO' ? AppColors.warnBg : AppColors.okBg),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s3),
                  child: Text(
                      _sent!.status == 'DEMO'
                          ? 'Demo only — nothing was sent to WhatsApp.'
                          : 'Sent to ${_sent!.to} · ${_sent!.status}. Delivery updates appear in the student\'s message history.',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.adaptive(context, _sent!.status == 'DEMO' ? AppColors.warnFg : AppColors.okFg))),
                ),
              ),
            ),
          if (!isVoid) ...[
            const SizedBox(height: AppSpace.s3),
            // Pattern C: no "edit receipt" affordance anywhere in this app.
            OutlinedButton.icon(
              onPressed: _busy
                  ? null
                  : auth.isFounder
                      ? _voidDirectly
                      : _requestCorrection,
              icon: Icon(auth.isFounder ? Icons.block_outlined : Icons.report_problem_outlined, color: AppColors.adaptive(context, AppColors.blockFg)),
              label: Text(auth.isFounder ? 'Void receipt' : 'Request a correction',
                  style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg))),
              style: OutlinedButton.styleFrom(side: BorderSide(color: AppColors.adaptive(context, AppColors.blockFg))),
            ),
          ],
          if (_correctionNote != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s3),
              child: Card(
                color: AppColors.adaptive(context, AppColors.infoBg),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s3),
                  child: Text(_correctionNote!, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.infoFg))),
                ),
              ),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s3),
              child: ErrorView(_error!, compact: true),
            ),
        ],
      ),
    );
  }
}
