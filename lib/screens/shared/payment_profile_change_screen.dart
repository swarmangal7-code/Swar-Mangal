import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../state/auth_provider.dart';

/// Staff proposes a change to how a branch's entity is paid on invoices
/// (label + masked hint only — never raw bank numbers, brief §5.5). The
/// founder decides.
class PaymentProfileChangeScreen extends StatefulWidget {
  const PaymentProfileChangeScreen({super.key, required this.entityId});
  final String entityId;
  @override
  State<PaymentProfileChangeScreen> createState() => _PaymentProfileChangeScreenState();
}

class _PaymentProfileChangeScreenState extends State<PaymentProfileChangeScreen> {
  final _label = TextEditingController();
  final _hint = TextEditingController();
  final _reason = TextEditingController();
  late final String _intentKey;
  bool _busy = false;
  bool? _ok;
  String? _result;

  @override
  void initState() {
    super.initState();
    _intentKey = 'PPCHG-${DateTime.now().microsecondsSinceEpoch}';
  }

  @override
  void dispose() {
    _label.dispose();
    _hint.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    if (_label.text.trim().isEmpty) {
      setState(() => _result = 'Describe the new payment profile.');
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _result = 'Say why it is changing.');
      return;
    }
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final r = await auth.service!.raw('api_staff_submitPaymentProfileChangeRequest', {
        'entityId': widget.entityId,
        'requestedLabel': _label.text.trim(),
        'requestedMaskedHint': _hint.text.trim(),
        'reason': _reason.text.trim(),
        'branch': auth.branch ?? '',
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
      appBar: AppBar(title: const Text('Request payment profile change')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Text(widget.entityId, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          const SizedBox(height: AppSpace.s4),
          TextField(
            controller: _label,
            decoration: const InputDecoration(labelText: 'New payment profile label (bank + account name)'),
          ),
          const SizedBox(height: AppSpace.s3),
          TextField(
            controller: _hint,
            decoration: const InputDecoration(labelText: 'Masked hint shown on invoices (optional, e.g. ····4821)'),
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
