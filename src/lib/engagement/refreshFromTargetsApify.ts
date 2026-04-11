import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'

interface ScrapedPost {
  text?: string
  postText?: string
  content?: string
  authorName?: string
  author_name?: string
  authorHeadline?: string
  author_headline?: string
  authorProfileUrl?: string
  authorFollowers?: number
  numLikes?: number
  likes?: number
  numComments?: number
  comments?: number
  postUrl?: string
  url?: string
  postedAt?: string
  timestamp?: string
}

/**
 * Apify-based engagement refresh.
 * Scrapes recent posts from engagement targets — does NOT draft comments.
 * Comments are generated on-demand when the user clicks "Draft comment".
 */
export async function refreshFromTargetsApify(
  userId: string
): Promise<{ created: number; skippedTargets: number }> {
  const supabase = getSupabaseAdmin()
  const apifyToken = getEnv('APIFY_API_TOKEN')

  // Load targets
  const { data: targetsRaw } = await supabase
    .from('engagement_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('mode', 'whitelist')
    .order('created_at', { ascending: false })
    .limit(15)

  const targets = targetsRaw ?? []
  if (targets.length === 0) {
    throw new Error(
      'Add targets first in the Targets tab, or paste a LinkedIn post URL via Add from URL.'
    )
  }

  const targetUrls = targets.map(
    (t: { linkedin_url: string }) => t.linkedin_url
  )

  console.log(`[engagement-apify] scraping ${targetUrls.length} targets via Apify…`)

  // Call Apify — same actor as inspiration
  let items: ScrapedPost[] = []
  try {
    const apifyRes = await fetch(
      `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: targetUrls,
          limitPerSource: 3,
          deepScrape: false,
          rawData: false,
        }),
        signal: AbortSignal.timeout(300_000),
      }
    )

    if (!apifyRes.ok) {
      const body = await apifyRes.text().catch(() => '')
      throw new Error(`Apify ${apifyRes.status}: ${body.slice(0, 200)}`)
    }

    items = await apifyRes.json()
    if (!Array.isArray(items)) items = []
    console.log(`[engagement-apify] scraped ${items.length} posts`)
  } catch (e) {
    console.error('[engagement-apify] Apify scrape failed:', (e as Error).message)
    throw new Error(`Scraping failed: ${(e as Error).message}`)
  }

  if (items.length === 0) {
    return { created: 0, skippedTargets: targets.length }
  }

  // Filter to last 48h posts
  const cutoff48h = Date.now() - 48 * 3600 * 1000
  const recentPosts = items.filter((item) => {
    const dateStr = item.postedAt ?? item.timestamp
    if (!dateStr) return true
    const posted = new Date(dateStr).getTime()
    return posted > cutoff48h
  })

  // De-dup against existing opportunities
  const { data: existingRaw } = await supabase
    .from('comment_opportunities')
    .select('post_preview')
    .eq('user_id', userId)
    .gte('created_at', new Date(cutoff48h).toISOString())

  const existingHashes = new Set(
    (existingRaw ?? [])
      .map((r) => (r.post_preview ?? '').slice(0, 80).toLowerCase().trim())
      .filter(Boolean)
  )

  // Build rows — NO comment drafting (saved on-demand)
  const rows: Record<string, unknown>[] = []

  for (const item of recentPosts) {
    const content = item.text ?? item.postText ?? item.content ?? ''
    if (!content || content.length < 50) continue

    const hash = content.slice(0, 80).toLowerCase().trim()
    if (existingHashes.has(hash)) continue
    existingHashes.add(hash)

    const authorName = item.authorName ?? item.author_name ?? 'Unknown'
    const handle = (item.authorProfileUrl ?? '').match(/\/in\/([^/]+)/)?.[1] ?? null

    rows.push({
      user_id: userId,
      linkedin_post_id: item.postUrl ?? item.url ?? `apify-${Date.now()}-${rows.length}`,
      author_name: authorName,
      author_headline: item.authorHeadline ?? item.author_headline ?? null,
      author_handle: handle,
      author_avatar_url: handle ? `https://unavatar.io/linkedin/${handle}` : null,
      linkedin_post_url: item.postUrl ?? item.url ?? null,
      post_preview: content.slice(0, 500),
      drafted_comment: null, // No pre-drafting — user triggers this
      relevance_score: null,
      matched_pillar: null,
      status: 'pending',
    })
  }

  if (rows.length === 0) {
    return { created: 0, skippedTargets: 0 }
  }

  const { error } = await supabase
    .from('comment_opportunities')
    .insert(rows)

  if (error) {
    console.error('[engagement-apify] insert error', error.message)
    throw new Error(error.message)
  }

  console.log(`[engagement-apify] created ${rows.length} opportunities (no comments yet)`)
  return { created: rows.length, skippedTargets: 0 }
}
