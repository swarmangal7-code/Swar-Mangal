import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../state/sync_manager.dart';
import '../../widgets/atoms.dart';

/// Today's Classes — the staff end-of-evening surface. Records what actually
/// happened to each expected class (TEACHER DELIVERY). Student attendance is a
/// separate record, never merged into this one.
class TodaysClassesScreen extends StatefulWidget {
  const TodaysClassesScreen({super.key});
  @override
  State<TodaysClassesScreen> createState() => _TodaysClassesScreenState();
}

class _TodaysClassesScreenState extends State<TodaysClassesScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'sessions', 'attendance'};

  @override
  Future<void> reloadFromSync() => _load();

  TodaysClassOptions? _opts;
  String? _error;
  bool _busy = true;
  DateTime _date = DateTime.now();
  List<Teacher> _teachers = const [];

  @override
  void initState() {
    super.initState();
    _load();
    _loadTeachers();
  }

  List<String> get _branches {
    final b = context.read<AuthProvider>().branches;
    return b.isEmpty ? const ['GOREGAON', 'KANDIVALI'] : b;
  }

  late String _branch = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_branch.isEmpty) _branch = _branches.first;
  }

  /// The substitute picker needs the real teacher list, not a typed id.
  Future<void> _loadTeachers() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final rows = await auth.service!.listTeachers();
      if (!mounted) return;
      setState(() => _teachers =
          rows.where((t) => !['INACTIVE', 'LEFT'].contains(t.status.toUpperCase())).toList());
    } on ApiException {
      // Substitute stays an optional free-text fallback if this lookup fails.
    } on ApiUnreachable {
      // same
    }
  }

  String get _dateStr =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  static DateTime get _today {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final opts = await auth.service!.staffTodaysClasses(
        branch: _branch,
        date: _dateStr,
      );
      if (!mounted) return;
      setState(() {
        _opts = opts;
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
    if (_busy && _opts == null) return const Center(child: CircularProgressIndicator());
    if (_error != null && _opts == null) return ErrorView(_error!, onRetry: _load);
    final opts = _opts!;
    return RefreshScaffold(
      onRefresh: _load,
      child: Stack(children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(AppSpace.s4, AppSpace.s3, AppSpace.s4, 96),
          children: [
            Row(children: [
              IconButton(
                icon: const Icon(Icons.chevron_left),
                onPressed: () {
                  setState(() => _date = _date.subtract(const Duration(days: 1)));
                  _load();
                },
              ),
              Expanded(
                child: TextButton(
                  onPressed: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _date,
                      firstDate: DateTime(2020),
                      // The server refuses an answer for a day that has not
                      // happened, so the picker must not offer one.
                      lastDate: _today,
                    );
                    if (d != null && mounted) {
                      setState(() => _date = d);
                      _load();
                    }
                  },
                  child: Text('$_dateStr  ·  ${opts.unanswered} unanswered',
                      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.ink))),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.chevron_right),
                // A class that has not happened yet cannot be answered, so the
                // forward step stops at today rather than walking into the future.
                onPressed: _date.isBefore(_today) ? () {
                  final next = _date.add(const Duration(days: 1));
                  if (next.isAfter(_today)) return;
                  setState(() => _date = next);
                  _load();
                } : null,
              ),
            ]),
            if (_branches.length > 1)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpace.s2),
                child: Wrap(
                  spacing: AppSpace.s2,
                  children: [
                    for (final b in _branches)
                      ChoiceChip(
                        label: Text(b),
                        selected: _branch == b,
                        onSelected: (_) {
                          setState(() => _branch = b);
                          _load();
                        },
                      ),
                  ],
                ),
              ),
            if (opts.rows.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: AppSpace.s6),
                child: EmptyState('No classes on this day.'),
              )
            else
              for (final c in opts.rows) _classCard(c, opts.outcomes),
            const SizedBox(height: AppSpace.s3),
            const Text(
              'Teacher delivery is a separate record from student attendance. '
              'A class with nobody present may still be HELD.',
              style: TextStyle(fontSize: 11, color: AppColors.muted),
            ),
          ],
        ),
        Positioned(
          right: AppSpace.s4,
          bottom: AppSpace.s4,
          child: FloatingActionButton.extended(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            onPressed: _scheduleCustom,
            icon: const Icon(Icons.event_note),
            label: const Text('Make-up / recovery'),
          ),
        ),
      ]),
    );
  }

  Widget _classCard(TodaysClass c, List<String> outcomes) {
    final resolved = c.resolved;
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.s3),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: c.answerable ? () => _resolve(c, outcomes) : null,
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.s4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Container(
                width: 56,
                padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                decoration: BoxDecoration(color: AppColors.primaryDark, borderRadius: BorderRadius.circular(6)),
                child: Center(
                  child: Text(_time12(c.startTime),
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12)),
                ),
              ),
              const SizedBox(width: AppSpace.s3),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${c.course} · ${c.branch}',
                      style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  Text('Teacher ${_s(c.teacherId)}${c.deliveredBy.isNotEmpty ? ' · delivered by ${_s(c.deliveredBy)}' : ''}',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                ]),
              ),
            ]),
            const SizedBox(height: AppSpace.s2),
            Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
              if (resolved) StatusBadge(c.outcome)
              else const StatusBadge('UNANSWERED'),
              if (c.customKind.isNotEmpty) TagChip(c.customKind, color: AppColors.focus),
              if (c.evidenceClass.isNotEmpty)
                Text(c.evidenceClass, style: const TextStyle(fontSize: 11, color: AppColors.muted)),
              if (c.notRequired) const StatusBadge('NOT REQUIRED'),
            ]),
          ]),
        ),
      ),
    );
  }

  Future<void> _resolve(TodaysClass c, List<String> outcomes) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final builder = _OutcomeDialog(
      outcomes: outcomes,
      classDate: c.classDate,
      today: _dateStr,
    );
    final res = await showDialog<Map<String, String>>(context: context, builder: (_) => builder);
    if (res == null || !mounted) return;
    setState(() => _busy = true);
    try {
      final r = await auth.service!.staffResolveTodaysClass({
        'eventId': c.eventId,
        'outcome': res['outcome'] ?? '',
        if ((res['deliveredBy'] ?? '').isNotEmpty) 'deliveredBy': res['deliveredBy'],
        if ((res['lateReason'] ?? '').isNotEmpty) 'lateReason': res['lateReason'],
        if ((res['reason'] ?? '').isNotEmpty) 'reason': res['reason'],
      });
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text(m['ok'] == true ? (m['note'] ?? 'Recorded.') : (m['error'] ?? m['message'] ?? 'Refused.'))));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      if (e.code == 'ALREADY_ANSWERED') {
        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(SnackBar(
            content: Text(e.message),
            action: SnackBarAction(label: 'Request correction', onPressed: () => _requestCorrection(c.eventId)),
            duration: const Duration(seconds: 8),
          ));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  /// Brief §14.1: a class answered once cannot be re-answered directly.
  /// Staff ask; the founder's approval re-opens it for a real second answer.
  Future<void> _requestCorrection(String eventId) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final reasonCtrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Request a correction'),
        content: TextField(controller: reasonCtrl, maxLines: 2, decoration: const InputDecoration(labelText: 'What is wrong? (required)')),
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
    try {
      final r = await auth.service!.raw('api_staff_requestClassCorrection', {
        'eventId': eventId,
        'reason': reason,
        'clientIntentKey': 'CCORR-${DateTime.now().microsecondsSinceEpoch}',
      });
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text((m['note'] ?? (m['ok'] == true ? 'Sent for approval.' : 'Could not send.')).toString())));
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  void _scheduleCustom() {
    Navigator.of(context).push(MaterialPageRoute(
      builder: (_) => _ScheduleCustomScreen(
        recentResolved: _opts?.rows.where((c) => c.resolved).toList() ?? const [],
        teachers: _teachers,
        branch: _branch,
      ),
    ));
  }

  String _time12(String t) {
    final p = t.split(':');
    if (p.length < 2) return t;
    final h = int.tryParse(p[0]) ?? 0;
    final m = p[1];
    final suffix = h >= 12 ? 'PM' : 'AM';
    final hh = h % 12 == 0 ? 12 : h % 12;
    return '$hh:$m $suffix';
  }

  String _s(String v) => v.isEmpty ? '—' : v;
}

class _OutcomeDialog extends StatefulWidget {
  const _OutcomeDialog({required this.outcomes, required this.classDate, required this.today});
  final List<String> outcomes;
  final String classDate;
  final String today;
  @override
  State<_OutcomeDialog> createState() => _OutcomeDialogState();
}

class _OutcomeDialogState extends State<_OutcomeDialog> {
  static const _outcomesRequiringReason = {'TEACHER_ABSENT', 'SCHOOL_HOLIDAY', 'STUDENT_ABSENT'};

  String _outcome = 'HELD';
  final _deliveredBy = TextEditingController();
  final _lateReason = TextEditingController();
  final _reason = TextEditingController();

  @override
  void dispose() {
    _deliveredBy.dispose();
    _lateReason.dispose();
    _reason.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final late = widget.classDate != widget.today;
    final needsReason = _outcomesRequiringReason.contains(_outcome);
    final options = [
      ...widget.outcomes.where((o) => o != 'UNRESOLVED'),
    ];
    return AlertDialog(
      title: const Text('What happened to this class?'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Wrap(spacing: AppSpace.s2, runSpacing: AppSpace.s2, children: [
            for (final o in options)
              ChoiceChip(
                label: Text(o.replaceAll('_', ' ')),
                selected: _outcome == o,
                onSelected: (_) => setState(() => _outcome = o),
              ),
          ]),
          if (_outcome == 'SUBSTITUTE_DELIVERED') ...[
            const SizedBox(height: AppSpace.s3),
            TextField(
              controller: _deliveredBy,
              decoration: const InputDecoration(labelText: 'Who actually delivered (teacher id) *'),
            ),
          ],
          if (needsReason) ...[
            const SizedBox(height: AppSpace.s3),
            TextField(
              controller: _reason,
              maxLines: 2,
              decoration: InputDecoration(labelText: 'Why is this being recorded as ${_outcome.replaceAll('_', ' ')}? *'),
            ),
          ],
          if (late) ...[
            const SizedBox(height: AppSpace.s3),
            TextField(
              controller: _lateReason,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Why recorded after the day? (optional)'),
            ),
          ],
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: () {
            if (_outcome == 'SUBSTITUTE_DELIVERED' && _deliveredBy.text.trim().isEmpty) return;
            if (needsReason && _reason.text.trim().isEmpty) return;
            Navigator.pop(context, {
              'outcome': _outcome,
              'deliveredBy': _deliveredBy.text.trim(),
              'lateReason': _lateReason.text.trim(),
              'reason': _reason.text.trim(),
            });
          },
          child: const Text('Record'),
        ),
      ],
    );
  }
}

/// Brief §10.2: three kinds that are NOT synonyms, never collapsed into one
/// dropdown option. Payable defaults to NO on every one of them.
class _ScheduleCustomScreen extends StatefulWidget {
  const _ScheduleCustomScreen({required this.recentResolved, this.teachers = const [], this.branch = ''});
  final List<TodaysClass> recentResolved;
  final List<Teacher> teachers;
  final String branch;
  @override
  State<_ScheduleCustomScreen> createState() => _ScheduleCustomScreenState();
}

class _ScheduleCustomScreenState extends State<_ScheduleCustomScreen> {
  final _formKey = GlobalKey<FormState>();
  final _teacher = TextEditingController();
  final _instrument = TextEditingController();
  final _time = TextEditingController();
  final _reason = TextEditingController();
  String _dateStr = '';
  String _kind = 'GOODWILL_RECOVERY';
  String? _teacherId;
  TodaysClass? _original;
  bool _busy = false;
  String? _result;
  bool _ok = false;

  static const _kinds = [
    (
      value: 'SUBSTITUTE',
      label: 'Substitute',
      help: 'Somebody else covered a scheduled obligation. Discharges the original.',
    ),
    (
      value: 'REPLACEMENT',
      label: 'Replacement',
      help: 'A makeup for a class that did not happen. Discharges an owed obligation.',
    ),
    (
      value: 'GOODWILL_RECOVERY',
      label: 'Goodwill recovery',
      help: 'An extra class to recover a relationship. Discharges NOTHING.',
    ),
  ];

  bool get _needsOriginal => _kind != 'GOODWILL_RECOVERY';

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _dateStr = '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (_needsOriginal && _original == null) {
      setState(() => _result = 'Pick the class this stands in for.');
      return;
    }
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final r = await auth.service!.staffScheduleSession({
        'branch': widget.branch,
        'teacherId': _teacherId ?? _teacher.text.trim(),
        'instrument': _instrument.text.trim(),
        'sessionDate': _dateStr,
        'startTime': _time.text.trim(),
        'customKind': _kind,
        'reason': _reason.text.trim(),
        if (_original != null) 'originalEventId': _original!.eventId,
      });
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = m['ok'] == true;
        _result = m['ok'] == true
            ? (m['note'] ?? 'Scheduled ${m['scheduledSessionId']}.')
            : (m['error'] ?? m['message'] ?? 'Could not schedule.');
      });
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
      appBar: AppBar(title: const Text('Schedule an extra class')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppSpace.s4),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('KIND', style: AppType.eyebrow),
                  const SizedBox(height: AppSpace.s2),
                  RadioGroup<String>(
                    groupValue: _kind,
                    onChanged: (v) => setState(() {
                      _kind = v!;
                      if (!_needsOriginal) _original = null;
                      _result = null;
                    }),
                    child: Column(children: [
                      for (final k in _kinds)
                        RadioListTile<String>(
                          contentPadding: EdgeInsets.zero,
                          value: k.value,
                          title: Text(k.label, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                          subtitle: Text(k.help, style: const TextStyle(fontSize: 12, color: AppColors.muted)),
                        ),
                    ]),
                  ),
                ]),
              ),
            ),
            if (_needsOriginal) ...[
              const SizedBox(height: AppSpace.s3),
              Card(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpace.s4),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('WHICH CLASS THIS STANDS IN FOR', style: AppType.eyebrow),
                    const SizedBox(height: AppSpace.s2),
                    if (widget.recentResolved.isEmpty)
                      const Text('No answered classes on this screen yet. Open Today\'s Classes on the day it happened first.',
                          style: TextStyle(fontSize: 12, color: AppColors.muted))
                    else
                      DropdownButtonFormField<TodaysClass>(
                        initialValue: _original,
                        decoration: const InputDecoration(labelText: 'Original class'),
                        items: [
                          for (final c in widget.recentResolved)
                            DropdownMenuItem(value: c, child: Text('${c.classDate} ${c.startTime} · ${c.course} · ${c.outcome}')),
                        ],
                        onChanged: (v) => setState(() => _original = v),
                      ),
                  ]),
                ),
              ),
            ],
            const SizedBox(height: AppSpace.s3),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  TextFormField(
                    controller: _reason,
                    decoration: const InputDecoration(labelText: 'Reason *', prefixIcon: Icon(Icons.notes_outlined)),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Say why this class is being held' : null,
                  ),
                  const SizedBox(height: AppSpace.s3),
                  if (widget.teachers.isNotEmpty)
                    DropdownButtonFormField<String>(
                      initialValue: _teacherId,
                      decoration: const InputDecoration(labelText: 'Teacher *', prefixIcon: Icon(Icons.person_outline)),
                      hint: const Text('Select teacher…'),
                      items: [
                        for (final t in widget.teachers)
                          DropdownMenuItem(value: t.teacherId, child: Text(t.teacherName)),
                      ],
                      onChanged: (v) => setState(() => _teacherId = v),
                      validator: (v) => v == null ? 'Teacher is required' : null,
                    )
                  else
                    TextFormField(
                      controller: _teacher,
                      decoration: const InputDecoration(labelText: 'Teacher ID *', prefixIcon: Icon(Icons.person_outline)),
                      validator: (v) => (v == null || v.trim().isEmpty) ? 'Teacher is required' : null,
                    ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _instrument,
                    decoration: const InputDecoration(labelText: 'Instrument / course', prefixIcon: Icon(Icons.music_note_outlined)),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _time,
                    decoration: const InputDecoration(labelText: 'Start time (HH:MM)', prefixIcon: Icon(Icons.schedule)),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Start time required' : null,
                  ),
                  const SizedBox(height: AppSpace.s3),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.event, color: AppColors.muted),
                    title: Text(_dateStr, style: const TextStyle(fontWeight: FontWeight.w700)),
                    trailing: TextButton(
                      onPressed: () async {
                        final d = await showDatePicker(
                          context: context,
                          initialDate: DateTime.now(),
                          firstDate: DateTime(2020),
                          lastDate: DateTime(2035),
                        );
                        if (d != null && mounted) {
                          setState(() => _dateStr =
                              '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
                        }
                      },
                      child: const Text('Change'),
                    ),
                  ),
                ]),
              ),
            ),
            const SizedBox(height: AppSpace.s3),
            Container(
              padding: const EdgeInsets.all(AppSpace.s3),
              decoration: BoxDecoration(color: AppColors.warnBg, borderRadius: BorderRadius.circular(AppRadius.s)),
              child: const Text(
                'This is never payable by default. If the academy owes this teacher for it, Sharvil decides that separately.',
                style: TextStyle(fontSize: 12, color: AppColors.warnFg),
              ),
            ),
            if (_result != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s3),
                child: Container(
                  padding: const EdgeInsets.all(AppSpace.s3),
                  decoration: BoxDecoration(
                    color: _ok ? AppColors.okBg : AppColors.blockBg,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(_result!, style: TextStyle(color: _ok ? AppColors.okFg : AppColors.blockFg, fontSize: 13)),
                ),
              ),
            const SizedBox(height: AppSpace.s4),
            LoadingButton(label: 'Schedule class', icon: Icons.event_available, busy: _busy, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}