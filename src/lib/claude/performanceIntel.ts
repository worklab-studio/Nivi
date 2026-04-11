import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Layer 3 — Performance Intelligence
 * Computed fresh from real data. Injected into every generation call.
 * Makes Nivi strategically aware, not just stylistically accurate.
 */
export async function buildPerformanceContext(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin()

  const [postsRes, commentsRes, convoRes] = await Promise.all([
    supabase
      .from('posts')
      .select('content, hook_type, content_pillar, status, published_at, edit_count, created_at, post_analytics(*)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('nivi_comments')
      .select('post_author_name, comment_text, has_reply, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('conversations')
      .select('role, content, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const posts = postsRes.data ?? []
  const comments = commentsRes.data ?? []
  const convos = convoRes.data ?? []

  if (posts.length === 0 && convos.length === 0) {
    return 'PERFORMANCE: No data yet. This is a new user — learn everything you can.'
  }

  const published = posts.filter(p => p.status === 'published')
  const drafted = posts.filter(p => p.status === 'draft')
  const skipped = posts.filter(p => p.status === 'skipped')

  // Hook type performance
  const hookPerf: Record<string, { count: number; totalImpressions: number; totalLikes: number; totalComments: number }> = {}
  for (const p of published) {
    const hook = p.hook_type ?? 'unknown'
    if (!hookPerf[hook]) hookPerf[hook] = { count: 0, totalImpressions: 0, totalLikes: 0, totalComments: 0 }
    hookPerf[hook].count++
    const a = p.post_analytics?.[0]
    if (a) {
      hookPerf[hook].totalImpressions += a.impressions ?? 0
      hookPerf[hook].totalLikes += a.likes ?? 0
      hookPerf[hook].totalComments += a.comments ?? 0
    }
  }

  const hookSummary = Object.entries(hookPerf)
    .map(([type, data]) => `${type}: ${data.count} posts, avg ${Math.round(data.totalImpressions / data.count)} imp, avg ${Math.round(data.totalLikes / data.count)} likes`)
    .join(' | ')

  // Best hook type
  const bestHook = Object.entries(hookPerf).sort((a, b) => {
    const avgA = a[1].totalImpressions / a[1].count
    const avgB = b[1].totalImpressions / b[1].count
    return avgB - avgA
  })[0]

  // Pillar distribution
  const pillarCounts: Record<number, number> = {}
  for (const p of published) {
    if (p.content_pillar) pillarCounts[p.content_pillar] = (pillarCounts[p.content_pillar] ?? 0) + 1
  }
  const leastUsedPillar = [1, 2, 3, 4, 5].sort((a, b) => (pillarCounts[a] ?? 0) - (pillarCounts[b] ?? 0))[0]

  // Posting consistency
  const lastPostDate = published[0]?.published_at
  const daysSinceLastPost = lastPostDate
    ? Math.floor((Date.now() - new Date(lastPostDate).getTime()) / 86400000)
    : 999

  // Editing patterns
  const editedPosts = posts.filter(p => p.edit_count > 0)
  const avgEdits = editedPosts.length > 0
    ? (editedPosts.reduce((s, p) => s + p.edit_count, 0) / editedPosts.length).toFixed(1)
    : '0'

  // Edit keywords from conversations (what user asked to change)
  const editRequests = convos
    .filter(c => c.role === 'user' && /edit|shorter|longer|change|rewrite|redo/i.test(c.content))
    .map(c => c.content.slice(0, 60))
    .slice(0, 5)

  // User's active times (from conversation timestamps)
  const hourCounts: Record<number, number> = {}
  for (const c of convos.filter(c => c.role === 'user')) {
    const hour = new Date(c.created_at).getHours()
    hourCounts[hour] = (hourCounts[hour] ?? 0) + 1
  }
  const peakHour = Object.entries(hourCounts).sort((a, b) => Number(b[1]) - Number(a[1]))[0]

  // Comment engagement stats
  const commentsMade = comments.length
  const repliesReceived = comments.filter(c => c.has_reply).length

  // Skip rate
  const skipRate = posts.length > 0
    ? Math.round((skipped.length / posts.length) * 100)
    : 0

  // What topics user talks about most (from conversations)
  const userMessages = convos.filter(c => c.role === 'user').map(c => c.content).join(' ').toLowerCase()
  const topicSignals = [
    { topic: 'AI/automation', score: (userMessages.match(/ai|automation|claude|gpt|agent/g) ?? []).length },
    { topic: 'design/UX', score: (userMessages.match(/design|ux|ui|user|interface/g) ?? []).length },
    { topic: 'building/shipping', score: (userMessages.match(/build|ship|launch|product|saas/g) ?? []).length },
    { topic: 'pricing/revenue', score: (userMessages.match(/price|pricing|revenue|money|customer/g) ?? []).length },
    { topic: 'content/posting', score: (userMessages.match(/post|content|linkedin|write|hook/g) ?? []).length },
  ].sort((a, b) => b.score - a.score)

  // Relationship milestones
  const { data: userData } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .single()
  const daysTogetherRaw = userData?.created_at
    ? Math.floor((Date.now() - new Date(userData.created_at).getTime()) / 86400000)
    : 0
  const daysTogether = Math.max(1, daysTogetherRaw)

  const MILESTONES = [7, 14, 30, 60, 90, 180, 365]
  const currentMilestone = MILESTONES.find(m => daysTogether === m)

  // Check if milestone was already acknowledged
  let milestoneInstruction = ''
  if (currentMilestone) {
    const { data: alreadyAcked } = await supabase
      .from('user_memory')
      .select('id')
      .eq('user_id', userId)
      .eq('fact', `milestone_day_${currentMilestone}_acknowledged`)
      .limit(1)

    if (!alreadyAcked || alreadyAcked.length === 0) {
      milestoneInstruction = `\n🎯 MILESTONE: Today is day ${currentMilestone} working together. Acknowledge this naturally in your next message. Be genuine — reference something specific youve learned about them or how the relationship has evolved. Then mark this milestone done.`
      // Save so we don't repeat
      await supabase.from('user_memory').insert({
        user_id: userId,
        fact: `milestone_day_${currentMilestone}_acknowledged`,
        category: 'fact',
        confidence: 1.0,
        source: 'system',
      })
    }
  }

  return `=== PERFORMANCE INTELLIGENCE (live data) ===
RELATIONSHIP: Day ${daysTogether} together. ${daysTogether < 7 ? 'Still learning their voice.' : daysTogether < 30 ? 'Getting to know them well.' : daysTogether < 90 ? 'You know them deeply now.' : 'Youve been working together for months. You know them better than most people.'}${milestoneInstruction}
POSTING: ${published.length} published, ${drafted.length} drafts, ${skipped.length} skipped (${skipRate}% skip rate)
DAYS SINCE LAST POST: ${daysSinceLastPost}
BEST HOOK TYPE: ${bestHook ? `${bestHook[0]} (avg ${Math.round(bestHook[1].totalImpressions / bestHook[1].count)} impressions)` : 'not enough data'}
HOOK BREAKDOWN: ${hookSummary || 'no data'}
LEAST USED PILLAR: P${leastUsedPillar} (suggest using it next)
AVG EDITS PER POST: ${avgEdits}
RECENT EDIT REQUESTS: ${editRequests.length > 0 ? editRequests.join(' | ') : 'none yet'}
PEAK ACTIVITY HOUR: ${peakHour ? `${peakHour[0]}:00 (${peakHour[1]} messages)` : 'unknown'}
ENGAGEMENT: ${commentsMade} comments made, ${repliesReceived} replies received
TOPICS USER CARES ABOUT: ${topicSignals.slice(0, 3).map(t => `${t.topic}(${t.score})`).join(', ')}
${daysSinceLastPost > 2 ? `⚠️ POSTING GAP: ${daysSinceLastPost} days since last post. Nudge them.` : ''}
${skipRate > 30 ? `⚠️ HIGH SKIP RATE: ${skipRate}%. Posts might not be matching their voice well enough.` : ''}`
}
