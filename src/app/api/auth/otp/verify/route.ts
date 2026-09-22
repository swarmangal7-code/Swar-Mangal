import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured, withTransaction } from "@/lib/db";
import { newId } from "@/lib/rpc/shared";
import { hashToken } from "@/lib/rpc/auth";
import { FOUNDER_EMAIL, MAX_OTP_ATTEMPTS, hashOtp, normalizeEmail } from "@/lib/email/otp";

const GENERIC_ACCESS_ERROR = "This access is no longer valid. Ask the founder for a fresh code.";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface OtpRow {
  id: string;
  code_hash: string;
  expires_at: string;
  attempts: number;
}

export async function POST(req: NextRequest) {
  if (!isDbConfigured) return NextResponse.json({ ok: false, error: "Not configured" }, { status: 503 });
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  const email = normalizeEmail(body.email);
  const role = String(body.role ?? "").toUpperCase();
  const purpose = String(body.purpose ?? "").toUpperCase();
  const code = String(body.code ?? "").trim();
  if (!email || !code) return NextResponse.json({ ok: false, error: "Enter the code that was emailed to you." });
  if (role !== "FOUNDER_ADMIN" && role !== "OPS_USER") return NextResponse.json({ ok: false, error: "Bad role." });
  if (purpose !== "REGISTER" && purpose !== "RESET") return NextResponse.json({ ok: false, error: "Bad purpose." });

  const result = await withTransaction(async (tx) => {
    const otp = await tx.queryOne<OtpRow>(
      `select id, code_hash, expires_at::text, attempts from email_otps
       where email = $1 and role = $2 and purpose = $3 and consumed_at is null
       order by created_at desc limit 1 for update`,
      [email, role, purpose],
    );
    if (!otp) return { ok: false as const, error: "Request a new code first." };
    if (new Date(otp.expires_at).getTime() < Date.now()) return { ok: false as const, error: "That code has expired. Request a new one." };
    if (otp.attempts >= MAX_OTP_ATTEMPTS) return { ok: false as const, error: "Too many wrong attempts. Request a new code." };
    if (hashOtp(code) !== otp.code_hash) {
      await tx.query(`update email_otps set attempts = attempts + 1 where id = $1`, [otp.id]);
      return { ok: false as const, error: "Incorrect code." };
    }
    await tx.query(`update email_otps set consumed_at = now() where id = $1`, [otp.id]);

    // Re-check authorization at mint time, not just at request time — a
    // founder revoking access should take effect immediately, even if a
    // code was already emailed and sits unused inside its expiry window.
    const allowRow =
      role === "OPS_USER"
        ? await tx.queryOne<{ branches: string | null }>(`select branches from authorized_emails where email = $1`, [email])
        : null;
    if (role === "FOUNDER_ADMIN" ? email !== FOUNDER_EMAIL : !allowRow) {
      return { ok: false as const, error: GENERIC_ACCESS_ERROR };
    }

    // Register-or-reissue is decided here, from actual state, never from the
    // client-declared `purpose` — that keeps `purpose` a pure UI hint (which
    // screen copy to show) with no security meaning, so the request endpoint
    // never has to reveal whether an email is already registered.
    let branches: string | null = role === "OPS_USER" ? (allowRow?.branches ?? null) : null;
    let label = email;
    const existing = await tx.queryOne<{ id: string; label: string; branches: string | null }>(
      `select id, label, branches from device_tokens where email = $1 and revoked_at is null for update`,
      [email],
    );
    if (existing) {
      branches = existing.branches;
      label = existing.label;
      await tx.query(`update device_tokens set revoked_at = now() where email = $1 and revoked_at is null`, [email]);
    }

    const token = randomBytes(32).toString("base64url");
    const id = newId("DEV");
    await tx.query(
      `insert into device_tokens (id, token_hash, role, label, email, branches) values ($1,$2,$3,$4,$5,$6)`,
      [id, hashToken(token), role, label, email, branches],
    );
    return { ok: true as const, token, role, label };
  });

  return NextResponse.json(result);
}
