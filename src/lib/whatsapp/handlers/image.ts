import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getEnv } from '@/lib/config'

export async function handleImage(
  userId: string,
  imageId: string,
  chatId?: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('whatsapp_number')
    .eq('id', userId)
    .single()

  if (!user?.whatsapp_number) return

  // Download image via Unipile
  try {
    const imageRes = await fetch(
      `${getEnv('UNIPILE_BASE_URL')}/api/v1/media/${imageId}`,
      { headers: { 'X-API-KEY': getEnv('UNIPILE_API_KEY') } }
    )

    if (imageRes.ok) {
      const imageBuffer = await imageRes.arrayBuffer()
      const filename = `${userId}/${Date.now()}.jpg`

      await supabase.storage
        .from('post-images')
        .upload(filename, imageBuffer, { contentType: 'image/jpeg', upsert: false })

      const { data: { publicUrl } } = supabase.storage
        .from('post-images')
        .getPublicUrl(filename)

      await supabase.from('users').update({ pending_image_url: publicUrl }).eq('id', userId)
    }
  } catch {
    // Image download failed — store reference anyway
    await supabase.from('users').update({ pending_image_url: imageId }).eq('id', userId)
  }

  await sendWhatsApp(
    user.whatsapp_number,
    'got the image. itll be attached to your next post. send POST to publish with it or write a new draft first',
    chatId
  )
}
