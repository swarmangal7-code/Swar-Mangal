import 'package:flutter/material.dart';

import '../shell/shell_nav.dart';
import '../shared/approvals_screen.dart';
import '../shared/dashboard_screen.dart';
import '../shared/add_student_screen.dart';
import '../shared/demo_students_screen.dart';
import '../shared/expenses_screen.dart';
import '../shared/fee_collection_screen.dart';
import '../shared/inquiries_screen.dart';
import '../shared/receipts_screen.dart';
import '../shared/students_screen.dart';
import '../shared/teachers_screen.dart';
import '../shared/audit_log_screen.dart';
import '../shared/payout_preview_screen.dart';
import '../shared/timetable_screen.dart';
import '../shared/fee_rate_card_screen.dart';
import '../shared/school_invoice_screen.dart';
import '../shared/whatsapp_groups_screen.dart';
import 'payout_settings_screen.dart';

/// Founder surface. Same data centre as the web founder app: receipts are
/// entered directly against STUDENT_RECEIPTS (server-authoritative).
class FounderShell extends StatelessWidget {
  const FounderShell({super.key});

  @override
  Widget build(BuildContext context) {
    return DrawerShell(
      title: 'Founder',
      navItems: founderItems,
      sections: const [
        (label: 'Today', keys: ['home']),
        (label: 'Students', keys: ['students', 'addStudent', 'demoStudents']),
        (label: 'Money', keys: ['addFee', 'receipts', 'payouts', 'payoutSettings', 'feeRateCard', 'expenses']),
        (label: 'People', keys: ['teachers', 'inquiries', 'whatsappGroups', 'approvals']),
        (label: 'Academy', keys: ['timetable', 'schoolInvoice', 'auditLog']),
        (label: '', keys: ['about']),
      ],
      buildBody: (context, key) {
        switch (key) {
          case 'approvals':
            return const ApprovalsScreen();
          case 'students':
            return const StudentsScreen(staff: false);
          case 'addStudent':
            return const AddStudentScreen(staff: false);
          case 'demoStudents':
            return const DemoStudentsScreen(staff: false);
          case 'addFee':
            return const FeeCollectionScreen(staff: false);
          case 'receipts':
            return const ReceiptsScreen(staff: false);
          case 'teachers':
            return const TeachersScreen(staff: false);
          case 'inquiries':
            return const InquiriesScreen();
          case 'whatsappGroups':
            return const WhatsAppGroupsScreen();
          case 'expenses':
            return const ExpensesScreen(staff: false);
          case 'payouts':
            return const PayoutPreviewScreen();
          case 'payoutSettings':
            return const PayoutSettingsScreen();
          case 'feeRateCard':
            return const FeeRateCardScreen();
          case 'timetable':
            return const TimetableScreen(staff: false);
          case 'schoolInvoice':
            return const SchoolInvoiceScreen(staff: false);
          case 'auditLog':
            return const AuditLogScreen();
          case 'about':
            return const AboutScreen(staff: false);
          case 'home':
          default:
            return const FounderDashboard();
        }
      },
    );
  }
}