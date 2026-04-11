import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export async function handleOptIn(
  from: string,
  code: string
): Promise<void> {
  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id, name, whatsapp_number, onboarding_complete')
    .eq('whatsapp_opt_in_code', code.trim())
    .single()

  if (!user) {
    await sendWhatsApp(
      from,
      "That code doesn't match any account. Please check your code at nivi.app/onboarding"
    )
    return
  }

  if (user.whatsapp_number) {
    await sendWhatsApp(from, 'Your WhatsApp is already connected. All set.')
    return
  }

  await supabase
    .from('users')
    .update({ whatsapp_number: from })
    .eq('id', user.id)

  if (user.onboarding_complete) {
    await sendWhatsApp(
      from,
      `Welcome back, ${user.name}! WhatsApp reconnected.\nYour morning brief arrives at your usual time.`
    )
  } else {
    await sendWhatsApp(
      from,
      `Welcome to Nivi, ${user.name}!\n\nYour WhatsApp is now connected.\nHead back to nivi.app to finish setting up your AI profile.`
    )
  }
}
