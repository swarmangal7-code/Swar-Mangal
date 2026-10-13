# Swar Mangal — Backend Setup

Swar Mangal is a **zero-Google-Script** stack:

```
[ Flutter Android APK ]  --HTTPS POST function=<api>&token=<deviceToken>&arg=<json>-->  [ Railway /api/rpc ]
                                                                                              |  Next.js / Node.js
                                                                                              |  token auth -> RPC authz -> handler
                                                                                              v
                                                                                    [ PostgreSQL ]
```

No Google Apps Script. No Google Sheets. No `clasp`. No `/exec`. No `MobileApiGateway`.

## Architecture

- **Client**: Flutter Android APK. Talks RPC to `https://swarmangal-app-production.up.railway.app/api/rpc`.
- **Backend**: Next.js / Node.js deployed on Railway. Exposes a single RPC entry point (`POST /api/rpc`).
- **Database**: PostgreSQL (Railway-managed). Connected via `DATABASE_URL`.
- **Authentication**: Founder/Staff device tokens (`RPC_FOUNDER_TOKEN`, `RPC_STAFF_TOKEN`).
- **Authorization**: Centralized fail-closed policy — every RPC function lists its
  minimum role (`FOUNDER` / `STAFF`); unknown functions and wrong-role calls are
  rejected before the handler runs (see `src/lib/rpc/authorization.ts`).
- **Branch isolation**: two layers. `authorization.ts` rejects a request whose
  *arguments* name a branch outside `RPC_STAFF_BRANCHES`; handlers then check
  the branch *stored on each record*, so a lookup by id cannot cross branches.
  Client-supplied branch/entity values are never trusted, and staff branches
  fail closed when the env var is missing.

## RPC contract

```
POST /api/rpc
Content-Type: application/x-www-form-urlencoded

function=<api_name>
token=<device_token>
arg=<json>
```

Response is always JSON:

```json
{ "ok": true, ... }
```

Errors use machine-readable codes:
- `AUTH_FAILED` — missing/invalid token
- `ROLE_FORBIDDEN` — authenticated but wrong role for this function
- `BRANCH_FORBIDDEN` — staff requesting an unauthorized branch
- `UNKNOWN_API` — function not in the authorization policy (fail closed)
- `SERVER_ERROR` — backend exception (never leaks stack traces/secrets)

## Environment variables (Railway)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `RPC_FOUNDER_TOKEN` | Founder device token (`FOUNDER_ADMIN` role) |
| `RPC_STAFF_TOKEN` | Staff device token (`OPS_USER` role) |
| `RPC_STAFF_BRANCHES` | **Required** staff branch allow-list (`GOREGAON,KANDIVALI`). Unset = staff see no branch data |
| `NEXT_PUBLIC_AUTH_ENABLED` | Web-app auth flag |
| `SESSION_SECRET` | Web-app session signing |
| `ADMIN_PASSWORD` / `STAFF_PASSWORD` | Legacy web logins, min 12 chars. There is no default: unset leaves the account unmanaged, and an account still on an old default password is locked on boot |

## Database (`DATABASE_URL`)

Schema lives in `db/schema.sql`; seed data in `db/seed.sql`; one-time real-data
import in `db/academyos_import.sql`. `db/apply.mjs` applies all three idempotently
on boot (`prestart`). The seed and the real-data import are themselves one-time migrations now — they used to re-run on every boot and resurrect deleted rows. apply.mjs then runs the one-time data migrations in its `MIGRATIONS`
list (recorded in `schema_migrations`, never re-run). Add cleanups there rather
than as boot-time deletes. Manual run against a fresh database:

```
psql "$DATABASE_URL" -f db/schema.sql
psql "$DATABASE_URL" -f db/seed.sql
```

## API key surfaces (Flutter side)

- Production RPC URL is set in `lib/config.dart` (`founderExecUrl` / `staffExecUrl`).
- Login screen accepts a custom gateway URL (validated: https + `/api/rpc`, rejects
  placeholders and legacy Google URLs).
- The device token is stored in **secure storage** (`lib/core/session_storage.dart`),
  never SharedPreferences, never logged.

## Build commands

```
# Flutter app
flutter pub get
flutter analyze
flutter test
flutter build apk --release

# Backend
npm install
npm run typecheck
npm run build
node --experimental-strip-types --test backend-tests/*.test.ts
```

## Teacher payouts

`api_teacherPayoutPreview` computes what a teacher earned in a service month:
each receipt contributes only the slice of its fee period (`fee_period_from`
.. `fee_period_to`) that falls inside the month — a 3-month fee paid at once
credits one month's share per month, never 3 months' salary in the payment
month (receipts without a recorded period count in full in their creation
month). Each slice is attributed through the student id it was written
with, times the percentage in `payout_rules`. It also reports what it cannot
know — `unattributedReceipts` (receipts in the month with no student link),
`awaitingDecision` (students taught by more than one teacher, see below) and
`missingRule` (no payout percentage configured).

### Students taught by two teachers

A shared student's fee counts toward **nobody** until the founder decides the
split, so payout totals can never exceed the money collected. The preview
returns them in `awaitingDecision` with each teacher's class count for the
month as context, and `api_assignSharedStudent` records the decision
(`payout_attributions`, one row per teacher, replacing any earlier decision
for that student and month; the total may not exceed what the student paid).
The founder app does this from the payout screen.

`api_recordTeacherPayout` (founder only) records money actually paid. Each
payment writes a `teacher_payouts` row **and** a `money_ledger` outflow in one
transaction, so the cashbook and the payout history can never disagree. A
month can be settled in parts; `alreadyPaid`, `balance` and `status`
(`UNPAID` / `PARTIAL` / `PAID` / `OVERPAID` / `NOTHING_DUE`) come from the sum
of those rows. `api_teacherPayoutHistory` lists them.

The founder app records a payment from the payout screen; the amount defaults
to the outstanding balance and the app never computes the figures itself.

## Expense drafts

Staff submit an expense with api_staff_submitExpenseDraft; it is stored in
expense_drafts as SUBMITTED and appears in the founder approval centre.
api_founder_expenseDraftApprove turns it into a real expense plus the matching
cashbook outflow in one transaction; api_founder_expenseDraftReject records the
reason. Nothing reaches the books until the founder decides, and approving
twice is a no-op. Since 2026-10-13 staff may also record directly with
api_addExpenseEntry (same audited, idempotency-guarded path as the founder);
drafts stay for reimbursement claims, which carry paid-by tracking. The
cashbook tab shows the lifetime available amount alongside the month's
inflow/outflow/net. The Available figure is editable via api_addBalanceCorrection
(both roles): it posts a real "Balance Correction" ledger adjustment, cash in
or cash out with a mandatory reason — the figure itself is never overwritten.

## Device tokens and the audit trail

A token resolves in two steps: the shared env tokens
(`RPC_FOUNDER_TOKEN` / `RPC_STAFF_TOKEN`), then the `device_tokens` table —
one row per phone, which can be revoked without a redeploy and can carry its
own branch allow-list (overriding `RPC_STAFF_BRANCHES` for that device).
Only the SHA-256 of a token is stored, so a database backup cannot be replayed
against the gateway.

```bash
node db/mint_device_token.mjs "Latika Pixel" OPS_USER KANDIVALI  # prints the token once
node db/mint_device_token.mjs --list
node db/mint_device_token.mjs --revoke DEV-XXXX                  # effective immediately
```

Every write (the `WRITE_FUNCTIONS` set in `authorization.ts`) is recorded in
`audit_log`: when, which role and device, the function, whether it succeeded,
the branch and the record ids involved. Ids only — no names, amounts or phone
numbers. A failed audit insert never fails the request.

```sql
select at, device_label, fn, ok, code, ref from audit_log order by at desc limit 20;
```

The founder app reads the same trail under **Activity Log** (api_founder_auditLog,
founder-only, read-only), with a failures-only filter.

## Fee cycles and due dates

Each student carries their own fee plan on `students_acad`: `fee_plan_name`,
`monthly_fee`, `fee_cycle_months`, `fee_due_day`, `next_due_date`,
`cycle_start`, `cycle_end`, `last_payment_date`. The values were imported once
from the AcademyOS sheet (`db/fee_data_import.sql`, 46 of 58 students); the
rest are null.

`src/lib/rpc/fees.ts` turns `next_due_date` into a state, against today in IST:

| State | Meaning |
|---|---|
| `OVERDUE` | due date has passed |
| `DUE_TODAY` | due today |
| `DUE_SOON` | due within `DEFAULT_ADVANCE_DAYS` (3) |
| `PAID` | paid up, next cycle later |
| `UNKNOWN` | **no due date recorded** — shown as "not set", never chased |
| `INACTIVE` | student left, or a duplicate/test record |

Nothing is inferred from the enrolment status any more, and no count is a
placeholder: reminders, the task cards and the dashboard metrics all come from
these buckets. A finalised payment advances the cycle (`advanceCycle`): on-time
payments extend from the old due date so cycles do not drift, late payments
restart from the payment date.

## Sync revisions

`api_syncChanges` reads the `entity_revisions` table. Every write handler bumps
the entities it touched (`bumpRevisions` in `src/lib/rpc/shared.ts`), so a
polling client reloads only what changed. An entity that has never been written
reads as 0. If you add a write handler, bump its entities there or the apps will
not refresh.

## Document numbering

Receipt numbers (`SMR-<fy>-NNN`) and school invoice numbers (`SMI-<fy>-NNN`)
come from the `doc_counters` table, incremented inside the same transaction
that writes the document, with a unique index on the number. The financial
year comes from the document date (April–March, IST), so the series rolls over
on its own. Numbers past 999 simply get a fourth digit.

## Security model

- Backend is authoritative for role, branches, permissions and identity.
- Stored device token is only a cached credential; validation happens server-side.
- Tokens are never logged, never included in exception messages, never persisted
  in shared preferences.