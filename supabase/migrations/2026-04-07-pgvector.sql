-- ═══════════════════════════════════════════════
-- NIVI — pgvector migration (2026-04-07)
-- Swap Pinecone + OpenAI embeddings for Supabase pgvector + Gemini
-- Run in the Supabase SQL editor.
-- ═══════════════════════════════════════════════
--
-- This replaces the Pinecone-backed memory retrieval from Tier 1 Step 3
-- with native Supabase pgvector. After this migration runs:
--   • user_memory and knowledge_chunks both have an `embedding vector(768)`
--     column (nullable — NULL means not yet embedded, backfill fills it).
--   • HNSW indexes make cosine-similarity top-K queries fast at scale.
--   • Two RPC functions (match_user_memories, match_knowledge_chunks)
--     accept a query vector + user id + count and return top-K rows.
--
-- Dimension = 768 to match Gemini text-embedding-004.
-- Safe to re-run (everything is if-not-exists / or-replace).

create extension if not exists vector;

alter table user_memory
  add column if not exists embedding vector(768);

alter table knowledge_chunks
  add column if not exists embedding vector(768);

-- HNSW indexes. vector_cosine_ops is the operator class for the `<=>`
-- cosine-distance operator we use in the ORDER BY below.
create index if not exists idx_user_memory_embedding_hnsw
  on user_memory
  using hnsw (embedding vector_cosine_ops);

create index if not exists idx_knowledge_chunks_embedding_hnsw
  on knowledge_chunks
  using hnsw (embedding vector_cosine_ops);

-- ─── Top-K user_memory lookup ──────────────────────────────────
create or replace function match_user_memories(
  query_embedding vector(768),
  match_user_id text,
  match_count int default 8
)
returns table (
  id uuid,
  fact text,
  category text,
  similarity float
)
language sql
stable
as $$
  select
    m.id,
    m.fact,
    m.category,
    1 - (m.embedding <=> query_embedding) as similarity
  from user_memory m
  where m.user_id = match_user_id
    and m.embedding is not null
  order by m.embedding <=> query_embedding
  limit match_count;
$$;

-- ─── Top-K knowledge_chunks lookup ─────────────────────────────
create or replace function match_knowledge_chunks(
  query_embedding vector(768),
  match_user_id text,
  match_count int default 5
)
returns table (
  id uuid,
  text text,
  similarity float
)
language sql
stable
as $$
  select
    k.id,
    k.raw_content as text,
    1 - (k.embedding <=> query_embedding) as similarity
  from knowledge_chunks k
  where k.user_id = match_user_id
    and k.embedding is not null
  order by k.embedding <=> query_embedding
  limit match_count;
$$;
