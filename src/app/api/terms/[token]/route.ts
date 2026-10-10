import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured, query, queryOne } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Brief §P10: the public admission-terms page. No login — a one-time token
// in the URL is the only credential. Never touches the RPC session model.
//
// CORS headers: this link always pointed at this app's own domain so far
// (same-origin), but /api/enroll hit a real CORS block the first time a
// public page fetched it from a different origin (swarmangal.pages.dev) —
// adding the same headers here pre-empts the identical bug if a terms link
// is ever opened from the marketing site too.
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: CORS_HEADERS });
}

interface TokenRow {
  token: string;
  student_id: string;
  status: string;
  expires_at: string;
  accepted_at: string | null;
  student_name: string | null;
}

async function loadToken(token: string): Promise<TokenRow | null> {
  return queryOne<TokenRow>(
    `select t.token, t.student_id, t.status, t.expires_at::text, t.accepted_at::text, s.name as student_name
     from terms_acceptance_tokens t left join students_acad s on s.id = t.student_id
     where t.token = $1`,
    [token],
  );
}

function stateOf(row: TokenRow | null): "NOT_FOUND" | "EXPIRED" | "ACCEPTED" | "OPEN" {
  if (!row) return "NOT_FOUND";
  if (row.status === "ACCEPTED") return "ACCEPTED";
  if (new Date(row.expires_at).getTime() < Date.now()) return "EXPIRED";
  return row.status === "OPEN" ? "OPEN" : "EXPIRED";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured) return json({ ok: false, error: "Not configured" }, 503);
  const row = await loadToken(token);
  const state = stateOf(row);
  return json({
    ok: true,
    state,
    studentName: row?.student_name ?? "",
    acceptedAt: row?.accepted_at ?? "",
  });
}

export async function POST(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured) return json({ ok: false, error: "Not configured" }, 503);
  const row = await loadToken(token);
  const state = stateOf(row);
  if (state === "NOT_FOUND") return json({ ok: false, error: "Link not found." }, 404);
  if (state === "ACCEPTED") return json({ ok: true, state: "ACCEPTED", idempotent: true, acceptedAt: row!.accepted_at });
  if (state === "EXPIRED") return json({ ok: false, error: "This link has expired. Ask the academy to send a new one." }, 410);

  // CAS on status='OPEN': a retry or a double-tap can never double-accept or
  // race past an expiry that fires between the GET and this POST.
  const updated = await query<{ token: string; accepted_at: string }>(
    `update terms_acceptance_tokens set status = 'ACCEPTED', accepted_at = now()
     where token = $1 and status = 'OPEN' and expires_at > now()
     returning token, accepted_at::text`,
    [token],
  );
  if (!updated.length) return json({ ok: false, error: "This link is no longer open." }, 409);
  return json({ ok: true, state: "ACCEPTED", acceptedAt: updated[0].accepted_at });
}
