import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  // Check if user has any opportunities
  const { count: existingCount } = await supabase
    .from('comment_opportunities')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Auto-populate from inspiration library if empty
  if ((existingCount ?? 0) === 0) {
    const { data: inspirationPosts } = await supabase
      .from('inspiration_posts')
      .select('id, content, author_name, author_headline, author_handle, author_avatar_url, linkedin_post_url, likes, comments')
      .order('scraped_at', { ascending: false })
      .limit(15)

    if (inspirationPosts && inspirationPosts.length > 0) {
      const rows = inspirationPosts.map((p) => ({
        user_id: userId,
        linkedin_post_id: p.linkedin_post_url ?? `insp-${p.id}`,
        author_name: p.author_name,
        author_headline: p.author_headline,
        author_handle: p.author_handle,
        author_avatar_url: p.author_avatar_url,
        linkedin_post_url: p.linkedin_post_url,
        post_preview: (p.content ?? '').slice(0, 500),
        drafted_comment: null,
        relevance_score: null,
        matched_pillar: null,
        status: 'pending',
      }))
      await supabase.from('comment_opportunities').insert(rows)
    }
  }

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
