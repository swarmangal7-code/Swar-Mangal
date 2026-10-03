import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/sync_manager.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Staff "My Requests" — shows submitted drafts + status per the reference
/// (api_staff_listMyApprovals). Approval is founder-only.
/// Business rule #5: staff proposal → submitted → founder decides. This
/// screen is read-only status for the operator.
class MyRequestsScreen extends StatefulWidget {
  const MyRequestsScreen({super.key, this.highlightItemId});

  /// Set when this screen was opened from a push notification tap
  /// (push_service.dart). This screen has no separate detail sheet — every
  /// request's full state already shows inline on its card — so "opening"
  /// the highlighted request means scrolling it into view and giving it a
  /// brief visual highlight instead.
  final String? highlightItemId;

  @override
  State<MyRequestsScreen> createState() => _MyRequestsScreenState();
}

class _MyRequestsScreenState extends State<MyRequestsScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'approvals', 'payments', 'expenses'};

  @override
  Future<void> reloadFromSync() => _load();

  List<ApprovalRequestRow> _rows = [];
  String? _error;
  bool _busy = true;
  String _tab = 'ALL';
  bool _highlightHandled = false;
  String? _highlightedRowId;
  final _highlightKey = GlobalKey();

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
      final rows = await auth.service!.staffMyRequests(branch: auth.branch ?? 'ALL');
      if (!mounted) return;
      setState(() {
        _rows = rows;
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

  String _labelFor(String type) =>
      _rows.firstWhere((r) => r.type == type, orElse: () => _rows.first).typeLabel;

  /// Called once the list has loaded — switches to the highlighted request's
  /// tab (so it's actually visible) and scrolls it into view with a brief
  /// highlight. A no-op once handled, and silent if the request is no longer
  /// present (e.g. it was filtered server-side).
  void _maybeOpenHighlight() {
    if (_highlightHandled) return;
    final id = widget.highlightItemId;
    if (id == null || id.isEmpty) return;
    ApprovalRequestRow? match;
    for (final r in _rows) {
      if (r.id == id) {
        match = r;
        break;
      }
    }
    if (match == null) return;
    _highlightHandled = true;
    setState(() {
      _tab = match!.type;
      _highlightedRowId = id;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final ctx = _highlightKey.currentContext;
      if (ctx != null) {
        Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300), alignment: 0.1);
      }
    });
    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) setState(() => _highlightedRowId = null);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_busy && _rows.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null && _rows.isEmpty) return ErrorView(_error!, onRetry: _load);

    final waiting = _rows.where((r) => r.waiting).length;
    final approved = _rows.where((r) => r.approved).length;
    final rejected = _rows.where((r) => r.rejected).length;
    final types = <String>{'ALL', ..._rows.map((r) => r.type)}.toList();
    final visible = _tab == 'ALL' ? _rows : _rows.where((r) => r.type == _tab).toList();

    return RefreshScaffold(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Row(children: [
            const Icon(Icons.outbox_outlined, color: AppColors.primary),
            const SizedBox(width: AppSpace.s2),
            Text('My requests', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
            const Spacer(),
            if (waiting > 0) Badge(text: '$waiting pending', color: AppColors.warnBg),
          ]),
          const SizedBox(height: AppSpace.s2),
          const Card(
            color: AppColors.infoBg,
            child: Padding(
              padding: EdgeInsets.all(AppSpace.s3),
              child: Text(
                  'Approval is founder-only. These are your submitted drafts — '
                  'their status reflects the current queue. No edits are possible here.',
                  style: TextStyle(fontSize: 12, color: AppColors.infoFg)),
            ),
          ),
          const SizedBox(height: AppSpace.s3),
          Row(children: [
            Expanded(
              child: StatTile(
                label: 'Pending',
                value: '$waiting',
                icon: Icons.schedule_outlined,
              ),
            ),
            const SizedBox(width: AppSpace.s2),
            Expanded(
              child: StatTile(
                label: 'Approved',
                value: '$approved',
                icon: Icons.check_circle_outline,
              ),
            ),
            const SizedBox(width: AppSpace.s2),
            Expanded(
              child: StatTile(
                label: 'Rejected',
                value: '$rejected',
                icon: Icons.cancel_outlined,
              ),
            ),
          ]),
          const SizedBox(height: AppSpace.s3),
          // One chip per request type, matching the filter tabs on web.
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: [
              for (final t in types) ...[
                ChoiceChip(
                  label: Text(t == 'ALL' ? 'All' : _labelFor(t)),
                  selected: _tab == t,
                  onSelected: (_) => setState(() => _tab = t),
                ),
                const SizedBox(width: AppSpace.s2),
              ],
            ]),
          ),
          const SizedBox(height: AppSpace.s4),
          if (visible.isEmpty)
            const EmptyState('No requests submitted from this branch.', icon: Icons.outbox_outlined),
          for (final row in visible)
            Card(
              key: row.id == _highlightedRowId ? _highlightKey : null,
              margin: const EdgeInsets.only(bottom: AppSpace.s3),
              color: row.id == _highlightedRowId ? AppColors.adaptive(context, AppColors.focus).withValues(alpha: .18) : null,
              shape: row.id == _highlightedRowId
                  ? RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.s),
                      side: BorderSide(color: AppColors.adaptive(context, AppColors.focus), width: 1.5),
                    )
                  : null,
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  // Chips wrap onto their own line; a long status such as
                  // BACKDATED_APPROVAL_REQUIRED used to squeeze the id to one
                  // character per line and overflow the card.
                  Wrap(
                    spacing: AppSpace.s2,
                    runSpacing: AppSpace.s2,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      TagChip(row.typeLabel),
                      StatusBadge(row.status.isEmpty ? 'UNKNOWN' : row.status),
                    ],
                  ),
                  const SizedBox(height: AppSpace.s2),
                  Text(row.id,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  if (row.student.isNotEmpty || row.category.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpace.s2),
                      child: Text(
                          [row.student, row.category].where((e) => e.isNotEmpty).join(' · '),
                          style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                    ),
                  // The founder's reason, when there is one. Without it a
                  // rejected request tells the submitter nothing.
                  if (row.decisionNote.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: AppSpace.s2),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(AppSpace.s2),
                        decoration: BoxDecoration(
                          color: AppColors.adaptive(context, AppColors.warnBg),
                          borderRadius: BorderRadius.circular(AppRadius.s),
                        ),
                        child: Text('Sharvil: ${row.decisionNote}',
                            style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg))),
                      ),
                    ),
                  Row(children: [
                    if (row.amount.isNotEmpty)
                      Text('₹${row.amount}',
                          style: const TextStyle(fontWeight: FontWeight.w800, color: AppColors.primary)),
                    const Spacer(),
                    if (row.backdated) ...[
                      TagChip('BACKDATED', color: AppColors.blockFg),
                      const SizedBox(width: AppSpace.s2),
                    ],
                    if (row.when.isNotEmpty)
                      Flexible(
                        child: Text(row.when,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, color: AppColors.muted)),
                      ),
                  ]),
                ]),
              ),
            ),
        ],
      ),
    );
  }
}

/// Tiny helper for a count badge (inline with text).
class Badge extends StatelessWidget {
  const Badge({super.key, required this.text, required this.color});
  final String text;
  final Color color;
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(4)),
        child: Text(text, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w800)),
      );
}