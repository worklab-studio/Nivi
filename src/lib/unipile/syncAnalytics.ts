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
    .select('id, linkedin_post_id, content')
    .eq('user_id', userId)

  const existingByLiId = new Map<string, string>()
  const existingByContent = new Map<string, string>()

  for (const p of existingPosts ?? []) {
    if (p.linkedin_post_id) existingByLiId.set(p.linkedin_post_id, p.id)
    if (p.content) existingByContent.set(p.content.slice(0, 100).toLowerCase().trim(), p.id)
  }

  let synced = 0
  let created = 0

  for (const liPost of liPosts) {
    if (!liPost.text || liPost.text.length < 20) continue

    const contentKey = liPost.text.slice(0, 100).toLowerCase().trim()

    // Find matching post in DB
    let postId = existingByLiId.get(liPost.id) ?? existingByContent.get(contentKey)

    if (!postId) {
      // Create a new post entry for this LinkedIn-only post
      const { data: inserted } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          content: liPost.text,
          linkedin_post_id: liPost.id,
          status: 'published',
          published_at: liPost.date ? new Date(liPost.date).toISOString() : new Date().toISOString(),
        })
        .select('id')
        .single()

      if (inserted) {
        postId = inserted.id
        created++
      }
    } else {
      // Update linkedin_post_id if not set
      await supabase
        .from('posts')
        .update({ linkedin_post_id: liPost.id })
        .eq('id', postId)
        .is('linkedin_post_id', null)
    }

    if (!postId) continue

    // Upsert analytics
    const engagementRate =
      liPost.impressions > 0
        ? Math.round(
            ((liPost.likes + liPost.comments + liPost.reposts) /
              liPost.impressions) *
              1000
          ) / 10
        : 0

    await supabase
      .from('post_analytics')
      .upsert(
        {
          post_id: postId,
          impressions: liPost.impressions,
          likes: liPost.likes,
          comments: liPost.comments,
          shares: liPost.reposts,
          engagement_rate: engagementRate,
          synced_at: new Date().toISOString(),
        },
        { onConflict: 'post_id' }
      )

    synced++
  }

  console.log(
    `[syncAnalytics] synced ${synced} posts, created ${created} new entries`
  )
  return { synced, created }
}
