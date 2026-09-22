import { NextResponse } from "next/server";
import { isDbConfigured, query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Unauthenticated liveness/readiness probe for the reverse proxy, uptime
 * monitors and `pm2`/aaPanel health checks — deliberately reveals nothing
 * beyond "is the process up and can it reach Postgres".
 */
export async function GET() {
  if (!isDbConfigured) {
    return NextResponse.json({ ok: false, db: "not_configured" }, { status: 503 });
  }
  try {
    await query("select 1");
    return NextResponse.json({ ok: true, db: "up" });
  } catch {
    return NextResponse.json({ ok: false, db: "unreachable" }, { status: 503 });
  }
}
