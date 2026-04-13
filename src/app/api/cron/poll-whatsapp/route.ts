import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { handleConversation } from '@/lib/whatsapp/handlers/conversation'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export const maxDuration = 60

/**
 * Polls Unipile for new WhatsApp messages every ~10 seconds.
 * Processes them directly (no webhook needed).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const BASE_URL = process.env.UNIPILE_BASE_URL!
  const API_KEY = process.env.UNIPILE_API_KEY!
  const supabase = getSupabaseAdmin()

  // Get WhatsApp account ID
  let waAccountId: string | null = null
  try {
    const res = await fetch(`${BASE_URL}/api/v1/accounts`, {
      headers: { 'X-API-KEY': API_KEY, accept: 'application/json' },
    })
    const data = await res.json()
    const wa = (data.items ?? []).find(
      (a: { type: string }) => a.type === 'WHATSAPP'
    )
    waAccountId = wa?.id ?? null
  } catch {
    return Response.json({ ok: false, error: 'Could not fetch accounts' })
  }

  if (!waAccountId) {
    return Response.json({ ok: false, error: 'No WhatsApp account' })
  }

  // Get last poll timestamp from a simple key-value store
  const { data: pollState } = await supabase
    .from('user_memory')
    .select('fact')
    .eq('user_id', 'system')
    .eq('category', 'poll_state')
    .single()

  const lastPollTime = pollState?.fact
    ? new Date(pollState.fact).getTime()
    : Date.now() - 60000 // default: last 60 seconds

  let processed = 0
  const newLastPoll = new Date().toISOString()

  // Poll 6 times over ~60 seconds
  for (let poll = 0; poll < 6; poll++) {
    if (poll > 0) {
      await new Promise((r) => setTimeout(r, 9000))
    }

    try {
      // Get recent chats
      const chatsRes = await fetch(
        `${BASE_URL}/api/v1/chats?account_id=${waAccountId}&limit=5`,
        { headers: { 'X-API-KEY': API_KEY, accept: 'application/json' } }
      )
      const chatsData = await chatsRes.json()
      const chats = chatsData.items ?? []

      for (const chat of chats) {
        const msgRes = await fetch(
          `${BASE_URL}/api/v1/chats/${chat.id}/messages?account_id=${waAccountId}&limit=3`,
          { headers: { 'X-API-KEY': API_KEY, accept: 'application/json' } }
        )
        const msgData = await msgRes.json()
        const messages = msgData.items ?? []

        for (const msg of messages) {
          if (msg.is_sender) continue
          if (!msg.text || !msg.text.trim()) continue

          // Check message timestamp — skip if older than last poll
          const msgTime = msg.timestamp
            ? new Date(msg.timestamp).getTime()
            : msg.created_at
              ? new Date(msg.created_at).getTime()
              : 0

          if (msgTime && msgTime < lastPollTime) continue

          // Get sender phone
          const senderPhone =
            msg.sender?.attendee_specifics?.phone_number ??
            msg.sender?.attendee_public_identifier ??
            ''
          const from = senderPhone.replace(/^\+/, '').replace(/@.*$/, '')
          if (!from) continue

          // Find user
          const { data: user } = await supabase
            .from('users')
            .select('id, name, whatsapp_number, plan, timezone, niche, streak_count, onboarding_complete')
            .eq('whatsapp_number', from)
            .single()

          if (!user) continue

          // Check if already processed (dedup by message content + time)
          const msgId = msg.id ?? `poll-${msgTime}`
          const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', user.id)
            .eq('role', 'user')
            .eq('content', msg.text)
            .gte('created_at', new Date(Date.now() - 120000).toISOString())
            .limit(1)

          if (existing && existing.length > 0) continue

          console.log(`[poll-wa] Processing: ${from} → "${msg.text.slice(0, 40)}"`)

          // Process the message directly
          try {
            await handleConversation(
              user.id,
              { whatsapp_number: from, name: user.name, chatId: chat.id },
              msg.text
            )
            processed++
          } catch (err) {
            console.error('[poll-wa] handleConversation error:', (err as Error).message)
            // Send a fallback reply
            try {
              await sendWhatsApp(from, 'sorry, something glitched on my end. try again?', chat.id)
            } catch { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.error('[poll-wa] Poll error:', (err as Error).message)
    }
  }

  // Save last poll timestamp
  try {
    await supabase.from('user_memory').upsert({
      user_id: 'system',
      category: 'poll_state',
      fact: newLastPoll,
      source: 'system',
    }, { onConflict: 'user_id,category' })
  } catch {
    await supabase.from('user_memory').insert({
      user_id: 'system',
      category: 'poll_state',
      fact: newLastPoll,
      source: 'system',
    })
  }

  return Response.json({ ok: true, processed })
}
