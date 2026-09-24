-- Swar Mangal Academy — PostgreSQL schema
-- Plain Postgres: no auth.users, no RLS, no auth.uid(). Runs on any Postgres
-- 13+ via psql — Railway, aaPanel's native Postgres plugin, or local dev.

create extension if not exists pgcrypto;

-- ============ ENUMS ============
do $$ begin
  create type user_role as enum ('admin', 'teacher', 'student', 'parent');
exception when duplicate_object then null; end $$;
do $$ begin
  create type attendance_status as enum ('present', 'absent', 'late', 'excused');
exception when duplicate_object then null; end $$;
do $$ begin
  create type class_status as enum ('scheduled', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;
do $$ begin
  create type class_mode as enum ('online', 'offline');
exception when duplicate_object then null; end $$;
do $$ begin
  create type assignment_status as enum ('pending', 'submitted', 'reviewed', 'overdue');
exception when duplicate_object then null; end $$;
do $$ begin
  create type difficulty as enum ('beginner', 'intermediate', 'advanced');
exception when duplicate_object then null; end $$;
do $$ begin
  create type resource_type as enum ('sheet_music', 'exercise', 'scales', 'chords', 'theory', 'song', 'audio', 'video', 'lesson');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_status as enum ('paid', 'pending', 'overdue', 'partial');
exception when duplicate_object then null; end $$;

-- ============ USERS (replaces auth.users) ============
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  role user_role not null default 'student',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_sessions (
  token_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

-- ============ PROFILES ============
create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role user_role not null default 'student',
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_profiles_user on profiles(user_id);

-- ============ INSTRUMENTS ============
create table if not exists instruments (
  id text primary key,
  name text not null unique,
  icon text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ COURSES ============
create table if not exists courses (
  id text primary key,
  name text not null,
  instrument_id text references instruments(id) on delete set null,
  level text not null default 'Beginner',
  description text,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ TEACHERS / STUDENTS / PARENTS ============
create table if not exists teachers (
  id text primary key,
  profile_id uuid references profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  phone text,
  instrument text,
  rating numeric(2,1) default 0
);

create table if not exists parents (
  id text primary key,
  profile_id uuid references profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists students (
  id text primary key,
  profile_id uuid references profiles(id) on delete cascade,
  full_name text not null,
  email text not null,
  avatar_url text,
  phone text,
  instrument text,
  level text default 'Beginner',
  parent_id text references parents(id) on delete set null,
  fee_status payment_status default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ CLASSES / SCHEDULES ============
create table if not exists classes (
  id text primary key,
  title text not null,
  instrument text,
  teacher_id text references teachers(id) on delete set null,
  teacher_name text,
  course_id text references courses(id) on delete set null,
  room text,
  mode class_mode default 'offline',
  status class_status default 'scheduled',
  recurring text,
  start_time timestamptz not null,
  end_time timestamptz not null,
  duration_min int,
  color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_classes_start on classes(start_time);
create index if not exists idx_classes_teacher on classes(teacher_id);
create index if not exists idx_classes_status on classes(status);

create table if not exists class_students (
  class_id text references classes(id) on delete cascade,
  student_id text references students(id) on delete cascade,
  primary key (class_id, student_id)
);

-- ============ ATTENDANCE ============
create table if not exists attendance (
  id text primary key,
  class_id text references classes(id) on delete cascade,
  student_id text references students(id) on delete cascade,
  status attendance_status not null default 'present',
  date timestamptz not null default now(),
  marked_by text references teachers(id),
  created_at timestamptz not null default now(),
  unique (class_id, student_id, date)
);

create index if not exists idx_attendance_student on attendance(student_id, date);

-- ============ PRACTICE ============
create table if not exists practice_sessions (
  id text primary key,
  student_id text not null,
  instrument text,
  activity text not null,
  minutes int not null,
  date timestamptz not null default now(),
  notes text,
  goal_met boolean default false,
  created_at timestamptz not null default now()
);

-- drop legacy FK so real AcademyOS student ids (students_acad) can be referenced
alter table practice_sessions drop constraint if exists practice_sessions_student_id_fkey;

create index if not exists idx_practice_student_date on practice_sessions(student_id, date desc);

-- ============ ASSIGNMENTS ============
create table if not exists assignments (
  id text primary key,
  title text not null,
  description text,
  instrument text,
  difficulty difficulty default 'beginner',
  due_date timestamptz not null,
  expected_minutes int default 30,
  teacher_id text references teachers(id) on delete set null not null,
  teacher_name text,
  student_id text references students(id) on delete cascade not null,
  status assignment_status default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_assignments_student on assignments(student_id, due_date);
create index if not exists idx_assignments_teacher on assignments(teacher_id);

create table if not exists assignment_submissions (
  id text primary key,
  assignment_id text references assignments(id) on delete cascade unique,
  student_id text references students(id) on delete cascade,
  body text,
  attachment_url text,
  submitted_at timestamptz not null default now()
);

-- ============ LEARNING RESOURCES ============
create table if not exists learning_resources (
  id text primary key,
  title text not null,
  instrument text,
  level text,
  type resource_type not null default 'lesson',
  duration_min int,
  author text,
  author_id text,
  audio_url text,
  file_url text,
  favorite boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ PROGRESS ============
create table if not exists progress_categories (
  id text primary key,
  name text unique not null
);

create table if not exists progress (
  id text primary key,
  student_id text references students(id) on delete cascade not null,
  category text not null,
  score int not null default 0 check (score >= 0 and score <= 100),
  instrument text,
  level text,
  recorded_at timestamptz not null default now(),
  unique (student_id, category)
);

create table if not exists teacher_feedback (
  id text primary key,
  student_id text references students(id) on delete cascade not null,
  teacher_id text references teachers(id) on delete set null,
  teacher_name text,
  category text,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists achievements (
  id text primary key,
  student_id text references students(id) on delete cascade not null,
  title text not null,
  description text,
  icon text,
  earned_at timestamptz not null default now()
);

-- ============ MESSAGING ============
create table if not exists message_threads (
  id text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists message_participants (
  thread_id text references message_threads(id) on delete cascade,
  participant_name text,
  participant_id text,
  unread_count int default 0,
  primary key (thread_id, participant_name)
);

create table if not exists messages (
  id text primary key,
  thread_id text references message_threads(id) on delete cascade not null,
  sender_id text,
  sender_name text not null,
  body text not null,
  attachment_url text,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_thread on messages(thread_id, created_at);

-- ============ NOTIFICATIONS ============
create table if not exists notifications (
  id text primary key,
  user_id text,
  title text not null,
  body text,
  type text default 'general',
  read boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id, created_at desc);

-- ============ ANNOUNCEMENTS ============
create table if not exists announcements (
  id text primary key,
  title text not null,
  body text,
  author text,
  audience text default 'all',
  pinned boolean default false,
  created_at timestamptz not null default now()
);

-- ============ PAYMENTS ============
create table if not exists invoices (
  id text primary key,
  student_id text references students(id) on delete cascade not null,
  student_name text,
  description text,
  amount numeric(10,2) not null check (amount >= 0),
  status payment_status default 'pending',
  issued_date timestamptz not null default now(),
  due_date timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id text primary key,
  invoice_id text references invoices(id) on delete set null,
  student_name text,
  amount numeric(10,2) not null,
  method text,
  transaction_id text,
  status payment_status default 'paid',
  paid_at timestamptz not null default now()
);

create index if not exists idx_invoices_student on invoices(student_id, status);

-- ============ ACADEMYOS MIRROR TABLES (real ERP data import) ============

create table if not exists entities (
  id text primary key,
  code text,
  name text,
  entity_type text,
  address text,
  active boolean default true
);

create table if not exists teachers_acad (
  id text primary key,
  name text,
  phone text,
  email text,
  instrument text,
  status text
);

create table if not exists students_acad (
  id text primary key,
  name text,
  guardian_name text,
  phone text,
  email text,
  instrument text,
  branch text,
  batch text,
  fee_plan text,
  status text,
  enrollment_date date,
  notes text
);

create table if not exists packages (
  id text primary key,
  entity_code text,
  course text,
  name text,
  package_type text,
  billing_type text,
  fee_amount numeric(10,2)
);

create table if not exists student_packages (
  id text primary key,
  student_id text,
  student_name text,
  course text,
  teacher_id text,
  receipt_no text,
  fee_amount numeric(10,2),
  cycle_start date,
  cycle_end date
);

create table if not exists receipts (
  id text primary key,
  receipt_no text,
  party_name text,
  amount numeric(10,2),
  status text,
  payment_mode text,
  linked_url text,
  record_id text
);

create table if not exists money_ledger (
  id text primary key,
  entry_date date,
  party_name text,
  category text,
  description text,
  inflow numeric(10,2),
  outflow numeric(10,2),
  amount numeric(10,2),
  payment_mode text,
  account text,
  status text
);

create table if not exists expenses (
  id text primary key,
  expense_date date,
  category text,
  vendor text,
  description text,
  amount numeric(10,2),
  approval_status text
);

create table if not exists attendance_acad (
  id text primary key,
  session_date date,
  student_id text,
  student_name text,
  teacher_id text,
  teacher_name text,
  instrument text,
  status text
);

create table if not exists inquiries (
  id text primary key,
  name text,
  phone text,
  instrument text,
  branch text,
  source text,
  notes text,
  status text,
  created_at date
);

create table if not exists payout_rules (
  id text primary key,
  teacher_id text,
  teacher_name text,
  entity_id text,
  course text,
  payout_type text,
  percentage numeric(5,2)
);

create table if not exists school_compensation (
  id text primary key,
  teacher_id text,
  teacher_name text,
  school_id text,
  courses text,
  monthly_amount numeric(10,2),
  payout_type text,
  status text
);

create table if not exists schools (
  id text primary key,
  name text,
  address text,
  entity_id text,
  active boolean default true
);

-- ============ RPC SUPPORT TABLES (standalone gateway) ============

create table if not exists payment_drafts (
  id text primary key,
  status text not null default 'SUBMITTED',
  student_id text,
  student_name text,
  amount numeric(10,2) not null,
  payment_mode text,
  branch text,
  terms_status text default '',
  projected_next_due_date text,
  repair_required boolean default false,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  approval_authority text default '',
  approved_by text default '',
  approved_at timestamptz,
  finalised_receipt_no text,
  finalised_at timestamptz
);

create table if not exists timetable (
  id text primary key,
  branch text not null,
  day_of_week int not null,
  start_time text not null,
  end_time text not null,
  class_name text not null,
  teacher_id text,
  teacher_name text,
  status text default 'ENABLED'
);

create table if not exists scheduled_sessions (
  id text primary key,
  session_date text,
  start_time text,
  teacher_id text,
  teacher_name text,
  branch text,
  course text,
  outcome text default '',
  delivered_by text default '',
  payee_teacher_id text default '',
  recorded_by text default '',
  evidence_class text default '',
  evidence_reason text default '',
  not_required boolean default false,
  closure_reason text default '',
  custom_kind text default '',
  custom_reason text default '',
  resolved boolean default false,
  answerable boolean default true,
  created_at timestamptz not null default now()
);

create table if not exists school_invoices_rpc (
  id text primary key,
  invoice_no text,
  invoice_date text,
  branch text,
  class_name text,
  amount numeric(10,2),
  tenure text,
  status text default 'FINAL',
  created_at timestamptz not null default now()
);
-- ============ BRANCH OWNERSHIP + DOCUMENT NUMBERING ============

-- Branch/student ownership on money rows so staff scope can be enforced
-- from stored data (backfilled once by db/apply.mjs migrations).
alter table receipts add column if not exists student_id text;
alter table receipts add column if not exists branch text;
alter table money_ledger add column if not exists branch text;

-- One row per numbering series (e.g. SMR-26-27). Incremented inside the
-- same transaction that writes the document, so numbers never repeat.
create table if not exists doc_counters (
  series text primary key,
  last_no int not null
);

-- One-time data migrations applied by db/apply.mjs.
create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

-- Receipt timestamp: the app used to derive a "date" from the row id.
alter table receipts add column if not exists created_at timestamptz;

-- Revision counters powering api_syncChanges. Bumped by every write handler;
-- clients poll for the entities whose revision moved.
create table if not exists entity_revisions (
  entity text primary key,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);

create index if not exists idx_receipts_student on receipts (student_id);
create index if not exists idx_receipts_party on receipts (party_name);
create index if not exists idx_attendance_acad_student on attendance_acad (student_id);
create index if not exists idx_money_ledger_entry_date on money_ledger (entry_date);

-- Fee plan + cycle per student (imported from the AcademyOS sheet, then
-- maintained by the app on each payment). Null means "not recorded yet";
-- the apps show that honestly instead of assuming a due date.
alter table students_acad add column if not exists fee_plan_name text;
alter table students_acad add column if not exists monthly_fee numeric(10,2);
alter table students_acad add column if not exists fee_cycle_months int;
alter table students_acad add column if not exists fee_due_day int;
alter table students_acad add column if not exists next_due_date date;
alter table students_acad add column if not exists cycle_start date;
alter table students_acad add column if not exists cycle_end date;
alter table students_acad add column if not exists last_payment_date date;

create index if not exists idx_students_acad_next_due on students_acad (next_due_date);

-- ============ DEVICE TOKENS + AUDIT TRAIL ============

-- One row per issued device token. The token itself is never stored, only
-- its SHA-256. Revoke a lost phone by setting revoked_at.
create table if not exists device_tokens (
  id text primary key,
  token_hash text not null unique,
  role text not null,
  label text not null,
  email text,
  branches text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Who did what. Ids only: no names, amounts or phone numbers.
create table if not exists audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_role text,
  actor_email text,
  device_label text,
  fn text not null,
  ok boolean not null,
  code text,
  branch text,
  ref text
);

create index if not exists idx_audit_log_at on audit_log (at desc);

-- Teacher payouts actually paid out. One row per payment, so a month can be
-- settled in parts; the balance is payable minus the sum of these.
create table if not exists teacher_payouts (
  id text primary key,
  teacher_id text not null,
  teacher_name text,
  service_month text not null,
  amount numeric(10,2) not null,
  paid_on date not null,
  payment_mode text,
  reference text,
  branch text,
  recorded_by text,
  ledger_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_teacher_payouts_month on teacher_payouts (service_month, teacher_id);

-- Founder's decision on how a shared student's fee is split for one month.
-- Until a decision exists the fee counts toward nobody, so payout totals
-- never exceed the money actually collected.
create table if not exists payout_attributions (
  id text primary key,
  service_month text not null,
  student_id text not null,
  teacher_id text not null,
  amount numeric(10,2) not null,
  decided_by text,
  created_at timestamptz not null default now(),
  unique (service_month, student_id, teacher_id)
);

create index if not exists idx_payout_attributions_month on payout_attributions (service_month);

-- Staff-submitted expense drafts awaiting the founder. These used to be
-- answered with "persisted: true" and then dropped on the floor.
create table if not exists expense_drafts (
  id text primary key,
  status text not null default 'SUBMITTED',
  category text,
  vendor text,
  description text,
  amount numeric(10,2) not null,
  payment_mode text,
  branch text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  expense_id text,
  ledger_id text
);

create index if not exists idx_expense_drafts_status on expense_drafts (status, submitted_at);

-- ============ GOOGLE SHEETS MIRROR (Postgres is the source of truth) ============
-- Every insert/update/delete on a mirrored table enqueues its primary key in
-- the SAME transaction, via trigger, so no write path can skip the mirror.
-- The sheets worker (sync/worker.mjs) drains this queue into the mirror
-- workbook. Sheets being slow or down never blocks a save.
create table if not exists sheet_outbox (
  id bigserial primary key,
  table_name text not null,
  row_pk text not null,
  op text not null,
  enqueued_at timestamptz not null default now(),
  attempts int not null default 0,
  last_error text,
  next_attempt_at timestamptz not null default now()
);
create index if not exists idx_sheet_outbox_due on sheet_outbox (next_attempt_at, id);

-- Which sheet row holds which record, so updates never scan the sheet.
create table if not exists sheet_row_index (
  table_name text not null,
  row_pk text not null,
  row_number int not null,
  primary key (table_name, row_pk)
);

create or replace function sheet_outbox_enqueue() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    insert into sheet_outbox (table_name, row_pk, op) values (tg_table_name, to_jsonb(old)->>'id', 'DELETE');
    return old;
  end if;
  insert into sheet_outbox (table_name, row_pk, op) values (tg_table_name, to_jsonb(new)->>'id', tg_op);
  return new;
end $$;

-- Mirrored tables. Secrets (device_tokens, users, sessions) are NEVER mirrored.
-- Keep in step with MIRRORED_TABLES in sync/sheets-sync.mjs.
do $$
declare t text;
begin
  foreach t in array array[
    'students_acad','teachers_acad','receipts','money_ledger','expenses','expense_drafts',
    'payment_drafts','teacher_payouts','payout_attributions','payout_rules','timetable',
    'attendance_acad','scheduled_sessions','inquiries','school_invoices_rpc','audit_log',
    'entities','schools'
  ] loop
    execute format('drop trigger if exists sheet_mirror on %I', t);
    execute format(
      'create trigger sheet_mirror after insert or update or delete on %I for each row execute function sheet_outbox_enqueue()',
      t);
  end loop;
end $$;

-- ============ WHATSAPP (via self-hosted WA-AKG gateway) ============
-- One row per message a human chose to send. Status only moves forward:
-- SENDING -> SENT (gateway returned WhatsApp's message id) -> DELIVERED -> READ,
-- or FAILED. Nothing is ever sent automatically.
create table if not exists wa_messages (
  id text primary key,
  client_intent_key text,
  student_id text,
  branch text,
  kind text not null,
  to_phone text not null,
  body text,
  file_name text,
  status text not null,
  provider_message_id text,
  error text,
  requested_by text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz
);
create unique index if not exists wa_messages_intent_unique on wa_messages (client_intent_key)
  where client_intent_key is not null;
create index if not exists idx_wa_messages_provider on wa_messages (provider_message_id);
create index if not exists idx_wa_messages_student on wa_messages (student_id, created_at desc);

-- Numbers that must never be messaged.
create table if not exists wa_optout (
  phone text primary key,
  reason text,
  created_by text,
  created_at timestamptz not null default now()
);

do $$
begin
  drop trigger if exists sheet_mirror on wa_messages;
  create trigger sheet_mirror after insert or update or delete on wa_messages
    for each row execute function sheet_outbox_enqueue();
end $$;

-- ============ FIELDS THE APP SENDS THAT HAD NOWHERE TO LIVE ============
-- Staff fee drafts: owner rule — every fee payment carries a UTR or a
-- physical receipt-book number, never neither.
alter table payment_drafts add column if not exists payment_date date;
alter table payment_drafts add column if not exists payment_reference text;
alter table payment_drafts add column if not exists physical_receipt_no text;
alter table payment_drafts add column if not exists package_start_date date;
alter table payment_drafts add column if not exists months_paid int;
alter table payment_drafts add column if not exists notes text;
alter table payment_drafts add column if not exists decision_note text;
alter table payment_drafts add column if not exists client_intent_key text;
create unique index if not exists payment_drafts_intent_unique on payment_drafts (client_intent_key)
  where client_intent_key is not null;

alter table receipts add column if not exists payment_date date;
alter table receipts add column if not exists txn_id text;
alter table receipts add column if not exists physical_receipt_no text;
alter table receipts add column if not exists fee_period_from date;
alter table receipts add column if not exists fee_period_to date;
alter table receipts add column if not exists client_intent_key text;
create unique index if not exists receipts_intent_unique on receipts (client_intent_key)
  where client_intent_key is not null;

alter table expense_drafts add column if not exists expense_date date;
alter table expense_drafts add column if not exists payment_reference text;
alter table expense_drafts add column if not exists paid_from_account text;
alter table expense_drafts add column if not exists notes text;
alter table expense_drafts add column if not exists client_intent_key text;
create unique index if not exists expense_drafts_intent_unique on expense_drafts (client_intent_key)
  where client_intent_key is not null;

alter table expenses add column if not exists payment_reference text;
alter table expenses add column if not exists client_intent_key text;
create unique index if not exists expenses_intent_unique on expenses (client_intent_key)
  where client_intent_key is not null;

-- Inquiry follow-up ladder. created_at had no default, so it was always blank.
alter table inquiries alter column created_at set default current_date;
alter table inquiries add column if not exists next_contact_date date;
alter table inquiries add column if not exists trial_date date;
alter table inquiries add column if not exists drop_reason text;
alter table inquiries add column if not exists converted_student_id text;
alter table inquiries add column if not exists updated_at timestamptz;

-- Today's classes: a class is answered once; late entries say why.
alter table scheduled_sessions add column if not exists late_reason text;
alter table scheduled_sessions add column if not exists timetable_id text;

-- Staff student add/edit is a PROPOSAL the founder merges (brief pattern B).
-- It used to create a live student directly, and an edit created a duplicate.
create table if not exists student_drafts (
  id text primary key,
  status text not null default 'SUBMITTED',
  action text not null,
  student_id text,
  name text,
  phone text,
  email text,
  parent_name text,
  course text,
  branch text,
  batch text,
  fee_plan text,
  notes text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  client_intent_key text
);
create unique index if not exists student_drafts_intent_unique on student_drafts (client_intent_key)
  where client_intent_key is not null;

do $$
begin
  drop trigger if exists sheet_mirror on student_drafts;
  create trigger sheet_mirror after insert or update or delete on student_drafts
    for each row execute function sheet_outbox_enqueue();
end $$;

-- ============ BRIEF GOVERNANCE ============
-- Closed service months (brief §11.7, P6.7). A write touching a closed month
-- is refused WHOLE, naming the month. Rows are never deleted.
create table if not exists period_locks (
  id text primary key,              -- the service month, YYYY-MM
  closed_by text,
  closed_at timestamptz not null default now(),
  note text
);

-- Pattern C: a receipt is never edited. Staff ask for a correction; the
-- founder voids it (numbers are never reused) and a new receipt is issued.
create table if not exists receipt_corrections (
  id text primary key,
  receipt_no text not null,
  reason text not null,
  status text not null default 'SUBMITTED',   -- SUBMITTED | VOIDED | REJECTED
  branch text,
  requested_by text,
  requested_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  client_intent_key text
);
create unique index if not exists receipt_corrections_intent_unique on receipt_corrections (client_intent_key)
  where client_intent_key is not null;
alter table receipts add column if not exists void_reason text;
alter table receipts add column if not exists voided_by text;
alter table receipts add column if not exists voided_at timestamptz;
-- The student's due date before and after this receipt moved it, so a void
-- can put it back without the server guessing.
alter table receipts add column if not exists prev_next_due_date date;
alter table receipts add column if not exists advanced_next_due_date date;

-- P11: staff propose a school invoice; only the founder allocates an SMI- number.
create table if not exists school_invoice_drafts (
  id text primary key,
  status text not null default 'SUBMITTED',   -- SUBMITTED | FINALISED | REJECTED
  branch text,
  class_name text,
  amount numeric(10,2),
  tenure text,
  invoice_date date,
  notes text,
  preview_confirmed boolean not null default false,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  final_invoice_id text,
  final_invoice_no text,
  client_intent_key text
);
create unique index if not exists school_invoice_drafts_intent_unique on school_invoice_drafts (client_intent_key)
  where client_intent_key is not null;

-- P4: who marked attendance, and why a backdated mark was late.
alter table attendance_acad add column if not exists backdated_reason text;
alter table attendance_acad add column if not exists recorded_by text;
alter table attendance_acad add column if not exists recorded_at timestamptz;

-- §10.2 custom sessions: SUBSTITUTE / REPLACEMENT / GOODWILL_RECOVERY are
-- different things. Payable defaults to NO.
alter table scheduled_sessions add column if not exists payable boolean not null default false;
alter table scheduled_sessions add column if not exists original_event_id text;
alter table scheduled_sessions add column if not exists replacement_event_id text;

-- P1 no-answer ladder (+3 days, +7 days, then DORMANT) and "Call these today".
alter table inquiries add column if not exists no_answer_count int not null default 0;
alter table inquiries add column if not exists last_contacted_at date;

-- P2: a student status change is a draft the founder decides.
alter table student_drafts add column if not exists lifecycle_status text;
alter table student_drafts add column if not exists status_reason text;

do $$
declare t text;
begin
  foreach t in array array['period_locks','receipt_corrections','school_invoice_drafts'] loop
    execute format('drop trigger if exists sheet_mirror on %I', t);
    execute format(
      'create trigger sheet_mirror after insert or update or delete on %I for each row execute function sheet_outbox_enqueue()',
      t);
  end loop;
end $$;

-- P8: who paid out of pocket, and whether they are owed it back.
alter table expense_drafts add column if not exists paid_by_person text;
alter table expense_drafts add column if not exists reimbursement_required boolean not null default false;

-- ============ PUSH NOTIFICATIONS (Firebase Cloud Messaging) ============
-- One row per physical device's push token. Keyed by the token itself (not
-- the RPC device id) because a shared env token (RPC_STAFF_TOKEN) can be on
-- several phones at once, each with its own FCM token.
create table if not exists push_tokens (
  fcm_token text primary key,
  role text not null,
  device_label text not null,
  email text,
  branches text,
  platform text,
  registered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_push_tokens_role on push_tokens (role);

-- A record of what was sent and to how many devices — lets the founder see
-- delivery was attempted even before opening the phone, and lets support
-- diagnose "I never got notified" without reading Firebase's own logs.
create table if not exists push_log (
  id bigserial primary key,
  sent_at timestamptz not null default now(),
  audience text not null,
  branch text,
  title text not null,
  body text not null,
  data_type text,
  data_ref text,
  token_count int not null default 0,
  success_count int not null default 0,
  failure_count int not null default 0,
  disabled boolean not null default false
);

-- P1: how a student's enquiry became an admission (brief P1, extended per
-- founder request 2026-09-17: track intake source for reporting).
alter table students_acad add column if not exists admission_source text;
alter table student_drafts add column if not exists admission_source text;

-- Founder request 2026-09-24: a guardian contact number distinct from the
-- student's own phone (students_acad.phone), and a joining date on
-- student_drafts (students_acad already has enrollment_date, but the staff
-- draft path never had a column to carry it into the merge).
alter table students_acad add column if not exists guardian_phone text;
alter table student_drafts add column if not exists guardian_phone text;
alter table student_drafts add column if not exists enrollment_date date;

-- Brief §2.2: a package extension is a staff proposal, the founder decides.
-- Approval nudges the student's existing fee_cycle_months/next_due_date
-- fields rather than a separate "package" model, since students_acad has no
-- package concept beyond those columns.
create table if not exists package_extension_requests (
  id text primary key,
  status text not null default 'SUBMITTED',   -- SUBMITTED | APPROVED | REJECTED
  student_id text not null,
  extra_months int not null,
  new_monthly_fee numeric(10,2),
  new_fee_plan_name text,
  reason text not null,
  branch text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  client_intent_key text
);
create unique index if not exists package_extension_requests_intent_unique
  on package_extension_requests (client_intent_key) where client_intent_key is not null;

-- Brief §2.2 / §6.13: a payment-profile is only the label and masked hint an
-- invoice shows for how a school pays — never raw bank numbers (brief §5.5).
-- One active profile per entity; a change goes through the founder.
create table if not exists entity_payment_profiles (
  entity_id text primary key,
  label text not null,
  masked_hint text,
  updated_by text,
  updated_at timestamptz not null default now()
);

create table if not exists payment_profile_change_requests (
  id text primary key,
  status text not null default 'SUBMITTED',   -- SUBMITTED | APPROVED | REJECTED
  entity_id text not null,
  requested_label text not null,
  requested_masked_hint text,
  reason text not null,
  branch text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  client_intent_key text
);
create unique index if not exists payment_profile_change_requests_intent_unique
  on payment_profile_change_requests (client_intent_key) where client_intent_key is not null;

do $$
declare t text;
begin
  foreach t in array array['package_extension_requests','entity_payment_profiles','payment_profile_change_requests'] loop
    execute format('drop trigger if exists sheet_mirror on %I', t);
    execute format(
      'create trigger sheet_mirror after insert or update or delete on %I for each row execute function sheet_outbox_enqueue()',
      t);
  end loop;
end $$;

-- Brief §P6.6/§6.8: the operator RECORDS a closure as PROPOSED; only the
-- founder AUTHORISES it. A closure marks the classes in range not_required
-- on scheduled_sessions (already read by unansweredClasses/todaysClasses) —
-- it never deletes the expected class.
create table if not exists closure_calendar (
  id text primary key,
  scope text not null,                        -- ACADEMY | BRANCH
  branch text,
  from_date date not null,
  to_date date not null,
  reason text not null,
  state text not null default 'PROPOSED',     -- PROPOSED | AUTHORISED | REVOKED
  backdated boolean not null default false,
  notes text,
  recorded_by text,
  recorded_at timestamptz not null default now(),
  authorised_by text,
  authorised_at timestamptz,
  decision_note text,
  client_intent_key text
);
create unique index if not exists closure_calendar_intent_unique
  on closure_calendar (client_intent_key) where client_intent_key is not null;

do $$
begin
  execute 'drop trigger if exists sheet_mirror on closure_calendar';
  execute 'create trigger sheet_mirror after insert or update or delete on closure_calendar for each row execute function sheet_outbox_enqueue()';
end $$;

-- Brief §14.1 (Ruling C.5): a class answered once cannot be re-answered
-- directly — mirrors receipt_corrections (pattern C) for scheduled_sessions.
-- Approval re-opens the specific row so staff answer it again through the
-- ordinary endpoint; the founder never sets the outcome directly here.
create table if not exists class_outcome_corrections (
  id text primary key,
  event_id text not null,
  reason text not null,
  status text not null default 'SUBMITTED',   -- SUBMITTED | APPROVED | REJECTED
  branch text,
  prior_outcome text,
  prior_evidence_class text,
  requested_by text,
  requested_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  client_intent_key text
);
create unique index if not exists class_outcome_corrections_intent_unique
  on class_outcome_corrections (client_intent_key) where client_intent_key is not null;

do $$
begin
  execute 'drop trigger if exists sheet_mirror on class_outcome_corrections';
  execute 'create trigger sheet_mirror after insert or update or delete on class_outcome_corrections for each row execute function sheet_outbox_enqueue()';
end $$;

-- Brief §2.2: a late-fee waiver is a staff proposal, the founder decides.
-- submitted_by/decided_by always come from the authenticated session, never
-- a client-supplied field — every historical waiver in the old system had a
-- blank actor because that rule was never enforced there.
create table if not exists late_fee_waiver_requests (
  id text primary key,
  status text not null default 'SUBMITTED',   -- SUBMITTED | APPROVED | REJECTED
  student_id text not null,
  waived_amount numeric(10,2),
  new_next_due_date date,
  reason text not null,
  branch text,
  submitted_by text not null,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  client_intent_key text
);
create unique index if not exists late_fee_waiver_requests_intent_unique
  on late_fee_waiver_requests (client_intent_key) where client_intent_key is not null;

do $$
begin
  execute 'drop trigger if exists sheet_mirror on late_fee_waiver_requests';
  execute 'create trigger sheet_mirror after insert or update or delete on late_fee_waiver_requests for each row execute function sheet_outbox_enqueue()';
end $$;

-- Brief §6.1/§2.6: an instalment plan is a staff proposal; the founder
-- creates the real plan + schedule on approval. A payment against a plan
-- always needs a founder decision (one of the 14 routine-lane exclusions) —
-- moot here since this app has no routine auto-approval lane at all yet,
-- every payment draft already requires an explicit founder approve.
create table if not exists instalment_plan_drafts (
  id text primary key,
  status text not null default 'SUBMITTED',   -- SUBMITTED | APPROVED | REJECTED
  student_id text not null,
  student_name text,
  total_amount numeric(10,2) not null,
  instalment_count int not null,
  first_due_date date not null,
  cadence_days int not null default 30,
  notes text,
  branch text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  plan_id text,
  client_intent_key text
);
create unique index if not exists instalment_plan_drafts_intent_unique
  on instalment_plan_drafts (client_intent_key) where client_intent_key is not null;

create table if not exists instalment_plans (
  id text primary key,
  student_id text not null,
  total_amount numeric(10,2) not null,
  instalment_count int not null,
  status text not null default 'ACTIVE',      -- ACTIVE | COMPLETED | CANCELLED
  branch text,
  created_by text,
  created_at timestamptz not null default now()
);

-- Its own schedule, separate from the student's regular monthly due-date
-- cycle (brief §1.3: two truths, never merged) — an instalment payment never
-- calls advanceStudentCycle.
create table if not exists instalment_plan_items (
  id text primary key,
  plan_id text not null references instalment_plans(id),
  seq_no int not null,
  amount numeric(10,2) not null,
  due_date date not null,
  status text not null default 'PENDING',     -- PENDING | PAID
  paid_receipt_no text
);
create index if not exists idx_instalment_plan_items_plan on instalment_plan_items (plan_id);

alter table payment_drafts add column if not exists instalment_plan_id text;
alter table payment_drafts add column if not exists instalment_item_id text;

do $$
declare t text;
begin
  foreach t in array array['instalment_plan_drafts','instalment_plans','instalment_plan_items'] loop
    execute format('drop trigger if exists sheet_mirror on %I', t);
    execute format(
      'create trigger sheet_mirror after insert or update or delete on %I for each row execute function sheet_outbox_enqueue()',
      t);
  end loop;
end $$;

-- Brief §P10: a one-time admission-terms token, minted on demand for an
-- operational student only. The parent opens it with no login. If they
-- cannot use the link, staff request a MANUAL ACCEPTANCE — an approval item,
-- not a tick box.
create table if not exists terms_acceptance_tokens (
  token text primary key,
  student_id text not null,
  issued_by text,
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status text not null default 'OPEN',        -- OPEN | ACCEPTED | EXPIRED
  accepted_at timestamptz,
  accepted_note text
);
create index if not exists idx_terms_tokens_student on terms_acceptance_tokens (student_id);

create table if not exists manual_terms_acceptance_requests (
  id text primary key,
  status text not null default 'SUBMITTED',   -- SUBMITTED | APPROVED | REJECTED
  student_id text not null,
  reason text not null,
  branch text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  client_intent_key text
);
create unique index if not exists manual_terms_acceptance_requests_intent_unique
  on manual_terms_acceptance_requests (client_intent_key) where client_intent_key is not null;

do $$
declare t text;
begin
  foreach t in array array['terms_acceptance_tokens','manual_terms_acceptance_requests'] loop
    execute format('drop trigger if exists sheet_mirror on %I', t);
    execute format(
      'create trigger sheet_mirror after insert or update or delete on %I for each row execute function sheet_outbox_enqueue()',
      t);
  end loop;
end $$;

-- One row per contact attempt/transition on an inquiry — the follow-up
-- history the flat `inquiries.notes`/`last_contacted_at` columns never kept.
-- `final_status` on an inquiry is DERIVED from `status` (CONVERTED/DROPPED/
-- else), never stored, so it can never drift from the workflow status.
create table if not exists inquiry_followups (
  id text primary key,
  inquiry_id text not null,
  action text not null,
  description text,
  resulting_status text not null,
  next_contact_date date,
  created_by text,
  created_at timestamptz not null default now()
);
create index if not exists idx_inquiry_followups_inquiry on inquiry_followups (inquiry_id, created_at);

do $$
begin
  execute 'drop trigger if exists sheet_mirror on inquiry_followups';
  execute 'create trigger sheet_mirror after insert or update or delete on inquiry_followups for each row execute function sheet_outbox_enqueue()';
end $$;

-- ============ SELF-SERVICE TOKEN REGISTRATION/RESET (email + OTP) ============
-- OTP proves control of an inbox, not authorization. This allow-list is the
-- authorization step: only an email listed here (or the fixed founder email
-- checked in code) may register a device_tokens row for itself. Branches
-- null falls back to RPC_STAFF_BRANCHES, exactly like the founder already
-- does by hand via db/mint_device_token.mjs.
create table if not exists authorized_emails (
  email text primary key,
  role text not null default 'OPS_USER',
  branches text,
  added_by text,
  added_at timestamptz not null default now(),
  note text
);

-- One row per requested code. 10-minute expiry, 5 max attempts and a
-- 60-second resend cooldown are enforced in code, not here.
create table if not exists email_otps (
  id text primary key,
  email text not null,
  role text not null,
  purpose text not null,              -- REGISTER | RESET
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_email_otps_lookup on email_otps (email, purpose, created_at desc);

-- Neither table is mirrored to the founder's spreadsheet: authorized_emails
-- is access-control config and email_otps holds one-time secrets, same
-- reasoning as device_tokens being excluded (schema.sql: "Secrets... never
-- are").

-- Two paths to DORMANT: the existing 3-missed-calls path (NO_ANSWER), and a
-- new 30-day-without-conversion timeout path. Only NO_ANSWER dormants are
-- eligible for the 90-day "call these today" recall (brief P1.2) — a
-- TIMEOUT dormant never resurfaces automatically.
alter table inquiries add column if not exists dormant_reason text;

-- Set only when this inquiry was auto-created because a student's status
-- became LEFT (a "win-back" lead) — the reverse pointer to the existing
-- forward one, inquiries.converted_student_id.
alter table inquiries add column if not exists former_student_id text;

-- When the student's status last changed — lets a "paused this long" reminder
-- be computed lazily (on dashboard open) instead of needing anyone to track it.
alter table students_acad add column if not exists status_changed_at timestamptz;

-- Adding a teacher outright is founder-only (api_addTeacher); this is the
-- staff-facing proposal that flows into the same approve/reject pattern as
-- every other staff request in this app.
create table if not exists teacher_add_requests (
  id text primary key,
  status text not null default 'SUBMITTED',   -- SUBMITTED | APPROVED | REJECTED
  teacher_name text not null,
  phone text,
  primary_role text,
  branch text,
  submitted_by text,
  submitted_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  teacher_id text,
  client_intent_key text
);
create unique index if not exists teacher_add_requests_intent_unique
  on teacher_add_requests (client_intent_key) where client_intent_key is not null;

-- The teacher chosen when a student is added/edited. Distinct from the
-- attendance-derived "teacher" shown on the profile once real classes have
-- happened (that one stays authoritative for payroll — never overwritten by
-- this) — this is only the fallback shown before any attendance exists, and
-- the default staff pick when scheduling this student's first class.
alter table students_acad add column if not exists assigned_teacher_id text;
alter table student_drafts add column if not exists teacher_id text;
