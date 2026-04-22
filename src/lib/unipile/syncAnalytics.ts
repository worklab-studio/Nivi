import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getMyRecentPosts } from './linkedin'

/**
 * Syncs LinkedIn post analytics from Unipile into the local DB.
 *
 * 1. Fetches up to 100 recent posts from LinkedIn via Unipile
 * 2. For each post: upserts into `posts` table (creates entry if it's a LinkedIn-only post)
 * 3. Upserts analytics (impressions, likes, comments) into `post_analytics`
 *
 * This makes the Overview dashboard show real LinkedIn data.
 */
export async function syncLinkedInAnalytics(
  userId: string
): Promise<{ synced: number; created: number }> {
  const supabase = getSupabaseAdmin()

  // Get Unipile account
  const { data: user } = await supabase
    .from('users')
    .select('unipile_account_id')
    .eq('id', userId)
    .single()

  if (!user?.unipile_account_id) {
    throw new Error('No LinkedIn account connected')
  }

  const BASE_URL = process.env.UNIPILE_BASE_URL!
  const API_KEY = process.env.UNIPILE_API_KEY!

  // Step 1: Get provider_id
  const meRes = await fetch(
    `${BASE_URL}/api/v1/users/me?account_id=${user.unipile_account_id}`,
    {
      headers: { 'X-API-KEY': API_KEY, accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    }
  )
  if (!meRes.ok) throw new Error(`Unipile /me ${meRes.status}`)
  const me = await meRes.json()
  const providerId = me.provider_id ?? me.id ?? me.public_identifier
  if (!providerId) throw new Error('No provider_id')

  // Step 2: Fetch posts with analytics
  const liPosts = await getMyRecentPosts(
    user.unipile_account_id,
    String(providerId),
    100
  )

  if (liPosts.length === 0) return { synced: 0, created: 0 }

  console.log(`[syncAnalytics] fetched ${liPosts.length} LinkedIn posts`)

  // Step 3: Get existing posts to match by linkedin_post_id or content hash
  const { data: existingPosts } = await supabase
    .from('posts')
    .select('id, linkedin_post_id, content, image_url')
    .eq('user_id', userId)

  const existingByLiId = new Map<string, string>()
  const existingByContent = new Map<string, string>()
  const existingHasImage = new Set<string>()

  for (const p of existingPosts ?? []) {
    if (p.linkedin_post_id) existingByLiId.set(p.linkedin_post_id, p.id)
    if (p.content) existingByContent.set(p.content.slice(0, 100).toLowerCase().trim(), p.id)
    if (p.image_url) existingHasImage.add(p.id)
  }

  // === BULK APPROACH ===
  // 1. Filter LI posts: skip empty/short and 0-engagement
  // 2. Split into "needs create" vs "exists in DB"
  // 3. Bulk insert new posts (1 query)
  // 4. Bulk upsert analytics (1 query)
  // Reduces ~3N queries to ~3 total queries regardless of post count

  type ValidPost = {
    liPost: typeof liPosts[number]
    contentKey: string
    existingId: string | null
  }

  const validPosts: ValidPost[] = []
  for (const liPost of liPosts) {
    if (!liPost.text || liPost.text.length < 20) continue
    if (liPost.impressions === 0 && liPost.likes === 0 && liPost.comments === 0) continue
    const contentKey = liPost.text.slice(0, 100).toLowerCase().trim()
    const existingId = existingByLiId.get(liPost.id) ?? existingByContent.get(contentKey) ?? null
    validPosts.push({ liPost, contentKey, existingId })
  }

  // ─── Bulk insert new posts ───
  const toInsert = validPosts.filter((v) => !v.existingId).map((v) => {
    let pubDate = new Date().toISOString()
    try {
      const d = new Date(v.liPost.date)
      if (!isNaN(d.getTime())) pubDate = d.toISOString()
    } catch { /* use current date */ }
    return {
      user_id: userId,
      content: v.liPost.text,
      linkedin_post_id: v.liPost.id,
      status: 'published',
      published_at: pubDate,
      image_url: v.liPost.imageUrl ?? null,
    }
  })

  let created = 0
  if (toInsert.length > 0) {
    const { data: inserted } = await supabase
      .from('posts')
      .insert(toInsert)
      .select('id, linkedin_post_id')
    if (inserted) {
      created = inserted.length
      // Map back to validPosts so we have postIds for analytics
      const insertedByLiId = new Map<string, string>()
      for (const row of inserted) {
        if (row.linkedin_post_id) insertedByLiId.set(row.linkedin_post_id, row.id)
      }
      for (const v of validPosts) {
        if (!v.existingId) {
          v.existingId = insertedByLiId.get(v.liPost.id) ?? null
        }
      }
    }
  }

  // ─── Backfill image_url on existing posts that don't have one ───
  // Bulk update: posts whose LinkedIn data has an image but our DB row doesn't
  const imageBackfills = validPosts
    .filter((v) => v.existingId && v.liPost.imageUrl && !existingHasImage.has(v.existingId))
    .map((v) => ({ id: v.existingId!, image_url: v.liPost.imageUrl! }))

  for (const row of imageBackfills) {
    await supabase.from('posts').update({ image_url: row.image_url }).eq('id', row.id)
  }
  if (imageBackfills.length > 0) {
    console.log(`[syncAnalytics] backfilled ${imageBackfills.length} image URLs`)
  }

  // ─── Bulk upsert analytics ───
  const analyticsRows = validPosts
    .filter((v) => v.existingId)
    .map((v) => ({
      post_id: v.existingId!,
      impressions: v.liPost.impressions,
      likes: v.liPost.likes,
      comments: v.liPost.comments,
      shares: v.liPost.reposts,
      engagement_rate: v.liPost.impressions > 0
        ? Math.round(
            ((v.liPost.likes + v.liPost.comments + v.liPost.reposts) / v.liPost.impressions) * 1000
          ) / 10
        : 0,
      synced_at: new Date().toISOString(),
    }))

  let synced = 0
  if (analyticsRows.length > 0) {
    const { error } = await supabase
      .from('post_analytics')
      .upsert(analyticsRows, { onConflict: 'post_id' })
    if (!error) synced = analyticsRows.length
  }

  console.log(`[syncAnalytics] synced ${synced} posts, created ${created} new entries`)
  return { synced, created }
}
