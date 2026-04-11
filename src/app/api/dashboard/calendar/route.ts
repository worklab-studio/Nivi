import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const start = req.nextUrl.searchParams.get('start')
  const end = req.nextUrl.searchParams.get('end')

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('posts')
    .select('id, content, status, hook_type, content_pillar, scheduled_at, published_at, created_at, post_analytics(impressions, likes, comments)')
    .eq('user_id', userId)
    .order('scheduled_at', { ascending: true })

  // Filter posts whose scheduled_at OR published_at falls in the window.
  if (start && end) {
    const startIso = `${start}T00:00:00`
    const endIso = `${end}T23:59:59`
    query = query.or(
      `and(scheduled_at.gte.${startIso},scheduled_at.lte.${endIso}),and(published_at.gte.${startIso},published_at.lte.${endIso})`
    )
  }

  const { data } = await query

  const posts = (data ?? []).map((p) => ({
    ...p,
    impressions: p.post_analytics?.[0]?.impressions ?? 0,
    likes: p.post_analytics?.[0]?.likes ?? 0,
    comments: p.post_analytics?.[0]?.comments ?? 0,
  }))

  return Response.json({ posts })
}
