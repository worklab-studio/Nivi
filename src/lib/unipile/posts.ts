import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getEnv } from '@/lib/config'
import { checkRateLimit, incrementRateLimit } from '@/lib/utils/rateLimiter'

export async function publishToLinkedIn(
  userId: string,
  postId: string
): Promise<void> {
  const supabase = getSupabaseAdmin()

  const [{ data: user }, { data: post }] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('posts').select('*').eq('id', postId).single(),
  ])

  if (!user?.unipile_account_id) {
    if (user?.whatsapp_number) {
      await sendWhatsApp(user.whatsapp_number, 'LinkedIn not connected. reconnect at nivi.app/settings')
    }
    return
  }

  // Unipile requires FormData for LinkedIn posts
  const formData = new FormData()
  formData.append('account_id', user.unipile_account_id)
  formData.append('text', post!.content)

  const res = await fetch(`${getEnv('UNIPILE_BASE_URL')}/api/v1/posts`, {
    method: 'POST',
    headers: { 'X-API-KEY': getEnv('UNIPILE_API_KEY') },
    body: formData,
  })

  const data = await res.json()

  if (!res.ok) {
    if (user.whatsapp_number) {
      await sendWhatsApp(user.whatsapp_number, `posting failed: ${data.message ?? 'unknown error'}. try again?`)
    }
    return
  }

  await supabase.from('posts').update({
    status: 'published',
    published_at: new Date().toISOString(),
    linkedin_post_id: data.post_id ?? data.id,
  }).eq('id', postId)

  if (user.pending_image_url) {
    await supabase.from('users').update({ pending_image_url: null }).eq('id', userId)
  }

  if (user.whatsapp_number) {
    await sendWhatsApp(user.whatsapp_number, 'done, its live on LinkedIn. ill let you know when it picks up traction')
  }
}

export async function postComment(
  userId: string,
  opportunityId: string
): Promise<{ ok: boolean; reason?: string }> {
  const supabase = getSupabaseAdmin()

  const [{ data: user }, { data: opp }] = await Promise.all([
    supabase.from('users').select('*').eq('id', userId).single(),
    supabase.from('comment_opportunities').select('*').eq('id', opportunityId).single(),
  ])

  if (!user?.unipile_account_id || !opp) {
    return { ok: false, reason: 'no account or opportunity' }
  }

  // Enforce daily comment cap. Approve-flow batches multiple C1/C2/C3
  // approvals — without this check the user could approve 15 drafts
  // over a day even though the cap is 6.
  const { allowed, remaining, limit } = await checkRateLimit(userId, 'comment')
  if (!allowed) {
    return { ok: false, reason: `daily comment cap (${limit}) reached, ${remaining} remaining` }
  }

  const postUrn = opp.linkedin_post_id.startsWith('urn:')
    ? opp.linkedin_post_id
    : `urn:li:activity:${opp.linkedin_post_id}`

  const res = await fetch(
    `${getEnv('UNIPILE_BASE_URL')}/api/v1/posts/${encodeURIComponent(postUrn)}/comments`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': getEnv('UNIPILE_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: user.unipile_account_id,
        text: opp.drafted_comment,
      }),
    }
  )

  if (!res.ok) {
    return { ok: false, reason: `unipile error ${res.status}` }
  }

  // Only consume the rate-limit slot on actual success.
  await incrementRateLimit(userId, 'comment')

  await supabase.from('comment_opportunities').update({ status: 'posted' }).eq('id', opportunityId)
  return { ok: true }
}
