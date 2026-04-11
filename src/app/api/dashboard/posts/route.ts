import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('posts')
    .select('id, content, hook_type, content_pillar, status, created_at, published_at, post_analytics(impressions, likes, comments, engagement_rate)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100)

  const posts = (data ?? []).map(p => ({
    ...p,
    impressions: p.post_analytics?.[0]?.impressions ?? 0,
    likes: p.post_analytics?.[0]?.likes ?? 0,
    comments: p.post_analytics?.[0]?.comments ?? 0,
    engagement_rate: p.post_analytics?.[0]?.engagement_rate ?? 0,
  }))

  return Response.json({ posts })
}
