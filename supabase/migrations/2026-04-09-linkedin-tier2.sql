-- ═══════════════════════════════════════════════
-- NIVI — LinkedIn ban-risk Tier 2 (2026-04-09)
-- Paste in Supabase SQL editor.
-- ═══════════════════════════════════════════════
--
-- Adds:
--   • account health monitoring fields
--   • aggressiveness modes (safe / standard / power)
--   • per-API opt-ins for DMs + connection requests (off by default)
--   • automation consent flag + timestamp
--   • health events log (for debugging + admin audit)
--
-- Backfill: existing connected users get implicit consent + standard mode
-- (they've already been operating at Tier 1 caps without issue, no need
-- to dump them to safe mode).

-- ─── Account health ──────────────────────────────────
alter table users
  add column if not exists linkedin_health text default 'ok'
    check (linkedin_health in ('ok','credentials','restricted','stopped','unknown')),
  add column if not exists linkedin_health_checked_at timestamptz,
  add column if not exists linkedin_health_message text;

-- ─── Aggressiveness mode ─────────────────────────────
alter table users
  add column if not exists linkedin_mode text default 'safe'
    check (linkedin_mode in ('safe','standard','power')),
  add column if not exists linkedin_mode_promoted_at timestamptz,
  add column if not exists linkedin_mode_locked boolean default false;

-- ─── Per-API opt-ins (off by default — highest ban risk) ─────
alter table users
  add column if not exists linkedin_dms_enabled boolean default false,
  add column if not exists linkedin_connections_enabled boolean default false;

-- ─── Consent ─────────────────────────────────────────
alter table users
  add column if not exists linkedin_automation_consent boolean default false,
  add column if not exists linkedin_automation_consent_at timestamptz;

-- ─── Backfill existing connected users ───────────────
update users
  set
    linkedin_automation_consent = true,
    linkedin_automation_consent_at = created_at,
    linkedin_mode = 'standard'
  where unipile_account_id is not null
    and linkedin_automation_consent is not true;

-- ─── Health events log ───────────────────────────────
create table if not exists nivi_linkedin_health_events (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  prev_status text,
  new_status text,
  message text,
  unipile_raw jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_health_events_user_date
  on nivi_linkedin_health_events(user_id, created_at desc);

alter table nivi_linkedin_health_events enable row level security;
drop policy if exists "health_events_own" on nivi_linkedin_health_events;
create policy "health_events_own"
  on nivi_linkedin_health_events for all
  using (auth.uid()::text = user_id);
