import { createClient } from '@supabase/supabase-js'
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'
import { syncPostAnalytics } from '@/lib/unipile/analytics'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function getUserByUnipileAccount(accountId: string) {
  const supabase = getSupabase()
  const { data } = await supabase
    .from('users')
    .select('*')
    .eq('unipile_account_id', accountId)
    .single()
  return data
}

export async function POST(req: Request) {
  const event = await req.json()
  const supabase = getSupabase()

  switch (event.type) {
    case 'post_reaction':
    case 'post_comment_received':
    case 'post_impression': {
      // Sync analytics for this post
      if (event.post_id && event.account_id) {
        await syncPostAnalytics(event.post_id, event.account_id)
      }

      // Check for milestone notifications
      if (event.post_id && event.account_id) {
        const user = await getUserByUnipileAccount(event.account_id)
        if (user?.whatsapp_number) {
          const { data: post } = await supabase
            .from('posts')
            .select('id, content')
            .eq('linkedin_post_id', event.post_id)
            .single()

          if (post) {
            const { data: analytics } = await supabase
              .from('post_analytics')
              .select('impressions, likes')
              .eq('post_id', post.id)
              .single()

            // Milestone notifications
            const impressions = analytics?.impressions ?? 0
            const milestones = [100, 500, 1000, 5000, 10000]
            const previousImpressions = impressions - (event.delta ?? 1)

            for (const milestone of milestones) {
              if (impressions >= milestone && previousImpressions < milestone) {
                await sendWhatsApp(
                  user.whatsapp_number,
                  `\ud83d\ude80 Your post just hit ${milestone.toLocaleString()} impressions.\n"${post.content?.slice(0, 60)}..."\n\nSee full analytics: nivi.app/analytics`
                )
                break
              }
            }
          }
        }
      }
      break
    }

    case 'comment_on_post': {
      // Someone commented on user's post — draft a reply
      const user = await getUserByUnipileAccount(event.account_id)
      if (!user?.whatsapp_number) break

      const { data: post } = await supabase
        .from('posts')
        .select('content')
        .eq('linkedin_post_id', event.post_id)
        .single()

      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
      })
      const systemPrompt = await buildNiviSystemPrompt(user.id)

      const replyRes = await anthropic.messages.create({
        model: pickModel('comment-digest'),
        max_tokens: 8192,
        system: [
          { type: 'text', text: systemPrompt.static, cache_control: { type: 'ephemeral', ttl: '5m' } },
          { type: 'text', text: systemPrompt.dynamic },
        ],
        messages: [
          {
            role: 'user',
            content: `${event.commenter_name} commented on your post: "${event.comment_text}"
Your original post: "${post?.content?.slice(0, 200) ?? ''}"
Write a genuine reply in your voice. 2-3 sentences max. Adds value. Warm but not sycophantic.
Output ONLY the reply text.`,
          },
        ],
      })

      const reply =
        replyRes.content[0].type === 'text'
          ? replyRes.content[0].text.trim()
          : ''

      // Store pending reply
      await supabase.from('comment_opportunities').insert({
        user_id: user.id,
        linkedin_post_id: event.post_id,
        author_name: event.commenter_name,
        post_preview: (event.comment_text ?? '').slice(0, 200),
        drafted_comment: reply,
        status: 'pending',
      })

      await sendWhatsApp(
        user.whatsapp_number,
        `\ud83d\udcac New comment from ${event.commenter_name}:\n"${event.comment_text}"\n\nSuggested reply:\n${reply}\n\nReply R1 to post | SKIP to ignore`
      )
      break
    }
  }

  return Response.json({ ok: true })
}
