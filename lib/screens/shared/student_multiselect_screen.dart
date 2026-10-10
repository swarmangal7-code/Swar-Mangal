import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Pick students from the active roster — used to assign a timetable slot's
/// roster and to name who an ad-hoc/make-up session is for. Returns the
/// selected student ids via Navigator.pop, or null if cancelled.
class StudentMultiselectScreen extends StatefulWidget {
  const StudentMultiselectScreen({
    super.key,
    required this.branch,
    this.initiallySelected = const [],
    this.title = 'Select students',
  });
  final String branch;
  final List<String> initiallySelected;
  final String title;

  @override
  State<StudentMultiselectScreen> createState() => _StudentMultiselectScreenState();
}

class _StudentMultiselectScreenState extends State<StudentMultiselectScreen> {
  final _q = TextEditingController();
  List<Student> _rows = [];
  final Set<String> _selected = {};
  bool _busy = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _selected.addAll(widget.initiallySelected);
    _load();
  }

  @override
  void dispose() {
    _q.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final rows = await auth.service!.staffSearchStudents(_q.text, branch: widget.branch);
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
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(_selected.toList()),
            child: Text('Done (${_selected.length})', style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(AppSpace.s4),
          child: SearchField(
            controller: _q,
            hint: 'Name, phone or student ID',
            onChanged: (_) => _load(),
            trailingIcon: Icons.search,
          ),
        ),
        Expanded(
          child: _busy && _rows.isEmpty
              ? const Center(child: CircularProgressIndicator())
              : _error != null && _rows.isEmpty
                  ? ErrorView(_error!, onRetry: _load)
                  : _rows.isEmpty
                      ? const EmptyState('No students match.')
                      : ListView.builder(
                          itemCount: _rows.length,
                          itemBuilder: (c, i) {
                            final s = _rows[i];
                            final checked = _selected.contains(s.studentId);
                            return CheckboxListTile(
                              value: checked,
                              title: Text(s.studentName, style: const TextStyle(fontWeight: FontWeight.w600)),
                              subtitle: Text([s.instrument, s.phone].where((e) => e.isNotEmpty).join(' · ')),
                              onChanged: (v) {
                                setState(() {
                                  if (v == true) {
                                    _selected.add(s.studentId);
                                  } else {
                                    _selected.remove(s.studentId);
                                  }
                                });
                              },
                            );
                          },
                        ),
        ),
      ]),
    );
  }
}
