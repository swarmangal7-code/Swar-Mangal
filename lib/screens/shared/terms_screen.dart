import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';

/// Brief §P10: a terms link mints itself the moment this screen is opened
/// for an operational student with nothing already accepted or outstanding
/// (server-side, api_termsStatusForStudent) — no button needed to create
/// one. Staff can still force a fresh link, or — if the parent cannot use
/// the link — request a manual acceptance, which is an approval item for
/// the founder, never a tick box.
class TermsScreen extends StatefulWidget {
  const TermsScreen({super.key, required this.student});
  final Student student;
  @override
  State<TermsScreen> createState() => _TermsScreenState();
}

class _TermsScreenState extends State<TermsScreen> {
  bool _busyToken = false;
  bool _busyManual = false;
  String? _tokenResult;
  String? _manualResult;
  List<Map<String, dynamic>> _tokens = [];
  List<Map<String, dynamic>> _manualRequests = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final r = await auth.service!.raw('api_termsStatusForStudent', {'studentId': widget.student.studentId});
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _tokens = ((m['tokens'] as List?) ?? const []).whereType<Map<String, dynamic>>().toList();
        _manualRequests = ((m['manualRequests'] as List?) ?? const []).whereType<Map<String, dynamic>>().toList();
      });
    } catch (_) {
      // Non-critical — the actions below still work without history loaded.
    }
  }

  Future<void> _generateToken() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busyToken = true;
      _tokenResult = null;
    });
    try {
      final r = await auth.service!.raw('api_staff_generateTermsToken', {'studentId': widget.student.studentId});
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _busyToken = false;
        _tokenResult = m['ok'] == true
            ? ((m['url'] ?? '').toString().isNotEmpty ? (m['url'] as String) : '${m['note']} (${m['path']})')
            : (m['error'] ?? 'Could not generate a link.').toString();
      });
      if (m['ok'] == true) _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busyToken = false;
        _tokenResult = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busyToken = false;
        _tokenResult = e.message;
      });
    }
  }

  Future<void> _requestManual() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request manual acceptance'),
        content: TextField(
          controller: reasonCtrl,
          maxLines: 2,
          decoration: const InputDecoration(labelText: 'How did the parent accept? (required)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => reasonCtrl.text.trim().isEmpty ? null : Navigator.pop(ctx, reasonCtrl.text.trim()),
            child: const Text('Send for approval'),
          ),
        ],
      ),
    );
    if (reason == null || !mounted) return;
    setState(() {
      _busyManual = true;
      _manualResult = null;
    });
    try {
      final r = await auth.service!.raw('api_staff_requestManualTermsAcceptance', {
        'studentId': widget.student.studentId,
        'reason': reason,
        'clientIntentKey': 'MTERMS-${DateTime.now().microsecondsSinceEpoch}',
      });
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _busyManual = false;
        _manualResult = (m['note'] ?? (m['ok'] == true ? 'Sent for approval.' : 'Could not send.')).toString();
      });
      if (m['ok'] == true) _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busyManual = false;
        _manualResult = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busyManual = false;
        _manualResult = e.message;
      });
    }
  }

  Map<String, dynamic>? get _activeToken {
    for (final t in _tokens) {
      if (t['status'] == 'OPEN' && (t['url'] ?? '').toString().isNotEmpty) return t;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final active = _activeToken;
    return Scaffold(
      appBar: AppBar(title: const Text('Admission terms')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Text(widget.student.studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16)),
          Text(widget.student.studentId, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: AppSpace.s4),
          if (active != null) ...[
            const Text('Link ready to share', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
            const SizedBox(height: AppSpace.s2),
            Row(children: [
              Expanded(child: SelectableText(active['url'].toString(), style: const TextStyle(fontSize: 13))),
              IconButton(
                icon: const Icon(Icons.copy_outlined, size: 18),
                tooltip: 'Copy link',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: active['url'].toString()));
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied.')));
                },
              ),
            ]),
            const SizedBox(height: AppSpace.s3),
          ],
          OutlinedButton.icon(
            onPressed: _busyToken ? null : _generateToken,
            icon: const Icon(Icons.link_outlined),
            label: Text(_busyToken ? 'Generating…' : (active != null ? 'Send a fresh link' : 'Generate parent link')),
          ),
          if (_tokenResult != null) ...[
            const SizedBox(height: AppSpace.s2),
            SelectableText(_tokenResult!, style: const TextStyle(fontSize: 13)),
          ],
          const SizedBox(height: AppSpace.s4),
          OutlinedButton.icon(
            onPressed: _busyManual ? null : _requestManual,
            icon: const Icon(Icons.edit_note_outlined, size: 18),
            label: const Text('Request manual acceptance'),
          ),
          if (_manualResult != null) ...[
            const SizedBox(height: AppSpace.s2),
            Text(_manualResult!, style: const TextStyle(fontSize: 13)),
          ],
          if (_tokens.isNotEmpty || _manualRequests.isNotEmpty) ...[
            const SizedBox(height: AppSpace.s4),
            const Text('HISTORY', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.muted)),
            const SizedBox(height: AppSpace.s2),
            for (final t in _tokens)
              ListTile(
                dense: true,
                leading: const Icon(Icons.link_outlined, size: 18),
                title: Text('Token · ${t['status']}'),
                subtitle: Text('Issued ${t['issuedAt']}'),
              ),
            for (final m in _manualRequests)
              ListTile(
                dense: true,
                leading: const Icon(Icons.edit_note_outlined, size: 18),
                title: Text('Manual · ${m['status']}'),
                subtitle: Text((m['reason'] ?? '').toString()),
              ),
          ],
        ],
      ),
    );
  }
}
