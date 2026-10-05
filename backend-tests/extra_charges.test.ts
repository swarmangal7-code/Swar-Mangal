import { test } from "node:test";
import assert from "node:assert/strict";

import { parseExtraCharges, normalizeChargesJson } from "../src/lib/rpc/extraCharges.ts";

test("no extra charges at all is valid — the brief's 'if required'", () => {
  assert.deepEqual(parseExtraCharges(undefined), { ok: true, charges: [] });
  assert.deepEqual(parseExtraCharges(null), { ok: true, charges: [] });
  assert.deepEqual(parseExtraCharges([]), { ok: true, charges: [] });
});

test("a fully blank row (unused 'Add charge' slot) is dropped, not an error", () => {
  const result = parseExtraCharges([{ description: "", amount: "" }]);
  assert.deepEqual(result, { ok: true, charges: [] });
});

test("a complete charge is accepted and trimmed/coerced", () => {
  const result = parseExtraCharges([{ description: "  Diwali decoration  ", amount: "500" }]);
  assert.deepEqual(result, { ok: true, charges: [{ description: "Diwali decoration", amount: 500 }] });
});

test("several complete charges keep their order", () => {
  const result = parseExtraCharges([
    { description: "Diwali decoration", amount: 500 },
    { description: "Extra class", amount: 300 },
  ]);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.deepEqual(result.charges, [
      { description: "Diwali decoration", amount: 500 },
      { description: "Extra class", amount: 300 },
    ]);
  }
});

test("a description with no amount is rejected", () => {
  const result = parseExtraCharges([{ description: "Diwali decoration", amount: "" }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "EXTRA_CHARGE_INCOMPLETE");
});

test("an amount with no description is rejected", () => {
  const result = parseExtraCharges([{ description: "", amount: 500 }]);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "EXTRA_CHARGE_INCOMPLETE");
});

test("a zero or negative amount does not count as 'has an amount'", () => {
  const zero = parseExtraCharges([{ description: "Freebie", amount: 0 }]);
  assert.equal(zero.ok, false);
  const negative = parseExtraCharges([{ description: "Freebie", amount: -50 }]);
  assert.equal(negative.ok, false);
});

test("one bad row fails the whole batch, even with good rows around it", () => {
  const result = parseExtraCharges([
    { description: "Diwali decoration", amount: 500 },
    { description: "", amount: 300 },
  ]);
  assert.equal(result.ok, false);
});

test("extraCharges must be a list, not some other shape", () => {
  const result = parseExtraCharges({ description: "x", amount: 1 });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "BAD_EXTRA_CHARGES");
});

test("normalizeChargesJson reads back a draft's stored jsonb array (object or stringified)", () => {
  assert.deepEqual(normalizeChargesJson(null), []);
  assert.deepEqual(
    normalizeChargesJson([{ description: "Diwali decoration", amount: "500" }]),
    [{ description: "Diwali decoration", amount: 500 }],
  );
  assert.deepEqual(
    normalizeChargesJson(JSON.stringify([{ description: "Extra class", amount: 300 }])),
    [{ description: "Extra class", amount: 300 }],
  );
  // defensive: a half-written row never reaches here as valid
  assert.deepEqual(normalizeChargesJson([{ description: "", amount: 300 }]), []);
});
