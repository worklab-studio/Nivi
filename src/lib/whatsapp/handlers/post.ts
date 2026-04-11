import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { publishToLinkedIn } from '@/lib/unipile/posts'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export async function handlePost(
  userId: string,
  user: { whatsapp_number: string; chatId?: string }
): Promise<Response> {
  const supabase = getSupabaseAdmin()

  const { data: draft } = await supabase
    .from('posts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!draft) {
    await sendWhatsApp(user.whatsapp_number, "no draft ready. send me an idea and ill write one", user.chatId)
    return Response.json({ ok: true })
  }

  await publishToLinkedIn(userId, draft.id)

  return Response.json({ ok: true })
}
