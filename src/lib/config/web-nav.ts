import {
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  GraduationCap,
  HandCoins,
  History,
  Home,
  Inbox,
  Info,
  MessageSquareText,
  ReceiptText,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface WebNavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

export interface WebNavSection {
  label: string;
  items: WebNavItem[];
}

/** Founder shell navigation — mirrors founder_shell.dart in Flutter. */
export const founderNav: WebNavSection[] = [
  {
    label: "Today",
    items: [{ title: "Home", href: "/founder", icon: Home }],
  },
  {
    label: "Students",
    items: [
      { title: "Students", href: "/founder/students", icon: Users },
      { title: "Add Student", href: "/founder/students/add", icon: UserPlus },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Fee Collection", href: "/founder/fees", icon: HandCoins },
      { title: "Receipts", href: "/founder/receipts", icon: ReceiptText },
      { title: "Teacher Payouts", href: "/founder/payouts", icon: Wallet },
      { title: "Expenses", href: "/founder/expenses", icon: CircleDollarSign },
    ],
  },
  {
    label: "People",
    items: [
      { title: "Teachers", href: "/founder/teachers", icon: GraduationCap },
      { title: "Approvals", href: "/founder/approvals", icon: CheckCircle2 },
    ],
  },
  {
    label: "Academy",
    items: [
      { title: "Timetable", href: "/founder/timetable", icon: CalendarDays },
      { title: "School Invoice", href: "/founder/school-invoice", icon: FileText },
      { title: "Activity Log", href: "/founder/activity-log", icon: History },
    ],
  },
  {
    label: "Settings",
    items: [{ title: "About", href: "/founder/about", icon: Info }],
  },
];

/** Staff shell navigation — mirrors staff_shell.dart in Flutter. */
export const staffNav: WebNavSection[] = [
  {
    label: "Today",
    items: [
      { title: "Today", href: "/staff", icon: Home },
      { title: "Today's Classes", href: "/staff/classes", icon: CalendarCheck },
    ],
  },
  {
    label: "Students",
    items: [
      { title: "Students", href: "/staff/students", icon: Users },
      { title: "Add Student", href: "/staff/students/add", icon: UserPlus },
      { title: "Attendance", href: "/staff/attendance", icon: UserCheck },
    ],
  },
  {
    label: "Money",
    items: [
      { title: "Fee Collection", href: "/staff/fees", icon: HandCoins },
      { title: "Receipts", href: "/staff/receipts", icon: ReceiptText },
      { title: "Expenses", href: "/staff/expenses", icon: CircleDollarSign },
    ],
  },
  {
    label: "Connect",
    items: [
      { title: "Inquiries", href: "/staff/inquiries", icon: MessageSquareText },
      { title: "My Requests", href: "/staff/requests", icon: Inbox },
    ],
  },
  {
    label: "Academy",
    items: [
      { title: "Teachers", href: "/staff/teachers", icon: GraduationCap },
      { title: "Timetable", href: "/staff/timetable", icon: CalendarDays },
      { title: "School Invoice", href: "/staff/school-invoice", icon: FileText },
    ],
  },
  {
    label: "Settings",
    items: [{ title: "About", href: "/staff/about", icon: Info }],
  },
];