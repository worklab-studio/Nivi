import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'
import { getEnv } from '@/lib/config'

interface Target {
  id: string
  linkedin_url: string
  author_handle: string | null
  author_name: string | null
  author_headline: string | null
  avatar_url: string | null
}

interface DraftedOpp {
  post_body: string
  preview: string
  drafted_comment: string
  relevance_score: number
  matched_pillar: string | null
  post_url?: string
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[refreshFromTargets] parse failed', (e as Error).message)
    return null
  }
}

async function fetchTargetPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'X-Return-Format': 'markdown' },
    })
    if (!res.ok) {
      console.warn('[refreshFromTargets] jina', url, res.status)
      return null
    }
    const text = await res.text()
    if (!text || text.length < 200) return null
    // Detect login walls
    if (
      /sign in to view/i.test(text) &&
      /join now/i.test(text) &&
      text.length < 3000
    ) {
      return null
    }
    return text
  } catch (e) {
    console.warn('[refreshFromTargets] jina threw', (e as Error).message)
    return null
  }
}

async function extractDraftsForTarget(
  anthropic: Anthropic,
  systemPrompt: { static: string; dynamic: string },
  target: Target,
  pageText: string,
  pillars: Array<{ name: string; description: string }>
): Promise<DraftedOpp[]> {
  const pillarBlock =
    pillars.length > 0
      ? pillars.map((p, i) => `${i + 1}. ${p.name} — ${p.description}`).join('\n')
      : '(no pillars set)'

  const response = await anthropic.messages.create({
    model: pickModel('comment-generation'),
    max_tokens: 2048,
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
        content: `You are scanning a LinkedIn profile page (fetched as markdown) to find the author's 1–2 most recent posts and draft a voice-matched comment for each.

AUTHOR: ${target.author_name ?? target.author_handle ?? 'Unknown'}${target.author_headline ? ` — ${target.author_headline}` : ''}

Rules:
- Find up to 2 posts near the top of the feed/activity section. Skip comments on other posts, reshares without commentary, promotions, and navigation.
- For each post, produce:
  - post_body: the FULL post text verbatim (preserve line breaks)
  - preview: first 180 chars cleaned up
  - relevance_score: 0.0–1.0, how well the topic matches one of the user's content pillars
  - matched_pillar: the exact pillar name that matches best, or null
  - drafted_comment: a voice-matched comment (3–5 sentences, follows the voice DNA in the system prompt, never starts with "Great post!" / "I totally agree" / "Love this!", invites a reply)
  - post_url: the post's permalink if visible in the markdown, else omit

Content pillars for relevance matching:
${pillarBlock}

Return ONLY this JSON, no prose, no markdown fences:
{
  "posts": [
    {
      "post_body": "full verbatim text",
      "preview": "first 180 chars",
      "relevance_score": 0.87,
      "matched_pillar": "Pillar name or null",
      "drafted_comment": "the full comment",
      "post_url": "optional"
    }
  ]
}

If the page has no extractable posts (login wall, empty feed), return {"posts": []}.

PROFILE PAGE CONTENT:
${pageText.slice(0, 10000)}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = safeJson<{ posts: DraftedOpp[] }>(text)
  if (!parsed?.posts || !Array.isArray(parsed.posts)) return []
  return parsed.posts.slice(0, 2).map((p) => ({
    post_body: p.post_body ?? '',
    preview: p.preview ?? p.post_body?.slice(0, 180) ?? '',
    relevance_score: typeof p.relevance_score === 'number' ? p.relevance_score : 0.5,
    matched_pillar: p.matched_pillar ?? null,
    drafted_comment: p.drafted_comment ?? '',
    post_url: p.post_url,
  }))
}

/**
 * Jina-Reader-backed engagement refresh. Iterates whitelisted targets,
 * scrapes each target's LinkedIn profile via Jina, uses Claude to extract
 * recent posts + draft voice-matched comments, dedupes against the last 48h,
 * inserts into comment_opportunities.
 *
 * Returns { created, skippedTargets }.
 */
export async function refreshFromTargets(
  userId: string
): Promise<{ created: number; skippedTargets: number }> {
  const supabase = getSupabaseAdmin()

  const { data: targetsRaw } = await supabase
    .from('engagement_targets')
    .select('*')
    .eq('user_id', userId)
    .eq('mode', 'whitelist')
    .order('created_at', { ascending: false })
    .limit(10)

  const targets = (targetsRaw ?? []) as Target[]
  if (targets.length === 0) {
    throw new Error(
      'Add targets first in the Targets tab, or paste a LinkedIn post URL via Add from URL.'
    )
  }

  // Load pillars once for relevance matching
  const { data: identity } = await supabase
    .from('brand_identity')
    .select('content_pillars')
    .eq('user_id', userId)
    .maybeSingle()
  const pillars = (identity?.content_pillars ?? []) as Array<{
    name: string
    description: string
  }>

  // Load recent previews for 48h de-dup
  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString()
  const { data: recentRaw } = await supabase
    .from('comment_opportunities')
    .select('post_preview')
    .eq('user_id', userId)
    .gte('created_at', cutoff)

  const recentPreviews = new Set(
    (recentRaw ?? [])
      .map((r) => (r.post_preview ?? '').slice(0, 80).toLowerCase().trim())
      .filter(Boolean)
  )

  const systemPrompt = await buildNiviSystemPrompt(userId)
  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })

  const rowsToInsert: Record<string, unknown>[] = []
  let skippedTargets = 0

  for (const target of targets) {
    console.log('[refreshFromTargets] scanning', target.author_name ?? target.linkedin_url)
    const page = await fetchTargetPage(target.linkedin_url)
    if (!page) {
      skippedTargets++
      continue
    }

    let drafts: DraftedOpp[] = []
    try {
      drafts = await extractDraftsForTarget(
        anthropic,
        systemPrompt,
        target,
        page,
        pillars
      )
    } catch (e) {
      console.error('[refreshFromTargets] draft failed', (e as Error).message)
      skippedTargets++
      continue
    }

    for (const d of drafts) {
      if (!d.post_body || !d.drafted_comment) continue
      const key = d.preview.slice(0, 80).toLowerCase().trim()
      if (recentPreviews.has(key)) continue // dedupe
      recentPreviews.add(key)

      // Whitelist +15% relevance boost, capped at 1.0
      const boosted = Math.min(1, d.relevance_score + 0.15)

      rowsToInsert.push({
        user_id: userId,
        linkedin_post_id: d.post_url ?? `jina-${target.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        author_name: target.author_name ?? target.author_handle,
        author_headline: target.author_headline,
        author_followers: null,
        author_handle: target.author_handle,
        author_avatar_url: target.avatar_url,
        linkedin_post_url: d.post_url ?? null,
        post_preview: d.post_body.slice(0, 500),
        drafted_comment: d.drafted_comment,
        relevance_score: boosted,
        matched_pillar: d.matched_pillar,
        status: 'pending',
      })
    }
  }

  if (rowsToInsert.length === 0) {
    return { created: 0, skippedTargets }
  }

  const { error } = await supabase
    .from('comment_opportunities')
    .insert(rowsToInsert)

  if (error) {
    console.error('[refreshFromTargets] insert error', error.message)
    throw new Error(error.message)
  }

  console.log(
    '[refreshFromTargets] created',
    rowsToInsert.length,
    'opportunities · skipped',
    skippedTargets,
    'targets'
  )
  return { created: rowsToInsert.length, skippedTargets }
}
