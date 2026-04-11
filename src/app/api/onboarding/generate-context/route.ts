import { auth } from '@clerk/nextjs/server'
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function parseFile(
  raw: string,
  marker: string,
  nextMarker: string | null
): string {
  const start = raw.indexOf(marker)
  const end = nextMarker ? raw.indexOf(nextMarker) : raw.length
  if (start === -1) return ''
  return raw
    .slice(start + marker.length, end !== -1 ? end : undefined)
    .trim()
}

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()

  // Get all onboarding answers
  const { data: answers } = await supabase
    .from('onboarding_answers')
    .select('step, answers')
    .eq('user_id', userId)

  if (!answers || answers.length === 0) {
    return Response.json(
      { error: 'No onboarding answers found' },
      { status: 400 }
    )
  }

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `You are building 4 COMPACT context files for Nivi (a LinkedIn ghostwriter AI).

IMPORTANT: These files live in the system prompt for every chat turn. Token budget is tight.
TOTAL OUTPUT BUDGET: ~1500 tokens across ALL 4 files. No padding, no headers beyond the markers, no explanations.
Extract only what Nivi needs to WRITE posts in this person's voice — skip teaching theory.

USER PROFILE:
${JSON.stringify(answers, null, 2)}

Output in this EXACT format, nothing else:

=== FILE 1: WRITING STYLE GUIDE ===
(~350 tokens)
- Who they are on LinkedIn in ONE line.
- 4 voice principles as short bullets, each with a 6-10 word example FROM THEIR BACKGROUND.
- Story assets: 5 real experiences they can reference, one line each.
- 3 things they NEVER write.

=== FILE 2: HOOK MECHANICS ===
(~350 tokens)
- For each of 4 hook types — Uncomfortable Truth, Confession, Contrarian Take, Observation — give ONE short example from their real background (max 15 words each).
- Their "almost formula" bank: 4 hooks ready to use, one line each.

=== FILE 3: SENTENCE RHYTHM ===
(~300 tokens)
- The long-short rhythm rule in 2 sentences.
- 3 stacked single-line sequences using their real experiences.
- 4 sentence starters they should use.

=== FILE 4: POST SYSTEM ===
(~500 tokens)
- Their 5 content pillars: one line per pillar based on their answers.
- 3 compact post templates written for THEM (not generic), ~50 words each.
- 3 closing statements they own.

DO NOT exceed these token targets. DO NOT add explanations. DO NOT add "In this file we'll cover..." preambles. OUTPUT ONLY the content itself under each marker.`

  const response = await anthropic.messages.create({
    model: pickModel('onboarding-context'),
    // Budget is ~1500 tokens for content files. Cap at 2500 to leave
    // headroom for markers + slight overruns, but hard-prevent 8k blowups
    // that would bloat the cached system prompt on every chat turn.
    max_tokens: 2500,
    messages: [{ role: 'user', content: prompt }],
  })

  const raw =
    response.content[0].type === 'text' ? response.content[0].text : ''

  const writing_style = parseFile(
    raw,
    '=== FILE 1: WRITING STYLE GUIDE ===',
    '=== FILE 2:'
  )
  const hook_mechanics = parseFile(
    raw,
    '=== FILE 2: HOOK MECHANICS ===',
    '=== FILE 3:'
  )
  const sentence_styling = parseFile(
    raw,
    '=== FILE 3: SENTENCE FORMATION AND STYLING ===',
    '=== FILE 4:'
  )
  const post_system = parseFile(
    raw,
    '=== FILE 4: COMPLETE POST SYSTEM ===',
    null
  )

  // Save to context_files table
  await supabase.from('context_files').upsert(
    {
      user_id: userId,
      writing_style,
      hook_mechanics,
      sentence_styling,
      post_system,
      version: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  // Update onboarding step
  await supabase
    .from('users')
    .update({ onboarding_step: 8 })
    .eq('id', userId)

  return Response.json({
    success: true,
    writing_style,
    hook_mechanics,
    sentence_styling,
    post_system,
  })
}
