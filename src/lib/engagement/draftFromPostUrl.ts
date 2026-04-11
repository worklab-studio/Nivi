import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'
import { getEnv } from '@/lib/config'

interface ExtractedPost {
  author_name: string
  author_headline: string
  author_avatar_url: string | null
  post_body: string
  drafted_comment: string
  relevance_score: number
  matched_pillar: string | null
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[draftFromPostUrl] parse failed', (e as Error).message)
    return null
  }
}

function findAvatarUrl(markdown: string): string | null {
  const m = markdown.match(
    /https:\/\/media\.licdn\.com\/dms\/image\/[^\s)"'<>]*profile-displayphoto[^\s)"'<>]+/
  )
  return m?.[0] ?? null
}

/**
 * Fetch a single LinkedIn post URL via Jina Reader, use Claude Sonnet to
 * extract the post body + author metadata + draft a voice-matched comment,
 * then insert into comment_opportunities.
 *
 * Returns the newly inserted opportunity row.
 */
export async function draftFromPostUrl(
  userId: string,
  url: string
): Promise<Record<string, unknown>> {
  let normalized = url.trim()
  if (!/^https?:\/\//.test(normalized)) normalized = `https://${normalized}`
  if (!/linkedin\.com/i.test(normalized)) {
    throw new Error('Please paste a LinkedIn post URL (linkedin.com/posts/...)')
  }

  // Fetch via Jina
  let pageText = ''
  try {
    const res = await fetch(`https://r.jina.ai/${normalized}`, {
      headers: { 'X-Return-Format': 'markdown' },
    })
    if (!res.ok) throw new Error(`Jina Reader returned ${res.status}`)
    pageText = await res.text()
  } catch (e) {
    throw new Error(`Failed to fetch post: ${(e as Error).message}`)
  }

  if (!pageText || pageText.length < 200) {
    throw new Error('LinkedIn returned a login wall or empty page.')
  }

  const avatarUrl = findAvatarUrl(pageText)

  // Load pillars for matching
  const supabase = getSupabaseAdmin()
  const { data: identity } = await supabase
    .from('brand_identity')
    .select('content_pillars')
    .eq('user_id', userId)
    .maybeSingle()
  const pillars = (identity?.content_pillars ?? []) as Array<{
    name: string
    description: string
  }>
  const pillarBlock =
    pillars.length > 0
      ? pillars.map((p, i) => `${i + 1}. ${p.name} — ${p.description}`).join('\n')
      : '(no pillars set)'

  const systemPrompt = await buildNiviSystemPrompt(userId)
  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })

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
        content: `You are extracting a single LinkedIn post from a Jina-scraped markdown page and drafting a voice-matched comment.

Find the main post body (NOT comments, NOT related posts, NOT navigation). It's usually the longest contiguous block of text by the author at the top.

Return ONLY this JSON, no prose, no markdown fences:
{
  "author_name": "full author name",
  "author_headline": "LinkedIn headline or short descriptor",
  "post_body": "the FULL post text, verbatim, preserving line breaks",
  "drafted_comment": "voice-matched comment — 3-5 sentences, never starts with 'Great post!' / 'I totally agree' / 'Love this!', matches the voice DNA in the system prompt, invites a reply",
  "relevance_score": 0.0 to 1.0 scoring how well the post topic matches one of the user's pillars,
  "matched_pillar": "exact pillar name that matches best, or null"
}

Content pillars for relevance matching:
${pillarBlock}

If the page is a login wall or you can't find a post body, return {"error":"no post found"}.

PAGE CONTENT:
${pageText.slice(0, 12000)}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = safeJson<ExtractedPost & { error?: string }>(text)
  if (!parsed || parsed.error || !parsed.post_body || !parsed.drafted_comment) {
    throw new Error(
      parsed?.error ?? 'Could not extract a post from this URL'
    )
  }

  const { data: inserted, error } = await supabase
    .from('comment_opportunities')
    .insert({
      user_id: userId,
      linkedin_post_id: `url-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      author_name: parsed.author_name,
      author_headline: parsed.author_headline,
      author_avatar_url: avatarUrl,
      author_followers: null,
      linkedin_post_url: normalized,
      post_preview: parsed.post_body.slice(0, 500),
      drafted_comment: parsed.drafted_comment,
      relevance_score: Math.max(0.8, Math.min(1, parsed.relevance_score ?? 0.85)),
      matched_pillar: parsed.matched_pillar ?? null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    throw new Error(`DB insert failed: ${error.message}`)
  }
  return inserted as Record<string, unknown>
}
