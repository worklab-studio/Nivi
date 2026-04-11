import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/config'

/**
 * Memory + knowledge vector store.
 *
 * Backed by **Supabase pgvector** for storage and **Gemini
 * `gemini-embedding-001`** (at 768 dim) for embeddings. No Pinecone,
 * no OpenAI.
 *
 * Call sites: extractMemory.ts, buildSystemPrompt.ts, conversation.ts,
 * knowledge/add, knowledge/delete.
 *
 * Backing schema (see supabase/migrations/2026-04-07-pgvector.sql):
 *   • user_memory.embedding       vector(768)
 *   • knowledge_chunks.embedding  vector(768)
 *   • match_user_memories(query_embedding, match_user_id, match_count)
 *   • match_knowledge_chunks(query_embedding, match_user_id, match_count)
 */

// gemini-embedding-001 is the current embed model on v1beta. It defaults
// to 3072 dimensions, so we explicitly request 768 via outputDimensionality
// to match our pgvector(768) column.
const GEMINI_EMBED_MODEL = 'gemini-embedding-001'
const GEMINI_EMBED_DIM = 768

// ──────────────────────────────────────────────────────────────
// Lazily-constructed service-role Supabase client
// ──────────────────────────────────────────────────────────────

let _supa: SupabaseClient | null = null
function getSupa(): SupabaseClient {
  if (!_supa) {
    const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
    const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    _supa = createClient(url, key)
  }
  return _supa
}

// ──────────────────────────────────────────────────────────────
// Gemini embeddings
// ──────────────────────────────────────────────────────────────

/**
 * Embed text with Gemini `text-embedding-004`.
 * Returns a 768-dim float array, or null on failure (caller decides what
 * to do — write paths drop the embedding, read paths return empty).
 */
async function embed(text: string): Promise<number[] | null> {
  const apiKey = getEnv('GEMINI_API_KEY')
  if (!apiKey) {
    console.error('[pgvector] GEMINI_API_KEY missing — cannot embed')
    return null
  }

  const trimmed = text.slice(0, 8000)
  if (!trimmed.trim()) return null

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: { parts: [{ text: trimmed }] },
          outputDimensionality: GEMINI_EMBED_DIM,
        }),
      }
    )

    const data = await res.json()
    if (data.error) {
      console.error('[pgvector] Gemini embed error:', data.error.message)
      return null
    }

    const values: number[] | undefined = data?.embedding?.values
    if (!Array.isArray(values) || values.length !== GEMINI_EMBED_DIM) {
      console.error(
        `[pgvector] Unexpected embed shape: got ${values?.length ?? 'undefined'} dims, expected ${GEMINI_EMBED_DIM}`
      )
      return null
    }
    return values
  } catch (err) {
    console.error('[pgvector] Gemini embed failed:', err)
    return null
  }
}

// ──────────────────────────────────────────────────────────────
// Knowledge chunks
// ──────────────────────────────────────────────────────────────

/**
 * Embed and persist a knowledge chunk. The `knowledge_chunks` row must
 * already exist in Supabase (this function only updates the embedding
 * column). `chunkId` is the `knowledge_chunks.id` uuid.
 */
export async function storeKnowledgeChunk(
  userId: string,
  chunkId: string,
  text: string
): Promise<void> {
  try {
    const vector = await embed(text)
    if (!vector) return

    const supa = getSupa()
    const { error } = await supa
      .from('knowledge_chunks')
      .update({ embedding: vector })
      .eq('id', chunkId)
    if (error) console.error('[pgvector] storeKnowledgeChunk update error:', error.message)
  } catch (err) {
    console.error('[pgvector] storeKnowledgeChunk failed:', err)
  }
}

/**
 * Return the text of the top-K knowledge chunks for a user, ranked by
 * cosine similarity to `query`.
 */
export async function queryRelevantKnowledge(
  userId: string,
  query: string,
  topK = 5
): Promise<string[]> {
  try {
    const vector = await embed(query)
    if (!vector) return []

    const supa = getSupa()
    const { data, error } = await supa.rpc('match_knowledge_chunks', {
      query_embedding: vector,
      match_user_id: userId,
      match_count: topK,
    })
    if (error) {
      console.error('[pgvector] match_knowledge_chunks error:', error.message)
      return []
    }
    return ((data ?? []) as Array<{ text: string }>)
      .map((r) => r.text)
      .filter((t) => t && t.length > 0)
  } catch (err) {
    console.error('[pgvector] queryRelevantKnowledge failed:', err)
    return []
  }
}

/**
 * No-op: the Supabase row's ON DELETE CASCADE tears down the embedding
 * column along with the row. Kept as a stub for API parity with callers
 * that still invoke it.
 */
export async function deleteKnowledgeChunk(_chunkId: string): Promise<void> {
  // intentional no-op
}

// ──────────────────────────────────────────────────────────────
// User memory
// ──────────────────────────────────────────────────────────────

export interface StoredMemory {
  id: string
  fact: string
  category: string
  score?: number
}

/**
 * Embed a user memory and persist it onto the existing `user_memory` row.
 * Returns the memoryId on success, or an empty string on failure so the
 * caller can tell whether the embedding actually landed.
 */
export async function storeUserMemory(
  userId: string,
  memoryId: string,
  fact: string,
  _category: string
): Promise<string> {
  try {
    const vector = await embed(fact)
    if (!vector) return ''

    const supa = getSupa()
    const { error } = await supa
      .from('user_memory')
      .update({ embedding: vector })
      .eq('id', memoryId)
    if (error) {
      console.error('[pgvector] storeUserMemory update error:', error.message)
      return ''
    }
    return memoryId
  } catch (err) {
    console.error('[pgvector] storeUserMemory failed:', err)
    return ''
  }
}

/**
 * Top-K user_memory rows for `userId`, ranked by cosine similarity to
 * `query`. Always scoped by user. Returns an empty array on any failure
 * so the caller can gracefully fall back to Supabase-recency retrieval.
 */
export async function queryRelevantMemories(
  userId: string,
  query: string,
  topK = 8
): Promise<StoredMemory[]> {
  try {
    if (!query || query.trim().length === 0) return []

    const vector = await embed(query)
    if (!vector) return []

    const supa = getSupa()
    const { data, error } = await supa.rpc('match_user_memories', {
      query_embedding: vector,
      match_user_id: userId,
      match_count: topK,
    })
    if (error) {
      console.error('[pgvector] match_user_memories error:', error.message)
      return []
    }

    return ((data ?? []) as Array<{
      id: string
      fact: string
      category: string
      similarity: number
    }>)
      .map((r) => ({
        id: r.id,
        fact: r.fact,
        category: r.category,
        score: r.similarity,
      }))
      .filter((m) => m.fact && m.fact.length > 0)
  } catch (err) {
    console.error('[pgvector] queryRelevantMemories failed:', err)
    return []
  }
}

/** No-op: cascade delete handles the row + embedding together. */
export async function deleteUserMemory(_memoryId: string): Promise<void> {
  // intentional no-op
}
