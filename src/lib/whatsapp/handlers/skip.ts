import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/whatsapp/send'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function handleSkip(
  userId: string,
  user: { whatsapp_number: string }
): Promise<Response> {
  const supabase = getSupabase()

  const { data: draft } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (draft) {
    await supabase
      .from('posts')
      .update({ status: 'skipped' })
      .eq('id', draft.id)
  }

  await sendWhatsApp(
    user.whatsapp_number,
    'Skipped. I\'ll have a fresh one for you tomorrow.'
  )
  return Response.json({ ok: true })
}
