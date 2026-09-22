import { NextRequest, NextResponse } from "next/server";
import { isDbConfigured, query, queryOne } from "@/lib/db";
import { isForwardStatus, verifyWebhookSignature } from "@/lib/whatsapp/gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * WA-AKG webhook. Configure it in the WA-AKG dashboard with this URL, a secret
 * equal to WA_WEBHOOK_SECRET, and the "message.status" event. Requests without
 * a valid X-Webhook-Signature are refused.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.WA_WEBHOOK_SECRET ?? "";
  if (!secret || !isDbConfigured) {
    return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 503 });
  }

  const raw = await req.text();
  if (!verifyWebhookSignature(raw, req.headers.get("x-webhook-signature"), secret)) {
    return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 401 });
  }

  let payload: { event?: string; data?: { keyId?: string; status?: string } };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Bad JSON" }, { status: 400 });
  }

  // Only delivery progress matters to us; acknowledge everything else.
  if (payload.event !== "message.status" || !payload.data?.keyId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const incoming = String(payload.data.status ?? "").toUpperCase();
  const msg = await queryOne<{ id: string; status: string }>(
    `select id, status from wa_messages where provider_message_id = $1`,
    [payload.data.keyId],
  );
  if (!msg) return NextResponse.json({ ok: true, unknown: true });
  if (!isForwardStatus(msg.status, incoming)) return NextResponse.json({ ok: true, unchanged: true });

  await query(
    `update wa_messages set status = $2,
       delivered_at = case when $2 in ('DELIVERED','READ') then coalesce(delivered_at, now()) else delivered_at end,
       read_at = case when $2 = 'READ' then coalesce(read_at, now()) else read_at end
     where id = $1`,
    [msg.id, incoming],
  );
  return NextResponse.json({ ok: true, status: incoming });
}
