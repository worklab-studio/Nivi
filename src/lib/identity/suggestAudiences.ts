import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getEnv } from '@/lib/config'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export interface AudienceSuggestion {
  label: string
  description: string
}

function safeJsonArray<T>(text: string): T[] | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('[')
    const last = clean.lastIndexOf(']')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    const parsed = JSON.parse(clean)
    return Array.isArray(parsed) ? (parsed as T[]) : null
  } catch (e) {
    console.error('[suggestAudiences] parse failed', e, text.slice(0, 200))
    return null
  }
}

export async function suggestAudiences(userId: string): Promise<AudienceSuggestion[]> {
  const supabase = getSupabaseAdmin()
  const { data: identity } = await supabase
    .from('brand_identity')
    .select('about_you, your_story, offers')
    .eq('user_id', userId)
    .maybeSingle()

  const offers = (identity?.offers ?? []) as Array<{ name?: string; description?: string }>
  if (!identity?.about_you && offers.length === 0) {
    console.log('[suggestAudiences] empty identity, skipping')
    return []
  }

  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const response = await anthropic.messages.create({
    model: pickModel('edit-rewrite'),
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Suggest exactly 3 specific target audiences for this person based on their About + Offers. Each audience should be a clear, narrow group (not generic like "professionals").

Return ONLY a JSON array, no prose, no markdown fences:
[{"label":"<short audience>","description":"<one sentence on who they are and what they struggle with>"}]

ABOUT:
${identity?.about_you ?? '(empty)'}

STORY:
${identity?.your_story ?? '(empty)'}

OFFERS:
${offers.map((o, i) => `${i + 1}. ${o.name ?? ''} — ${o.description ?? ''}`).join('\n') || '(none)'}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  console.log('[suggestAudiences] response len=', text.length)
  return safeJsonArray<AudienceSuggestion>(text) ?? []
}
