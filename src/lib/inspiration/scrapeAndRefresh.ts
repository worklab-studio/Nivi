import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'
import { tagPost } from './tagPost'
import { embedInspirationPost } from './embedPost'
import { CREATOR_PROFILES, SEARCH_URLS } from './sources'

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
  numReposts?: number
  postUrl?: string
  url?: string
  postedAt?: string
  timestamp?: string
}

function getISOWeek(): string {
  const now = new Date()
  const jan1 = new Date(now.getFullYear(), 0, 1)
  const days = Math.floor(
    (now.getTime() - jan1.getTime()) / 86400000
  )
  const week = Math.ceil((days + jan1.getDay() + 1) / 7)
  return `${now.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Split array into chunks of given size */
function chunk<T>(arr: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}

/**
 * Scrape LinkedIn posts via Apify in batches and refresh the inspiration
 * library. Tags with Claude, embeds with Gemini, de-dups, picks trending.
 *
 * Batches the Apify calls (25 URLs each) so no single call times out.
 * Processes and inserts posts in batches of 10 so partial results appear fast.
 */
export async function scrapeAndRefreshInspiration(): Promise<{
  scraped: number
  inserted: number
  trending: number
  skipped: number
}> {
  const apifyToken = getEnv('APIFY_API_TOKEN')
  const supabase = getSupabaseAdmin()

  console.log('[inspiration] starting Apify batch scrape…')

  // Load existing content hashes for de-dup
  const { data: existing } = await supabase
    .from('inspiration_posts')
    .select('content')

  const existingHashes = new Set(
    (existing ?? []).map((e) =>
      (e.content ?? '').slice(0, 200).toLowerCase().trim()
    )
  )

  const allRows: Record<string, unknown>[] = []
  let totalScraped = 0
  let skippedDupes = 0

  // Split URLs into batches of 25 to avoid Apify timeout
  const profileBatches = chunk(CREATOR_PROFILES, 25)
  const searchBatch = SEARCH_URLS // search URLs go as one batch

  const urlBatches = [
    ...profileBatches.map((urls) => ({ urls, limitPerSource: 5 })),
    { urls: searchBatch, limitPerSource: 10 },
  ]

  for (let bi = 0; bi < urlBatches.length; bi++) {
    const batch = urlBatches[bi]
    console.log(
      `[inspiration] batch ${bi + 1}/${urlBatches.length}: ${batch.urls.length} URLs × ${batch.limitPerSource} posts`
    )

    let items: ScrapedPost[] = []
    try {
      const apifyRes = await fetch(
        `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/run-sync-get-dataset-items?token=${apifyToken}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            urls: batch.urls,
            limitPerSource: batch.limitPerSource,
            deepScrape: false,
            rawData: false,
          }),
          signal: AbortSignal.timeout(300_000),
        }
      )

      if (!apifyRes.ok) {
        const body = await apifyRes.text().catch(() => '')
        console.error(
          `[inspiration] batch ${bi + 1} Apify error ${apifyRes.status}:`,
          body.slice(0, 200)
        )
        continue // Skip this batch, try the next
      }

      items = await apifyRes.json()
      if (!Array.isArray(items)) items = []
      console.log(`[inspiration] batch ${bi + 1} returned ${items.length} posts`)
      totalScraped += items.length
    } catch (e) {
      console.error(
        `[inspiration] batch ${bi + 1} threw:`,
        (e as Error).message
      )
      continue
    }

    // Process this batch's posts
    const FLUSH_SIZE = 10
    let flushBuffer: Record<string, unknown>[] = []

    for (const item of items) {
      const content = item.text ?? item.postText ?? item.content ?? ''
      if (!content || content.length < 50) continue

      const hash = content.slice(0, 200).toLowerCase().trim()
      if (existingHashes.has(hash)) {
        skippedDupes++
        continue
      }
      existingHashes.add(hash)

      const authorName = item.authorName ?? item.author_name ?? 'Unknown'
      const likes = item.numLikes ?? item.likes ?? 0
      const comments = item.numComments ?? item.comments ?? 0
      const reposts = item.numReposts ?? 0
      const tier =
        likes >= 10000 ? 'viral' : likes >= 1000 ? 'strong' : 'solid'

      // Tag with Claude
      let tags
      try {
        tags = await tagPost(content, authorName, likes)
      } catch {
        tags = {
          format: 'observation',
          topic_pillar: 'personal_growth',
          engagement_tier: tier,
          creator_archetype: 'creator',
          hook_score: 5,
        }
      }

      // Embed with Gemini
      let embedding: number[] | null = null
      try {
        embedding = await embedInspirationPost(content)
      } catch {
        // Skip embedding
      }

      const handle =
        (item.authorProfileUrl ?? '').match(/\/in\/([^/]+)/)?.[1] ?? null

      flushBuffer.push({
        linkedin_post_url: item.postUrl ?? item.url ?? null,
        author_name: authorName,
        author_headline: item.authorHeadline ?? item.author_headline ?? null,
        author_handle: handle,
        author_avatar_url: handle
          ? `https://unavatar.io/linkedin/${handle}`
          : null,
        author_followers: item.authorFollowers ?? null,
        content,
        format: tags.format,
        topic_pillar: tags.topic_pillar,
        engagement_tier: tags.engagement_tier,
        creator_archetype: tags.creator_archetype,
        hook_score: tags.hook_score,
        likes,
        comments,
        reposts,
        posted_at: item.postedAt ?? item.timestamp ?? null,
        scraped_at: new Date().toISOString(),
        is_seed: false,
        is_trending: false,
        embedding: embedding ? `[${embedding.join(',')}]` : null,
      })

      // Flush every FLUSH_SIZE
      if (flushBuffer.length >= FLUSH_SIZE) {
        const { error } = await supabase
          .from('inspiration_posts')
          .insert(flushBuffer)
        if (error) {
          console.error('[inspiration] flush error:', error.message)
        } else {
          console.log(
            `[inspiration] flushed ${flushBuffer.length} (total so far: ${allRows.length + flushBuffer.length})`
          )
        }
        allRows.push(...flushBuffer)
        flushBuffer = []
      }
    }

    // Flush remaining from this batch
    if (flushBuffer.length > 0) {
      const { error } = await supabase
        .from('inspiration_posts')
        .insert(flushBuffer)
      if (!error) {
        console.log(
          `[inspiration] flushed remaining ${flushBuffer.length} (total: ${allRows.length + flushBuffer.length})`
        )
      }
      allRows.push(...flushBuffer)
      flushBuffer = []
    }
  }

  console.log(
    `[inspiration] all batches done. scraped=${totalScraped} new=${allRows.length} dupes_skipped=${skippedDupes}`
  )

  if (allRows.length === 0) {
    return { scraped: totalScraped, inserted: 0, trending: 0, skipped: skippedDupes }
  }

  // Pick trending: top 10 by hook_score × engagement weight
  const currentWeek = getISOWeek()

  // Clear previous trending
  await supabase
    .from('inspiration_posts')
    .update({ is_trending: false })
    .eq('is_trending', true)

  const scored = allRows
    .map((r, i) => ({
      index: i,
      score:
        ((r.hook_score as number) ?? 5) * 2 +
        Math.log10(Math.max(1, r.likes as number)) * 3 +
        Math.log10(Math.max(1, r.comments as number)) * 2,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  let trendingCount = 0
  for (const s of scored) {
    const row = allRows[s.index]
    const contentSlice = (row.content as string).slice(0, 100)
    const { error } = await supabase
      .from('inspiration_posts')
      .update({ is_trending: true, trending_week: currentWeek })
      .ilike(
        'content',
        `${contentSlice.replace(/[%_]/g, '\\$&')}%`
      )
    if (!error) trendingCount++
  }

  console.log(
    `[inspiration] marked ${trendingCount} as trending for ${currentWeek}`
  )

  return {
    scraped: totalScraped,
    inserted: allRows.length,
    trending: trendingCount,
    skipped: skippedDupes,
  }
}
