import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/whatsapp/send'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function handleCancel(
  userId: string,
  user: { whatsapp_number: string }
): Promise<Response> {
  const supabase = getSupabase()

  // Cancel the most recent scheduled post
  const { data: scheduled } = await supabase
    .from('scheduled_posts')
    .select('id, post_id')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('scheduled_at', { ascending: true })
    .limit(1)
    .single()

  if (!scheduled) {
    await sendWhatsApp(
      user.whatsapp_number,
      'Nothing scheduled to cancel.'
    )
    return Response.json({ ok: true })
  }

  await supabase
    .from('scheduled_posts')
    .update({ status: 'failed' })
    .eq('id', scheduled.id)

  await supabase
    .from('posts')
    .update({ status: 'draft', scheduled_at: null })
    .eq('id', scheduled.post_id)

  await sendWhatsApp(
    user.whatsapp_number,
    'Cancelled. The post is back in your drafts.\nReply POST to publish now, or EDIT: [notes] to change it.'
  )
  return Response.json({ ok: true })
}
