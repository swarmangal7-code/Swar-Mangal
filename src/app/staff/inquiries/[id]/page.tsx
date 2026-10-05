"use client";

export const runtime = "edge";

import { InquiryDetail } from "@/components/dashboard/inquiry-detail";

export default function StaffInquiryDetailPage() {
  return <InquiryDetail basePath="/staff/inquiries" rolePrefix="/staff" />;
}
