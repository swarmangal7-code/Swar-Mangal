import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../state/auth_provider.dart';

/// A link staff can send a prospective family so they fill in their own
/// basic details (name, guardian, phone, instrument, terms acceptance)
/// rather than staff typing it in by hand. Mirrors terms_screen.dart's
/// generate/copy pattern exactly.
class EnrollLinkScreen extends StatefulWidget {
  const EnrollLinkScreen({super.key, required this.branch});
  final String branch;
  @override
  State<EnrollLinkScreen> createState() => _EnrollLinkScreenState();
}

class _EnrollLinkScreenState extends State<EnrollLinkScreen> {
  bool _busy = true;
  String? _url;
  String? _error;

  @override
  void initState() {
    super.initState();
    _generate();
  }

  Future<void> _generate() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await auth.service!.generateEnrollLink(branch: widget.branch);
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _busy = false;
        final url = (m['url'] ?? '').toString();
        if (url.isNotEmpty) {
          _url = url;
        } else {
          _error = (m['note'] ?? 'Could not build a shareable link.').toString();
        }
      });
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
    return Scaffold(
      appBar: AppBar(title: const Text('Enroll link')),
      body: Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text(
            'Valid for 7 days, one use. The family fills in their own basic details; it lands in New Enrollments for you to review.',
            style: TextStyle(fontSize: 13, color: AppColors.muted),
          ),
          const SizedBox(height: AppSpace.s4),
          if (_busy)
            const Center(child: Padding(padding: EdgeInsets.only(top: 24), child: CircularProgressIndicator()))
          else if (_url != null)
            Row(children: [
              Expanded(child: SelectableText(_url!, style: const TextStyle(fontSize: 14))),
              IconButton(
                icon: const Icon(Icons.copy_outlined),
                tooltip: 'Copy link',
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: _url!));
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Link copied.')));
                },
              ),
            ])
          else if (_error != null)
            Text(_error!, style: const TextStyle(fontSize: 13, color: AppColors.blockFg)),
          const SizedBox(height: AppSpace.s3),
          OutlinedButton.icon(
            onPressed: _busy ? null : _generate,
            icon: const Icon(Icons.refresh),
            label: const Text('Generate a fresh link'),
          ),
        ]),
      ),
    );
  }
}
