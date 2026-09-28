import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';
import 'teacher_attendance_screen.dart';
import 'teacher_profile_screen.dart';

/// Teacher master. Founder: full list + add + status. Staff: read-only list
/// via the branch-validated endpoint.
class TeachersScreen extends StatefulWidget {
  const TeachersScreen({super.key, required this.staff});
  final bool staff;
  @override
  State<TeachersScreen> createState() => _TeachersScreenState();
}

class _TeachersScreenState extends State<TeachersScreen> {
  List<Teacher> _rows = [];
  bool _busy = true;
  String? _error;

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
      final rows = await auth.service!.listTeachers();
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
    if (_busy && _rows.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null && _rows.isEmpty) return ErrorView(_error!, onRetry: _load);
    return RefreshScaffold(
      onRefresh: _load,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.all(AppSpace.s4),
          child: Row(children: [
            Text('${_rows.length} teachers',
                style: const TextStyle(fontWeight: FontWeight.w800)),
            const Spacer(),
            IconButton(
              tooltip: 'Attendance',
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => Scaffold(appBar: AppBar(title: const Text('Teacher Attendance')), body: const TeacherAttendanceScreen()),
              )),
              icon: const Icon(Icons.fact_check_outlined, size: 20),
            ),
            TextButton.icon(
              onPressed: () => _addTeacher(context),
              icon: const Icon(Icons.person_add, size: 18),
              label: Text(widget.staff ? 'Request' : 'Add'),
            ),
          ]),
        ),
        Expanded(
          child: _rows.isEmpty
              ? const EmptyState('No teachers in the master yet.', icon: Icons.group_outlined)
              : ListView.separated(
                  padding: const EdgeInsets.only(bottom: AppSpace.s6),
                  itemCount: _rows.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (c, i) => _row(_rows[i]),
                ),
        ),
      ]),
    );
  }

  Widget _row(Teacher t) {
    return InkWell(
      onTap: () => Navigator.of(context).push(MaterialPageRoute(
        builder: (_) => TeacherProfileScreen(teacherId: t.teacherId, staff: widget.staff),
      )),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: AppSpace.s3),
        child: Row(children: [
          CircleAvatar(
            radius: 20,
            backgroundColor: AppColors.adaptive(context, AppColors.primary).withValues(alpha: .08),
            child: Text(t.teacherName.isNotEmpty ? t.teacherName[0].toUpperCase() : '?',
                style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.adaptive(context, AppColors.primary))),
          ),
          const SizedBox(width: AppSpace.s3),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Flexible(
                  child: Text(t.teacherName,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                ),
                if (t.shareLabel.isNotEmpty) ...[
                  const SizedBox(width: AppSpace.s2),
                  TagChip(t.shareLabel, color: AppColors.adaptive(context, AppColors.focus)),
                ],
                if (t.profileIncomplete) ...[
                  const SizedBox(width: AppSpace.s2),
                  TagChip('Incomplete', color: AppColors.adaptive(context, AppColors.warnFg)),
                ],
              ]),
              if (t.primaryRole.isNotEmpty)
                Text(t.primaryRole, style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
              Text(
                  [t.branchClassCode, t.phone].where((e) => e.isNotEmpty).join(' · '),
                  style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
              if (t.profileIncomplete)
                Text('Missing: ${t.missingFields.join(', ')}', style: TextStyle(fontSize: 11, color: AppColors.adaptive(context, AppColors.warnFg))),
            ]),
          ),
          StatusBadge(t.status.isEmpty ? 'UNKNOWN' : t.status),
          if (!widget.staff)
            PopupMenuButton<String>(
              icon: Icon(Icons.more_vert, size: 20, color: AppColors.adaptive(context, AppColors.muted)),
              onSelected: (v) => _setStatus(t, v),
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'ACTIVE', child: Text('Set ACTIVE')),
                PopupMenuItem(value: 'INACTIVE', child: Text('Set INACTIVE')),
                PopupMenuItem(value: 'HOLD', child: Text('Set HOLD')),
              ],
            ),
        ]),
      ),
    );
  }

  Future<void> _setStatus(Teacher t, String status) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final reason = await _askReason('${t.teacherName} → $status', 'Reason (required, stored in audit)');
    if (reason == null || reason.trim().isEmpty) return;
    setState(() => _busy = true);
    try {
      final r = await auth.service!.founderUpdateTeacherStatus(t.teacherId, status, reason);
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text(m['ok'] == true
                ? '${t.teacherName} → $status'
                : (m['error'] ?? 'Could not change status'))));
      await _load();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() => _busy = false);
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  Future<String?> _askReason(String title, String label) {
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

  void _addTeacher(BuildContext context) {
    final name = TextEditingController();
    final phone = TextEditingController();
    final role = TextEditingController();
    final err = ValueNotifier<String?>(null);
    final busy = ValueNotifier(false);
    final staff = widget.staff;
    final intentKey = 'TCHREQ-${DateTime.now().microsecondsSinceEpoch}';
    final instrumentOptions = ValueNotifier<List<String>?>(null);
    final selectedInstrument = ValueNotifier<String?>(null);
    final addingInstrument = ValueNotifier<bool>(false);
    final newInstrumentCtrl = TextEditingController();
    final instrumentErr = ValueNotifier<String?>(null);

    Future<void> loadInstruments() async {
      try {
        final r = await context.read<AuthProvider>().service!.raw('api_listInstruments', {});
        final m = r as Map<String, dynamic>;
        final list = ((m['instruments'] as List?) ?? const [])
            .map((e) => (e as Map)['name'].toString())
            .toList();
        instrumentOptions.value = list;
      } catch (_) {
        instrumentOptions.value = const [];
      }
    }

    loadInstruments();

    Future<void> addNewInstrument(BuildContext dialogCtx) async {
      final name0 = newInstrumentCtrl.text.trim();
      if (name0.isEmpty) return;
      instrumentErr.value = null;
      try {
        final auth = dialogCtx.read<AuthProvider>();
        final r = await auth.service!.raw('api_addInstrument', {'name': name0});
        final m = r as Map<String, dynamic>;
        if (m['ok'] != true) {
          instrumentErr.value = (m['error'] ?? 'Could not add instrument.').toString();
          return;
        }
        final added = ((m['instrument'] as Map?)?['name'] ?? name0).toString();
        instrumentOptions.value = [...?instrumentOptions.value, added]..sort();
        selectedInstrument.value = added;
        role.text = added;
        addingInstrument.value = false;
        newInstrumentCtrl.clear();
      } on ApiException catch (e) {
        instrumentErr.value = e.message;
      }
    }

    showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(staff ? 'Request a new teacher' : 'Add teacher'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: name, decoration: const InputDecoration(labelText: 'Teacher name *')),
          const SizedBox(height: AppSpace.s3),
          TextField(controller: phone, decoration: const InputDecoration(labelText: 'Phone'), keyboardType: TextInputType.phone),
          const SizedBox(height: AppSpace.s3),
          ValueListenableBuilder<bool>(
            valueListenable: addingInstrument,
            builder: (_, adding, _) {
              if (adding) {
                return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  TextField(
                    controller: newInstrumentCtrl,
                    autofocus: true,
                    decoration: const InputDecoration(labelText: 'New instrument name'),
                  ),
                  ValueListenableBuilder<String?>(
                    valueListenable: instrumentErr,
                    builder: (_, e, _) => e == null
                        ? const SizedBox.shrink()
                        : Padding(
                            padding: const EdgeInsets.only(top: 4),
                            child: Text(e, style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg), fontSize: 12)),
                          ),
                  ),
                  const SizedBox(height: AppSpace.s2),
                  Row(mainAxisAlignment: MainAxisAlignment.end, children: [
                    TextButton(
                      onPressed: () {
                        addingInstrument.value = false;
                        instrumentErr.value = null;
                        newInstrumentCtrl.clear();
                      },
                      child: const Text('Cancel'),
                    ),
                    FilledButton(onPressed: () => addNewInstrument(ctx), child: const Text('Add')),
                  ]),
                ]);
              }
              return ValueListenableBuilder<List<String>?>(
                valueListenable: instrumentOptions,
                builder: (_, options, _) => ValueListenableBuilder<String?>(
                  valueListenable: selectedInstrument,
                  builder: (_, selected, _) => DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: selected,
                    decoration: const InputDecoration(labelText: 'Primary instrument / role'),
                    hint: Text(options == null ? 'Loading…' : 'Select an instrument'),
                    items: [
                      ...?options?.map((o) => DropdownMenuItem(value: o, child: Text(o))),
                      const DropdownMenuItem(value: '__add_new__', child: Text('+ Add new instrument…')),
                    ],
                    onChanged: (v) {
                      if (v == null) return;
                      if (v == '__add_new__') {
                        addingInstrument.value = true;
                        return;
                      }
                      selectedInstrument.value = v;
                      role.text = v;
                    },
                  ),
                ),
              );
            },
          ),
          if (staff) ...[
            const SizedBox(height: AppSpace.s3),
            Text('Sent to Sharvil for approval — not added until approved.', style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
          ],
          const SizedBox(height: AppSpace.s3),
          ValueListenableBuilder<String?>(
            valueListenable: err,
            builder: (_, e, _) => e == null
                ? const SizedBox.shrink()
                : Text(e, style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg), fontSize: 13)),
          ),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ValueListenableBuilder<bool>(
            valueListenable: busy,
            builder: (_, b, _) => FilledButton(
              onPressed: b
                  ? null
                  : () async {
                      if (name.text.trim().isEmpty) {
                        err.value = 'Teacher name is required';
                        return;
                      }
                      busy.value = true;
                      final auth = context.read<AuthProvider>();
                      try {
                        final r = staff
                            ? await auth.service!.requestAddTeacher({
                                'teacherName': name.text.trim(),
                                'phone': phone.text.trim(),
                                'primaryRole': role.text.trim(),
                                'clientIntentKey': intentKey,
                              })
                            : await auth.service!.addTeacher({
                                'teacherName': name.text.trim(),
                                'phone': phone.text.trim(),
                                'primaryRole': role.text.trim(),
                              });
                        final m = r as Map<String, dynamic>;
                        if (m['ok'] != true) {
                          err.value = (m['error'] ?? 'Could not add.').toString();
                        } else {
                          if (!ctx.mounted) return;
                          Navigator.pop(ctx);
                          if (staff && ctx.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text((m['note'] ?? 'Sent to Sharvil for approval.').toString())));
                          }
                          _load();
                        }
                      } on ApiException catch (e) {
                        err.value = e.message;
                      } finally {
                        busy.value = false;
                      }
                    },
              child: Text(staff ? 'Send request' : 'Add teacher'),
            ),
          ),
        ],
      ),
    );
  }
}