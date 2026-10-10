import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../state/auth_provider.dart';
import '../../state/sync_manager.dart';
import '../../widgets/atoms.dart';

class NewEnrollmentRow {
  NewEnrollmentRow({
    required this.draftId,
    required this.status,
    required this.name,
    required this.phone,
    required this.email,
    required this.guardianName,
    required this.instrument,
    required this.branch,
    required this.submittedAt,
  });
  factory NewEnrollmentRow.fromApi(Map<String, dynamic> b) => NewEnrollmentRow(
        draftId: (b['draftId'] ?? '').toString(),
        status: (b['status'] ?? '').toString(),
        name: (b['name'] ?? '').toString(),
        phone: (b['phone'] ?? '').toString(),
        email: (b['email'] ?? '').toString(),
        guardianName: (b['guardianName'] ?? '').toString(),
        instrument: (b['instrument'] ?? '').toString(),
        branch: (b['branch'] ?? '').toString(),
        submittedAt: (b['submittedAt'] ?? '').toString(),
      );
  final String draftId;
  final String status;
  final String name;
  final String phone;
  final String email;
  final String guardianName;
  final String instrument;
  final String branch;
  final String submittedAt;
}

/// Founder request 2026-10-10: a dedicated review list for self-submitted
/// enrollments (the public enroll link), separate from the general
/// Approvals screen. Approve/reject reuse the same mergeStudentDraft/
/// studentDraftReject calls the Approvals screen already uses for any
/// student draft — only the founder decides; staff see this read-only.
class NewEnrollmentsScreen extends StatefulWidget {
  const NewEnrollmentsScreen({super.key});
  @override
  State<NewEnrollmentsScreen> createState() => _NewEnrollmentsScreenState();
}

class _NewEnrollmentsScreenState extends State<NewEnrollmentsScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'approvals', 'students'};

  @override
  Future<void> reloadFromSync() => _load();

  List<NewEnrollmentRow> _pending = [];
  List<NewEnrollmentRow> _recent = [];
  bool _busy = true;
  String? _error;
  final Set<String> _acting = {};

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
      final r = await auth.service!.newEnrollments();
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _pending = ((m['pending'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(NewEnrollmentRow.fromApi).toList();
        _recent = ((m['recent'] as List?) ?? const []).whereType<Map<String, dynamic>>().map(NewEnrollmentRow.fromApi).toList();
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

  Future<void> _approve(NewEnrollmentRow row) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null || _acting.contains(row.draftId)) return;
    setState(() => _acting.add(row.draftId));
    try {
      final r = await auth.service!.raw('api_founder_mergeStudentDraft', {'draftId': row.draftId});
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text(m['ok'] == true ? 'Added to the roster. Set the fee plan on their profile.' : (m['error'] ?? 'Could not merge.').toString())));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _acting.remove(row.draftId));
    }
  }

  Future<void> _reject(NewEnrollmentRow row) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Reject ${row.name}?'),
        content: TextField(controller: reasonCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Reason (required)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => reasonCtrl.text.trim().isEmpty ? null : Navigator.pop(ctx, reasonCtrl.text.trim()),
            child: const Text('Reject'),
          ),
        ],
      ),
    );
    if (reason == null || !mounted || _acting.contains(row.draftId)) return;
    setState(() => _acting.add(row.draftId));
    try {
      final r = await auth.service!.raw('api_founder_studentDraftReject', {'draftId': row.draftId, 'reason': reason});
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(m['ok'] == true ? 'Rejected.' : (m['error'] ?? 'Could not reject.').toString())));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _acting.remove(row.draftId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final isFounder = !context.read<AuthProvider>().isStaff;
    return Scaffold(
      appBar: AppBar(title: const Text('New Enrollments')),
      body: RefreshScaffold(
        onRefresh: _load,
        child: _busy && _pending.isEmpty
            ? const Center(child: CircularProgressIndicator())
            : _error != null && _pending.isEmpty
                ? ErrorView(_error!, onRetry: _load)
                : ListView(
                    padding: const EdgeInsets.all(AppSpace.s4),
                    children: [
                      if (_pending.isEmpty)
                        const EmptyState('No pending enrollments.', icon: Icons.person_add_alt_outlined)
                      else
                        for (final row in _pending)
                          Card(
                            margin: const EdgeInsets.only(bottom: AppSpace.s3),
                            child: Padding(
                              padding: const EdgeInsets.all(AppSpace.s4),
                              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                Row(children: [
                                  Expanded(
                                    child: Text(row.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                                  ),
                                  TagChip(row.branch),
                                ]),
                                const SizedBox(height: AppSpace.s2),
                                Text(
                                  [row.guardianName, row.phone, row.email, row.instrument].where((e) => e.isNotEmpty).join(' · '),
                                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                                ),
                                if (isFounder) ...[
                                  const SizedBox(height: AppSpace.s3),
                                  if (_acting.contains(row.draftId))
                                    const SizedBox(height: 32, child: Center(child: CircularProgressIndicator(strokeWidth: 2)))
                                  else
                                    Row(children: [
                                      FilledButton.icon(
                                        onPressed: () => _approve(row),
                                        icon: const Icon(Icons.check, size: 16),
                                        label: const Text('Approve'),
                                      ),
                                      const SizedBox(width: AppSpace.s2),
                                      OutlinedButton.icon(
                                        onPressed: () => _reject(row),
                                        icon: const Icon(Icons.close, size: 16),
                                        label: const Text('Reject'),
                                      ),
                                    ]),
                                ],
                              ]),
                            ),
                          ),
                      if (_recent.isNotEmpty) ...[
                        const SizedBox(height: AppSpace.s3),
                        const Text('RECENT DECISIONS', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.muted)),
                        const SizedBox(height: AppSpace.s2),
                        for (final row in _recent)
                          ListTile(
                            dense: true,
                            title: Text(row.name),
                            trailing: StatusBadge(row.status == 'MERGED' ? 'ADDED' : 'REJECTED'),
                          ),
                      ],
                    ],
                  ),
      ),
    );
  }
}
