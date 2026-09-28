import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';
import 'demo_students_screen.dart';

/// One contact's full record: details, the parent's decision (final status —
/// derived, never a second field), and the complete follow-up timeline.
class InquiryProfileScreen extends StatefulWidget {
  const InquiryProfileScreen({super.key, required this.inquiryId});
  final String inquiryId;
  @override
  State<InquiryProfileScreen> createState() => _InquiryProfileScreenState();
}

class _InquiryProfileScreenState extends State<InquiryProfileScreen> {
  InquiryDetail? _detail;
  String? _error;
  bool _busy = true;
  bool _acting = false;

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
      final detail = await auth.service!.staffInquiryDetail(widget.inquiryId);
      if (!mounted) return;
      setState(() {
        _detail = detail;
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

  Future<void> _transition(String action, Map<String, dynamic> extra) async {
    if (_acting) return;
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() => _acting = true);
    try {
      final r = await auth.service!.staffInquiryTransition({
        'branch': auth.branch ?? '',
        'inquiryId': widget.inquiryId,
        'action': action,
        ...extra,
      });
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _acting = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text(m['ok'] == true ? (m['note'] ?? 'Recorded.') : (m['error'] ?? 'Could not complete.'))));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _acting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _acting = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<String?> _ask(String title, String label) {
    final c = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(controller: c, maxLines: 2, decoration: InputDecoration(labelText: label)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, c.text.trim()), child: const Text('Confirm')),
        ],
      ),
    );
  }

  Future<String?> _pickDate(String label) async {
    final d = await showDatePicker(context: context, initialDate: DateTime.now(), firstDate: DateTime(2020), lastDate: DateTime(2035));
    if (d == null) return null;
    return '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  Future<void> _logContact() async {
    final date = await _pickDate('Next follow-up date');
    if (date == null || !mounted) return;
    final note = await _ask('What was discussed?', 'Short description (optional)');
    _transition('LOG_CONTACT', {'nextContactDate': date, if ((note ?? '').isNotEmpty) 'note': note});
  }

  Future<void> _scheduleTrial() async {
    final date = await _pickDate('Trial date');
    if (date == null || !mounted) return;
    final note = await _ask('What was discussed?', 'Short description (optional)');
    _transition('SCHEDULE_TRIAL', {'trialDate': date, if ((note ?? '').isNotEmpty) 'note': note});
  }

  Future<void> _drop() async {
    final reason = await _ask('Drop inquiry', 'Why? (required)');
    if (reason != null && reason.isNotEmpty) _transition('DROP', {'reason': reason});
  }

  Future<void> _reopen() async {
    final reason = await _ask('Reopen inquiry', 'Reason');
    if (reason != null) _transition('REOPEN', {'reason': reason});
  }

  Future<void> _noAnswer() async {
    final note = await _ask('No answer', 'Any note? (optional)');
    _transition('NO_ANSWER', {if ((note ?? '').isNotEmpty) 'note': note});
  }

  /// "Joined" hands off to Demo Students (founder request 2026-09-28) —
  /// leads become a trial record first, never a paying admission directly.
  Future<void> _markJoined() async {
    final d = _detail;
    if (d == null) return;
    final result = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        builder: (_) => DemoStudentsScreen(
          staff: true,
          inquiryPrefill: (inquiryId: d.inquiryId, name: d.name, phone: d.phone, instrument: d.course),
        ),
      ),
    );
    final convertedId = result?['convertedStudentId'] as String?;
    if (convertedId != null && convertedId.isNotEmpty) {
      _transition('CONVERT', {'studentRef': convertedId});
    }
  }

  Color _finalStatusColor(String finalStatus) => AppColors.adaptive(context, switch (finalStatus) {
        'APPROVED' => AppColors.okFg,
        'REJECTED' => AppColors.blockFg,
        _ => AppColors.muted,
      });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Inquiry profile')),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ErrorView(_error!, onRetry: _load)
              : _detail == null
                  ? const EmptyState('Not found.')
                  : _body(_detail!),
    );
  }

  Widget _body(InquiryDetail d) {
    final status = d.status.toUpperCase();
    const canFollowUp = {'OPEN', 'CONTACTED', 'DORMANT'};
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Expanded(child: Text(d.name, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18))),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: _finalStatusColor(d.finalStatus).withValues(alpha: .12),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(d.finalStatus,
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: _finalStatusColor(d.finalStatus))),
                  ),
                ]),
                const SizedBox(height: AppSpace.s2),
                _detailRow(Icons.phone_outlined, d.phone),
                _detailRow(Icons.music_note_outlined, d.course),
                _detailRow(Icons.location_on_outlined, d.branch),
                if (d.source.isNotEmpty) _detailRow(Icons.campaign_outlined, d.source),
                const SizedBox(height: AppSpace.s2),
                Row(children: [
                  Text('STAGE', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: AppColors.adaptive(context, AppColors.muted), letterSpacing: .5)),
                  const SizedBox(width: AppSpace.s2),
                  StatusBadge(d.status),
                ]),
                if (d.nextContactDate.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpace.s2),
                    child: Text('Next follow-up: ${d.nextContactDate}', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.focus))),
                  ),
                if (d.trialDate.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Trial: ${d.trialDate}', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg))),
                  ),
                if (d.dropReason.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text('Dropped: ${d.dropReason}', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.blockFg))),
                  ),
                if (d.notes.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpace.s2),
                    child: Text(d.notes, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                  ),
              ]),
            ),
          ),
          const SizedBox(height: AppSpace.s3),
          if (status == 'DROPPED' || status == 'DORMANT')
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                onPressed: _acting ? null : _reopen,
                icon: const Icon(Icons.replay_outlined, size: 18),
                label: const Text('Reopen'),
              ),
            ),
          if (status != 'DROPPED' && status != 'CONVERTED') ...[
            Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
              if (canFollowUp.contains(status))
                OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.focus)),
                  onPressed: _acting ? null : _logContact,
                  child: const Text('Log contact'),
                ),
              if (canFollowUp.contains(status))
                OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.warnFg)),
                  onPressed: _acting ? null : _scheduleTrial,
                  child: const Text('Schedule trial'),
                ),
              if (canFollowUp.contains(status))
                OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.muted)),
                  onPressed: _acting ? null : _noAnswer,
                  child: const Text('No answer'),
                ),
              if (status == 'TRIAL_SCHEDULED')
                OutlinedButton(
                  style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.okFg)),
                  onPressed: _acting ? null : () => _transition('TRIAL_DONE', const {}),
                  child: const Text('Trial done'),
                ),
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.okFg)),
                onPressed: _acting ? null : _markJoined,
                child: const Text('Joined'),
              ),
              OutlinedButton(
                style: OutlinedButton.styleFrom(foregroundColor: AppColors.adaptive(context, AppColors.blockFg)),
                onPressed: _acting ? null : _drop,
                child: const Text('Drop'),
              ),
            ]),
          ],
          const SizedBox(height: AppSpace.s4),
          Text('FOLLOW-UP HISTORY', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.adaptive(context, AppColors.muted))),
          const SizedBox(height: AppSpace.s2),
          if (d.followups.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpace.s2),
              child: Text('No follow-ups recorded yet.', style: TextStyle(fontSize: 13, color: AppColors.adaptive(context, AppColors.muted))),
            )
          else
            for (final f in d.followups)
              Card(
                margin: const EdgeInsets.only(bottom: AppSpace.s2),
                child: ListTile(
                  dense: true,
                  title: Text(f.description.isNotEmpty ? f.description : f.action, style: const TextStyle(fontSize: 13)),
                  subtitle: Text(
                    [f.action.replaceAll('_', ' '), f.createdAt.isNotEmpty ? f.createdAt.replaceFirst('T', ' ').substring(0, 16) : '', f.createdBy]
                        .where((e) => e.isNotEmpty)
                        .join(' · '),
                    style: TextStyle(fontSize: 11, color: AppColors.adaptive(context, AppColors.muted)),
                  ),
                  trailing: StatusBadge(f.resultingStatus),
                ),
              ),
        ],
      ),
    );
  }

  Widget _detailRow(IconData icon, String text) {
    if (text.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(children: [
        Icon(icon, size: 15, color: AppColors.adaptive(context, AppColors.muted)),
        const SizedBox(width: 6),
        Expanded(child: Text(text, style: const TextStyle(fontSize: 13))),
      ]),
    );
  }
}
