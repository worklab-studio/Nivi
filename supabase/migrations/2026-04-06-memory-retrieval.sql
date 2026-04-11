-- ═══════════════════════════════════════════════
-- NIVI — Memory retrieval migration (Tier 1 Step 3)
-- Run this in the Supabase SQL editor.
-- ═══════════════════════════════════════════════
--
-- Adds columns to user_memory that back Pinecone-based retrieval:
--   • embedding_id   — Pinecone vector id (matches Supabase row id when set)
--   • last_used_at   — updated each time a memory is injected into a prompt
--   • use_count      — total injection count, for later relevance weighting
--
-- These are nullable / default-safe so existing rows keep working
-- without backfill. The backfill script at
-- src/lib/queue/scripts/backfillMemoryEmbeddings.ts embeds any rows
-- where embedding_id IS NULL.

alter table user_memory add column if not exists embedding_id text;
alter table user_memory add column if not exists last_used_at timestamptz;
alter table user_memory add column if not exists use_count integer default 0;

create index if not exists idx_user_memory_embedding
  on user_memory(embedding_id)
  where embedding_id is not null;

create index if not exists idx_user_memory_category
  on user_memory(user_id, category);

-- Tier 1 Step 6 — conversation history summary cache.
-- Used by handleConversation to compress turns older than the last ~8 into
-- a single paragraph, keeping the prompt small for chronic users.
alter table users add column if not exists history_summary text;
alter table users add column if not exists history_summary_at timestamptz;
