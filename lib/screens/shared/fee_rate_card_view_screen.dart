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

/// Staff read-only view of the founder-maintained Fee Rate Card — share it
/// with an enquirer by WhatsApp or download it as a PDF. Only the founder can
/// change the rates (see FeeRateCardScreen in screens/founder).
class FeeRateCardViewScreen extends StatefulWidget {
  const FeeRateCardViewScreen({super.key});
  @override
  State<FeeRateCardViewScreen> createState() => _FeeRateCardViewScreenState();
}

class _FeeRateCardViewScreenState extends State<FeeRateCardViewScreen> with SyncAware {
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
      final rows = await auth.service!.listFeeRateCard();
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
      body: RefreshScaffold(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(AppSpace.s4),
          children: [
            Text(
              'The academy\'s published price list — share it with an enquirer by WhatsApp or download it as a PDF. '
              'Only the founder can change these rates.',
              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
            ),
            const SizedBox(height: AppSpace.s4),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpace.s3),
                child: ErrorView(_error!, onRetry: _load, compact: true),
              ),
            if (_rows.isEmpty)
              const EmptyState('No rate card published yet. Ask the founder to add prices to the rate card.')
            else
              for (final instrument in _byInstrument.keys.toList()..sort()) ...[
                SectionTitle(instrument),
                for (final row in _byInstrument[instrument]!)
                  Card(
                    margin: const EdgeInsets.only(bottom: AppSpace.s2),
                    child: ListTile(
                      title: Text(row.name, style: const TextStyle(fontWeight: FontWeight.w700)),
                      subtitle: Text(
                        '${inr(row.feeAmount)} / ${row.billingPeriod}${row.notes.isNotEmpty ? ' · ${row.notes}' : ''}',
                        style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
                      ),
                    ),
                  ),
                const SizedBox(height: AppSpace.s2),
              ],
          ],
        ),
      ),
    );
  }
}
