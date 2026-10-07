import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { query } from "@/lib/db";
import { authenticateToken, isFounder, isStaff } from "@/lib/rpc/auth";
import { inScope } from "@/lib/rpc/scope";
import { scopeForSession } from "@/lib/rpc/authorization";
import { TimetableDocument, type TimetablePdfData } from "@/lib/pdf/TimetableDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function niceNow(): string {
  const d = new Date();
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${String(d.getDate()).padStart(2, "0")} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Real PDF bytes for the Timetable, filtered to one or more instruments,
 * reachable with the same device token the rest of the app uses (as a query
 * param — a plain download/print link can't carry a header). Same auth and
 * scope pattern as /api/pdf/receipt/[receiptNo]. GET only; never mutates.
 *
 * Query params:
 *   token         - device token (required)
 *   branch        - "ALL" (default) | "GOREGAON" | "KANDIVALI"
 *   instruments   - comma-separated and/or repeated; omitted/empty = all
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const session = await authenticateToken(token);
  if (!session || !(isFounder(session) || isStaff(session))) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const scope = scopeForSession(session);

  const branch = (req.nextUrl.searchParams.get("branch") || "ALL").toUpperCase();
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
    `select branch, day_of_week, start_time, end_time, class_name, instrument, teacher_name, status
     from timetable order by day_of_week, start_time`,
  );

  const filtered = rows.filter((r) => {
    if (!inScope(scope, r.branch)) return false;
    if (branch !== "ALL" && String(r.branch ?? "").toUpperCase() !== branch) return false;
    if (instruments.length && !instruments.includes(String(r.instrument ?? ""))) return false;
    return true;
  });

  const data: TimetablePdfData = {
    branch,
    instruments,
    generatedAt: niceNow(),
    rows: filtered.map((r) => ({
      dayOfWeek: Number(r.day_of_week) || 0,
      startTime: String(r.start_time ?? ""),
      endTime: String(r.end_time ?? ""),
      className: String(r.class_name ?? ""),
      instrument: String(r.instrument ?? ""),
      teacherName: String(r.teacher_name ?? ""),
      branch: String(r.branch ?? ""),
      status: String(r.status ?? "ENABLED"),
    })),
  };

  const buffer = await renderToBuffer(TimetableDocument({ data }));
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="timetable.pdf"`,
      "Cache-Control": "private, max-age=60",
      // The web app can run on Cloudflare Pages while this route only exists
      // on the VPS — the WhatsApp-share flow fetches this cross-origin.
      "Access-Control-Allow-Origin": "*",
    },
  });
}
