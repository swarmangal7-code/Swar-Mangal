import { test } from "node:test";
import assert from "node:assert/strict";

// Staff branches are fail-closed: set the env the deployment uses before import.
process.env.RPC_STAFF_BRANCHES = "GOREGAON,KANDIVALI";

import { authorizeRpc, RPC_POLICY, WRITE_FUNCTIONS } from "../src/lib/rpc/authorization.ts";
import type { RpcRole } from "../src/lib/rpc/auth.ts";

const session = (role: RpcRole) =>
  ({ role, email: role === "FOUNDER_ADMIN" ? "sharvil87@gmail.com" : "smmahavirnagar@gmail.com", name: role }) as const;

const founder = session("FOUNDER_ADMIN");
const staff = session("OPS_USER");

// Demo Students is a non-money trial stage that sits between an enquiry and a
// paying admission (founder request 2026-09-28). Either role may record one
// directly — there is no draft, because there is no money in it — but turning a
// demo into a real fee-paying student is a founder decision like any other.

test("demo student lifecycle: staff record a demo, only the founder admits them", () => {
  // Recording a trial is low-risk and non-money: staff do it directly, the same
  // way they already manage enquiries.
  assert.equal(RPC_POLICY["api_addDemoStudent"], "STAFF");
  assert.equal(authorizeRpc(staff, "api_addDemoStudent").ok, true);
  assert.equal(authorizeRpc(founder, "api_addDemoStudent").ok, true);

  // Either role can see the trial list (it is their working list).
  assert.equal(RPC_POLICY["api_listDemoStudents"], "STAFF");
  assert.equal(authorizeRpc(staff, "api_listDemoStudents").ok, true);

  // Conversion writes a fee plan, a due day and a next due date onto a real
  // student row, so it stays founder-gated.
  assert.equal(RPC_POLICY["api_founder_convertDemoStudent"], "FOUNDER");
  const convert = authorizeRpc(staff, "api_founder_convertDemoStudent");
  assert.equal(convert.ok, false);
  assert.equal(convert.code, "ROLE_FORBIDDEN");
  assert.equal(authorizeRpc(founder, "api_founder_convertDemoStudent").ok, true);
});

test("demo student endpoints are branch-scoped, not unrestricted", () => {
  // Every admitted-student read/write is filtered to the operator's branch.
  // A demo student is a person record too, so it must obey the same rule.
  for (const fn of ["api_addDemoStudent", "api_founder_convertDemoStudent"]) {
    assert.ok(WRITE_FUNCTIONS.has(fn), `${fn} should be a branch-scoped function`);
  }
});
