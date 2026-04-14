import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

/**
 * Sends a WhatsApp verification message from Nivi to the user's phone number.
 * User replies YES → webhook matches phone → connection confirmed.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { phoneNumber } = await req.json()
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return Response.json({ error: 'Phone number required' }, { status: 400 })
  }

  // Normalize: strip spaces, dashes, ensure starts with country code
  let normalized = phoneNumber.replace(/[\s\-\(\)]/g, '')
  if (normalized.startsWith('+')) normalized = normalized.slice(1)
  if (normalized.length < 10) {
    return Response.json({ error: 'Invalid phone number' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Store the pending phone number so the webhook can match it
  await supabase
    .from('users')
    .update({ pending_whatsapp: normalized })
    .eq('id', userId)

  // Send the verification message from Nivi
  try {
    console.log('[send-whatsapp] sending verification to:', normalized, 'for user:', userId)
    await sendWhatsApp(
      normalized,
      `hey, nivi here. your linkedin brand strategist.\n\nreply "ok" to connect your whatsapp.`
    )
    console.log('[send-whatsapp] sent successfully to:', normalized)
    return Response.json({ ok: true })
  } catch (err) {
    console.error('[send-whatsapp] failed for', normalized, ':', err)
    return Response.json({ error: 'Failed to send message' }, { status: 500 })
  }
}
