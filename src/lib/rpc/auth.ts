import { createHash, timingSafeEqual } from "crypto";
import { query } from "@/lib/db";

export type RpcRole = "FOUNDER_ADMIN" | "OPS_USER";

export interface RpcSession {
  role: RpcRole;
  email: string;
  name: string;
  /** Which device this token belongs to, for the audit trail. */
  deviceLabel: string;
  /** Branch allow-list carried by the device row, when it has one. */
  branches?: string[];
}

const FOUNDER_TOKEN = process.env.RPC_FOUNDER_TOKEN || "";
const STAFF_TOKEN = process.env.RPC_STAFF_TOKEN || "";

// Hash both sides so the comparison is constant-time and length-independent.
function tokenMatches(given: string, expected: string): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Resolve a device token to a session.
 *
 * Two sources, in order:
 *  1. The shared env tokens (RPC_FOUNDER_TOKEN / RPC_STAFF_TOKEN) — the
 *     original two devices. These cannot be revoked without a redeploy.
 *  2. The device_tokens table — one row per phone, revocable on the spot
 *     (set revoked_at) and able to carry its own branch allow-list.
 *     Mint one with `node db/mint_device_token.mjs`.
 */
export async function authenticateToken(token?: string | null): Promise<RpcSession | null> {
  if (!token) return null;
  if (tokenMatches(token, FOUNDER_TOKEN)) {
    return { role: "FOUNDER_ADMIN", email: "sharvil87@gmail.com", name: "Sharvil Vaidya", deviceLabel: "env:founder" };
  }
  if (tokenMatches(token, STAFF_TOKEN)) {
    return { role: "OPS_USER", email: "smmahavirnagar@gmail.com", name: "Staff", deviceLabel: "env:staff" };
  }
  return deviceSession(token);
}

async function deviceSession(token: string): Promise<RpcSession | null> {
  let rows: { id: string; role: string; label: string; email: string | null; branches: string | null }[];
  try {
    rows = await query(
      `select id, role, label, email, branches from device_tokens
       where token_hash = $1 and revoked_at is null`,
      [hashToken(token)],
    );
  } catch {
    // No device_tokens table yet (or the DB is unreachable): fail closed.
    return null;
  }
  const row = rows[0];
  if (!row) return null;
  const role: RpcRole = row.role === "FOUNDER_ADMIN" ? "FOUNDER_ADMIN" : "OPS_USER";
  const branches = (row.branches ?? "")
    .split(",")
    .map((b) => b.trim().toUpperCase())
    .filter(Boolean);

  // Best effort: a failed touch must never block the request.
  query(`update device_tokens set last_used_at = now() where id = $1`, [row.id]).catch(() => {});

  return {
    role,
    email: row.email ?? "",
    name: row.label,
    deviceLabel: row.label,
    branches: branches.length ? branches : undefined,
  };
}

export function isFounder(session: RpcSession | null): boolean {
  return session?.role === "FOUNDER_ADMIN";
}

export function isStaff(session: RpcSession | null): boolean {
  return session?.role === "OPS_USER";
}
