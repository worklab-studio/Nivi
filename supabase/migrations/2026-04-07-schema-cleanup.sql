-- ═══════════════════════════════════════════════
-- NIVI — Schema cleanup (2026-04-07)
-- Paste in Supabase SQL editor. Safe to re-run.
-- ═══════════════════════════════════════════════
--
-- 1. Collapse users.plan constraint to single-plan values (active|inactive),
--    migrating any legacy starter/pro/agency rows.
-- 2. Drop the legacy user_memory.embedding_id column — Pinecone holdover,
--    nothing reads it anymore (the real embedding lives in user_memory.embedding
--    vector(768) from the 2026-04-07-pgvector migration).
-- 3. Fold reminders.sql into the main schema so setup is one paste.

-- ─── 1. users.plan collapse ───────────────────────────────────
-- Migrate existing rows first so the new CHECK constraint doesn't fail.
update users
  set plan = case
    when plan in ('pro', 'agency') then 'active'
    when plan = 'starter' then 'inactive'
    else plan
  end
  where plan in ('starter', 'pro', 'agency');

-- Drop the old CHECK constraint (its auto-generated name can vary; try both forms).
alter table users drop constraint if exists users_plan_check;
alter table users drop constraint if exists users_plan_check1;

-- Add the new constraint: single-plan world, just active or inactive.
alter table users
  add constraint users_plan_check
  check (plan in ('active', 'inactive'));

alter table users
  alter column plan set default 'inactive';

-- ─── 2. Drop legacy user_memory.embedding_id ─────────────────
drop index if exists idx_user_memory_embedding;
alter table user_memory drop column if exists embedding_id;

-- ─── 3. Fold reminders into main schema ──────────────────────
-- (originally in supabase/reminders.sql; idempotent so safe if already applied.)
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  reminder_text text not null,
  remind_at timestamptz not null,
  status text default 'pending' check (status in ('pending','sent','cancelled')),
  created_at timestamptz default now()
);
create index if not exists idx_reminders_pending
  on reminders(remind_at, status)
  where status = 'pending';

-- Enable RLS so it matches the rest of the schema.
alter table reminders enable row level security;
drop policy if exists "reminders_own" on reminders;
create policy "reminders_own"
  on reminders for all
  using (auth.uid()::text = user_id);
