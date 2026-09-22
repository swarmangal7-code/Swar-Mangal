import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured, query, queryOne } from "@/lib/db";
import { newId } from "@/lib/rpc/shared";
import { smtpConfigFromEnv, sendMail } from "@/lib/email/smtp";
import { FOUNDER_EMAIL, OTP_TTL_MINUTES, OTP_RESEND_COOLDOWN_SECONDS, generateOtp, hashOtp, normalizeEmail, isValidEmail } from "@/lib/email/otp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public — no device token exists yet. OTP proves control of an inbox, not
// authorization; the allow-list check below is the authorization step.
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
  if (!isValidEmail(email)) return NextResponse.json({ ok: false, error: "Enter a valid email address." });
  if (role !== "FOUNDER_ADMIN" && role !== "OPS_USER") return NextResponse.json({ ok: false, error: "Bad role." });
  if (purpose !== "REGISTER" && purpose !== "RESET") return NextResponse.json({ ok: false, error: "Bad purpose." });

  // Never reveal whether an email is authorized — same generic refusal either
  // way. Also never reveal whether it's already registered: REGISTER vs
  // RESET is only a UI hint for which screen copy to show — the actual
  // register-or-reissue decision is made at verify time by checking for an
  // existing token there, not here, so this response can't leak that state.
  const authorized =
    role === "FOUNDER_ADMIN"
      ? email === FOUNDER_EMAIL
      : Boolean(await queryOne(`select 1 from authorized_emails where email = $1 and role = 'OPS_USER'`, [email]));
  if (!authorized) {
    return NextResponse.json({ ok: false, error: "This email is not set up for access. Ask the founder to add it first." });
  }

  const recent = await queryOne<{ created_at: string }>(
    `select created_at::text from email_otps where email = $1 and purpose = $2 and consumed_at is null
     order by created_at desc limit 1`,
    [email, purpose],
  );
  if (recent && Date.now() - new Date(recent.created_at).getTime() < OTP_RESEND_COOLDOWN_SECONDS * 1000) {
    return NextResponse.json({ ok: false, error: "Wait a minute before requesting another code." });
  }

  const cfg = smtpConfigFromEnv();
  if (!cfg) {
    return NextResponse.json({ ok: false, error: "Email sending is not configured yet. Ask the developer to set it up." });
  }

  const code = generateOtp();
  await query(
    `insert into email_otps (id, email, role, purpose, code_hash, expires_at)
     values ($1,$2,$3,$4,$5, now() + ($6::int * interval '1 minute'))`,
    [newId("OTP"), email, role, purpose, hashOtp(code), OTP_TTL_MINUTES],
  );

  const sent = await sendMail(
    cfg,
    email,
    "Your Swar Mangal verification code",
    `Your verification code is ${code}. It expires in ${OTP_TTL_MINUTES} minutes. If you did not request this, ignore this email.`,
  );
  if (!sent.ok) return NextResponse.json({ ok: false, error: sent.error });
  return NextResponse.json({ ok: true, expiresInMinutes: OTP_TTL_MINUTES });
}
