"use client";

export const runtime = "edge";

import { InquiryDetail } from "@/components/dashboard/inquiry-detail";

export default function FounderInquiryDetailPage() {
  return <InquiryDetail basePath="/founder/inquiries" rolePrefix="/founder" />;
}
