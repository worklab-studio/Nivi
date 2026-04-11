import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { format, subDays } from 'date-fns'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: posts } = await supabase
    .from('posts')
    .select('*, post_analytics(*)')
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('published_at', { ascending: false })

  const allPosts = posts ?? []
  const sum = (key: string) => allPosts.reduce((s, p) => s + (p.post_analytics?.[0]?.[key] ?? 0), 0)

  const totalImpressions = sum('impressions')
  const avgEngagement = allPosts.length > 0
    ? Math.round(allPosts.reduce((s, p) => s + (p.post_analytics?.[0]?.engagement_rate ?? 0), 0) / allPosts.length * 10) / 10
    : 0
  const peakImpressions = Math.max(0, ...allPosts.map(p => p.post_analytics?.[0]?.impressions ?? 0))

  // Daily impressions (last 30 days)
  const dailyImpressions = Array.from({ length: 30 }, (_, i) => {
    const date = format(subDays(new Date(), 29 - i), 'MMM d')
    const dateStr = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
    const dayPosts = allPosts.filter(p => p.published_at?.startsWith(dateStr))
    return { date, impressions: dayPosts.reduce((s, p) => s + (p.post_analytics?.[0]?.impressions ?? 0), 0) }
  })

  // Pillar performance
  const pillarPerformance = [1, 2, 3, 4, 5].map(pillar => {
    const pp = allPosts.filter(p => p.content_pillar === pillar)
    const avg = pp.length > 0 ? Math.round(pp.reduce((s, p) => s + (p.post_analytics?.[0]?.engagement_rate ?? 0), 0) / pp.length * 10) / 10 : 0
    return { pillar: `P${pillar}`, engagement: avg }
  })

  // Hook performance
  const hooks = ['almost_formula', 'contrarian', 'observation', 'confession']
  const hookPerformance = hooks.map(hook => {
    const hp = allPosts.filter(p => p.hook_type === hook)
    const avg = hp.length > 0 ? Math.round(hp.reduce((s, p) => s + (p.post_analytics?.[0]?.comments ?? 0), 0) / hp.length) : 0
    return { hook, comments: avg }
  })

  // Top 5
  const topPosts = [...allPosts]
    .sort((a, b) => (b.post_analytics?.[0]?.impressions ?? 0) - (a.post_analytics?.[0]?.impressions ?? 0))
    .slice(0, 5)
    .map(p => ({
      id: p.id,
      preview: p.content?.slice(0, 80) ?? '',
      impressions: p.post_analytics?.[0]?.impressions ?? 0,
      likes: p.post_analytics?.[0]?.likes ?? 0,
      comments: p.post_analytics?.[0]?.comments ?? 0,
      pillar: p.content_pillar,
    }))

  return Response.json({
    totalImpressions,
    avgEngagement,
    totalPublished: allPosts.length,
    peakImpressions,
    dailyImpressions,
    pillarPerformance,
    hookPerformance,
    heatmap: [],
    topPosts,
  })
}
