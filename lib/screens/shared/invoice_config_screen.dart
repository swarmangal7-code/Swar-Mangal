import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../services/invoice_pdf.dart';
import '../../widgets/atoms.dart';
import 'add_school_screen.dart';
import 'payment_profile_change_screen.dart';

/// School-level invoice editor. Fields are class/amount/tenure/date — NO
/// student identity. One primary "Generate PDF" action; one intent key per
/// form prevents duplicate invoices on retry/double-tap.
class InvoiceConfigScreen extends StatefulWidget {
  const InvoiceConfigScreen({super.key, required this.staff});
  final bool staff;
  @override
  State<InvoiceConfigScreen> createState() => _InvoiceConfigScreenState();
}

class _InvoiceConfigScreenState extends State<InvoiceConfigScreen> {
  final _amount = TextEditingController(text: '18000');
  final _schoolAddress = TextEditingController();
  final _invoiceSeq = TextEditingController();
  final _billingMonthCtrl = TextEditingController();
  final _intent = 'SINV-${DateTime.now().microsecondsSinceEpoch}';
  String _tenure = '6 Months';
  String _invoiceDate = '';
  String _billingMonth = '';
  bool _seqTouched = false;
  bool _busy = false;
  String? _error;
  // Staff must see the rendered preview before it can be sent (brief P11.3).
  bool _previewed = false;
  String? _draftNote;
  List<School> _schools = [];
  School? _school;
  bool _loadingSchools = true;

  static const _tenures = ['1 Month', '3 Months', '6 Months', '12 Months'];

  @override
  void initState() {
    super.initState();
    final n = DateTime.now();
    _invoiceDate = '${n.year}-${n.month.toString().padLeft(2, '0')}-${n.day.toString().padLeft(2, '0')}';
    // Schools are billed in arrears — the last fully-completed month.
    final prev = DateTime(n.year, n.month - 1);
    _billingMonth = '${prev.year}-${prev.month.toString().padLeft(2, '0')}';
    _billingMonthCtrl.text = _billingMonth;
    _loadSchools();
  }

  Future<void> _loadSchools() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final rows = await auth.service!.listSchools();
      if (!mounted) return;
      setState(() {
        _schools = rows.where((s) => s.active).toList();
        _school = _schools.isEmpty ? null : _schools.first;
        _schoolAddress.text = _school?.address ?? '';
        _loadingSchools = false;
      });
      await _peekInvoiceSeq();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadingSchools = false;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _error = e.message;
        _loadingSchools = false;
      });
    }
  }

  @override
  void dispose() {
    _amount.dispose();
    _schoolAddress.dispose();
    _invoiceSeq.dispose();
    _billingMonthCtrl.dispose();
    super.dispose();
  }

  /// First/last day of a "YYYY-MM" billing month, mirroring the backend's
  /// billingMonthRange so the preview matches what finalising will store.
  static (String, String) _billingMonthBounds(String billingMonth) {
    final m = RegExp(r'^(\d{4})-(\d{2})$').firstMatch(billingMonth);
    if (m == null) return ('', '');
    final year = int.parse(m.group(1)!);
    final month = int.parse(m.group(2)!);
    final from = '$year-${month.toString().padLeft(2, '0')}-01';
    final lastDay = DateTime(year, month + 1, 0).day;
    final to = '$year-${month.toString().padLeft(2, '0')}-${lastDay.toString().padLeft(2, '0')}';
    return (from, to);
  }

  /// Mirrors the backend's financialYearLabel/formatSchoolInvoiceNo so the
  /// preview can show the full number without a round trip on every edit.
  static String _clientInvoiceNo(String invoiceDateIso, String seq, String schoolCode) {
    DateTime d;
    final f = invoiceDateIso.split('-');
    d = f.length == 3
        ? DateTime(int.parse(f[0]), int.parse(f[1]), int.parse(f[2]))
        : DateTime.now();
    final startYear = d.month >= 4 ? d.year : d.year - 1;
    String two(int n) => (n % 100).toString().padLeft(2, '0');
    final fy = '${two(startYear)}-${two(startYear + 1)}';
    final n = int.tryParse(seq);
    final padded = (n != null && n > 0) ? n.toString().padLeft(3, '0') : '???';
    final code = schoolCode.trim().toUpperCase();
    return 'SMI-$fy-$padded${code.isNotEmpty ? '_SCH_$code' : ''}';
  }

  /// Suggested next invoice number for the picked school — a proposal only;
  /// the founder's generate/finalise is what actually allocates it.
  Future<void> _peekInvoiceSeq() async {
    if (_seqTouched || _school == null) return;
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    try {
      final seq = await auth.service!.peekNextSchoolInvoiceNo(schoolId: _school!.schoolId, invoiceDate: _invoiceDate);
      if (!mounted || _seqTouched || seq == null) return;
      setState(() => _invoiceSeq.text = seq.toString());
    } catch (_) {
      // Non-fatal — the field just starts blank and the founder/staff types one in.
    }
  }

  ({bool ok, num? amount})? _validate() {
    if (_school == null) {
      setState(() => _error = 'Pick the school this invoice is for.');
      return null;
    }
    final a = InvoiceValidator.amount(_amount.text);
    if (!a.ok) {
      setState(() => _error = a.error);
      return null;
    }
    final tErr = InvoiceValidator.tenure(_tenure);
    if (tErr != null) {
      setState(() => _error = tErr);
      return null;
    }
    if (_billingMonth.isEmpty) {
      setState(() => _error = 'Pick the month this invoice bills for.');
      return null;
    }
    return (ok: true, amount: a.amount);
  }

  /// Founder: one step, issues the invoice immediately (server-authoritative
  /// number). Founder-only server-side.
  Future<void> _generate() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final v = _validate();
    if (v == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final inv = await auth.service!.generateSchoolInvoice(
        amount: v.amount!,
        tenure: _tenure,
        invoiceDate: _invoiceDate,
        billingMonth: _billingMonth,
        schoolAddress: _schoolAddress.text.trim(),
        invoiceSeq: _invoiceSeq.text.trim(),
        branch: auth.branch ?? 'ALL',
        schoolId: _school!.schoolId,
        intentKey: _intent,
      );
      if (!mounted) return;
      final demo = auth.isDemo || inv.demo;
      final bytes = await buildInvoicePdf(inv, demo: demo);
      setState(() => _busy = false);
      await showInvoicePdf(bytes, '${inv.invoiceNo}.pdf');
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(SnackBar(
            content: Text('Invoice ${inv.invoiceNo} generated.'
                '${demo ? ' (DEMO — NOT PERSISTED)' : ''}')));
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message; // keep entered values; retry uses the same intent key
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _error = e.message;
      });
    }
  }

  /// Staff: preview the exact PDF first (nothing persisted), then send the
  /// draft to Sharvil. Only the founder can allocate an SMI- number.
  Future<void> _preview() async {
    final auth = context.read<AuthProvider>();
    final v = _validate();
    if (v == null) return;
    final billingBounds = _billingMonthBounds(_billingMonth);
    final preview = SchoolInvoice(
      invoiceId: '',
      invoiceNo: _clientInvoiceNo(_invoiceDate, _invoiceSeq.text.trim(), _school?.code ?? ''),
      invoiceDate: _invoiceDate,
      billingPeriodFrom: billingBounds.$1,
      billingPeriodTo: billingBounds.$2,
      branch: auth.branch ?? 'ALL',
      className: '',
      amount: v.amount!,
      tenure: _tenure,
      schoolCode: _school?.code ?? '',
      schoolName: _school?.name ?? '',
      schoolAddress: _schoolAddress.text.trim(),
      schoolContact: _school?.contact ?? '',
      owner1: InvoiceOwner(name: 'Sharvil Vaidya', id: 'OWNER-1', signatureUrl: ''),
      owner2: InvoiceOwner(name: 'Piyush Kashyap', id: 'OWNER-2', signatureUrl: ''),
      pdfUrl: '',
      demo: false,
    );
    setState(() {
      _error = null;
      _draftNote = null;
    });
    final bytes = await buildInvoicePdf(preview, demo: false);
    if (!mounted) return;
    await showInvoicePdf(bytes, 'preview.pdf');
    if (!mounted) return;
    setState(() => _previewed = true);
  }

  Future<void> _sendDraft() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    final v = _validate();
    if (v == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await auth.service!.raw('api_staff_submitSchoolInvoiceDraft', {
        'amount': v.amount,
        'tenure': _tenure,
        'invoiceDate': _invoiceDate,
        'billingMonth': _billingMonth,
        'schoolAddress': _schoolAddress.text.trim(),
        if (_invoiceSeq.text.trim().isNotEmpty) 'invoiceSeq': _invoiceSeq.text.trim(),
        'branch': auth.branch ?? 'ALL',
        'schoolId': _school!.schoolId,
        'previewConfirmed': true,
        'clientIntentKey': _intent,
      });
      final m = res as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _busy = false;
        _draftNote = m['ok'] == true ? (m['note'] ?? 'Sent for approval.').toString() : null;
        _error = m['ok'] == true ? null : (m['error'] ?? 'Could not send the invoice.').toString();
      });
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
    final scheme = Theme.of(context).colorScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('School invoice')),
      body: ListView(
        padding: const EdgeInsets.all(AppSpace.s4),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(children: [
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('SCHOOL',
                      style: AppType.eyebrow.copyWith(color: scheme.onSurfaceVariant)),
                ),
                const SizedBox(height: AppSpace.s2),
                if (_loadingSchools)
                  const LinearProgressIndicator()
                else
                  DropdownButtonFormField<School>(
                    initialValue: _school,
                    decoration: const InputDecoration(
                      labelText: 'Billed to *',
                      prefixIcon: Icon(Icons.school_outlined),
                    ),
                    items: [
                      for (final s in _schools)
                        DropdownMenuItem(
                          value: s,
                          child: Text(s.label, overflow: TextOverflow.ellipsis),
                        ),
                    ],
                    onChanged: (v) {
                      setState(() {
                        _school = v;
                        _schoolAddress.text = v?.address ?? '';
                        _seqTouched = false;
                        _previewed = false;
                      });
                      _peekInvoiceSeq();
                    },
                    validator: (v) => v == null ? 'Pick the school this invoice is for' : null,
                  ),
                if (_school != null) ...[
                  const SizedBox(height: AppSpace.s2),
                  TextFormField(
                    controller: _schoolAddress,
                    onChanged: (_) => setState(() => _previewed = false),
                    maxLines: 2,
                    style: const TextStyle(fontSize: 13),
                    decoration: const InputDecoration(
                      labelText: 'School address',
                      hintText: 'No address on file — enter one for this invoice',
                      helperText: "Only for this invoice — won't change the school's saved address.",
                    ),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _invoiceSeq,
                    onChanged: (_) => setState(() {
                      _seqTouched = true;
                      _previewed = false;
                    }),
                    keyboardType: TextInputType.number,
                    style: const TextStyle(fontSize: 13),
                    decoration: InputDecoration(
                      labelText: 'Invoice number',
                      prefixIcon: const Icon(Icons.tag_outlined),
                      helperText: widget.staff
                          ? 'Will print as ${_clientInvoiceNo(_invoiceDate, _invoiceSeq.text, _school!.code)} — Sharvil allocates the real number when he approves this.'
                          : 'Will print as ${_clientInvoiceNo(_invoiceDate, _invoiceSeq.text, _school!.code)} — edit it to match a number already used elsewhere.',
                      helperMaxLines: 2,
                    ),
                  ),
                ],
                const SizedBox(height: AppSpace.s3),
                TextFormField(
                  controller: _amount,
                  onChanged: (_) => setState(() => _previewed = false),
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  decoration: const InputDecoration(
                      labelText: 'Invoice amount (INR) *',
                      prefixIcon: Icon(Icons.currency_rupee)),
                ),
                const SizedBox(height: AppSpace.s3),
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text('TENURE',
                      style: AppType.eyebrow.copyWith(color: scheme.onSurfaceVariant)),
                ),
                const SizedBox(height: AppSpace.s2),
                Wrap(
                  spacing: AppSpace.s2,
                  runSpacing: AppSpace.s2,
                  children: _tenures.map((t) {
                    final sel = _tenure == t;
                    return ChoiceChip(
                      label: Text(t),
                      selected: sel,
                      onSelected: (_) => setState(() {
                        _tenure = t;
                        _previewed = false;
                      }),
                    );
                  }).toList(),
                ),
                const SizedBox(height: AppSpace.s3),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_month_outlined, color: AppColors.muted),
                  title: Text(_billingMonth.isEmpty ? 'Billing period' : 'Billing period: $_billingMonth'),
                  subtitle: const Text('The calendar month this invoice bills for.'),
                  trailing: TextButton(
                    onPressed: () async {
                      final now = DateTime.now();
                      final f = _billingMonth.split('-');
                      final p = await showDatePicker(
                        context: context,
                        initialDate: f.length == 2
                            ? DateTime(int.parse(f[0]), int.parse(f[1]))
                            : DateTime(now.year, now.month - 1),
                        firstDate: DateTime(2020),
                        lastDate: DateTime(now.year + 1, 12),
                        helpText: 'Pick any day in the billing month',
                        fieldLabelText: 'Billing month',
                      );
                      if (p != null) {
                        setState(() {
                          _billingMonth = '${p.year}-${p.month.toString().padLeft(2, '0')}';
                          _billingMonthCtrl.text = _billingMonth;
                          _previewed = false;
                        });
                      }
                    },
                    child: const Text('Change'),
                  ),
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.event, color: AppColors.muted),
                  title: Text('Invoice date: $_invoiceDate'),
                  trailing: TextButton(
                    onPressed: () async {
                      final f = _invoiceDate.split('-');
                      final d = await showDatePicker(
                        context: context,
                        initialDate: f.length == 3
                            ? DateTime(int.parse(f[0]), int.parse(f[1]), int.parse(f[2]))
                            : DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2035),
                      );
                      if (d != null) {
                        setState(() => _invoiceDate =
                            '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}');
                      }
                    },
                    child: const Text('Change'),
                  ),
                ),
              ]),
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
          if (widget.staff) ...[
            LoadingButton(
              label: _previewed ? 'Preview again' : 'Preview',
              icon: Icons.visibility_outlined,
              secondary: _previewed,
              busy: _busy,
              onPressed: _preview,
            ),
            const SizedBox(height: AppSpace.s3),
            LoadingButton(
              label: 'Send for approval',
              icon: Icons.send_outlined,
              busy: _busy,
              onPressed: _previewed ? _sendDraft : null,
            ),
            if (!_previewed)
              const Padding(
                padding: EdgeInsets.only(top: AppSpace.s2),
                child: Text('Preview the invoice before sending it.',
                    style: TextStyle(fontSize: 12, color: AppColors.muted)),
              ),
            if (_draftNote != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpace.s3),
                child: Card(
                  color: AppColors.okBg,
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpace.s3),
                    child: Text(_draftNote!, style: const TextStyle(fontSize: 12, color: AppColors.okFg)),
                  ),
                ),
              ),
            const SizedBox(height: AppSpace.s3),
            Text(
              'Only Sharvil can issue the invoice number. This sends a draft for his review.',
              style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
            ),
          ] else ...[
            LoadingButton(
              label: 'Generate PDF',
              icon: Icons.picture_as_pdf_outlined,
              busy: _busy,
              onPressed: _generate,
            ),
            const SizedBox(height: AppSpace.s3),
            Text(
              'School-level invoice — no student is attached. The backend assigns the number and persists '
              'an immutable snapshot; the app only renders the PDF.',
              style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
            ),
          ],
          const SizedBox(height: AppSpace.s4),
          if (!widget.staff)
            // Founder-only: a new school is a money-document decision, so staff
            // read the list but only the founder can add one.
            OutlinedButton.icon(
              onPressed: () async {
                final added = await Navigator.of(context).push<String>(MaterialPageRoute(
                  builder: (_) => const AddSchoolScreen(),
                ));
                if (added != null && added.isNotEmpty) {
                  await _loadSchools();
                  if (mounted) {
                    setState(() {
                      _school = _schools.where((s) => s.code == added.toUpperCase()).firstOrNull;
                      _schoolAddress.text = _school?.address ?? '';
                      _seqTouched = false;
                    });
                    await _peekInvoiceSeq();
                  }
                }
              },
              icon: const Icon(Icons.add_business_outlined, size: 18),
              label: const Text('Add a school'),
            ),
          const SizedBox(height: AppSpace.s4),
          OutlinedButton.icon(
            onPressed: () {
              final auth = context.read<AuthProvider>();
              final entityId = (auth.branch ?? '').toUpperCase() == 'GOREGAON' ? 'ENT-GOREGAON' : 'ENT-KANDIVALI';
              Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => PaymentProfileChangeScreen(entityId: entityId),
              ));
            },
            icon: const Icon(Icons.account_balance_outlined, size: 18),
            label: const Text('Request payment profile change'),
          ),
        ],
      ),
    );
  }
}