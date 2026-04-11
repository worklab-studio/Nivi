import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('comment_opportunities')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(200)

  const opportunities = data ?? []

  // Stats
  const pending = opportunities.filter((o) => o.status === 'pending').length
  const postedAll = opportunities.filter((o) => o.status === 'posted')
  const weekAgo = Date.now() - 7 * 86400000
  const postedThisWeek = postedAll.filter(
    (o) => new Date(o.created_at).getTime() > weekAgo
  ).length
  const replyReceivedCount = postedAll.filter(
    (o) => o.reply_received === true
  ).length
  const replyRate =
    postedAll.length > 0
      ? Math.round((replyReceivedCount / postedAll.length) * 100)
      : 0

  // Streak — consecutive days with at least one posted comment
  const postedDates = new Set(
    postedAll.map((o) =>
      new Date(o.posted_at ?? o.created_at).toISOString().slice(0, 10)
    )
  )
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
    if (postedDates.has(d)) streak++
    else if (i > 0) break
  }

  return Response.json({
    opportunities,
    stats: {
      pending,
      postedThisWeek,
      postedTotal: postedAll.length,
      replyRate,
      streak,
    },
  })
}
