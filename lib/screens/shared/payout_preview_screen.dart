import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Founder payout preview — server-computed teacher earning / payable / balance.
/// No client payout logic. Displays `api_teacherPayoutPreview` rows.
/// Business rules: NEVER calculate payout on device; amount/rate from server.
class PayoutPreviewScreen extends StatefulWidget {
  const PayoutPreviewScreen({super.key});
  @override
  State<PayoutPreviewScreen> createState() => _PayoutPreviewScreenState();
}

class _PayoutPreviewScreenState extends State<PayoutPreviewScreen> {
  late String _month;
  List<PayoutRow> _rows = [];
  List<SharedStudentDecision> _awaiting = const [];
  num _awaitingAmount = 0;
  bool _earningBaseDefined = false;
  String _note = '';
  bool _projected = true;
  bool _closed = false;
  String _closedAt = '';
  String _closedBy = '';
  String? _error;
  bool _busy = false;
  bool _closing = false;

  /// Payout statements fetched/generated this session, keyed by
  /// "teacherId|month". The preview RPC doesn't report statement status
  /// itself, so this is populated lazily as the founder works a row — there
  /// is no "list statements" read either, only generate/approve.
  final Map<String, PayoutStatement> _statements = {};
  String _stKey(String teacherId, String month) => '$teacherId|$month';

  @override
  void initState() {
    super.initState();
    _month = _currentMonth();
    _load();
  }

  String _currentMonth() {
    final n = DateTime.now();
    return '${n.year}-${n.month.toString().padLeft(2, '0')}';
  }

  String _previousMonth() {
    final d = DateTime(DateTime.now().year, DateTime.now().month - 1);
    return '${d.year}-${d.month.toString().padLeft(2, '0')}';
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final preview = await auth.service!.founderPayoutPreviewFull(_month);
      if (!mounted) return;
      setState(() {
        _rows = preview.rows;
        _awaiting = preview.awaitingDecision;
        _awaitingAmount = preview.awaitingAmount;
        _earningBaseDefined = preview.earningBaseDefined;
        _note = preview.note;
        _projected = preview.projected;
        _closed = preview.closed;
        _closedAt = preview.closedAt;
        _closedBy = preview.closedBy;
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

  Future<void> _closePeriod() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Close $_month?'),
        content: const Text('Its payout figures will be frozen and won\'t change even if rules or records are edited later.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Close period')),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _closing = true);
    try {
      await auth.service!.founderClosePayoutPeriod(_month);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$_month closed.')));
      await _load();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _closing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_busy && _rows.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null && _rows.isEmpty) return ErrorView(_error!, onRetry: _load);

    final totalPayable = _rows.where((r) => r.priced).fold<num>(0, (s, r) => s + r.payable);
    final totalPaid = _rows.fold<num>(0, (s, r) => s + r.alreadyPaid);
    final totalBalance = _rows.where((r) => r.priced).fold<num>(0, (s, r) => s + r.balance);
    final unpricedCount = _rows.where((r) => !r.priced).length;

    return RefreshScaffold(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          PageHero(eyebrow: 'Payouts', headline: 'Teacher payouts', fontSize: 22),
          const SizedBox(height: AppSpace.s3),
          Row(children: [
            Expanded(
              child: _monthInput('Service month (YYYY-MM)', _month, (v) {
                setState(() => _month = v);
                _load();
              }),
            ),
            const SizedBox(width: AppSpace.s2),
            TextButton(onPressed: () { setState(() => _month = _previousMonth()); _load(); },
                child: const Text('Previous')),
          ]),
          const SizedBox(height: AppSpace.s2),
          Row(children: [
            if (_closed)
              StatusBadge('CLOSED${_closedAt.isNotEmpty ? ' · ${_closedAt.substring(0, 10)}' : ''}${_closedBy.isNotEmpty ? ' by $_closedBy' : ''}')
            else ...[
              StatusBadge(_projected ? 'PROJECTED — not payable yet' : ''),
              if (_rows.isNotEmpty) ...[
                const SizedBox(width: AppSpace.s2),
                TextButton(onPressed: _closing ? null : _closePeriod, child: Text(_closing ? 'Closing…' : 'Close period')),
              ],
            ],
          ]),
          const SizedBox(height: AppSpace.s2),
          Card(
            color: AppColors.adaptive(context, AppColors.infoBg),
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s3),
              child: Text(
                  'Figures below are server-computed from actual receipt shares. '
                  'The app does not calculate payouts — it displays the backend\'s authoritative numbers only.',
                  style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.infoFg))),
            ),
          ),
          if (!_earningBaseDefined) ...[
            const SizedBox(height: AppSpace.s3),
            Card(
              color: AppColors.adaptive(context, AppColors.warnBg),
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s3),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(Icons.block_outlined, size: 18, color: AppColors.adaptive(context, AppColors.warnFg)),
                  const SizedBox(width: AppSpace.s2),
                  Expanded(
                    child: Text(
                      _note.isNotEmpty
                          ? _note
                          : 'No academy payout amount exists until the owner rules what a percentage is a percentage of.',
                      style: TextStyle(fontSize: 12.5, color: AppColors.adaptive(context, AppColors.warnFg), fontWeight: FontWeight.w600),
                    ),
                  ),
                ]),
              ),
            ),
          ],
          const SizedBox(height: AppSpace.s4),
          Row(children: [
            _metric('Payable', _earningBaseDefined ? inr(totalPayable) : '—', AppColors.adaptive(context, AppColors.primary)),
            const SizedBox(width: AppSpace.s2),
            _metric('Paid', inr(totalPaid), AppColors.adaptive(context, AppColors.okFg)),
            const SizedBox(width: AppSpace.s2),
            _metric('Balance', _earningBaseDefined ? inr(totalBalance) : '—',
                AppColors.adaptive(context, totalBalance > 0 ? AppColors.warnFg : AppColors.muted)),
          ]),
          if (unpricedCount > 0) ...[
            const SizedBox(height: AppSpace.s2),
            Text('$unpricedCount teacher${unpricedCount == 1 ? '' : 's'} not priced — see below.',
                style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
          ],
          const SizedBox(height: AppSpace.s4),
          if (_awaiting.isNotEmpty) ...[
            Card(
              color: AppColors.adaptive(context, AppColors.warnBg),
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Icon(Icons.call_split_outlined, size: 18, color: AppColors.adaptive(context, AppColors.warnFg)),
                    const SizedBox(width: AppSpace.s2),
                    Expanded(
                      child: Text('Waiting for your decision · ${inr(_awaitingAmount)}',
                          style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.warnFg))),
                    ),
                  ]),
                  const SizedBox(height: AppSpace.s2),
                  Text(
                      'These students were taught by more than one teacher this month. '
                      'Their fees count for nobody until you split them, so no payout is overstated.',
                      style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg))),
                  for (final sharedStudent in _awaiting) ...[
                    const SizedBox(height: AppSpace.s3),
                    Row(children: [
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(sharedStudent.studentName,
                              style: const TextStyle(fontWeight: FontWeight.w700)),
                          Text(
                              'paid ${inr(sharedStudent.collected)} · unassigned ${inr(sharedStudent.remaining)} · '
                              '${sharedStudent.teachers.map((t) => '${t.teacherName} (${t.classesThisMonth})').join(', ')}',
                              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                        ]),
                      ),
                      TextButton(
                        onPressed: _busy ? null : () => _splitShared(sharedStudent),
                        child: const Text('Split'),
                      ),
                    ]),
                  ],
                ]),
              ),
            ),
            const SizedBox(height: AppSpace.s4),
          ],
          if (_rows.isEmpty)
            const EmptyState('No payout rows for this month.'),
          for (final r in _rows)
            Card(
              margin: const EdgeInsets.only(bottom: AppSpace.s3),
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Row(children: [
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(r.teacherName.isNotEmpty ? r.teacherName : r.teacherId,
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                        Text('${r.entityId} · ${r.month}${r.priced ? ' · ${r.receiptCount} receipts' : ''}',
                            style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                      ]),
                    ),
                    StatusBadge(r.preCutover ? 'PRE-CUTOVER' : r.status.isEmpty ? 'NONE' : r.status),
                  ]),
                  if (r.preCutover && r.note.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpace.s2),
                      child: Text(r.note, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                    ),
                  // Qualifications apply to priced rows too — a priced row can
                  // still carry a caveat the founder must read.
                  if (r.priced && r.reasons.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpace.s2),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          for (final reason in r.reasons)
                            Text('· $reason',
                                style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg))),
                        ],
                      ),
                    ),
                  const SizedBox(height: AppSpace.s2),
                  if (!r.priced)
                    // Named refusal — never a guessed ₹0 (brief §8, §15.1).
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(AppSpace.s3),
                      decoration: BoxDecoration(
                        color: AppColors.adaptive(context, AppColors.blockBg),
                        borderRadius: BorderRadius.circular(AppRadius.s),
                      ),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        for (final reason in r.reasons.isEmpty ? ['Not priced.'] : r.reasons)
                          Text(reason,
                              style: TextStyle(
                                  fontSize: 12.5, color: AppColors.adaptive(context, AppColors.blockFg), fontWeight: FontWeight.w600)),
                      ]),
                    )
                  else ...[
                    Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
                      _tag('collected', inr(r.totalCollection)),
                      _tag('share', inr(r.totalTeacherShare)),
                      _tag('paid', inr(r.alreadyPaid)),
                      _tag('balance', inr(r.balance)),
                    ]),
                    for (final q in r.qualifications)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpace.s2),
                        child: Text('· $q', style: TextStyle(fontSize: 11.5, color: AppColors.adaptive(context, AppColors.muted))),
                      ),
                    if (r.outcomeFlags.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpace.s2),
                        child: Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
                          for (final entry in r.outcomeFlags.entries)
                            _tag(
                              entry.key,
                              '${entry.value.count} · ${entry.value.configuredPercent != null ? '${entry.value.configuredPercent!.toInt()}%' : 'unset'}',
                            ),
                        ]),
                      ),
                    const SizedBox(height: AppSpace.s3),
                    _statementSection(r),
                  ],
                ]),
              ),
            ),
        ],
      ),
    );
  }

  /// Decide how a shared student's fee splits between the teachers who taught
  /// them this month. Amounts start empty — the class counts are shown as
  /// context, not as a suggested answer.
  Future<void> _splitShared(SharedStudentDecision shared) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final controllers = {
      for (final t in shared.teachers)
        t.teacherId: TextEditingController(text: t.assigned > 0 ? t.assigned.toStringAsFixed(0) : ''),
    };

    num entered() => controllers.values
        .fold<num>(0, (sum, c) => sum + (num.tryParse(c.text.trim()) ?? 0));

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) {
          final left = shared.collected - entered();
          return AlertDialog(
            title: Text('Split ${shared.studentName}'),
            content: Column(mainAxisSize: MainAxisSize.min, children: [
              Text('Paid ${inr(shared.collected)} in $_month',
                  style: TextStyle(fontSize: 12, color: AppColors.adaptive(ctx, AppColors.muted))),
              const SizedBox(height: AppSpace.s3),
              for (final t in shared.teachers)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpace.s2),
                  child: TextField(
                    controller: controllers[t.teacherId],
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    onChanged: (_) => setLocal(() {}),
                    decoration: InputDecoration(
                      labelText: '${t.teacherName} · ${t.classesThisMonth} classes',
                      prefixText: '₹ ',
                    ),
                  ),
                ),
              Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  left < 0 ? 'Over by ${inr(-left)}' : 'Unassigned ${inr(left)}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.adaptive(ctx, left < 0 ? AppColors.blockFg : AppColors.muted),
                  ),
                ),
              ),
            ]),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              FilledButton(
                onPressed: left < 0 ? null : () => Navigator.pop(ctx, true),
                child: const Text('Save split'),
              ),
            ],
          );
        },
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _busy = true);
    try {
      await auth.service!.assignSharedStudent(
        month: _month,
        studentId: shared.studentId,
        allocations: {
          for (final entry in controllers.entries) entry.key: num.tryParse(entry.value.text.trim()) ?? 0,
        },
      );
      if (!mounted) return;
      _toast('Split saved for ${shared.studentName}.');
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    }
  }

  /// The statement workflow + record-payment action for one teacher/month
  /// row. For months from the expected-events floor onward (!preCutover),
  /// the backend refuses `recordTeacherPayout` unless a FOUNDER_APPROVED
  /// statement exists — see the gate added to `recordTeacherPayout` in
  /// handlers2.ts. Pre-cutover rows keep working exactly as before: no
  /// statement is required to record a payment.
  Widget _statementSection(PayoutRow r) {
    final key = _stKey(r.teacherId, r.month);
    final stmt = _statements[key];
    final gated = !r.preCutover;
    final approved = stmt?.isApproved ?? false;
    final canRecord = r.balance > 0 && (!gated || approved);

    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (gated) ...[
        Row(children: [
          if (stmt != null) ...[
            StatusBadge(stmt.status),
            const SizedBox(width: AppSpace.s2),
            if (stmt.calculatedAmount != null) Text('calculated ${inr(stmt.calculatedAmount!)}', style: const TextStyle(fontSize: 11.5)),
            if (stmt.approvedAmount != null) Text(' · approved ${inr(stmt.approvedAmount!)}', style: const TextStyle(fontSize: 11.5)),
          ] else
            Text('No statement generated yet for ${r.month}.',
                style: TextStyle(fontSize: 11.5, color: AppColors.adaptive(context, AppColors.muted))),
        ]),
        const SizedBox(height: AppSpace.s2),
        Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
          TextButton.icon(
            onPressed: _busy || approved ? null : () => _generateStatement(r),
            icon: const Icon(Icons.calculate_outlined, size: 18),
            label: Text(stmt == null ? 'Generate statement' : 'Refresh'),
          ),
          if (stmt != null && stmt.isCalculated)
            TextButton.icon(
              onPressed: _busy ? null : () => _approveStatement(r, stmt),
              icon: const Icon(Icons.verified_outlined, size: 18),
              label: const Text('Approve'),
            ),
          if (stmt != null && !stmt.isApproved)
            TextButton.icon(
              onPressed: _busy ? null : () => _addAdjustment(r, stmt),
              icon: const Icon(Icons.tune_outlined, size: 18),
              label: const Text('Add adjustment'),
            ),
        ]),
        const SizedBox(height: AppSpace.s2),
      ],
      if (r.balance > 0)
        Align(
          alignment: Alignment.centerRight,
          child: canRecord
              ? TextButton.icon(
                  onPressed: _busy ? null : () => _recordPayment(r),
                  icon: const Icon(Icons.account_balance_wallet_outlined, size: 18),
                  label: const Text('Record payment'),
                )
              : Text('Approve a statement before recording payment.',
                  style: TextStyle(fontSize: 11.5, color: AppColors.adaptive(context, AppColors.warnFg))),
        ),
    ]);
  }

  Future<void> _generateStatement(PayoutRow r) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() => _busy = true);
    try {
      final stmt = await auth.service!.founderGeneratePayoutStatement(teacherId: r.teacherId, month: r.month);
      if (!mounted) return;
      setState(() {
        _statements[_stKey(r.teacherId, r.month)] = stmt;
        _busy = false;
      });
      _toast(stmt.note.isNotEmpty ? stmt.note : 'Statement ${stmt.status}.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    }
  }

  Future<void> _approveStatement(PayoutRow r, PayoutStatement stmt) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Approve this statement?'),
        content: Text('Approve ${r.teacherName.isNotEmpty ? r.teacherName : r.teacherId}\'s ${r.month} statement'
            '${stmt.calculatedAmount != null ? ' for ${inr(stmt.calculatedAmount!)}' : ''}? '
            'Only after this can the payment be recorded.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Approve')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      final approved = await auth.service!.founderApprovePayoutStatement(
        statementId: stmt.statementId,
        teacherId: r.teacherId,
        month: r.month,
      );
      if (!mounted) return;
      setState(() {
        _statements[_stKey(r.teacherId, r.month)] = approved;
        _busy = false;
      });
      _toast(approved.note.isNotEmpty ? approved.note : 'Statement approved.');
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    }
  }

  /// A small, signed (+/-), mandatory-reason manual adjustment against a
  /// not-yet-approved statement. approvedBy/At are always the founder's own
  /// session, server-side — there is nothing for the client to supply there.
  Future<void> _addAdjustment(PayoutRow r, PayoutStatement stmt) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final amountCtl = TextEditingController();
    final reasonCtl = TextEditingController();
    String? error;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('Payout adjustment'),
          content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text('${r.teacherName.isNotEmpty ? r.teacherName : r.teacherId} · ${r.month}',
                style: TextStyle(fontSize: 12, color: AppColors.adaptive(ctx, AppColors.muted))),
            const SizedBox(height: AppSpace.s3),
            TextField(
              controller: amountCtl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
              decoration: const InputDecoration(labelText: 'Amount (+ to add, - to deduct)', prefixText: '₹ '),
            ),
            const SizedBox(height: AppSpace.s3),
            TextField(
              controller: reasonCtl,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Reason (required)'),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s2),
                child: Text(error!, style: TextStyle(color: AppColors.adaptive(ctx, AppColors.blockFg), fontSize: 12.5)),
              ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(
              onPressed: () {
                final amount = num.tryParse(amountCtl.text.trim());
                if (amount == null || amount == 0) {
                  setLocal(() => error = 'Give a non-zero signed amount.');
                  return;
                }
                if (reasonCtl.text.trim().isEmpty) {
                  setLocal(() => error = 'Say why this adjustment is being made.');
                  return;
                }
                Navigator.pop(ctx, true);
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() => _busy = true);
    try {
      final result = await auth.service!.founderAddPayoutAdjustment(
        statementId: stmt.statementId,
        amount: num.parse(amountCtl.text.trim()),
        reason: reasonCtl.text.trim(),
      );
      if (!mounted) return;
      final m = result as Map<String, dynamic>;
      setState(() => _busy = false);
      _toast((m['note'] ?? 'Adjustment recorded.').toString());
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    }
  }

  /// Record money actually paid to a teacher. The amount defaults to the
  /// outstanding balance; the backend posts the cashbook entry.
  Future<void> _recordPayment(PayoutRow r) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final amountCtl = TextEditingController(text: r.balance.toStringAsFixed(0));
    final refCtl = TextEditingController();
    var mode = 'Bank Transfer';
    // When the money actually went out. A payout settled late or in advance
    // needs a real date — the server accepts one, and without it every payout
    // is silently stamped today.
    var paidOn = _todayIso();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: Text('Pay ${r.teacherName.isNotEmpty ? r.teacherName : r.teacherId}'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            Text('Service month ${r.month} · balance ${inr(r.balance)}',
                style: TextStyle(fontSize: 12, color: AppColors.adaptive(ctx, AppColors.muted))),
            const SizedBox(height: AppSpace.s3),
            TextField(
              controller: amountCtl,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Amount paid', prefixText: '₹ '),
            ),
            const SizedBox(height: AppSpace.s2),
            DropdownButtonFormField<String>(
              initialValue: mode,
              decoration: const InputDecoration(labelText: 'Payment mode'),
              items: const [
                DropdownMenuItem(value: 'Bank Transfer', child: Text('Bank Transfer')),
                DropdownMenuItem(value: 'UPI', child: Text('UPI')),
                DropdownMenuItem(value: 'Cash', child: Text('Cash')),
                DropdownMenuItem(value: 'Cheque', child: Text('Cheque')),
              ],
              onChanged: (v) => setLocal(() => mode = v ?? mode),
            ),
            const SizedBox(height: AppSpace.s2),
            ListTile(
              contentPadding: EdgeInsets.zero,
              dense: true,
              leading: const Icon(Icons.event_outlined),
              title: Text('Paid on: $paidOn', style: const TextStyle(fontSize: 13)),
              onTap: () async {
                final picked = await showDatePicker(
                  context: ctx,
                  initialDate: DateTime.tryParse(paidOn) ?? DateTime.now(),
                  firstDate: DateTime(2020),
                  lastDate: DateTime.now().add(const Duration(days: 365)),
                );
                if (picked != null) {
                  setLocal(() => paidOn =
                      '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
                }
              },
            ),
            TextField(
              controller: refCtl,
              decoration: const InputDecoration(labelText: 'Reference (optional)'),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Record')),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;

    final amount = num.tryParse(amountCtl.text.trim()) ?? 0;
    if (amount <= 0) {
      _toast('Enter an amount greater than zero.');
      return;
    }
    setState(() => _busy = true);
    try {
      final paid = await auth.service!.recordTeacherPayout(
        teacherId: r.teacherId,
        month: r.month,
        amount: amount,
        paymentMode: mode,
        reference: refCtl.text.trim(),
        paidOn: paidOn,
      );
      if (!mounted) return;
      _toast('Recorded ${inr(paid.amount)} for ${r.teacherName}.');
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      _toast(e.message);
    }
  }

  void _toast(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  static String _todayIso() {
    final n = DateTime.now();
    return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
  }

  Widget _monthInput(String label, String value, ValueChanged<String> onChanged) {
    final c = TextEditingController(text: value);
    return TextField(
      controller: c,
      decoration: InputDecoration(labelText: label, prefixIcon: const Icon(Icons.calendar_month_outlined)),
      onSubmitted: onChanged,
    );
  }

  Widget _metric(String label, String value, Color color) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.s3),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(), style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.adaptive(context, AppColors.muted))),
            Text(value, style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800, color: color)),
          ]),
        ),
      ),
    );
  }

  Widget _tag(String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.adaptive(context, AppColors.pageBg),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text('$label $value', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted), fontWeight: FontWeight.w600)),
    );
  }
}