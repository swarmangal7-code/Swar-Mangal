import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

import {
  columnLetter,
  toCell,
  mergeHeader,
  parseUpdatedRange,
  retryDelaySeconds,
  syncOnce,
  enqueueBackfill,
  rebuildIndex,
  META_COLUMNS,
} from "../sync/sheets-sync.mjs";

// ------------------------------------------------------------------ helpers

test("column letters follow A1 notation", () => {
  assert.equal(columnLetter(1), "A");
  assert.equal(columnLetter(26), "Z");
  assert.equal(columnLetter(27), "AA");
  assert.equal(columnLetter(52), "AZ");
  assert.equal(columnLetter(703), "AAA");
});

test("cells: dates stay on their day, timestamps read in IST", () => {
  assert.equal(toCell("2026-09-17", "date"), "2026-09-17");
  // PGlite hands a date column over as UTC midnight
  assert.equal(toCell(new Date("2026-09-17T00:00:00Z"), "date"), "2026-09-17");
  // 20:00 UTC is 01:30 the next morning in Mumbai
  assert.equal(toCell(new Date("2026-09-16T20:00:00Z"), "timestamp with time zone"), "2026-09-17 01:30:00");
});

test("cells: numbers, booleans, json, nulls and formula-looking text", () => {
  assert.equal(toCell("9500.00", "numeric"), 9500);
  assert.equal(toCell("abc", "numeric"), "abc");
  assert.equal(toCell(true, "boolean"), true);
  assert.equal(toCell({ a: 1 }, "jsonb"), '{"a":1}');
  assert.equal(toCell(null), "");
  // written RAW, so this stays text and never runs as a formula
  assert.equal(toCell("=HYPERLINK(\"x\")", "text"), "=HYPERLINK(\"x\")");
});

test("header merge is add-right only", () => {
  const first = mergeHeader([], ["id", "name", ...META_COLUMNS]);
  assert.deepEqual(first.header, ["id", "name", "_deleted", "_synced_at"]);
  assert.equal(first.changed, true);

  // someone reordered nothing; a new DB column arrives
  const later = mergeHeader(first.header, ["id", "name", "branch", ...META_COLUMNS]);
  assert.deepEqual(later.header, ["id", "name", "_deleted", "_synced_at", "branch"]);
  assert.equal(later.changed, true);

  const same = mergeHeader(later.header, ["name", "id"]);
  assert.equal(same.changed, false, "never reorders or removes");
});

test("append range parsing and retry backoff", () => {
  assert.deepEqual(parseUpdatedRange("'receipts'!A12:K14"), { firstRow: 12, lastRow: 14 });
  assert.deepEqual(parseUpdatedRange("receipts!A5"), { firstRow: 5, lastRow: 5 });
  assert.equal(retryDelaySeconds(1), 10);
  assert.equal(retryDelaySeconds(3), 40);
  assert.equal(retryDelaySeconds(99), 900);
});

// ------------------------------------------------------------ integration

/** In-memory workbook that behaves like the Sheets API for our calls. */
class FakeSheets {
  tabs = new Map<string, unknown[][]>();
  failNext = 0;
  calls = 0;

  private tab(title: string) {
    if (!this.tabs.has(title)) throw new Error(`no tab ${title}`);
    return this.tabs.get(title)!;
  }
  private maybeFail() {
    this.calls++;
    if (this.failNext > 0) {
      this.failNext--;
      throw new Error("Sheets POST failed (503): backend unavailable");
    }
  }
  private static col(letters: string) {
    return letters.split("").reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
  }

  async ensureTab(title: string) {
    this.maybeFail();
    if (!this.tabs.has(title)) this.tabs.set(title, []);
  }
  async getHeader(title: string) {
    return [...(this.tab(title)[0] ?? [])];
  }
  async setHeader(title: string, header: unknown[]) {
    const rows = this.tab(title);
    rows[0] = [...header];
  }
  async appendRows(title: string, rows: unknown[][]) {
    this.maybeFail();
    const t = this.tab(title);
    const firstRow = t.length + 1;
    for (const r of rows) t.push([...r]);
    return { firstRow };
  }
  async batchUpdate(title: string, updates: { startCell: string; values: unknown[][] }[]) {
    this.maybeFail();
    const t = this.tab(title);
    for (const u of updates) {
      const m = /^([A-Z]+)(\d+)$/.exec(u.startCell)!;
      const row = Number(m[2]) - 1;
      const col = FakeSheets.col(m[1]);
      u.values.forEach((vals, i) => {
        const target = (t[row + i] ??= []);
        vals.forEach((v, j) => (target[col + j] = v));
      });
    }
  }
  async readColumnA(title: string) {
    return this.tab(title).slice(1).map((r) => r[0] ?? "");
  }
  /** Row as an object keyed by header, for readable assertions. */
  record(title: string, rowNumber: number) {
    const t = this.tab(title);
    return Object.fromEntries(t[0].map((h, i) => [h, t[rowNumber - 1]?.[i]]));
  }
}

async function freshDb() {
  const pg = new PGlite();
  // pgcrypto / gen_random_uuid are not bundled with PGlite. Swap in a portable
  // unique-uuid expression rather than `null` — several tables default their
  // primary key this way, and a null default makes any insert that relies on it
  // (e.g. the instrument_options seed) fail on NOT NULL.
  await pg.exec(
    readFileSync("db/schema.sql", "utf8")
      .replace("create extension if not exists pgcrypto;", "")
      .replaceAll("gen_random_uuid()", "md5(random()::text || clock_timestamp()::text)::uuid"),
  );
  const db = { query: (text: string, params?: unknown[]) => pg.query(text, params) };
  return { pg, db };
}

const pending = async (db: { query: Function }) =>
  Number((await db.query(`select count(*)::int as c from sheet_outbox`)).rows[0].c);

test("mirror: a write is queued in its own transaction and lands in the sheet", async () => {
  const { pg, db } = await freshDb();
  const sheets = new FakeSheets();

  await pg.query(`insert into students_acad (id, name, branch, status, monthly_fee, next_due_date)
                  values ('STU-1','Asha','KANDIVALI','ACTIVE', 3600, '2026-10-05')`);
  assert.equal(await pending(db), 1, "the trigger queued the insert");

  const stats = await syncOnce({ db, sheets, now: () => new Date("2026-09-17T04:30:00Z") });
  assert.equal(stats.appended, 1);
  assert.equal(await pending(db), 0, "queue drained after success");

  const header = sheets.tabs.get("students_acad")![0];
  assert.equal(header[0], "id");
  assert.deepEqual(header.slice(-2), META_COLUMNS);

  const row = sheets.record("students_acad", 2);
  assert.equal(row.id, "STU-1");
  assert.equal(row.name, "Asha");
  assert.equal(row.monthly_fee, 3600);
  assert.equal(row.next_due_date, "2026-10-05");
  assert.equal(row._deleted, false);
  assert.equal(row._synced_at, "2026-09-17 10:00:00");
  await pg.close();
});

test("mirror: repeated edits collapse to one row holding the latest state", async () => {
  const { pg, db } = await freshDb();
  const sheets = new FakeSheets();
  await pg.query(`insert into students_acad (id, name, status) values ('STU-1','Asha','ACTIVE')`);
  await syncOnce({ db, sheets });

  await pg.query(`update students_acad set status = 'PAUSED' where id = 'STU-1'`);
  await pg.query(`update students_acad set status = 'LEFT' where id = 'STU-1'`);
  await syncOnce({ db, sheets });

  const tab = sheets.tabs.get("students_acad")!;
  assert.equal(tab.length, 2, "header + one data row, no duplicate appended");
  assert.equal(sheets.record("students_acad", 2).status, "LEFT");
  await pg.close();
});

test("mirror: a deleted record is marked, never removed (rows below keep their place)", async () => {
  const { pg, db } = await freshDb();
  const sheets = new FakeSheets();
  await pg.query(`insert into students_acad (id, name) values ('STU-1','Asha'),('STU-2','Bipin')`);
  await syncOnce({ db, sheets });

  await pg.query(`delete from students_acad where id = 'STU-1'`);
  const stats = await syncOnce({ db, sheets });
  assert.equal(stats.markedDeleted, 1);

  assert.equal(sheets.record("students_acad", 2).id, "STU-1");
  assert.equal(sheets.record("students_acad", 2)._deleted, true);
  assert.equal(sheets.record("students_acad", 3).id, "STU-2", "the next row did not move");
  await pg.close();
});

test("mirror: when Google fails nothing is lost; it backs off and retries", async () => {
  const { pg, db } = await freshDb();
  const sheets = new FakeSheets();
  await pg.query(`insert into receipts (id, receipt_no, party_name, amount) values ('R1','SMR-26-27-001','Asha',3600)`);

  sheets.failNext = 1;
  const failed = await syncOnce({ db, sheets });
  assert.equal(failed.failedTables.length, 1);
  assert.equal(await pending(db), 1, "still queued");

  const { rows } = await pg.query<{ attempts: number; last_error: string; due: boolean }>(
    `select attempts, last_error, next_attempt_at > now() as due from sheet_outbox`,
  );
  assert.equal(rows[0].attempts, 1);
  assert.match(rows[0].last_error, /503/);
  assert.equal(rows[0].due, true, "not retried until the backoff passes");

  // a second pass inside the backoff window does nothing
  assert.equal((await syncOnce({ db, sheets })).claimed, 0);

  // after the backoff, it lands
  await pg.query(`update sheet_outbox set next_attempt_at = now()`);
  const ok = await syncOnce({ db, sheets });
  assert.equal(ok.appended, 1);
  assert.equal(await pending(db), 0);
  assert.equal(sheets.record("receipts", 2).receipt_no, "SMR-26-27-001");
  await pg.close();
});

test("mirror: a new database column is added at the far right of the tab", async () => {
  const { pg, db } = await freshDb();
  const sheets = new FakeSheets();
  await pg.query(`insert into inquiries (id, name) values ('INQ-1','Riya')`);
  await syncOnce({ db, sheets });
  const before = [...sheets.tabs.get("inquiries")![0]];

  await pg.query(`alter table inquiries add column referral_code text`);
  await pg.query(`update inquiries set referral_code = 'DIWALI' where id = 'INQ-1'`);
  await syncOnce({ db, sheets });

  const after = sheets.tabs.get("inquiries")![0];
  assert.deepEqual(after.slice(0, before.length), before, "existing columns untouched");
  assert.equal(after[after.length - 1], "referral_code");
  assert.equal(sheets.record("inquiries", 2).referral_code, "DIWALI");
  await pg.close();
});

test("mirror: secrets are never queued", async () => {
  const { pg, db } = await freshDb();
  await pg.query(`insert into device_tokens (id, token_hash, role, label) values ('DEV-1','abc','OPS_USER','Phone')`);
  await pg.query(`insert into sheet_row_index (table_name, row_pk, row_number) values ('x','y',2)`);
  assert.equal(await pending(db), 0, "device_tokens has no mirror trigger");
  await pg.close();
});

test("mirror: backfill queues existing rows, and the index can be rebuilt from the sheet", async () => {
  const { pg, db } = await freshDb();
  const sheets = new FakeSheets();
  await pg.query(`insert into teachers_acad (id, name) values ('T1','Herambh'),('T2','Rahul')`);
  await pg.query(`delete from sheet_outbox`); // as if the rows predate the mirror

  const counts = await enqueueBackfill(db, ["teachers_acad"]);
  assert.equal(counts.teachers_acad, 2);
  await syncOnce({ db, sheets });
  assert.equal(sheets.tabs.get("teachers_acad")!.length, 3);

  // someone lost the index; rebuild it from column A and keep updating in place
  await pg.query(`delete from sheet_row_index`);
  const rebuilt = await rebuildIndex({ db, sheets, table: "teachers_acad" });
  assert.equal(rebuilt.indexed, 2);
  await pg.query(`update teachers_acad set status = 'INACTIVE' where id = 'T2'`);
  await syncOnce({ db, sheets });
  assert.equal(sheets.tabs.get("teachers_acad")!.length, 3, "updated in place, not re-appended");
  assert.equal(sheets.record("teachers_acad", 3).status, "INACTIVE");
  await pg.close();
});

test("mirror: a money write and its outbox row commit or roll back together", async () => {
  const { pg, db } = await freshDb();
  await pg.query("begin");
  await pg.query(`insert into money_ledger (id, party_name, amount) values ('LED-1','Asha',3600)`);
  await pg.query("rollback");
  assert.equal(await pending(db), 0, "a rolled-back write leaves nothing to mirror");
  await pg.close();
});
