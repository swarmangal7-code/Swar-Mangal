import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';

/// Founder request 2026-09-28: a trial stage before real admission. Demo
/// students are non-money and low-risk, so either role adds one directly —
/// only converting to a real (fee-paying) admission is founder-gated.
class DemoStudentsScreen extends StatefulWidget {
  const DemoStudentsScreen({super.key, required this.staff, this.inquiryPrefill});
  final bool staff;
  /// Hand-off from an inquiry's "Joined" action: pre-fill the add form.
  final ({String inquiryId, String name, String phone, String instrument})? inquiryPrefill;
  @override
  State<DemoStudentsScreen> createState() => _DemoStudentsScreenState();
}

class _DemoStudentsScreenState extends State<DemoStudentsScreen> {
  List<DemoStudent> _rows = [];
  List<Teacher> _teachers = [];
  bool _busy = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
    if (widget.inquiryPrefill != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _add(prefill: widget.inquiryPrefill));
    }
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
        auth.service!.listDemoStudents(branch: auth.branch ?? 'ALL'),
        auth.service!.listTeachers(),
      ]);
      if (!mounted) return;
      setState(() {
        _rows = results[0] as List<DemoStudent>;
        _teachers = (results[1] as List<Teacher>).where((t) => t.status.toUpperCase() != 'INACTIVE').toList();
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

  Future<void> _add({({String inquiryId, String name, String phone, String instrument})? prefill}) async {
    final saved = await showDialog<String>(
      context: context,
      builder: (_) => _AddDemoForm(teachers: _teachers, prefill: prefill),
    );
    if (saved == null || saved.isEmpty) return;
    // Only a form opened *for the hand-off* hands back. A plain add from the
    // FAB must not close the screen the inquiry pushed.
    if (prefill != null && mounted) {
      Navigator.pop(context, {'convertedStudentId': saved});
      return;
    }
    await _load();
  }

  Future<void> _convert(DemoStudent d) async {
    final saved = await showDialog<bool>(
      context: context,
      builder: (_) => _ConvertDemoForm(demo: d),
    );
    if (saved == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    if (_busy) return const SkeletonList(rows: 6);
    if (_error != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Demo Students')),
        body: Padding(padding: const EdgeInsets.all(AppSpace.s4), child: ErrorView(_error!, onRetry: _load)),
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('Demo Students')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _add(),
        icon: const Icon(Icons.add),
        label: const Text('Add demo student'),
      ),
      body: RefreshScaffold(
        onRefresh: _load,
        child: _rows.isEmpty
            ? const EmptyState('No demo students yet.')
            : ListView(
                padding: const EdgeInsets.all(AppSpace.s4),
                children: [
                  for (final d in _rows) _card(d),
                ],
              ),
      ),
    );
  }

  Widget _card(DemoStudent d) {
    return Card(
      margin: const EdgeInsets.only(bottom: AppSpace.s3),
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Row(children: [
            Expanded(
              child: Text(d.studentName, style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
            ),
            TagChip('DEMO', color: AppColors.adaptive(context, AppColors.focus)),
          ]),
          const SizedBox(height: 4),
          Text('${d.instrument} · ${d.teacherName.isNotEmpty ? d.teacherName : 'No teacher'} · ${d.demoDate} ${d.demoTime}',
              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
          Text('${d.phone} · Guardian: ${d.guardianName} (${d.guardianPhone})',
              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
          if (!widget.staff) ...[
            const SizedBox(height: AppSpace.s2),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton(onPressed: () => _convert(d), child: const Text('Convert to student')),
            ),
          ],
        ]),
      ),
    );
  }
}

class _AddDemoForm extends StatefulWidget {
  const _AddDemoForm({required this.teachers, this.prefill});
  final List<Teacher> teachers;
  final ({String inquiryId, String name, String phone, String instrument})? prefill;
  @override
  State<_AddDemoForm> createState() => _AddDemoFormState();
}

class _AddDemoFormState extends State<_AddDemoForm> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.prefill?.name ?? '');
  late final _phone = TextEditingController(text: widget.prefill?.phone ?? '');
  final _email = TextEditingController();
  final _guardian = TextEditingController();
  final _guardianPhone = TextEditingController();
  late final _instrument = TextEditingController(text: widget.prefill?.instrument ?? '');
  String _teacherId = '';
  late String _demoDate = _todayIso();
  String _demoTime = '17:00';
  bool _busy = false;
  String? _error;

  static String _todayIso() {
    final d = DateTime.now();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _guardian, _guardianPhone, _instrument]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_demoDate) ?? DateTime.now(),
      firstDate: DateTime(2015),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _demoDate =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
    }
  }

  Future<void> _pickTime() async {
    final parts = _demoTime.split(':');
    final picked = await showTimePicker(
      context: context,
      initialTime: TimeOfDay(hour: int.tryParse(parts[0]) ?? 17, minute: int.tryParse(parts.length > 1 ? parts[1] : '0') ?? 0),
    );
    if (picked != null) {
      setState(() => _demoTime = '${picked.hour.toString().padLeft(2, '0')}:${picked.minute.toString().padLeft(2, '0')}');
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_teacherId.isEmpty) {
      setState(() => _error = 'Pick a teacher.');
      return;
    }
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await auth.service!.addDemoStudent({
        'studentName': _name.text.trim(),
        'phone': _phone.text.trim(),
        'email': _email.text.trim(),
        'guardianName': _guardian.text.trim(),
        'guardianPhone': _guardianPhone.text.trim(),
        'instrument': _instrument.text.trim(),
        'teacherId': _teacherId,
        'demoDate': _demoDate,
        'demoTime': _demoTime,
        'branch': auth.branch ?? '',
      });
      final m = r as Map<String, dynamic>;
      if (m['ok'] != true) {
        setState(() {
          _busy = false;
          _error = (m['error'] ?? 'Could not add.').toString();
        });
        return;
      }
      if (!mounted) return;
      // Returning the new id (rather than just `true`) lets the caller tell
      // an inquiry hand-off apart from a plain add.
      Navigator.pop(context, (m['studentId'] ?? '').toString());
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
      title: const Text('Add demo student'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'Student name *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: AppSpace.s3),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Phone *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: AppSpace.s3),
            TextFormField(controller: _email, decoration: const InputDecoration(labelText: 'Email')),
            const SizedBox(height: AppSpace.s3),
            TextFormField(
              controller: _guardian,
              decoration: const InputDecoration(labelText: 'Guardian name *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: AppSpace.s3),
            TextFormField(
              controller: _guardianPhone,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(labelText: 'Guardian contact number *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: AppSpace.s3),
            TextFormField(
              controller: _instrument,
              decoration: const InputDecoration(labelText: 'Instrument / course *'),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Required' : null,
            ),
            const SizedBox(height: AppSpace.s3),
            DropdownButtonFormField<String>(
              initialValue: _teacherId.isEmpty ? null : _teacherId,
              decoration: const InputDecoration(labelText: 'Teacher *'),
              hint: const Text('Select teacher…'),
              items: [for (final t in widget.teachers) DropdownMenuItem(value: t.teacherId, child: Text(t.teacherName))],
              onChanged: (v) => setState(() => _teacherId = v ?? ''),
            ),
            const SizedBox(height: AppSpace.s3),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.event_outlined),
              title: Text('Demo date: $_demoDate'),
              onTap: _pickDate,
            ),
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.schedule),
              title: Text('Demo time: $_demoTime'),
              onTap: _pickTime,
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s2),
                child: Text(_error!, style: TextStyle(color: AppColors.adaptive(context, AppColors.blockFg), fontSize: 13)),
              ),
          ]),
        ),
      ),
      actions: [
        TextButton(onPressed: _busy ? null : () => Navigator.pop(context), child: const Text('Cancel')),
        FilledButton(
          onPressed: _busy ? null : _save,
          child: _busy
              ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Add demo student'),
        ),
      ],
    );
  }
}

class _ConvertDemoForm extends StatefulWidget {
  const _ConvertDemoForm({required this.demo});
  final DemoStudent demo;
  @override
  State<_ConvertDemoForm> createState() => _ConvertDemoFormState();
}

class _ConvertDemoFormState extends State<_ConvertDemoForm> {
  String _plan = '';
  final _dueDay = TextEditingController(text: '5');
  late String _enrollmentDate = _todayIso();
  bool _busy = false;
  String? _error;

  static String _todayIso() {
    final d = DateTime.now();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  @override
  void dispose() {
    _dueDay.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime.tryParse(_enrollmentDate) ?? DateTime.now(),
      firstDate: DateTime(2015),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() => _enrollmentDate =
          '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
    }
  }

  Future<void> _save() async {
    if (_plan.isEmpty) {
      setState(() => _error = 'Pick a fee plan.');
      return;
    }
    final dueDayNum = int.tryParse(_dueDay.text.trim());
    if (dueDayNum == null || dueDayNum < 1 || dueDayNum > 31) {
      setState(() => _error = 'Fee due day must be 1-31.');
      return;
    }
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await auth.service!.convertDemoStudent({
        'studentId': widget.demo.studentId,
        'feeCycleType': _plan,
        'feeDueDay': dueDayNum,
        'enrollmentDate': _enrollmentDate,
      });
      final m = r as Map<String, dynamic>;
      if (m['ok'] != true) {
        setState(() {
          _busy = false;
          _error = (m['error'] ?? 'Could not convert.').toString();
        });
        return;
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
      title: Text('Convert ${widget.demo.studentName}'),
      content: SingleChildScrollView(
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          DropdownButtonFormField<String>(
            initialValue: _plan.isEmpty ? null : _plan,
            decoration: const InputDecoration(labelText: 'Fee plan *'),
            hint: const Text('Select plan…'),
            items: [
              for (final p in academyPlans)
                DropdownMenuItem(value: p.key, child: Text('${p.key} — ₹${p.amount}${p.months > 0 ? ' / ${p.months} months' : ' / month'}')),
            ],
            onChanged: (v) => setState(() => _plan = v ?? ''),
          ),
          const SizedBox(height: AppSpace.s3),
          TextFormField(
            controller: _dueDay,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(labelText: 'Fee due day (1-31) *'),
          ),
          const SizedBox(height: AppSpace.s3),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.event_outlined),
            title: Text('Admission date: $_enrollmentDate'),
            onTap: _pickDate,
          ),
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
          child: _busy ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Convert'),
        ),
      ],
    );
  }
}
