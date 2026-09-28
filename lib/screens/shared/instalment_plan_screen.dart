import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';

/// Staff proposes an instalment plan; the founder creates the real schedule
/// on approval (brief §6.1/§2.6). The device never computes an instalment
/// amount — the server splits the total and decides what each one is.
class InstalmentPlanScreen extends StatefulWidget {
  const InstalmentPlanScreen({super.key, required this.student});
  final Student student;
  @override
  State<InstalmentPlanScreen> createState() => _InstalmentPlanScreenState();
}

class _InstalmentPlanScreenState extends State<InstalmentPlanScreen> {
  final _amount = TextEditingController();
  final _count = TextEditingController(text: '3');
  final _firstDueDate = TextEditingController();
  final _cadenceDays = TextEditingController(text: '30');
  final _notes = TextEditingController();
  late final String _intentKey;
  bool _busy = false;
  bool? _ok;
  String? _result;

  @override
  void initState() {
    super.initState();
    _intentKey = 'INSTDRAFT-${DateTime.now().microsecondsSinceEpoch}';
    final n = DateTime.now();
    _firstDueDate.text = '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _amount.dispose();
    _count.dispose();
    _firstDueDate.dispose();
    _cadenceDays.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final amount = num.tryParse(_amount.text.trim()) ?? 0;
    final count = int.tryParse(_count.text.trim()) ?? 0;
    if (amount <= 0) {
      setState(() => _result = 'Enter the total amount the plan covers.');
      return;
    }
    if (count < 2 || count > 12) {
      setState(() => _result = 'Split into 2-12 instalments.');
      return;
    }
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final r = await auth.service!.raw('api_staff_submitInstalmentPlanDraft', {
        'studentId': widget.student.studentId,
        'totalAmount': amount,
        'instalmentCount': count,
        'firstDueDate': _firstDueDate.text.trim(),
        'cadenceDays': int.tryParse(_cadenceDays.text.trim()) ?? 30,
        'notes': _notes.text.trim(),
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
      appBar: AppBar(title: const Text('Request instalment plan')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Text(widget.student.studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(widget.student.studentId, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: AppSpace.s4),
          TextField(
            controller: _amount,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            decoration: const InputDecoration(labelText: 'Total amount (INR)'),
          ),
          const SizedBox(height: AppSpace.s3),
          TextField(
            controller: _count,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Number of instalments (2-12)'),
          ),
          const SizedBox(height: AppSpace.s3),
          TextField(
            controller: _firstDueDate,
            decoration: const InputDecoration(labelText: 'First instalment due date (YYYY-MM-DD)'),
          ),
          const SizedBox(height: AppSpace.s3),
          TextField(
            controller: _cadenceDays,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Days between instalments'),
          ),
          const SizedBox(height: AppSpace.s3),
          TextField(
            controller: _notes,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Notes (optional)'),
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
