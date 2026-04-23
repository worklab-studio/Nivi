import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/** Fisher-Yates shuffle — mutates in place */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function GET(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(req.url)
  const tab = url.searchParams.get('tab') ?? 'library'
  const format = url.searchParams.get('format') ?? null
  const topic = url.searchParams.get('topic') ?? null
  const tier = url.searchParams.get('tier') ?? null
  const sort = url.searchParams.get('sort') ?? 'shuffle'
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '60'), 200)

  const supabase = getSupabaseAdmin()
  let query = supabase
    .from('inspiration_posts')
    .select(
      'id, content, author_name, author_headline, author_avatar_url, author_handle, format, topic_pillar, engagement_tier, creator_archetype, hook_score, likes, comments, reposts, linkedin_post_url, posted_at, is_trending, trending_week, created_at'
    )

  if (tab === 'trending') {
    query = query.eq('is_trending', true)
  }
  if (format) query = query.eq('format', format)
  if (topic) query = query.eq('topic_pillar', topic)
  if (tier) query = query.eq('engagement_tier', tier)

  // For shuffle: fetch more than needed, then shuffle + trim client-side
  // For other sorts: apply DB ordering
  if (sort === 'likes') {
    query = query.order('likes', { ascending: false })
  } else if (sort === 'newest') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'hook_score') {
    query = query.order('hook_score', { ascending: false })
  } else {
    // shuffle — fetch a larger set and shuffle server-side
    query = query.order('created_at', { ascending: false })
  }

  // For shuffle, fetch 3x limit so shuffling feels fresh each time
  const fetchLimit = sort === 'shuffle' ? Math.min(limit * 3, 500) : limit
  query = query.limit(fetchLimit)

  const { data } = await query
  let posts = data ?? []

  // Shuffle if requested — trims to limit after shuffling
  if (sort === 'shuffle') {
    posts = shuffle([...posts]).slice(0, limit)
  }

  return Response.json({ posts }, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' },
  })
}
