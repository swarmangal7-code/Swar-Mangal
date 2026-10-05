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

/** Short, stable identifier of which app screen a tap on this notification
 *  should open. Keep this list short — the Flutter side switches on these
 *  exact strings (lib/services/push_service.dart). "HOME" means "nowhere
 *  specific", which is also the safe fallback for any call site that isn't
 *  sure. */
export type NotifyScreen =
  | "HOME"
  | "APPROVALS"
  | "MY_REQUESTS"
  | "STUDENT_PROFILE"
  | "PAYOUTS"
  | "TEACHERS"
  | "TIMETABLE"
  | "SCHOOL_INVOICE"
  | "INQUIRIES"
  | "EXPENSES"
  | "RECEIPTS"
  | "UPDATE_AVAILABLE";

async function log(
  audience: string,
  branch: string,
  title: string,
  body: string,
  dataType: string,
  dataRef: string,
  dataScreen: string,
  result: { attempted: number; success: number; failure: number; disabled: boolean },
) {
  await query(
    `insert into push_log (audience, branch, title, body, data_type, data_ref, data_screen, token_count, success_count, failure_count, disabled)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [audience, branch || null, title, body, dataType || null, dataRef || null, dataScreen || null, result.attempted, result.success, result.failure, result.disabled],
  ).catch(() => {});
}

async function fire(audience: Audience, title: string, body: string, dataType: string, dataRef: string, screen: NotifyScreen) {
  try {
    if (!(await pushEnabled())) return;
    const tokens = await tokensFor(audience);
    const result = await sendPush(tokens, title, body, { type: dataType, ref: dataRef, screen });
    const audienceLabel =
      audience === "FOUNDER" ? "FOUNDER" : audience === "ALL_STAFF" ? "STAFF:ALL" : `STAFF:${recordBranch(audience.branch)}`;
    const audienceBranch = typeof audience === "object" ? recordBranch(audience.branch) : "";
    await log(audienceLabel, audienceBranch, title, body, dataType, dataRef, screen, result);
  } catch (e) {
    console.error(`[push] notify failed: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

/** A staff draft/request landed in the founder's approval queue. */
export function notifyFounderApproval(kind: string, summary: string, ref: string) {
  void fire("FOUNDER", "Waiting for your approval", `${kind}: ${summary}`, "APPROVAL_WAITING", ref, "APPROVALS");
}

/** The founder decided on something a staff device submitted. */
export function notifyStaffDecision(branch: string, kind: string, summary: string, ref: string) {
  void fire({ branch }, "Sharvil has decided", `${kind}: ${summary}`, "DECISION_MADE", ref, "MY_REQUESTS");
}

/** Generic branch-scoped notice (used by the daily digest script). */
export function notifyBranch(branch: string, title: string, body: string, ref = "", screen: NotifyScreen = "HOME") {
  void fire({ branch }, title, body, "DIGEST", ref, screen);
}

export function notifyFounderGeneric(title: string, body: string, ref = "", screen: NotifyScreen = "HOME") {
  void fire("FOUNDER", title, body, "DIGEST", ref, screen);
}

/** Every staff device, regardless of branch — for academy-wide changes with
 *  no single branch to scope to (a new school, a new teacher, closing the
 *  books for the month). */
export function notifyAllStaff(title: string, body: string, ref = "", screen: NotifyScreen = "HOME") {
  void fire("ALL_STAFF", title, body, "DIGEST", ref, screen);
}

/** Every device, founder and staff alike — the one audience that spans both
 *  roles, used only for "a new build is published, please update" so it
 *  deliberately isn't scoped by role or branch. Tapping it (screen
 *  UPDATE_AVAILABLE) runs the same check-and-install flow as the About
 *  screen's "Check for updates" button, not a navigation. */
export function notifyEveryoneUpdateAvailable(versionName: string, notes: string) {
  const body = notes.trim() ? `v${versionName} — ${notes.trim()}` : `v${versionName} is ready to install.`;
  void fire("FOUNDER", "Update available", body, "APP_UPDATE", versionName, "UPDATE_AVAILABLE");
  void fire("ALL_STAFF", "Update available", body, "APP_UPDATE", versionName, "UPDATE_AVAILABLE");
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
