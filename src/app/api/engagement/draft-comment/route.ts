import { auth } from '@clerk/nextjs/server'
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'

/**
 * On-demand comment drafting.
 * Called when the user clicks "Draft comment" on a specific post.
 * Only generates one comment at a time — no batch pre-drafting.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { opportunityId } = await req.json()
  if (!opportunityId) {
    return Response.json({ error: 'Missing opportunityId' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Load the opportunity
  const { data: opp } = await supabase
    .from('comment_opportunities')
    .select('*')
    .eq('id', opportunityId)
    .eq('user_id', userId)
    .single()

  if (!opp) {
    return Response.json({ error: 'Opportunity not found' }, { status: 404 })
  }

  // Load pillars
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

  // Build system prompt with user's voice
  const systemPrompt = await buildNiviSystemPrompt(userId, opp.post_preview ?? '')

  const anthropic = new Anthropic()
  const response = await anthropic.messages.create({
    model: pickModel('comment-generation'),
    max_tokens: 1024,
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
        content: `Draft a voice-matched LinkedIn comment for this post.

AUTHOR: ${opp.author_name ?? 'Unknown'}${opp.author_headline ? ` — ${opp.author_headline}` : ''}

POST:
"${(opp.post_preview ?? '').slice(0, 800)}"

Rules:
- 3–5 sentences, sounds exactly like the user wrote it
- Add genuine value from their real experience — not generic agreement
- Never start with "Great post!" / "I totally agree" / "Love this!" / "This is amazing" / "This resonates"
- End with something that invites a reply (a question, a challenge, a specific ask)
- Match the best content pillar if applicable

Content pillars:
${pillarBlock}

Return ONLY JSON:
{"drafted_comment": "the full comment text", "relevance_score": 0.85, "matched_pillar": "pillar name or null"}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  let draftedComment = ''
  let relevanceScore = 0.5
  let matchedPillar: string | null = null

  try {
    const clean = text.replace(/```json\n?|```/g, '').trim()
    const parsed = JSON.parse(clean)
    draftedComment = parsed.drafted_comment ?? ''
    relevanceScore = parsed.relevance_score ?? 0.5
    matchedPillar = parsed.matched_pillar ?? null
  } catch {
    // If JSON parse fails, use the raw text as the comment
    draftedComment = text.trim()
  }

  if (!draftedComment) {
    return Response.json({ error: 'Could not generate comment' }, { status: 500 })
  }

  // Save to DB
  await supabase
    .from('comment_opportunities')
    .update({
      drafted_comment: draftedComment,
      relevance_score: relevanceScore,
      matched_pillar: matchedPillar,
    })
    .eq('id', opportunityId)

  return Response.json({
    ok: true,
    drafted_comment: draftedComment,
    relevance_score: relevanceScore,
    matched_pillar: matchedPillar,
  })
}
