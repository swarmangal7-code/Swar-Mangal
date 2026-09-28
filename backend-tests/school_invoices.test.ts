import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

import { formatSchoolInvoiceNo, schoolInvoiceSeries } from "../src/lib/rpc/numbering.ts";

// The SQL that decides where a series continues from. Kept as the same string
// shared.ts builds (DOC_NO_SEQ) rather than a copy, by re-deriving it the same
// way — if the two drift, the assertion below stops meaning anything.
const SEQ = `^[A-Z]+-[0-9]{2}-[0-9]{2}-([0-9]+)`;
const OLD_SEQ = `-([0-9]+)$`;

async function withInvoices(nums: string[], fn: (pg: PGlite) => Promise<void>) {
  const pg = new PGlite();
  await pg.query(`create table school_invoices_rpc (invoice_no text)`);
  for (const no of nums) await pg.query(`insert into school_invoices_rpc values ($1)`, [no]);
  try {
    await fn(pg);
  } finally {
    await pg.close();
  }
}

const nextFrom = async (pg: PGlite, pattern: string, series: string) => {
  const r = await pg.query(
    `select coalesce(max(substring(invoice_no from '${pattern}')::int), 0) + 1 as next_no
     from school_invoices_rpc where invoice_no like $1 || '-%'`,
    [series],
  );
  return Number(r.rows[0].next_no);
};

test("the issued school invoices are exactly 005 (MHWS) then 006 (MXVILLE)", () => {
  // The documents this numbering has to continue from.
  assert.equal(formatSchoolInvoiceNo("SMI-26-27", 5, "MHWS"), "SMI-26-27-005_SCH_MHWS");
  assert.equal(formatSchoolInvoiceNo("SMI-26-27", 6, "MXVILLE"), "SMI-26-27-006_SCH_MXVILLE");
});

test("a suffixed invoice number no longer hides the sequence from the counter", async () => {
  // THE REGRESSION. Every school invoice ends in a school code, so the old
  // "digits before the end of the string" match found nothing in them. With
  // 005 and 006 both suffixed it saw only the unsuffixed 004 and handed out 5
  // — minting SMI-26-27-005 a second time, a duplicate number on a money
  // document. Anchoring on the series reads both shapes.
  await withInvoices(["SMI-26-27-004", "SMI-26-27-005_SCH_MHWS", "SMI-26-27-006_SCH_MXVILLE"], async (pg) => {
    const series = schoolInvoiceSeries(new Date("2026-09-28T12:00:00+05:30"));
    assert.equal(series, "SMI-26-27");
    assert.equal(await nextFrom(pg, OLD_SEQ, series), 5, "old rule: would reissue 005");
    assert.equal(await nextFrom(pg, SEQ, series), 7, "next invoice must be 007");
  });
});

test("the next invoice after 005_SCH_MHWS and 006_SCH_MXVILLE is 007", async () => {
  await withInvoices(["SMI-26-27-005_SCH_MHWS", "SMI-26-27-006_SCH_MXVILLE"], async (pg) => {
    assert.equal(await nextFrom(pg, SEQ, "SMI-26-27"), 7);
  });
});

test("a brand new financial year starts at 001 and never inherits the old one", async () => {
  await withInvoices(["SMI-26-27-006_SCH_MXVILLE"], async (pg) => {
    const newSeries = schoolInvoiceSeries(new Date("2027-05-02T12:00:00+05:30"));
    assert.equal(newSeries, "SMI-27-28");
    assert.equal(await nextFrom(pg, SEQ, newSeries), 1);
  });
});

test("receipt numbering (no school suffix) is unaffected", async () => {
  const pg = new PGlite();
  await pg.query(`create table receipts (receipt_no text)`);
  for (const no of ["SMR-26-27-001", "SMR-26-27-002", "SMR-26-27-003"]) {
    await pg.query(`insert into receipts values ($1)`, [no]);
  }
  const r = await pg.query(
    `select coalesce(max(substring(receipt_no from '^[A-Z]+-[0-9]{2}-[0-9]{2}-([0-9]+)')::int), 0) + 1 as next_no
     from receipts where receipt_no like 'SMR-26-27-%'`,
  );
  assert.equal(Number(r.rows[0].next_no), 4);
  await pg.close();
});

test("a four-digit sequence is not mistaken for the three-digit ones", async () => {
  await withInvoices(["SMI-26-27-999_SCH_MHWS"], async (pg) => {
    assert.equal(await nextFrom(pg, SEQ, "SMI-26-27"), 1000);
  });
  await withInvoices(["SMI-26-27-1000_SCH_MHWS"], async (pg) => {
    assert.equal(await nextFrom(pg, SEQ, "SMI-26-27"), 1001);
  });
});

test("the schools seed carries both existing codes exactly once", async () => {
  // Runs against the real schema, so a broken seed or a missing unique index
  // fails here rather than on the first invoice to a school.
  const pg = new PGlite();
  try {
    await pg.exec(
      readFileSync("db/schema.sql", "utf8")
        .replace("create extension if not exists pgcrypto;", "")
        .replaceAll("gen_random_uuid()", "md5(random()::text || clock_timestamp()::text)::uuid"),
    );
    const rows = await pg.query(`select code, name from schools order by code`);
    const codes = rows.rows.map((r) => r.code);
    assert.equal(codes.length, 2);
    assert.equal(codes[0], "MHWS");
    assert.equal(codes[1], "MXVILLE");

    // Re-running the schema must not duplicate or renumber anything.
    await pg.exec(
      readFileSync("db/schema.sql", "utf8")
        .replace("create extension if not exists pgcrypto;", "")
        .replaceAll("gen_random_uuid()", "md5(random()::text || clock_timestamp()::text)::uuid"),
    );
    const again = await pg.query(`select code from schools order by code`);
    assert.equal(again.rows.length, 2, "the schools seed must be idempotent");
  } finally {
    await pg.close();
  }
});
