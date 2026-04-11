/**
 * Memory decay dry-run.
 *
 *   npx tsx src/lib/queue/scripts/memoryDecayDryRun.ts
 *
 * Walks every `user_memory` row, computes what the decay job WOULD do,
 * and writes proposals to `nivi_memory_decay_proposals`. Does NOT touch
 * `user_memory.confidence` or archive anything.
 *
 * Decay rules (conservative for Tier 1 → Tier 2 handoff):
 *   • Never decay milestone/system-sourced rows (source = 'system').
 *   • Never decay goal/avoid categories — those are constraints.
 *   • If last_used_at is NULL AND created_at > 30 days ago   → -0.1
 *   • If last_used_at > 30 days ago                          → -0.2
 *   • If last_used_at > 60 days ago AND use_count = 0        → -0.4
 *
 * Proposals with proposed_confidence < 0.3 are the candidates Tier 2's
 * real job will archive. Review the table before flipping to live.
 */

import { createClient } from '@supabase/supabase-js'

const DAY = 86_400_000
const BATCH_SIZE = 500

interface Row {
  id: string
  user_id: string
  fact: string
  category: string
  confidence: number
  source: string | null
  created_at: string
  last_used_at: string | null
  use_count: number | null
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('Missing SUPABASE env vars')
    process.exit(1)
  }
  const supabase = createClient(url, key)

  let offset = 0
  let totalScanned = 0
  let totalProposed = 0

  for (;;) {
    const { data: rows, error } = await supabase
      .from('user_memory')
      .select('id, user_id, fact, category, confidence, source, created_at, last_used_at, use_count')
      .order('id')
      .range(offset, offset + BATCH_SIZE - 1)

    if (error) {
      console.error('[decay] Supabase error:', error.message)
      process.exit(1)
    }
    if (!rows || rows.length === 0) break

    const proposals: Array<{
      user_id: string
      memory_id: string
      current_confidence: number
      proposed_confidence: number
      reason: string
    }> = []

    for (const row of rows as Row[]) {
      totalScanned++

      if (row.source === 'system') continue
      if (row.category === 'goal' || row.category === 'avoid') continue

      const now = Date.now()
      const createdAgeMs = now - new Date(row.created_at).getTime()
      const lastUsedAgeMs = row.last_used_at
        ? now - new Date(row.last_used_at).getTime()
        : Infinity
      const useCount = row.use_count ?? 0

      let delta = 0
      let reason = ''

      if (lastUsedAgeMs > 60 * DAY && useCount === 0) {
        delta = -0.4
        reason = 'never used, >60d old'
      } else if (lastUsedAgeMs > 30 * DAY) {
        delta = -0.2
        reason = 'last used >30d ago'
      } else if (row.last_used_at === null && createdAgeMs > 30 * DAY) {
        delta = -0.1
        reason = 'never read, created >30d ago'
      }

      if (delta === 0) continue

      const proposed = Math.max(0, (row.confidence ?? 0.8) + delta)
      proposals.push({
        user_id: row.user_id,
        memory_id: row.id,
        current_confidence: row.confidence ?? 0.8,
        proposed_confidence: proposed,
        reason,
      })
    }

    if (proposals.length > 0) {
      const { error: insErr } = await supabase
        .from('nivi_memory_decay_proposals')
        .insert(proposals)
      if (insErr) {
        console.error('[decay] Insert failed:', insErr.message)
      } else {
        totalProposed += proposals.length
      }
    }

    console.log(
      `[decay] batch offset=${offset} scanned=${rows.length} proposed=${proposals.length}`
    )

    if (rows.length < BATCH_SIZE) break
    offset += BATCH_SIZE
  }

  console.log(`[decay] Done. scanned=${totalScanned} proposed=${totalProposed}`)
  console.log(
    `[decay] Review with:  select * from nivi_memory_decay_proposals order by run_at desc limit 50;`
  )
}

main().catch((err) => {
  console.error('[decay] Fatal:', err)
  process.exit(1)
})
