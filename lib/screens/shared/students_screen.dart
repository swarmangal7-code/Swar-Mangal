import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/sync_manager.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';
import 'student_profile_screen.dart';
import 'add_student_screen.dart';
import 'new_enrollments_screen.dart';

/// Student search + directory. `staff` flips the API to the branch-isolated
/// staff search endpoint and adds an inline "quick add" entry.
class StudentsScreen extends StatefulWidget {
  const StudentsScreen({super.key, required this.staff});
  final bool staff;
  @override
  State<StudentsScreen> createState() => _StudentsScreenState();
}

class _StudentsScreenState extends State<StudentsScreen> with SyncAware {
  @override
  Set<String> get syncEntities => const {'students'};

  @override
  Future<void> reloadFromSync() => _search();

  final _q = TextEditingController();
  List<Student> _rows = [];
  bool _busy = false;
  String? _error;
  String _classFilter = 'ALL';
  String _instrumentFilter = 'ALL';
  String _teacherFilter = 'ALL';
  String _feeFilter = 'ALL';
  List<String> _classCodes = const ['GMC', 'KMC'];
  List<String> _instruments = [];
  List<Teacher> _teachers = [];

  static const _feeFilters = ['ALL', 'PAID', 'DUE', 'OVERDUE'];
  static const _feeFilterLabels = {'ALL': 'All', 'PAID': 'Paid', 'DUE': 'Due', 'OVERDUE': 'Overdue'};

  bool get _hasFilters => _classFilter != 'ALL' || _instrumentFilter != 'ALL' || _teacherFilter != 'ALL' || _feeFilter != 'ALL';

  @override
  void initState() {
    super.initState();
    _classCodes = context.read<AuthProvider>().boot?.classCodes.isNotEmpty == true
        ? context.read<AuthProvider>().boot!.classCodes
        : const ['GMC', 'KMC'];
    // Loads the full roster immediately, same as the web app — no extra tap
    // should be needed just to see who's already there.
    _search();
    _loadFilterSources();
  }

  Future<void> _loadFilterSources() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final results = await Future.wait([auth.service!.listInstruments(), auth.service!.listTeachers()]);
      if (!mounted) return;
      setState(() {
        _instruments = results[0] as List<String>;
        _teachers = results[1] as List<Teacher>;
      });
    } catch (_) {
      // Filter dropdowns are a convenience — a failure here shouldn't block
      // the roster itself, which already loaded via _search().
    }
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final rows = widget.staff
          ? await auth.service!.staffSearchStudents(_q.text,
              branch: auth.branch ?? 'ALL',
              instrument: _instrumentFilter,
              teacherId: _teacherFilter,
              feeState: _feeFilter)
          : await auth.service!.searchStudents(_q.text,
              classCode: _classFilter,
              instrument: _instrumentFilter,
              teacherId: _teacherFilter,
              feeState: _feeFilter);
      if (!mounted) return;
      setState(() {
        _rows = rows;
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
    return RefreshScaffold(
      onRefresh: _search,
      child: Column(
        children: [
          // Search + class chips are ALWAYS visible at the top.
          Padding(
            padding: const EdgeInsets.fromLTRB(AppSpace.s4, AppSpace.s4, AppSpace.s4, 0),
            child: Column(children: [
              Align(
                alignment: Alignment.centerRight,
                child: OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const NewEnrollmentsScreen())),
                  icon: const Icon(Icons.person_add_alt_outlined, size: 16),
                  label: const Text('New Enrollments'),
                ),
              ),
              const SizedBox(height: AppSpace.s3),
              SearchField(
                controller: _q,
                hint: widget.staff
                    ? 'Name, phone or student ID'
                    : 'Search by name, phone, ID, instrument',
                onChanged: (_) {
                  if (_q.text.isEmpty) setState(() => _rows = []);
                },
                trailingIcon: Icons.arrow_forward,
              ),
              if (!widget.staff) ...[
                const SizedBox(height: AppSpace.s3),
                Row(children: [
                  for (final c in _classCodes)
                    Padding(
                      padding: const EdgeInsets.only(right: AppSpace.s2),
                      child: ChoiceChip(
                        label: Text(c),
                        selected: _classFilter == c,
                        onSelected: (_) {
                          setState(() => _classFilter = c);
                          _search();
                        },
                      ),
                    ),
                  const Spacer(),
                  TextButton.icon(
                    onPressed: _search,
                    icon: const Icon(Icons.search, size: 16),
                    label: const Text('Search'),
                  ),
                ]),
              ],
              const SizedBox(height: AppSpace.s3),
              _filterRow(),
              if (_rows.isNotEmpty) ...[
                const SizedBox(height: AppSpace.s2),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('${_rows.length} student${_rows.length == 1 ? '' : 's'}',
                      style: const TextStyle(fontSize: 12, color: AppColors.muted, fontWeight: FontWeight.w600)),
                ),
              ],
            ]),
          ),
          Expanded(
            child: _busy && _rows.isEmpty
                ? const SkeletonList(rows: 7)
                : _error != null && _rows.isEmpty
                    ? ErrorView(_error!, onRetry: _search)
                    : _rows.isEmpty
                        ? _initialHint()
                        : ListView.separated(
                            padding: const EdgeInsets.only(bottom: AppSpace.s6, top: AppSpace.s2),
                            itemCount: _rows.length,
                            separatorBuilder: (_, _) => const Divider(height: 1),
                            itemBuilder: (c, i) => _row(_rows[i]),
                          ),
          ),
        ],
      ),
    );
  }

  Widget _filterRow() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(children: [
        DropdownButton<String>(
          value: _instrumentFilter,
          underline: const SizedBox.shrink(),
          items: [
            const DropdownMenuItem(value: 'ALL', child: Text('All instruments')),
            for (final i in _instruments) DropdownMenuItem(value: i, child: Text(i)),
          ],
          onChanged: (v) {
            if (v == null) return;
            setState(() => _instrumentFilter = v);
            _search();
          },
        ),
        const SizedBox(width: AppSpace.s3),
        DropdownButton<String>(
          value: _teacherFilter,
          underline: const SizedBox.shrink(),
          items: [
            const DropdownMenuItem(value: 'ALL', child: Text('All teachers')),
            for (final t in _teachers) DropdownMenuItem(value: t.teacherId, child: Text(t.teacherName)),
          ],
          onChanged: (v) {
            if (v == null) return;
            setState(() => _teacherFilter = v);
            _search();
          },
        ),
        const SizedBox(width: AppSpace.s3),
        for (final f in _feeFilters)
          Padding(
            padding: const EdgeInsets.only(right: AppSpace.s2),
            child: ChoiceChip(
              label: Text(_feeFilterLabels[f]!),
              selected: _feeFilter == f,
              onSelected: (_) {
                setState(() => _feeFilter = f);
                _search();
              },
            ),
          ),
      ]),
    );
  }

  Widget _initialHint() {
    // The roster loads automatically on open, so an empty list here means a
    // search/filter genuinely matched nothing — not that nobody has looked yet.
    return ListView(children: [
      Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: Column(children: [
          const Icon(Icons.person_search_outlined,
              size: 40, color: AppColors.muted),
          const SizedBox(height: AppSpace.s3),
          Text(
            _q.text.isEmpty && !_hasFilters
                ? 'No students yet.'
                : 'No students match this search.',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.muted),
          ),
        ]),
      ),
    ]);
  }

  Widget _row(Student s) {
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => StudentProfileScreen(student: s, staff: widget.staff),
      )),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: AppSpace.s3),
        child: Row(children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.primary.withValues(alpha: .08),
            child: Text(s.studentName.isNotEmpty ? s.studentName[0].toUpperCase() : '?',
                style: const TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary)),
          ),
          const SizedBox(width: AppSpace.s3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(s.studentName,
                  style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
              const SizedBox(height: 2),
              Text('${s.classCode.isNotEmpty ? s.classCode : '—'} · ${s.instrument.isNotEmpty ? s.instrument : s.studentId} · ${s.phone}',
                  style: const TextStyle(fontSize: 12, color: AppColors.muted)),
              const SizedBox(height: 4),
              Wrap(spacing: AppSpace.s2, children: [
                StatusBadge(s.feeStatus.isEmpty ? 'UNKNOWN' : s.feeStatus),
                if (!s.operational) const StatusBadge('LEFT'),
              ]),
            ]),
          ),
          if (widget.staff)
            IconButton(
              tooltip: 'Edit student',
              icon: const Icon(Icons.edit_outlined, size: 18, color: AppColors.muted),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => AddStudentScreen(staff: true, edit: s),
              )),
            ),
          Icon(Icons.chevron_right, color: AppColors.muted),
        ]),
      ),
    );
  }
}