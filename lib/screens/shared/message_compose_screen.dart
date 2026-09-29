import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Message compose. The server writes the text from the student's real record;
/// staff read it, may edit it, then send it with ONE tap to the student's
/// registered WhatsApp number — or copy it when WhatsApp sending is off.
/// Nothing is ever sent without that tap.
class MessageComposeScreen extends StatefulWidget {
  const MessageComposeScreen({
    super.key,
    required this.staff,
    required this.studentId,
    required this.studentName,
    this.parentName = '',
    this.instrument = '',
    this.branch = '',
    this.initialType = 'FEE_REMINDER',
  });
  final bool staff;
  final String studentId;
  final String studentName;
  final String parentName;
  final String instrument;
  final String branch;
  final String initialType;
  @override
  State<MessageComposeScreen> createState() => _MessageComposeScreenState();
}

class _MessageComposeScreenState extends State<MessageComposeScreen> {
  late String _type = _types.contains(widget.initialType) ? widget.initialType : 'FEE_REMINDER';
  CommMessage? _msg;
  final _body = TextEditingController();
  bool _busy = false;
  bool _sending = false;
  String? _error;
  String? _sendError;
  WaMessage? _sent;
  bool _copied = false;
  List<WaMessage> _history = const [];
  // One key per composed message, reused on retry so a flaky network can
  // never deliver it twice. A new message (new text) gets a new key.
  String _intentKey = '';
  String _keyForText = '';

  static const _types = [
    'FEE_REMINDER',
    'DUE_SOON',
    'DUE_TODAY',
    'OVERDUE_ACCRUING',
    'RENEWAL',
    'TERMS',
    'ABSENT_TODAY',
    'NOTIFY_TEACHER_ABSENCE',
  ];

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _body.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final rows = await auth.service!.messageHistory(widget.studentId);
      if (mounted) setState(() => _history = rows);
    } on ApiException {
      // history is supplementary; the compose flow works without it
    } on ApiUnreachable {
      // same
    }
  }

  void _showHistoryDetail(WaMessage h) {
    Widget field(String label, String value) => Padding(
          padding: const EdgeInsets.only(bottom: AppSpace.s3),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label.toUpperCase(),
                style: TextStyle(fontSize: 10, letterSpacing: .4, color: AppColors.adaptive(context, AppColors.muted))),
            const SizedBox(height: 2),
            Text(value.isEmpty ? '—' : value, style: const TextStyle(fontSize: 13)),
          ]),
        );
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Row(children: [
          Expanded(child: Text(h.fileName.isNotEmpty ? h.fileName : h.kind.replaceAll('_', ' '))),
          StatusBadge(h.status),
        ]),
        content: SingleChildScrollView(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
            field('To', h.to),
            field('Message', h.body),
            if (h.fileName.isNotEmpty) field('Attachment', h.fileName),
            field('Created', h.createdAt),
            if (h.sentAt.isNotEmpty) field('Sent', h.sentAt),
            if (h.deliveredAt.isNotEmpty) field('Delivered', h.deliveredAt),
            if (h.readAt.isNotEmpty) field('Read', h.readAt),
            if (h.status == 'FAILED' && h.error.isNotEmpty) field('Error', h.error),
          ]),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  Future<void> _generate() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
      _sendError = null;
      _msg = null;
      _sent = null;
      _copied = false;
    });
    try {
      final m = await auth.service!.staffCommGenerate({
        'type': _type,
        'studentId': widget.studentId,
        'branch': widget.branch,
      });
      if (!mounted) return;
      setState(() {
        _msg = m;
        _body.text = m.body;
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

  Future<void> _copy() async {
    await Clipboard.setData(ClipboardData(text: _body.text));
    if (!mounted) return;
    setState(() => _copied = true);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(const SnackBar(content: Text('Message copied to clipboard.')));
  }

  Future<void> _send() async {
    final auth = context.read<AuthProvider>();
    final msg = _msg;
    if (auth.service == null || msg == null) return;
    final text = _body.text.trim();
    if (text.isEmpty) return;

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Send on WhatsApp?'),
        content: Text(
          'To ${msg.recipientName}'
          '${msg.recipientPhone.isNotEmpty ? ' (${msg.recipientPhone})' : ''}'
          ', the number registered for ${widget.studentName}. A sent message cannot be recalled.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Send')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    if (_keyForText != text) {
      _intentKey = 'WA-${DateTime.now().microsecondsSinceEpoch}';
      _keyForText = text;
    }
    setState(() {
      _sending = true;
      _sendError = null;
    });
    try {
      final sent = await auth.service!.sendWhatsApp(
        studentId: widget.studentId,
        kind: msg.kind,
        body: text,
        clientIntentKey: _intentKey,
      );
      if (!mounted) return;
      setState(() {
        _sent = sent;
        _sending = false;
      });
      _loadHistory();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sendError = e.message;
        _sending = false;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        // Unknown whether it went out: the same key makes a retry safe.
        _sendError = '${e.message} If you retry, it will not send twice.';
        _sending = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final msg = _msg;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Compose message'),
        actions: [
          if (msg != null)
            IconButton(
              tooltip: _copied ? 'Copied' : 'Copy text',
              icon: Icon(_copied ? Icons.check_circle_outline : Icons.copy),
              onPressed: _copy,
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('FOR: ${widget.studentName}', style: const TextStyle(fontWeight: FontWeight.w800)),
                const SizedBox(height: AppSpace.s3),
                Text('Message type',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.adaptive(context, AppColors.muted))),
                const SizedBox(height: AppSpace.s2),
                Wrap(
                  spacing: AppSpace.s2,
                  runSpacing: AppSpace.s2,
                  children: _types.map((t) {
                    return ChoiceChip(
                      label: Text(t.replaceAll('_', ' '), style: const TextStyle(fontSize: 12)),
                      selected: _type == t,
                      onSelected: (_) => setState(() {
                        _type = t;
                        _msg = null;
                        _sent = null;
                      }),
                    );
                  }).toList(),
                ),
              ]),
            ),
          ),
          const SizedBox(height: AppSpace.s3),
          LoadingButton(label: 'Generate message', icon: Icons.auto_fix_high, busy: _busy, onPressed: _generate),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s3),
              child: ErrorView(_error!, compact: true),
            ),
          if (msg != null) ...[
            const SizedBox(height: AppSpace.s4),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(
                    'TO: ${msg.recipientName.isNotEmpty ? msg.recipientName : '(unknown)'}'
                    '${msg.recipientPhone.isNotEmpty ? ' · ${msg.recipientPhone}' : ''}',
                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  const SizedBox(height: AppSpace.s2),
                  Text(msg.subject,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.primary))),
                  const SizedBox(height: AppSpace.s2),
                  TextField(
                    controller: _body,
                    maxLines: null,
                    minLines: 5,
                    enabled: _sent == null,
                    decoration: const InputDecoration(helperText: 'You can edit the text before sending.'),
                    style: const TextStyle(fontSize: 14, height: 1.45),
                  ),
                ]),
              ),
            ),
            if (msg.warnings.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s2),
                child: Card(
                  color: AppColors.adaptive(context, AppColors.warnBg),
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpace.s3),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      for (final w in msg.warnings)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 2),
                          child: Text('• $w', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg))),
                        ),
                    ]),
                  ),
                ),
              ),
            const SizedBox(height: AppSpace.s4),
            if (msg.canWhatsApp)
              LoadingButton(
                label: _sent == null ? 'Send on WhatsApp' : 'Sent ✓',
                icon: Icons.send_outlined,
                busy: _sending,
                onPressed: _sent == null ? _send : null,
              )
            else
              Text(
                'WhatsApp sending is off (or this student has no valid registered number). Copy the message and send it by hand.',
                style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
              ),
            if (_sent != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s3),
                child: Card(
                  color: _sent!.status == 'DEMO' ? AppColors.adaptive(context, AppColors.warnBg) : AppColors.adaptive(context, AppColors.okBg),
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpace.s3),
                    child: Text(
                        _sent!.status == 'DEMO'
                            ? 'Demo only — nothing was sent to WhatsApp.'
                            : 'Sent to ${_sent!.to} · ${_sent!.status}.',
                        style: TextStyle(
                            fontSize: 12, color: _sent!.status == 'DEMO' ? AppColors.adaptive(context, AppColors.warnFg) : AppColors.adaptive(context, AppColors.okFg))),
                  ),
                ),
              ),
            if (_sendError != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s3),
                child: ErrorView(_sendError!, compact: true),
              ),
            const SizedBox(height: AppSpace.s2),
            OutlinedButton.icon(
              onPressed: _copy,
              icon: Icon(_copied ? Icons.check_circle_outline : Icons.copy),
              label: Text(_copied ? 'Copied ✓' : 'Copy message'),
            ),
          ],
          if (_history.isNotEmpty) ...[
            SectionTitle('Messages sent to this student (${_history.length})'),
            for (final h in _history)
              Card(
                margin: const EdgeInsets.only(bottom: AppSpace.s2),
                child: InkWell(
                  onTap: () => _showHistoryDetail(h),
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpace.s3),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(
                          child: Text(
                            h.fileName.isNotEmpty ? h.fileName : h.kind.replaceAll('_', ' '),
                            style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                        StatusBadge(h.status),
                        const SizedBox(width: 4),
                        Icon(Icons.chevron_right, size: 18, color: AppColors.adaptive(context, AppColors.muted)),
                      ]),
                      const SizedBox(height: 2),
                      Text('${h.when} · ${h.to}', style: TextStyle(fontSize: 11, color: AppColors.adaptive(context, AppColors.muted))),
                      if (h.status == 'FAILED' && h.error.isNotEmpty)
                        Text(h.error, style: TextStyle(fontSize: 11, color: AppColors.adaptive(context, AppColors.blockFg))),
                      if (h.body.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(h.body,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                        ),
                    ]),
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}
