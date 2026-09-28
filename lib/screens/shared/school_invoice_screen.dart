import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/sync_manager.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';
import 'invoice_config_screen.dart';
import 'invoice_detail_screen.dart';

/// School-level invoice history + entry point. No student dimension.
class SchoolInvoiceScreen extends StatefulWidget {
  const SchoolInvoiceScreen({super.key, required this.staff});
  final bool staff;
  @override
  State<SchoolInvoiceScreen> createState() => _SchoolInvoiceScreenState();
}

class _SchoolInvoiceScreenState extends State<SchoolInvoiceScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'invoices'};

  @override
  Future<void> reloadFromSync() => _load();

  List<InvoiceSummary> _rows = [];
  String? _error;
  bool _busy = true;

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
      final rows = await auth.service!.listSchoolInvoices(branch: auth.branch ?? 'ALL');
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('School invoices')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        onPressed: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => InvoiceConfigScreen(staff: widget.staff)))
            .then((_) => _load()),
        icon: const Icon(Icons.add),
        label: const Text('New invoice'),
      ),
      body: _busy
          ? const SkeletonList(rows: 6)
          : _error != null && _rows.isEmpty
              ? ErrorView(_error!, onRetry: _load)
              : RefreshScaffold(
                  onRefresh: _load,
                  child: _rows.isEmpty
                      ? const EmptyState('No school invoices yet.', icon: Icons.receipt_long_outlined)
                      : ListView.separated(
                          padding: const EdgeInsets.only(bottom: AppSpace.s7),
                          itemCount: _rows.length,
                          separatorBuilder: (_, _) => const Divider(height: 1),
                          itemBuilder: (c, i) => _row(_rows[i]),
                        ),
                ),
    );
  }

  Widget _row(InvoiceSummary s) {
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => InvoiceDetailScreen(invoiceId: s.invoiceId, staff: widget.staff),
      )),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: AppSpace.s3),
        child: Row(children: [
          Icon(Icons.description_outlined, color: AppColors.primary),
          const SizedBox(width: AppSpace.s3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.invoiceNo, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
              Text('${s.className.isNotEmpty ? s.className : '—'} · ${s.tenure}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              if (s.schoolName.isNotEmpty || s.schoolCode.isNotEmpty)
                Text(s.schoolName.isNotEmpty ? s.schoolName : s.schoolCode,
                    style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              Text(s.invoiceDate, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            ]),
          ),
          AmountText(s.amount),
          const SizedBox(width: AppSpace.s2),
          const Icon(Icons.chevron_right, color: AppColors.muted),
        ]),
      ),
    );
  }
}