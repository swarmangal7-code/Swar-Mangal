import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { query } from "@/lib/db";
import { authenticateToken, isFounder, isStaff } from "@/lib/rpc/auth";
import { makeScope, moneyInScope } from "@/lib/rpc/scope";
import { ReceiptDocument, type ReceiptPdfData } from "@/lib/pdf/ReceiptDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Real PDF bytes for a fee receipt — reachable with the same device token the
 * rest of the app uses (as a query param, since a plain download link can't
 * carry a header), scoped to the same branches a founder/staff session
 * already sees. GET only; never mutates anything.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ receiptNo: string }> }) {
  const { receiptNo: rawReceiptNo } = await params;
  const receiptNo = decodeURIComponent(rawReceiptNo);
  const token = req.nextUrl.searchParams.get("token");
  const session = await authenticateToken(token);
  if (!session || !(isFounder(session) || isStaff(session))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = makeScope(session.branches ?? (isFounder(session) ? ["GOREGAON", "KANDIVALI"] : []));

  const row = await query<Record<string, unknown>>(
    `select receipt_no, party_name, student_id, amount, status, payment_mode, branch, txn_id,
            payment_date::text, created_at::text, fee_period_from::text, fee_period_to::text
     from receipts where receipt_no = $1 limit 1`,
    [receiptNo],
  ).then((rows) => rows[0]);

  if (!row) return NextResponse.json({ ok: false, error: "Receipt not found" }, { status: 404 });
  if (!moneyInScope(scope, row.branch)) {
    return NextResponse.json({ ok: false, error: "Not authorised for this branch" }, { status: 403 });
  }

  const data: ReceiptPdfData = {
    receiptNo: String(row.receipt_no ?? receiptNo),
    studentName: String(row.party_name ?? ""),
    studentId: String(row.student_id ?? ""),
    branch: String(row.branch ?? ""),
    date: String(row.payment_date ?? row.created_at ?? "").slice(0, 10),
    amount: Number(row.amount) || 0,
    paymentMode: String(row.payment_mode ?? ""),
    reference: String(row.txn_id ?? ""),
    feePeriodFrom: String(row.fee_period_from ?? ""),
    feePeriodTo: String(row.fee_period_to ?? ""),
    status: String(row.status ?? ""),
  };

  const buffer = await renderToBuffer(ReceiptDocument({ data }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${data.receiptNo}.pdf"`,
      "Cache-Control": "private, max-age=60",
      // The web app can run on Cloudflare Pages while this route only exists
      // on the VPS — the WhatsApp-send flow fetches this cross-origin.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
