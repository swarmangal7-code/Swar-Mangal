import { test } from "node:test";
import assert from "node:assert/strict";

import { financialYearLabel, formatDocNo, formatSchoolInvoiceNo, receiptSeries, schoolInvoiceSeries } from "../src/lib/rpc/numbering.ts";

test("financial year runs April to March (IST)", () => {
  assert.equal(financialYearLabel(new Date("2026-04-01T00:00:00+05:30")), "26-27");
  assert.equal(financialYearLabel(new Date("2026-09-16T12:00:00+05:30")), "26-27");
  assert.equal(financialYearLabel(new Date("2027-03-31T23:59:00+05:30")), "26-27");
  assert.equal(financialYearLabel(new Date("2027-04-01T00:30:00+05:30")), "27-28");
});

test("financial year uses IST, not UTC, around midnight", () => {
  // 2026-03-31 20:00 UTC is 2026-04-01 01:30 IST — already the new year.
  assert.equal(financialYearLabel(new Date("2026-03-31T20:00:00Z")), "26-27");
});

test("document numbers keep three digits and grow past 999", () => {
  assert.equal(formatDocNo("SMR-26-27", 7), "SMR-26-27-007");
  assert.equal(formatDocNo("SMR-26-27", 142), "SMR-26-27-142");
  assert.equal(formatDocNo("SMR-26-27", 1000), "SMR-26-27-1000");
  assert.equal(formatDocNo("SMR-26-27", 1001), "SMR-26-27-1001");
});

test("a four-digit number stays distinct from the three-digit ones", () => {
  // The old max(right(receipt_no, 3)) read "1000" as "000" and restarted.
  assert.notEqual(formatDocNo("SMR-26-27", 1000), formatDocNo("SMR-26-27", 0));
});

test("series carry the financial year of the document date", () => {
  assert.equal(receiptSeries(new Date("2026-09-16T12:00:00+05:30")), "SMR-26-27");
  assert.equal(schoolInvoiceSeries(new Date("2027-05-02T12:00:00+05:30")), "SMI-27-28");
});

test("a school invoice number appends the school code after the sequence", () => {
  // Matches the numbering already on the issued documents:
  //   SMI-26-27-005_SCH_MHWS / SMI-26-27-006_SCH_MXVILLE
  assert.equal(formatSchoolInvoiceNo("SMI-26-27", 5, "MHWS"), "SMI-26-27-005_SCH_MHWS");
  assert.equal(formatSchoolInvoiceNo("SMI-26-27", 6, "MXVILLE"), "SMI-26-27-006_SCH_MXVILLE");
  assert.equal(formatSchoolInvoiceNo("SMI-26-27", 7, "mhws"), "SMI-26-27-007_SCH_MHWS");
});

test("a school code is normalised, never dropped", () => {
  // Lowercase and stray whitespace would print a number that does not match
  // the school's own record, so they are normalised rather than trusted.
  assert.equal(formatSchoolInvoiceNo("SMI-26-27", 7, "  mhws "), "SMI-26-27-007_SCH_MHWS");
  // The sequence still formats correctly with no code (pre-schools invoices).
  assert.equal(formatSchoolInvoiceNo("SMI-26-27", 7, ""), "SMI-26-27-007");
});

test("the sequence is shared across schools, not restarted per school", () => {
  // 005 was MHWS, 006 was MXVILLE — so the run is one per financial year and a
  // school only ever labels a number, never restarts it.
  const a = formatSchoolInvoiceNo("SMI-26-27", 5, "MHWS");
  const b = formatSchoolInvoiceNo("SMI-26-27", 6, "MXVILLE");
  const c = formatSchoolInvoiceNo("SMI-26-27", 7, "MHWS");
  assert.equal(a, "SMI-26-27-005_SCH_MHWS");
  assert.equal(b, "SMI-26-27-006_SCH_MXVILLE");
  assert.equal(c, "SMI-26-27-007_SCH_MHWS");
  // Same sequence number, different schools -> different documents.
  assert.notEqual(formatSchoolInvoiceNo("SMI-26-27", 7, "MHWS"), formatSchoolInvoiceNo("SMI-26-27", 7, "MXVILLE"));
});
