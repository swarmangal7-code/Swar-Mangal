import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';

/// Staff proposes extending a student's package/fee cycle; the founder
/// decides (brief §2.2). This never touches next_due_date on the device —
/// the server computes the new date when it approves.
class PackageExtensionScreen extends StatefulWidget {
  const PackageExtensionScreen({super.key, required this.student});
  final Student student;
  @override
  State<PackageExtensionScreen> createState() => _PackageExtensionScreenState();
}

class _PackageExtensionScreenState extends State<PackageExtensionScreen> {
  final _months = TextEditingController(text: '1');
  final _reason = TextEditingController();
  late final String _intentKey;
  bool _busy = false;
  bool? _ok;
  String? _result;

  @override
  void initState() {
    super.initState();
    _intentKey = 'PKGEXT-${DateTime.now().microsecondsSinceEpoch}';
  }

  @override
  void dispose() {
    _months.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final months = int.tryParse(_months.text.trim()) ?? 0;
    if (months <= 0) {
      setState(() => _result = 'Enter how many extra months to add.');
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _result = 'Say why the package is being extended.');
      return;
    }
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final r = await auth.service!.raw('api_staff_submitPackageExtensionRequest', {
        'studentId': widget.student.studentId,
        'extraMonths': months,
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
      appBar: AppBar(title: const Text('Request package extension')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Text(widget.student.studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(widget.student.studentId, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: AppSpace.s4),
          TextField(
            controller: _months,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Extra months (1-24)'),
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
