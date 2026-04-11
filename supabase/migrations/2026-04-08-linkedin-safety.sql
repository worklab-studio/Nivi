-- ═══════════════════════════════════════════════
-- NIVI — LinkedIn ban-risk Tier 1 (2026-04-08)
-- Paste in Supabase SQL editor.
-- ═══════════════════════════════════════════════
--
-- Adds users.linkedin_connected_at so the rate limiter can apply
-- stricter caps to accounts connected within the last 14 days
-- (the most ban-vulnerable cohort).
--
-- Backfill: existing users with a unipile_account_id get backdated
-- to their signup date. They've been connected long enough to be
-- "warm" by definition, so this is the safe default.

alter table users
  add column if not exists linkedin_connected_at timestamptz;

update users
  set linkedin_connected_at = created_at
  where linkedin_connected_at is null
    and unipile_account_id is not null;

-- For traceability + admin queries
create index if not exists idx_users_linkedin_connected_at
  on users(linkedin_connected_at)
  where linkedin_connected_at is not null;
