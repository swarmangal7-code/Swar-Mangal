"use client";

export const runtime = "edge";

import { useParams } from "next/navigation";

import { InvoiceDetail } from "@/components/founder/invoice-detail";

export default function StaffSchoolInvoiceDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : Array.isArray(params?.id) ? params.id[0] : "";
  return <InvoiceDetail invoiceId={id} backHref="/staff/school-invoice" />;
}
