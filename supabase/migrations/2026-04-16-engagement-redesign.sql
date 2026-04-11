-- Phase F.1 — Engagement page redesign
-- Enriches comment_opportunities with relevance/author metadata
-- and adds engagement_targets for the Targets tab.

-- 1. Enrich comment_opportunities
alter table comment_opportunities
  add column if not exists relevance_score numeric(3, 2),
  add column if not exists matched_pillar text,
  add column if not exists author_headline text,
  add column if not exists author_avatar_url text,
  add column if not exists linkedin_post_url text,
  add column if not exists author_handle text,
  add column if not exists reply_received boolean default false,
  add column if not exists posted_at timestamptz;

-- 2. Engagement targets (whitelist/blacklist of authors the user wants to prioritize)
create table if not exists engagement_targets (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  linkedin_url text not null,
  author_handle text,
  author_name text,
  author_headline text,
  avatar_url text,
  mode text default 'whitelist' check (mode in ('whitelist', 'blacklist')),
  note text,
  created_at timestamptz default now()
);

create index if not exists idx_engagement_targets_user
  on engagement_targets(user_id);
create index if not exists idx_engagement_targets_user_handle
  on engagement_targets(user_id, author_handle);
