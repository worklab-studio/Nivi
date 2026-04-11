import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getEnv } from '@/lib/config'

export interface LinkedInImportSuggestion {
  about_you: string
  your_story: string
  target_audience_suggestions: { label: string; description?: string }[]
  offer_suggestions: { name: string; description: string; url?: string }[]
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[extractFromLinkedInUrl] parse failed', e, text.slice(0, 200))
    return null
  }
}

/**
 * Fallback LinkedIn import path that doesn't depend on Unipile.
 * Fetches the user's public LinkedIn URL via Jina Reader, then asks Claude
 * to extract Identity sections.
 *
 * LinkedIn often serves a login wall to anonymous fetches, so this is
 * best-effort — it works for fully public profiles.
 */
export async function importFromLinkedInUrl(
  url: string
): Promise<LinkedInImportSuggestion> {
  let normalized = url.trim()
  if (!/^https?:\/\//.test(normalized)) normalized = `https://${normalized}`
  if (!/linkedin\.com\/in\//i.test(normalized)) {
    throw new Error('Please paste a public LinkedIn profile URL (linkedin.com/in/…)')
  }

  let pageText = ''
  try {
    const res = await fetch(`https://r.jina.ai/${normalized}`, {
      headers: { 'X-Return-Format': 'markdown' },
    })
    if (!res.ok) throw new Error(`Jina Reader returned ${res.status}`)
    pageText = await res.text()
    console.log('[importFromLinkedInUrl] jina', normalized, 'len=', pageText.length)
  } catch (e) {
    throw new Error(`Failed to fetch LinkedIn profile: ${(e as Error).message}`)
  }

  if (!pageText || pageText.length < 200) {
    throw new Error(
      'LinkedIn returned a login wall or empty page. Try Auto-fetch from LinkedIn (Unipile) instead.'
    )
  }

  // Heuristic: LinkedIn login walls usually contain "Sign in" + "Join now"
  // and very little real content. If the page looks like a wall, bail early.
  if (
    /sign in to view/i.test(pageText) &&
    /join now/i.test(pageText) &&
    pageText.length < 3000
  ) {
    throw new Error(
      'LinkedIn served a sign-in wall. This profile may not be fully public.'
    )
  }

  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const response = await anthropic.messages.create({
    model: pickModel('edit-rewrite'),
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are populating a personal-brand Identity from a public LinkedIn profile page (fetched as markdown). Be specific and grounded; never invent facts beyond what's provided.

Return ONLY this JSON, no prose, no markdown fences:
{
  "about_you": "<3-5 sentence professional background written in first person — based on the About section + experience>",
  "your_story": "<3-5 sentence origin/story written in first person — only if implied by the experience timeline; otherwise empty string>",
  "target_audience_suggestions": [
    { "label": "<short audience>", "description": "<one sentence>" }
  ],
  "offer_suggestions": [
    { "name": "<offer / product / service / company name>", "description": "<3-5 sentence first-person detailed description>", "url": "<optional>" }
  ]
}

LINKEDIN PROFILE PAGE (markdown):
${pageText.slice(0, 12000)}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  console.log('[importFromLinkedInUrl] response len=', text.length)
  const parsed = safeJson<LinkedInImportSuggestion>(text)
  if (!parsed) throw new Error('Claude returned unparseable response')
  return {
    about_you: parsed.about_you ?? '',
    your_story: parsed.your_story ?? '',
    target_audience_suggestions: Array.isArray(parsed.target_audience_suggestions)
      ? parsed.target_audience_suggestions
      : [],
    offer_suggestions: Array.isArray(parsed.offer_suggestions)
      ? parsed.offer_suggestions
      : [],
  }
}
