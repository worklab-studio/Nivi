import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'
import { getEnv } from '@/lib/config'

interface FeedPost {
  id?: string
  social_id?: string
  author_name?: string
  author?: string
  author_followers?: number
  author_headline?: string
  author_profile_url?: string
  author_profile_picture_url?: string
  text?: string
  reaction_counter?: number
  date?: string
  parsed_datetime?: string
  share_url?: string
}

interface DraftedOpp {
  postId: string
  authorName: string
  authorHeadline?: string
  authorFollowers?: number
  postPreview: string
  draftedComment: string
  relevanceScore?: number
  matchedPillar?: string
}

/**
 * Fetch the user's LinkedIn feed via Unipile, pick the N best posts, draft
 * a comment for each one, and save to comment_opportunities. Does NOT send
 * WhatsApp — this is the dashboard-refresh path.
 *
 * Returns the number of opportunities created.
 */
export async function refreshOpportunities(userId: string): Promise<number> {
  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id, name, unipile_account_id')
    .eq('id', userId)
    .single()

  if (!user?.unipile_account_id) {
    throw new Error('No LinkedIn account connected. Connect Unipile in Settings.')
  }

  // Fetch feed
  const feedRes = await fetch(
    `${getEnv('UNIPILE_BASE_URL')}/api/v1/users/feed?account_id=${user.unipile_account_id}&limit=30`,
    { headers: { 'X-API-KEY': getEnv('UNIPILE_API_KEY') } }
  )
  if (!feedRes.ok) {
    const body = await feedRes.text().catch(() => '')
    throw new Error(`Unipile feed ${feedRes.status}: ${body.slice(0, 200)}`)
  }
  const feedData = await feedRes.json()
  const posts: FeedPost[] = feedData.items ?? feedData ?? []
  console.log('[refreshOpportunities] fetched', posts.length, 'feed posts')
  if (posts.length === 0) return 0

  // Fetch user's pillars for relevance matching
  const { data: identity } = await supabase
    .from('brand_identity')
    .select('content_pillars')
    .eq('user_id', userId)
    .maybeSingle()

  const pillars = (identity?.content_pillars ?? []) as Array<{
    name: string
    description: string
  }>

  // Fetch target whitelist/blacklist
  const { data: targetRows } = await supabase
    .from('engagement_targets')
    .select('author_handle, mode')
    .eq('user_id', userId)
  const whitelist = new Set(
    (targetRows ?? [])
      .filter((t) => t.mode === 'whitelist')
      .map((t) => (t.author_handle ?? '').toLowerCase())
  )
  const blacklist = new Set(
    (targetRows ?? [])
      .filter((t) => t.mode === 'blacklist')
      .map((t) => (t.author_handle ?? '').toLowerCase())
  )

  // Apply blacklist filter
  const filteredPosts = posts.filter((p) => {
    const handle = ((p as unknown as { author_public_identifier?: string })
      .author_public_identifier ?? '')
      .toString()
      .toLowerCase()
    if (handle && blacklist.has(handle)) return false
    return true
  })

  const systemPrompt = await buildNiviSystemPrompt(userId)
  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })

  const selectionRes = await anthropic.messages.create({
    model: pickModel('engagement-brief'),
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: systemPrompt.static,
        cache_control: { type: 'ephemeral', ttl: '5m' },
      },
      { type: 'text', text: systemPrompt.dynamic },
    ],
    messages: [
      {
        role: 'user',
        content: `Pick the 5 best LinkedIn posts from this feed for ${user.name} to comment on.

Selection criteria:
1. Author has a meaningful following (more visibility = more value)
2. Post published recently (within last 24 hours, sooner is better)
3. Topic aligns with one of the user's content pillars — match and tag it
4. The user has a GENUINE unique insight from their background, not generic agreement
5. Not competitors, not spammy, not pure promotion

Content pillars for relevance matching:
${pillars.length > 0 ? pillars.map((p, i) => `${i + 1}. ${p.name} — ${p.description}`).join('\n') : '(no pillars set)'}

For each picked post, draft a comment that:
- Sounds exactly like the user wrote it — match their voice DNA
- Adds genuine value from their real experience
- Is 3–5 sentences maximum
- Invites a reply with a specific hook
- Never starts with "Great post!" / "I totally agree" / "This is amazing"

Also score each pick:
- relevanceScore 0.0–1.0 (how well it matches one of the pillars)
- matchedPillar (exact pillar name, or null)

Return ONLY a JSON array of EXACTLY 5 objects:
[{"postId":"...","authorName":"...","authorHeadline":"...","authorFollowers":0,"postPreview":"first 180 chars","draftedComment":"full comment","relevanceScore":0.87,"matchedPillar":"Pillar name or null"}]

Feed posts:
${JSON.stringify(
  filteredPosts.slice(0, 30).map((p) => ({
    id: p.id ?? p.social_id,
    author: p.author_name ?? p.author,
    headline: p.author_headline,
    followers: p.author_followers ?? 0,
    preview: typeof p.text === 'string' ? p.text.slice(0, 300) : '',
    reactions: p.reaction_counter ?? 0,
    date: p.date ?? p.parsed_datetime,
  })),
  null,
  2
)}`,
      },
    ],
  })

  const rawText =
    selectionRes.content[0]?.type === 'text'
      ? selectionRes.content[0].text.trim()
      : '[]'
  const clean = rawText.replace(/```json\n?|```/g, '').trim()

  let opps: DraftedOpp[] = []
  try {
    const parsed = JSON.parse(clean)
    if (Array.isArray(parsed)) opps = parsed as DraftedOpp[]
  } catch (e) {
    console.error('[refreshOpportunities] parse failed', (e as Error).message)
    return 0
  }
  if (opps.length === 0) return 0

  // Build insertion rows with enriched fields
  const rows = opps.map((o) => {
    const sourcePost = filteredPosts.find(
      (p) => (p.id ?? p.social_id) === o.postId
    )
    const handle = (
      (sourcePost as unknown as { author_public_identifier?: string } | undefined)
        ?.author_public_identifier ?? ''
    ).toString()
    const whitelisted = handle && whitelist.has(handle.toLowerCase())
    const baseScore = o.relevanceScore ?? 0.5
    // Whitelisted authors get a small boost so they surface higher
    const relevance = whitelisted ? Math.min(1, baseScore + 0.15) : baseScore

    return {
      user_id: userId,
      linkedin_post_id: o.postId,
      author_name: o.authorName,
      author_headline: o.authorHeadline ?? sourcePost?.author_headline ?? null,
      author_followers: o.authorFollowers ?? 0,
      author_handle: handle || null,
      author_avatar_url: sourcePost?.author_profile_picture_url ?? null,
      linkedin_post_url: sourcePost?.share_url ?? null,
      post_preview: o.postPreview,
      drafted_comment: o.draftedComment,
      relevance_score: relevance,
      matched_pillar: o.matchedPillar ?? null,
      status: 'pending',
    }
  })

  const { data: saved, error } = await supabase
    .from('comment_opportunities')
    .insert(rows)
    .select()

  if (error) {
    console.error('[refreshOpportunities] insert error', error.message)
    throw new Error(error.message)
  }

  console.log(
    '[refreshOpportunities] created',
    saved?.length ?? 0,
    'opportunities'
  )
  return saved?.length ?? 0
}
