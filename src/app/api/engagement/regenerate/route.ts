import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'
import { getEnv } from '@/lib/config'

type Angle = 'fresh' | 'shorter' | 'contrarian' | 'story'

const ANGLE_INSTRUCTIONS: Record<Angle, string> = {
  fresh:
    'Write a completely different angle than the current draft. New hook, new structure, new insight. Still sounds like the user.',
  shorter:
    'Trim by ~40%. Same angle, same insight, but compressed to 2-3 sentences max. Every word earns its place.',
  contrarian:
    'Push back on the premise of the original post. Disagree with one specific thing, back it up with a real reason from the user\'s experience. Respectful but sharp.',
  story:
    'Replace the insight with a short concrete story or anecdote from the user\'s real experience. 3-4 sentences: setup → specific moment → takeaway.',
}

export async function POST(req: Request) {
  console.log('[engagement/regenerate] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const opportunityId: string | undefined = body?.opportunityId
    const angle: Angle = (body?.angle ?? 'fresh') as Angle
    if (!opportunityId) {
      return Response.json(
        { ok: false, error: 'opportunityId required' },
        { status: 400 }
      )
    }
    if (!ANGLE_INSTRUCTIONS[angle]) {
      return Response.json(
        { ok: false, error: 'Invalid angle' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    const { data: opp } = await supabase
      .from('comment_opportunities')
      .select(
        'id, user_id, author_name, author_headline, post_preview, drafted_comment, matched_pillar'
      )
      .eq('id', opportunityId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!opp) {
      return Response.json(
        { ok: false, error: 'Opportunity not found' },
        { status: 404 }
      )
    }

    const systemPrompt = await buildNiviSystemPrompt(userId)
    const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })

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
          content: `Rewrite a LinkedIn comment draft with a specific angle twist.

ORIGINAL POST (by ${opp.author_name ?? 'someone'}${opp.author_headline ? ` — ${opp.author_headline}` : ''}):
"${opp.post_preview ?? ''}"

CURRENT DRAFT:
${opp.drafted_comment ?? ''}

ANGLE: ${angle}
INSTRUCTIONS: ${ANGLE_INSTRUCTIONS[angle]}

${opp.matched_pillar ? `This comment aligns with the user's content pillar: "${opp.matched_pillar}". Lean into the audience pain and moat of that pillar if it fits naturally.` : ''}

Rules:
- Match the user's voice DNA (hook, sentence rhythm, vocabulary signature) as defined in the system prompt
- Never start with "Great post!" / "I totally agree" / "This is amazing" / "Love this!"
- Never use em dashes. Never use banned phrases from the user's writing preferences.
- Output ONLY the new comment text, nothing else. No preamble, no explanation, no quotes.`,
        },
      ],
    })

    const draftedComment =
      response.content[0]?.type === 'text'
        ? response.content[0].text.trim().replace(/^["']|["']$/g, '')
        : ''

    if (!draftedComment) {
      return Response.json(
        { ok: false, error: 'Claude returned empty comment' },
        { status: 502 }
      )
    }

    await supabase
      .from('comment_opportunities')
      .update({ drafted_comment: draftedComment })
      .eq('id', opportunityId)
      .eq('user_id', userId)

    return Response.json({ ok: true, drafted_comment: draftedComment })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[engagement/regenerate] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
