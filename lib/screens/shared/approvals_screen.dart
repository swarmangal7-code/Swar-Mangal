import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/sync_manager.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Founder approval centre — one list, each row its own decision button.
/// Money (payment drafts) approves via the audited approve endpoint; student
/// drafts merge into the master. Nothing here writes money silently.
class ApprovalsScreen extends StatefulWidget {
  const ApprovalsScreen({super.key, this.highlightItemId});

  /// Set when this screen was opened from a push notification tap
  /// (push_service.dart) — once the queue has loaded, the matching item's
  /// detail sheet opens automatically, the same sheet `_showDetails` opens
  /// for a manual tap on the item's "Details" button.
  final String? highlightItemId;

  @override
  State<ApprovalsScreen> createState() => _ApprovalsScreenState();
}

class _ApprovalsScreenState extends State<ApprovalsScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'approvals', 'payments', 'students'};

  @override
  Future<void> reloadFromSync() => _load();

  ApprovalsData? _data;
  List<PaymentDraftRow> _queue = [];
  String? _error;
  bool _busy = true;
  String _tab = 'ALL';
  final Set<String> _acting = {};
  bool _highlightHandled = false;

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
        auth.service!.founderApprovals(),
        auth.service!.founderListPaymentDrafts(),
      ]);
      if (!mounted) return;
      setState(() {
        _data = results[0] as ApprovalsData;
        _queue = results[1] as List<PaymentDraftRow>;
        _busy = false;
      });
      _maybeOpenHighlight();
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

  /// FINALISE — the real-money step: reserves a receipt number, writes
  /// STUDENT_RECEIPTS + MONEY_LEDGER, advances the due date, renders the PDF.
  Future<void> _finalise(PaymentDraftRow row) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    if (_acting.contains(row.draftId)) return;
    final confirm = await _confirm(
      'Create receipt — REAL MONEY',
      'Finalising ${row.draftId} (₹${row.amount}) allocates a receipt number, '
      'writes STUDENT_RECEIPTS + MONEY_LEDGER, advances the due date and '
      'generates the PDF. This is audited and NOT reversible from the app.',
    );
    if (!confirm) return;
    setState(() => _acting.add(row.draftId));
    try {
      final r = await auth.service!.founderFinalisePaymentDraft(row.draftId);
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      final okRes = m['ok'] == true;
      final demoTag = m['demo'] == true ? ' (DEMO — not persisted)' : '';
      if (okRes) {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
              content: Text('Receipt ${m['receiptNo']} created$demoTag')));
      } else if (m['code'] == 'INCOMPLETE_STUDENT' || m['error'] == 'INCOMPLETE_STUDENT') {
        // The server has no override flag — there is nothing to force here.
        // Naming the missing fields is the actual remedy, so say that instead
        // of offering a second call that would fail identically.
        final missing = (m['missing'] as List?)?.join(', ') ?? 'the fee plan and due day';
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
            content: Text('Cannot create the receipt: this student\'s record is missing $missing. '
                'Fix the student\'s fee plan, then finalise again.')));
      } else {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
              content: Text((m['message'] ?? m['error'] ?? 'Finalise failed'))));
      }
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      await _load();
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _acting.remove(row.draftId));
    }
  }

  Future<void> _act(ApprovalItem item, String action) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    if (_acting.contains(item.itemId)) return;
    setState(() => _acting.add(item.itemId));
    try {
      final isExpense = item.type == 'EXPENSE_DRAFT';
      if (action == 'reject') {
        final reason = await _ask('Reject ${item.itemId}', 'Reason (required)');
        if (reason == null) return;
        if (item.type == 'STUDENT_DRAFT') {
          await auth.service!.founderStudentDraftReject(item.itemId, reason);
        } else if (isExpense) {
          await auth.service!.founderExpenseDraftReject(item.itemId, reason);
        } else if (item.type == 'RECEIPT_CORRECTION') {
          await auth.service!.raw('api_founder_correctionReject', {'correctionId': item.itemId, 'reason': reason});
        } else if (item.type == 'SCHOOL_INVOICE_DRAFT') {
          await auth.service!.raw('api_founder_schoolInvoiceDraftReject', {'draftId': item.itemId, 'reason': reason});
        } else if (item.type == 'PACKAGE_EXTENSION') {
          await auth.service!.raw('api_founder_packageExtensionReject', {'requestId': item.itemId, 'reason': reason});
        } else if (item.type == 'PAYMENT_PROFILE_CHANGE') {
          await auth.service!.raw('api_founder_paymentProfileChangeReject', {'requestId': item.itemId, 'reason': reason});
        } else if (item.type == 'CLOSURE') {
          await auth.service!.raw('api_founder_closureReject', {'closureId': item.itemId, 'reason': reason});
        } else if (item.type == 'CLASS_CORRECTION') {
          await auth.service!.raw('api_founder_rejectClassCorrection', {'correctionId': item.itemId, 'reason': reason});
        } else if (item.type == 'LATE_FEE_WAIVER') {
          await auth.service!.raw('api_founder_lateFeeWaiverReject', {'requestId': item.itemId, 'reason': reason});
        } else if (item.type == 'INSTALMENT_PLAN') {
          await auth.service!.raw('api_founder_instalmentPlanDraftReject', {'draftId': item.itemId, 'reason': reason});
        } else if (item.type == 'MANUAL_TERMS_ACCEPTANCE') {
          await auth.service!.raw('api_founder_manualTermsAcceptanceReject', {'requestId': item.itemId, 'reason': reason});
        } else if (item.type == 'TEACHER_ADD_REQUEST' || item.type == 'TEACHER_EDIT_REQUEST') {
          await auth.service!.raw('api_founder_addTeacherRequestReject', {'requestId': item.itemId, 'reason': reason});
        } else {
          await auth.service!.founderPaymentDraftReject(item.itemId, reason);
        }
      } else if (action == 'approve') {
        if (isExpense) {
          final confirmed = await _confirm('Approve expense',
              'Record "${item.reason}" as a real expense and post it to the cashbook?');
          if (!confirmed) return;
          await auth.service!.founderExpenseDraftApprove(item.itemId);
        } else if (item.type == 'PACKAGE_EXTENSION') {
          final confirmed = await _confirm('Approve package extension',
              'Extend "${item.entity}"\'s package by ${item.feesPeriod}?');
          if (!confirmed) return;
          await auth.service!.raw('api_founder_packageExtensionApprove', {'requestId': item.itemId});
        } else if (item.type == 'PAYMENT_PROFILE_CHANGE') {
          final confirmed = await _confirm('Approve payment profile change', 'Update "${item.entity}"?');
          if (!confirmed) return;
          await auth.service!.raw('api_founder_paymentProfileChangeApprove', {'requestId': item.itemId});
        } else if (item.type == 'CLOSURE') {
          final confirmed = await _confirm('Authorise closure',
              '${item.entity} · ${item.feesPeriod}. Classes in this range become not required. This has financial effect.');
          if (!confirmed) return;
          await auth.service!.raw('api_founder_authoriseClosure', {'closureId': item.itemId});
        } else if (item.type == 'CLASS_CORRECTION') {
          final confirmed = await _confirm('Approve class correction',
              '${item.entity} was answered as "${item.feesPeriod}". Re-open it so staff can answer it again?');
          if (!confirmed) return;
          await auth.service!.raw('api_founder_approveClassCorrection', {'correctionId': item.itemId});
        } else if (item.type == 'LATE_FEE_WAIVER') {
          final confirmed = await _confirm('Approve late-fee waiver', 'Waive the late fee for "${item.entity}"?');
          if (!confirmed) return;
          await auth.service!.raw('api_founder_lateFeeWaiverApprove', {'requestId': item.itemId});
        } else if (item.type == 'INSTALMENT_PLAN') {
          final confirmed = await _confirm('Approve instalment plan',
              'Create a ${item.feesPeriod} plan for "${item.entity}" totalling ₹${item.amount}?');
          if (!confirmed) return;
          await auth.service!.raw('api_founder_instalmentPlanDraftApprove', {'draftId': item.itemId});
        } else if (item.type == 'MANUAL_TERMS_ACCEPTANCE') {
          final confirmed = await _confirm('Approve manual terms acceptance', 'Record terms as accepted for "${item.entity}"?');
          if (!confirmed) return;
          await auth.service!.raw('api_founder_manualTermsAcceptanceApprove', {'requestId': item.itemId});
        } else if (item.type == 'TEACHER_ADD_REQUEST' || item.type == 'TEACHER_EDIT_REQUEST') {
          final isEdit = item.type == 'TEACHER_EDIT_REQUEST';
          final confirmed = await _confirm(
            isEdit ? 'Approve teacher change' : 'Add teacher',
            isEdit ? 'Apply this change to "${item.entity}" (${item.reason})?' : 'Add "${item.entity}" as a teacher (${item.reason})?',
          );
          if (!confirmed) return;
          await auth.service!.raw('api_founder_addTeacherRequestApprove', {'requestId': item.itemId});
        } else {
          await auth.service!.founderPaymentDraftApprove(item.itemId);
        }
      } else if (action == 'merge') {
        final ok = await _confirm('Merge student draft', 'Merge "${item.entity}" into the STUDENTS master?');
        if (!ok) return;
        await auth.service!.founderMergeStudentDraft(item.itemId);
      } else if (action == 'void') {
        // Pattern C: never edit a receipt. This voids it (permanent, keeps the
        // number) so a corrected one can be issued.
        final ok = await _confirm('Void ${item.receiptNo}',
            'This permanently voids the receipt. It is excluded from every total; a new payment issues a new receipt. This cannot be undone.');
        if (!ok) return;
        await auth.service!.raw('api_founder_voidReceipt', {'correctionId': item.itemId});
      } else if (action == 'finalise') {
        final ok = await _confirm('Issue invoice',
            'Allocate the next SMI- number and issue "${item.entity}" for ₹${item.amount}?');
        if (!ok) return;
        await auth.service!.raw('api_founder_finaliseSchoolInvoiceDraft', {'draftId': item.itemId});
      } else {
        return;
      }
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text('${item.itemId} → $action')));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _acting.remove(item.itemId));
    }
  }

  /// Called once the queue has loaded — opens the highlighted item's own
  /// detail sheet (same one "Details" opens) if it's still in the queue.
  /// A no-op once already handled, and a silent no-op if the item has since
  /// been decided and dropped off the queue (nothing left to show).
  void _maybeOpenHighlight() {
    if (_highlightHandled) return;
    final id = widget.highlightItemId;
    if (id == null || id.isEmpty) return;
    final data = _data;
    if (data == null) return;
    _highlightHandled = true;
    for (final g in data.groups) {
      for (final item in g.items) {
        if (item.itemId == id) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) _showDetails(item);
          });
          return;
        }
      }
    }
  }

  /// Every column behind this card — read-only, changes nothing. Field names
  /// come straight from the database, so they're shown as-is (readable
  /// enough on their own) rather than re-labelled per type.
  Future<void> _showDetails(ApprovalItem item) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    Map<String, String>? fields;
    String? error;
    try {
      fields = await auth.service!.founderApprovalItemDetail(item.type, item.itemId);
    } on ApiException catch (e) {
      error = e.message;
    } on ApiUnreachable catch (e) {
      error = e.message;
    }
    if (!mounted) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.6,
        maxChildSize: 0.9,
        builder: (sheetContext, scrollController) => SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpace.s4),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Text('${item.entity} — full record', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16))),
                IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(sheetContext)),
              ]),
              Text(item.itemId, style: TextStyle(fontSize: 12, color: AppColors.adaptive(sheetContext, AppColors.muted))),
              const SizedBox(height: AppSpace.s3),
              Expanded(
                child: error != null
                    ? ErrorView(error)
                    : (fields == null || fields.isEmpty)
                        ? const EmptyState('No further detail stored for this record.')
                        : ListView(
                            controller: scrollController,
                            children: [
                              for (final e in fields.entries)
                                Padding(
                                  padding: const EdgeInsets.symmetric(vertical: AppSpace.s1),
                                  child: InfoRow(_prettyFieldName(e.key), e.value),
                                ),
                            ],
                          ),
              ),
            ]),
          ),
        ),
      ),
    );
  }

  String _prettyFieldName(String column) => column
      .split('_')
      .map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
      .join(' ');

  Future<String?> _ask(String title, String label) {
    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: c, maxLines: 2, decoration: InputDecoration(labelText: label)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () {
              if (c.text.trim().isEmpty) return;
              Navigator.pop(ctx, c.text.trim());
            },
            child: const Text('Confirm'),
          ),
        ],
      ),
    );
  }

  Future<bool> _confirm(String title, String message) async {
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            title: Text(title),
            content: Text(message),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Yes')),
            ],
          ),
        ) ??
        false;
  }

  @override
  Widget build(BuildContext context) {
    if (_busy && _data == null) return const Center(child: CircularProgressIndicator());
    if (_error != null && _data == null) return ErrorView(_error!, onRetry: _load);
    final d = _data!;
    return RefreshScaffold(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          PageHero(eyebrow: 'Approvals', headline: '${d.count} awaiting your authority', fontSize: 22),
          const SizedBox(height: AppSpace.s4),
          // One chip per approval group, matching the web filter tabs.
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              for (final g in d.groups) ...[
                ChoiceChip(
                  label: Text('${g.label} (${g.items.length})', style: const TextStyle(fontSize: 12)),
                  selected: _tab == g.type,
                  onSelected: (_) => setState(() => _tab = _tab == g.type ? 'ALL' : g.type),
                ),
                const SizedBox(width: AppSpace.s2),
              ],
            ]),
          ),
          const SizedBox(height: AppSpace.s4),
          if (d.empty)
            const Card(
              child: Padding(
                padding: EdgeInsets.all(AppSpace.s5),
                child: EmptyState('Nothing awaiting your approval.', icon: Icons.done_all),
              ),
            ),
          for (final g in d.groups) ...[
            if (_tab == 'ALL' || _tab == g.type) ...[
              SectionTitle(g.label),
              for (final item in g.items) _itemCard(item),
            ],
          ],
          if (_tab == 'ALL') ...[
            const SectionTitle('Receipts pending'),
            Text(
              'Every payment draft staff has raised. Finalising writes real money records server-side.',
              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
            ),
            const SizedBox(height: AppSpace.s3),
            if (_queue.isEmpty)
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s4),
                  child: Text('No payment drafts in the queue.',
                      style: TextStyle(color: AppColors.adaptive(context, AppColors.muted), fontSize: 13)),
                ),
              )
            else
              // Every draft is listed, not just the approved ones — the founder
              // needs to see what staff is waiting on. Only APPROVED can be
              // turned into a receipt; the rest show as pending.
              for (final row in _queue) _draftCard(row),
          ],
        ],
      ),
    );
  }

  Widget _draftCard(PaymentDraftRow row) {
    final busy = _acting.contains(row.draftId);
    final authLabel = row.authorityLabel;
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.s3),
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(row.studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                Text('${row.draftId} · ${row.branch}',
                    style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
              ]),
            ),
            if (row.amount.isNotEmpty)
              Text('₹${row.amount}',
                  style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.primary))),
          ]),
          const SizedBox(height: AppSpace.s2),
          Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
            StatusBadge(row.status),
            if (row.repairRequired) const StatusBadge('REPAIR REQUIRED'),
            if (row.paymentMode.isNotEmpty) TagChip(row.paymentMode, color: AppColors.adaptive(context, AppColors.focus)),
            if (row.projectNextDueDate.isNotEmpty)
              TagChip('→ due ${row.projectNextDueDate}', color: AppColors.adaptive(context, AppColors.muted)),
            if (authLabel.isNotEmpty)
              TagChip(authLabel, color: AppColors.adaptive(context, AppColors.muted)),
          ]),
          const SizedBox(height: AppSpace.s3),
          Row(children: [
            if (row.repairRequired)
              OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.adaptive(context, AppColors.muted),
                  side: BorderSide(color: AppColors.adaptive(context, AppColors.muted).withValues(alpha: .6)),
                  minimumSize: const Size(0, 40),
                ),
                onPressed: () => ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
                    content: Text('Repair is done on the founder web app — the block names the missing data.'))),
                icon: const Icon(Icons.build_outlined, size: 16),
                label: const Text('Repair (founder web)'),
              )
            else
              // Only an APPROVED draft may be finalised — a SUBMITTED one is
              // still waiting on this same screen's decision.
              _actionBtn(
                'Create receipt',
                AppColors.adaptive(context, AppColors.primary),
                busy,
                () => _finalise(row),
                enabled: row.approved,
              ),
          ]),
        ]),
      ),
    );
  }

  Widget _itemCard(ApprovalItem item) {
    final busy = _acting.contains(item.itemId);
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.s3),
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(item.entity, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                Text('${item.itemId} · ${item.date}',
                    style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
              ]),
            ),
            if (item.amount.isNotEmpty)
              Text('₹${item.amount}', style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.primary))),
          ]),
          const SizedBox(height: AppSpace.s2),
          Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
            StatusBadge(item.typeLabel),
            if (item.noStudentLinked)
              const StatusBadge('NO STUDENT LINKED')
            else if (item.studentId.isNotEmpty)
              TagChip(item.studentId, color: AppColors.adaptive(context, AppColors.focus)),
            if (item.backdated) const StatusBadge('BACKDATED'),
            if (item.incomplete) const StatusBadge('INCOMPLETE'),
            if (item.junk) const StatusBadge('QA/JUNK'),
            if (item.termsStatus.isNotEmpty)
              TagChip(item.termsStatus, color: AppColors.adaptive(context, AppColors.muted)),
            StatusBadge(item.reason),
          ]),
          if (item.feesPeriod.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s2),
              child: Text('Period: ${item.feesPeriod}',
                  style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
            ),
          const SizedBox(height: AppSpace.s3),
          Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
            if (item.actions.contains('details'))
              OutlinedButton.icon(
                onPressed: () => _showDetails(item),
                icon: const Icon(Icons.info_outline, size: 16),
                label: const Text('Details'),
              ),
            if (item.actions.contains('approve'))
              _actionBtn('Approve', AppColors.adaptive(context, AppColors.okFg), busy, () => _act(item, 'approve')),
            if (item.actions.contains('merge'))
              _actionBtn('Merge', AppColors.adaptive(context, AppColors.okFg), busy, () => _act(item, 'merge')),
            if (item.actions.contains('void'))
              _actionBtn('Void receipt', AppColors.adaptive(context, AppColors.blockFg), busy, () => _act(item, 'void')),
            if (item.actions.contains('finalise'))
              _actionBtn('Issue invoice', AppColors.adaptive(context, AppColors.okFg), busy, () => _act(item, 'finalise')),
            if (item.actions.contains('reject'))
              _actionBtn('Reject', AppColors.adaptive(context, AppColors.blockFg), busy, () => _act(item, 'reject')),
          ]),
        ]),
      ),
    );
  }

  Widget _actionBtn(String label, Color color, bool busy, VoidCallback onTap, {bool enabled = true}) {
    return OutlinedButton(
      style: OutlinedButton.styleFrom(
        foregroundColor: color,
        side: BorderSide(color: color.withValues(alpha: .6)),
        minimumSize: const Size(0, 40),
        padding: const EdgeInsets.symmetric(horizontal: AppSpace.s3),
      ),
      onPressed: (busy || !enabled) ? null : onTap,
      child: busy
          ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
          : Text(label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12)),
    );
  }
}