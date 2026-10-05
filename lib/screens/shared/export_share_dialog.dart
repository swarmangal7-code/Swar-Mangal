import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../services/api_service.dart';
import '../../state/auth_provider.dart';

/// Which PDF route to hit and which WhatsApp "share kind" to record — mirrors
/// the web ExportShareDialog's `docKind`.
enum ExportShareDocKind { timetable, feeStructure }

/// Founder request 2026-10-05: export the Timetable or Fee Rate Card as a PDF
/// filtered to one or more instruments, and optionally share it on WhatsApp
/// to a hand-typed phone number — a deliberate, explicit exception to the
/// "student's registered phone only" rule (see the comment at the top of
/// src/lib/rpc/messaging.ts on the backend), because this PDF is
/// public-facing informational material with no student-specific data in it.
/// Reusable between the Timetable screen and the Fee Rate Card screens, same
/// as the web's single ExportShareDialog component.
Future<void> showExportShareDialog(
  BuildContext context, {
  required ExportShareDocKind docKind,
  required String documentLabel,
  String branch = 'ALL',
}) {
  return showDialog<void>(
    context: context,
    builder: (_) => _ExportShareDialog(docKind: docKind, documentLabel: documentLabel, branch: branch),
  );
}

class _ExportShareDialog extends StatefulWidget {
  const _ExportShareDialog({required this.docKind, required this.documentLabel, required this.branch});
  final ExportShareDocKind docKind;
  final String documentLabel;
  final String branch;
  @override
  State<_ExportShareDialog> createState() => _ExportShareDialogState();
}

class _ExportShareDialogState extends State<_ExportShareDialog> {
  List<String> _instruments = [];
  final Set<String> _selected = {};
  bool _loadingInstruments = true;
  bool _fetching = false;
  bool _sharing = false;
  String? _error;
  final _phone = TextEditingController();
  late final String _intentKey = 'WA-SHARE-${widget.docKind.name}-${DateTime.now().millisecondsSinceEpoch}';

  @override
  void initState() {
    super.initState();
    _loadInstruments();
  }

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _loadInstruments() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final list = await auth.service!.listInstruments();
      if (!mounted) return;
      setState(() {
        _instruments = list;
        _loadingInstruments = false;
      });
    } catch (_) {
      // Instrument filter is optional — fall back to an unfiltered export.
      if (!mounted) return;
      setState(() => _loadingInstruments = false);
    }
  }

  Future<Uint8List> _fetchBytes(ApiService service) {
    final list = _selected.toList();
    return widget.docKind == ExportShareDocKind.timetable
        ? service.fetchTimetablePdf(branch: widget.branch, instruments: list)
        : service.fetchFeeStructurePdf(instruments: list);
  }

  String _fileName() => widget.docKind == ExportShareDocKind.timetable ? 'timetable.pdf' : 'fee-rate-card.pdf';
  String _shareKind() => widget.docKind == ExportShareDocKind.timetable ? 'TIMETABLE_SHARE' : 'FEE_STRUCTURE_SHARE';

  Future<void> _downloadOrPreview() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _fetching = true;
      _error = null;
    });
    try {
      final bytes = await _fetchBytes(auth.service!);
      if (!mounted) return;
      // Same preview/print/save sheet the invoice PDF already uses.
      await Printing.layoutPdf(onLayout: (_) async => bytes, name: _fileName());
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } on ApiUnreachable catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _fetching = false);
    }
  }

  Future<void> _share() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final digits = _phone.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) {
      setState(() => _error = 'Enter a valid 10-digit phone number.');
      return;
    }
    setState(() {
      _sharing = true;
      _error = null;
    });
    try {
      final bytes = await _fetchBytes(auth.service!);
      final msg = await auth.service!.shareDocumentViaWhatsApp(
        phone: digits,
        kind: _shareKind(),
        fileName: _fileName(),
        fileBase64: base64Encode(bytes),
        caption: 'Swar Mangal ${widget.documentLabel}',
        clientIntentKey: _intentKey,
      );
      if (!mounted) return;
      Navigator.pop(context);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(msg.status == 'DEMO'
            ? 'DEMO — not actually sent.'
            : '${widget.documentLabel} shared on WhatsApp.'),
      ));
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } on ApiUnreachable catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final demo = context.watch<AuthProvider>().isDemo;
    return AlertDialog(
      title: Text('Export / Share ${widget.documentLabel}'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(
            'Filter by instrument, then download the PDF or share it on WhatsApp to any number — '
            'this does not have to be a student\'s registered number.',
            style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
          ),
          const SizedBox(height: AppSpace.s3),
          Text('INSTRUMENTS (leave all unchecked for everything)', style: AppType.eyebrow.copyWith(fontSize: 10)),
          const SizedBox(height: 6),
          if (_loadingInstruments)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 8),
              child: SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (_instruments.isEmpty)
            Text('No instruments configured yet.', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)))
          else
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                for (final name in _instruments)
                  FilterChip(
                    label: Text(name, style: const TextStyle(fontSize: 12)),
                    selected: _selected.contains(name),
                    onSelected: (sel) => setState(() => sel ? _selected.add(name) : _selected.remove(name)),
                  ),
              ],
            ),
          const SizedBox(height: AppSpace.s4),
          if (demo)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpace.s2),
              child: Text(
                'PDF export/share is not available in demo mode — there is no real server to render the PDF against.',
                style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg)),
              ),
            ),
          OutlinedButton.icon(
            onPressed: demo || _fetching ? null : _downloadOrPreview,
            icon: _fetching
                ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.download_outlined),
            label: const Text('Download / Preview PDF'),
          ),
          const SizedBox(height: AppSpace.s4),
          Text('SHARE ON WHATSAPP — PHONE NUMBER', style: AppType.eyebrow.copyWith(fontSize: 10)),
          const SizedBox(height: 6),
          TextField(
            controller: _phone,
            keyboardType: TextInputType.phone,
            enabled: !demo,
            decoration: const InputDecoration(hintText: 'e.g. 98200 11223', prefixIcon: Icon(Icons.phone_outlined)),
          ),
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'Not tied to any student record — type in any number to send this ${widget.documentLabel.toLowerCase()} PDF to.',
              style: TextStyle(fontSize: 11, color: AppColors.adaptive(context, AppColors.muted)),
            ),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s2),
              child: Text(_error!, style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg), fontSize: 13)),
            ),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close')),
        FilledButton.icon(
          onPressed: demo || _sharing ? null : _share,
          icon: _sharing
              ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.chat_outlined),
          label: const Text('Share on WhatsApp'),
        ),
      ],
    );
  }
}
