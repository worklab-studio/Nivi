import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { createClient } from '@supabase/supabase-js'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'
import { sendWhatsApp } from '@/lib/whatsapp/send'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function sendWeeklySummary(userId: string): Promise<void> {
  const supabase = getSupabase()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (!user?.whatsapp_number) return

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: weekPosts } = await supabase
    .from('posts')
    .select('*, post_analytics(*)')
    .eq('user_id', userId)
    .eq('status', 'published')
    .gte('published_at', weekAgo)
    .order('published_at', { ascending: false })

  if (!weekPosts || weekPosts.length === 0) {
    await sendWhatsApp(
      user.whatsapp_number,
      `\ud83d\udcca No posts this week, ${user.name}.\n\nYour audience forgets after 3 days of silence. I have a post ready \u2014 just reply POST.`
    )
    return
  }

  const totalImpressions = weekPosts.reduce(
    (sum, p) => sum + (p.post_analytics?.[0]?.impressions ?? 0),
    0
  )
  const totalLikes = weekPosts.reduce(
    (sum, p) => sum + (p.post_analytics?.[0]?.likes ?? 0),
    0
  )
  const totalComments = weekPosts.reduce(
    (sum, p) => sum + (p.post_analytics?.[0]?.comments ?? 0),
    0
  )

  const bestPost = [...weekPosts].sort(
    (a, b) =>
      (b.post_analytics?.[0]?.impressions ?? 0) -
      (a.post_analytics?.[0]?.impressions ?? 0)
  )[0]

  const systemPrompt = await buildNiviSystemPrompt(userId)

  const summaryRes = await anthropic.messages.create({
    model: pickModel('weekly-summary'),
    max_tokens: 8192,
    system: [
      { type: 'text', text: systemPrompt.static, cache_control: { type: 'ephemeral', ttl: '5m' } },
      { type: 'text', text: systemPrompt.dynamic },
    ],
    messages: [
      {
        role: 'user',
        content: `Write ${user.name}'s weekly LinkedIn performance summary.
Data:
- Posts published: ${weekPosts.length}
- Total impressions: ${totalImpressions.toLocaleString()}
- Total likes: ${totalLikes}
- Total comments: ${totalComments}
- Best post preview: "${bestPost?.content?.slice(0, 100)}"
- Best post impressions: ${bestPost?.post_analytics?.[0]?.impressions ?? 0}
- Streak: ${user.streak_count} days

Include: best post callout, key pattern observed, one specific recommendation for next week.
Sound like Nivi \u2014 direct, invested, specific. Max 5 sentences. No bullet points.
Output ONLY the summary text.`,
      },
    ],
  })

  const summary =
    summaryRes.content[0].type === 'text'
      ? summaryRes.content[0].text.trim()
      : ''

  await sendWhatsApp(
    user.whatsapp_number,
    `\ud83d\udcca Week in review\n\n${summary}\n\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\nPosts: ${weekPosts.length}\nImpressions: ${totalImpressions.toLocaleString()}\nLikes: ${totalLikes.toLocaleString()}\nComments: ${totalComments.toLocaleString()}\nStreak: ${user.streak_count} days\n\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n\nFull analytics: nivi.app/analytics`
  )
}
