import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { createClient } from '@supabase/supabase-js'
import { generateDailyPost } from '@/lib/claude/generatePost'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'
import { sendWhatsApp } from '@/lib/whatsapp/send'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function sendMorningBrief(userId: string): Promise<void> {
  const supabase = getSupabase()
  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()
  if (!user?.whatsapp_number) return

  // Generate today's post
  const post = await generateDailyPost(userId)

  // Generate Nivi's brief message
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const systemPrompt = await buildNiviSystemPrompt(userId)

  const briefRes = await anthropic.messages.create({
    model: pickModel('morning-brief'),
    max_tokens: 8192,
    system: [
      { type: 'text', text: systemPrompt.static, cache_control: { type: 'ephemeral', ttl: '5m' } },
      { type: 'text', text: systemPrompt.dynamic },
    ],
    messages: [
      {
        role: 'user',
        content: `Write a 2-sentence morning message for ${user.name}.
Reference something specific from their recent performance data.
Sound warm and invested \u2014 like Nivi genuinely cares about their growth.
DO NOT mention the post content. DO NOT include the post here.
Output ONLY the 2 sentences. Nothing else.`,
      },
    ],
  })

  const brief =
    briefRes.content[0].type === 'text'
      ? briefRes.content[0].text.trim()
      : ''

  const message = `Good morning ${user.name} \u2600\ufe0f

${brief}

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
${post.content}
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

Reply:
POST \u2014 publish now
SCHEDULE [time] \u2014 e.g. SCHEDULE 3PM
EDIT: [notes] \u2014 e.g. EDIT: make it shorter
SKIP \u2014 save for later`

  await sendWhatsApp(user.whatsapp_number, message)

  // Update streak
  await supabase
    .from('users')
    .update({ streak_count: (user.streak_count ?? 0) + 1 })
    .eq('id', userId)
}
