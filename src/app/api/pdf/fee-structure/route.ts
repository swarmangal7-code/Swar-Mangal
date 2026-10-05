import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { query } from "@/lib/db";
import { authenticateToken, isFounder, isStaff } from "@/lib/rpc/auth";
import { FeeStructureDocument, type FeeStructurePdfData } from "@/lib/pdf/FeeStructureDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function niceNow(): string {
  const d = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Real PDF bytes for the founder-maintained Fee Rate Card, filtered to one or
 * more instruments. Same token-in-query-param auth as
 * /api/pdf/receipt/[receiptNo] and /api/pdf/timetable. Not branch-scoped —
 * the rate card is a single academy-wide price list. GET only; never mutates.
 *
 * Query params:
 *   token         - device token (required)
 *   instruments   - comma-separated and/or repeated; omitted/empty = all
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const session = await authenticateToken(token);
  if (!session || !(isFounder(session) || isStaff(session))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const instruments = Array.from(
    new Set(
      req.nextUrl.searchParams
        .getAll("instruments")
        .flatMap((v) => v.split(","))
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  );

  const rows = await query<Record<string, unknown>>(
    `select instrument, name, fee_amount, billing_period, notes from fee_rate_card where active = true order by instrument asc, name asc`,
  );

  const filtered = instruments.length ? rows.filter((r) => instruments.includes(String(r.instrument ?? ""))) : rows;

  const data: FeeStructurePdfData = {
    instruments,
    generatedAt: niceNow(),
    rows: filtered.map((r) => ({
      instrument: String(r.instrument ?? ""),
      name: String(r.name ?? ""),
      feeAmount: Number(r.fee_amount) || 0,
      billingPeriod: String(r.billing_period ?? "Monthly"),
      notes: String(r.notes ?? ""),
    })),
  };

  const buffer = await renderToBuffer(FeeStructureDocument({ data }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="fee-rate-card.pdf"`,
      "Cache-Control": "private, max-age=60",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
