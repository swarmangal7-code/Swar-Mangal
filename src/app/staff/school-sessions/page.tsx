"use client";

import { SchoolSessionsView } from "@/components/dashboard/school-sessions-view";

export default function StaffSchoolSessionsPage() {
  return <SchoolSessionsView backHref="/staff" addTeacherHref="/staff/teachers" />;
}
