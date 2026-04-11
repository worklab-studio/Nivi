import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export async function postToX(
  userId: string,
  linkedinPost: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (!user?.x_account_id || user.plan === 'starter') return

  // Adapt for X character limit
  const adaptRes = await anthropic.messages.create({
    model: pickModel('post-generation'),
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `Adapt this LinkedIn post for X (Twitter).
Keep the core insight. Max 280 characters.
Keep the exact same voice and tone.
Add 2-3 relevant hashtags at the end.
Output ONLY the tweet text. No explanation.

LinkedIn post:
${linkedinPost}`,
      },
    ],
  })

  const tweet =
    adaptRes.content[0].type === 'text'
      ? adaptRes.content[0].text.trim()
      : ''
  if (!tweet) return

  await fetch(`${process.env.UNIPILE_BASE_URL}/api/v1/posts`, {
    method: 'POST',
    headers: {
      'X-API-KEY': process.env.UNIPILE_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account_id: user.x_account_id,
      text: tweet,
      provider: 'TWITTER',
    }),
  })

  if (user.whatsapp_number) {
    await sendWhatsApp(
      user.whatsapp_number,
      `\u2705 Also posted to X:\n\n"${tweet.slice(0, 100)}${tweet.length > 100 ? '...' : ''}"`
    )
  }
}
