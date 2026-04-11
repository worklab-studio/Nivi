/**
 * One-time backfill: embed every row in `user_memory` that doesn't have a
 * pgvector embedding yet, call Gemini text-embedding-004, and write the
 * vector directly into `user_memory.embedding`.
 *
 * Run once per environment after applying supabase/migrations/2026-04-07-pgvector.sql:
 *
 *   npx tsx src/lib/queue/scripts/backfillMemoryEmbeddings.ts
 *
 * Idempotent — safe to re-run. Processes in batches of 100.
 * Requires GEMINI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import { createClient } from '@supabase/supabase-js'
import { storeUserMemory } from '@/lib/vector/memoryStore'

const BATCH_SIZE = 100

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE env vars')
    process.exit(1)
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error('Missing GEMINI_API_KEY — embeddings go through Gemini text-embedding-004')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  let totalProcessed = 0
  let totalFailed = 0

  for (;;) {
    // Pull rows that don't yet have a pgvector embedding.
    const { data: rows, error } = await supabase
      .from('user_memory')
      .select('id, user_id, fact, category')
      .is('embedding', null)
      .limit(BATCH_SIZE)

    if (error) {
      console.error('[backfill] Supabase error:', error.message)
      process.exit(1)
    }
    if (!rows || rows.length === 0) break

    console.log(`[backfill] Processing batch of ${rows.length}…`)

    for (const row of rows) {
      try {
        // storeUserMemory now embeds via Gemini and writes the vector
        // directly to user_memory.embedding. Returns memoryId on success,
        // empty string on failure.
        const ok = await storeUserMemory(
          row.user_id,
          row.id,
          row.fact,
          row.category
        )
        if (ok) {
          totalProcessed++
        } else {
          totalFailed++
        }
      } catch (err) {
        console.error(`[backfill] Failed row ${row.id}:`, err)
        totalFailed++
      }
    }

    console.log(`[backfill] Running total — ok: ${totalProcessed}, failed: ${totalFailed}`)
  }

  console.log(`[backfill] Done. Processed: ${totalProcessed}, failed: ${totalFailed}`)
}

main().catch((err) => {
  console.error('[backfill] Fatal:', err)
  process.exit(1)
})
