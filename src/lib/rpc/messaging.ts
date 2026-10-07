// WhatsApp messaging over the WA-AKG gateway.
//
// Rules (brief §P9 / §11.8):
//  * A human click sends ONE message. No bulk, no background or retry sends.
//  * The number is the student's REGISTERED phone, read on the server. A phone
//    sent by the client is ignored.
//  * Opt-outs are never contacted; an optional allow-list gates testing.
//  * A retry with the same client_intent_key returns the original message.
//  * The same text is not sent twice to the same number within 24 hours.
//  * SENT only when the gateway returns WhatsApp's message id. DELIVERED and
//    READ arrive later through the signed webhook.
import { randomBytes } from "crypto";
import { query, queryOne } from "@/lib/db";
import type { RpcSession } from "@/lib/rpc/auth";
import { acadStudentById, acadTeacherById, s } from "@/lib/rpc/shared";
import { branchForbidden, inScope, recordBranch, type BranchScope } from "@/lib/rpc/scope";
import { normalizeIndianMobile, parseAllowList } from "@/lib/whatsapp/phone";
import { gatewayConfigFromEnv, listGroups, sendDocument, sendPoll, sendText, sessionStatus } from "@/lib/whatsapp/gateway";

export const MESSAGING_FUNCTIONS = new Set([
  "api_staff_sendWhatsApp",
  "api_staff_sendWhatsAppDocument",
  "api_staff_messageHistory",
  "api_whatsappStatus",
  "api_founder_whatsappOptOut",
  "api_staff_shareDocumentViaWhatsApp",
  "api_listWhatsAppGroups",
  "api_staff_sendWhatsAppGroupMessage",
  "api_staff_sendWhatsAppGroupPoll",
]);

const KINDS = new Set(["FEE_REMINDER", "RECEIPT", "RENEWAL", "FOLLOW_UP", "TERMS", "CUSTOM", "NOTIFY_TEACHER"]);
const NOT_CONTACTABLE = new Set(["LEFT", "TEST", "DUPLICATE", "ARCHIVED"]);
const MAX_TEXT = 4000;
const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
const DUPLICATE_WINDOW_HOURS = 24;

// Founder request 2026-10-05: a deliberate, explicit exception to the
// student-registered-phone rule at the top of this file. A Timetable or Fee
// Rate Card PDF is public-facing informational material with no
// student-specific data in it, so it may be shared to a number typed in by
// hand at send time — NOT a student's registered phone, and NOT looked up
// from any record. This is a separate code path (shareDocumentViaWhatsApp,
// below) from sendWhatsApp/sendWhatsAppDocument, which still read the
// recipient only from the server-side student record as before.
const SHARE_KINDS = new Set(["TIMETABLE_SHARE", "FEE_STRUCTURE_SHARE"]);

type Result = Record<string, unknown>;
const ok = (extra: Result = {}): Result => ({ ok: true, ...extra });
const refuse = (code: string, error: string, extra: Result = {}): Result => ({ ok: false, code, error, ...extra });

export async function dispatchMessaging(
  fn: string,
  arg: Record<string, unknown>,
  scope: BranchScope,
  session: RpcSession,
): Promise<Result> {
  switch (fn) {
    case "api_staff_sendWhatsApp":
      return sendWhatsApp(arg, scope, session, "text");
    case "api_staff_sendWhatsAppDocument":
      return sendWhatsApp(arg, scope, session, "document");
    case "api_staff_messageHistory":
      return messageHistory(arg, scope);
    case "api_whatsappStatus":
      return whatsappStatus();
    case "api_founder_whatsappOptOut":
      return setOptOut(arg, session);
    case "api_staff_shareDocumentViaWhatsApp":
      return shareDocumentViaWhatsApp(arg, session);
    case "api_listWhatsAppGroups":
      return listWhatsAppGroups();
    case "api_staff_sendWhatsAppGroupMessage":
      return sendWhatsAppGroupMessage(arg, session);
    case "api_staff_sendWhatsAppGroupPoll":
      return sendWhatsAppGroupPoll(arg, session);
    default:
      return refuse("UNKNOWN_API", `No messaging handler for ${fn}`);
  }
}

function sendingEnabled(): boolean {
  return process.env.WA_SEND_ENABLED === "true";
}

async function whatsappStatus(): Promise<Result> {
  const cfg = gatewayConfigFromEnv();
  if (!cfg) return ok({ enabled: false, connected: false, status: "NOT_CONFIGURED" });
  const st = await sessionStatus(cfg);
  return ok({ enabled: sendingEnabled(), connected: st.connected, status: st.status, error: st.error ?? "" });
}

/** Exported so other server-side callers (e.g. the overdue late-fee reminder
 *  sweep in handlers2.ts) can send through the exact same gateway call, dedup
 *  window and opt-out/allow-list checks — never a second messaging path. */
export async function sendWhatsApp(
  arg: Record<string, unknown>,
  scope: BranchScope,
  session: RpcSession,
  mode: "text" | "document",
): Promise<Result> {
  const cfg = gatewayConfigFromEnv();
  if (!cfg || !sendingEnabled()) {
    return refuse("WHATSAPP_DISABLED", "WhatsApp sending is switched off. Copy the message and send it by hand.");
  }

  const studentId = s(arg["studentId"]);
  const kind = s(arg["kind"] ?? arg["type"]).toUpperCase() || "CUSTOM";
  const text = s(arg["body"] ?? arg["text"] ?? arg["caption"]).trim();
  const intentKey = s(arg["clientIntentKey"]).trim() || null;

  if (!studentId) return refuse("STUDENT_ID_REQUIRED", "Choose the student to message.");
  if (!KINDS.has(kind)) return refuse("BAD_KIND", `Unknown message kind ${kind}`);
  if (mode === "text" && !text) return refuse("MESSAGE_REQUIRED", "The message is empty.");
  if (text.length > MAX_TEXT) return refuse("MESSAGE_TOO_LONG", `Keep the message under ${MAX_TEXT} characters.`);

  // A retry of the same click returns what the first attempt produced.
  if (intentKey) {
    const earlier = await queryOne<Record<string, unknown>>(`select * from wa_messages where client_intent_key = $1`, [intentKey]);
    if (earlier) {
      const sentOk = ["SENT", "DELIVERED", "READ"].includes(s(earlier.status));
      return sentOk
        ? ok({ idempotent: true, message: view(earlier), note: "already sent" })
        : refuse("WHATSAPP_SEND_FAILED", s(earlier.error) || "This message did not send.", {
            idempotent: true,
            message: view(earlier),
          });
    }
  }

  const student = await acadStudentById(studentId);
  if (!student) return refuse("STUDENT_NOT_FOUND", `No student ${studentId}`);
  if (!inScope(scope, student.branch)) return branchForbidden(recordBranch(student.branch));
  if (NOT_CONTACTABLE.has(s(student.status).toUpperCase())) {
    return refuse("STUDENT_NOT_CONTACTABLE", `${student.name} is marked ${s(student.status).toUpperCase()} and is not messaged.`);
  }

  // NOTIFY_TEACHER targets the student's assigned teacher, not the parent —
  // every other kind still goes to the student's own guardian phone.
  let recipientRaw = student.phone;
  let recipientLabel = student.name;
  if (kind === "NOTIFY_TEACHER") {
    const teacher = student.assigned_teacher_id ? await acadTeacherById(student.assigned_teacher_id) : null;
    if (!teacher) return refuse("NO_ASSIGNED_TEACHER", `${student.name} has no assigned teacher to notify.`);
    recipientRaw = teacher.phone;
    recipientLabel = teacher.name;
  }
  const phone = normalizeIndianMobile(recipientRaw);
  if (!phone.ok) {
    return refuse(
      phone.code === "NO_PHONE" ? "NO_REGISTERED_PHONE" : "INVALID_REGISTERED_PHONE",
      phone.code === "NO_PHONE"
        ? `${recipientLabel} has no registered phone number.`
        : `${recipientLabel}'s registered number (${phone.masked}) is not a valid Indian mobile.`,
    );
  }

  const optedOut = await queryOne(`select phone from wa_optout where phone = $1`, [phone.e164]);
  if (optedOut) return refuse("OPTED_OUT", `${recipientLabel}'s number has opted out of WhatsApp messages.`);

  const allow = parseAllowList(process.env.WA_ALLOWED_NUMBERS);
  if (allow.size && !allow.has(phone.e164)) {
    return refuse("NOT_WHITELISTED", `Sending is limited to test numbers right now; ${phone.masked} is not one of them.`);
  }

  let document: { bytes: Uint8Array; fileName: string; mimeType: string } | null = null;
  if (mode === "document") {
    const b64 = s(arg["fileBase64"]).replace(/^data:[^;]+;base64,/, "");
    const fileName = s(arg["fileName"]).trim() || "document.pdf";
    if (!b64) return refuse("FILE_REQUIRED", "Attach the document to send.");
    const bytes = Buffer.from(b64, "base64");
    if (!bytes.length) return refuse("FILE_REQUIRED", "The attached document is empty.");
    if (bytes.length > MAX_DOCUMENT_BYTES) return refuse("FILE_TOO_LARGE", "Documents must be under 3 MB.");
    document = { bytes, fileName, mimeType: s(arg["mimeType"]) || "application/pdf" };
  }

  // Same words to the same number already went out recently: don't send again.
  if (mode === "text") {
    const dup = await queryOne<{ sent_at: string }>(
      `select sent_at::text from wa_messages
       where to_phone = $1 and body = $2 and status in ('SENT','DELIVERED','READ')
         and sent_at > now() - ($3::int * interval '1 hour')
       order by sent_at desc limit 1`,
      [phone.e164, text, DUPLICATE_WINDOW_HOURS],
    );
    if (dup) {
      return refuse("DUPLICATE_MESSAGE", `This exact message was already sent to ${recipientLabel} at ${dup.sent_at.slice(0, 16)}.`);
    }
  }

  const id = `WAM-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    await query(
      `insert into wa_messages (id, client_intent_key, student_id, branch, kind, to_phone, body, file_name, status, requested_by)
       values ($1,$2,$3,$4,$5,$6,$7,$8,'SENDING',$9)`,
      [id, intentKey, student.id, recordBranch(student.branch), kind, phone.e164, text || null, document?.fileName ?? null, session.deviceLabel || session.email],
    );
  } catch {
    // Two taps raced on the same intent key: report the one that won.
    const winner = intentKey ? await queryOne<Record<string, unknown>>(`select * from wa_messages where client_intent_key = $1`, [intentKey]) : null;
    return winner ? ok({ idempotent: true, message: view(winner) }) : refuse("SERVER_ERROR", "Could not record the message.");
  }

  const result = document ? await sendDocument(cfg, phone.jid, document, text) : await sendText(cfg, phone.jid, text);

  if (result.ok) {
    const row = await queryOne<Record<string, unknown>>(
      `update wa_messages set status = 'SENT', provider_message_id = $2, sent_at = now() where id = $1 returning *`,
      [id, result.providerMessageId],
    );
    // messageId at the top level too, so the audit trail records it.
    return ok({ messageId: id, message: view(row ?? {}), note: `Sent to ${recipientLabel} (${phone.masked}).` });
  }

  const row = await queryOne<Record<string, unknown>>(
    `update wa_messages set status = 'FAILED', error = $2 where id = $1 returning *`,
    [id, result.error.slice(0, 500)],
  );
  return refuse(
    "WHATSAPP_SEND_FAILED",
    `Not sent to ${recipientLabel}: ${result.error}. Nothing was delivered; you can copy the message and send it by hand.`,
    { messageId: id, message: view(row ?? {}) },
  );
}

/**
 * Shares an arbitrary PDF (Timetable or Fee Rate Card export) to a phone
 * number typed in by hand at send time — never a student's registered phone,
 * never looked up from any record. See the file-level comment and the
 * SHARE_KINDS comment above for why this is allowed to deviate from the
 * sendWhatsApp rule. Still respects sendingEnabled(), the wa_optout list and
 * WA_ALLOWED_NUMBERS exactly like every other send in this file; the only
 * difference is where the phone number comes from.
 */
async function shareDocumentViaWhatsApp(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const cfg = gatewayConfigFromEnv();
  if (!cfg || !sendingEnabled()) {
    return refuse("WHATSAPP_DISABLED", "WhatsApp sending is switched off. Download the PDF and send it by hand.");
  }

  const kind = s(arg["kind"]).toUpperCase();
  if (!SHARE_KINDS.has(kind)) return refuse("BAD_KIND", `Unknown share kind ${kind}`);

  const intentKey = s(arg["clientIntentKey"]).trim() || null;
  if (intentKey) {
    const earlier = await queryOne<Record<string, unknown>>(`select * from wa_messages where client_intent_key = $1`, [intentKey]);
    if (earlier) {
      const sentOk = ["SENT", "DELIVERED", "READ"].includes(s(earlier.status));
      return sentOk
        ? ok({ idempotent: true, message: view(earlier), note: "already sent" })
        : refuse("WHATSAPP_SEND_FAILED", s(earlier.error) || "This message did not send.", {
            idempotent: true,
            message: view(earlier),
          });
    }
  }

  const phone = normalizeIndianMobile(arg["phone"]);
  if (!phone.ok) {
    return refuse(
      phone.code === "NO_PHONE" ? "PHONE_REQUIRED" : "INVALID_PHONE",
      phone.code === "NO_PHONE" ? "Enter the phone number to send to." : `${phone.masked} is not a valid Indian mobile number.`,
    );
  }

  const optedOut = await queryOne(`select phone from wa_optout where phone = $1`, [phone.e164]);
  if (optedOut) return refuse("OPTED_OUT", `${phone.masked} has opted out of WhatsApp messages.`);

  const allow = parseAllowList(process.env.WA_ALLOWED_NUMBERS);
  if (allow.size && !allow.has(phone.e164)) {
    return refuse("NOT_WHITELISTED", `Sending is limited to test numbers right now; ${phone.masked} is not one of them.`);
  }

  const b64 = s(arg["fileBase64"]).replace(/^data:[^;]+;base64,/, "");
  const fileName = s(arg["fileName"]).trim() || "document.pdf";
  if (!b64) return refuse("FILE_REQUIRED", "Attach the document to send.");
  const bytes = Buffer.from(b64, "base64");
  if (!bytes.length) return refuse("FILE_REQUIRED", "The attached document is empty.");
  if (bytes.length > MAX_DOCUMENT_BYTES) return refuse("FILE_TOO_LARGE", "Documents must be under 3 MB.");
  const document = { bytes, fileName, mimeType: s(arg["mimeType"]) || "application/pdf" };
  const caption = s(arg["caption"] ?? arg["body"]).trim();

  // Same number, same kind of document, already sent recently: don't send again.
  const dup = await queryOne<{ sent_at: string }>(
    `select sent_at::text from wa_messages
     where to_phone = $1 and kind = $2 and status in ('SENT','DELIVERED','READ')
       and sent_at > now() - ($3::int * interval '1 hour')
     order by sent_at desc limit 1`,
    [phone.e164, kind, DUPLICATE_WINDOW_HOURS],
  );
  if (dup) {
    return refuse("DUPLICATE_MESSAGE", `This was already shared with ${phone.masked} at ${dup.sent_at.slice(0, 16)}.`);
  }

  const id = `WAM-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    // student_id is deliberately null — this send is not tied to any student record.
    await query(
      `insert into wa_messages (id, client_intent_key, student_id, branch, kind, to_phone, body, file_name, status, requested_by)
       values ($1,$2,null,null,$3,$4,$5,$6,'SENDING',$7)`,
      [id, intentKey, kind, phone.e164, caption || null, document.fileName, session.deviceLabel || session.email],
    );
  } catch {
    const winner = intentKey ? await queryOne<Record<string, unknown>>(`select * from wa_messages where client_intent_key = $1`, [intentKey]) : null;
    return winner ? ok({ idempotent: true, message: view(winner) }) : refuse("SERVER_ERROR", "Could not record the message.");
  }

  const result = await sendDocument(cfg, phone.jid, document, caption);

  if (result.ok) {
    const row = await queryOne<Record<string, unknown>>(
      `update wa_messages set status = 'SENT', provider_message_id = $2, sent_at = now() where id = $1 returning *`,
      [id, result.providerMessageId],
    );
    return ok({ messageId: id, message: view(row ?? {}), note: `Sent to ${phone.masked}.` });
  }

  const row = await queryOne<Record<string, unknown>>(
    `update wa_messages set status = 'FAILED', error = $2 where id = $1 returning *`,
    [id, result.error.slice(0, 500)],
  );
  return refuse(
    "WHATSAPP_SEND_FAILED",
    `Not sent to ${phone.masked}: ${result.error}.`,
    { messageId: id, message: view(row ?? {}) },
  );
}

/** Every group the gateway's WhatsApp account is in, for a picker — not
 *  scoped to a student or a branch, same spirit as shareDocumentViaWhatsApp. */
async function listWhatsAppGroups(): Promise<Result> {
  const cfg = gatewayConfigFromEnv();
  if (!cfg) return ok({ groups: [] });
  const groups = await listGroups(cfg);
  return ok({ groups: groups.map((g) => ({ jid: g.jid, subject: g.subject })) });
}

function isGroupJid(jid: string): boolean {
  return /@g\.us$/.test(jid);
}

async function sendWhatsAppGroupMessage(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const cfg = gatewayConfigFromEnv();
  if (!cfg || !sendingEnabled()) {
    return refuse("WHATSAPP_DISABLED", "WhatsApp sending is switched off.");
  }
  const jid = s(arg["jid"]).trim();
  if (!jid || !isGroupJid(jid)) return refuse("GROUP_REQUIRED", "Pick a group to send to.");
  const subject = s(arg["subject"]).trim();
  const text = s(arg["body"] ?? arg["text"]).trim();
  if (!text) return refuse("MESSAGE_REQUIRED", "The message is empty.");
  if (text.length > MAX_TEXT) return refuse("MESSAGE_TOO_LONG", `Keep the message under ${MAX_TEXT} characters.`);

  const intentKey = s(arg["clientIntentKey"]).trim() || null;
  if (intentKey) {
    const earlier = await queryOne<Record<string, unknown>>(`select * from wa_messages where client_intent_key = $1`, [intentKey]);
    if (earlier) {
      const sentOk = ["SENT", "DELIVERED", "READ"].includes(s(earlier.status));
      return sentOk
        ? ok({ idempotent: true, message: view(earlier), note: "already sent" })
        : refuse("WHATSAPP_SEND_FAILED", s(earlier.error) || "This message did not send.", { idempotent: true, message: view(earlier) });
    }
  }

  // Same exact text to the same group already went out recently: don't resend.
  const dup = await queryOne<{ sent_at: string }>(
    `select sent_at::text from wa_messages
     where to_phone = $1 and body = $2 and status in ('SENT','DELIVERED','READ')
       and sent_at > now() - ($3::int * interval '1 hour')
     order by sent_at desc limit 1`,
    [jid, text, DUPLICATE_WINDOW_HOURS],
  );
  if (dup) return refuse("DUPLICATE_MESSAGE", `This exact message was already sent to this group at ${dup.sent_at.slice(0, 16)}.`);

  const id = `WAM-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    await query(
      `insert into wa_messages (id, client_intent_key, student_id, branch, kind, to_phone, to_group_subject, body, status, requested_by)
       values ($1,$2,null,null,'GROUP_MESSAGE',$3,$4,$5,'SENDING',$6)`,
      [id, intentKey, jid, subject || null, text, session.deviceLabel || session.email],
    );
  } catch {
    const winner = intentKey ? await queryOne<Record<string, unknown>>(`select * from wa_messages where client_intent_key = $1`, [intentKey]) : null;
    return winner ? ok({ idempotent: true, message: view(winner) }) : refuse("SERVER_ERROR", "Could not record the message.");
  }

  const result = await sendText(cfg, jid, text);
  if (result.ok) {
    const row = await queryOne<Record<string, unknown>>(
      `update wa_messages set status = 'SENT', provider_message_id = $2, sent_at = now() where id = $1 returning *`,
      [id, result.providerMessageId],
    );
    return ok({ messageId: id, message: view(row ?? {}), note: `Sent to ${subject || jid}.` });
  }
  const row = await queryOne<Record<string, unknown>>(`update wa_messages set status = 'FAILED', error = $2 where id = $1 returning *`, [id, result.error.slice(0, 500)]);
  return refuse("WHATSAPP_SEND_FAILED", `Not sent to ${subject || jid}: ${result.error}.`, { messageId: id, message: view(row ?? {}) });
}

async function sendWhatsAppGroupPoll(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const cfg = gatewayConfigFromEnv();
  if (!cfg || !sendingEnabled()) {
    return refuse("WHATSAPP_DISABLED", "WhatsApp sending is switched off.");
  }
  const jid = s(arg["jid"]).trim();
  if (!jid || !isGroupJid(jid)) return refuse("GROUP_REQUIRED", "Pick a group to send to.");
  const subject = s(arg["subject"]).trim();
  const question = s(arg["question"]).trim();
  if (!question) return refuse("QUESTION_REQUIRED", "Enter the poll question.");
  const rawOptions = Array.isArray(arg["options"]) ? (arg["options"] as unknown[]).map((o) => s(o).trim()).filter(Boolean) : [];
  const options = [...new Set(rawOptions)];
  if (options.length < 2 || options.length > 12) return refuse("BAD_OPTIONS", "A poll needs between 2 and 12 distinct options.");
  const selectableCount = Math.min(Math.max(Number(arg["selectableCount"]) || 1, 1), options.length);

  const intentKey = s(arg["clientIntentKey"]).trim() || null;
  if (intentKey) {
    const earlier = await queryOne<Record<string, unknown>>(`select * from wa_messages where client_intent_key = $1`, [intentKey]);
    if (earlier) {
      const sentOk = ["SENT", "DELIVERED", "READ"].includes(s(earlier.status));
      return sentOk
        ? ok({ idempotent: true, message: view(earlier), note: "already sent" })
        : refuse("WHATSAPP_SEND_FAILED", s(earlier.error) || "This poll did not send.", { idempotent: true, message: view(earlier) });
    }
  }

  const body = `${question} | ${options.join(", ")}`;
  const id = `WAM-${Date.now()}-${randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    await query(
      `insert into wa_messages (id, client_intent_key, student_id, branch, kind, to_phone, to_group_subject, body, status, requested_by)
       values ($1,$2,null,null,'GROUP_POLL',$3,$4,$5,'SENDING',$6)`,
      [id, intentKey, jid, subject || null, body, session.deviceLabel || session.email],
    );
  } catch {
    const winner = intentKey ? await queryOne<Record<string, unknown>>(`select * from wa_messages where client_intent_key = $1`, [intentKey]) : null;
    return winner ? ok({ idempotent: true, message: view(winner) }) : refuse("SERVER_ERROR", "Could not record the poll.");
  }

  // Polls never return a provider message id (see gateway.ts) — SENT here
  // means the gateway accepted it, not that a specific message id exists to
  // track delivery/read receipts against (there's nothing to compare).
  const result = await sendPoll(cfg, jid, question, options, selectableCount);
  if (result.ok) {
    const row = await queryOne<Record<string, unknown>>(`update wa_messages set status = 'SENT', sent_at = now() where id = $1 returning *`, [id]);
    return ok({ messageId: id, message: view(row ?? {}), note: `Poll sent to ${subject || jid}.` });
  }
  const row = await queryOne<Record<string, unknown>>(`update wa_messages set status = 'FAILED', error = $2 where id = $1 returning *`, [id, result.error.slice(0, 500)]);
  return refuse("WHATSAPP_SEND_FAILED", `Poll not sent to ${subject || jid}: ${result.error}.`, { messageId: id, message: view(row ?? {}) });
}

async function messageHistory(arg: Record<string, unknown>, scope: BranchScope): Promise<Result> {
  const studentId = s(arg["studentId"]);
  const limit = Math.min(Math.max(Number(arg["limit"]) || 50, 1), 200);
  const rows = studentId
    ? await query<Record<string, unknown>>(
        `select * from wa_messages where student_id = $1 order by created_at desc limit $2`,
        [studentId, limit],
      )
    : await query<Record<string, unknown>>(`select * from wa_messages order by created_at desc limit $1`, [limit]);
  const visible = rows.filter((r) => inScope(scope, r.branch));
  return ok({ rows: visible.map(view), count: visible.length });
}

async function setOptOut(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const phone = normalizeIndianMobile(arg["phone"]);
  if (!phone.ok) return refuse("INVALID_PHONE", "Enter a valid 10-digit Indian mobile number.");
  if (arg["optOut"] === false) {
    await query(`delete from wa_optout where phone = $1`, [phone.e164]);
    return ok({ phone: phone.masked, optedOut: false });
  }
  await query(
    `insert into wa_optout (phone, reason, created_by) values ($1,$2,$3)
     on conflict (phone) do update set reason = excluded.reason`,
    [phone.e164, s(arg["reason"]) || null, session.email],
  );
  return ok({ phone: phone.masked, optedOut: true });
}

/** What the app sees: never the full number. */
function view(r: Record<string, unknown>): Result {
  const groupSubject = s(r.to_group_subject);
  const masked = normalizeIndianMobile(s(r.to_phone));
  return {
    messageId: s(r.id),
    studentId: s(r.student_id),
    kind: s(r.kind),
    status: s(r.status),
    to: groupSubject || (masked.ok ? masked.masked : ""),
    body: s(r.body),
    fileName: s(r.file_name),
    error: s(r.error),
    createdAt: s(r.created_at),
    sentAt: s(r.sent_at),
    deliveredAt: s(r.delivered_at),
    readAt: s(r.read_at),
  };
}
