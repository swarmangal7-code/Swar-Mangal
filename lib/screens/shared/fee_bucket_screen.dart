import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';
import 'message_compose_screen.dart';

/// The students behind one fee card (overdue / due today / due soon). The
/// buckets are the server's; tapping a student opens a reminder to send.
class FeeBucketScreen extends StatefulWidget {
  const FeeBucketScreen({super.key, required this.bucket, required this.title, required this.staff});

  /// OVERDUE, DUE_TODAY or DUE_SOON.
  final String bucket;
  final String title;
  final bool staff;

  @override
  State<FeeBucketScreen> createState() => _FeeBucketScreenState();
}

class _FeeBucketScreenState extends State<FeeBucketScreen> {
  List<DueReminderItem> _rows = const [];
  bool _busy = true;
  String? _error;
  bool _sendingReminders = false;

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
      final d = await auth.service!.dueReminders(auth.branch ?? 'ALL');
      if (!mounted) return;
      setState(() {
        _rows = switch (widget.bucket) {
          'OVERDUE' => d.overdue,
          'DUE_TODAY' => d.dueToday,
          _ => d.dueSoon,
        };
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

  /// Founder-only stopgap for the missing cron (api_founder_sendOverdueLateFeeReminders
  /// is FOUNDER-only in RPC_POLICY): fires WhatsApp reminders to every
  /// student whose late fee started accruing today. Only shown on the
  /// OVERDUE bucket, and only to the founder app (staff has no access to
  /// this RPC).
  Future<void> _sendReminders() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() => _sendingReminders = true);
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await auth.service!.founderSendOverdueLateFeeReminders();
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      final sent = (m['sent'] as num?)?.toInt() ?? 0;
      final failed = (m['failed'] as num?)?.toInt() ?? 0;
      final demo = auth.isDemo || m['demo'] == true;
      messenger.showSnackBar(SnackBar(
        content: Text('Sent $sent reminder${sent == 1 ? '' : 's'}'
            '${failed > 0 ? ' ($failed failed)' : ''}.${demo ? ' (DEMO — not sent)' : ''}'),
      ));
    } on ApiException catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _sendingReminders = false);
    }
  }

  String get _messageType => switch (widget.bucket) {
        'OVERDUE' => 'OVERDUE_ACCRUING',
        'DUE_TODAY' => 'DUE_TODAY',
        _ => 'DUE_SOON',
      };

  @override
  Widget build(BuildContext context) {
    Widget body;
    if (_busy) {
      body = const SkeletonList(rows: 6);
    } else if (_error != null) {
      body = ErrorView(_error!, onRetry: _load);
    } else if (_rows.isEmpty) {
      body = const Center(child: Text('Nobody in this list.', style: TextStyle(color: AppColors.muted)));
    } else {
      body = RefreshIndicator(
        onRefresh: _load,
        child: ListView.separated(
          padding: const EdgeInsets.all(AppSpace.s4),
          itemCount: _rows.length,
          separatorBuilder: (_, _) => const SizedBox(height: AppSpace.s2),
          itemBuilder: (_, i) {
            final it = _rows[i];
            return Card(
              margin: EdgeInsets.zero,
              child: ListTile(
                title: Text(it.studentName, style: const TextStyle(fontWeight: FontWeight.w700)),
                subtitle: Text(
                  [it.instrument, it.classCode, if (it.nextDueDate.isNotEmpty) 'due ${it.nextDueDate}']
                      .where((x) => x.isNotEmpty)
                      .join(' · '),
                  style: const TextStyle(fontSize: 12, color: AppColors.muted),
                ),
                trailing: const Icon(Icons.chat_outlined),
                onTap: () => Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => MessageComposeScreen(
                    staff: widget.staff,
                    studentId: it.studentId,
                    studentName: it.studentName,
                    initialType: _messageType,
                  ),
                )),
              ),
            );
          },
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.title}${_busy || _error != null ? '' : ' (${_rows.length})'}'),
        actions: [
          if (!widget.staff && widget.bucket == 'OVERDUE')
            IconButton(
              tooltip: 'Send overdue late-fee reminders',
              icon: _sendingReminders
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.campaign_outlined),
              onPressed: _sendingReminders ? null : _sendReminders,
            ),
        ],
      ),
      body: body,
    );
  }
}
