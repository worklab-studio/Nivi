import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { createClient } from '@supabase/supabase-js'
import { buildNiviSystemPrompt } from './buildSystemPrompt'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function detectHookType(content: string): string {
  const firstLine = content.split('\n')[0].toLowerCase()
  if (
    firstLine.includes('almost') ||
    firstLine.includes('nearly') ||
    firstLine.includes('about to')
  )
    return 'almost_formula'
  if (
    firstLine.includes('everyone') ||
    firstLine.includes('most people') ||
    firstLine.includes('i went the other')
  )
    return 'contrarian'
  if (
    firstLine.includes('after working with') ||
    firstLine.includes('i noticed') ||
    firstLine.includes('pattern')
  )
    return 'observation'
  if (
    firstLine.includes('i spent') ||
    firstLine.includes('for the first') ||
    firstLine.includes('there was a point')
  )
    return 'confession'
  return 'unknown'
}

export async function generateDailyPost(
  userId: string,
  userHint?: string
) {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const supabase = getSupabase()
  const systemPrompt = await buildNiviSystemPrompt(userId)

  const userContent = userHint
    ? `The user sent this idea/instruction: "${userHint}"\n\nWrite a LinkedIn post based on this. Follow all voice rules.`
    : `Write today's LinkedIn post. Choose the best content pillar and hook type based on recent performance data in your context. Output ONLY the post text \u2014 no explanation, no preamble, no "Here is your post:". Just the post.`

  const response = await anthropic.messages.create({
    model: pickModel('post-generation'),
    max_tokens: 8192,
    system: [
      { type: 'text', text: systemPrompt.static, cache_control: { type: 'ephemeral', ttl: '5m' } },
      { type: 'text', text: systemPrompt.dynamic },
    ],
    messages: [{ role: 'user', content: userContent }],
  })

  const content =
    response.content[0].type === 'text'
      ? response.content[0].text.trim()
      : ''

  const hookType = detectHookType(content)

  const { data: post } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content,
      hook_type: hookType,
      status: 'draft',
    })
    .select()
    .single()

  // Snapshot which memories were in-context when this post was generated.
  // Feeds Tier 2 performance-weighted memory retrieval. Fire-and-forget.
  if (post && systemPrompt.injectedMemoryIds.length > 0) {
    const links = systemPrompt.injectedMemoryIds.map((memory_id) => ({
      post_id: post.id,
      memory_id,
    }))
    supabase
      .from('post_memory_links')
      .insert(links)
      .then(() => {}, () => {})
  }

  return post!
}
