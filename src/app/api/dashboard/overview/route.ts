import { auth, currentUser } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getCachedLinkedInProfile } from '@/lib/unipile/profile'
import { ensureUser } from '@/lib/auth/ensureUser'
// getMyRecentPosts removed — post dates now come from local DB (synced by cron)
import { startOfWeek, startOfYear, subWeeks, format, subDays, eachDayOfInterval } from 'date-fns'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure user row exists (Clerk webhook may have failed)
  await ensureUser(userId)

  const supabase = getSupabaseAdmin()

  const [{ data: user }, { data: posts }, { data: engagement }, { data: identity }, linkedInProfile] = await Promise.all([
    supabase.from('users').select('name, streak_count, unipile_account_id, whatsapp_number').eq('id', userId).single(),
    supabase
      .from('posts')
      .select('*, post_analytics(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('comment_opportunities')
      .select('id, author_name, drafted_comment, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('brand_identity')
      .select('about_you, target_audience, content_pillars, personal_info')
      .eq('user_id', userId)
      .maybeSingle(),
    getCachedLinkedInProfile(userId),
  ])

  const allPosts = posts ?? []

  // Helper to safely access post_analytics (Supabase returns object, not array, due to unique constraint)
  type Analytics = { impressions?: number; likes?: number; comments?: number; shares?: number; engagement_rate?: number }
  const getAnalytics = (p: (typeof allPosts)[0]): Analytics =>
    (p.post_analytics as unknown as Analytics) ?? {}

  const published = allPosts.filter((p) => p.status === 'published')

  // Last 7 days as primary KPI period
  const now7d = new Date()
  const sevenDaysAgo = subDays(now7d, 7)
  const fourteenDaysAgo = subDays(now7d, 14)

  const last7dPosts = published.filter(
    (p) => new Date(p.published_at!) >= sevenDaysAgo
  )
  const prev7dPosts = published.filter(
    (p) =>
      new Date(p.published_at!) >= fourteenDaysAgo &&
      new Date(p.published_at!) < sevenDaysAgo
  )

  // Also keep week start for the week strip
  const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 })

  const sum = (arr: typeof allPosts, key: keyof Analytics) =>
    arr.reduce((s, p) => s + (Number(getAnalytics(p)[key]) || 0), 0)
  const delta = (curr: number, prev: number) =>
    prev === 0 ? 0 : Math.round(((curr - prev) / prev) * 100)

  const last7dImpressions = sum(last7dPosts, 'impressions')
  const prev7dImpressions = sum(prev7dPosts, 'impressions')
  const last7dLikes = sum(last7dPosts, 'likes')
  const prev7dLikes = sum(prev7dPosts, 'likes')
  const last7dComments = sum(last7dPosts, 'comments')
  const prev7dComments = sum(prev7dPosts, 'comments')
  const avgEngagement =
    last7dPosts.length > 0
      ? Math.round(
          (last7dPosts.reduce(
            (s, p) => s + (getAnalytics(p).engagement_rate ?? 0),
            0
          ) /
            last7dPosts.length) *
            10
        ) / 10
      : 0

  // Today's post
  const today = format(new Date(), 'yyyy-MM-dd')
  const todayPost = allPosts.find((p) => {
    const d = p.published_at ?? p.scheduled_at ?? p.created_at
    return d?.startsWith(today)
  })

  // ─── Yearly heatmap: full current year (Jan 1 → today) ───
  // Merge Nivi posts + LinkedIn history for a complete picture
  const yearStart = startOfYear(new Date())
  const yearEnd = new Date(new Date().getFullYear(), 11, 31)
  const yearDays = eachDayOfInterval({ start: yearStart, end: yearEnd })

  // Fetch LinkedIn stats (followers, connections) from Apify cache (fast)
  // + post history dates from local DB (already synced by cron/callback)
  let linkedInPostDates: Set<string> = new Set()
  let followers = 0
  let connections = 0
  if (user?.unipile_account_id) {
    // Get followers/connections from Apify cache (instant, no network call)
    try {
      const { getLinkedInProfileCached } = await import('@/lib/apify/scrapeLinkedInProfile')
      const cached = await getLinkedInProfileCached(userId)
      if (cached) {
        followers = cached.followerCount ?? 0
        connections = cached.connectionCount ?? 0
      }
    } catch { /* best effort */ }

    // Get post dates from local DB (already synced)
    for (const p of published) {
      if (p.published_at) {
        linkedInPostDates.add(format(new Date(p.published_at), 'yyyy-MM-dd'))
      }
    }
  }

  const nowDate = new Date()
  const streakDays = yearDays.map((day) => {
    const dateStr = format(day, 'yyyy-MM-dd')
    const isFuture = day > nowDate
    if (isFuture) {
      const hasScheduled = allPosts.some((p) =>
        (p.scheduled_at ?? '').startsWith(dateStr) && p.status === 'scheduled'
      )
      return {
        date: dateStr,
        count: 0,
        status: hasScheduled ? ('scheduled' as const) : ('future' as const),
      }
    }
    const dayPosts = allPosts.filter((p) =>
      (p.published_at ?? p.scheduled_at ?? '').startsWith(dateStr)
    )
    const hasPublished = dayPosts.some((p) => p.status === 'published') || linkedInPostDates.has(dateStr)
    const hasScheduled = dayPosts.some((p) => p.status === 'scheduled')
    const niviCount = dayPosts.filter((p) => p.status === 'published').length
    const liCount = linkedInPostDates.has(dateStr) && niviCount === 0 ? 1 : 0
    return {
      date: dateStr,
      count: niviCount + liCount,
      status: hasPublished
        ? ('published' as const)
        : hasScheduled
          ? ('scheduled' as const)
          : ('empty' as const),
    }
  })

  // Week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(thisWeekStart)
    date.setDate(date.getDate() + i)
    const dateStr = format(date, 'yyyy-MM-dd')
    const post = allPosts.find((p) =>
      (p.published_at ?? p.scheduled_at ?? p.created_at).startsWith(dateStr)
    )
    return { date: dateStr, status: post?.status ?? null }
  })

  // Weekly publishing goal
  const postsThisWeek = allPosts.filter((p) => {
    const d = p.published_at ?? p.scheduled_at ?? p.created_at
    return new Date(d) >= thisWeekStart
  }).length

  // Daily impressions (30 days) for the chart
  const dailyImpressions = Array.from({ length: 30 }, (_, i) => {
    const date = format(subDays(new Date(), 29 - i), 'MMM d')
    const dateStr = format(subDays(new Date(), 29 - i), 'yyyy-MM-dd')
    const dayPosts = published.filter((p) =>
      p.published_at?.startsWith(dateStr)
    )
    return {
      date,
      impressions: dayPosts.reduce(
        (s, p) => s + (getAnalytics(p).impressions ?? 0),
        0
      ),
    }
  })

  // Pillar performance
  const pillarPerformance = [1, 2, 3, 4, 5].map((pillar) => {
    const pp = published.filter((p) => p.content_pillar === pillar)
    const avg =
      pp.length > 0
        ? Math.round(
            (pp.reduce(
              (s, p) => s + (getAnalytics(p).engagement_rate ?? 0),
              0
            ) /
              pp.length) *
              10
          ) / 10
        : 0
    return { pillar: `P${pillar}`, engagement: avg, count: pp.length }
  })

  // Hook performance
  const hooks = [
    'almost_formula',
    'contrarian',
    'observation',
    'confession',
    'uncomfortable_truth',
  ]
  const hookPerformance = hooks
    .map((hook) => {
      const hp = published.filter((p) => p.hook_type === hook)
      const avg =
        hp.length > 0
          ? Math.round(
              hp.reduce(
                (s, p) => s + (getAnalytics(p).comments ?? 0),
                0
              ) / hp.length
            )
          : 0
      return { hook: hook.replace(/_/g, ' '), comments: avg, count: hp.length }
    })
    .filter((h) => h.count > 0)

  // Top 5 posts
  const topPosts = [...published]
    .sort(
      (a, b) =>
        (b.post_analytics?.[0]?.impressions ?? 0) -
        (a.post_analytics?.[0]?.impressions ?? 0)
    )
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      preview: p.content?.slice(0, 100) ?? '',
      impressions: getAnalytics(p).impressions ?? 0,
      likes: getAnalytics(p).likes ?? 0,
      comments: getAnalytics(p).comments ?? 0,
    }))

  // Enrich profile with identity + Clerk fallback
  const profile = { ...linkedInProfile }

  // Try brand_identity for headline, followers, connections if Unipile didn't return them
  if (identity) {
    const pi = ((identity as Record<string, unknown>)?.personal_info ?? []) as Array<{ key: string; value: string }>
    const findPi = (key: string) => pi.find((p) => p.key?.toLowerCase() === key)?.value

    if (!profile.headline) {
      const headline = findPi('headline') ?? findPi('tagline') ?? findPi('title')
      if (headline) profile.headline = headline
    }
    if (!followers) {
      const f = findPi('followers')
      if (f) followers = parseInt(f.replace(/[^0-9]/g, '')) || 0
    }
    if (!connections) {
      const c = findPi('connections')
      if (c) connections = c.includes('+') ? 500 : (parseInt(c.replace(/[^0-9]/g, '')) || 0)
    }
  }

  // Clerk fallback for name + avatar
  if (!profile.avatarUrl || profile.name === 'You' || !profile.headline) {
    try {
      const clerk = await currentUser()
      if (clerk) {
        if (!profile.avatarUrl && clerk.imageUrl) profile.avatarUrl = clerk.imageUrl
        if (profile.name === 'You') {
          const n = [clerk.firstName, clerk.lastName].filter(Boolean).join(' ').trim()
          if (n) profile.name = n
        }
      }
    } catch { /* best effort */ }
  }

  // Identity-derived fields
  const aboutYou = (identity?.about_you ?? '').slice(0, 150)
  const audiences = (identity?.target_audience ?? []) as unknown[]
  const pillars = (identity?.content_pillars ?? []) as unknown[]
  const draftsCount = allPosts.filter((p) => p.status === 'draft').length
  const scheduledCount = allPosts.filter((p) => p.status === 'scheduled').length

  return Response.json({
    userName: profile.name !== 'You' ? profile.name : (user?.name ?? 'there'),
    profile: {
      name: profile.name !== 'You' ? profile.name : (user?.name ?? 'there'),
      headline: profile.headline ?? '',
      avatarUrl: profile.avatarUrl ?? '',
    },
    aboutYou,
    audienceCount: audiences.length,
    pillarCount: pillars.length,
    followers,
    connections,
    connectionStatus: {
      linkedin: !!user?.unipile_account_id,
      whatsapp: !!user?.whatsapp_number,
    },
    draftsCount,
    scheduledCount,
    streakCount: user?.streak_count ?? 0,
    streakDays,
    postsThisWeek,
    metrics: {
      // Show last 7 days if there's data, otherwise show all-time so dashboard doesn't look empty
      impressions: last7dImpressions || sum(published, 'impressions'),
      impressionsDelta: delta(last7dImpressions, prev7dImpressions),
      likes: last7dLikes || sum(published, 'likes'),
      likesDelta: delta(last7dLikes, prev7dLikes),
      comments: last7dComments || sum(published, 'comments'),
      commentsDelta: delta(last7dComments, prev7dComments),
      engagementRate: avgEngagement || (published.length > 0
        ? Math.round(published.reduce((s, p) => s + (getAnalytics(p).engagement_rate ?? 0), 0) / published.length * 10) / 10
        : 0),
      streak: user?.streak_count ?? 0,
      totalPublished: published.length,
      // Tell frontend which period is being shown
      period: last7dImpressions > 0 ? 'last 7 days' : (published.length > 0 ? 'all time' : 'last 7 days'),
    },
    today: todayPost
      ? {
          status: todayPost.status,
          preview: todayPost.content?.slice(0, 200),
          postId: todayPost.id,
          scheduledTime: todayPost.scheduled_at,
          impressions: todayPost.post_analytics?.[0]?.impressions,
        }
      : { status: null },
    weekDays,
    // Analytics data (merged)
    dailyImpressions,
    pillarPerformance,
    hookPerformance,
    topPosts,
    recentEngagement: (engagement ?? []).map((e) => ({
      id: e.id,
      authorName: e.author_name ?? 'Unknown',
      comment: e.drafted_comment?.slice(0, 80) ?? '',
      status: e.status,
    })),
  })
}
