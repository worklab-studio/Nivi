import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getEnv } from '@/lib/config'

export interface MemoryImportResult {
  about_you?: string
  your_story?: string
  offers: { name: string; description: string; url?: string }[]
  target_audience: { label: string; description?: string }[]
  personal_info: { key: string; value: string }[]
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[extractIdentityFromMemoryDump] parse failed', e, text.slice(0, 200))
    return null
  }
}

/**
 * Read a ChatGPT/Claude memory dump and extract a full Identity shape:
 * About, Story, Offers, Target Audience, Personal Info.
 */
export async function extractIdentityFromMemoryDump(
  text: string
): Promise<MemoryImportResult | null> {
  if (!text || text.length < 30) return null
  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const response = await anthropic.messages.create({
    model: pickModel('edit-rewrite'),
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `The user pasted a dump of their ChatGPT or Claude memories. Read it carefully and extract everything that defines this person professionally and personally — for use in their personal-brand content writing.

Return ONLY this JSON shape, no prose, no markdown fences:
{
  "about_you": "<3-5 sentence professional background written in first person — leave empty string if not enough info>",
  "your_story": "<3-5 sentence origin/story written in first person — leave empty string if not implied>",
  "offers": [
    { "name": "<product/service/company name>", "description": "<3-5 sentence first-person description of what it does, who it's for, what outcome>", "url": "<optional>" }
  ],
  "target_audience": [
    { "label": "<short audience>", "description": "<one sentence on who they are and what they struggle with>" }
  ],
  "personal_info": [
    { "key": "<short label>", "value": "<the fact in their words>" }
  ]
}

RULES:
- Never invent facts. If a section has nothing, return empty string or empty array.
- Offers: extract every product, service, app, course, business, or company they've mentioned even casually.
- Target audience: who do they help / sell to / write for? Be specific.
- Personal info: location, routines, family, preferences, beliefs, hobbies, anything that humanizes their voice. Up to 20 facts.
- Skip generic AI-style memories like "user is asking about X".

MEMORY DUMP:
${text.slice(0, 12000)}`,
      },
    ],
  })

  const out = response.content[0]?.type === 'text' ? response.content[0].text : ''
  console.log('[extractIdentityFromMemoryDump] response len=', out.length)
  const parsed = safeJson<MemoryImportResult>(out)
  if (!parsed) return null
  return {
    about_you: parsed.about_you ?? '',
    your_story: parsed.your_story ?? '',
    offers: Array.isArray(parsed.offers) ? parsed.offers : [],
    target_audience: Array.isArray(parsed.target_audience) ? parsed.target_audience : [],
    personal_info: Array.isArray(parsed.personal_info) ? parsed.personal_info : [],
  }
}
