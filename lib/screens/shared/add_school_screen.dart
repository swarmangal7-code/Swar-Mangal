import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Founder-only: add a school that class invoices are billed to. Every school
/// uses the same invoice template — only the code (which appears in the
/// invoice number, SMI-26-27-007_SCH_MHWS) and the addressee differ. The code
/// is fixed at creation because issued invoices already carry it.
class AddSchoolScreen extends StatefulWidget {
  const AddSchoolScreen({super.key});
  @override
  State<AddSchoolScreen> createState() => _AddSchoolScreenState();
}

class _AddSchoolScreenState extends State<AddSchoolScreen> {
  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  final _name = TextEditingController();
  final _address = TextEditingController();
  final _contact = TextEditingController();
  bool _busy = false;
  String? _error;

  /// Same rule the server enforces: 2-16 letters, digits, dash or underscore.
  static final _codeRe = RegExp(r'^[A-Za-z0-9][A-Za-z0-9_-]{1,15}$');

  @override
  void dispose() {
    for (final c in [_code, _name, _address, _contact]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final r = await auth.service!.addSchool(
        code: _code.text.trim().toUpperCase(),
        name: _name.text.trim(),
        address: _address.text.trim(),
        contact: _contact.text.trim(),
      );
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      if (m['ok'] != true) {
        setState(() {
          _busy = false;
          _error = (m['error'] ?? 'Could not add the school.').toString();
        });
        return;
      }
      final demo = auth.isDemo || m['demo'] == true;
      Navigator.pop(context, '${m['code'] ?? _code.text.trim().toUpperCase()}');
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text('${m['note'] ?? 'School added.'}'
                '${demo ? ' (DEMO — not persisted)' : ''}')));
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
    return Scaffold(
      appBar: AppBar(title: const Text('Add a school')),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(AppSpace.s4),
          children: [
            const Text(
              'A school is the party a class invoice is billed to. It uses the same invoice template as '
              'every other school — the code is what differs, and it goes on the invoice number. '
              'The code cannot be changed later, because issued invoices already carry it.',
              style: TextStyle(fontSize: 12, color: AppColors.muted),
            ),
            const SizedBox(height: AppSpace.s4),
            TextFormField(
              controller: _code,
              textCapitalization: TextCapitalization.characters,
              decoration: const InputDecoration(
                labelText: 'School code *',
                hintText: 'e.g. MHWS',
                prefixIcon: Icon(Icons.tag),
                helperText: '2–16 letters, digits, dash or underscore.',
              ),
              validator: (v) {
                final t = (v ?? '').trim();
                if (t.isEmpty) return 'A code is required — it goes on the invoice number';
                if (!_codeRe.hasMatch(t)) return 'Use 2–16 letters, digits, dash or underscore';
                return null;
              },
              onChanged: (v) => setState(() => _code.text = v.toUpperCase()),
            ),
            const SizedBox(height: AppSpace.s3),
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(
                labelText: 'School name *',
                hintText: 'e.g. Modern High School',
                prefixIcon: Icon(Icons.school_outlined),
              ),
              validator: (v) => (v == null || v.trim().isEmpty) ? 'Enter the school name' : null,
            ),
            const SizedBox(height: AppSpace.s3),
            TextFormField(
              controller: _address,
              maxLines: 2,
              decoration: const InputDecoration(
                labelText: 'Address (optional)',
                hintText: 'Printed under the school name on the invoice',
                prefixIcon: Icon(Icons.place_outlined),
              ),
            ),
            const SizedBox(height: AppSpace.s3),
            TextFormField(
              controller: _contact,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Contact (optional)',
                hintText: 'Phone or email',
                prefixIcon: Icon(Icons.contact_phone_outlined),
              ),
            ),
            if (_error != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s3),
                child: Card(
                  color: AppColors.blockBg,
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpace.s3),
                    child: Text(_error!, style: const TextStyle(color: AppColors.blockFg, fontSize: 13)),
                  ),
                ),
              ),
            const SizedBox(height: AppSpace.s4),
            LoadingButton(
              label: 'Add school',
              icon: Icons.add_business_outlined,
              busy: _busy,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }
}
