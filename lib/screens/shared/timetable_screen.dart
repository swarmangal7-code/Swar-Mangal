import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/sync_manager.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';
import 'closures_screen.dart';

/// Branch timetable — day selector + per-day class cards, weekly view.
/// Both roles edit (add/edit/enable-disable/delete).
class TimetableScreen extends StatefulWidget {
  const TimetableScreen({super.key, required this.staff});
  final bool staff;
  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'timetable'};

  @override
  Future<void> reloadFromSync() => _load();

  List<TimetableWeekEntry> _rows = [];
  List<Teacher> _teachers = [];
  String? _error;
  bool _busy = true;
  int _day = DateTime.now().weekday - 1; // ISO: 0=Mon
  bool _weekly = false;
  late String _weekStart = _mondayOf(DateTime.now());

  bool get canEdit => TimetablePolicy.canEdit(staff: widget.staff);

  static String _mondayOf(DateTime d) {
    final monday = d.subtract(Duration(days: d.weekday - 1));
    return '${monday.year.toString().padLeft(4, '0')}-${monday.month.toString().padLeft(2, '0')}-${monday.day.toString().padLeft(2, '0')}';
  }

  static String _addDays(String iso, int days) {
    final d = DateTime.parse(iso).add(Duration(days: days));
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  String _weekRangeLabel() {
    final start = DateTime.parse(_weekStart);
    final end = DateTime.parse(_addDays(_weekStart, 6));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${start.day} ${months[start.month - 1]} – ${end.day} ${months[end.month - 1]}';
  }

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
      final results = await Future.wait([
        auth.service!.timetableWeek(branch: auth.branch ?? 'ALL', weekStart: _weekStart),
        auth.service!.listTeachers(),
      ]);
      if (!mounted) return;
      setState(() {
        _rows = (results[0] as ({String weekStart, String weekEnd, List<TimetableWeekEntry> entries})).entries;
        _teachers = results.length > 1 ? results[1] as List<Teacher> : const <Teacher>[];
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

  void _shiftWeek(int days) {
    setState(() => _weekStart = _addDays(_weekStart, days));
    _load();
  }

  List<TimetableWeekEntry> get _dayRows {
    final day = _rows.where((e) => e.dayOfWeek == _day).toList()
      ..sort((a, b) => a.startTime.compareTo(b.startTime));
    return day;
  }

  List<(int, List<TimetableWeekEntry>)> get _weeklyViewData {
    final out = <(int, List<TimetableWeekEntry>)>[];
    for (var d = 0; d < 7; d++) {
      final list = _rows.where((e) => e.dayOfWeek == d).toList()
        ..sort((a, b) => a.startTime.compareTo(b.startTime));
      out.add((d, list));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) return const SkeletonList(rows: 8);
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Timetable')),
        body: Padding(padding: const EdgeInsets.all(AppSpace.s4), child: ErrorView(_error!, onRetry: _load)),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: const Text('Timetable'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => ClosuresScreen(staff: widget.staff),
            )),
            child: const Text('Closures', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
          TextButton(
            onPressed: () => setState(() => _weekly = !_weekly),
            child: Text(_weekly ? 'Day view' : 'Weekly view',
                style: const TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
      floatingActionButton: canEdit
          ? FloatingActionButton.extended(
              backgroundColor: AppColors.adaptive(context, AppColors.primary),
              foregroundColor: Colors.white,
              onPressed: () => _edit(_blankEntry()),
              icon: const Icon(Icons.add),
              label: const Text('Add class'),
            )
          : null,
      body: Column(children: [
        _weekNav(),
        Expanded(
          child: RefreshScaffold(
            onRefresh: _load,
            child: _weekly ? _weeklyView() : _dayView(),
          ),
        ),
      ]),
    );
  }

  Widget _weekNav() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: 6),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        IconButton(icon: const Icon(Icons.chevron_left), onPressed: () => _shiftWeek(-7)),
        TextButton(
          onPressed: () {
            setState(() => _weekStart = _mondayOf(DateTime.now()));
            _load();
          },
          child: Text(_weekRangeLabel(), style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
        IconButton(icon: const Icon(Icons.chevron_right), onPressed: () => _shiftWeek(7)),
      ]),
    );
  }

  String _branchHeading() {
    final b = (context.read<AuthProvider>().branch ?? '').trim().toUpperCase();
    if (b.isEmpty || b == 'ALL') return 'All branches';
    return '${b[0]}${b.substring(1).toLowerCase()}';
  }

  TimetableEntry _blankEntry() => TimetableEntry(
        id: '',
        branch: 'KANDIVALI',
        dayOfWeek: 0,
        startTime: '17:00',
        endTime: '18:00',
        className: '',
      );

  Widget _dayView() {
    return Column(children: [
      // Day selector
      SizedBox(
        height: 52,
        child: ListView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: 6),
          children: [
            for (var d = 0; d < timetableDayNames.length; d++)
              Padding(
                padding: const EdgeInsets.only(right: AppSpace.s2),
                child: ChoiceChip(
                  label: Text(timetableDayNames[d], style: const TextStyle(fontSize: 12)),
                  selected: _day == d,
                  onSelected: (_) => setState(() => _day = d),
                ),
              ),
          ],
        ),
      ),
      Padding(
        padding: const EdgeInsets.only(left: AppSpace.s5, right: AppSpace.s5, top: AppSpace.s2),
        child: Align(
          alignment: Alignment.centerLeft,
          // Was hardcoded to "Kandivali", even for staff viewing Goregaon.
          child: Text(_branchHeading(), style: const TextStyle(fontWeight: FontWeight.w800)),
        ),
      ),
      Expanded(
        child: _dayRows.isEmpty
            ? const EmptyState('No classes scheduled this day.')
            : ListView(
                padding: const EdgeInsets.all(AppSpace.s4),
                children: [
                  for (final e in _dayRows) _card(e),
                ],
              ),
      ),
    ]);
  }

  Widget _weeklyView() {
    return ListView(
      padding: const EdgeInsets.all(AppSpace.s4),
      children: [
        for (final (d, list) in _weeklyViewData) ...[
          Padding(
            padding: const EdgeInsets.only(top: AppSpace.s3, bottom: AppSpace.s2),
            child: Text(timetableDayNames[d],
                style: AppType.eyebrow.copyWith(
                    color: Theme.of(context).colorScheme.onSurfaceVariant, fontSize: 11)),
          ),
          if (list.isEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpace.s2),
              child: Text('No classes', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
            )
          else
            for (final e in list) _card(e),
        ],
      ],
    );
  }

  Widget _card(TimetableWeekEntry e) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.s3),
      child: InkWell(
        onTap: () => _viewSession(e),
        child: Padding(
          padding: const EdgeInsets.all(AppSpace.s4),
          child: Row(children: [
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('${e.timeLabelStart} — ${e.timeLabelEnd}',
                    style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13)),
                Text(e.className, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                Text(e.teacherName.isNotEmpty ? e.teacherName : 'No teacher assigned',
                    style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                if (e.overridden)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text('Changed this week', style: TextStyle(fontSize: 11, color: AppColors.adaptive(context, AppColors.primary))),
                  ),
              ]),
            ),
            if (e.teacherId.isNotEmpty) TagChip(e.teacherId, color: AppColors.adaptive(context, AppColors.focus)),
            if (canEdit)
              PopupMenuButton<String>(
                icon: Icon(Icons.more_vert, size: 20, color: AppColors.adaptive(context, AppColors.muted)),
                onSelected: (v) {
                  if (v == 'edit') _edit(e);
                  if (v == 'del') _delete(e);
                  if (v == 'toggle') _toggle(e);
                },
                itemBuilder: (_) => [
                  const PopupMenuItem(value: 'edit', child: Text('Edit')),
                  PopupMenuItem(value: 'toggle', child: Text(e.enabled ? 'Disable' : 'Enable')),
                  const PopupMenuItem(value: 'del', child: Text('Delete')),
                ],
              ),
          ]),
        ),
      ),
    );
  }

  Future<void> _viewSession(TimetableWeekEntry e) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (ctx) => _SessionDetailSheet(
        entry: e,
        loader: () => auth.service!.timetableSessionDetail(timetableId: e.id, date: e.date),
        onEdit: () {
          Navigator.pop(ctx);
          _edit(e);
        },
        onDelete: () {
          Navigator.pop(ctx);
          _delete(e);
        },
      ),
    );
  }

  Future<void> _edit(TimetableEntry entry) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _TimetableForm(entry: entry, teachers: _teachers, weekStart: _weekStart),
    );
    if (saved == true) await _load();
  }

  Future<void> _delete(TimetableEntry e) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final scope = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Remove this class?'),
        content: Text('${e.className} ${e.timeLabelStart}—${e.timeLabelEnd}'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(ctx, 'THIS_WEEK'), child: const Text('This week only')),
          FilledButton(onPressed: () => Navigator.pop(ctx, 'ALL_WEEKS'), child: const Text('All weeks')),
        ],
      ),
    );
    if (scope == null || !mounted) return;
    try {
      await auth.service!.timetableDelete(e.id, {'scope': scope, 'weekStart': _weekStart});
      await _load();
    } on ApiException catch (e2) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e2.message)));
    } on ApiUnreachable catch (e2) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e2.message)));
    }
  }

  Future<void> _toggle(TimetableEntry e) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final nextStatus = e.enabled ? 'DISABLED' : 'ENABLED';
    try {
      await auth.service!.timetableUpdate(e.id, {
        'status': nextStatus,
      });
      await _load();
    } on ApiException catch (e2) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e2.message)));
    } on ApiUnreachable catch (e2) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e2.message)));
    }
  }
}

class _TimetableForm extends StatefulWidget {
  const _TimetableForm({required this.entry, required this.teachers, required this.weekStart});
  final TimetableEntry? entry;
  final List<Teacher> teachers;
  final String weekStart;
  bool get isEdit => (entry?.id ?? '').isNotEmpty;
  @override
  State<_TimetableForm> createState() => _TimetableFormState();
}

class _TimetableFormState extends State<_TimetableForm> {
  final _class = TextEditingController();
  final _teacherName = TextEditingController();
  late String _start;
  late String _end;
  late int _day;
  late String _status;
  String? _teacherId;
  String? _substituteId;
  late String _substituteName;
  late String _branch;
  String _editScope = 'THIS_WEEK';
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.entry;
    _class.text = e?.className ?? '';
    _teacherName.text = e?.teacherName ?? '';
    _start = e?.startTime ?? '17:00';
    _end = e?.endTime ?? '18:00';
    _day = e?.dayOfWeek ?? 0;
    _status = e?.status ?? 'ENABLED';
    _teacherId = e?.teacherId ?? '';
    _substituteId = (e?.substituteTeacherId ?? '').isEmpty ? null : e!.substituteTeacherId;
    _substituteName = e?.substituteTeacherName ?? '';
    _branch = e?.branch.isNotEmpty == true ? e!.branch.toUpperCase() : '';
  }

  List<String> get _branches {
    final b = context.read<AuthProvider>().branches;
    return b.isEmpty ? const ['GOREGAON', 'KANDIVALI'] : b;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Founder has no branch gate, so default to their first branch rather
    // than sending a blank one.
    if (_branch.isEmpty) _branch = _branches.first;
  }

  @override
  void dispose() {
    _class.dispose();
    _teacherName.dispose();
    super.dispose();
  }

  Future<void> _pickTime({required bool start}) async {
    final parts = (start ? _start : _end).split(':');
    final t = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1])),
    );
    if (t == null) return;
    final hh = t.hour.toString().padLeft(2, '0');
    final mm = t.minute.toString().padLeft(2, '0');
    setState(() {
      if (start) {
        _start = '$hh:$mm';
      } else {
        _end = '$hh:$mm';
      }
    });
  }

  Future<void> _save() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final range = TimetableValidator.range(_start, _end);
    if (!range.ok) {
      setState(() => _error = range.error);
      return;
    }
    final cErr = TimetableValidator.className(_class.text);
    if (cErr != null) {
      setState(() => _error = cErr);
      return;
    }
    if ((_teacherId ?? '').isEmpty && _teacherName.text.trim().isEmpty) {
      setState(() => _error = 'Pick the teacher who takes this class.');
      return;
    }
    if (_substituteId != null && _substituteId == _teacherId) {
      setState(() => _error = 'The substitute must be someone other than the assigned teacher.');
      return;
    }
    final base = {
      'branch': _branch,
      'dayOfWeek': _day,
      'startTime': _start,
      'endTime': _end,
      'className': _class.text.trim(),
      'teacherId': _teacherId ?? '',
      'teacherName': _teacherName.text.trim(),
      'status': _status,
      'substituteTeacherId': _substituteId ?? '',
      'substituteTeacherName': _substituteName.trim(),
    };
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (!widget.isEdit) {
        await auth.service!.timetableCreate(base);
      } else {
        await auth.service!.timetableUpdate(widget.entry!.id, {
          ...base,
          'scope': _editScope,
          'weekStart': widget.weekStart,
        });
      }
      if (!mounted) return;
      Navigator.pop(context, true);
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
    return AlertDialog(
      title: Text(widget.isEdit ? 'Edit class' : 'Add class'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          TextFormField(
            controller: _class,
            decoration: const InputDecoration(labelText: 'Class / instrument *', prefixIcon: Icon(Icons.music_note_outlined)),
          ),
          const SizedBox(height: AppSpace.s3),
          Text('DAY', style: AppType.eyebrow.copyWith(fontSize: 10)),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            children: [
              for (var d = 0; d < timetableDayNames.length; d++)
                ChoiceChip(
                  label: Text(timetableDayNames[d], style: const TextStyle(fontSize: 11)),
                  selected: _day == d,
                  onSelected: (_) => setState(() => _day = d),
                ),
            ],
          ),
          const SizedBox(height: AppSpace.s3),
          Row(children: [
            Expanded(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.schedule, color: AppColors.adaptive(context, AppColors.muted)),
                title: Text('Start: ${TimetableEntry.time12(_start)}'),
                onTap: () => _pickTime(start: true),
              ),
            ),
            Expanded(
              child: ListTile(
                contentPadding: EdgeInsets.zero,
                leading: Icon(Icons.schedule, color: AppColors.adaptive(context, AppColors.muted)),
                title: Text('End: ${TimetableEntry.time12(_end)}'),
                onTap: () => _pickTime(start: false),
              ),
            ),
          ]),
          const SizedBox(height: AppSpace.s3),
          // Founder edits both branches; staff only their own, so the picker
          // only appears where it can actually change something.
          if (_branches.length > 1) ...[
            DropdownButtonFormField<String>(
              initialValue: _branch,
              decoration: const InputDecoration(labelText: 'Branch'),
              items: [
                for (final b in _branches) DropdownMenuItem(value: b, child: Text(b)),
              ],
              onChanged: (v) => setState(() => _branch = v ?? _branch),
            ),
            const SizedBox(height: AppSpace.s3),
          ],
          if (widget.teachers.isNotEmpty) ...[
            const SizedBox(height: AppSpace.s2),
            DropdownButtonFormField<String>(
              initialValue: _teacherId == '' && widget.teachers.isNotEmpty ? null : _teacherId,
              decoration: const InputDecoration(labelText: 'Teacher *'),
              hint: const Text('Select teacher…'),
              items: [
                for (final t in widget.teachers)
                  DropdownMenuItem(value: t.teacherId, child: Text(t.teacherName)),
              ],
              onChanged: (v) => setState(() {
                _teacherId = v;
                String nm = '';
                for (final t in widget.teachers) {
                  if (t.teacherId == v) {
                    nm = t.teacherName;
                    break;
                  }
                }
                _teacherName.text = nm;
              }),
            ),
            const SizedBox(height: AppSpace.s3),
            // Who covers this slot instead. The server refuses a substitute who
            // is also the assigned teacher, so it is filtered out here too.
            DropdownButtonFormField<String>(
              initialValue: _substituteId,
              decoration: const InputDecoration(labelText: 'Substitute teacher (optional)'),
              hint: const Text('No substitute — the assigned teacher takes it'),
              items: [
                for (final t in widget.teachers)
                  if (t.teacherId != _teacherId)
                    DropdownMenuItem(value: t.teacherId, child: Text(t.teacherName)),
              ],
              onChanged: (v) => setState(() {
                _substituteId = v;
                _substituteName = '';
                for (final t in widget.teachers) {
                  if (t.teacherId == v) {
                    _substituteName = t.teacherName;
                    break;
                  }
                }
              }),
            ),
            const SizedBox(height: AppSpace.s3),
          ],
          TextFormField(
            controller: _teacherName,
            decoration: const InputDecoration(labelText: 'Teacher (name)'),
          ),
          const SizedBox(height: AppSpace.s3),
          Row(children: [
            const Text('Enabled', style: TextStyle(fontSize: 13)),
            Switch.adaptive(value: _status == 'ENABLED', onChanged: (v) => setState(() => _status = v ? 'ENABLED' : 'DISABLED')),
          ]),
          if (widget.isEdit) ...[
            const SizedBox(height: AppSpace.s2),
            Text('APPLY TO', style: AppType.eyebrow.copyWith(fontSize: 10)),
            RadioListTile<String>(
              contentPadding: EdgeInsets.zero,
              dense: true,
              value: 'THIS_WEEK',
              groupValue: _editScope,
              onChanged: (v) => setState(() => _editScope = v!),
              title: const Text('This week only', style: TextStyle(fontSize: 13)),
              subtitle: const Text('Other weeks stay unchanged.', style: TextStyle(fontSize: 11)),
            ),
            RadioListTile<String>(
              contentPadding: EdgeInsets.zero,
              dense: true,
              value: 'ALL_WEEKS',
              groupValue: _editScope,
              onChanged: (v) => setState(() => _editScope = v!),
              title: const Text('All weeks', style: TextStyle(fontSize: 13)),
              subtitle: const Text('Changes the recurring schedule going forward.', style: TextStyle(fontSize: 11)),
            ),
          ],
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s2),
              child: Text(_error!, style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg), fontSize: 13)),
            ),
        ]),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: _busy
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(widget.isEdit ? 'Save changes' : 'Add class'),
        ),
      ],
    );
  }
}
const _outcomeLabels = {
  'HELD': 'Held by the assigned teacher',
  'TEACHER_CANCELLED': 'Teacher was absent / cancelled',
  'ACADEMY_CANCELLED': 'Cancelled by the academy',
  'SUBSTITUTE_DELIVERED': 'Delivered by a substitute',
  'RESCHEDULED': 'Rescheduled',
};

const _attendanceLabels = {
  'PRESENT': 'Present',
  'ABSENT': 'Absent',
  'LATE': 'Late',
  'EXCUSED': 'Excused',
  'NOT_MARKED': 'Not marked',
};

/// Founder request 2026-09-28: tapping a calendar session shows teacher
/// attendance (with the reason if absent) and student attendance by name.
class _SessionDetailSheet extends StatefulWidget {
  const _SessionDetailSheet({required this.entry, required this.loader, required this.onEdit, required this.onDelete});
  final TimetableWeekEntry entry;
  final Future<TimetableSessionDetail> Function() loader;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  @override
  State<_SessionDetailSheet> createState() => _SessionDetailSheetState();
}

class _SessionDetailSheetState extends State<_SessionDetailSheet> {
  late final Future<TimetableSessionDetail> _future = widget.loader();

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      expand: false,
      builder: (context, scrollController) => Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: FutureBuilder<TimetableSessionDetail>(
          future: _future,
          builder: (context, snap) {
            return ListView(
              controller: scrollController,
              children: [
                Text(widget.entry.className, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18)),
                Text(
                  '${widget.entry.date} · ${widget.entry.timeLabelStart}–${widget.entry.timeLabelEnd}',
                  style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
                ),
                const SizedBox(height: AppSpace.s4),
                if (snap.connectionState != ConnectionState.done)
                  const Padding(padding: EdgeInsets.symmetric(vertical: 32), child: Center(child: CircularProgressIndicator()))
                else if (snap.hasError)
                  ErrorView(snap.error.toString())
                else ...[
                  const SectionTitle('Teacher'),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpace.s3),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(snap.data!.teacherName.isNotEmpty ? snap.data!.teacherName : 'No teacher assigned',
                            style: const TextStyle(fontWeight: FontWeight.w700)),
                        const SizedBox(height: 4),
                        if (snap.data!.recorded) ...[
                          Text(
                            (_outcomeLabels[snap.data!.outcome] ?? snap.data!.outcome) +
                                (snap.data!.deliveredBy.isNotEmpty ? ' — ${snap.data!.deliveredBy}' : ''),
                            style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)),
                          ),
                          if (snap.data!.reason.isNotEmpty)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Text('Reason: ${snap.data!.reason}',
                                  style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.warnFg))),
                            ),
                        ] else
                          Text('Not yet recorded for this date.',
                              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                      ]),
                    ),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  SectionTitle('Students (${snap.data!.students.length})'),
                  if (snap.data!.students.isEmpty)
                    Text('No students matched to this class yet.',
                        style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted)))
                  else
                    for (final st in snap.data!.students)
                      Card(
                        margin: const EdgeInsets.only(bottom: 6),
                        child: ListTile(
                          dense: true,
                          title: Text(st.name),
                          trailing: StatusBadge(_attendanceLabels[st.status] ?? st.status),
                        ),
                      ),
                ],
                const SizedBox(height: AppSpace.s4),
                Row(children: [
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: widget.onDelete,
                      icon: const Icon(Icons.delete_outline),
                      label: const Text('Remove'),
                    ),
                  ),
                  const SizedBox(width: AppSpace.s2),
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: widget.onEdit,
                      icon: const Icon(Icons.edit_outlined),
                      label: const Text('Edit'),
                    ),
                  ),
                ]),
              ],
            );
          },
        ),
      ),
    );
  }
}
