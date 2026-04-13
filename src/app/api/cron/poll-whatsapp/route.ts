import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { handleConversation } from '@/lib/whatsapp/handlers/conversation'

export const maxDuration = 300 // 5 min on Pro plan

/**
 * Polls Unipile for new WhatsApp messages.
 * Runs every minute via cron, polls 6 times internally (every ~9s).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const BASE_URL = process.env.UNIPILE_BASE_URL!
  const API_KEY = process.env.UNIPILE_API_KEY!
  const headers = { 'X-API-KEY': API_KEY, accept: 'application/json' }
  const supabase = getSupabaseAdmin()

  // Get WhatsApp account ID
  let waAccountId: string | null = null
  try {
    const res = await fetch(`${BASE_URL}/api/v1/accounts`, { headers })
    const data = await res.json()
    const wa = (data.items ?? []).find((a: { type: string }) => a.type === 'WHATSAPP')
    waAccountId = wa?.id ?? null
  } catch {
    return Response.json({ ok: false, error: 'accounts fetch failed' })
  }
  if (!waAccountId) return Response.json({ ok: false, error: 'no wa account' })

  // Track processed message IDs to avoid duplicates within this run
  const processedIds = new Set<string>()
  let totalProcessed = 0

  for (let poll = 0; poll < 6; poll++) {
    if (poll > 0) await new Promise((r) => setTimeout(r, 9000))

    try {
      // Get recent chats
      const chatsRes = await fetch(
        `${BASE_URL}/api/v1/chats?account_id=${waAccountId}&limit=10`,
        { headers }
      )
      const chats = (await chatsRes.json()).items ?? []

      for (const chat of chats) {
        // Extract phone from provider_id (e.g. "919729072096@s.whatsapp.net")
        const providerId = (chat.provider_id ?? chat.attendee_provider_id ?? '') as string
        const phone = providerId.replace(/@.*$/, '').replace(/^\+/, '')
        if (!phone || phone.length < 10) continue

        // Find user by phone
        const { data: user } = await supabase
          .from('users')
          .select('id, name, whatsapp_number, plan, timezone, niche, streak_count, onboarding_complete')
          .eq('whatsapp_number', phone)
          .single()
        if (!user) continue

        // Get latest messages
        const msgRes = await fetch(
          `${BASE_URL}/api/v1/chats/${chat.id}/messages?account_id=${waAccountId}&limit=3`,
          { headers }
        )
        const messages = (await msgRes.json()).items ?? []

        for (const msg of messages) {
          if (msg.is_sender) continue
          if (!msg.text || !msg.text.trim()) continue

          const msgId = msg.id ?? ''
          if (processedIds.has(msgId)) continue

          // Skip messages older than 2 minutes
          const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
          if (msgTime && msgTime < Date.now() - 120000) continue

          // Dedup: check if we already have this exact message in conversations
          const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', user.id)
            .eq('role', 'user')
            .eq('content', msg.text)
            .gte('created_at', new Date(Date.now() - 180000).toISOString())
            .limit(1)
          if (existing && existing.length > 0) continue

          processedIds.add(msgId)
          console.log(`[poll-wa] ${phone}: "${msg.text.slice(0, 40)}"`)

          try {
            await handleConversation(
              user.id,
              { whatsapp_number: phone, name: user.name, chatId: chat.id },
              msg.text
            )
            totalProcessed++
            console.log(`[poll-wa] replied to ${phone}`)
          } catch (err) {
            console.error('[poll-wa] error:', (err as Error).message?.slice(0, 100))
            try {
              await sendWhatsApp(phone, 'oops, something glitched. try again?', chat.id)
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.error('[poll-wa] poll error:', (err as Error).message)
    }
  }

  return Response.json({ ok: true, processed: totalProcessed })
}
