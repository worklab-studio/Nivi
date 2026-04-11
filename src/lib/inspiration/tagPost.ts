import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getEnv } from '@/lib/config'

export interface PostTags {
  format: string
  topic_pillar: string
  engagement_tier: string
  creator_archetype: string
  hook_score: number
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch {
    return null
  }
}

export async function tagPost(
  content: string,
  authorName: string,
  likes: number
): Promise<PostTags> {
  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const response = await anthropic.messages.create({
    model: pickModel('edit-rewrite'),
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `Tag this LinkedIn post. Return JSON only, no prose:
{
  "format": "hook_story|listicle|contrarian|data_led|confession|thread|observation",
  "topic_pillar": "building_in_public|ai_tools|design_thinking|leadership|saas|personal_growth|marketing|productivity",
  "engagement_tier": "${likes >= 10000 ? 'viral' : likes >= 1000 ? 'strong' : 'solid'}",
  "creator_archetype": "solopreneur|founder|designer|coach|creator|investor",
  "hook_score": 1-10
}

POST: ${content.slice(0, 2000)}
AUTHOR: ${authorName}
LIKES: ${likes}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  const parsed = safeJson<PostTags>(text)
  return parsed ?? {
    format: 'observation',
    topic_pillar: 'personal_growth',
    engagement_tier: likes >= 10000 ? 'viral' : likes >= 1000 ? 'strong' : 'solid',
    creator_archetype: 'creator',
    hook_score: 5,
  }
}
