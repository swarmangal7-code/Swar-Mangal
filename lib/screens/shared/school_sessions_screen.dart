import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../state/sync_manager.dart';
import '../../widgets/atoms.dart';
import '../shell/shell_nav.dart';

/// Academy > School Sessions: mark teacher attendance for lectures delivered
/// at partner schools, maintain the recurring timetable of who goes
/// where/when, and see who is already assigned to a school (read from
/// school_compensation — no separate roster table). Three tabs mirror the
/// web SchoolSessionsView.
class SchoolSessionsScreen extends StatefulWidget {
  const SchoolSessionsScreen({super.key});
  @override
  State<SchoolSessionsScreen> createState() => _SchoolSessionsScreenState();
}

class _SchoolSessionsScreenState extends State<SchoolSessionsScreen>
    with SingleTickerProviderStateMixin, SyncAware {
  @override
  Set<String> get syncEntities => const {'schoolSessions'};

  @override
  Future<void> reloadFromSync() => _loadAll();

  late final TabController _tab = TabController(length: 3, vsync: this);

  List<School> _schools = const [];
  String _schoolId = '';
  late String _branch;
  bool _schoolsLoading = true;

  List<Map<String, dynamic>> _sessions = const [];
  bool _sessionsLoading = false;
  String? _sessionsError;
  DateTime _date = DateTime.now();
  final Set<String> _marking = {};

  List<Map<String, dynamic>> _slots = const [];
  bool _slotsLoading = false;
  String? _slotsError;

  List<Map<String, dynamic>> _roster = const [];
  bool _rosterLoading = false;
  String? _rosterError;

  List<Teacher> _teachers = const [];

  List<String> get _branches {
    final b = context.read<AuthProvider>().branches;
    return b.isEmpty ? const ['GOREGAON', 'KANDIVALI'] : b;
  }

  static DateTime get _today {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  String get _dateStr =>
      '${_date.year}-${_date.month.toString().padLeft(2, '0')}-${_date.day.toString().padLeft(2, '0')}';

  @override
  void initState() {
    super.initState();
    _branch = 'ALL';
    _loadSchools();
    _loadTeachers();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_branches.length == 1) _branch = _branches.first;
  }

  Future<void> _loadSchools() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final rows = await auth.service!.listSchools();
      if (!mounted) return;
      setState(() {
        _schools = rows.where((s) => s.active).toList();
        _schoolsLoading = false;
        if (_schoolId.isEmpty && _schools.isNotEmpty) _schoolId = _schools.first.schoolId;
      });
      await _loadAll();
    } on ApiException {
      if (mounted) setState(() => _schoolsLoading = false);
    } on ApiUnreachable {
      if (mounted) setState(() => _schoolsLoading = false);
    }
  }

  Future<void> _loadTeachers() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final rows = await auth.service!.listTeachers();
      if (!mounted) return;
      setState(() => _teachers =
          rows.where((t) => !['INACTIVE', 'LEFT'].contains(t.status.toUpperCase())).toList());
    } on ApiException {
      // Non-fatal: the slot form falls back to free text if this fails.
    } on ApiUnreachable {
      // same
    }
  }

  Future<void> _loadAll() async {
    await Future.wait([_loadSessions(), _loadSlots(), _loadRoster()]);
  }

  Future<void> _loadSessions() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _sessionsLoading = true;
      _sessionsError = null;
    });
    try {
      final res = await auth.service!.todaysSchoolSessions(
        date: _dateStr,
        branch: _branch,
        schoolId: _schoolId,
      );
      final rows = ((res as Map)['sessions'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (!mounted) return;
      setState(() {
        _sessions = rows;
        _sessionsLoading = false;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() { _sessionsError = e.message; _sessionsLoading = false; });
    } on ApiUnreachable catch (e) {
      if (mounted) setState(() { _sessionsError = e.message; _sessionsLoading = false; });
    }
  }

  Future<void> _loadSlots() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _slotsLoading = true;
      _slotsError = null;
    });
    try {
      final res = await auth.service!.listSchoolTimetable(branch: _branch, schoolId: _schoolId);
      final rows = ((res as Map)['entries'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (!mounted) return;
      setState(() {
        _slots = rows;
        _slotsLoading = false;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() { _slotsError = e.message; _slotsLoading = false; });
    } on ApiUnreachable catch (e) {
      if (mounted) setState(() { _slotsError = e.message; _slotsLoading = false; });
    }
  }

  Future<void> _loadRoster() async {
    if (_schoolId.isEmpty) {
      setState(() => _roster = const []);
      return;
    }
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _rosterLoading = true;
      _rosterError = null;
    });
    try {
      final res = await auth.service!.schoolTeacherRoster(_schoolId);
      final rows = ((res as Map)['teachers'] as List? ?? const [])
          .whereType<Map<String, dynamic>>()
          .toList();
      if (!mounted) return;
      setState(() {
        _roster = rows;
        _rosterLoading = false;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() { _rosterError = e.message; _rosterLoading = false; });
    } on ApiUnreachable catch (e) {
      if (mounted) setState(() { _rosterError = e.message; _rosterLoading = false; });
    }
  }

  Future<String?> _askBackdatedReason(String date) async {
    final ctrl = TextEditingController();
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Why is $date being entered late?'),
        content: TextField(
          controller: ctrl,
          autofocus: true,
          maxLines: 2,
          decoration: const InputDecoration(hintText: 'Reason (required)'),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          FilledButton(
            onPressed: () => ctrl.text.trim().isEmpty ? null : Navigator.pop(ctx, ctrl.text.trim()),
            child: const Text('Continue'),
          ),
        ],
      ),
    );
  }

  Future<void> _mark(Map<String, dynamic> row, String status) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final slotId = '${row['schoolTimetableId']}';
    String? backdatedReason;
    if (_dateStr != _todayIso()) {
      backdatedReason = await _askBackdatedReason(_dateStr);
      if (backdatedReason == null || !mounted) return;
    }
    if (_marking.contains(slotId)) return;
    setState(() => _marking.add(slotId));
    try {
      await auth.service!.markSchoolAttendance({
        'schoolTimetableId': slotId,
        'status': status,
        'date': _dateStr,
        if (backdatedReason != null) 'backdatedReason': backdatedReason,
      });
      if (!mounted) return;
      await _loadSessions();
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(content: Text('${row['teacherName']} → $status')));
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } finally {
      if (mounted) setState(() => _marking.remove(slotId));
    }
  }

  String _todayIso() {
    final n = _today;
    return '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
  }

  Future<void> _openSlotForm({Map<String, dynamic>? slot}) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _SlotFormDialog(
        schoolId: _schoolId,
        branch: _branch == 'ALL' ? _branches.first : _branch,
        branches: _branches,
        teachers: _teachers,
        slot: slot,
      ),
    );
    if (saved == true && mounted) await _loadSlots();
  }

  @override
  Widget build(BuildContext context) {
    if (_schoolsLoading) return const Center(child: CircularProgressIndicator());
    return Column(children: [
      _schoolAndBranchPicker(),
      TabBar(
        controller: _tab,
        labelColor: AppColors.adaptive(context, AppColors.primary),
        tabs: const [Tab(text: 'Today'), Tab(text: 'Timetable'), Tab(text: 'Teachers')],
      ),
      Expanded(
        child: TabBarView(controller: _tab, children: [
          _todayTab(),
          _timetableTab(),
          _teachersTab(),
        ]),
      ),
    ]);
  }

  Widget _schoolAndBranchPicker() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(AppSpace.s4, AppSpace.s3, AppSpace.s4, 0),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        if (_branches.length > 1)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpace.s2),
            child: Wrap(spacing: AppSpace.s2, children: [
              ChoiceChip(
                label: const Text('All branches'),
                selected: _branch == 'ALL',
                onSelected: (_) {
                  setState(() => _branch = 'ALL');
                  _loadAll();
                },
              ),
              for (final b in _branches)
                ChoiceChip(
                  label: Text(b),
                  selected: _branch == b,
                  onSelected: (_) {
                    setState(() => _branch = b);
                    _loadAll();
                  },
                ),
            ]),
          ),
        DropdownButtonFormField<String>(
          initialValue: _schoolId.isEmpty ? null : _schoolId,
          decoration: const InputDecoration(labelText: 'School'),
          items: [
            for (final s in _schools)
              DropdownMenuItem(value: s.schoolId, child: Text(s.name.isNotEmpty ? s.name : s.code)),
          ],
          onChanged: (v) {
            if (v == null) return;
            setState(() => _schoolId = v);
            _loadAll();
          },
        ),
      ]),
    );
  }

  Widget _todayTab() {
    return RefreshScaffold(
      onRefresh: _loadSessions,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpace.s4, AppSpace.s3, AppSpace.s4, 96),
        children: [
          Row(children: [
            IconButton(
              icon: const Icon(Icons.chevron_left),
              onPressed: () {
                setState(() => _date = _date.subtract(const Duration(days: 1)));
                _loadSessions();
              },
            ),
            Expanded(
              child: TextButton(
                onPressed: () async {
                  final d = await showDatePicker(
                    context: context,
                    initialDate: _date,
                    firstDate: DateTime(2020),
                    lastDate: _today,
                  );
                  if (d != null && mounted) {
                    setState(() => _date = d);
                    _loadSessions();
                  }
                },
                child: Text(_dateStr,
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.ink))),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.chevron_right),
              onPressed: _date.isBefore(_today) ? () {
                final next = _date.add(const Duration(days: 1));
                if (next.isAfter(_today)) return;
                setState(() => _date = next);
                _loadSessions();
              } : null,
            ),
          ]),
          if (_sessionsError != null)
            ErrorView(_sessionsError!, onRetry: _loadSessions, compact: true)
          else if (_sessionsLoading)
            const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: Center(child: CircularProgressIndicator()))
          else if (_schoolId.isEmpty)
            const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: EmptyState('Pick a school to see its sessions.'))
          else if (_sessions.isEmpty)
            const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: EmptyState('No sessions on this day.'))
          else
            for (final row in _sessions) _sessionCard(row),
        ],
      ),
    );
  }

  Widget _sessionCard(Map<String, dynamic> row) {
    final slotId = '${row['schoolTimetableId']}';
    final busy = _marking.contains(slotId);
    final status = '${row['status']}';
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.s3),
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${row['teacherName']}${(row['subject'] ?? '').toString().isNotEmpty ? ' · ${row['subject']}' : ''}',
              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          Text('${row['startTime']} – ${row['endTime']} · ${row['branch']}',
              style: const TextStyle(fontSize: 12, color: AppColors.muted)),
          const SizedBox(height: AppSpace.s2),
          Row(children: [
            StatusBadge(status == 'NOT_MARKED' ? 'UNANSWERED' : status),
            const Spacer(),
            if (busy)
              const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
            else ...[
              _markChip('P', status == 'PRESENT', AppColors.okFg, () => _mark(row, 'PRESENT')),
              const SizedBox(width: AppSpace.s2),
              _markChip('A', status == 'ABSENT', AppColors.blockFg, () => _mark(row, 'ABSENT')),
              const SizedBox(width: AppSpace.s2),
              _markChip('C', status == 'CANCELLED', AppColors.warnFg, () => _mark(row, 'CANCELLED')),
            ],
          ]),
        ]),
      ),
    );
  }

  Widget _markChip(String label, bool active, Color color, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: 28,
        height: 28,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active ? color : color.withValues(alpha: .12),
          shape: BoxShape.circle,
        ),
        child: Text(label,
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: active ? Colors.white : color)),
      ),
    );
  }

  Widget _timetableTab() {
    return RefreshScaffold(
      onRefresh: _loadSlots,
      child: Stack(children: [
        ListView(
          padding: const EdgeInsets.fromLTRB(AppSpace.s4, AppSpace.s3, AppSpace.s4, 96),
          children: [
            if (_slotsError != null)
              ErrorView(_slotsError!, onRetry: _loadSlots, compact: true)
            else if (_slotsLoading)
              const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: Center(child: CircularProgressIndicator()))
            else if (_schoolId.isEmpty)
              const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: EmptyState('Pick a school to see its timetable.'))
            else if (_slots.isEmpty)
              const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: EmptyState('No slots yet. Add the first one.'))
            else
              for (final slot in _slots) _slotCard(slot),
          ],
        ),
        Positioned(
          right: AppSpace.s4,
          bottom: AppSpace.s4,
          child: FloatingActionButton(
            backgroundColor: AppColors.primary,
            foregroundColor: Colors.white,
            onPressed: _schoolId.isEmpty ? null : () => _openSlotForm(),
            child: const Icon(Icons.add),
          ),
        ),
      ]),
    );
  }

  static const _dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  Widget _slotCard(Map<String, dynamic> slot) {
    final dow = (slot['dayOfWeek'] as num?)?.toInt() ?? 0;
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.s3),
      child: ListTile(
        onTap: () => _openSlotForm(slot: slot),
        title: Text('${_dayLabels[dow.clamp(0, 6)]} · ${slot['startTime']} – ${slot['endTime']}',
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
        subtitle: Text('${slot['teacherName']}${(slot['subject'] ?? '').toString().isNotEmpty ? ' · ${slot['subject']}' : ''} · ${slot['branch']}'),
        trailing: StatusBadge('${slot['status']}'),
      ),
    );
  }

  Widget _teachersTab() {
    return RefreshScaffold(
      onRefresh: _loadRoster,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpace.s4, AppSpace.s3, AppSpace.s4, 96),
        children: [
          Align(
            alignment: Alignment.centerRight,
            child: TextButton.icon(
              onPressed: () => ShellNavigator.of(context).go('teachers'),
              icon: const Icon(Icons.person_add_alt_1_outlined, size: 18),
              label: const Text('Add teacher'),
            ),
          ),
          if (_rosterError != null)
            ErrorView(_rosterError!, onRetry: _loadRoster, compact: true)
          else if (_rosterLoading)
            const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: Center(child: CircularProgressIndicator()))
          else if (_schoolId.isEmpty)
            const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: EmptyState('Pick a school to see its assigned teachers.'))
          else if (_roster.isEmpty)
            const Padding(padding: EdgeInsets.only(top: AppSpace.s6), child: EmptyState('No teachers assigned to this school yet.'))
          else
            for (final t in _roster)
              Card(
                margin: const EdgeInsets.only(bottom: AppSpace.s3),
                child: ListTile(
                  title: Text('${t['teacherName']}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  subtitle: Text([t['courses'], t['instrument'], t['phone']]
                      .map((v) => '$v')
                      .where((v) => v.isNotEmpty)
                      .join(' · ')),
                  trailing: StatusBadge('${t['status'] ?? 'ACTIVE'}'),
                ),
              ),
        ],
      ),
    );
  }
}

class _SlotFormDialog extends StatefulWidget {
  const _SlotFormDialog({
    required this.schoolId,
    required this.branch,
    required this.branches,
    required this.teachers,
    this.slot,
  });
  final String schoolId;
  final String branch;
  final List<String> branches;
  final List<Teacher> teachers;
  final Map<String, dynamic>? slot;

  @override
  State<_SlotFormDialog> createState() => _SlotFormDialogState();
}

class _SlotFormDialogState extends State<_SlotFormDialog> {
  late String _branch = widget.slot?['branch'] ?? widget.branch;
  late int _dayOfWeek = (widget.slot?['dayOfWeek'] as num?)?.toInt() ?? 0;
  final _startTime = TextEditingController();
  final _endTime = TextEditingController();
  final _subject = TextEditingController();
  String _teacherId = '';
  String _teacherName = '';
  String _status = 'ACTIVE';
  bool _saving = false;

  static const _dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  @override
  void initState() {
    super.initState();
    final slot = widget.slot;
    _startTime.text = slot?['startTime'] ?? '09:00';
    _endTime.text = slot?['endTime'] ?? '10:00';
    _subject.text = slot?['subject'] ?? '';
    _teacherId = slot?['teacherId'] ?? '';
    _teacherName = slot?['teacherName'] ?? '';
    _status = slot?['status'] ?? 'ACTIVE';
  }

  Future<void> _save() async {
    if (_teacherId.isEmpty || _startTime.text.trim().isEmpty || _endTime.text.trim().isEmpty) return;
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() => _saving = true);
    final form = {
      'branch': _branch,
      'schoolId': widget.schoolId,
      'dayOfWeek': _dayOfWeek,
      'startTime': _startTime.text.trim(),
      'endTime': _endTime.text.trim(),
      'teacherId': _teacherId,
      'teacherName': _teacherName,
      'subject': _subject.text.trim(),
      'status': _status,
    };
    try {
      if (widget.slot != null) {
        await auth.service!.updateSchoolTimetableSlot('${widget.slot!['id']}', form);
      } else {
        await auth.service!.addSchoolTimetableSlot(form);
      }
      if (!mounted) return;
      Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.slot != null ? 'Edit school session' : 'Add school session'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          if (widget.branches.length > 1)
            DropdownButtonFormField<String>(
              initialValue: _branch,
              decoration: const InputDecoration(labelText: 'Branch'),
              items: [for (final b in widget.branches) DropdownMenuItem(value: b, child: Text(b))],
              onChanged: (v) => setState(() => _branch = v ?? _branch),
            ),
          DropdownButtonFormField<int>(
            initialValue: _dayOfWeek,
            decoration: const InputDecoration(labelText: 'Day of week'),
            items: [for (var i = 0; i < 7; i++) DropdownMenuItem(value: i, child: Text(_dayLabels[i]))],
            onChanged: (v) => setState(() => _dayOfWeek = v ?? 0),
          ),
          TextField(controller: _startTime, decoration: const InputDecoration(labelText: 'Start time (HH:mm)')),
          TextField(controller: _endTime, decoration: const InputDecoration(labelText: 'End time (HH:mm)')),
          DropdownButtonFormField<String>(
            initialValue: _teacherId.isEmpty ? null : _teacherId,
            decoration: const InputDecoration(labelText: 'Teacher'),
            items: [
              for (final t in widget.teachers)
                DropdownMenuItem(value: t.teacherId, child: Text(t.teacherName)),
            ],
            onChanged: (v) {
              final t = widget.teachers.where((t) => t.teacherId == v).toList();
              setState(() {
                _teacherId = v ?? '';
                _teacherName = t.isNotEmpty ? t.first.teacherName : _teacherName;
              });
            },
          ),
          TextField(controller: _subject, decoration: const InputDecoration(labelText: 'Subject (optional)')),
          if (widget.slot != null)
            DropdownButtonFormField<String>(
              initialValue: _status,
              decoration: const InputDecoration(labelText: 'Status'),
              items: const [
                DropdownMenuItem(value: 'ACTIVE', child: Text('Active')),
                DropdownMenuItem(value: 'INACTIVE', child: Text('Inactive')),
              ],
              onChanged: (v) => setState(() => _status = v ?? 'ACTIVE'),
            ),
        ]),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _saving || _teacherId.isEmpty ? null : _save,
          child: _saving
              ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(widget.slot != null ? 'Save' : 'Add'),
        ),
      ],
    );
  }
}
