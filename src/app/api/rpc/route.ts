import { NextRequest, NextResponse } from "next/server";
import { authenticateToken } from "@/lib/rpc/auth";
import { rpcDispatch } from "@/lib/rpc/handlers";
import { dispatch2 } from "@/lib/rpc/handlers2";
import { dispatchMessaging, MESSAGING_FUNCTIONS } from "@/lib/rpc/messaging";
import { dispatchGovernance, GOVERNANCE_FUNCTIONS } from "@/lib/rpc/governance";
import { dispatchPush, PUSH_FUNCTIONS } from "@/lib/rpc/push";
import { authorizeRpc, authorizeBranch, scopeForSession, WRITE_FUNCTIONS } from "@/lib/rpc/authorization";
import { isDbConfigured, query } from "@/lib/db";
import { impliedBranch } from "@/lib/rpc/authorization";
import type { RpcSession } from "@/lib/rpc/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const rpcOkResponse = (body: Record<string, unknown>) => {
  const json = JSON.stringify(body);
  return new NextResponse(json, {
    status: 200,
    headers: { "Content-Type": "application/json; charset=UTF-8", ...CORS_HEADERS },
  });
};

const rpcError = (code: string, message: string) =>
  rpcOkResponse({ ok: false, code, error: message });

// Ids only — never names, amounts or phone numbers.
const REF_KEYS = ["receiptNo", "draftId", "studentId", "teacherId", "invoiceId", "invoiceNo", "entryId", "inquiryId", "eventId", "messageId", "month", "id"];

function refOf(result: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const k of REF_KEYS) {
    const v = result[k];
    if (typeof v === "string" && v) parts.push(`${k}=${v}`);
    const entry = result["entry"];
    if (k === "id" && entry && typeof entry === "object" && typeof (entry as Record<string, unknown>).id === "string") {
      parts.push(`id=${(entry as Record<string, unknown>).id}`);
    }
  }
  return parts.slice(0, 4).join(" ");
}

/** Audit trail for writes. Never fails the request. */
async function recordAudit(
  session: RpcSession,
  fn: string,
  arg: Record<string, unknown>,
  result: Record<string, unknown>,
) {
  if (!WRITE_FUNCTIONS.has(fn)) return;
  try {
    await query(
      `insert into audit_log (actor_role, actor_email, device_label, fn, ok, code, branch, ref)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        session.role,
        session.email,
        session.deviceLabel,
        fn,
        result["ok"] === true,
        typeof result["code"] === "string" ? result["code"] : null,
        impliedBranch(arg) || null,
        refOf(result) || null,
      ],
    );
  } catch {
    console.error(`[audit-write-failed] fn=${fn}`);
  }
}

function logDeny(sessionEmail: string, role: string, fn: string, code: string, branch: string) {
  // SAFE logging: no token, no password, no payload, no PII.
  console.warn(`[rpc-deny] ts=${new Date().toISOString()} role=${role} email=${sessionEmail} fn=${fn} code=${code} branch=${branch || "none"}`);
}

export async function POST(req: NextRequest) {
  if (!isDbConfigured) {
    return rpcError("NO_DB", "Database not configured");
  }

  let functionName = "";
  let token = "";
  let argMap: Record<string, unknown> = {};

  const formData = await req.formData().catch(() => null);
  if (formData && formData.entries().next().done === false) {
    functionName = String(formData.get("function") ?? "");
    token = String(formData.get("token") ?? "");
    const argRaw = String(formData.get("arg") ?? "");
    if (argRaw) {
      try {
        argMap = JSON.parse(argRaw);
      } catch {
        argMap = {};
      }
    }
  } else {
    try {
      const j = await req.json();
      functionName = String(j?.function ?? "");
      token = String(j?.token ?? "");
      argMap = typeof j?.arg === "object" && j?.arg !== null ? j.arg : {};
    } catch {
      return rpcError("BAD_BODY", "Expected form (function/token/arg) or JSON body");
    }
  }

  if (!functionName) {
    return rpcError("UNKNOWN_API", "No function given");
  }

  // ---- authenticate ----
  const session = await authenticateToken(token);
  if (!session) {
    return rpcError("AUTH_FAILED", "Invalid or missing token");
  }

  // ---- authorize (fail-closed, BEFORE handler execution) ----
  const roleCheck = authorizeRpc(session, functionName);
  if (!roleCheck.ok) {
    logDeny(session.email, session.role, functionName, roleCheck.code, "");
    return rpcError(roleCheck.code, roleCheck.message || "Not authorised");
  }

  const branchCheck = authorizeBranch(session, argMap);
  if (!branchCheck.ok) {
    logDeny(session.email, session.role, functionName, branchCheck.code, "");
    return rpcError(branchCheck.code, branchCheck.message || "Branch not authorised");
  }

  // ---- execute handler (only after authz) ----
  const inHandlers1 = [
    "api_bootstrap", "api_staff_boot",
    "api_searchStudent", "api_staff_searchStudents", "api_staff_getStudentProfile", "api_studentProfile",
    "api_staff_studentHub", "api_addStudent", "api_staff_saveStudentDraft", "api_founder_setStudentStatus", "api_founder_mergeStudentDraft",
    "api_searchReceipt", "api_receiptPreflight", "api_addFeePayment", "api_staff_prepareReceiptDraft",
    "api_founder_listPaymentDrafts", "api_founder_paymentDraftApprove", "api_founder_paymentDraftReject",
    "api_founder_finalisePaymentDraft", "api_staff_finalisePaymentDraft", "api_founder_studentDraftReject",
  ];
  try {
    const scope = scopeForSession(session);
    const result = MESSAGING_FUNCTIONS.has(functionName)
      ? await dispatchMessaging(functionName, argMap, scope, session)
      : GOVERNANCE_FUNCTIONS.has(functionName)
        ? await dispatchGovernance(functionName, argMap, scope, session)
        : PUSH_FUNCTIONS.has(functionName)
          ? await dispatchPush(functionName, argMap, scope, session)
          : inHandlers1.includes(functionName)
            ? await rpcDispatch(session.role, functionName, argMap, scope, session)
            : await dispatch2(session.role, functionName, argMap, scope, session);
    await recordAudit(session, functionName, argMap, result);
    return rpcOkResponse(result);
  } catch (e) {
    // Log the failure type only: no payload, token or stack (may carry PII).
    console.error(`[rpc-error] fn=${functionName} err=${e instanceof Error ? e.name + ": " + e.message.slice(0, 200) : "unknown"}`);
    return rpcError("SERVER_ERROR", "Backend error");
  }
}