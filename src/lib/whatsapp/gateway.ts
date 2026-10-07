// Client for a self-hosted WA-AKG gateway (github.com/mrifqidaffaaditya/WA-AKG).
// Contract read from its source (actual_routes.txt + the route handlers
// themselves, confirmed 2026-10-07):
//   POST /api/messages/{sessionId}/{jid}/send   { message: { text } }
//   POST /api/messages/{sessionId}/{jid}/media  multipart: file, type, caption
//   POST /api/messages/{sessionId}/{jid}/poll   { question, options, selectableCount }
//        — options: 2..12 entries; success has no message id (no data.key),
//        just { status: true }, unlike every other send endpoint.
//   GET  /api/groups/{sessionId}                data: Group[] (jid, subject, ...)
//   GET  /api/sessions/{sessionId}               data.status === "CONNECTED"
//   auth: X-API-Key (checked case-insensitively, `x-api-key`, by the gateway
//   itself); success { status: true, data }, failure { status: false, message }
// A group jid (ends "@g.us") works through sendText/sendDocument exactly like
// a personal one — the gateway's send/media endpoints are jid-agnostic.
import { createHmac, timingSafeEqual } from "crypto";

export interface GatewayConfig {
  baseUrl: string;
  apiKey: string;
  sessionId: string;
}

export type GatewayResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string; httpStatus?: number };

export function gatewayConfigFromEnv(env = process.env): GatewayConfig | null {
  const baseUrl = (env.WA_AKG_BASE_URL ?? "").replace(/\/+$/, "");
  const apiKey = env.WA_AKG_API_KEY ?? "";
  const sessionId = env.WA_AKG_SESSION_ID ?? "";
  if (!baseUrl || !apiKey || !sessionId) return null;
  return { baseUrl, apiKey, sessionId };
}

const TIMEOUT_MS = 20_000;

async function call(
  cfg: GatewayConfig,
  path: string,
  init: RequestInit,
): Promise<{ ok: boolean; status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: { "X-API-Key": cfg.apiKey, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  let body: Record<string, unknown> = {};
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch {
    // non-JSON (proxy error page): leave empty, status says enough
  }
  return { ok: res.ok && body.status === true, status: res.status, body };
}

function providerId(body: Record<string, unknown>): string {
  const data = body.data as { key?: { id?: string } } | undefined;
  return data?.key?.id ?? "";
}

function failure(err: unknown, status?: number, body?: Record<string, unknown>): GatewayResult {
  if (body && typeof body.message === "string" && body.message) {
    return { ok: false, error: body.message, httpStatus: status };
  }
  const message = err instanceof Error ? err.message : `Gateway returned HTTP ${status ?? "?"}`;
  return { ok: false, error: message, httpStatus: status };
}

export async function sendText(cfg: GatewayConfig, jid: string, text: string): Promise<GatewayResult> {
  try {
    const r = await call(
      cfg,
      `/api/messages/${encodeURIComponent(cfg.sessionId)}/${encodeURIComponent(jid)}/send`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: { text } }) },
    );
    const id = providerId(r.body);
    // "Sent" only when the gateway confirms AND hands back WhatsApp's message id.
    if (r.ok && id) return { ok: true, providerMessageId: id };
    return failure(null, r.status, r.body);
  } catch (err) {
    return failure(err);
  }
}

export async function sendDocument(
  cfg: GatewayConfig,
  jid: string,
  file: { bytes: Uint8Array; fileName: string; mimeType: string },
  caption: string,
): Promise<GatewayResult> {
  try {
    const form = new FormData();
    // Copy into a plain ArrayBuffer: Blob will not take a view over a shared buffer.
    const buffer = new Uint8Array(file.bytes.byteLength);
    buffer.set(file.bytes);
    form.append("file", new Blob([buffer.buffer], { type: file.mimeType }), file.fileName);
    form.append("type", "document");
    form.append("caption", caption);
    const r = await call(
      cfg,
      `/api/messages/${encodeURIComponent(cfg.sessionId)}/${encodeURIComponent(jid)}/media`,
      { method: "POST", body: form },
    );
    const id = providerId(r.body);
    if (r.ok && id) return { ok: true, providerMessageId: id };
    return failure(null, r.status, r.body);
  } catch (err) {
    return failure(err);
  }
}

export interface GroupInfo {
  jid: string;
  subject: string;
}

/** Every group this session's WhatsApp account is a member of. Empty (not an
 *  error) when the gateway call fails, so a UI picker degrades to "no groups
 *  found" rather than a hard error. */
export async function listGroups(cfg: GatewayConfig): Promise<GroupInfo[]> {
  try {
    const r = await call(cfg, `/api/groups/${encodeURIComponent(cfg.sessionId)}`, { method: "GET" });
    if (!r.ok) return [];
    const rows = Array.isArray(r.body.data) ? (r.body.data as Record<string, unknown>[]) : [];
    return rows
      .map((g) => ({ jid: String(g.jid ?? "").trim(), subject: String(g.subject ?? "").trim() }))
      .filter((g) => g.jid)
      .map((g) => ({ ...g, subject: g.subject || g.jid }));
  } catch {
    return [];
  }
}

/** A WhatsApp poll (2-12 options). Unlike sendText/sendDocument, a successful
 *  poll send never returns a message id to confirm against — `{status:true}`
 *  alone is the gateway's whole success response for this endpoint, read
 *  directly from its route handler source rather than guessed. */
export async function sendPoll(
  cfg: GatewayConfig,
  jid: string,
  question: string,
  options: string[],
  selectableCount = 1,
): Promise<GatewayResult> {
  try {
    const r = await call(
      cfg,
      `/api/messages/${encodeURIComponent(cfg.sessionId)}/${encodeURIComponent(jid)}/poll`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, options, selectableCount }) },
    );
    if (r.ok) return { ok: true, providerMessageId: "" };
    return failure(null, r.status, r.body);
  } catch (err) {
    return failure(err);
  }
}

export async function sessionStatus(cfg: GatewayConfig): Promise<{ connected: boolean; status: string; error?: string }> {
  try {
    const r = await call(cfg, `/api/sessions/${encodeURIComponent(cfg.sessionId)}`, { method: "GET" });
    const status = String((r.body.data as { status?: string } | undefined)?.status ?? "");
    if (!r.ok) return { connected: false, status: status || "UNREACHABLE", error: String(r.body.message ?? `HTTP ${r.status}`) };
    return { connected: status === "CONNECTED", status };
  } catch (err) {
    return { connected: false, status: "UNREACHABLE", error: err instanceof Error ? err.message : String(err) };
  }
}

/** WA-AKG signs webhooks as X-Webhook-Signature: sha256=<hex HMAC of the raw body>. */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only move a message forward: SENT -> DELIVERED -> READ, never backwards. */
const RANK: Record<string, number> = { SENDING: 0, SENT: 1, DELIVERED: 2, READ: 3 };
export function isForwardStatus(current: string, incoming: string): boolean {
  if (!(incoming in RANK)) return false;
  return (RANK[incoming] ?? -1) > (RANK[current] ?? -1);
}
