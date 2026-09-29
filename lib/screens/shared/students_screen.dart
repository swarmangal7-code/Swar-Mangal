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
  List<String> _classCodes = const ['GMC', 'KMC'];

  @override
  void initState() {
    super.initState();
    _classCodes = context.read<AuthProvider>().boot?.classCodes.isNotEmpty == true
        ? context.read<AuthProvider>().boot!.classCodes
        : const ['GMC', 'KMC'];
    // Loads the full roster immediately, same as the web app — no extra tap
    // should be needed just to see who's already there.
    _search();
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
              branch: auth.branch ?? 'ALL')
          : await auth.service!.searchStudents(_q.text, classCode: _classFilter);
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
            _q.text.isEmpty && _classFilter == 'ALL'
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