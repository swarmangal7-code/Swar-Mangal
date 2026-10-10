import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import pg from "pg";

const { Client } = pg;
const here = dirname(fileURLToPath(import.meta.url));

const MIN_PASSWORD_LENGTH = 12;
// Passwords that older versions of this script used as fallbacks.
const LEGACY_DEFAULT_PASSWORDS = ["Admin@123", "Staff@123"];

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored ?? "").split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const known = Buffer.from(hash, "hex");
  return candidate.length === known.length && timingSafeEqual(candidate, known);
}

async function ensureUser(client, { email, password, role, fullName }) {
  const hash = hashPassword(password);
  const inserted = await client.query(
    `insert into users (email, password_hash, role) values ($1, $2, $3)
     on conflict (email) do update set password_hash = excluded.password_hash, role = excluded.role
     returning id`,
    [email, hash, role],
  );
  const userId = inserted.rows[0].id;
  await client.query(
    `insert into profiles (user_id, email, full_name, role) values ($1, $2, $3, $4)
     on conflict (user_id) do update set full_name = excluded.full_name, role = excluded.role`,
    [userId, email, fullName, role],
  );
  return userId;
}

// Web login users. Passwords come only from env; there is no fallback.
// If the env var is missing, an existing account still on a legacy default
// password is locked (its hash is replaced with one no password can match).
async function syncLoginUser(client, { envVar, email, role, fullName }) {
  const password = process.env[envVar];
  if (password && password.length >= MIN_PASSWORD_LENGTH) {
    await ensureUser(client, { email, password, role, fullName });
    console.log(`user ${email} ensured (password from ${envVar})`);
    return;
  }
  if (password) {
    console.warn(`user ${email} NOT updated: ${envVar} is shorter than ${MIN_PASSWORD_LENGTH} characters`);
  } else {
    console.warn(`user ${email} not managed: ${envVar} is not set`);
  }
  const existing = await client.query("select id, password_hash from users where email = $1", [email]);
  const row = existing.rows[0];
  if (row && LEGACY_DEFAULT_PASSWORDS.some((p) => verifyPassword(p, row.password_hash))) {
    await client.query("update users set password_hash = 'locked' where id = $1", [row.id]);
    await client.query("delete from user_sessions where user_id = $1", [row.id]);
    console.warn(`user ${email} LOCKED: it was still using a default password`);
  }
}

// ---------------------------------------------------------------------------
// One-time data migrations. Each runs in its own transaction and is recorded
// in schema_migrations, so it never runs twice. Add new entries at the end;
// never edit or reorder an entry that has shipped.
// A migration may throw SkipMigration to leave itself pending for next boot.
// ---------------------------------------------------------------------------
class SkipMigration extends Error {}

export const MIGRATIONS = [
  {
    // Demo/seed rows for the legacy web app. Used to run on every boot, which
    // silently resurrected anything deleted since the last deploy.
    id: "2026-09-16-seed-demo-data",
    run: async (c) => {
      const seed = readFileSync(join(here, "seed.sql"), "utf8");
      await runStatements(c, seed.split(";").map((s) => s.trim()).filter(Boolean), "seed");
    },
  },
  {
    // Real academy data. Same reason: one-time import, not a boot-time reset.
    id: "2026-09-16-academyos-import",
    run: (c) => c.query(readFileSync(join(here, "academyos_import.sql"), "utf8")),
  },
  {
    // Formerly ran on every boot. The timetable delete is intentionally gone:
    // it matched staff-created entries (TT-<id>) as well as seeded ones.
    id: "2026-09-16-qa-smoke-test-cleanup",
    run: (c) =>
      c.query(
        `delete from payment_drafts where student_name ilike '%Bipin%' or student_name ilike '%QA RETEST%';
         delete from receipts where party_name ilike '%Bipin%' or party_name ilike '%QA RETEST%';
         delete from money_ledger where party_name ilike '%Bipin%' or party_name ilike '%QA RETEST%';
         delete from practice_sessions where activity = 'Kanak practice' or activity = 'Chord Practice';`,
      ),
  },
  {
    // Link legacy receipts/ledger rows to a student + branch. Only exact,
    // unambiguous name matches are linked; the rest stay unassigned (visible
    // to founder, hidden from branch-restricted staff).
    id: "2026-09-16-backfill-receipt-branch",
    run: async (c) => {
      await c.query(
        `update receipts r set student_id = s.id
         from (select name, min(id) as id, count(*) as c from students_acad group by name) s
         where r.student_id is null and r.party_name = s.name and s.c = 1`,
      );
      await c.query(
        `update receipts r
         set branch = case when upper(coalesce(sa.branch, '')) like '%GOR%' then 'GOREGAON' else 'KANDIVALI' end
         from students_acad sa
         where r.branch is null and r.student_id = sa.id`,
      );
      await c.query(
        `update money_ledger l set branch = r.branch
         from receipts r
         where l.branch is null and r.record_id = l.id and r.branch is not null`,
      );
    },
  },
  {
    // Receipts had no timestamp of their own; the app derived a "date" from
    // the row id. Take the linked ledger date where there is one.
    id: "2026-09-16-backfill-receipt-created-at",
    run: (c) =>
      c.query(
        `update receipts r set created_at = l.entry_date::timestamptz
         from money_ledger l where r.created_at is null and r.record_id = l.id and l.entry_date is not null`,
      ),
  },
  {
    // Fee plans, cycles and due dates for the students that had them in the
    // Drive export. Students not covered keep null and read as "not set".
    id: "2026-09-16-fee-plan-data",
    run: (c) => c.query(readFileSync(join(here, "fee_data_import.sql"), "utf8")),
  },
  {
    id: "2026-09-16-unique-document-numbers",
    run: async (c) => {
      const dupReceipts = await c.query(
        `select receipt_no, count(*)::int as n from receipts
         where coalesce(receipt_no, '') <> '' group by receipt_no having count(*) > 1`,
      );
      const dupInvoices = await c.query(
        `select invoice_no, count(*)::int as n from school_invoices_rpc
         where coalesce(invoice_no, '') <> '' group by invoice_no having count(*) > 1`,
      );
      if (dupReceipts.rows.length || dupInvoices.rows.length) {
        const list = [...dupReceipts.rows.map((r) => r.receipt_no), ...dupInvoices.rows.map((r) => r.invoice_no)];
        throw new SkipMigration(`duplicate document numbers must be fixed by hand first: ${list.join(", ")}`);
      }
      await c.query(
        `create unique index if not exists receipts_receipt_no_unique on receipts (receipt_no)
         where coalesce(receipt_no, '') <> ''`,
      );
      await c.query(
        `create unique index if not exists school_invoices_invoice_no_unique on school_invoices_rpc (invoice_no)
         where coalesce(invoice_no, '') <> ''`,
      );
    },
  },
  {
    // The server used to fill an empty timetable with invented classes (every
    // teacher, every day, hash-picked times). Remove those, then load the real
    // Kandivali timetable — only if nothing real is left, so staff edits stay.
    id: "2026-09-17-real-timetable",
    run: async (c) => {
      await c.query(`delete from timetable where id ~ '^TT-TCH-[0-9A-F]+-[0-6]$'`);
      const { rows } = await c.query(`select count(*)::int as n from timetable`);
      if (rows[0].n === 0) await c.query(readFileSync(join(here, "timetable_seed.sql"), "utf8"));
    },
  },
  {
    // Founder request 2026-10-09: Today's Classes shows each session's real
    // assigned students (timetable_students) instead of inferring the
    // roster from instrument+branch at read time. Seed that real assignment
    // from the exact same inference every ENABLED slot used before, so no
    // slot's roster goes from "something" to "empty" the moment this ships
    // — from here on, staff/founder edit the assignment directly.
    id: "2026-10-09-seed-timetable-students",
    run: (c) =>
      c.query(
        // The CASE here is the SQL twin of recordBranch() in scope.ts — kept
        // in lockstep with it (blank/"KAN" -> KANDIVALI, "GOR" -> GOREGAON,
        // else the raw value), since this is a one-time seed, not a live
        // query that could import the real function.
        `insert into timetable_students (timetable_id, student_id)
         select t.id, s.id
         from timetable t
         join students_acad s
           on upper(trim(coalesce(s.status,''))) = 'ACTIVE'
          and upper(trim(coalesce(s.instrument,''))) = upper(trim(coalesce(t.class_name,'')))
          and (case when upper(trim(coalesce(s.branch,''))) like '%GOR%' then 'GOREGAON'
                    when upper(trim(coalesce(s.branch,''))) = '' or upper(trim(coalesce(s.branch,''))) like '%KAN%' then 'KANDIVALI'
                    else upper(trim(coalesce(s.branch,''))) end)
              = (case when upper(trim(coalesce(t.branch,''))) like '%GOR%' then 'GOREGAON'
                    when upper(trim(coalesce(t.branch,''))) = '' or upper(trim(coalesce(t.branch,''))) like '%KAN%' then 'KANDIVALI'
                    else upper(trim(coalesce(t.branch,''))) end)
         where t.status = 'ENABLED'
         on conflict do nothing`,
      ),
  },
];

export async function runMigrations(client) {
  const done = new Set((await client.query("select id from schema_migrations")).rows.map((r) => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    try {
      await client.query("begin");
      await m.run(client);
      await client.query("insert into schema_migrations (id) values ($1)", [m.id]);
      await client.query("commit");
      console.log(`migration applied: ${m.id}`);
    } catch (err) {
      await client.query("rollback").catch(() => {});
      if (err instanceof SkipMigration) {
        console.warn(`migration PENDING: ${m.id} — ${err.message}`);
        continue;
      }
      console.error(`migration FAILED: ${m.id} — ${err.message}`);
      throw err;
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("APPLY SKIPPED — no DATABASE_URL, demo mode");
    return;
  }
  let client;
  try {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      // A Postgres on the same VPS/Docker network has no TLS; managed hosts do.
      ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
    });
    await client.connect();
    console.log("connected");

    const schema = readFileSync(join(here, "schema.sql"), "utf8");
    try {
      await client.query(schema);
    } catch (err) {
      console.error("schema FAILED:", err.message);
      if (err.position) {
        const at = Number(err.position);
        console.error("SQL around failure:", schema.slice(Math.max(0, at - 120), at + 160).replace(/\s+/g, " "));
      }
      throw err;
    }
    console.log("schema applied");

    // Seed + import are migrations now (see MIGRATIONS), so a row deleted in
    // the app stays deleted instead of coming back on the next deploy.
    await runMigrations(client);

    await syncLoginUser(client, { envVar: "ADMIN_PASSWORD", email: "admin@maestro.app", role: "admin", fullName: "Academy Admin" });
    await syncLoginUser(client, { envVar: "STAFF_PASSWORD", email: "staff@maestro.app", role: "teacher", fullName: "Academy Staff" });

    if (!process.env.RPC_STAFF_BRANCHES) {
      console.warn("RPC_STAFF_BRANCHES is not set — the staff app will see no branch data until it is (e.g. KANDIVALI)");
    }

    const r = await client.query(
      "select (select count(*) from students) as students, (select count(*) from students_acad) as students_acad, (select count(*) from teachers_acad) as teachers_acad, (select count(*) from receipts) as receipts, (select count(*) from attendance_acad) as attendance, (select count(*) from inquiries) as inquiries",
    );
    console.log("counts", JSON.stringify(r.rows[0]));
  } catch (err) {
    console.error("APPLY FAILED", err.message, err.stack ? "" : "");
    process.exitCode = 1;
  } finally {
    if (client) await client.end().catch(() => {});
  }
}

async function runStatements(client, statements, label) {
  for (const stmt of statements) {
    try {
      await client.query(stmt);
    } catch (err) {
      console.error(label + " FAILED:", err.message);
      console.error("SQL head:", stmt.replace(/\s+/g, " ").slice(0, 180));
      throw err;
    }
  }
}

// Only run when executed directly (npm prestart / railpack), not on import.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
