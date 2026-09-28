import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Brief §P6.6/§6.8: staff record a closure as PROPOSED; only the founder
/// authorises or revokes it (via the approvals screen for PROPOSED items,
/// and the "Revoke" button here for an already-AUTHORISED one).
class ClosuresScreen extends StatefulWidget {
  const ClosuresScreen({super.key, required this.staff});
  final bool staff;
  @override
  State<ClosuresScreen> createState() => _ClosuresScreenState();
}

class _ClosuresScreenState extends State<ClosuresScreen> {
  List<Map<String, dynamic>> _rows = [];
  bool _busy = true;
  String? _error;
  final Set<String> _acting = {};

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
      final r = await auth.service!.raw('api_closureCalendarList', const {});
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _rows = ((m['rows'] as List?) ?? const []).whereType<Map<String, dynamic>>().toList();
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

  Future<void> _revoke(Map<String, dynamic> row) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final id = (row['closureId'] ?? '').toString();
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Revoke closure'),
        content: TextField(controller: reasonCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'Reason (required)')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => reasonCtrl.text.trim().isEmpty ? null : Navigator.pop(ctx, reasonCtrl.text.trim()),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (reason == null) return;
    setState(() => _acting.add(id));
    try {
      await auth.service!.raw('api_founder_revokeClosure', {'closureId': id, 'reason': reason});
      if (!mounted) return;
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _acting.remove(id));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Closures')),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        onPressed: () async {
          final ok = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => const ProposeClosureScreen()));
          if (ok == true) _load();
        },
        icon: const Icon(Icons.event_busy_outlined),
        label: const Text('Propose closure'),
      ),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorView(_error!, onRetry: _load)
              : RefreshIndicator(
                  onRefresh: _load,
                  child: _rows.isEmpty
                      ? ListView(children: const [SizedBox(height: 120), EmptyState('No closures recorded.')])
                      : ListView(
                          padding: const EdgeInsets.all(AppSpace.s4),
                          children: [
                            for (final r in _rows)
                              Card(
                                margin: const EdgeInsets.only(bottom: AppSpace.s3),
                                child: Padding(
                                  padding: const EdgeInsets.all(AppSpace.s3),
                                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                    Row(children: [
                                      Expanded(
                                        child: Text(
                                          (r['scope'] == 'ACADEMY' ? 'Whole academy' : (r['branch'] ?? '').toString()),
                                          style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14),
                                        ),
                                      ),
                                      StatusBadge((r['state'] ?? '').toString()),
                                    ]),
                                    Text('${r['fromDate']} – ${r['toDate']}', style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                                    const SizedBox(height: 4),
                                    Text((r['reason'] ?? '').toString(), style: const TextStyle(fontSize: 13)),
                                    if (r['backdated'] == true)
                                      const Padding(
                                        padding: EdgeInsets.only(top: 4),
                                        child: Text('Backdated', style: TextStyle(fontSize: 11, color: AppColors.warnFg)),
                                      ),
                                    if (widget.staff && (r['state'] == 'AUTHORISED'))
                                      Align(
                                        alignment: Alignment.centerRight,
                                        child: TextButton(
                                          onPressed: _acting.contains(r['closureId']) ? null : () => _revoke(r),
                                          child: const Text('Revoke'),
                                        ),
                                      ),
                                  ]),
                                ),
                              ),
                          ],
                        ),
                ),
    );
  }
}

/// Staff records a closure as PROPOSED — it has no effect until the founder
/// authorises it via the approvals screen.
class ProposeClosureScreen extends StatefulWidget {
  const ProposeClosureScreen({super.key});
  @override
  State<ProposeClosureScreen> createState() => _ProposeClosureScreenState();
}

class _ProposeClosureScreenState extends State<ProposeClosureScreen> {
  String _scope = 'BRANCH';
  final _from = TextEditingController();
  final _to = TextEditingController();
  final _reason = TextEditingController();
  late final String _intentKey;
  bool _busy = false;
  String? _result;
  bool? _ok;

  @override
  void initState() {
    super.initState();
    _intentKey = 'CLOSURE-${DateTime.now().microsecondsSinceEpoch}';
    final today = DateTime.now();
    final iso = '${today.year}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    _from.text = iso;
    _to.text = iso;
  }

  @override
  void dispose() {
    _from.dispose();
    _to.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    if (_reason.text.trim().isEmpty) {
      setState(() => _result = 'Say why the academy/branch is closed.');
      return;
    }
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final r = await auth.service!.raw('api_staff_proposeClosure', {
        'scope': _scope,
        if (_scope == 'BRANCH') 'branch': auth.branch ?? '',
        'fromDate': _from.text.trim(),
        'toDate': _to.text.trim(),
        'reason': _reason.text.trim(),
        'clientIntentKey': _intentKey,
      });
      final m = r as Map<String, dynamic>;
      final demo = auth.isDemo || m['demo'] == true;
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = m['ok'] == true;
        _result = m['ok'] == true ? (m['note'] ?? 'Sent for approval.').toString() : (m['error'] ?? 'Could not save.').toString();
        if (demo && _ok == true) _result = '$_result (DEMO — not persisted)';
      });
      if (_ok == true && mounted) Navigator.of(context).pop(true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = false;
        _result = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = false;
        _result = e.message;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Propose closure')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Wrap(spacing: AppSpace.s2, children: [
            ChoiceChip(label: const Text('This branch'), selected: _scope == 'BRANCH', onSelected: (_) => setState(() => _scope = 'BRANCH')),
            ChoiceChip(label: const Text('Whole academy'), selected: _scope == 'ACADEMY', onSelected: (_) => setState(() => _scope = 'ACADEMY')),
          ]),
          const SizedBox(height: AppSpace.s3),
          TextField(controller: _from, decoration: const InputDecoration(labelText: 'From date (YYYY-MM-DD)')),
          const SizedBox(height: AppSpace.s3),
          TextField(controller: _to, decoration: const InputDecoration(labelText: 'To date (YYYY-MM-DD)')),
          const SizedBox(height: AppSpace.s3),
          TextField(controller: _reason, maxLines: 3, decoration: const InputDecoration(labelText: 'Reason (required)')),
          const SizedBox(height: AppSpace.s4),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: _busy ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Send for approval'),
          ),
          if (_result != null) ...[
            const SizedBox(height: AppSpace.s3),
            Text(_result!, style: TextStyle(color: _ok == true ? AppColors.okFg : AppColors.blockFg)),
          ],
        ],
      ),
    );
  }
}
