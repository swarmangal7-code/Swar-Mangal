import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';

/// Staff proposes waiving a student's late fee; the founder decides
/// (brief §2.2). submitted_by is always the authenticated session, never a
/// client-supplied field, so the actor is never blank.
class LateFeeWaiverScreen extends StatefulWidget {
  const LateFeeWaiverScreen({super.key, required this.student});
  final Student student;
  @override
  State<LateFeeWaiverScreen> createState() => _LateFeeWaiverScreenState();
}

class _LateFeeWaiverScreenState extends State<LateFeeWaiverScreen> {
  final _amount = TextEditingController();
  final _newDueDate = TextEditingController();
  final _reason = TextEditingController();
  late final String _intentKey;
  bool _busy = false;
  bool? _ok;
  String? _result;
  num? _suggestedAmount;

  @override
  void initState() {
    super.initState();
    _intentKey = 'WAIVER-${DateTime.now().microsecondsSinceEpoch}';
    _loadSuggestedAmount();
  }

  Future<void> _loadSuggestedAmount() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final amount = await auth.service!.previewAccruedLateFee(widget.student.studentId);
      if (!mounted) return;
      setState(() => _suggestedAmount = amount);
    } catch (_) {
      // Non-fatal — the server still defaults to the real computed amount
      // when the field is left blank, this is only a UI preview.
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    _newDueDate.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    if (_reason.text.trim().isEmpty) {
      setState(() => _result = 'Say why the late fee is being waived.');
      return;
    }
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final amount = num.tryParse(_amount.text.trim());
      final r = await auth.service!.raw('api_staff_submitLateFeeWaiverRequest', {
        'studentId': widget.student.studentId,
        if (amount != null && amount > 0) 'waivedAmount': amount,
        if (_newDueDate.text.trim().isNotEmpty) 'newNextDueDate': _newDueDate.text.trim(),
        'reason': _reason.text.trim(),
        'clientIntentKey': _intentKey,
      });
      final m = r as Map<String, dynamic>;
      final demo = auth.isDemo || m['demo'] == true;
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = m['ok'] == true;
        _result = m['ok'] == true ? (m['note'] ?? 'Sent for approval.').toString() : (m['error'] ?? 'Could not save.').toString();
        if (demo && _ok == true) _result = '$_result (DEMO — not persisted)';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = false;
        _result = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = false;
        _result = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Request late-fee waiver')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Text(widget.student.studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(widget.student.studentId, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: AppSpace.s4),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: InputDecoration(
              labelText: 'Late fee amount (optional)',
              // The server defaults this to the real day-by-day accrued late
              // fee (accruedLateFee in fees.ts) when left blank. The hint text
              // below previews that same computed figure via
              // api_previewAccruedLateFee — type a number only to override it
              // for a deliberate partial waiver.
              hintText: _suggestedAmount != null ? 'Computed: ₹${_suggestedAmount!.toStringAsFixed(0)}' : null,
              helperText: 'Leave blank to waive the actual computed late fee shown above. Type a number only for a deliberate partial waiver.',
              helperMaxLines: 2,
            ),
          ),
          const SizedBox(height: AppSpace.s3),
          TextField(
            controller: _newDueDate,
            decoration: const InputDecoration(labelText: 'New due date (optional, YYYY-MM-DD)'),
          ),
          const SizedBox(height: AppSpace.s3),
          TextField(
            controller: _reason,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Reason (required)'),
          ),
          const SizedBox(height: AppSpace.s4),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Send for approval'),
          ),
          if (_result != null) ...[
            const SizedBox(height: AppSpace.s3),
            Text(_result!, style: TextStyle(color: _ok == true ? AppColors.okFg : AppColors.blockFg)),
          ],
        ],
      ),
    );
  }
}
