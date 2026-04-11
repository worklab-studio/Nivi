import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getEnv } from '@/lib/config'
import { getLinkedInRichProfile } from '@/lib/unipile/linkedin'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

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
    console.error('[extractFromLinkedIn] parse failed', e, text.slice(0, 200))
    return null
  }
}

export async function importFromLinkedIn(
  userId: string
): Promise<LinkedInImportSuggestion> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('unipile_account_id')
    .eq('id', userId)
    .single()

  if (!user?.unipile_account_id) {
    throw new Error('No LinkedIn account connected. Connect Unipile in Settings.')
  }

  const profile = await getLinkedInRichProfile(user.unipile_account_id)

  // Also cache name/headline to users table for compose preview
  // (getCachedLinkedInProfile reads from here)
  if (profile.name && profile.name !== 'LinkedIn user') {
    await supabase
      .from('users')
      .update({
        linkedin_display_name: profile.name,
        linkedin_headline: profile.headline || null,
        linkedin_profile_fetched_at: new Date().toISOString(),
      })
      .eq('id', userId)
  }

  const expBlock = profile.experience
    .slice(0, 5)
    .map(
      (e, i) =>
        `${i + 1}. ${e.title} at ${e.company}${e.start ? ` (${e.start}${e.end ? ` – ${e.end}` : ' – present'})` : ''}${e.description ? `\n   ${e.description.slice(0, 300)}` : ''}`
    )
    .join('\n')

  const eduBlock = profile.education
    .slice(0, 3)
    .map((e) => `- ${e.school}${e.degree ? `, ${e.degree}` : ''}${e.field ? ` in ${e.field}` : ''}`)
    .join('\n')

  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const response = await anthropic.messages.create({
    model: pickModel('edit-rewrite'),
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are populating a personal-brand Identity from a real LinkedIn profile. Be specific and grounded; never invent facts beyond what's provided.

Return ONLY this JSON, no prose, no markdown fences:
{
  "about_you": "<3-5 sentence professional background written in first person — based on summary + experience>",
  "your_story": "<3-5 sentence origin/story written in first person — only if implied by the experience timeline; otherwise empty string>",
  "target_audience_suggestions": [
    { "label": "<short audience>", "description": "<one sentence>" }
  ],
  "offer_suggestions": [
    { "name": "<offer / product / service / company name>", "description": "<3-5 sentence first-person detailed description>", "url": "<optional>" }
  ]
}

LINKEDIN PROFILE:
Name: ${profile.name}
Headline: ${profile.headline}
Location: ${profile.location}
Profile URL: ${profile.profileUrl}

LINKEDIN ABOUT (summary):
${profile.summary || '(empty)'}

EXPERIENCE:
${expBlock || '(none)'}

EDUCATION:
${eduBlock || '(none)'}

SKILLS:
${profile.skills.slice(0, 15).join(', ') || '(none)'}

ORGANIZATIONS:
${profile.organizations.map((o) => o.name).join(', ') || '(none)'}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  console.log('[extractFromLinkedIn] response len=', text.length)
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
