import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getEnv } from '@/lib/config'

/**
 * Check user's published posts for new comments and send a digest with drafted replies.
 * Can be triggered by cron or on-demand via WhatsApp.
 */
export async function checkAndSendCommentDigest(userId: string): Promise<string> {
  const supabase = getSupabaseAdmin()
  const baseUrl = getEnv('UNIPILE_BASE_URL')
  const apiKey = getEnv('UNIPILE_API_KEY')

  const { data: user } = await supabase
    .from('users')
    .select('whatsapp_number, unipile_account_id, name')
    .eq('id', userId)
    .single()

  if (!user?.unipile_account_id || !user?.whatsapp_number) {
    return 'LinkedIn or WhatsApp not connected'
  }

  // Get user's recent published posts
  const { data: posts } = await supabase
    .from('posts')
    .select('id, content, linkedin_post_id')
    .eq('user_id', userId)
    .eq('status', 'published')
    .not('linkedin_post_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(5)

  if (!posts || posts.length === 0) return 'No published posts to check'

  // Get own provider ID to filter out own comments
  const profileRes = await fetch(
    `${baseUrl}/api/v1/users/me?account_id=${user.unipile_account_id}`,
    { headers: { 'X-API-KEY': apiKey, accept: 'application/json' } }
  )
  const profile = await profileRes.json()
  const ownId = profile.provider_id ?? ''

  const newComments: {
    postPreview: string
    authorName: string
    commentText: string
    postUrn: string
  }[] = []

  for (const post of posts) {
    const postUrn = post.linkedin_post_id?.startsWith('urn:')
      ? post.linkedin_post_id
      : `urn:li:activity:${post.linkedin_post_id}`

    try {
      const commentsRes = await fetch(
        `${baseUrl}/api/v1/posts/${encodeURIComponent(postUrn)}/comments?account_id=${user.unipile_account_id}`,
        {
          headers: { 'X-API-KEY': apiKey, accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        }
      )
      if (!commentsRes.ok) continue

      const data = await commentsRes.json()
      const comments = data.items ?? []

      // Filter: not our own, not already seen
      for (const c of comments.slice(-10)) {
        const isOwn = c.author?.id === ownId
        if (!isOwn && c.text && c.text.length > 5) {
          newComments.push({
            postPreview: post.content?.slice(0, 60) ?? '',
            authorName: c.author?.name ?? 'someone',
            commentText: c.text.slice(0, 200),
            postUrn,
          })
        }
      }
    } catch { /* timeout */ }
  }

  if (newComments.length === 0) return 'No new comments on your posts'

  // Draft replies with Claude
  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const drafts: string[] = []

  for (const comment of newComments.slice(0, 5)) {
    const replyRes = await anthropic.messages.create({
      model: pickModel('comment-digest'),
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: `${comment.authorName} commented on your LinkedIn post "${comment.postPreview}...": "${comment.commentText}". Write a genuine 1-2 sentence reply in ${user.name}'s voice. Add value, no generic thanks.`,
      }],
    })
    const reply = replyRes.content[0].type === 'text' ? replyRes.content[0].text.trim() : ''
    drafts.push(
      `${comment.authorName} on "${comment.postPreview}..."\n"${comment.commentText.slice(0, 80)}"\n\nmy draft: ${reply}`
    )
  }

  // Send digest to WhatsApp
  const message = `${newComments.length} comments need replies\n\n${drafts.map((d, i) => `${i + 1}. ${d}`).join('\n\n')}\n\nreply R1-R5 to post, or ill handle them all if you say ALL`

  await sendWhatsApp(user.whatsapp_number, message)

  return `Sent digest with ${drafts.length} comment replies`
}
