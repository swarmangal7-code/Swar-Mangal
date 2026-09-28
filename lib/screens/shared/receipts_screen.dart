import 'dart:async';

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/sync_manager.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';
import 'receipt_detail_screen.dart';

/// Receipt search. Founder: full master search. Staff: branch-isolated.
class ReceiptsScreen extends StatefulWidget {
  const ReceiptsScreen({super.key, required this.staff});
  final bool staff;
  @override
  State<ReceiptsScreen> createState() => _ReceiptsScreenState();
}

class _ReceiptsScreenState extends State<ReceiptsScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'receipts', 'payments'};

  @override
  Future<void> reloadFromSync() => _search(_q.text, offset: _offset);

  final _q = TextEditingController();
  List<ReceiptRow> _rows = [];
  bool _busy = false;
  String? _error;
  Timer? _debounce;
  int _offset = 0;
  int _total = 0;

  static const _pageSize = 25;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _q.dispose();
    super.dispose();
  }

  /// Typing fires a request per keystroke otherwise; the web debounces at
  /// 300 ms and so does this.
  void _onQueryChanged(String _) {
    _debounce?.cancel();
    if (_q.text.trim().isEmpty) {
      setState(() {
        _rows = [];
        _total = 0;
        _offset = 0;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 300), () => _search(_q.text, offset: 0));
  }

  Future<void> _search(String q, {int offset = 0}) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await auth.service!.searchReceiptsPage(
        q: q,
        studentName: q,
        receiptNo: q,
        classCode: widget.staff ? _classFor(auth.branch ?? '') : 'ALL',
        limit: _pageSize,
        offset: offset,
      );
      if (!mounted) return;
      setState(() {
        _rows = res.rows;
        _total = res.total;
        _offset = offset;
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

  void _page(int delta) {
    final next = _offset + delta * _pageSize;
    if (next < 0) return;
    _search(_q.text, offset: next);
  }

  String _classFor(String branch) {
    if (branch == 'KANDIVALI') return 'KMC';
    if (branch == 'GOREGAON') return 'GMC';
    return 'ALL';
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: SearchField(
          controller: _q,
          hint: 'Receipt no, student name or UTR',
          onChanged: _onQueryChanged,
          trailingIcon: Icons.arrow_forward,
        ),
      ),
      Expanded(
        child: _busy
            ? const SkeletonList(rows: 6)
            : _error != null && _rows.isEmpty
                ? ErrorView(_error!, onRetry: () => _search(_q.text, offset: _offset))
                : _rows.isEmpty
                    ? EmptyState(
                        _q.text.trim().isEmpty
                            ? 'Search receipts by number, student or UTR.'
                            : 'No receipts matched.',
                        icon: Icons.receipt_long_outlined)
                    : Column(children: [
                        Expanded(
                          child: ListView.separated(
                            padding: const EdgeInsets.only(bottom: AppSpace.s3),
                            itemCount: _rows.length,
                            separatorBuilder: (_, _) => const Divider(height: 1),
                            itemBuilder: (c, i) => _row(_rows[i]),
                          ),
                        ),
                        if (_total > _rows.length || _offset > 0)
                          Padding(
                            padding: const EdgeInsets.fromLTRB(AppSpace.s4, 0, AppSpace.s4, AppSpace.s3),
                            child: Row(children: [
                              TextButton.icon(
                                onPressed: _offset == 0 ? null : () => _page(-1),
                                icon: const Icon(Icons.chevron_left, size: 18),
                                label: const Text('Prev'),
                              ),
                              Expanded(
                                child: Text(
                                  'Showing ${_offset + 1}–${_offset + _rows.length} of $_total',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                                ),
                              ),
                              TextButton.icon(
                                onPressed: _offset + _rows.length >= _total ? null : () => _page(1),
                                icon: const Icon(Icons.chevron_right, size: 18),
                                label: const Text('Next'),
                              ),
                            ]),
                          ),
                      ]),
      ),
    ]);
  }

  Widget _row(ReceiptRow r) {
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => ReceiptDetailScreen(receipt: r),
      )),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: AppSpace.s3),
        child: Row(children: [
          Icon(Icons.receipt_long_outlined,
              color: r.excluded ? AppColors.muted : AppColors.primary),
          const SizedBox(width: AppSpace.s3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(r.receiptNo, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
              Text('${r.student} · ${r.date}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              Text(r.mode.isNotEmpty ? r.mode : '—',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted)),
            ]),
          ),
          Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
            AmountText(r.amount),
            const SizedBox(height: 2),
            StatusBadge(r.status),
          ]),
        ]),
      ),
    );
  }
}