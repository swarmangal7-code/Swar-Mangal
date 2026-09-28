import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';

/// Staff-requested pause/resume for genuine leave — the founder-only direct
/// status change already exists on the profile screen's menu; this is the
/// staff-side proposal that flows into the same approval pipeline as any
/// other student edit (api_staff_saveStudentDraft's lifecycleStatus/
/// statusReason args, merged by the founder like any other draft).
class PauseMembershipScreen extends StatefulWidget {
  const PauseMembershipScreen({super.key, required this.student});
  final Student student;
  @override
  State<PauseMembershipScreen> createState() => _PauseMembershipScreenState();
}

class _PauseMembershipScreenState extends State<PauseMembershipScreen> {
  final _reason = TextEditingController();
  late final String _intentKey;
  bool _busy = false;
  bool? _ok;
  String? _result;

  bool get _isPaused => widget.student.status.toUpperCase() == 'PAUSED';
  String get _targetStatus => _isPaused ? 'ACTIVE' : 'PAUSED';

  @override
  void initState() {
    super.initState();
    _intentKey = 'STUDRAFT-${DateTime.now().microsecondsSinceEpoch}';
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    if (_reason.text.trim().isEmpty) {
      setState(() => _result = 'Say why the membership is ${_isPaused ? 'resuming' : 'pausing'}.');
      return;
    }
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final r = await auth.service!.saveStudentDraft({
        'studentId': widget.student.studentId,
        'lifecycleStatus': _targetStatus,
        'statusReason': _reason.text.trim(),
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
      appBar: AppBar(title: Text(_isPaused ? 'Request resume' : 'Request pause')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Text(widget.student.studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(widget.student.studentId, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: AppSpace.s4),
          Text(
            _isPaused
                ? 'This student’s membership is currently paused. Request resuming it — Sharvil decides.'
                : 'For genuine leave (illness, travel, exams). The membership stays on record, not cancelled — Sharvil decides.',
            style: const TextStyle(fontSize: 13, color: AppColors.muted),
          ),
          const SizedBox(height: AppSpace.s4),
          TextField(
            controller: _reason,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Reason (required)'),
          ),
          const SizedBox(height: AppSpace.s4),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                : Text(_isPaused ? 'Request resume' : 'Request pause'),
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
