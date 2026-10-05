// Device push-token registration. Every screen the app shows already comes
// from a pull (RPC call); this is the one place the SERVER reaches the
// device first, so registration itself carries no business rule beyond
// "remember this token against this session's identity."
import type { RpcSession } from "@/lib/rpc/auth";
import { s } from "@/lib/rpc/shared";
import { scopeForSession } from "@/lib/rpc/authorization";
import { registerPushToken, unregisterPushToken, notifyEveryoneUpdateAvailable } from "@/lib/push/notify";
import { pushEnabled } from "@/lib/push/fcm";
import { ALL_BRANCHES, type BranchScope } from "@/lib/rpc/scope";

type Result = Record<string, unknown>;
const ok = (extra: Result = {}): Result => ({ ok: true, ...extra });
const refuse = (code: string, error: string): Result => ({ ok: false, code, error });

export const PUSH_FUNCTIONS = new Set(["api_registerPushToken", "api_unregisterPushToken", "api_pushStatus", "api_founder_notifyAppUpdate"]);

export async function dispatchPush(fn: string, arg: Record<string, unknown>, _scope: BranchScope, session: RpcSession): Promise<Result> {
  switch (fn) {
    case "api_registerPushToken":
      return register(arg, session);
    case "api_unregisterPushToken":
      return unregister(arg);
    case "api_pushStatus":
      return ok({ enabled: await pushEnabled() });
    case "api_founder_notifyAppUpdate":
      return notifyAppUpdate(arg);
    default:
      return refuse("UNKNOWN_API", `No push handler for ${fn}`);
  }
}

/** Founder-triggered broadcast: "a new build is published, please update."
 * Deliberately a manual control, not automatic — a published version.json
 * alone never pages anyone; the founder (or whoever is publishing the build
 * on their behalf) decides when it's worth interrupting every device for. */
async function notifyAppUpdate(arg: Record<string, unknown>): Promise<Result> {
  const versionName = s(arg["versionName"]).trim();
  const notes = s(arg["notes"]).trim();
  if (!versionName) return refuse("VERSION_REQUIRED", "Say which version this is.");
  notifyEveryoneUpdateAvailable(versionName, notes);
  return ok({ note: `Notified everyone about v${versionName}.` });
}

async function register(arg: Record<string, unknown>, session: RpcSession): Promise<Result> {
  const fcmToken = s(arg["fcmToken"]).trim();
  if (!fcmToken) return refuse("TOKEN_REQUIRED", "No push token given.");
  const platform = s(arg["platform"]).trim() || "android";
  // Same scope the RPC gateway itself enforces for this session (brief §2:
  // founder sees every branch; staff sees exactly their allow-list, which is
  // empty — and so notifies nobody — if RPC_STAFF_BRANCHES was never set).
  // Stored as the concrete branch list always (never "empty means all"), so
  // an unset env var fails closed instead of silently notifying everyone.
  const scope = scopeForSession(session);
  const branches = scope.unrestricted ? [...ALL_BRANCHES] : scope.branches;
  await registerPushToken({
    fcmToken,
    role: session.role,
    deviceLabel: session.deviceLabel || session.name || "",
    email: session.email,
    branches,
    platform,
  });
  return ok({ registered: true });
}

async function unregister(arg: Record<string, unknown>): Promise<Result> {
  const fcmToken = s(arg["fcmToken"]).trim();
  if (!fcmToken) return refuse("TOKEN_REQUIRED", "No push token given.");
  await unregisterPushToken(fcmToken);
  return ok({ unregistered: true });
}
