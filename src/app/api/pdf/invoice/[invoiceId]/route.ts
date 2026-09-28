import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { query } from "@/lib/db";
import { authenticateToken, isFounder, isStaff } from "@/lib/rpc/auth";
import { makeScope, inScope } from "@/lib/rpc/scope";
import { InvoiceDocument, type InvoicePdfData } from "@/lib/pdf/InvoiceDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Real PDF bytes for a school invoice — same token-in-query auth as the receipt PDF route. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId: rawId } = await params;
  const invoiceId = decodeURIComponent(rawId);
  const token = req.nextUrl.searchParams.get("token");
  const session = await authenticateToken(token);
  if (!session || !(isFounder(session) || isStaff(session))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = makeScope(session.branches ?? (isFounder(session) ? ["GOREGAON", "KANDIVALI"] : []));

  const row = await query<Record<string, unknown>>(
    `select i.id, i.invoice_no, i.invoice_date::text, i.branch, i.class_name, i.amount, i.tenure,
            sc.code as school_code, sc.name as school_name, sc.address as school_address, sc.contact as school_contact
     from school_invoices_rpc i left join schools sc on sc.id = i.school_id
     where i.id = $1`,
    [invoiceId],
  ).then((rows) => rows[0]);

  if (!row) return NextResponse.json({ ok: false, error: "Invoice not found" }, { status: 404 });
  if (!inScope(scope, row.branch)) {
    return NextResponse.json({ ok: false, error: "Not authorised for this branch" }, { status: 403 });
  }

  const data: InvoicePdfData = {
    invoiceNo: String(row.invoice_no ?? invoiceId),
    invoiceDate: String(row.invoice_date ?? ""),
    branch: String(row.branch ?? ""),
    schoolCode: String(row.school_code ?? ""),
    schoolName: String(row.school_name ?? ""),
    schoolAddress: String(row.school_address ?? ""),
    schoolContact: String(row.school_contact ?? ""),
    className: String(row.class_name ?? ""),
    amount: Number(row.amount) || 0,
    tenure: String(row.tenure ?? ""),
    owner1: { name: "Sharvil Vaidya", title: "Owner 1" },
    owner2: { name: "Piyush Kashyap", title: "Owner 2" },
  };

  const buffer = await renderToBuffer(InvoiceDocument({ data }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${data.invoiceNo}.pdf"`,
      "Cache-Control": "private, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
