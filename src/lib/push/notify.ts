// Event-to-push wiring. Every notify* function is fire-and-forget from the
// caller's point of view: it never throws, and the RPC write it reports on
// has already committed by the time this runs. A push that never arrives is
// a delivery problem, not a data-integrity one.
import { query } from "@/lib/db";
import { recordBranch } from "@/lib/rpc/scope";
import { pushEnabled, sendPush } from "./fcm";

type Audience = "FOUNDER" | "ALL_STAFF" | { branch: string };

async function tokensFor(audience: Audience): Promise<string[]> {
  if (audience === "FOUNDER") {
    const rows = await query<{ fcm_token: string }>(`select fcm_token from push_tokens where role = 'FOUNDER_ADMIN'`);
    return rows.map((r) => r.fcm_token);
  }
  if (audience === "ALL_STAFF") {
    const rows = await query<{ fcm_token: string }>(`select fcm_token from push_tokens where role = 'OPS_USER'`);
    return rows.map((r) => r.fcm_token);
  }
  const branch = recordBranch(audience.branch);
  const rows = await query<{ fcm_token: string; branches: string | null }>(
    `select fcm_token, branches from push_tokens where role = 'OPS_USER'`,
  );
  // The stored list is always the device's concrete allowed branches (never
  // "empty means all") — an empty list fails closed, matching nothing.
  return rows
    .filter((r) => {
      const list = (r.branches ?? "").split(",").map((b) => b.trim().toUpperCase()).filter(Boolean);
      return list.includes(branch);
    })
    .map((r) => r.fcm_token);
}

async function log(audience: string, branch: string, title: string, body: string, dataType: string, dataRef: string, result: { attempted: number; success: number; failure: number; disabled: boolean }) {
  await query(
    `insert into push_log (audience, branch, title, body, data_type, data_ref, token_count, success_count, failure_count, disabled)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [audience, branch || null, title, body, dataType || null, dataRef || null, result.attempted, result.success, result.failure, result.disabled],
  ).catch(() => {});
}

async function fire(audience: Audience, title: string, body: string, dataType: string, dataRef: string) {
  try {
    if (!(await pushEnabled())) return;
    const tokens = await tokensFor(audience);
    const result = await sendPush(tokens, title, body, { type: dataType, ref: dataRef });
    const audienceLabel =
      audience === "FOUNDER" ? "FOUNDER" : audience === "ALL_STAFF" ? "STAFF:ALL" : `STAFF:${recordBranch(audience.branch)}`;
    const audienceBranch = typeof audience === "object" ? recordBranch(audience.branch) : "";
    await log(audienceLabel, audienceBranch, title, body, dataType, dataRef, result);
  } catch (e) {
    console.error(`[push] notify failed: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

/** A staff draft/request landed in the founder's approval queue. */
export function notifyFounderApproval(kind: string, summary: string, ref: string) {
  void fire("FOUNDER", "Waiting for your approval", `${kind}: ${summary}`, "APPROVAL_WAITING", ref);
}

/** The founder decided on something a staff device submitted. */
export function notifyStaffDecision(branch: string, kind: string, summary: string, ref: string) {
  void fire({ branch }, "Sharvil has decided", `${kind}: ${summary}`, "DECISION_MADE", ref);
}

/** Generic branch-scoped notice (used by the daily digest script). */
export function notifyBranch(branch: string, title: string, body: string, ref = "") {
  void fire({ branch }, title, body, "DIGEST", ref);
}

export function notifyFounderGeneric(title: string, body: string, ref = "") {
  void fire("FOUNDER", title, body, "DIGEST", ref);
}

/** Every staff device, regardless of branch — for academy-wide changes with
 *  no single branch to scope to (a new school, a new teacher, closing the
 *  books for the month). */
export function notifyAllStaff(title: string, body: string, ref = "") {
  void fire("ALL_STAFF", title, body, "DIGEST", ref);
}

/** Register/replace a device's push token. Upsert on the token itself. */
export async function registerPushToken(input: { fcmToken: string; role: string; deviceLabel: string; email: string; branches: string[]; platform: string }): Promise<void> {
  await query(
    `insert into push_tokens (fcm_token, role, device_label, email, branches, platform, last_seen_at)
     values ($1,$2,$3,$4,$5,$6, now())
     on conflict (fcm_token) do update set
       role = excluded.role, device_label = excluded.device_label, email = excluded.email,
       branches = excluded.branches, platform = excluded.platform, last_seen_at = now()`,
    [input.fcmToken, input.role, input.deviceLabel, input.email || null, input.branches.join(",") || null, input.platform || null],
  );
}

export async function unregisterPushToken(fcmToken: string): Promise<void> {
  await query(`delete from push_tokens where fcm_token = $1`, [fcmToken]);
}
