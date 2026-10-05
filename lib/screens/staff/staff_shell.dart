import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../../core/theme.dart';
import '../../state/auth_provider.dart';
import '../shell/shell_nav.dart';
import 'screens/staff_dashboard.dart';
import '../shared/add_student_screen.dart';
import '../shared/demo_students_screen.dart';
import '../shared/attendance_screen.dart';
import '../shared/expenses_screen.dart';
import '../shared/fee_collection_screen.dart';
import '../shared/inquiries_screen.dart';
import '../shared/receipts_screen.dart';
import '../shared/students_screen.dart';
import '../shared/teachers_screen.dart';
import '../shared/todays_classes_screen.dart';
import '../shared/my_requests_screen.dart';
import '../shared/timetable_screen.dart';
import '../shared/fee_rate_card_view_screen.dart';
import '../shared/school_invoice_screen.dart';

/// Staff surface. Branch-gated: every read/write is isolated to the branch
/// picked by the operator at the door (server-enforced, same rule as web).
class StaffShell extends StatelessWidget {
  const StaffShell({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    if (auth.branch == null) return const BranchGate();
    return KeyedSubtree(
      // Remounts every screen when the branch changes so no stale data from a
      // previous branch can remain visible (cross-branch isolation).
      key: ValueKey<String>(auth.branch!),
      child: DrawerShell(
        title: 'Staff',
        navItems: staffItems,
        branchChip: _BranchChip(auth.branch!),
        headerTrailing: _BranchSwitcher(
          current: auth.branch!,
          branches: auth.branches.isEmpty
              ? const ['GOREGAON', 'KANDIVALI']
              : auth.branches,
          onSelect: auth.setBranch,
        ),
        sections: const [
          (label: 'Today', keys: ['today', 'todayClasses']),
          (label: 'Students', keys: ['students', 'addStudent', 'demoStudents', 'attendance']),
          (label: 'Money', keys: ['addFee', 'receipts', 'expenses']),
          (label: 'Connect', keys: ['inquiries', 'requests']),
          (label: 'Academy', keys: ['teachers', 'timetable', 'feeRateCard', 'schoolInvoice']),
          (label: '', keys: ['about']),
        ],
        buildBody: (context, key) {
          switch (key) {
            case 'todayClasses':
              return const TodaysClassesScreen();
            case 'students':
              return const StudentsScreen(staff: true);
            case 'addStudent':
              return const AddStudentScreen(staff: true);
            case 'demoStudents':
              return const DemoStudentsScreen(staff: true);
            case 'attendance':
              return const AttendanceScreen();
            case 'addFee':
              return const FeeCollectionScreen(staff: true);
            case 'receipts':
              return const ReceiptsScreen(staff: true);
            case 'expenses':
              return const ExpensesScreen(staff: true);
            case 'inquiries':
              return const InquiriesScreen();
            case 'requests':
              return const MyRequestsScreen();
            case 'teachers':
              return const TeachersScreen(staff: true);
            case 'timetable':
              return const TimetableScreen(staff: true);
            case 'feeRateCard':
              return const FeeRateCardViewScreen();
            case 'schoolInvoice':
              return const SchoolInvoiceScreen(staff: true);
            case 'about':
              return const AboutScreen(staff: true);
            case 'today':
            default:
              return const StaffDashboard();
          }
        },
      ),
    );
  }
}

/// In-header branch switcher — switching remounts the whole staff shell.
class _BranchSwitcher extends StatelessWidget {
  const _BranchSwitcher({
    required this.current,
    required this.branches,
    required this.onSelect,
  });
  final String current;
  final List<String> branches;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return PopupMenuButton<String>(
      tooltip: 'Switch branch',
      icon: const Icon(Icons.swap_horiz, size: 20),
      onSelected: onSelect,
      itemBuilder: (_) => [
        for (final b in branches)
          PopupMenuItem<String>(
            value: b,
            enabled: b != current,
            child: Row(children: [
              if (b == current)
                const Icon(Icons.check, size: 16),
              const SizedBox(width: 8),
              Text(b),
            ]),
          ),
      ],
    );
  }
}

class _BranchChip extends StatelessWidget {
  const _BranchChip(this.branch);
  final String branch;
  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppRadius.s, vertical: 4),
      decoration: BoxDecoration(
        color: scheme.primary,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(branch,
          style: TextStyle(
              color: Theme.of(context).brightness == Brightness.dark
                  ? const Color(0xFF261A08)
                  : Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 11)),
    );
  }
}

/// Door every staff session must pass before any data loads — matches the
/// web app's branch gate.
class BranchGate extends StatelessWidget {
  const BranchGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final branches = auth.branches.isEmpty ? const ['GOREGAON', 'KANDIVALI'] : auth.branches;
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: AppBar(
        actions: [
          TextButton(
            onPressed: () => auth.logout(),
            child: Text('Sign out',
                style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurfaceVariant)),
          ),
        ],
      ),
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpace.s5),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text('Choose your branch',
                    textAlign: TextAlign.center,
                    style: AppType.display.copyWith(
                      color: Theme.of(context).colorScheme.onSurface,
                    )),
                const SizedBox(height: AppSpace.s2),
                Text('All data is isolated to this branch. You can switch later from the drawer.',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.onSurfaceVariant,
                        fontSize: 13)),
                const SizedBox(height: AppSpace.s6),
                for (final b in branches) ...[
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: Theme.of(context).colorScheme.primary,
                      foregroundColor: Theme.of(context).brightness == Brightness.dark
                          ? const Color(0xFF261A08)
                          : Colors.white,
                      minimumSize: const Size.fromHeight(54),
                    ),
                    onPressed: () => auth.setBranch(b),
                    child: Text(b.toUpperCase(),
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
                  ),
                  const SizedBox(height: AppSpace.s3),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}