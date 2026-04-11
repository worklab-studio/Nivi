-- ═══════════════════════════════════════════════
-- NIVI — Tier 2 prep migration (2026-04-06)
-- Run in Supabase SQL editor AFTER 2026-04-06-memory-retrieval.sql
-- ═══════════════════════════════════════════════
--
-- Adds instrumentation + prep columns so Tier 2 can ship later with real
-- data instead of guesses. Zero behavior change on its own.
--
--   1. nivi_routing_decisions — logs casual-short-circuit vs sonnet decisions
--      in the WhatsApp tool loop, for tuning isCasualMessage() heuristics.
--   2. nivi_llm_usage          — logs every LLM call's usage payload
--      (input/output/cache tokens + role) for cost attribution.
--   3. post_memory_links       — snapshots which memories were in-context
--      when a post was generated/published. The ONE signal that unlocks
--      performance-weighted memory retrieval in Tier 2. Must start
--      collecting now, can't be backfilled later.
--   4. context_files versioning — prep columns so voice profile evolution
--      in Tier 2 has a rollback path.

-- 1. Routing decisions log
create table if not exists nivi_routing_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  decision text not null check (decision in ('casual-short-circuit','sonnet-with-tools','casual-fell-through')),
  user_message_length integer,
  created_at timestamptz default now()
);
create index if not exists idx_routing_decisions_user_date
  on nivi_routing_decisions(user_id, created_at desc);

alter table nivi_routing_decisions enable row level security;
create policy "routing_decisions_own"
  on nivi_routing_decisions for all
  using (auth.uid()::text = user_id);

-- 2. LLM usage log
create table if not exists nivi_llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  role text,                              -- the CallRole passed to pickModel()
  model text,                             -- actual model string called
  input_tokens integer default 0,
  output_tokens integer default 0,
  cache_creation_input_tokens integer default 0,
  cache_read_input_tokens integer default 0,
  created_at timestamptz default now()
);
create index if not exists idx_llm_usage_user_date
  on nivi_llm_usage(user_id, created_at desc);
create index if not exists idx_llm_usage_role_date
  on nivi_llm_usage(role, created_at desc);

alter table nivi_llm_usage enable row level security;
create policy "llm_usage_own"
  on nivi_llm_usage for all
  using (auth.uid()::text = user_id);

-- 3. Post → memory links
create table if not exists post_memory_links (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade,
  memory_id uuid references user_memory on delete cascade,
  created_at timestamptz default now()
);
create unique index if not exists idx_post_memory_links_unique
  on post_memory_links(post_id, memory_id);
create index if not exists idx_post_memory_links_post
  on post_memory_links(post_id);
create index if not exists idx_post_memory_links_memory
  on post_memory_links(memory_id);

alter table post_memory_links enable row level security;
create policy "post_memory_links_via_post"
  on post_memory_links for all
  using (
    exists (
      select 1 from posts
      where posts.id = post_memory_links.post_id
        and auth.uid()::text = posts.user_id
    )
  );

-- 4. context_files versioning prep
alter table context_files add column if not exists previous_version jsonb;
alter table context_files add column if not exists last_evolved_at timestamptz;
-- `version` already exists with default 1 — we'll increment it on each
-- voice evolution and snapshot the old row into previous_version.

-- ═══════════════════════════════════════════════
-- Decay instrumentation (dry-run for now)
-- ═══════════════════════════════════════════════
-- Tier 2 will promote this column to drive an actual archival cron.
-- Until then, the dry-run script at
-- src/lib/queue/scripts/memoryDecayDryRun.ts computes what WOULD be
-- archived and writes the proposal here. Zero destructive actions.
create table if not exists nivi_memory_decay_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  memory_id uuid references user_memory on delete cascade,
  current_confidence float,
  proposed_confidence float,
  reason text,
  run_at timestamptz default now()
);
create index if not exists idx_memory_decay_proposals_run
  on nivi_memory_decay_proposals(run_at desc);
