import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Founder-only settings for the three append-only, effective-dated payroll
/// tables added 2026-10-03: payout-status rules (% paid per class outcome),
/// the teacher percent-slab ramp, and late-fee grace/rate. Every save here
/// INSERTS a new row server-side — the backend never edits or deletes an
/// earlier one, so a month already shown to the founder (or already closed)
/// never silently reshapes.
///
/// `api_founder_listPayoutSettings` (added 2026-10-03) returns the full
/// history for all three tables, so every row ever added — including the
/// seeded defaults — is shown here, not just what this session has submitted.
class PayoutSettingsScreen extends StatefulWidget {
  const PayoutSettingsScreen({super.key});
  @override
  State<PayoutSettingsScreen> createState() => _PayoutSettingsScreenState();
}

class _PayoutSettingsScreenState extends State<PayoutSettingsScreen> {
  List<_SessionRow> _statusRules = [];
  List<_SessionRow> _slabs = [];
  List<_SessionRow> _lateFee = [];
  bool _loading = true;
  String? _loadError;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _loading = true;
      _loadError = null;
    });
    try {
      final m = await auth.service!.founderListPayoutSettings();
      if (!mounted) return;
      setState(() {
        _statusRules = [
          for (final r in (m['payoutStatusRules'] as List? ?? const []))
            _SessionRow('${r['outcome']} → ${(r['payoutPercent'] as num).toInt()}%',
                'from ${r['effectiveFrom']}${r['effectiveTo'] != null ? ' to ${r['effectiveTo']}' : ''}'),
        ];
        _slabs = [
          for (final r in (m['teacherPercentSlabs'] as List? ?? const []))
            _SessionRow('month ${r['monthsSinceStart']} → ${(r['percent'] as num).toInt()}%', 'from ${r['effectiveFrom']}'),
        ];
        _lateFee = [
          for (final r in (m['lateFeeSettings'] as List? ?? const []))
            _SessionRow('${r['graceDays']} grace days · ₹${r['dailyRate']}/day', 'from ${r['effectiveFrom']}'),
        ];
        _loading = false;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadError = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpace.s4),
      children: [
        const PageHero(eyebrow: 'Payroll', headline: 'Payout & late-fee rules', fontSize: 22),
        const SizedBox(height: AppSpace.s3),
        Card(
          color: AppColors.adaptive(context, AppColors.infoBg),
          child: const Padding(
            padding: EdgeInsets.all(AppSpace.s3),
            child: Text(
              'Every save below adds a new effective-dated row — nothing existing '
              'is ever edited or deleted, so a month already shown to you never '
              'silently reshapes.',
              style: TextStyle(fontSize: 12),
            ),
          ),
        ),
        if (_loadError != null) ...[
          const SizedBox(height: AppSpace.s3),
          Card(
            color: AppColors.adaptive(context, AppColors.blockBg),
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s3),
              child: Row(children: [
                Expanded(child: Text('Could not load history: $_loadError', style: const TextStyle(fontSize: 12))),
                TextButton(onPressed: _load, child: const Text('Retry')),
              ]),
            ),
          ),
        ],
        const SizedBox(height: AppSpace.s4),
        _Section(
          title: 'Payout % by class outcome',
          subtitle: 'Visibility only — shown in the payout preview as outcomeFlags, never '
              'blended into the payable figure. Apply any real rupee correction as a '
              'manual payout adjustment instead.',
          addLabel: 'Add outcome rule',
          rows: _statusRules,
          loading: _loading,
          onAdd: () => _addStatusRule(context),
        ),
        const SizedBox(height: AppSpace.s4),
        _Section(
          title: 'Teacher percent-slab ramp',
          subtitle: 'Months since a teacher’s start → % of the normal rate. Only applies '
              'to a teacher explicitly opted into the slab model; every other teacher '
              'keeps reading their own payout_rules percentage untouched.',
          addLabel: 'Add slab step',
          rows: _slabs,
          loading: _loading,
          onAdd: () => _addSlab(context),
        ),
        const SizedBox(height: AppSpace.s4),
        _Section(
          title: 'Late-fee grace period & daily rate',
          subtitle: 'Days already accrued under an earlier rate are never retroactively '
              'changed — a new setting only affects days from its own effective date on.',
          addLabel: 'Add late-fee setting',
          rows: _lateFee,
          loading: _loading,
          onAdd: () => _addLateFee(context),
        ),
      ],
    );
  }

  Future<void> _addStatusRule(BuildContext context) async {
    final outcome = await showDialog<String>(
      context: context,
      builder: (ctx) => SimpleDialog(
        title: const Text('Choose outcome'),
        children: [
          for (final o in const [
            'HELD',
            'TEACHER_CANCELLED',
            'ACADEMY_CANCELLED',
            'SUBSTITUTE_DELIVERED',
            'RESCHEDULED',
            'TEACHER_ABSENT',
            'SCHOOL_HOLIDAY',
            'STUDENT_ABSENT',
          ])
            SimpleDialogOption(onPressed: () => Navigator.pop(ctx, o), child: Text(o)),
        ],
      ),
    );
    if (outcome == null || !mounted) return;
    final result = await showDialog<_RuleFormResult>(
      context: context,
      builder: (_) => _RuleFormDialog(title: 'Payout % for $outcome', numberLabel: 'Payout percent (0–100)'),
    );
    if (result == null || !mounted) return;
    await _submit(
      context: context,
      run: (svc) => svc.founderSetPayoutStatusRule(
        outcome: outcome,
        payoutPercent: result.number,
        effectiveFrom: result.effectiveFrom,
        notes: result.notes,
      ),
    );
  }

  Future<void> _addSlab(BuildContext context) async {
    final months = await showDialog<int>(
      context: context,
      builder: (ctx) {
        final ctl = TextEditingController();
        return AlertDialog(
          title: const Text('Months since start'),
          content: TextField(
            controller: ctl,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'e.g. 0, 6, 12'),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, int.tryParse(ctl.text.trim())), child: const Text('Next')),
          ],
        );
      },
    );
    if (months == null || !mounted) return;
    final result = await showDialog<_RuleFormResult>(
      context: context,
      builder: (_) => _RuleFormDialog(title: 'Slab % from month $months', numberLabel: 'Percent (0–100)'),
    );
    if (result == null || !mounted) return;
    await _submit(
      context: context,
      run: (svc) => svc.founderSetTeacherPercentSlab(
        monthsSinceStart: months,
        percent: result.number,
        effectiveFrom: result.effectiveFrom,
      ),
    );
  }

  Future<void> _addLateFee(BuildContext context) async {
    final grace = TextEditingController();
    final rate = TextEditingController();
    String? effectiveFrom;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setLocal) => AlertDialog(
          title: const Text('New late-fee setting'),
          content: Column(mainAxisSize: MainAxisSize.min, children: [
            TextField(
              controller: grace,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Grace days'),
            ),
            const SizedBox(height: AppSpace.s3),
            TextField(
              controller: rate,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(labelText: 'Daily rate (₹)'),
            ),
            const SizedBox(height: AppSpace.s3),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.event_outlined),
              title: Text(effectiveFrom ?? 'Effective from (default: today)', style: const TextStyle(fontSize: 13)),
              trailing: TextButton(
                onPressed: () async {
                  final d = await showDatePicker(
                    context: ctx,
                    initialDate: DateTime.now(),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2035),
                  );
                  if (d != null) {
                    setLocal(() => effectiveFrom =
                        '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
                  }
                },
                child: const Text('Pick'),
              ),
            ),
          ]),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      ),
    );
    if (confirmed != true || !mounted) return;
    final graceDays = int.tryParse(grace.text.trim());
    final dailyRate = num.tryParse(rate.text.trim());
    if (graceDays == null || dailyRate == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid grace period and daily rate.')));
      return;
    }
    await _submit(
      context: context,
      run: (svc) => svc.founderSetLateFeeSettings(graceDays: graceDays, dailyRate: dailyRate, effectiveFrom: effectiveFrom ?? ''),
    );
  }

  Future<void> _submit({
    required BuildContext context,
    required Future<dynamic> Function(dynamic svc) run,
  }) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await run(auth.service);
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      final demo = auth.isDemo || m['demo'] == true;
      messenger
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text('${(m['note'] ?? 'Saved.').toString()}${demo ? ' (DEMO — not persisted)' : ''}')));
      // Re-fetch the real history rather than guessing the row's final shape
      // locally — demo mode's fixture list already includes a matching row,
      // and live mode gets the actual just-inserted row back from the server.
      await _load();
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    }
  }
}

class _SessionRow {
  _SessionRow(this.title, this.subtitle);
  final String title;
  final String subtitle;
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.subtitle,
    required this.addLabel,
    required this.rows,
    required this.onAdd,
    required this.loading,
  });
  final String title;
  final String subtitle;
  final String addLabel;
  final List<_SessionRow> rows;
  final VoidCallback onAdd;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
          const SizedBox(height: AppSpace.s2),
          Text(subtitle, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
          const SizedBox(height: AppSpace.s3),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(onPressed: onAdd, icon: const Icon(Icons.add, size: 18), label: Text(addLabel)),
          ),
          const SizedBox(height: AppSpace.s3),
          Text('HISTORY',
              style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: AppColors.adaptive(context, AppColors.muted))),
          const SizedBox(height: AppSpace.s2),
          if (loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpace.s2),
              child: SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else if (rows.isEmpty)
            Text('Nothing added yet.',
                style: TextStyle(fontSize: 12.5, color: AppColors.adaptive(context, AppColors.muted)))
          else
            for (final r in rows)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpace.s2),
                child: Row(children: [
                  Expanded(
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(r.title, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      Text(r.subtitle, style: TextStyle(fontSize: 11.5, color: AppColors.adaptive(context, AppColors.muted))),
                    ]),
                  ),
                ]),
              ),
        ]),
      ),
    );
  }
}

class _RuleFormResult {
  _RuleFormResult(this.number, this.effectiveFrom, this.notes);
  final num number;
  final String effectiveFrom;
  final String notes;
}

class _RuleFormDialog extends StatefulWidget {
  const _RuleFormDialog({required this.title, required this.numberLabel});
  final String title;
  final String numberLabel;
  @override
  State<_RuleFormDialog> createState() => _RuleFormDialogState();
}

class _RuleFormDialogState extends State<_RuleFormDialog> {
  final _number = TextEditingController();
  final _notes = TextEditingController();
  String? _effectiveFrom;
  String? _error;

  @override
  void dispose() {
    _number.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        TextField(
          controller: _number,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(labelText: widget.numberLabel),
        ),
        const SizedBox(height: AppSpace.s3),
        ListTile(
          contentPadding: EdgeInsets.zero,
          leading: const Icon(Icons.event_outlined),
          title: Text(_effectiveFrom ?? 'Effective from (default: today)', style: const TextStyle(fontSize: 13)),
          trailing: TextButton(
            onPressed: () async {
              final d = await showDatePicker(
                context: context,
                initialDate: DateTime.now(),
                firstDate: DateTime(2020),
                lastDate: DateTime(2035),
              );
              if (d != null) {
                setState(() => _effectiveFrom = '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
              }
            },
            child: const Text('Pick'),
          ),
        ),
        const SizedBox(height: AppSpace.s2),
        TextField(
          controller: _notes,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'Notes (optional)'),
        ),
        if (_error != null)
          Padding(
            padding: const EdgeInsets.only(top: AppSpace.s3),
            child: Text(_error!, style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg), fontSize: 13)),
          ),
      ]),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            final v = num.tryParse(_number.text.trim());
            if (v == null || v < 0 || v > 100) {
              setState(() => _error = 'Enter a percent between 0 and 100.');
              return;
            }
            Navigator.pop(context, _RuleFormResult(v, _effectiveFrom ?? '', _notes.text.trim()));
          },
          child: const Text('Save'),
        ),
      ],
    );
  }
}
