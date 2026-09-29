import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';
import 'add_student_screen.dart';
import 'fee_collection_screen.dart';
import 'instalment_plan_screen.dart';
import 'late_fee_waiver_screen.dart';
import 'message_compose_screen.dart';
import 'package_extension_screen.dart';
import 'pause_membership_screen.dart';
import 'teacher_profile_screen.dart';
import 'terms_screen.dart';

/// Student profile — the shared one-screen view of a student for both apps.
class StudentProfileScreen extends StatefulWidget {
  const StudentProfileScreen({super.key, required this.student, required this.staff});
  final Student student;
  final bool staff;
  @override
  State<StudentProfileScreen> createState() => _StudentProfileScreenState();
}

class _StudentProfileScreenState extends State<StudentProfileScreen> {
  List<ReceiptRow> _receipts = [];
  StaffHub? _hub;
  StudentProfileDetail? _detail;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _loadReceipts();
    if (widget.staff) _loadHub();
  }

  /// The one and only receipts source: api_studentProfile's `receipts`,
  /// computed server-side by student_id (recentReceipts) — never a fuzzy
  /// name search, so it can never pick up another student's payments.
  /// Voided/superseded receipts are dropped from the visible list; only the
  /// receipt that actually stands today is shown.
  Future<void> _loadReceipts() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final d = await auth.service!.studentProfile(
        widget.student.studentId,
        branch: auth.branch ?? 'ALL',
      );
      if (!mounted) return;
      setState(() {
        _detail = d;
        _receipts = d.receipts.where((r) => !r.excluded).toList();
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

  Future<void> _mergeDuplicate(DuplicateStudentRef survivor) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Merge as duplicate?'),
        content: Text('Mark ${widget.student.studentName} as a duplicate of ${survivor.name}? '
            'This record\'s history (receipts, attendance) stays on file, it is just linked to the correct student.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Merge')),
        ],
      ),
    );
    if (confirmed != true) return;
    try {
      await auth.service!.founderMergeDuplicateStudent(widget.student.studentId, survivor.studentId);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Marked as a duplicate of ${survivor.name}.')));
      await _loadReceipts();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _loadHub() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final hub = await auth.service!.staffStudentHub(
        widget.student.studentId,
        branch: auth.branch ?? 'ALL',
      );
      if (!mounted) return;
      setState(() => _hub = hub);
    } on ApiException {
      // hub is an enhancement — receipts load independently; stay quiet
    } on ApiUnreachable {
      // same
    }
  }

  Future<void> _staffFinalise(PendingFinaliseDraft d) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Create receipt now?'),
        content: Text(
            'You are about to create the real receipt for ${d.draftId} (₹${d.amount}) server-side. '
            'The founder already approved it — no further approval needed. This is audited money work.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Create receipt')),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    setState(() => _busy = true);
    try {
      final r = await auth.service!.staffFinalisePaymentDraft(d.draftId);
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text(m['ok'] == true
                ? 'Receipt ${m['receiptNo'] ?? ''} created'
                : (m['message'] ?? m['error'] ?? m['safeError'] ?? 'Could not finalise'))));
      await _loadHub();
      await _loadReceipts();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<void> _setStatus(BuildContext context, String status) async {
    final messenger = ScaffoldMessenger.of(context);
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final reason = await _askReason(
      context,
      title: 'Set ${widget.student.studentId} → $status',
      label: 'Reason (required, stored in audit)',
    );
    if (reason == null || reason.trim().isEmpty) return;
    if (!mounted) return;
    setState(() => _busy = true);
    try {
      final r = await auth.service!.founderSetStudentStatus(
        widget.student.studentId,
        status,
        reason,
      );
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _busy = false);
      final demoTag = m['demo'] == true ? ' (DEMO — not persisted)' : '';
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text(m['ok'] == true
                ? (m['changed'] == true
                    ? '${widget.student.studentId} → $status (audited)$demoTag'
                    : (m['note'] ?? 'No change'))
                : (m['error'] ?? 'Could not change status'))));
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

  IconData _attendanceIcon(AttendanceMark a) {
    if (a.isPresent) return Icons.check_circle_outline;
    if (a.isLate) return Icons.schedule;
    if (a.isExcused) return Icons.info_outline;
    if (a.isAbsent) return Icons.cancel_outlined;
    return Icons.help_outline;
  }

  Color _attendanceColor(BuildContext context, AttendanceMark a) {
    if (a.isPresent) return AppColors.adaptive(context, AppColors.okFg);
    if (a.isAbsent) return AppColors.adaptive(context, AppColors.blockFg);
    return AppColors.adaptive(context, AppColors.warnFg);
  }

  /// Staff request removal. Never a direct delete — it becomes a founder
  /// approval that moves the record to Inquiries as a lead, so the history is
  /// never erased (mirrors the web staff profile).
  Future<void> _requestDelete() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final reason = await _askReason(
      context,
      title: 'Request delete for ${widget.student.studentName}?',
      label: 'Why are they leaving? (required)',
    );
    if (reason == null || reason.trim().isEmpty || !mounted) return;
    final messenger = ScaffoldMessenger.of(context);
    setState(() => _busy = true);
    try {
      final r = await auth.service!.saveStudentDraft({
        'studentId': widget.student.studentId,
        'lifecycleStatus': 'LEFT',
        'statusReason': reason.trim(),
        'clientIntentKey': 'SDRAFT-${DateTime.now().microsecondsSinceEpoch}',
      });
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _busy = false);
      messenger.showSnackBar(SnackBar(
          content: Text(m['ok'] == true
              ? '${(m['note'] ?? 'Sent for approval.').toString()} Nothing changes until the founder approves.'
              : (m['error'] ?? 'Could not send the request.').toString())));
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

  Future<String?> _askReason(BuildContext context,
      {required String title, required String label}) {    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: c, maxLines: 2, decoration: InputDecoration(labelText: label)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, c.text.trim()),
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }


  @override
  Widget build(BuildContext context) {
    final s = widget.student;
    return Scaffold(
      appBar: AppBar(
        title: Text(s.studentName),
        actions: [
          if (!widget.staff)
            PopupMenuButton<String>(
              tooltip: 'Lifecycle / archive',
              icon: const Icon(Icons.more_vert),
              onSelected: (v) => _setStatus(context, v),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'ACTIVE', child: Text('Set ACTIVE')),
                PopupMenuItem(value: 'PAUSED', child: Text('Pause (PAUSED)')),
                PopupMenuItem(value: 'LEFT', child: Text('Mark LEFT (archive)')),
              ],
            ),
        ],
      ),
      body: RefreshScaffold(
        onRefresh: _loadReceipts,
        child: ListView(
          padding: const EdgeInsets.all(AppSpace.s4),
          children: [
            if (_detail?.duplicateOf != null)
              Card(
                color: AppColors.warnBg,
                margin: const EdgeInsets.only(bottom: AppSpace.s3),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s3),
                  child: Text(
                    'Marked as a duplicate of ${_detail!.duplicateOf!.name}. Kept for history, not counted as active.',
                    style: TextStyle(color: AppColors.warnFg, fontSize: 12.5),
                  ),
                ),
              ),
            if (!widget.staff && (_detail?.possibleDuplicates.isNotEmpty ?? false))
              Card(
                color: AppColors.warnBg,
                margin: const EdgeInsets.only(bottom: AppSpace.s3),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s3),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(
                      'This phone is also registered to ${_detail!.possibleDuplicates.map((m) => m.name).join(', ')}.',
                      style: TextStyle(color: AppColors.warnFg, fontSize: 12.5),
                    ),
                    const SizedBox(height: AppSpace.s2),
                    Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
                      for (final m in _detail!.possibleDuplicates)
                        OutlinedButton(
                          onPressed: () => _mergeDuplicate(m),
                          child: Text('Same as ${m.name} — merge', style: const TextStyle(fontSize: 12)),
                        ),
                    ]),
                  ]),
                ),
              ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  CircleAvatar(
                    radius: 28,
                    backgroundColor: AppColors.adaptive(context, AppColors.primary).withValues(alpha: .08),
                    child: Text(s.studentName.isNotEmpty ? s.studentName[0].toUpperCase() : '?',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.primary))),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  Text(s.studentName, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: AppSpace.s1),
                  Text(s.studentId, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                  const SizedBox(height: AppSpace.s2),
                  Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
                    TagChip(s.classCode),
                    if (s.instrument.isNotEmpty) TagChip(s.instrument, color: AppColors.adaptive(context, AppColors.focus)),
                    StatusBadge(s.status.isEmpty ? s.feeStatus : s.status),
                  ]),
                ]),
              ),
            ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  InfoRow('Phone', s.phone.isNotEmpty ? s.phone : '—'),
                  InfoRow('Email', s.email.isNotEmpty ? s.email : '—'),
                  InfoRow('Guardian', s.guardianName.isNotEmpty ? s.guardianName : '—'),
                  InfoRow('Batch / Class', s.batch.isNotEmpty ? s.batch : '—'),
                  InfoRow('Plan', planSummary(s.feePlan)),
                  InfoRow('Fee cycle', s.feeCycleType.isNotEmpty ? s.feeCycleType : '—'),
                  InfoRow('Fee due day', s.feeDueDay.isNotEmpty ? s.feeDueDay : '—'),
                  InfoRow('Monthly fee', s.monthlyFee.isNotEmpty ? '₹${s.monthlyFee}' : '—'),
                  InfoRow('Next due', s.nextDueDate.isNotEmpty ? s.nextDueDate : '—'),
                  InfoRow('Last receipt', s.lastReceiptNo.isNotEmpty ? '${s.lastReceiptNo} · ₹${s.lastReceiptAmount}' : '—'),
                  InfoRow('Admission via', admissionSourceLabel(s.admissionSource).isEmpty ? '—' : admissionSourceLabel(s.admissionSource)),
                ]),
              ),
            ),
            const SizedBox(height: AppSpace.s3),
            // Teacher relationship — clickable when a stable teacherId exists.
            Card(
              child: ListTile(
                contentPadding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: 6),
                leading: Icon(Icons.person_pin_circle_outlined, color: AppColors.adaptive(context, AppColors.primary)),
                title: Text(
                  _detail?.hasAssignedTeacher == true
                      ? (_detail!.hasTeacherName ? _detail!.teacherName : 'Teacher')
                      : 'No teacher assigned',
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                ),
                subtitle: _detail?.hasTeacherId == true
                    ? Text(_detail!.teacherId, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)))
                    : null,
                trailing: _detail?.hasTeacherId == true
                    ? Icon(Icons.chevron_right, color: AppColors.adaptive(context, AppColors.muted))
                    : null,
                onTap: _detail?.hasTeacherId == true
                    ? () => Navigator.of(context).push(MaterialPageRoute(
                        builder: (_) => TeacherProfileScreen(
                          teacherId: _detail!.teacherId,
                          staff: widget.staff,
                        ),
                      ))
                    : null,
              ),
            ),
            const SizedBox(height: AppSpace.s3),
            FilledButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => FeeCollectionScreen(staff: widget.staff, prefill: s),
              )),
              icon: const Icon(Icons.payments_outlined),
              label: const Text('Collect / record fee'),
            ),
            const SizedBox(height: AppSpace.s3),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.focus)),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => MessageComposeScreen(
                  staff: widget.staff,
                  studentId: s.studentId,
                  studentName: s.studentName,
                  instrument: s.instrument,
                  branch: s.classCode,
                ),
              )),
              icon: const Icon(Icons.chat_outlined, size: 18),
              label: const Text('Message parent'),
            ),
            const SizedBox(height: AppSpace.s3),
            // Edit is a founder write / a staff proposal — same rule as the
            // web profile, so both roles get it from here, not just the list.
            OutlinedButton.icon(
              onPressed: () async {
                await Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => AddStudentScreen(staff: widget.staff, edit: s),
                ));
                if (mounted) _loadReceipts();
              },
              icon: const Icon(Icons.edit_outlined, size: 18),
              label: Text(widget.staff ? 'Request edit' : 'Edit'),
            ),
            const SizedBox(height: AppSpace.s3),
            // Founder changes lifecycle directly (audited); staff propose it.
            if (widget.staff)
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.blockFg)),
                onPressed: _busy ? null : _requestDelete,
                icon: const Icon(Icons.delete_outline, size: 18),
                label: const Text('Request delete'),
              ),
            // Founder has no terms screen of their own on web either, but the
            // founder is the one who approves manual acceptance — so the
            // screen is offered to both roles here.
            const SizedBox(height: AppSpace.s3),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => TermsScreen(student: s),
              )),
              icon: const Icon(Icons.description_outlined, size: 18),
              label: const Text('Admission terms'),
            ),
            if (widget.staff) ...[
              const SizedBox(height: AppSpace.s3),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => PackageExtensionScreen(student: s),
                )),
                icon: const Icon(Icons.event_repeat_outlined, size: 18),
                label: const Text('Request package extension'),
              ),
              const SizedBox(height: AppSpace.s3),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => LateFeeWaiverScreen(student: s),
                )),
                icon: const Icon(Icons.money_off_outlined, size: 18),
                label: const Text('Request late-fee waiver'),
              ),
              const SizedBox(height: AppSpace.s3),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => InstalmentPlanScreen(student: s),
                )),
                icon: const Icon(Icons.calendar_view_month_outlined, size: 18),
                label: const Text('Request instalment plan'),
              ),
              const SizedBox(height: AppSpace.s3),
              OutlinedButton.icon(
                onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => PauseMembershipScreen(student: s),
                )),
                icon: Icon(s.status.toUpperCase() == 'PAUSED' ? Icons.play_circle_outline : Icons.pause_circle_outline, size: 18),
                label: Text(s.status.toUpperCase() == 'PAUSED' ? 'Request resume' : 'Request pause'),
              ),
            ],
            if (widget.staff && _hub != null && _hub!.pending.isNotEmpty) ...[
              const SizedBox(height: AppSpace.s3),
              const SectionTitle('Approved payments'),
              for (final d in _hub!.pending)
                Card(
                  margin: const EdgeInsets.only(bottom: AppSpace.s3),
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpace.s4),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('₹${d.amount} · ${d.paymentDate}',
                                style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                            Text(d.draftId, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                          ]),
                        ),
                        StatusBadge(d.repairRequired ? 'REPAIR REQUIRED' : d.status),
                      ]),
                      if (d.label.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpace.s2),
                          child: Text(d.label, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                        ),
                      if (d.blockedReason.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpace.s2),
                          child: Text(d.blockedReason,
                              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg))),
                        ),
                      if (d.canFinalise)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpace.s2),
                          child: SizedBox(
                            width: double.infinity,
                            child: FilledButton.icon(
                              style: FilledButton.styleFrom(backgroundColor: AppColors.adaptive(context, AppColors.primary)),
                              onPressed: _busy ? null : () => _staffFinalise(d),
                              icon: const Icon(Icons.receipt_long_outlined, size: 18),
                              label: const Text('Create receipt now'),
                            ),
                          ),
                        ),
                    ]),
                  ),
                ),
            ],
            if ((_detail?.attendance ?? const []).isNotEmpty) ...[
              const SectionTitle('Attendance history'),
              Card(
                child: Column(
                  children: [
                    for (final a in _detail!.attendance.take(15))
                      ListTile(
                        dense: true,
                        contentPadding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: 2),
                        leading: Icon(_attendanceIcon(a), color: _attendanceColor(context, a), size: 18),
                        title: Text(a.date, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                        subtitle: Text(
                          [a.instrument, a.teacherName].where((x) => x.isNotEmpty).join(' · '),
                          style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
                        ),
                        trailing: TagChip(a.status.isEmpty ? 'NOT MARKED' : a.status),
                      ),
                  ],
                ),
              ),
            ],
            SectionTitle('Receipts${_busy ? ' …' : ''}'),
            if (_error != null) Card(child: Padding(padding: const EdgeInsets.all(AppSpace.s3), child: ErrorView(_error!, onRetry: _loadReceipts, compact: true)))
            else if (_receipts.isEmpty && !_busy)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(AppSpace.s5),
                  child: EmptyState('No receipts yet'),
                ),
              )
            else
              for (final r in _receipts.take(15))
                Card(
                  margin: const EdgeInsets.only(bottom: AppSpace.s2),
                  child: ListTile(
                    dense: true,
                    contentPadding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: 4),
                    leading: Icon(Icons.receipt_long_outlined, color: AppColors.adaptive(context, AppColors.muted)),
                    title: Text(r.receiptNo, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    subtitle: Text('${r.date} · ${r.mode}${r.excluded ? ' · EXCLUDED' : ''}',
                        style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                    trailing: Text(inr(r.amount),
                        style: TextStyle(fontWeight: FontWeight.w800, color: r.excluded ? AppColors.adaptive(context, AppColors.muted) : AppColors.adaptive(context, AppColors.primary))),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}