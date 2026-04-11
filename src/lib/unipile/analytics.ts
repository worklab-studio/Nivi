import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function syncPostAnalytics(
  linkedinPostId: string,
  accountId: string
): Promise<void> {
  const supabase = getSupabase()

  const res = await fetch(
    `${process.env.UNIPILE_BASE_URL}/api/v1/posts/${linkedinPostId}?account_id=${accountId}`,
    { headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY! } }
  )

  if (!res.ok) return

  const data = await res.json()

  const { data: post } = await supabase
    .from('posts')
    .select('id')
    .eq('linkedin_post_id', linkedinPostId)
    .single()

  if (!post) return

  const impressions = data.impressions_counter ?? data.impressions ?? 0
  const likes = data.reaction_counter ?? data.likes ?? 0
  const comments = data.comment_counter ?? data.comments ?? 0
  const shares = data.repost_counter ?? data.shares ?? 0
  const engagementRate =
    impressions > 0
      ? Math.round(((likes + comments + shares) / impressions) * 1000) / 10
      : 0

  await supabase.from('post_analytics').upsert(
    {
      post_id: post.id,
      impressions,
      likes,
      comments,
      shares,
      engagement_rate: engagementRate,
      synced_at: new Date().toISOString(),
    },
    { onConflict: 'post_id' }
  )
}

export async function syncAllUserAnalytics(
  userId: string
): Promise<void> {
  const supabase = getSupabase()

  const { data: user } = await supabase
    .from('users')
    .select('unipile_account_id')
    .eq('id', userId)
    .single()

  if (!user?.unipile_account_id) return

  const { data: posts } = await supabase
    .from('posts')
    .select('linkedin_post_id')
    .eq('user_id', userId)
    .eq('status', 'published')
    .not('linkedin_post_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(20)

  for (const post of posts ?? []) {
    if (post.linkedin_post_id) {
      await syncPostAnalytics(post.linkedin_post_id, user.unipile_account_id)
    }
  }
}
