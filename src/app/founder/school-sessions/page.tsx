"use client";

import { SchoolSessionsView } from "@/components/dashboard/school-sessions-view";

export default function FounderSchoolSessionsPage() {
  return <SchoolSessionsView backHref="/founder" addTeacherHref="/founder/teachers" />;
}
