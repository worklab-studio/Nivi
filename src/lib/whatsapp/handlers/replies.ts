import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getEnv } from '@/lib/config'

export async function handleReplyApproval(
  userId: string,
  user: { whatsapp_number: string; chatId?: string },
  cmd: string
): Promise<Response> {
  const supabase = getSupabaseAdmin()
  const num = parseInt(cmd.replace(/^R/i, ''))

  // Get pending comment opportunities (replies to comments on user's posts)
  const { data: pending } = await supabase
    .from('nivi_comments')
    .select('*')
    .eq('user_id', userId)
    .eq('has_reply', true)
    .eq('reply_handled', false)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!pending || pending.length === 0) {
    await sendWhatsApp(user.whatsapp_number, 'no pending replies right now', user.chatId)
    return Response.json({ ok: true })
  }

  const target = pending[num - 1]
  if (!target) {
    await sendWhatsApp(user.whatsapp_number, `R${num} doesnt exist. got ${pending.length} pending replies`, user.chatId)
    return Response.json({ ok: true })
  }

  // Get user's LinkedIn account
  const { data: userData } = await supabase
    .from('users')
    .select('unipile_account_id')
    .eq('id', userId)
    .single()

  if (!userData?.unipile_account_id) {
    await sendWhatsApp(user.whatsapp_number, 'LinkedIn not connected', user.chatId)
    return Response.json({ ok: true })
  }

  // Post the reply as a comment on the same post
  const postUrn = target.linkedin_post_id.startsWith('urn:')
    ? target.linkedin_post_id
    : `urn:li:activity:${target.linkedin_post_id}`

  const res = await fetch(
    `${getEnv('UNIPILE_BASE_URL')}/api/v1/posts/${encodeURIComponent(postUrn)}/comments`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': getEnv('UNIPILE_API_KEY'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account_id: userData.unipile_account_id,
        text: target.reply_text,
      }),
    }
  )

  if (res.ok) {
    await supabase.from('nivi_comments').update({ reply_handled: true }).eq('id', target.id)
    await sendWhatsApp(user.whatsapp_number, `reply posted on ${target.post_author_name}'s thread`, user.chatId)
  } else {
    await sendWhatsApp(user.whatsapp_number, 'reply failed. linkedin might be rate limiting', user.chatId)
  }

  return Response.json({ ok: true })
}
