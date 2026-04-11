-- Phase H.1 — Inspiration Library
-- Stores scraped + seeded LinkedIn posts for browsing, filtering, and remixing.

create table if not exists inspiration_posts (
  id uuid primary key default gen_random_uuid(),
  linkedin_post_url text,
  author_name text not null,
  author_headline text,
  author_handle text,
  author_avatar_url text,
  author_followers integer,
  content text not null,
  format text,
  topic_pillar text,
  engagement_tier text,
  creator_archetype text,
  hook_score integer check (hook_score between 1 and 10),
  likes integer default 0,
  comments integer default 0,
  reposts integer default 0,
  posted_at timestamptz,
  scraped_at timestamptz default now(),
  is_seed boolean default false,
  is_trending boolean default false,
  trending_week text,
  embedding vector(768),
  created_at timestamptz default now()
);

create index if not exists idx_inspiration_format on inspiration_posts(format);
create index if not exists idx_inspiration_topic on inspiration_posts(topic_pillar);
create index if not exists idx_inspiration_tier on inspiration_posts(engagement_tier);
create index if not exists idx_inspiration_trending on inspiration_posts(is_trending);

-- Semantic search RPC
create or replace function match_inspiration_posts(
  query_embedding vector(768),
  match_count int default 10,
  filter_format text default null,
  filter_topic text default null,
  filter_tier text default null
)
returns table (
  id uuid,
  content text,
  author_name text,
  author_headline text,
  author_avatar_url text,
  format text,
  topic_pillar text,
  engagement_tier text,
  likes integer,
  comments integer,
  hook_score integer,
  similarity float
)
language plpgsql as $$
begin
  return query
  select
    ip.id, ip.content, ip.author_name, ip.author_headline,
    ip.author_avatar_url, ip.format, ip.topic_pillar,
    ip.engagement_tier, ip.likes, ip.comments, ip.hook_score,
    1 - (ip.embedding <=> query_embedding)::float as similarity
  from inspiration_posts ip
  where ip.embedding is not null
    and (filter_format is null or ip.format = filter_format)
    and (filter_topic is null or ip.topic_pillar = filter_topic)
    and (filter_tier is null or ip.engagement_tier = filter_tier)
  order by ip.embedding <=> query_embedding
  limit match_count;
end;
$$;
