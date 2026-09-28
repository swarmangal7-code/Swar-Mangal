import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';
import 'student_profile_screen.dart';

/// Shared Teacher Profile — Founder sees compensation editing + status;
/// Staff sees read-only, branch-restricted data. Backend remains the
/// authorization authority; UI hiding is never the security layer.
class TeacherProfileScreen extends StatefulWidget {
  const TeacherProfileScreen({super.key, required this.teacherId, required this.staff});
  final String teacherId;
  final bool staff;
  @override
  State<TeacherProfileScreen> createState() => _TeacherProfileScreenState();
}

class _TeacherProfileScreenState extends State<TeacherProfileScreen> {
  TeacherProfile? _profile;
  String? _error;
  bool _busy = true;
  PayoutRow? _payoutRow; // the server's own row for this teacher

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
      final results = await Future.wait([
        auth.service!.teacherProfile(widget.teacherId, branch: auth.branch ?? 'ALL'),
        _payout(auth),
      ]);
      if (!mounted) return;
      setState(() {
        _profile = results[0] as TeacherProfile;
        _payoutRow = results[1] as PayoutRow?;
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

  /// The server's own payout row for this teacher this month. Display only —
  /// every figure comes from the server, the device sums nothing.
  Future<PayoutRow?> _payout(AuthProvider auth) async {
    try {
      final now = DateTime.now();
      final month = '${now.year}-${now.month.toString().padLeft(2, '0')}';
      final rows = await auth.service!.founderPayoutPreview(month);
      for (final r in rows) {
        if (r.teacherId == widget.teacherId) return r;
      }
      return null;
    } on ApiException {
      return null; // payout data unavailable — never fabricated
    } on ApiUnreachable {
      return null;
    }
  }

  /// Founder changes a teacher's lifecycle status directly (audited). Staff
  /// can only request it, through the same edit-request path the web uses.
  Future<void> _setStatus(Teacher t, String status) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final messenger = ScaffoldMessenger.of(context);
    final c = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Set ${t.teacherName} → $status'),
        content: TextField(controller: c, maxLines: 2, decoration: const InputDecoration(labelText: 'Reason (required, stored in audit)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Confirm')),
        ],
      ),
    );
    if (reason == null || reason.trim().isEmpty || !mounted) return;
    setState(() => _busy = true);
    try {
      final r = await auth.service!.founderUpdateTeacherStatus(t.teacherId, status, reason.trim());
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _busy = false);
      messenger.showSnackBar(SnackBar(
          content: Text(m['ok'] == true
              ? '${t.teacherName} → $status (audited)'
              : (m['error'] ?? 'Could not change status').toString())));
      if (m['ok'] == true) await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Staff request that a teacher be removed (LEFT) — the same teacher_add_requests
  /// lifecycle path web uses, so the founder decides.
  Future<void> _requestRemove(Teacher t) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final c = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Request removal of ${t.teacherName}?'),
        content: TextField(controller: c, maxLines: 2, decoration: const InputDecoration(labelText: 'Reason (required)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Send request')),
        ],
      ),
    );
    if (reason == null || reason.trim().isEmpty || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await auth.service!.requestAddTeacher({
        'teacherId': t.teacherId,
        'teacherName': t.teacherName,
        'lifecycleStatus': 'LEFT',
        'statusReason': reason.trim(),
        'clientIntentKey': 'TCHREQ-${DateTime.now().microsecondsSinceEpoch}',
      });
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(
          content: Text(m['ok'] == true
              ? '${(m['note'] ?? 'Sent for approval.').toString()} Nothing changes until the founder approves.'
              : (m['error'] ?? 'Could not send the request.').toString())));
    } on ApiException catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Staff request an edit; the founder's Approvals screen decides (matches
  /// the web app, which already has this — Flutter had no edit path at all).
  Future<void> _requestEdit(Teacher t) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    // Captured before the await: the dialog's own context is gone by the time
    // the request returns, and this State may be too.
    final messenger = ScaffoldMessenger.of(context);
    final phone = TextEditingController(text: t.phone);
    final email = TextEditingController(text: t.email);
    final role = TextEditingController(text: t.primaryRole);
    final err = ValueNotifier<String?>(null);
    final busy = ValueNotifier(false);
    final intentKey = 'TCHREQ-${DateTime.now().microsecondsSinceEpoch}';
    try {
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Request an edit'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone'), keyboardType: TextInputType.phone),
            const SizedBox(height: AppSpace.s3),
            TextField(controller: email, decoration: const InputDecoration(labelText: 'Email'), keyboardType: TextInputType.emailAddress),
            const SizedBox(height: AppSpace.s3),
            TextField(controller: role, decoration: const InputDecoration(labelText: 'Primary instrument / role')),
            const SizedBox(height: AppSpace.s3),
            const Text('Sent to the founder for approval — not applied until approved.',
                style: TextStyle(fontSize: 12)),
            ValueListenableBuilder<String?>(
              valueListenable: err,
              builder: (_, e, _) => e == null
                  ? const SizedBox.shrink()
                  : Padding(
                      padding: const EdgeInsets.only(top: AppSpace.s2),
                      child: Text(e, style: TextStyle(color: AppColors.adaptive(ctx, AppColors.blockFg), fontSize: 13)),
                    ),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            ValueListenableBuilder<bool>(
              valueListenable: busy,
              builder: (_, b, _) => FilledButton(
                onPressed: b
                    ? null
                    : () async {
                        busy.value = true;
                        try {
                          final r = await auth.service!.requestAddTeacher({
                            'teacherId': t.teacherId,
                            'teacherName': t.teacherName,
                            'phone': phone.text.trim(),
                            'email': email.text.trim(),
                            'primaryRole': role.text.trim(),
                            'clientIntentKey': intentKey,
                          });
                          final m = r as Map<String, dynamic>;
                          if (m['ok'] != true) {
                            err.value = (m['error'] ?? 'Could not send.').toString();
                          } else {
                            if (!ctx.mounted) return;
                            Navigator.pop(ctx);
                            messenger.showSnackBar(
                              SnackBar(content: Text((m['note'] ?? 'Sent to the founder for approval.').toString())),
                            );
                          }
                        } on ApiException catch (e) {
                          err.value = e.message;
                        } finally {
                          busy.value = false;
                        }
                      },
                child: const Text('Send request'),
              ),
            ),
          ],
        ),
      );
    } finally {
      for (final c in [phone, email, role]) {
        c.dispose();
      }
      err.dispose();
      busy.dispose();
    }
  }

  Future<void> _openCompensation() async {
    final profile = _profile;
    if (profile == null || widget.staff) return;
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _CompensationDialog(teacher: profile.teacher),
    );
    if (saved == true && mounted) {
      await _load();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) return const Scaffold(body: SkeletonList(rows: 8));
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Teacher profile')),
        body: Padding(
          padding: const EdgeInsets.all(AppSpace.s4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Expanded(child: ErrorView(_error!, onRetry: _load)),
          ]),
        ),
      );
    }
    final p = _profile!;
    final t = p.teacher;
    return Scaffold(
      appBar: AppBar(title: Text(t.teacherName)),
      body: RefreshScaffold(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(AppSpace.s4),
          children: [
            // Header
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  CircleAvatar(
                    radius: 30,
                    backgroundColor: AppColors.adaptive(context, AppColors.primary).withValues(alpha: .1),
                    child: Text(t.teacherName.isNotEmpty ? t.teacherName[0].toUpperCase() : '?',
                        style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.primary))),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  Text(t.teacherName, style: AppType.title),
                  const SizedBox(height: AppSpace.s1),
                  Text(t.teacherId, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                  const SizedBox(height: AppSpace.s2),
                  Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
                    if (t.primaryRole.isNotEmpty) TagChip(t.primaryRole),
                    StatusBadge(t.status.isEmpty ? 'UNKNOWN' : t.status),
                    if (t.shareLabel.isNotEmpty) TagChip(t.shareLabel, color: AppColors.adaptive(context, AppColors.focus)),
                  ]),
                ]),
              ),
            ),
            // Contact / academic
            const SectionTitle('Details'),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  InfoRow('Email', t.email.isNotEmpty ? t.email : '—'),
                  InfoRow('Phone', t.phone.isNotEmpty ? t.phone : '—'),
                  InfoRow('Primary role', t.primaryRole.isNotEmpty ? t.primaryRole : '—'),
                  InfoRow('Branch / class code', t.branchClassCode.isNotEmpty ? t.branchClassCode : '—'),
                  InfoRow('Payout model', t.payoutModel.isNotEmpty ? t.payoutModel : '—'),
                  InfoRow('Payout streams', t.payoutStreams.isNotEmpty ? t.payoutStreams : '—'),
                  InfoRow('Fee share', t.shareLabel.isNotEmpty ? t.shareLabel : '—'),
                ]),
              ),
            ),
            if (widget.staff) ...[
              const SizedBox(height: AppSpace.s2),
              Align(
                alignment: Alignment.centerRight,
                child: Wrap(spacing: AppSpace.s2, children: [
                  OutlinedButton.icon(
                    onPressed: () => _requestEdit(t),
                    icon: const Icon(Icons.edit_outlined, size: 16),
                    label: const Text('Request edit'),
                  ),
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.blockFg)),
                    onPressed: () => _requestRemove(t),
                    icon: const Icon(Icons.person_off_outlined, size: 16),
                    label: const Text('Request removal'),
                  ),
                ]),
              ),
            ],
            if (!widget.staff) ...[
              const SizedBox(height: AppSpace.s2),
              Align(
                alignment: Alignment.centerRight,
                child: Wrap(spacing: AppSpace.s2, children: [
                  for (final st in ['ACTIVE', 'INACTIVE', 'HOLD', 'LEFT'])
                    OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: st == t.status.toUpperCase()
                            ? AppColors.adaptive(context, AppColors.muted)
                            : AppColors.adaptive(context, AppColors.primary),
                        minimumSize: const Size(0, 36),
                      ),
                      onPressed: _busy || st == t.status.toUpperCase() ? null : () => _setStatus(t, st),
                      child: Text(st, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
                    ),
                ]),
              ),
            ],
            // Financial (server-computed only)
            if (!widget.staff) ...[
              const SectionTitle('Payout'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s4),
                  child: _payoutRow == null
                      ? Text('Payout data unavailable',
                          style: TextStyle(color: AppColors.adaptive(context, AppColors.muted)))
                      : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          InfoRow('Receipts', '${_payoutRow!.receiptCount}'),
                          InfoRow('Collection', inr(_payoutRow!.totalCollection)),
                          InfoRow('Teacher share', inr(_payoutRow!.totalTeacherShare)),
                          InfoRow('Payable', inr(_payoutRow!.payable)),
                          InfoRow('Already paid', inr(_payoutRow!.alreadyPaid)),
                          InfoRow('Balance', inr(_payoutRow!.balance)),
                          if (_payoutRow!.reasons.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: AppSpace.s2),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  for (final r in _payoutRow!.reasons)
                                    Text('• $r',
                                        style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg))),
                                ],
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.only(top: AppSpace.s2),
                            child: StatusBadge(_payoutRow!.status.isEmpty ? 'UNKNOWN' : _payoutRow!.status),
                          ),
                        ]),
                ),
              ),
              const SectionTitle('Compensation'),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s4),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('Fee share', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                          Text(t.shareLabel.isNotEmpty ? t.shareLabel : 'Unset',
                              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                        ]),
                      ),
                      FilledButton.icon(
                        onPressed: _openCompensation,
                        icon: const Icon(Icons.tune, size: 18),
                        label: const Text('Edit'),
                      ),
                    ]),
                    const SizedBox(height: AppSpace.s2),
                    Text(
                      'Percentage of student fees allocated to this teacher. The server computes the actual '
                      'earning basis; the app only sends the founder\'s requested change and displays the result.',
                      style: TextStyle(fontSize: 11, color: AppColors.adaptive(context, AppColors.muted)),
                    ),
                  ]),
                ),
              ),
            ],
            // Students assigned to this teacher
            const SectionTitle('Students'),
            if (p.hasStudents)
              for (final s in p.students)
                Card(
                  margin: const EdgeInsets.only(bottom: AppSpace.s2),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: 6),
                    leading: CircleAvatar(
                      radius: 16,
                      backgroundColor: AppColors.adaptive(context, AppColors.primary).withValues(alpha: .08),
                      child: Text(s.studentName.isNotEmpty ? s.studentName[0].toUpperCase() : '?',
                          style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.adaptive(context, AppColors.primary), fontSize: 13)),
                    ),
                    title: Text(s.studentName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                    subtitle: Text(
                        [s.classCode, s.instrument, s.phone].where((e) => e.isNotEmpty).join(' · '),
                        style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                    trailing: Icon(Icons.chevron_right, color: AppColors.adaptive(context, AppColors.muted)),
                    onTap: () => Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => StudentProfileScreen(student: s, staff: widget.staff),
                    )),
                  ),
                )
            else
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(AppSpace.s5),
                  child: EmptyState('No students assigned to this teacher.'),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Founder-only compensation editor. One intent key per dialog instance.
class _CompensationDialog extends StatefulWidget {
  const _CompensationDialog({required this.teacher});
  final Teacher teacher;
  @override
  State<_CompensationDialog> createState() => _CompensationDialogState();
}

class _CompensationDialogState extends State<_CompensationDialog> {
  final _ctr = TextEditingController();
  final _reason = TextEditingController();
  String? _effectiveFrom;
  final _intentKey = 'COMP-${DateTime.now().microsecondsSinceEpoch}';
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _ctr.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _save(BuildContext outerContext) async {
    final auth = outerContext.read<AuthProvider>();
    if (auth.service == null) return;
    final v = TeacherCompensationValidator.validate(_ctr.text);
    if (!v.ok) {
      setState(() => _error = v.error);
      return;
    }
    if (_effectiveFrom == null) {
      setState(() => _error = 'Pick an effective date.');
      return;
    }
    if (_reason.text.trim().isEmpty) {
      setState(() => _error = 'A reason is required (stored in audit).');
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Update compensation?'),
        content: Text('Update ${widget.teacher.teacherName} fee share to ${v.value!.toInt()}% '
            'from $_effectiveFrom?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Confirm')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
final messenger = ScaffoldMessenger.of(context);
    final nav = Navigator.of(context);
    try {
      final svc = auth.service;
      if (svc == null) return;
      final r = await svc.updateTeacherCompensation(
        teacherId: widget.teacher.teacherId,
        percentage: v.value!,
        effectiveFrom: _effectiveFrom!,
        reason: _reason.text.trim(),
        intentKey: _intentKey,
      );
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      final ok = m['ok'] == true;
      setState(() {
        _busy = false;
        _error = ok ? null : (m['error'] ?? 'Update failed.');
      });
      if (ok) {
        final demo = auth.isDemo || m['demo'] == true;
        final pct = v.value!.toInt();
        messenger
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
              content: Text('Compensation set to $pct% from ${_effectiveFrom!}'
                  '${demo ? ' (DEMO — not persisted)' : ''}')));
        nav.pop(true);
      }
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message; // old value preserved — never optimistic
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AlertDialog(
      title: const Text('Teacher compensation'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(widget.teacher.teacherName,
              style: const TextStyle(fontWeight: FontWeight.w800)),
          const SizedBox(height: AppSpace.s3),
          Text('Current fee share: ${widget.teacher.shareLabel.isNotEmpty ? widget.teacher.shareLabel : 'Unset'}',
              style: TextStyle(fontSize: 13, color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: AppSpace.s3),
          TextField(
            controller: _ctr,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'New fee share (%)',
              hintText: '0–100',
            ),
          ),
          const SizedBox(height: AppSpace.s3),
          // Effective date
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(Icons.event, color: AppColors.adaptive(context, AppColors.muted)),
            title: Text(_effectiveFrom ?? 'Effective from', style: const TextStyle(fontSize: 14)),
            trailing: TextButton(
              onPressed: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: DateTime.now(),
                  firstDate: DateTime(2020),
                  lastDate: DateTime(2035),
                );
                if (d != null) {
                  setState(() => _effectiveFrom =
                      '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
                }
              },
              child: const Text('Pick'),
            ),
          ),
          const SizedBox(height: AppSpace.s2),
          TextField(
            controller: _reason,
            maxLines: 2,
            decoration: const InputDecoration(labelText: 'Reason (required, audited)'),
          ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s3),
              child: Text(_error!, style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg), fontSize: 13)),
            ),
        ]),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy ? null : () => _save(context),
          child: _busy
              ? const SizedBox(
                  height: 18, width: 18,
                  child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save percentage'),
        ),
      ],
    );
  }
}