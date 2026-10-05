import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../state/auth_provider.dart';
import '../../state/sync_manager.dart';
import '../../widgets/atmosphere.dart';
import '../../widgets/anim.dart';
import '../../widgets/atoms.dart';
import '../shared/staff_access_screen.dart';

/// Inherited handle letting a body screen switch the shell's current view.
class ShellNavigator extends InheritedWidget {
  const ShellNavigator({super.key, required this.go, required super.child});
  final void Function(String key) go;

  static ShellNavigator of(BuildContext context) {
    final n = context.dependOnInheritedWidgetOfExactType<ShellNavigator>();
    assert(n != null, 'ShellNavigator missing — screens must live inside DrawerShell');
    return n!;
  }

  @override
  bool updateShouldNotify(ShellNavigator oldWidget) => go != oldWidget.go;
}

/// Drawer-driven shell reused by both apps. Each nav item maps to a body
/// widget built lazily on selection. Optional `sections` group items under
/// quiet semantic labels (premium navigation hierarchy).
class DrawerShell extends StatefulWidget {
  const DrawerShell({
    super.key,
    required this.title,
    required this.navItems,
    required this.buildBody,
    this.sections,
    this.headerTrailing,
    this.branchChip,
  });

  final String title;
  final List<({String key, String label, IconData icon})> navItems;
  final Widget Function(BuildContext, String key) buildBody;

  /// Group definition: label + the item keys it contains (drawn in order).
  final List<({String label, List<String> keys})>? sections;
  final Widget? headerTrailing;
  final Widget? branchChip;

  @override
  State<DrawerShell> createState() => _DrawerShellState();
}

class _DrawerShellState extends State<DrawerShell> {
  String _current = '';
  final List<String> _history = [];

  @override
  void initState() {
    super.initState();
    _current = widget.navItems.first.key;
  }

  /// Switch to [key], recording the previous tab so Android back can return
  /// to it. Does NOT pop — the caller decides whether to close the drawer.
  void _go(String key) {
    if (key == _current) return;
    setState(() {
      _history.add(_current);
      _current = key;
    });
  }

  bool _hasContextRow(AuthProvider auth) =>
      auth.isDemo || widget.branchChip != null || widget.headerTrailing != null;

  /// Slim row under the app bar: which branch you are in, the switcher, and
  /// the DEMO marker. Never scaled down — the branch must always be readable.
  PreferredSizeWidget _contextRow(AuthProvider auth, ColorScheme scheme) {
    return PreferredSize(
      preferredSize: const Size.fromHeight(40),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpace.s4, 0, AppSpace.s2, AppSpace.s2),
        child: Row(children: [
          if (widget.branchChip != null) widget.branchChip!,
          if (widget.headerTrailing != null)
            SizedBox(height: 32, child: FittedBox(child: widget.headerTrailing!)),
          if (auth.isDemo) ...[
            const SizedBox(width: AppSpace.s2),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: AppRadius.s, vertical: 4),
              decoration: BoxDecoration(
                color: scheme.primary,
                borderRadius: BorderRadius.circular(AppRadius.pill),
              ),
              child: Text('DEMO',
                  style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: Theme.of(context).brightness == Brightness.dark
                          ? const Color(0xFF261A08)
                          : Colors.white)),
            ),
          ],
        ]),
      ),
    );
  }

  /// Android system back: go to the previously opened tab. If already on the
  /// home (today) tab, this is the last tab — allow PopScope canPop to close
  /// the app.
  bool get _isHome => _current == widget.navItems.first.key;

  Future<void> _onBack() async {
    if (_history.isNotEmpty) {
      setState(() => _current = _history.removeLast());
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final scheme = Theme.of(context).colorScheme;
    final current = widget.navItems.firstWhere(
        (n) => n.key == _current, orElse: () => widget.navItems.first);
    return PopScope(
      canPop: _isHome && _history.isEmpty,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _onBack();
      },
      child: Scaffold(
      appBar: AppBar(
        // A phone gives the title, badges and actions ~360dp. Squeezing them
        // into one line hid the screen name and shrank the branch badge until
        // it was unreadable, so the badges get their own slim row below.
        title: Text(current.label, maxLines: 1, overflow: TextOverflow.ellipsis),
        bottom: _hasContextRow(auth) ? _contextRow(auth, scheme) : null,
        actions: [
          Consumer<SyncManager>(builder: (context, sync, _) => _SyncChip(sync: sync)),
          Consumer<ThemeController>(
            builder: (context, theme, _) => IconButton(
              tooltip: theme.isDark ? 'Light mode' : 'Dark mode',
              icon: Icon(theme.isDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined),
              onPressed: theme.toggle,
            ),
          ),
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      drawer: _drawer(context, auth),
body: Atmosphere(
        child: ViewSwitch(
          child: ShellNavigator(
            go: _go,
            child: KeyedSubtree(
              key: ValueKey<String>(_current),
              child: widget.buildBody(context, _current),
            ),
          ),
        ),
      ),
      ),
    );
  }

Widget _drawer(BuildContext context, AuthProvider auth) {
    final scheme = Theme.of(context).colorScheme;
    final dark = Theme.of(context).brightness == Brightness.dark;
    final navBg = dark ? AppColors.dSurface : AppColors.navy;
    final navText = AppColors.dMuted;
    return Drawer(
      backgroundColor: navBg,
      child: Container(
        decoration: BoxDecoration(color: navBg),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            // Brand lockup — quiet monogram + two-line wordmark + descriptor.
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpace.s5, AppSpace.s6, AppSpace.s5, AppSpace.s4),
              child: Row(children: [
                Container(
                  width: 46,
                  height: 46,
                  decoration: const BoxDecoration(
                    gradient: AppGradients.brass,
                    shape: BoxShape.circle,
                    boxShadow: [AppShadows.subtle],
                  ),
                  child: const Icon(Icons.music_note, color: AppColors.navy, size: 23),
                ),
                const SizedBox(width: AppSpace.s3),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Swar Mangal',
                      style: TextStyle(
                          fontFamily: AppFonts.display,
                          color: Colors.white,
                          fontWeight: FontWeight.w600,
                          fontSize: 18)),
                  Text('MUSIC ACADEMY',
                      style: AppType.eyebrow.copyWith(color: navText, fontSize: 9.5)),
                ]),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpace.s4),
              child: Divider(color: Colors.white.withValues(alpha: .08), height: 1),
            ),
            const SizedBox(height: AppSpace.s2),
            // Grouped navigation with quiet section labels.
            for (final group in _groups) ...[
              if (group.label.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(AppSpace.s5, AppSpace.s3, AppSpace.s5, AppSpace.s2),
child: Text(group.label.toUpperCase(),
                      style: AppType.eyebrow.copyWith(
                        color: AppColors.dMuted.withValues(alpha: .75),
                        fontSize: 10,
                      )),
                ),
              for (final item in group.items) _navTile(item, scheme, dark),
            ],
            SizedBox(height: AppSpace.s3 + MediaQuery.of(context).padding.bottom),
          ],
        ),
      ),
    );
  }

  List<({String label, List<({String key, String label, IconData icon})> items})> get _groups {
    if (widget.sections == null || widget.sections!.isEmpty) {
      return [(label: '', items: widget.navItems)];
    }
    final byKey = <String, ({String key, String label, IconData icon})>{
      for (final it in widget.navItems) it.key: it,
    };
    return [
      for (final s in widget.sections!)
        (label: s.label, items: [for (final k in s.keys) if (byKey.containsKey(k)) byKey[k]!]),
    ];
  }

  Widget _navTile(({String key, String label, IconData icon}) item,
      ColorScheme scheme, bool dark) {
    final selected = _current == item.key;
    return Padding(
padding: const EdgeInsets.symmetric(horizontal: AppSpace.s3 + 2, vertical: 1),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(AppRadius.s),
        child: InkWell(
          onTap: () {
            _go(item.key);
            // Close the drawer explicitly (it's a pushed modal route; the
            // home route itself is guarded by PopScope, so this is safe).
            Navigator.of(context).pop();
          },
          borderRadius: BorderRadius.circular(AppRadius.s),
          child: Container(
            height: 42,
            padding: const EdgeInsets.symmetric(horizontal: AppSpace.s3),
            decoration: BoxDecoration(
              color: selected ? Colors.white.withValues(alpha: .08) : Colors.transparent,
              borderRadius: BorderRadius.circular(AppRadius.s),
            ),
            child: Row(children: [
              Icon(
                item.icon,
                size: 18,
                color: selected ? AppColors.brass : AppColors.dMuted,
              ),
              const SizedBox(width: AppSpace.s3),
              Expanded(
                child: Text(
                  item.label,
                  style: TextStyle(
                    color: selected ? Colors.white : AppColors.dMuted,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    fontSize: 13.5,
                  ),
                ),
              ),
              if (selected)
                Container(
                  width: 3,
                  height: 18,
                  decoration: BoxDecoration(
                    color: AppColors.brass,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
            ]),
          ),
        ),
      ),
    );
  }
}

/// Top-level choices offered to founder and staff, rendered by each shell.
const founderItems = <({String key, String label, IconData icon})>[
  (key: 'home', label: 'Home', icon: Icons.home_outlined),
  (key: 'approvals', label: 'Approvals', icon: Icons.fact_check_outlined),
  (key: 'students', label: 'Students', icon: Icons.person_search_outlined),
  (key: 'addStudent', label: 'Add Student', icon: Icons.person_add_alt_1_outlined),
  (key: 'demoStudents', label: 'Demo Students', icon: Icons.science_outlined),
  (key: 'addFee', label: 'Add Fee', icon: Icons.payments_outlined),
  (key: 'receipts', label: 'Receipts', icon: Icons.receipt_long_outlined),
  (key: 'teachers', label: 'Teachers', icon: Icons.group_outlined),
  (key: 'inquiries', label: 'Inquiries', icon: Icons.chat_outlined),
  (key: 'expenses', label: 'Expenses & Cashbook', icon: Icons.account_balance_wallet_outlined),
  (key: 'payouts', label: 'Teacher Payouts', icon: Icons.payments_outlined),
  (key: 'payoutSettings', label: 'Payroll Rules', icon: Icons.rule_folder_outlined),
  (key: 'feeRateCard', label: 'Fee Rate Card', icon: Icons.sell_outlined),
  (key: 'timetable', label: 'Timetable', icon: Icons.calendar_month_outlined),
  (key: 'schoolInvoice', label: 'School Invoice', icon: Icons.receipt_outlined),
  (key: 'auditLog', label: 'Activity Log', icon: Icons.history_outlined),
  (key: 'about', label: 'About', icon: Icons.info_outline),
];

const staffItems = <({String key, String label, IconData icon})>[
  (key: 'today', label: 'Today', icon: Icons.today_outlined),
  (key: 'todayClasses', label: 'Today\'s Classes', icon: Icons.schedule_outlined),
  (key: 'students', label: 'Students', icon: Icons.people_outline),
  (key: 'addStudent', label: 'Add Student (Draft)', icon: Icons.person_add_alt_1_outlined),
  (key: 'demoStudents', label: 'Demo Students', icon: Icons.science_outlined),
  (key: 'attendance', label: 'Attendance', icon: Icons.fact_check_outlined),
  (key: 'addFee', label: 'Add Fee', icon: Icons.payments_outlined),
  (key: 'receipts', label: 'Receipts', icon: Icons.receipt_long_outlined),
  (key: 'expenses', label: 'Expenses', icon: Icons.account_balance_wallet_outlined),
  (key: 'inquiries', label: 'Inquiries', icon: Icons.chat_outlined),
  (key: 'requests', label: 'My Requests', icon: Icons.outbox_outlined),
  (key: 'teachers', label: 'Teachers', icon: Icons.group_outlined),
  (key: 'timetable', label: 'Timetable', icon: Icons.calendar_month_outlined),
  (key: 'feeRateCard', label: 'Fee Rate Card', icon: Icons.sell_outlined),
  (key: 'schoolInvoice', label: 'School Invoice', icon: Icons.receipt_outlined),
  (key: 'about', label: 'About', icon: Icons.info_outline),
];

class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key, required this.staff});
  final bool staff;
  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    return ListView(
      padding: const EdgeInsets.all(AppSpace.s4),
      children: [
        const Card(
          child: Padding(
            padding: EdgeInsets.all(AppSpace.s4),
            child: Row(children: [
              Icon(Icons.music_note, size: 36, color: AppColors.primary),
              SizedBox(width: AppSpace.s3),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('Swar Mangal', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                  Text('Music Academy ERP · v1.0.0', style: TextStyle(fontSize: 13, color: AppColors.muted)),
                ]),
              ),
            ]),
          ),
        ),
        const SectionTitle('Session'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpace.s4),
            child: Column(children: [
              InfoRow('App', staff ? 'Staff' : 'Founder'),
              InfoRow('Role', auth.operator?.role ?? ''),
              InfoRow('Operator', auth.operator?.email ?? ''),
              InfoRow('Branch', auth.branch ?? '—'),
            ]),
          ),
        ),
        SectionTitle('Backend'),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(AppSpace.s4),
            child: Column(children: [
              InfoRow('Scope', 'Device-token gateway on Railway /api/rpc'),
              InfoRow('Money path', 'Server-authoritative · lock · counter · audit'),
            ]),
          ),
        ),
        if (!staff) ...[
          const SizedBox(height: AppSpace.s3),
          OutlinedButton.icon(
            onPressed: () => Navigator.of(context).push(MaterialPageRoute(
              builder: (_) => const StaffAccessScreen(),
            )),
            icon: const Icon(Icons.badge_outlined, size: 18),
            label: const Text('Manage staff access'),
          ),
        ],
        const Card(
          child: Padding(
            padding: EdgeInsets.all(AppSpace.s4),
            child: Text(
              'All business rules (receipt numbering, late fees, terms gates, '
              'idempotency) run on the server. This app never computes money '
              'values on-device.',
              style: TextStyle(fontSize: 12, color: AppColors.muted),
            ),
          ),
        ),
      ],
    );
  }
}
/// Subtle global sync state indicator in the shell AppBar.
class _SyncChip extends StatelessWidget {
  const _SyncChip({required this.sync});
  final SyncManager sync;

@override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    String label;
    Color dot;
    switch (sync.state) {
      case SyncState.syncing:
        label = 'Syncing…';
        dot = scheme.primary;
        break;
      case SyncState.offline:
        label = 'Offline';
        dot = AppColors.blockFg;
        break;
      case SyncState.syncError:
        label = 'Sync error';
        dot = AppColors.blockFg;
        break;
      case SyncState.synced:
      case SyncState.online:
        label = 'Synced just now';
        dot = AppColors.okFg;
        break;
    }
    // Phones get the dot only: the label ate the title's space. The full state
    // stays available in the tooltip and to screen readers.
    final compact = MediaQuery.sizeOf(context).width < 600;
    final last = sync.lastSyncedAt != null ? sync.lastSyncedAt!.toString() : '—';
    return Tooltip(
      message: '$label · last synced $last',
      child: Semantics(
        label: label,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
            if (!compact) ...[
              const SizedBox(width: 6),
              Text(label, style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant)),
            ],
          ]),
        ),
      ),
    );
  }
}
