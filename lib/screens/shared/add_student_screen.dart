import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Add Edit Student.
/// founder: writes via the checked founder add path (draft + merge in one call).
/// staff:   writes a STAFF_STUDENT_DRAFTS row (ADD or, when [edit] is set, an
///          EDIT draft) for the founder to merge — placing an edit creates the
///          audited change record, never a silent direct write.
class AddStudentScreen extends StatefulWidget {
  const AddStudentScreen({super.key, required this.staff, this.edit});
  final bool staff;

  /// When set, the form edits this existing student (writes an EDIT draft).
  final Student? edit;
  @override
  State<AddStudentScreen> createState() => _AddStudentScreenState();
}

class _AddStudentScreenState extends State<AddStudentScreen> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  final _parent = TextEditingController();
  final _guardianPhone = TextEditingController();
  final _instrument = TextEditingController();
  final _fee = TextEditingController();
  final _months = TextEditingController();
  final _batch = TextEditingController();
  final _notes = TextEditingController();
  String _classCode = 'GMC';
  String _feeCycle = 'Monthly';
  String _plan = '';
  String _admissionSource = '';
  String _teacherId = '';
  int _feeDueDay = 5;
  late String _joiningDate = _todayIso();
  bool _busy = false;
  String? _result; // server message after a save
  bool _success = false;

  static String _todayIso() {
    final d = DateTime.now();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  List<Teacher> _teachers = [];
  bool _teachersBusy = true;

  bool get _editing => widget.edit != null;

  @override
  void initState() {
    super.initState();
    final e = widget.edit;
    if (e != null) {
      _name.text = e.studentName;
      _phone.text = e.phone;
      _email.text = e.email;
      _instrument.text = e.instrument;
      _batch.text = e.batch;
      _classCode = e.classCode == 'KMC' ? 'KMC' : 'GMC';
      _plan = e.feePlan;
      _admissionSource = e.admissionSource ?? '';
      _teacherId = e.teacherId;
      if (e.feeDueDay.isNotEmpty) _feeDueDay = int.tryParse(e.feeDueDay) ?? 5;
    }
    _loadTeachers();
  }

  Future<void> _loadTeachers() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final rows = await auth.service!.listTeachers();
      if (!mounted) return;
      setState(() {
        _teachers = rows.where((t) => t.status.toUpperCase() != 'INACTIVE').toList();
        _teachersBusy = false;
      });
    } on ApiException {
      if (mounted) setState(() => _teachersBusy = false);
    } on ApiUnreachable {
      if (mounted) setState(() => _teachersBusy = false);
    }
  }

  @override
  void dispose() {
    for (final c in [_name, _phone, _email, _parent, _guardianPhone, _instrument, _fee, _months, _batch, _notes]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (!widget.staff && _editing) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Save changes?'),
          content: Text('Save these changes to ${_name.text.trim()}? This applies immediately.'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Save')),
          ],
        ),
      );
      if (confirmed != true) return;
      if (!mounted) return;
    }
    if (!_editing) {
      if (_admissionSource.isEmpty) {
        setState(() => _result = 'Say how they came to us.');
        return;
      }
      if (_plan.isEmpty) {
        setState(() => _result = 'Pick a fee plan.');
        return;
      }
      if (_teacherId.isEmpty) {
        setState(() => _result = 'Pick a teacher.');
        return;
      }
    }
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _success = false;
      _result = null;
    });
    try {
      final payload = widget.staff
          ? {
              if (_editing) 'studentId': widget.edit!.studentId,
              'name': _name.text.trim(),
              'phone': _phone.text.trim(),
              'email': _email.text.trim(),
              'parentName': _parent.text.trim(),
              'guardianPhone': _guardianPhone.text.trim(),
              'course': _instrument.text.trim(),
              'branch': auth.branch ?? '',
              'joiningDate': _joiningDate,
              'monthlyFee': _fee.text.trim(),
              'monthsPaid': _months.text.trim(),
              'batch': _batch.text.trim(),
              'notes': _notes.text.trim(),
              'lenient': true,
              if (_plan.isNotEmpty) 'feeCycleType': _plan,
              if (_admissionSource.isNotEmpty) 'admissionSource': _admissionSource,
              if (_teacherId.isNotEmpty) 'teacherId': _teacherId,
            }
          : {
              'studentName': _name.text.trim(),
              'phone': _phone.text.trim(),
              'email': _email.text.trim(),
              'guardianName': _parent.text.trim(),
              'guardianPhone': _guardianPhone.text.trim(),
              'classCode': _classCode,
              if (_plan.isNotEmpty)
                'feeCycleType': _plan
              else
                'feeCycleType': _feeCycle,
              'feeDueDay': _feeDueDay,
              'instrument': _instrument.text.trim(),
              'enrollmentDate': _joiningDate,
              if (_admissionSource.isNotEmpty) 'admissionSource': _admissionSource,
              if (_teacherId.isNotEmpty) 'teacherId': _teacherId,
              if (_editing) 'studentId': widget.edit!.studentId,
            };
      final r = _editing
          ? (!widget.staff
              ? await auth.service!.founderEditStudent(payload) // founder edit → applies immediately
              : await auth.service!.saveStudentDraft(payload)) // staff edit → draft, founder merges
          : widget.staff
              ? await auth.service!.saveStudentDraft(payload)
              : await auth.service!.addStudent(payload);
      final m = r as Map<String, dynamic>;
      final dup = (m['duplicateWarning'] is Map<String, dynamic> && m['duplicateWarning']['hasDuplicates'] == true) ||
          m['duplicate'] == true;
      if (!mounted) return;
      setState(() {
        _busy = false;
        _success = m['ok'] == true || m.containsKey('studentId');
        // Staff changes are drafts until the founder merges them — never "Saved".
        _result = _success
            ? !widget.staff && _editing
                ? 'Student updated.'
                : widget.staff
                ? 'Sent for approval.${dup ? ' A possible duplicate was flagged for review.' : ''}'
                    ' It appears in the student list once merged.'
                : dup
                    ? 'Student added. A student with this phone may already exist — check before collecting fees.'
                    : 'Student added.'
            : (m['error'] ?? 'Could not save.').toString();
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _result = e.message;
        _success = false;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _result = e.message;
        _success = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return ListView(
      padding: const EdgeInsets.all(AppSpace.s4),
      children: [
        Form(
          key: _formKey,
          child: Column(children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  TextFormField(
                    controller: _name,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Student name *', prefixIcon: Icon(Icons.person_outline)),
                    validator: (v) => (v == null || v.trim().isEmpty) ? 'Student name is required' : null,
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _phone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Phone *', prefixIcon: Icon(Icons.phone_outlined)),
                    validator: (v) => (!_editing && (v == null || v.trim().isEmpty)) ? 'Phone is required' : null,
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.mail_outline)),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _parent,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Parent / guardian name *', prefixIcon: Icon(Icons.people_outline)),
                    validator: (v) => (!_editing && (v == null || v.trim().isEmpty)) ? 'Guardian name is required' : null,
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _guardianPhone,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(labelText: 'Guardian contact number *', prefixIcon: Icon(Icons.contact_phone_outlined)),
                    validator: (v) => (!_editing && (v == null || v.trim().isEmpty)) ? 'Guardian contact number is required' : null,
                  ),
                  const SizedBox(height: AppSpace.s3),
                  InkWell(
                    onTap: () async {
                      final picked = await showDatePicker(
                        context: context,
                        initialDate: DateTime.tryParse(_joiningDate) ?? DateTime.now(),
                        firstDate: DateTime(2015),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (picked != null) {
                        setState(() => _joiningDate =
                            '${picked.year.toString().padLeft(4, '0')}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}');
                      }
                    },
                    child: InputDecorator(
                      decoration: const InputDecoration(labelText: 'Joining date *', prefixIcon: Icon(Icons.event_outlined)),
                      child: Text(_joiningDate),
                    ),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _instrument,
                    textCapitalization: TextCapitalization.words,
                    decoration: const InputDecoration(labelText: 'Instrument / course *', prefixIcon: Icon(Icons.music_note_outlined)),
                    validator: (v) => (!_editing && (v == null || v.trim().isEmpty)) ? 'Instrument / course is required' : null,
                  ),
                  const SizedBox(height: AppSpace.s3),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text('HOW DID THEY COME TO US? *',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.adaptive(context, AppColors.muted))),
                  ),
                  const SizedBox(height: AppSpace.s2),
                  Wrap(
                    spacing: AppSpace.s2,
                    runSpacing: AppSpace.s2,
                    children: [
                      for (final src in admissionSources)
                        ChoiceChip(
                          label: Text(src.label),
                          selected: _admissionSource == src.value,
                          onSelected: (_) => setState(() => _admissionSource = src.value),
                        ),
                    ],
                  ),
                ]),
              ),
            ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('PLAN',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.adaptive(context, AppColors.muted))),
                  const SizedBox(height: AppSpace.s2),
                  DropdownButtonFormField<String>(
                    isExpanded: true,
                    initialValue: _plan.isEmpty ? null : _plan,
                    decoration: const InputDecoration(labelText: 'Fee plan *'),
                    hint: const Text('Select plan…'),
                    validator: (v) => (!_editing && (v == null || v.isEmpty)) ? 'Pick a fee plan' : null,
                    items: [
                      for (final p in academyPlans)
                        DropdownMenuItem(
                          value: p.key,
                          child: Text('${p.key} — ₹${p.amount}${p.months > 0 ? ' / ${p.months} months' : ' / month'}'),
                        ),
                    ],
                    onChanged: (v) {
                      setState(() {
                        _plan = v ?? '';
                        for (final p in academyPlans) {
                          if (p.key == v) {
                            _feeCycle = p.months > 0 ? '3 Months' : 'Monthly';
                            break;
                          }
                        }
                      });
                    },
                  ),
                  const SizedBox(height: AppSpace.s2),
                  if (_plan.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpace.s2),
                      child: Text(planSummary(_plan),
                          style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                    ),
                ]),
              ),
            ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('ASSIGN TEACHER', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.adaptive(context, AppColors.muted))),
                  const SizedBox(height: AppSpace.s2),
                  _teachersBusy
                      ? const Padding(
                          padding: EdgeInsets.symmetric(vertical: AppSpace.s2),
                          child: SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                        )
                      : DropdownButtonFormField<String>(
                          isExpanded: true,
                          initialValue: _teacherId.isEmpty ? null : _teacherId,
                          decoration: const InputDecoration(labelText: 'Teacher *'),
                          hint: const Text('Select teacher…'),
                          validator: (v) => (!_editing && (v == null || v.isEmpty)) ? 'Pick a teacher' : null,
                          items: [
                            for (final t in _teachers)
                              DropdownMenuItem(value: t.teacherId, child: Text('${t.teacherName}${t.primaryRole.isNotEmpty ? ' · ${t.primaryRole}' : ''}')),
                          ],
                          onChanged: (v) => setState(() => _teacherId = v ?? ''),
                        ),
                  const SizedBox(height: AppSpace.s1),
                  Text(
                    'The teacher who actually takes attendance is always what counts for payroll — this is just who the student starts with.',
                    style: TextStyle(fontSize: 11, color: AppColors.adaptive(context, AppColors.muted)),
                  ),
                ]),
              ),
            ),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  if (!widget.staff) ...[
                    Text('CLASS CODE *', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.adaptive(context, AppColors.muted))),
                    const SizedBox(height: AppSpace.s2),
                    SegmentedButton<String>(
                      segments: const [
                        ButtonSegment(value: 'GMC', label: Text('GMC')),
                        ButtonSegment(value: 'KMC', label: Text('KMC')),
                      ],
                      selected: {_classCode},
                      onSelectionChanged: (s) => setState(() => _classCode = s.first),
                    ),
                    const SizedBox(height: AppSpace.s3),
                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      initialValue: _feeCycle,
                      decoration: const InputDecoration(labelText: 'Fee cycle *'),
                      items: const [
                        DropdownMenuItem(value: 'Monthly', child: Text('Monthly')),
                        DropdownMenuItem(value: '3 Months', child: Text('3 Months')),
                        DropdownMenuItem(value: '6 Months', child: Text('6 Months')),
                        DropdownMenuItem(value: 'Yearly', child: Text('Yearly')),
                      ],
                      onChanged: (v) => setState(() => _feeCycle = v ?? 'Monthly'),
                    ),
                    const SizedBox(height: AppSpace.s3),
                    TextFormField(
                      initialValue: '$_feeDueDay',
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Fee due day (1-31) *'),
                      onChanged: (v) => _feeDueDay = int.tryParse(v) ?? 5,
                      validator: (v) {
                        final n = int.tryParse(v ?? '');
                        return (n == null || n < 1 || n > 31) ? 'Day must be 1-31' : null;
                      },
                    ),
                  ] else ...[
                    Text('BRANCH', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: .5, color: AppColors.adaptive(context, AppColors.muted))),
                    const SizedBox(height: AppSpace.s2),
                    Text(auth.branch ?? '—', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
                    const SizedBox(height: AppSpace.s3),
                    TextFormField(
                      controller: _fee,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Monthly fee (₹)', prefixIcon: Icon(Icons.currency_rupee)),
                    ),
                    const SizedBox(height: AppSpace.s3),
                    TextFormField(
                      controller: _months,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(labelText: 'Months paid', prefixIcon: Icon(Icons.calendar_month_outlined)),
                    ),
                    const SizedBox(height: AppSpace.s3),
                    TextFormField(
                      controller: _batch,
                      decoration: const InputDecoration(labelText: 'Batch'),
                    ),
                  ],
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _notes,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Notes'),
                  ),
                ]),
              ),
            ),
            if (_result != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s3),
                child: Container(
                  padding: const EdgeInsets.all(AppSpace.s3),
                  decoration: BoxDecoration(
                    color: _success ? AppColors.adaptive(context, AppColors.okBg) : AppColors.adaptive(context, AppColors.blockBg),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(_success ? Icons.check_circle_outline : Icons.error_outline, size: 18,
                        color: _success ? AppColors.adaptive(context, AppColors.okFg) : AppColors.adaptive(context, AppColors.blockFg)),
                    const SizedBox(width: AppSpace.s2),
                    Expanded(child: Text(_result!, style: TextStyle(color: _success ? AppColors.adaptive(context, AppColors.okFg) : AppColors.adaptive(context, AppColors.blockFg), fontSize: 13))),
                  ]),
                ),
              ),
            const SizedBox(height: AppSpace.s4),
            LoadingButton(
              label: _editing
                  ? (widget.staff ? 'Save changes (founder approves)' : 'Save changes')
                  : widget.staff
                      ? 'Save as draft for Sharvil'
                      : 'Add student',
              icon: _editing ? Icons.save_outlined : Icons.person_add_alt,
              busy: _busy,
              onPressed: _save,
            ),
          ]),
        ),
      ],
    );
  }
}