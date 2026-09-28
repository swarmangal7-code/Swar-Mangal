import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';
import 'receipt_detail_screen.dart';

/// Fee collection.
/// founder: `api_addFeePayment` — real receipt, locked + countered + audited.
/// staff:   `api_staff_prepareReceiptDraft` — a draft that self-serves when
///          routine or waits for founder approval otherwise.
class FeeCollectionScreen extends StatefulWidget {
  const FeeCollectionScreen({super.key, required this.staff, this.prefill});
  final bool staff;
  final Student? prefill;
  @override
  State<FeeCollectionScreen> createState() => _FeeCollectionScreenState();
}

class _FeeCollectionScreenState extends State<FeeCollectionScreen> {
  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _txn = TextEditingController();
  final _receiptBook = TextEditingController();
  final _dueDate = TextEditingController();
  final _feeFrom = TextEditingController();
  final _feeTo = TextEditingController();
  final _notes = TextEditingController();
  final _monthsPaid = TextEditingController(text: '1');
  Student? _student;
  String _mode = 'Cash';
  bool _busy = false;
  String? _result;
  Map<String, dynamic>? _resData;
  List<String> _paymentModes = const ['Cash', 'Online'];
  late final String _requestId;
  Map<String, dynamic>? _pendingInstalment;
  String? _instalmentItemId;

  @override
  void initState() {
    super.initState();
    // ONE idempotency key per receipt form instance — reused on retry so a
    // network retry can never mint a second receipt server-side.
    _requestId = 'RCP-${DateTime.now().microsecondsSinceEpoch}';
    final boot = context.read<AuthProvider>().boot;
    if (boot?.paymentModes.isNotEmpty == true) _paymentModes = boot!.paymentModes;
    _student = widget.prefill;
    // The date money came in: today unless changed. (It used to prefill the
    // student's next DUE date, which is usually in the future.)
    _dueDate.text = _today();
    if (_student?.monthlyFee.isNotEmpty == true) _amount.text = _student!.monthlyFee;
    if (widget.staff && _student != null) _loadInstalmentPlan();
  }

  /// Brief §6.1: never compute an instalment amount on the device — only
  /// display what the server's own schedule already says is due next.
  Future<void> _loadInstalmentPlan() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null || _student == null) return;
    try {
      final r = await auth.service!.raw('api_instalmentPlanForStudent', {'studentId': _student!.studentId});
      final m = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _pendingInstalment = (m['hasPlan'] == true && (m['nextPendingItemId'] ?? '').toString().isNotEmpty) ? m : null;
        _instalmentItemId = null;
      });
    } catch (_) {
      // Non-critical lookup — a failure here should never block a payment.
    }
  }

  /// Amount owed right now, according to the student's own admission/fee
  /// plan — still fully editable after, for cases like multiple overdue
  /// cycles. Mirrors the web Fee Collection page's prefill behaviour.
  void _selectStudent(Student picked) {
    setState(() {
      _student = picked;
      if (picked.monthlyFee.isNotEmpty) _amount.text = picked.monthlyFee;
    });
    if (widget.staff) _loadInstalmentPlan();
  }

  void _useInstalment() {
    if (_pendingInstalment == null) return;
    setState(() {
      _amount.text = (_pendingInstalment!['nextPendingAmount'] ?? '').toString();
      _instalmentItemId = (_pendingInstalment!['nextPendingItemId'] ?? '').toString();
    });
  }

  @override
  void dispose() {
    for (final c in [_amount, _txn, _receiptBook, _dueDate, _feeFrom, _feeTo, _notes, _monthsPaid]) {
      c.dispose();
    }
    super.dispose();
  }

  /// Reads the amount back off the form rather than the parsed value, so the
  /// dialog shows exactly the digits that will be sent.
  Future<bool> _confirmRealMoney() async {
    final student = _student;
    if (student == null) return false;
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Record this receipt?'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('This writes a real receipt, a ledger entry and moves the '
                'student\'s next due date. It cannot be undone — only voided '
                'separately.', style: TextStyle(fontSize: 13, color: AppColors.adaptive(ctx, AppColors.muted))),
            const SizedBox(height: AppSpace.s3),
            InfoRow('Student', student.studentName),
            InfoRow('Amount', '₹${_amount.text.trim()}'),
            InfoRow('Mode', _mode),
            InfoRow('Payment date', _dueDate.text.trim()),
            if (_feeFrom.text.trim().isNotEmpty)
              InfoRow('Fee period', '${_feeFrom.text.trim()} – ${_feeTo.text.trim()}'),
            if (_txn.text.trim().isNotEmpty) InfoRow('Reference', _txn.text.trim()),
            if (_receiptBook.text.trim().isNotEmpty) InfoRow('Receipt book', _receiptBook.text.trim()),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Record receipt')),
        ],
      ),
    );
    return ok == true;
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    // The founder path writes real money (receipt + ledger + due-date advance)
    // with no draft to approve afterwards, so confirm the exact figures first.
    if (!widget.staff && !await _confirmRealMoney()) return;
    setState(() {
      _busy = true;
      _result = null;
      _resData = null;
    });
    try {
      final amount = num.tryParse(_amount.text.trim()) ?? 0;
      final m = widget.staff
          ? {
              'studentId': _student?.studentId ?? '',
              'branch': auth.branch ?? '',
              'amountPaise': (amount * 100).round(),
              'paymentDate': _dueDate.text.trim().isEmpty ? _today() : _dueDate.text.trim(),
              'packageStartDate': _feeFrom.text.trim(),
              'paymentMode': _mode,
              'paymentReference': _txn.text.trim(),
              'receivingAccountRef': _accountFor(_mode),
              'notes': _notes.text.trim(),
              'physicalReceiptNo': _mode.toUpperCase().contains('CASH') ? _receiptBook.text.trim() : '',
              'monthsPaid': _monthsPaid.text.trim().isEmpty ? '1' : _monthsPaid.text.trim(),
              'clientIntentKey': _requestId,
              if (_instalmentItemId != null) 'instalmentItemId': _instalmentItemId,
            }
          : {
              'studentId': _student?.studentId ?? '',
              'studentName': _student?.studentName ?? '',
              'phone': _student?.phone ?? '',
              'classCode': _student?.classCode ?? '',
              'paymentMode': _mode,
              'mode': _accountFor(_mode),
              'account': _accountFor(_mode),
              'txnId': _mode.toUpperCase().contains('CASH') ? '' : _txn.text.trim(),
              'physicalReceiptNo': _mode.toUpperCase().contains('CASH') ? _receiptBook.text.trim() : '',
              'amount': amount,
              'baseAmount': amount,
              'dueDate': _dueDate.text.trim(),
              'feeFrom': _feeFrom.text.trim(),
              'feeTo': _feeTo.text.trim(),
              'requestId': _requestId,
            };
      final r = widget.staff
          ? await auth.service!.raw('api_staff_prepareReceiptDraft', m)
          : await auth.service!.addFeePayment(m);
      final data = r as Map<String, dynamic>;
      if (!mounted) return;
      setState(() {
        _busy = false;
        _resData = data;
        _result = _message(data);
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _result = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _result = e.message;
      });
    }
  }

  /// Looks the just-issued receipt up by number and opens its detail screen.
  /// A failure here must never look like the payment failed — the money is
  /// already recorded, so this only reports that it could not be opened.
  Future<void> _openNewReceipt() async {
    final auth = context.read<AuthProvider>();
    final no = (_resData?['receiptNo'] ?? '').toString();
    if (auth.service == null || no.isEmpty) return;
    try {
      final rows = await auth.service!.searchReceipts(receiptNo: no, limit: 1);
      if (!mounted) return;
      final row = rows.isEmpty ? null : rows.first;
      if (row == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Receipt $no is recorded but not returned by search yet.')),
        );
        return;
      }
      await Navigator.of(context).push(
        MaterialPageRoute(builder: (_) => ReceiptDetailScreen(receipt: row)),
      );
    } on ApiException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  String _message(Map<String, dynamic> d) {
    if (d['ok'] == true) {
      final no = d['receiptNo'] ?? d['draftId'] ?? '';
      final routine = d['routine'] is Map && d['routine']['selfServe'] == true;
      String msg;
      if (widget.staff) {
        msg = routine
            ? 'Receipt ${d['receiptNo']} created (routine).'
            : 'Payment draft ${d['draftId']} saved — founder approval pending.'
                '${d['paymentPrompt'] == true ? ' Record the payment now → receipt.' : ''}';
      } else {
        msg = 'Receipt ${no != '' ? no : ''} created and recorded.';
      }
      if (d['demo'] == true) msg = '$msg (DEMO — not persisted)';
      return msg;
    }
    return (d['error'] ?? 'Could not record fee.').toString();
  }

  String _accountFor(String mode) {
    if (mode.toUpperCase().contains('CASH')) return 'Cash';
    if (mode.toUpperCase().contains('UPI')) return 'UPI';
    return mode;
  }

  String _today() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpace.s4),
      children: [
        if (_student == null)
          _studentPicker()
        else
          Card(
            child: ListTile(
              leading: Icon(Icons.person, color: AppColors.adaptive(context, AppColors.primary)),
              title: Text(_student!.studentName, style: const TextStyle(fontWeight: FontWeight.w800)),
              subtitle: Text('${_student!.studentId} · ${_student!.classCode} · ${_student!.phone}'),
              trailing: IconButton(
                icon: const Icon(Icons.close),
                onPressed: () => setState(() => _student = null),
              ),
            ),
          ),
        if (widget.staff && _pendingInstalment != null)
          Card(
            color: AppColors.adaptive(context, AppColors.okBg),
            margin: const EdgeInsets.only(top: AppSpace.s3),
            child: ListTile(
              leading: Icon(Icons.calendar_view_month_outlined, color: AppColors.adaptive(context, AppColors.okFg)),
              title: Text('Next instalment due: ₹${_pendingInstalment!['nextPendingAmount']}',
                  style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.adaptive(context, AppColors.okFg))),
              subtitle: const Text('From this student\'s active instalment plan'),
              trailing: _instalmentItemId == null
                  ? TextButton(onPressed: _useInstalment, child: const Text('Use this'))
                  : Icon(Icons.check_circle, color: AppColors.adaptive(context, AppColors.okFg)),
            ),
          ),
        const SizedBox(height: AppSpace.s3),
        Form(
          key: _formKey,
          child: Column(children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpace.s4),
                child: Column(children: [
                  // Wrapping chips: four modes in a segmented bar split words
                  // mid-letter on a phone ("Ban/k Tr/ans/fer").
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Wrap(
                      spacing: AppSpace.s2,
                      runSpacing: AppSpace.s2,
                      children: [
                        for (final p in _paymentModes)
                          ChoiceChip(
                            label: Text(p),
                            avatar: _mode == p
                                ? null
                                : Icon(Icons.circle,
                                    size: 10,
                                    color: p.toUpperCase().contains('CASH') ? AppColors.adaptive(context, AppColors.okFg) : AppColors.adaptive(context, AppColors.focus)),
                            selected: _mode == p,
                            onSelected: (_) => setState(() => _mode = p),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _amount,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    decoration: const InputDecoration(labelText: 'Amount (₹)', prefixIcon: Icon(Icons.currency_rupee)),
                    validator: (v) {
                      final n = num.tryParse(v ?? '');
                      return (n == null || n <= 0) ? 'Enter a valid amount' : null;
                    },
                  ),
                  const SizedBox(height: AppSpace.s3),
                  TextFormField(
                    controller: _dueDate,
                    readOnly: true,
                    onTap: () async {
                      final d = await showDatePicker(
                        context: context,
                        initialDate: DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2035),
                      );
                      if (d != null) {
                        _dueDate.text =
                            '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
                      }
                    },
                    decoration: const InputDecoration(labelText: 'Payment date', prefixIcon: Icon(Icons.event_outlined)),
                  ),
                  const SizedBox(height: AppSpace.s3),
                  // Owner rule: every fee payment carries a UTR or a
                  // receipt-book number — never neither.
                  if (_mode.toUpperCase().contains('CASH')) ...[
                    TextFormField(
                      controller: _receiptBook,
                      decoration: const InputDecoration(
                          labelText: 'Receipt-book number', prefixIcon: Icon(Icons.menu_book_outlined)),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? 'Cash payments need the receipt-book number'
                          : null,
                    ),
                    const SizedBox(height: AppSpace.s3),
                  ] else ...[
                    TextFormField(
                      controller: _txn,
                      decoration: const InputDecoration(
                          labelText: 'Transaction ID / UTR', prefixIcon: Icon(Icons.tag)),
                      validator: (v) => (v == null || v.trim().isEmpty)
                          ? 'Non-cash payments need a reference'
                          : null,
                    ),
                    const SizedBox(height: AppSpace.s3),
                  ],
                  TextFormField(
                    controller: _feeFrom,
                    readOnly: true,
                    onTap: () async {
                      final d = await showDatePicker(
                        context: context,
                        initialDate: DateTime.now(),
                        firstDate: DateTime(2020),
                        lastDate: DateTime(2035),
                      );
                      if (d != null) {
                        _feeFrom.text =
                            '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
                        // One month later, rolling December into January.
                        // (It used to skip zero-padding and keep December
                        // in the same year.)
                        final to = DateTime(d.year, d.month + 1, d.day);
                        _feeTo.text =
                            '${to.year}-${to.month.toString().padLeft(2, '0')}-${to.day.toString().padLeft(2, '0')}';
                      }
                    },
                    decoration: InputDecoration(
                        labelText: widget.staff ? 'Package / fee start date' : 'Fee period from',
                        prefixIcon: const Icon(Icons.date_range_outlined)),
                  ),
                  if (!widget.staff) ...[
                    const SizedBox(height: AppSpace.s3),
                    TextFormField(
                      controller: _feeTo,
                      readOnly: true,
                      decoration: const InputDecoration(labelText: 'Fee period to', prefixIcon: Icon(Icons.date_range_outlined)),
                    ),
                  ],
                  const SizedBox(height: AppSpace.s3),
                  if (widget.staff) ...[
                    const SizedBox(height: AppSpace.s3),
                    TextFormField(
                      controller: _monthsPaid,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                          labelText: 'Months paid', prefixIcon: Icon(Icons.date_range_outlined)),
                      validator: (v) {
                        final n = int.tryParse((v ?? '').trim());
                        return (n == null || n < 1) ? 'Enter how many months this covers' : null;
                      },
                    ),
                  ],
                  TextFormField(
                    controller: _notes,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'Notes (optional)'),
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
                    color: _messageIsOk(_resData) ? AppColors.adaptive(context, AppColors.okBg) : AppColors.adaptive(context, AppColors.blockBg),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Icon(_messageIsOk(_resData) ? Icons.check_circle_outline : Icons.error_outline,
                        size: 18, color: _messageIsOk(_resData) ? AppColors.adaptive(context, AppColors.okFg) : AppColors.adaptive(context, AppColors.blockFg)),
                    const SizedBox(width: AppSpace.s2),
                    Expanded(child: Text(_result!, style: const TextStyle(fontSize: 13))),
                  ]),
                ),
              ),
            // Founder-only: the receipt now exists, so hand them the one screen
            // that shows it rather than making them hunt for it.
            if (!widget.staff && _resData?['ok'] == true && (_resData?['receiptNo'] ?? '').toString().isNotEmpty)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: _openNewReceipt,
                  icon: const Icon(Icons.receipt_long_outlined, size: 18),
                  label: const Text('View receipt'),
                ),
              ),
            const SizedBox(height: AppSpace.s4),
            LoadingButton(
              label: widget.staff ? 'Submit payment draft' : 'Record receipt',
              icon: Icons.payments,
              busy: _busy,
              onPressed: _student == null ? null : _submit,
            ),
          ]),
        ),
      ],
    );
  }

  bool _messageIsOk(Map<String, dynamic>? d) => d?['ok'] == true;

  Widget _studentPicker() {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: Column(children: [
          Text('No student selected',
              style: TextStyle(fontWeight: FontWeight.w800, color: AppColors.adaptive(context, AppColors.muted))),
          const SizedBox(height: AppSpace.s2),
          Text('Open a student profile and tap "Collect / record fee", or search here.',
              style: TextStyle(fontSize: 13, color: AppColors.adaptive(context, AppColors.muted))),
          const SizedBox(height: AppSpace.s3),
          FilledButton.icon(
            onPressed: () async {
              final picked = await Navigator.of(context).push<Student>(
                MaterialPageRoute(builder: (_) => _PickerScreen(staff: widget.staff)),
              );
              if (picked != null && mounted) {
                _selectStudent(picked);
              }
            },
            icon: const Icon(Icons.person_search),
            label: const Text('Pick student'),
          ),
        ]),
      ),
    );
  }
}

class _PickerScreen extends StatefulWidget {
  const _PickerScreen({required this.staff});
  final bool staff;
  @override
  State<_PickerScreen> createState() => _PickerScreenState();
}

class _PickerScreenState extends State<_PickerScreen> {
  final _q = TextEditingController();
  List<Student>? _rows;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _search('');
  }

  Future<void> _search(String q) async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() => _busy = true);
    try {
      final rows = widget.staff
          ? await auth.service!.staffSearchStudents(q, branch: auth.branch ?? 'ALL')
          : await auth.service!.searchStudents(q);
      if (!mounted) return;
      setState(() {
        _rows = rows;
        _busy = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Pick student')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(AppSpace.s4),
          child: SearchField(controller: _q, hint: 'Name or phone', onChanged: _search),
        ),
        Expanded(
          child: _busy
              ? const Center(child: CircularProgressIndicator())
              : (_rows == null || _rows!.isEmpty)
                  ? const EmptyState('No students matched')
                  : ListView.separated(
                      itemCount: _rows!.length,
                      separatorBuilder: (_, _) => const Divider(height: 1),
                      itemBuilder: (c, i) {
                        final s = _rows![i];
                        return ListTile(
                          title: Text(s.studentName,
                              style: const TextStyle(fontWeight: FontWeight.w700)),
                          subtitle: Text('${s.studentId} · ${s.classCode} · ${s.phone}'),
                          onTap: () => Navigator.of(context).pop(s),
                        );
                      },
                    ),
        ),
      ]),
    );
  }
}