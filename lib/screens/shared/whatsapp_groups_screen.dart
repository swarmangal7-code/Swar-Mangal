import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';

/// Founder request 2026-10-07: send a plain message or a poll to a WhatsApp
/// GROUP via the WA-AKG gateway — not a student, not a hand-typed number.
/// Shared between the founder and staff shells (same STAFF-level RPCs), same
/// spirit as InquiriesScreen / FeeRateCardScreen.
class WhatsAppGroupsScreen extends StatefulWidget {
  const WhatsAppGroupsScreen({super.key});
  @override
  State<WhatsAppGroupsScreen> createState() => _WhatsAppGroupsScreenState();
}

enum _Mode { message, poll }

class _WhatsAppGroupsScreenState extends State<WhatsAppGroupsScreen> {
  WhatsAppStatus? _status;
  bool _statusBusy = true;

  List<WhatsAppGroup> _groups = [];
  bool _groupsBusy = true;
  String? _groupsError;
  WhatsAppGroup? _selected;

  _Mode _mode = _Mode.message;

  // -- message mode
  final _body = TextEditingController();

  // -- poll mode
  final _question = TextEditingController();
  final List<TextEditingController> _options = [TextEditingController(), TextEditingController()];
  bool _allowMultiple = false;

  bool _sending = false;
  bool? _sentOk;
  String? _result;

  @override
  void initState() {
    super.initState();
    _loadStatus();
    _loadGroups();
  }

  @override
  void dispose() {
    _body.dispose();
    _question.dispose();
    for (final c in _options) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _loadStatus() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final status = await auth.service!.whatsappStatus();
      if (!mounted) return;
      setState(() {
        _status = status;
        _statusBusy = false;
      });
    } catch (_) {
      // Status is informational only — the send buttons surface the real
      // error (e.g. WHATSAPP_DISABLED) if sending is actually blocked.
      if (!mounted) return;
      setState(() => _statusBusy = false);
    }
  }

  Future<void> _loadGroups() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _groupsBusy = true;
      _groupsError = null;
    });
    try {
      final groups = await auth.service!.listWhatsAppGroups();
      if (!mounted) return;
      setState(() {
        _groups = groups;
        _groupsBusy = false;
        if (_selected != null && !groups.any((g) => g.jid == _selected!.jid)) _selected = null;
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _groupsError = e.message;
        _groupsBusy = false;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _groupsError = e.message;
        _groupsBusy = false;
      });
    }
  }

  void _addOption() {
    if (_options.length >= 12) return;
    setState(() => _options.add(TextEditingController()));
  }

  void _removeOption(int index) {
    if (_options.length <= 2) return;
    setState(() => _options.removeAt(index).dispose());
  }

  Future<void> _sendMessage() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null || _selected == null) return;
    final body = _body.text.trim();
    if (body.isEmpty) {
      setState(() {
        _sentOk = false;
        _result = 'The message is empty.';
      });
      return;
    }
    setState(() {
      _sending = true;
      _sentOk = null;
      _result = null;
    });
    final intentKey = 'WA-GROUP-MSG-${DateTime.now().microsecondsSinceEpoch}';
    try {
      final r = await auth.service!.sendWhatsAppGroupMessage(
        jid: _selected!.jid,
        subject: _selected!.subject,
        body: body,
        clientIntentKey: intentKey,
      );
      if (!mounted) return;
      setState(() {
        _sending = false;
        _sentOk = true;
        _result = r.note.isNotEmpty ? r.note : 'Sent.';
        _body.clear();
      });
      _showSnack(_result!);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _sentOk = false;
        _result = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _sentOk = false;
        _result = e.message;
      });
    }
  }

  Future<void> _sendPoll() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null || _selected == null) return;
    final question = _question.text.trim();
    final options = _options.map((c) => c.text.trim()).where((s) => s.isNotEmpty).toSet().toList();
    if (question.isEmpty) {
      setState(() {
        _sentOk = false;
        _result = 'Enter the poll question.';
      });
      return;
    }
    if (options.length < 2 || options.length > 12) {
      setState(() {
        _sentOk = false;
        _result = 'A poll needs between 2 and 12 distinct options.';
      });
      return;
    }
    setState(() {
      _sending = true;
      _sentOk = null;
      _result = null;
    });
    final intentKey = 'WA-GROUP-POLL-${DateTime.now().microsecondsSinceEpoch}';
    try {
      final r = await auth.service!.sendWhatsAppGroupPoll(
        jid: _selected!.jid,
        subject: _selected!.subject,
        question: question,
        options: options,
        selectableCount: _allowMultiple ? options.length : 1,
        clientIntentKey: intentKey,
      );
      if (!mounted) return;
      setState(() {
        _sending = false;
        _sentOk = true;
        _result = r.note.isNotEmpty ? r.note : 'Poll sent.';
        _question.clear();
        for (final c in _options) {
          c.clear();
        }
        _allowMultiple = false;
      });
      _showSnack(_result!);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _sentOk = false;
        _result = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _sending = false;
        _sentOk = false;
        _result = e.message;
      });
    }
  }

  void _showSnack(String text) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(text)));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('WhatsApp Groups')),
      body: RefreshIndicator(
        onRefresh: _loadGroups,
        child: ListView(
          padding: const EdgeInsets.all(AppSpace.s4),
          children: [
            _statusCard(context),
            const SizedBox(height: AppSpace.s4),
            Text('GROUP', style: AppType.eyebrow.copyWith(fontSize: 10)),
            const SizedBox(height: 6),
            _groupPicker(context),
            const SizedBox(height: AppSpace.s4),
            if (_selected != null) ...[
              SegmentedButton<_Mode>(
                segments: const [
                  ButtonSegment(value: _Mode.message, label: Text('Send message'), icon: Icon(Icons.chat_outlined)),
                  ButtonSegment(value: _Mode.poll, label: Text('Send poll'), icon: Icon(Icons.poll_outlined)),
                ],
                selected: {_mode},
                onSelectionChanged: (s) => setState(() {
                  _mode = s.first;
                  _sentOk = null;
                  _result = null;
                }),
              ),
              const SizedBox(height: AppSpace.s4),
              if (_mode == _Mode.message) _messageForm(context) else _pollForm(context),
              if (_result != null) ...[
                const SizedBox(height: AppSpace.s3),
                Text(_result!, style: TextStyle(color: _sentOk == true ? AppColors.okFg : AppColors.blockFg)),
              ],
            ],
          ],
        ),
      ),
    );
  }

  Widget _statusCard(BuildContext context) {
    final muted = AppColors.adaptive(context, AppColors.muted);
    if (_statusBusy) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 4),
        child: SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    final status = _status;
    if (status == null) {
      return Text('Could not read WhatsApp status.', style: TextStyle(fontSize: 12, color: muted));
    }
    final connected = status.connected;
    final color = connected ? AppColors.adaptive(context, AppColors.okFg) : AppColors.adaptive(context, AppColors.warnFg);
    final label = !status.enabled
        ? 'WhatsApp sending is switched off.'
        : connected
            ? 'WhatsApp connected.'
            : 'WhatsApp not connected (${status.status.isEmpty ? 'unknown' : status.status}).';
    return Row(children: [
      Icon(connected ? Icons.check_circle : Icons.warning_amber_rounded, size: 16, color: color),
      const SizedBox(width: 6),
      Expanded(child: Text(label, style: TextStyle(fontSize: 12, color: color, fontWeight: FontWeight.w600))),
    ]);
  }

  Widget _groupPicker(BuildContext context) {
    final muted = AppColors.adaptive(context, AppColors.muted);
    if (_groupsBusy) {
      return const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)),
      );
    }
    if (_groupsError != null) {
      return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(_groupsError!, style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg), fontSize: 13)),
        const SizedBox(height: 6),
        OutlinedButton(onPressed: _loadGroups, child: const Text('Retry')),
      ]);
    }
    if (_groups.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(AppSpace.s3),
        decoration: BoxDecoration(
          border: Border.all(color: muted.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(AppRadius.s),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('No groups found.', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
          const SizedBox(height: 4),
          Text(
            'The WhatsApp gateway account needs to already be a member of a group for it to show up here. '
            'Add it to a group from WhatsApp, then pull to refresh.',
            style: TextStyle(fontSize: 12, color: muted),
          ),
          const SizedBox(height: 8),
          OutlinedButton.icon(onPressed: _loadGroups, icon: const Icon(Icons.refresh), label: const Text('Refresh')),
        ]),
      );
    }
    return DropdownButtonFormField<WhatsAppGroup>(
      initialValue: _selected,
      decoration: const InputDecoration(hintText: 'Choose a group'),
      items: [
        for (final g in _groups) DropdownMenuItem(value: g, child: Text(g.subject, overflow: TextOverflow.ellipsis)),
      ],
      onChanged: (g) => setState(() {
        _selected = g;
        _sentOk = null;
        _result = null;
      }),
    );
  }

  Widget _messageForm(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TextField(
        controller: _body,
        maxLines: 5,
        enabled: !_sending,
        decoration: const InputDecoration(labelText: 'Message', hintText: 'Type the message to send to this group…'),
      ),
      const SizedBox(height: AppSpace.s3),
      FilledButton.icon(
        onPressed: _sending ? null : _sendMessage,
        icon: _sending
            ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.send_outlined),
        label: const Text('Send message'),
      ),
    ]);
  }

  Widget _pollForm(BuildContext context) {
    final muted = AppColors.adaptive(context, AppColors.muted);
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      TextField(
        controller: _question,
        enabled: !_sending,
        decoration: const InputDecoration(labelText: 'Poll question'),
      ),
      const SizedBox(height: AppSpace.s3),
      Text('OPTIONS (2-12)', style: AppType.eyebrow.copyWith(fontSize: 10)),
      const SizedBox(height: 6),
      for (int i = 0; i < _options.length; i++)
        Padding(
          padding: const EdgeInsets.only(bottom: 8),
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _options[i],
                enabled: !_sending,
                decoration: InputDecoration(labelText: 'Option ${i + 1}'),
              ),
            ),
            if (_options.length > 2)
              IconButton(
                onPressed: _sending ? null : () => _removeOption(i),
                icon: const Icon(Icons.remove_circle_outline),
                tooltip: 'Remove option',
              ),
          ]),
        ),
      if (_options.length < 12)
        OutlinedButton.icon(
          onPressed: _sending ? null : _addOption,
          icon: const Icon(Icons.add),
          label: const Text('Add option'),
        ),
      const SizedBox(height: AppSpace.s3),
      SwitchListTile.adaptive(
        contentPadding: EdgeInsets.zero,
        value: _allowMultiple,
        onChanged: _sending ? null : (v) => setState(() => _allowMultiple = v),
        title: const Text('Allow multiple answers'),
        subtitle: Text('Off = single-choice poll.', style: TextStyle(fontSize: 12, color: muted)),
      ),
      const SizedBox(height: AppSpace.s3),
      FilledButton.icon(
        onPressed: _sending ? null : _sendPoll,
        icon: _sending
            ? const SizedBox(height: 16, width: 16, child: CircularProgressIndicator(strokeWidth: 2))
            : const Icon(Icons.poll_outlined),
        label: const Text('Send poll'),
      ),
    ]);
  }
}
