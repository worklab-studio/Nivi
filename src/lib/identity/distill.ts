import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'

export interface IdentityFacets {
  positioning?: string
  voice_traits?: string[]
  differentiators?: string[]
  proof_points?: string[]
  audience_pains?: string[]
  offer_outcomes?: string[]
}

export interface DistillResult {
  identity_summary: string
  identity_facets: IdentityFacets
}

function isEmpty(s?: string | null) {
  return !s || s.trim().length === 0
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    // Strip any preamble before the first { and trailing junk after last }
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[identity safeJson] parse failed', e, text.slice(0, 200))
    return null
  }
}

/**
 * Read brand_identity, distill into a tight summary + structured facets,
 * persist back to brand_identity. Idempotent and safe to call after every PATCH.
 */
export async function distillIdentity(userId: string): Promise<DistillResult | null> {
  const supabase = getSupabaseAdmin()
  const { data: identity } = await supabase
    .from('brand_identity')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (!identity) return null

  const offers = (identity.offers ?? []) as Array<{ name?: string; description?: string; url?: string }>
  const audience = (identity.target_audience ?? []) as Array<{ label?: string; description?: string }>
  const personal = (identity.personal_info ?? []) as Array<{ key?: string; value?: string }>

  // Skip if everything is empty — nothing to distill
  if (
    isEmpty(identity.about_you) &&
    isEmpty(identity.your_story) &&
    offers.length === 0 &&
    audience.length === 0 &&
    personal.length === 0
  ) {
    return null
  }

  const sourceBlock = [
    `ABOUT YOU:\n${identity.about_you ?? '(empty)'}`,
    `\nYOUR STORY:\n${identity.your_story ?? '(empty)'}`,
    `\nOFFERS:\n${
      offers.length
        ? offers
            .map(
              (o, i) =>
                `${i + 1}. ${o.name ?? '(unnamed)'} — ${o.description ?? ''}${
                  o.url ? ` [${o.url}]` : ''
                }`
            )
            .join('\n')
        : '(none)'
    }`,
    `\nTARGET AUDIENCE:\n${
      audience.length
        ? audience.map((a) => `- ${a.label ?? ''}${a.description ? `: ${a.description}` : ''}`).join('\n')
        : '(none)'
    }`,
    `\nPERSONAL INFO:\n${
      personal.length
        ? personal.map((p) => `- ${p.key ?? ''}: ${p.value ?? ''}`).join('\n')
        : '(none)'
    }`,
  ].join('\n')

  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const response = await anthropic.messages.create({
    model: pickModel('edit-rewrite'),
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are Nivi's Identity distiller. Read the user's Identity sections and produce a single tight voice + positioning spec the post-writer will use as ground truth.

Return JSON only, no prose:
{
  "identity_summary": "<300-400 words, third-person, dense, no fluff. Captures who they are, what they sell, who they help, how they speak, and what makes them different.>",
  "identity_facets": {
    "positioning": "<one sentence>",
    "voice_traits": ["...", "..."],
    "differentiators": ["...", "..."],
    "proof_points": ["...", "..."],
    "audience_pains": ["...", "..."],
    "offer_outcomes": ["...", "..."]
  }
}

Rules:
- Never invent facts not present in the source sections.
- Prefer specifics (numbers, named outcomes) over adjectives.
- Voice traits = how they speak, not what they do.

SOURCE:
${sourceBlock}`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  const parsed = safeJson<DistillResult>(text)
  if (!parsed || !parsed.identity_summary) return null

  await supabase
    .from('brand_identity')
    .update({
      identity_summary: parsed.identity_summary,
      identity_facets: parsed.identity_facets ?? {},
      summary_updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return parsed
}
