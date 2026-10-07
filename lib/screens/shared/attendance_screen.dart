import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../state/auth_provider.dart';
import '../../state/sync_manager.dart';
import '../../widgets/atoms.dart';
import 'message_compose_screen.dart';

/// Staff attendance: filter-first roster, three markable states.
class AttendanceScreen extends StatefulWidget {
  const AttendanceScreen({super.key});
  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class AttendanceRosterRow {
  AttendanceRosterRow({
    required this.studentId,
    required this.name,
    required this.instrument,
    required this.teacherName,
    required this.phone,
    this.state = '',
  });
  factory AttendanceRosterRow.fromApi(Map<String, dynamic> b) =>
      AttendanceRosterRow(
        studentId: _sv(b['studentId']),
        name: _sv(b['name']),
        instrument: _sv(b['instrument']),
        teacherName: _sv(b['teacherName']),
        phone: _sv(b['phone']),
        state: _sv(b['state']),
      );
  final String studentId;
  final String name;
  final String instrument;
  final String teacherName;
  final String phone;
  /// PRESENT / ABSENT / EXCUSED / LATE / NOT_MARKED — what the server
  /// actually has on file for today, not a guess.
  final String state;

  bool get isMarked => state.isNotEmpty && state != 'NOT_MARKED';
}

String _sv(dynamic v) => v == null ? '' : v.toString();

class _AttendanceScreenState extends State<AttendanceScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'attendance'};

  @override
  Future<void> reloadFromSync() => _load();

  List<AttendanceRosterRow> _roster = [];
  List<String> _instruments = [];
  String? _instrument;
  String? _error;
  bool _busy = true;
  /// Which day is being marked. The server refuses future days outright, and
  /// a past day additionally needs a reason — so this is a real control, not
  /// a convenience.
  late String _date;
  String? _backdatedReason;

  @override
  void initState() {
    super.initState();
    _date = _today();
    _load();
  }

  /// ISO dates sort lexicographically, which is all this needs.
  bool get _isBackdated => _date.compareTo(_today()) < 0;

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_date) ?? DateTime.now(),
      firstDate: DateTime(DateTime.now().year - 2),
      lastDate: DateTime.now(), // the server rejects future days
    );
    if (picked == null || !mounted) return;
    setState(() {
      _date = '${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}';
      if (!_isBackdated) _backdatedReason = null;
    });
    await _load();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await auth.service!.staffAttendanceRoster({
        'branch': auth.branch ?? '',
        'instrument': _instrument ?? '',
        'date': _date,
      });
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _roster = (m['students'] as List? ?? [])
            .whereType<Map<String, dynamic>>()
            .map(AttendanceRosterRow.fromApi)
            .toList();
        _instruments = (m['instruments'] as List? ?? []).map((e) => e.toString()).toList();
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

  String _today() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  final Set<String> _marking = {};
  late final _reasonCtrl = TextEditingController();

  @override
  void dispose() {
    _reasonCtrl.dispose();
    super.dispose();
  }

  Future<void> _markInformedAbsence(AttendanceRosterRow s) async {
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) {
        final ctrl = TextEditingController();
        return AlertDialog(
          title: Text('Reason ${s.name} will be absent'),
          content: TextField(controller: ctrl, autofocus: true, maxLines: 2, decoration: const InputDecoration(hintText: 'Told in advance…')),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, ctrl.text.trim()), child: const Text('Mark')),
          ],
        );
      },
    );
    if (reason == null) return;
    await _mark(s, 'INFORMED_ABSENCE', absenceReason: reason);
  }

  Future<void> _mark(AttendanceRosterRow s, String state, {String? absenceReason}) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null || _marking.contains(s.studentId)) return;
    if (_isBackdated && (_backdatedReason ?? '').trim().isEmpty) {
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text('Say why $_date is being entered late, then mark again.')));
      return;
    }
    setState(() => _marking.add(s.studentId));
    try {
      await auth.service!.staffMarkAttendance({
        'branch': auth.branch ?? '',
        'studentId': s.studentId,
        'state': state,
        'workDate': _date,
        if (_isBackdated) 'backdatedReason': _backdatedReason!.trim(),
        if (absenceReason != null && absenceReason.isNotEmpty) 'absenceReason': absenceReason,
      });
      if (!mounted) return;
      // Never optimistic: re-read the roster so the badge reflects what the
      // server actually recorded, including on a correction (re-marking).
      await _load();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text('${s.name} → $state')));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _marking.remove(s.studentId));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_busy && _roster.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null && _roster.isEmpty) return ErrorView(_error!, onRetry: _load);
    return RefreshScaffold(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.event_outlined),
            title: Text('ATTENDANCE · ${_isBackdated ? _date : '$_date (today)'}',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.muted)),
            trailing: const Icon(Icons.edit_calendar_outlined, size: 18),
            onTap: _pickDate,
          ),
          if (_isBackdated) ...[
            const SizedBox(height: AppSpace.s2),
            TextField(
              controller: _reasonCtrl,
              onChanged: (v) => _backdatedReason = v,
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'Why is $_date being entered late? *',
                helperText: 'The server refuses a backdated mark without a reason.',
              ),
            ),
          ],
          const SizedBox(height: AppSpace.s3),
          if (_instruments.isNotEmpty) ...[
            SizedBox(
              height: 40,
              child: ListView(scrollDirection: Axis.horizontal, children: [
                ChoiceChip(
                  label: const Text('All'),
                  selected: _instrument == null,
                  onSelected: (_) {
                    setState(() => _instrument = null);
                    _load();
                  },
                ),
                for (final inst in _instruments)
                  Padding(
                    padding: const EdgeInsets.only(left: AppSpace.s2),
                    child: ChoiceChip(
                      label: Text(inst),
                      selected: _instrument == inst,
                      onSelected: (_) {
                        setState(() => _instrument = inst);
                        _load();
                      },
                    ),
                  ),
              ]),
            ),
            const SizedBox(height: AppSpace.s3),
          ],
          if (_roster.isEmpty)
            EmptyState('No students in ${_instrument ?? 'this branch'} for this instrument.')
          else
            for (final s in _roster)
              Card(
                margin: const EdgeInsets.only(bottom: AppSpace.s3),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s3),
                  child: Row(children: [
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppColors.primary.withValues(alpha: .08),
                      child: Text(s.name.isNotEmpty ? s.name[0].toUpperCase() : '?',
                          style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary, fontSize: 13)),
                    ),
                    const SizedBox(width: AppSpace.s3),
                    Expanded(
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Flexible(child: Text(s.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14))),
                          if (s.isMarked) ...[const SizedBox(width: AppSpace.s2), StatusBadge(s.state)],
                        ]),
                        Text(
                            [s.instrument, s.teacherName, s.phone].where((e) => e.isNotEmpty).join(' · '),
                            style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                      ]),
                    ),
                    _markButtons(s),
                  ]),
                ),
              ),
        ],
      ),
    );
  }

  Widget _markButtons(AttendanceRosterRow s) {
    final busy = _marking.contains(s.studentId);
    final isPresent = s.state == 'PRESENT';
    final isAbsent = s.state == 'ABSENT';
    final isInformed = s.state == 'INFORMED_ABSENCE';
    if (busy) {
      return const SizedBox(width: 32, height: 32, child: Center(child: CircularProgressIndicator(strokeWidth: 2)));
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
      FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: isPresent ? AppColors.okFg : AppColors.okFg.withValues(alpha: .35),
          minimumSize: const Size(0, 32),
          padding: const EdgeInsets.symmetric(horizontal: AppSpace.s3),
        ),
        // Marking again re-sends the same state — the server's upsert makes
        // that a harmless no-op, so there's no need to disable it.
        onPressed: () => _mark(s, 'PRESENT'),
        child: Text(isPresent ? 'PRESENT ✓' : 'PRESENT', style: const TextStyle(fontSize: 11)),
      ),
      const SizedBox(height: 4),
      TextButton(
        style: TextButton.styleFrom(
          minimumSize: const Size(0, 30),
          padding: const EdgeInsets.symmetric(horizontal: AppSpace.s3),
          foregroundColor: isAbsent ? AppColors.blockFg : AppColors.muted,
        ),
        onPressed: () => _mark(s, 'ABSENT'),
        child: Text(isAbsent ? 'ABSENT ✓' : 'ABSENT', style: const TextStyle(fontSize: 11)),
      ),
      const SizedBox(height: 4),
      TextButton(
        style: TextButton.styleFrom(
          minimumSize: const Size(0, 30),
          padding: const EdgeInsets.symmetric(horizontal: AppSpace.s3),
          foregroundColor: isInformed ? AppColors.blockFg : AppColors.muted,
        ),
        onPressed: () => _markInformedAbsence(s),
        child: Text(isInformed ? 'INFORMED ✓' : 'INFORMED', style: const TextStyle(fontSize: 11)),
      ),
      if (isAbsent || isInformed) ...[
        const SizedBox(height: 4),
        TextButton.icon(
          style: TextButton.styleFrom(minimumSize: const Size(0, 26), padding: const EdgeInsets.symmetric(horizontal: AppSpace.s2)),
          icon: const Icon(Icons.notifications_active_outlined, size: 14),
          label: const Text('Notify teacher', style: TextStyle(fontSize: 10)),
          onPressed: () {
            final auth = context.read<AuthProvider>();
            Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => MessageComposeScreen(
                staff: auth.isStaff,
                studentId: s.studentId,
                studentName: s.name,
                instrument: s.instrument,
                initialType: 'NOTIFY_TEACHER_ABSENCE',
              ),
            ));
          },
        ),
      ],
    ]);
  }
}