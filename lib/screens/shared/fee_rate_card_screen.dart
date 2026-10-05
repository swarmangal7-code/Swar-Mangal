import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../state/sync_manager.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';
import 'export_share_dialog.dart';

/// Shared by founder and staff: the academy's published, quotable price list
/// per instrument (2026-10-05) — entirely separate from what any individual
/// student actually pays (that's each student's own `monthlyFee`). Rows are
/// edited or deactivated directly, never hard-deleted — same pattern as a
/// teacher or school record, not the effective-dated/append-only payout
/// settings tables. Both roles may add/edit/deactivate rows (server-enforced,
/// STAFF-tier); nothing left here is founder-only.
class FeeRateCardScreen extends StatefulWidget {
  const FeeRateCardScreen({super.key});
  @override
  State<FeeRateCardScreen> createState() => _FeeRateCardScreenState();
}

class _FeeRateCardScreenState extends State<FeeRateCardScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'feeRateCard'};

  @override
  Future<void> reloadFromSync() => _load();

  List<FeeRateCardRow> _rows = [];
  bool _busy = true;
  String? _error;

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
      final rows = await auth.service!.listFeeRateCard(includeInactive: true);
      if (!mounted) return;
      setState(() {
        _rows = rows;
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

  Map<String, List<FeeRateCardRow>> get _byInstrument {
    final map = <String, List<FeeRateCardRow>>{};
    for (final r in _rows) {
      (map[r.instrument] ??= []).add(r);
    }
    return map;
  }

  Future<void> _addOrEdit([FeeRateCardRow? row]) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _FeeRateCardForm(editing: row),
    );
    if (saved == true) await _load();
  }

  Future<void> _deactivate(FeeRateCardRow row) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Deactivate this rate?'),
        content: Text(
          '${row.name} (${row.instrument}) will stop appearing on new exports and the active price list. '
          'It is kept, not deleted, and can be re-added if needed.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Deactivate')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    try {
      await auth.service!.deactivateFeeRateCard(row.id);
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) return const SkeletonList(rows: 6);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Fee Rate Card'),
        actions: [
          IconButton(
            tooltip: 'Export / Share',
            icon: const Icon(Icons.ios_share_outlined),
            onPressed: () => showExportShareDialog(
              context,
              docKind: ExportShareDocKind.feeStructure,
              documentLabel: 'Fee Rate Card',
            ),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.adaptive(context, AppColors.primary),
        foregroundColor: Colors.white,
        onPressed: () => _addOrEdit(),
        icon: const Icon(Icons.add),
        label: const Text('Add rate'),
      ),
      body: RefreshScaffold(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(AppSpace.s4),
          children: [
            Text(
              'The academy\'s published price list — a quotable rate per instrument. This is separate from what any '
              'individual student actually pays; edit it directly, the same way you\'d edit a teacher or school record.',
              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
            ),
            const SizedBox(height: AppSpace.s4),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpace.s3),
                child: ErrorView(_error!, onRetry: _load, compact: true),
              ),
            if (_rows.isEmpty)
              const EmptyState('No rate card rows yet. Add the first quotable price for an instrument.')
            else
              for (final instrument in _byInstrument.keys.toList()..sort())
                _InstrumentSection(
                  instrument: instrument,
                  rows: _byInstrument[instrument]!,
                  onEdit: _addOrEdit,
                  onDeactivate: _deactivate,
                ),
          ],
        ),
      ),
    );
  }
}

class _InstrumentSection extends StatelessWidget {
  const _InstrumentSection({required this.instrument, required this.rows, required this.onEdit, required this.onDeactivate});
  final String instrument;
  final List<FeeRateCardRow> rows;
  final void Function(FeeRateCardRow) onEdit;
  final void Function(FeeRateCardRow) onDeactivate;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      SectionTitle(instrument),
      for (final row in rows)
        Card(
          margin: const EdgeInsets.only(bottom: AppSpace.s2),
          child: Opacity(
            opacity: row.active ? 1 : 0.55,
            child: ListTile(
              title: Row(children: [
                Flexible(child: Text(row.name, style: const TextStyle(fontWeight: FontWeight.w700))),
                if (!row.active) ...[
                  const SizedBox(width: 6),
                  const StatusBadge('Inactive'),
                ],
              ]),
              subtitle: Text(
                '${inr(row.feeAmount)} / ${row.billingPeriod}${row.notes.isNotEmpty ? ' · ${row.notes}' : ''}',
                style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
              ),
              trailing: PopupMenuButton<String>(
                icon: Icon(Icons.more_vert, size: 20, color: AppColors.adaptive(context, AppColors.muted)),
                onSelected: (v) {
                  if (v == 'edit') onEdit(row);
                  if (v == 'deactivate') onDeactivate(row);
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                  if (row.active) const PopupMenuItem(value: 'deactivate', child: Text('Deactivate')),
                ],
              ),
            ),
          ),
        ),
      const SizedBox(height: AppSpace.s2),
    ]);
  }
}

class _FeeRateCardForm extends StatefulWidget {
  const _FeeRateCardForm({this.editing});
  final FeeRateCardRow? editing;
  bool get isEdit => editing != null;
  @override
  State<_FeeRateCardForm> createState() => _FeeRateCardFormState();
}

class _FeeRateCardFormState extends State<_FeeRateCardForm> {
  final _name = TextEditingController();
  final _fee = TextEditingController();
  final _notes = TextEditingController();
  String? _instrument;
  String _billingPeriod = 'Monthly';
  List<String> _instruments = [];
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.editing;
    _name.text = e?.name ?? '';
    _fee.text = e != null ? e.feeAmount.toString() : '';
    _notes.text = e?.notes ?? '';
    _billingPeriod = e?.billingPeriod ?? 'Monthly';
    _instrument = (e?.instrument ?? '').isEmpty ? null : e!.instrument;
    _loadInstruments();
  }

  @override
  void dispose() {
    _name.dispose();
    _fee.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _loadInstruments() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final list = await auth.service!.listInstruments();
      if (!mounted) return;
      setState(() {
        _instruments = list;
        _instrument ??= list.isNotEmpty ? list.first : null;
      });
    } catch (_) {/* instrument field stays empty; Save will show the server's own validation error */}
  }

  Future<void> _save() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final fee = num.tryParse(_fee.text.trim());
    if ((_instrument ?? '').isEmpty) {
      setState(() => _error = 'Choose an instrument.');
      return;
    }
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Give this rate card row a name (e.g. Standard, 1-on-1).');
      return;
    }
    if (fee == null || fee <= 0) {
      setState(() => _error = 'Enter a fee amount greater than zero.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await auth.service!.upsertFeeRateCard(
        id: widget.editing?.id ?? '',
        instrument: _instrument!,
        name: _name.text.trim(),
        feeAmount: fee,
        billingPeriod: _billingPeriod,
        notes: _notes.text.trim(),
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
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
    return AlertDialog(
      title: Text(widget.isEdit ? 'Edit rate' : 'Add rate'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          DropdownButtonFormField<String>(
            initialValue: _instrument,
            decoration: const InputDecoration(labelText: 'Instrument *'),
            hint: const Text('Select instrument…'),
            items: [
              for (final i in _instruments) DropdownMenuItem(value: i, child: Text(i)),
            ],
            onChanged: (v) => setState(() => _instrument = v),
          ),
          const SizedBox(height: AppSpace.s3),
          TextFormField(
            controller: _name,
            decoration: const InputDecoration(labelText: 'Plan name (e.g. Standard, 1-on-1) *'),
          ),
          const SizedBox(height: AppSpace.s3),
          Row(children: [
            Expanded(
              child: TextFormField(
                controller: _fee,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Fee (₹) *', prefixIcon: Icon(Icons.currency_rupee)),
              ),
            ),
            const SizedBox(width: AppSpace.s3),
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _billingPeriod,
                decoration: const InputDecoration(labelText: 'Billing period'),
                items: const [
                  DropdownMenuItem(value: 'Monthly', child: Text('Monthly')),
                  DropdownMenuItem(value: 'Quarterly', child: Text('Quarterly')),
                  DropdownMenuItem(value: 'Annual', child: Text('Annual')),
                  DropdownMenuItem(value: 'One-time', child: Text('One-time')),
                ],
                onChanged: (v) => setState(() => _billingPeriod = v ?? _billingPeriod),
              ),
            ),
          ]),
          const SizedBox(height: AppSpace.s3),
          TextFormField(
            controller: _notes,
            decoration: const InputDecoration(labelText: 'Notes (optional)'),
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
          onPressed: _busy ? null : _save,
          child: _busy
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Save'),
        ),
      ],
    );
  }
}
