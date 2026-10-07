import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { query } from "@/lib/db";
import { authenticateToken, isFounder, isStaff } from "@/lib/rpc/auth";
import { inScope } from "@/lib/rpc/scope";
import { scopeForSession } from "@/lib/rpc/authorization";
import { schoolBeneficiaries, computeBeneficiaryAmounts } from "@/lib/rpc/shared";
import { billingMonthRange } from "@/lib/rpc/numbering";
import { InvoiceDocument, type InvoicePdfData } from "@/lib/pdf/InvoiceDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Previous calendar month's [first day, last day] for a Fixed Monthly
 *  invoice dated on/after the 1st of the following month — matches how
 *  every issued school invoice so far has read (invoiced 01 Sep for the
 *  01-31 Aug period). */
function previousMonthRange(invoiceDateIso: string): { from: string; to: string } {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(invoiceDateIso) ? new Date(`${invoiceDateIso}T00:00:00Z`) : new Date();
  const firstOfInvoiceMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const lastOfPrevMonth = new Date(firstOfInvoiceMonth.getTime() - 86400000);
  const firstOfPrevMonth = new Date(Date.UTC(lastOfPrevMonth.getUTCFullYear(), lastOfPrevMonth.getUTCMonth(), 1));
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { from: iso(firstOfPrevMonth), to: iso(lastOfPrevMonth) };
}

/** Real PDF bytes for a school invoice — same token-in-query auth as the receipt PDF route. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId: rawId } = await params;
  const invoiceId = decodeURIComponent(rawId);
  const token = req.nextUrl.searchParams.get("token");
  const session = await authenticateToken(token);
  if (!session || !(isFounder(session) || isStaff(session))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = scopeForSession(session);

  const row = await query<Record<string, unknown>>(
    `select i.id, i.invoice_no, i.invoice_date::text, i.branch, i.class_name, i.amount, i.tenure, i.school_id, i.billing_month, i.billed_address, i.status,
            sc.code as school_code, sc.name as school_name, sc.address as school_address,
            sc.attn, sc.billing_basis, sc.service_description
     from school_invoices_rpc i left join schools sc on sc.id = i.school_id
     where i.id = $1`,
    [invoiceId],
  ).then((rows) => rows[0]);

  if (!row) return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });
  if (!inScope(scope, row.branch)) {
    return NextResponse.json({ ok: false, error: "Not authorised for this branch" }, { status: 403 });
  }

  const amount = Number(row.amount) || 0;
  const charges = (
    await query<Record<string, unknown>>(
      `select description, amount from school_invoice_charges where invoice_id = $1 order by seq, id`,
      [invoiceId],
    )
  ).map((c) => ({ description: String(c.description ?? ""), amount: Number(c.amount) || 0 }));
  const invoiceDate = String(row.invoice_date ?? "");
  const billingMonth = String(row.billing_month ?? "").trim();
  // Invoices raised before billing_month existed don't have it — fall back to
  // reading the previous calendar month off invoice_date, which is how every
  // one of those was actually billed.
  const period = billingMonth ? billingMonthRange(billingMonth) : previousMonthRange(invoiceDate);
  const schoolId = String(row.school_id ?? "");
  const rawBeneficiaries = schoolId ? await schoolBeneficiaries(schoolId) : [];
  const beneficiaries = rawBeneficiaries.length
    ? computeBeneficiaryAmounts(amount, rawBeneficiaries)
    : [{ name: String(row.school_name ?? "Swar Mangal") || "Swar Mangal", amount, bankName: "", accountNo: "", ifsc: "", upi: "" }];

  const data: InvoicePdfData = {
    invoiceNo: String(row.invoice_no ?? invoiceId),
    invoiceDate,
    billingPeriodFrom: period.from,
    billingPeriodTo: period.to,
    branch: String(row.branch ?? ""),
    schoolCode: String(row.school_code ?? ""),
    schoolName: String(row.school_name ?? ""),
    schoolAddress: String(row.billed_address ?? "").trim() || String(row.school_address ?? ""),
    attn: String(row.attn ?? "") || "The Principal",
    billingBasis: String(row.billing_basis ?? "") || "Fixed Monthly",
    serviceDescription: String(row.service_description ?? "") || String(row.class_name ?? ""),
    amount,
    charges,
    status: String(row.status ?? ""),
  };

  const buffer = await renderToBuffer(InvoiceDocument({ data, beneficiaries }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.invoiceNo}.pdf"`,
      "Cache-Control": "private, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
