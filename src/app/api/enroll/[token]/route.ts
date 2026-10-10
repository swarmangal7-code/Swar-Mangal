import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { isDbConfigured, query, queryOne } from "@/lib/db";
import { newId } from "@/lib/rpc/shared";
import { notifyFounderApproval } from "@/lib/push/notify";
import { EnrollmentConfirmationDocument } from "@/lib/pdf/EnrollmentConfirmationDocument";
import { gatewayConfigFromEnv, sendDocument, sendText } from "@/lib/whatsapp/gateway";
import { normalizeIndianMobile } from "@/lib/whatsapp/phone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Founder request 2026-10-10: the public enroll-student page. No login — a
// one-time token in the URL is the only credential, same as /api/terms.
// Never touches the RPC session model.

interface TokenRow {
  token: string;
  branch: string;
  status: string;
  expires_at: string;
  draft_id: string | null;
}

async function loadToken(token: string): Promise<TokenRow | null> {
  return queryOne<TokenRow>(
    `select token, branch, status, expires_at::text, draft_id from enroll_links where token = $1`,
    [token],
  );
}

function stateOf(row: TokenRow | null): "NOT_FOUND" | "EXPIRED" | "USED" | "OPEN" {
  if (!row) return "NOT_FOUND";
  if (row.status === "USED") return "USED";
  if (new Date(row.expires_at).getTime() < Date.now()) return "EXPIRED";
  return row.status === "OPEN" ? "OPEN" : "EXPIRED";
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured) return NextResponse.json({ ok: false, error: "Not configured" }, { status: 503 });
  const row = await loadToken(token);
  const state = stateOf(row);
  return NextResponse.json({ ok: true, state, branch: row?.branch ?? "" });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isDbConfigured) return NextResponse.json({ ok: false, error: "Not configured" }, { status: 503 });
  const row = await loadToken(token);
  const state = stateOf(row);
  if (state === "NOT_FOUND") return NextResponse.json({ ok: false, error: "Link not found." }, { status: 404 });
  if (state === "USED") return NextResponse.json({ ok: false, error: "This link has already been used." }, { status: 409 });
  if (state === "EXPIRED") return NextResponse.json({ ok: false, error: "This link has expired. Ask the academy to send a new one." }, { status: 410 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  const s = (v: unknown) => (v == null ? "" : String(v)).trim();
  const name = s(body["name"]);
  const guardianName = s(body["guardianName"]);
  const phone = s(body["phone"]);
  const email = s(body["email"]);
  const instrument = s(body["instrument"]);
  const termsAccepted = body["termsAccepted"] === true;
  if (!name) return NextResponse.json({ ok: false, error: "Enter the student's full name." }, { status: 400 });
  if (!guardianName) return NextResponse.json({ ok: false, error: "Enter the guardian's name." }, { status: 400 });
  if (!phone) return NextResponse.json({ ok: false, error: "Enter a contact number." }, { status: 400 });
  if (!instrument) return NextResponse.json({ ok: false, error: "Enter the preferred instrument." }, { status: 400 });
  if (!termsAccepted) return NextResponse.json({ ok: false, error: "Please accept the terms & conditions to enroll." }, { status: 400 });

  // CAS on status='OPEN': prevents a race with expiry or a double-submit
  // from two tabs, same pattern as /api/terms.
  const updated = await query<{ token: string }>(
    `update enroll_links set status = 'USED' where token = $1 and status = 'OPEN' and expires_at > now() returning token`,
    [token],
  );
  if (!updated.length) return NextResponse.json({ ok: false, error: "This link is no longer open." }, { status: 409 });

  const draftId = newId("SDRAFT");
  await query(
    `insert into student_drafts (id, status, action, name, phone, email, parent_name, course, branch, submitted_by, origin, client_intent_key)
     values ($1,'SUBMITTED','ADD',$2,$3,$4,$5,$6,$7,'Enroll link','PUBLIC_ENROLL',$8)
     on conflict (client_intent_key) do nothing`,
    [draftId, name, phone, email || null, guardianName, instrument, row!.branch, token],
  );
  await query(`update enroll_links set draft_id = $2 where token = $1`, [token, draftId]);
  notifyFounderApproval("New enrollment", `${name} wants to join`, draftId);

  // Best-effort: a WhatsApp gateway hiccup should never fail the enrollment
  // itself, which has already been recorded above.
  await sendEnrollmentConfirmation({ name, guardianName, phone, email, instrument, branch: row!.branch }).catch(() => {});

  return NextResponse.json({ ok: true, state: "SUBMITTED" });
}

async function sendEnrollmentConfirmation(data: {
  name: string;
  guardianName: string;
  phone: string;
  email: string;
  instrument: string;
  branch: string;
}): Promise<void> {
  if (process.env.WA_SEND_ENABLED !== "true") return;
  const cfg = gatewayConfigFromEnv();
  if (!cfg) return;
  const phone = normalizeIndianMobile(data.phone);
  if (!phone.ok) return;

  const buffer = await renderToBuffer(
    EnrollmentConfirmationDocument({
      data: {
        studentName: data.name,
        guardianName: data.guardianName,
        phone: data.phone,
        email: data.email,
        instrument: data.instrument,
        branch: data.branch,
        submittedAt: new Date().toISOString(),
      },
    }),
  );
  await sendDocument(
    cfg,
    phone.jid,
    { bytes: new Uint8Array(buffer), fileName: `Enrollment-${data.name.replace(/\s+/g, "-")}.pdf`, mimeType: "application/pdf" },
    "",
  );
  await sendText(cfg, phone.jid, "You have accepted terms and conditions for Swar Mangal Music Academy.");
}
