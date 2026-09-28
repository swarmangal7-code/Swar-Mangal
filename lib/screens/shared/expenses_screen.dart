import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../state/sync_manager.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import '../../models/models.dart';
import '../../state/auth_provider.dart';
import '../../widgets/atoms.dart';

/// Expenses.
/// staff:   submits an expense DRAFT (founder approval, no ledger write).
/// founder: records a real expense (locked + idempotency-guarded) and reads
///          the cashbook.
class ExpensesScreen extends StatefulWidget {
  const ExpensesScreen({super.key, required this.staff});
  final bool staff;
  @override
  State<ExpensesScreen> createState() => _ExpensesScreenState();
}

class _ExpensesScreenState extends State<ExpensesScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      // Staff only have the log, so a one-option switcher is just noise.
      if (!widget.staff)
      Padding(
        padding: const EdgeInsets.all(AppSpace.s4),
        child: SegmentedButton<int>(
          segments: [
            const ButtonSegment<int>(value: 0, label: Text('Log'),
                icon: Icon(Icons.edit_note, size: 18)),
            if (!widget.staff)
              const ButtonSegment<int>(value: 1, label: Text('Cashbook'),
                  icon: Icon(Icons.menu_book_outlined, size: 18)),
          ],
          selected: {_tab},
          onSelectionChanged: (s) => setState(() => _tab = s.first),
        ),
      ),
      Expanded(
        child: _tab == 0
            ? _ExpenseForm(staff: widget.staff)
            : const _CashbookView(),
      ),
    ]);
  }
}

class _ExpenseForm extends StatefulWidget {
  const _ExpenseForm({required this.staff});
  final bool staff;
  @override
  State<_ExpenseForm> createState() => _ExpenseFormState();
}

class _ExpenseFormState extends State<_ExpenseForm> with SyncAware {
  @override
  Set<String> get syncEntities => const {'expenses'};

  @override
  Future<void> reloadFromSync() => Future.value();

  final _formKey = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _category = TextEditingController();
  final _paidTo = TextEditingController();
  final _account = TextEditingController();
  final _notes = TextEditingController();
  final _ref = TextEditingController();
  final _paidBy = TextEditingController();
  final _description = TextEditingController();
  final _expenseDate = TextEditingController();
  late final String _idemKey;
  bool _busy = false;
  bool _reimbursement = false;
  String? _result;
  bool _ok = false;
  late String _mode;
  late String _branch;

  static const _categories = ['Rent', 'Salary', 'Utilities', 'Maintenance', 'Instruments', 'Marketing', 'Travel', 'Other'];

  Bootstrap? get _boot => context.read<AuthProvider>().boot;
  List<String> get _modes => (_boot?.paymentModes.isNotEmpty ?? false) ? _boot!.paymentModes : const ['Cash', 'UPI', 'Bank Transfer', 'Cheque'];
  List<String> get _accounts => _boot?.accounts ?? const [];
  List<String> get _branches {
    final b = context.read<AuthProvider>().branches;
    return b.isEmpty ? const ['GOREGAON', 'KANDIVALI'] : b;
  }

  @override
  void initState() {
    super.initState();
    // ONE idempotency key per form instance — reused across network retries so
    // a retry can never create a duplicate expense on the server.
    _idemKey = 'EXP-${DateTime.now().microsecondsSinceEpoch}';
    final auth = context.read<AuthProvider>();
    final modes = auth.boot?.paymentModes ?? const <String>[];
    // The server's own payment-mode list, so a cash expense can be recorded.
    // It used to be hardcoded to 'UPI' on both paths.
    _mode = modes.isNotEmpty ? modes.first : 'Cash';
    _expenseDate.text = _today();
    _branch = auth.branch ?? '';
  }

  @override
  void dispose() {
    for (final c in [_amount, _category, _paidTo, _account, _notes, _ref, _paidBy, _description, _expenseDate]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final amount = num.tryParse(_amount.text.trim()) ?? 0;
      final today = _expenseDate.text.trim().isEmpty ? _today() : _expenseDate.text.trim();
      // Backend EXPENSE_ENTRY_TYPES are specific (DAILY_EXPENSE/RENT/...).
      // Map the category to a valid server type — never the invalid 'EXPENSE'.
      final entryType = _category.text.trim().toUpperCase() == 'RENT'
          ? 'RENT'
          : 'DAILY_EXPENSE';
      final desc = _description.text.trim().isEmpty ? _paidTo.text.trim() : _description.text.trim();
      final payload = widget.staff
          ? {
              'amountPaise': (amount * 100).round(),
              'branch': _branch,
              'category': _category.text.trim(),
              'payee': _paidTo.text.trim(),
              'description': desc,
              'mode': _mode,
              'sourceAccount': _account.text.trim(),
              'expenseDate': today,
              'reference': _ref.text.trim(),
              'notes': _notes.text.trim(),
              'reimbursementRequired': _reimbursement,
              if (_reimbursement) 'paidBy': _paidBy.text.trim(),
            }
          : {
              'entryDate': today,
              'entryType': entryType,
              'category': _category.text.trim(),
              'paidTo': _paidTo.text.trim(),
              'description': desc,
              'amount': amount,
              'paymentMode': _mode,
              'account': _account.text.trim(),
              'entityId': _entityFor(_branch),
              'requestId': _idemKey,
              'notes': _notes.text.trim(),
            };
      final r = widget.staff
          ? await auth.service!.raw('api_staff_submitExpenseDraft', payload)
          : await auth.service!.addExpenseEntry(payload);
      final m = r as Map<String, dynamic>;
      final demo = auth.isDemo || m['demo'] == true;
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = m['ok'] == true;
        _result = m['ok'] == true
            ? (widget.staff
                ? 'Expense draft saved for founder approval.'
                : 'Expense recorded (${m['entryId'] ?? '—'}).')
            : (m['error'] ?? 'Could not save.').toString();
        if (demo && _ok) _result = '$_result (DEMO — not persisted)';
      });
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = false;
        _result = e.message;
      });
    } on ApiUnreachable catch (e) {
      if (!mounted) return;
      setState(() {
        _busy = false;
        _ok = false;
        _result = e.message;
      });
    }
  }

  String _entityFor(String branch) {
    if (branch == 'KANDIVALI') return 'ENT-KANDIVALI';
    if (branch == 'GOREGAON') return 'ENT-GOREGAON';
    return '';
  }

  String _today() {
    final now = DateTime.now();
    return '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(AppSpace.s4, 0, AppSpace.s4, AppSpace.s6),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpace.s4),
              child: Column(children: [
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
                  controller: _category,
                  readOnly: true,
                  decoration: const InputDecoration(labelText: 'Category', prefixIcon: Icon(Icons.category_outlined)),
                  onTap: () => _pickCategory(),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Pick a category' : null,
                ),
                const SizedBox(height: AppSpace.s3),
                TextFormField(
                  controller: _paidTo,
                  textCapitalization: TextCapitalization.words,
                  decoration: const InputDecoration(labelText: 'Paid to / what for', prefixIcon: Icon(Icons.storefront_outlined)),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Describe the payment' : null,
                ),
                const SizedBox(height: AppSpace.s3),
                TextFormField(
                  controller: _description,
                  decoration: const InputDecoration(labelText: 'Description (optional)', prefixIcon: Icon(Icons.notes_outlined)),
                ),
                const SizedBox(height: AppSpace.s3),
                // Server's own payment-mode list — a cash expense has to be
                // recordable, so this is a picker, not a fixed 'UPI'.
                DropdownButtonFormField<String>(
                  initialValue: _mode,
                  decoration: const InputDecoration(labelText: 'Payment mode *', prefixIcon: Icon(Icons.payments_outlined)),
                  items: [
                    for (final m in _modes) DropdownMenuItem(value: m, child: Text(m)),
                  ],
                  onChanged: (v) => setState(() => _mode = v ?? _mode),
                ),
                const SizedBox(height: AppSpace.s3),
                TextFormField(
                  controller: _account,
                  decoration: const InputDecoration(labelText: 'Paid from (account)', prefixIcon: Icon(Icons.account_balance_outlined)),
                  validator: (v) => (v == null || v.trim().isEmpty) ? 'Account is required' : null,
                ),
                if (_accounts.isNotEmpty) ...[
                  const SizedBox(height: AppSpace.s2),
                  Wrap(
                    spacing: AppSpace.s2,
                    runSpacing: AppSpace.s2,
                    children: [
                      for (final a in _accounts)
                        ActionChip(
                          label: Text(a, style: const TextStyle(fontSize: 12)),
                          onPressed: () => _account.text = a,
                        ),
                    ],
                  ),
                ],
                const SizedBox(height: AppSpace.s3),
                TextFormField(
                  controller: _expenseDate,
                  readOnly: true,
                  onTap: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: DateTime.tryParse(_expenseDate.text) ?? DateTime.now(),
                      firstDate: DateTime(2020),
                      lastDate: DateTime.now().add(const Duration(days: 1)),
                    );
                    if (d != null) {
                      _expenseDate.text =
                          '${d.year}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
                    }
                  },
                  decoration: const InputDecoration(labelText: 'Expense date', prefixIcon: Icon(Icons.event_outlined)),
                ),
                if (!widget.staff && _branches.length > 1) ...[
                  const SizedBox(height: AppSpace.s3),
                  DropdownButtonFormField<String>(
                    initialValue: _branch,
                    decoration: const InputDecoration(labelText: 'Branch / entity', prefixIcon: Icon(Icons.storefront_outlined)),
                    items: [
                      for (final b in _branches) DropdownMenuItem(value: b, child: Text(b)),
                    ],
                    onChanged: (v) => setState(() => _branch = v ?? _branch),
                  ),
                ],
                const SizedBox(height: AppSpace.s3),
                TextFormField(
                  controller: _ref,
                  decoration: const InputDecoration(labelText: 'Reference / UTR (for non-cash)', prefixIcon: Icon(Icons.tag)),
                ),
                const SizedBox(height: AppSpace.s3),
                TextFormField(
                  controller: _notes,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Notes'),
                ),
                if (widget.staff) ...[
                  const SizedBox(height: AppSpace.s2),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    value: _reimbursement,
                    onChanged: (v) => setState(() => _reimbursement = v),
                    title: const Text('Someone paid out of pocket, needs reimbursing', style: TextStyle(fontSize: 13)),
                  ),
                  if (_reimbursement) ...[
                    const SizedBox(height: AppSpace.s2),
                    TextFormField(
                      controller: _paidBy,
                      decoration: const InputDecoration(labelText: 'Who paid *', prefixIcon: Icon(Icons.person_outline)),
                      validator: (v) => (_reimbursement && (v == null || v.trim().isEmpty)) ? 'Say who paid, so they are reimbursed' : null,
                    ),
                  ],
                ],
              ]),
            ),
          ),
          if (_result != null)
            Padding(
              padding: const EdgeInsets.only(top: AppSpace.s3),
              child: Container(
                padding: const EdgeInsets.all(AppSpace.s3),
                decoration: BoxDecoration(
                  color: _ok ? AppColors.adaptive(context, AppColors.okBg) : AppColors.adaptive(context, AppColors.blockBg),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Icon(_ok ? Icons.check_circle_outline : Icons.error_outline, size: 18,
                      color: _ok ? AppColors.adaptive(context, AppColors.okFg) : AppColors.adaptive(context, AppColors.blockFg)),
                  const SizedBox(width: AppSpace.s2),
                  Expanded(child: Text(_result!, style: TextStyle(fontSize: 13, color: _ok ? AppColors.adaptive(context, AppColors.okFg) : AppColors.adaptive(context, AppColors.blockFg)))),
                ]),
              ),
            ),
          const SizedBox(height: AppSpace.s4),
          LoadingButton(
            label: widget.staff ? 'Submit expense' : 'Record expense',
            icon: Icons.account_balance_wallet,
            busy: _busy,
            onPressed: _submit,
          ),
        ],
      ),
    );
  }

  void _pickCategory() {
    showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: ListView(shrinkWrap: true, children: [
          for (final c in _categories)
            ListTile(
              title: Text(c),
              onTap: () {
                Navigator.pop(ctx, c);
              },
            ),
        ]),
      ),
    ).then((c) {
      if (c != null) setState(() => _category.text = c);
    });
  }
}

class _CashbookView extends StatefulWidget {
  const _CashbookView();
  @override
  State<_CashbookView> createState() => _CashbookViewState();
}

class _CashbookViewState extends State<_CashbookView> {
  List<ExpenseEntry> _rows = [];
  String? _error;
  bool _busy = true;
  String _branch = 'ALL';
  String _month = '';
  final _monthCtrl = TextEditingController();

  @override
  void dispose() {
    _monthCtrl.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _fetch();
  }

  Future<void> _fetch() async {
    final auth = context.read<AuthProvider>();
    if (auth.service == null) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final rows = await auth.service!.cashbookReport(
        branch: _branch,
        from: _month.isEmpty ? '' : '$_month-01',
        to: _month.isEmpty ? '' : _endOf(_month),
      );
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

  /// Last day of a `YYYY-MM` string — day 0 of the next month is that day.
  static String _endOf(String month) {
    final parts = month.split('-');
    final y = int.tryParse(parts.first) ?? DateTime.now().year;
    final m = int.tryParse(parts.length > 1 ? parts[1] : '1') ?? 1;
    final last = DateTime(y, m + 1, 0).day;
    return '$month-${last.toString().padLeft(2, '0')}';
  }

  bool _inflow(ExpenseEntry e) => e.type.toUpperCase().contains('INFLOW');

  @override
  Widget build(BuildContext context) {
    if (_busy && _rows.isEmpty) return const Center(child: CircularProgressIndicator());
    if (_error != null && _rows.isEmpty) return ErrorView(_error!, onRetry: _fetch);
    final inflow = _rows.where(_inflow).fold<double>(0, (s, e) => s + e.amount);
    final outflow = _rows.where((e) => !_inflow(e)).fold<double>(0, (s, e) => s + e.amount);
    final branches = context.read<AuthProvider>().branches.isEmpty
        ? const ['GOREGAON', 'KANDIVALI']
        : context.read<AuthProvider>().branches;
    return RefreshScaffold(
      onRefresh: _fetch,
      child: Column(children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(AppSpace.s4, AppSpace.s3, AppSpace.s4, 0),
          child: Row(children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                initialValue: _branch,
                isDense: true,
                decoration: const InputDecoration(labelText: 'Branch', isDense: true),
                items: [
                  const DropdownMenuItem(value: 'ALL', child: Text('All branches')),
                  for (final b in branches) DropdownMenuItem(value: b, child: Text(b)),
                ],
                onChanged: (v) {
                  setState(() => _branch = v ?? 'ALL');
                  _fetch();
                },
              ),
            ),
            const SizedBox(width: AppSpace.s2),
            Expanded(
              child: TextFormField(
                controller: _monthCtrl,
                readOnly: true,
                decoration: const InputDecoration(labelText: 'Month', hintText: 'All time', isDense: true),
                onTap: () async {
                  final now = DateTime.now();
                  final p = await showDatePicker(
                    context: context,
                    initialDate: DateTime(now.year, now.month),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(now.year + 1, 12),
                    helpText: 'Pick any day in the month',
                    fieldLabelText: 'Month',
                  );
                  if (p != null) {
                    _monthCtrl.text = '${p.year}-${p.month.toString().padLeft(2, '0')}';
                    setState(() => _month = _monthCtrl.text);
                    _fetch();
                  }
                },
              ),
            ),
          ]),
        ),
        if (_month.isNotEmpty)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              onPressed: () {
                _monthCtrl.clear();
                setState(() => _month = '');
                _fetch();
              },
              child: const Text('Clear month'),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: AppSpace.s2),
          child: Row(children: [
            Expanded(
              child: StatTile(
                label: 'In',
                value: inr(inflow),
                icon: Icons.south_east,
                accent: AppColors.okFg,
              ),
            ),
            const SizedBox(width: AppSpace.s2),
            Expanded(
              child: StatTile(
                label: 'Out',
                value: inr(outflow),
                icon: Icons.north_west,
                accent: AppColors.blockFg,
              ),
            ),
            const SizedBox(width: AppSpace.s2),
            Expanded(
              child: StatTile(
                label: 'Net',
                value: inr(inflow - outflow),
                icon: Icons.account_balance_outlined,
                accent: inflow - outflow < 0 ? AppColors.blockFg : AppColors.okFg,
              ),
            ),
          ]),
        ),
        Expanded(
          child: _rows.isEmpty
              ? const EmptyState('No cashbook entries')
              : ListView.separated(
                  padding: const EdgeInsets.only(bottom: AppSpace.s6),
                  itemCount: _rows.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (c, i) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4, vertical: AppSpace.s3),
                    child: Row(children: [
                      Icon(_inflow(_rows[i]) ? Icons.south_east : Icons.north_west,
                          size: 18,
                          color: _inflow(_rows[i])
                              ? AppColors.adaptive(context, AppColors.okFg)
                              : AppColors.adaptive(context, AppColors.blockFg)),
                      const SizedBox(width: AppSpace.s3),
                      Expanded(
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text('${_rows[i].category} · ${_rows[i].description}',
                              style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                          Text('${_rows[i].date} · ${_rows[i].mode}',
                              style: TextStyle(fontSize: 12, color: AppColors.adaptive(context, AppColors.muted))),
                        ]),
                      ),
                      Text(inr(_rows[i].amount),
                          style: TextStyle(
                              fontWeight: FontWeight.w800,
                              color: _inflow(_rows[i])
                                  ? AppColors.adaptive(context, AppColors.okFg)
                                  : AppColors.adaptive(context, AppColors.blockFg))),
                    ]),
                  ),
                ),
        ),
      ]),
    );
  }
}