-- ═══════════════════════════════════════════════
-- NIVI — Complete Database Migration
-- Run this in Supabase SQL Editor (supabase.com → SQL)
-- ═══════════════════════════════════════════════

-- 1. USERS
create table if not exists users (
  id text primary key,
  email text unique not null,
  name text not null,
  whatsapp_number text unique,
  whatsapp_opt_in_code text unique default substr(md5(random()::text),1,8),
  unipile_account_id text,
  x_account_id text,
  plan text default 'starter' check (plan in ('starter','pro','agency')),
  posting_time time default '09:00',
  engagement_time time default '10:00',
  timezone text default 'Asia/Kolkata',
  streak_count integer default 0,
  onboarding_step integer default 0,
  onboarding_complete boolean default false,
  stripe_customer_id text,
  brand_kit jsonb default '{}',
  pending_image_url text,
  niche text,
  created_at timestamptz default now()
);

-- 2. CONTEXT FILES
create table if not exists context_files (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  writing_style text,
  hook_mechanics text,
  sentence_styling text,
  post_system text,
  sample_posts text,
  version integer default 1,
  updated_at timestamptz default now()
);

alter table context_files add constraint context_files_user_id_key unique (user_id);

-- 3. KNOWLEDGE CHUNKS
create table if not exists knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  source_type text check (source_type in ('transcript','article','post','note','video')),
  source_title text,
  raw_content text,
  extracted_insights jsonb,
  embedding_id text,
  created_at timestamptz default now()
);

-- 4. USER MEMORY
create table if not exists user_memory (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  fact text not null,
  category text check (category in ('preference','fact','goal','pattern','avoid')),
  confidence float default 0.8,
  source text,
  created_at timestamptz default now()
);

-- 5. POSTS
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  content text not null,
  hook_type text,
  content_pillar integer check (content_pillar between 1 and 5),
  status text default 'draft' check (status in ('draft','scheduled','published','skipped')),
  scheduled_at timestamptz,
  published_at timestamptz,
  linkedin_post_id text,
  image_url text,
  edit_count integer default 0,
  created_at timestamptz default now()
);

-- 6. POST ANALYTICS
create table if not exists post_analytics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade,
  impressions integer default 0,
  likes integer default 0,
  comments integer default 0,
  shares integer default 0,
  engagement_rate float default 0,
  synced_at timestamptz default now()
);

alter table post_analytics add constraint post_analytics_post_id_key unique (post_id);

-- 7. CONVERSATIONS
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  role text check (role in ('user','assistant')),
  content text not null,
  message_type text default 'text',
  created_at timestamptz default now()
);

-- 8. SCHEDULED POSTS
create table if not exists scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references posts on delete cascade,
  user_id text references users on delete cascade,
  scheduled_at timestamptz not null,
  status text default 'pending' check (status in ('pending','processing','done','failed')),
  retry_count integer default 0,
  created_at timestamptz default now()
);

-- 9. COMMENT OPPORTUNITIES
create table if not exists comment_opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  linkedin_post_id text not null,
  author_name text,
  author_followers integer,
  post_preview text,
  drafted_comment text,
  status text default 'pending' check (status in ('pending','approved','posted','skipped')),
  created_at timestamptz default now()
);

-- 10. ONBOARDING ANSWERS
create table if not exists onboarding_answers (
  id uuid primary key default gen_random_uuid(),
  user_id text references users on delete cascade,
  step integer not null,
  question_key text not null,
  answer text,
  created_at timestamptz default now()
);

-- ═══════════════════════════════════════════════
-- PERFORMANCE INDEXES
-- ═══════════════════════════════════════════════

create index if not exists idx_posts_user_status on posts(user_id, status);
create index if not exists idx_posts_user_published on posts(user_id, published_at desc);
create index if not exists idx_posts_linkedin_id on posts(linkedin_post_id) where linkedin_post_id is not null;
create index if not exists idx_post_analytics_post on post_analytics(post_id);
create index if not exists idx_conversations_user_date on conversations(user_id, created_at desc);
create index if not exists idx_user_memory_user on user_memory(user_id);
create index if not exists idx_comment_opps_user_status on comment_opportunities(user_id, status);
create index if not exists idx_scheduled_posts_due on scheduled_posts(scheduled_at, status) where status = 'pending';
create index if not exists idx_users_whatsapp on users(whatsapp_number) where whatsapp_number is not null;
create index if not exists idx_onboarding_answers_user on onboarding_answers(user_id, step);

-- ═══════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════

alter table users enable row level security;
alter table context_files enable row level security;
alter table knowledge_chunks enable row level security;
alter table user_memory enable row level security;
alter table posts enable row level security;
alter table post_analytics enable row level security;
alter table conversations enable row level security;
alter table scheduled_posts enable row level security;
alter table comment_opportunities enable row level security;
alter table onboarding_answers enable row level security;

-- RLS policies — users see only their own data
-- (Service role key bypasses all RLS automatically)

create policy "users_own_data" on users for all using (auth.uid()::text = id);
create policy "context_files_own" on context_files for all using (auth.uid()::text = user_id);
create policy "knowledge_own" on knowledge_chunks for all using (auth.uid()::text = user_id);
create policy "memory_own" on user_memory for all using (auth.uid()::text = user_id);
create policy "posts_own" on posts for all using (auth.uid()::text = user_id);
create policy "analytics_via_posts" on post_analytics for all using (
  exists (select 1 from posts where posts.id = post_analytics.post_id and auth.uid()::text = posts.user_id)
);
create policy "conversations_own" on conversations for all using (auth.uid()::text = user_id);
create policy "scheduled_own" on scheduled_posts for all using (auth.uid()::text = user_id);
create policy "comment_opps_own" on comment_opportunities for all using (auth.uid()::text = user_id);
create policy "onboarding_answers_own" on onboarding_answers for all using (auth.uid()::text = user_id);

-- ═══════════════════════════════════════════════
-- STORAGE BUCKET FOR POST IMAGES
-- ═══════════════════════════════════════════════

insert into storage.buckets (id, name, public) values ('post-images', 'post-images', true) on conflict do nothing;
