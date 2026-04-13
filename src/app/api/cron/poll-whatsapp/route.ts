import { getSupabaseAdmin } from '@/lib/supabase/admin'

export const maxDuration = 60

/**
 * Polls Unipile for new WhatsApp messages every ~10 seconds.
 * Temporary fallback while webhooks are not firing.
 *
 * Called by Vercel cron every minute — internally polls 6 times (every 10s).
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

  // Get all users with WhatsApp connected
  const { data: users } = await supabase
    .from('users')
    .select('id, name, whatsapp_number, plan, timezone, niche, streak_count, onboarding_complete')
    .not('whatsapp_number', 'is', null)
    .limit(50)

  if (!users || users.length === 0) {
    return Response.json({ ok: true, polled: 0 })
  }

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

  // Track last processed message per user to avoid duplicates
  const lastProcessedKey = 'poll_last_message_'
  let processed = 0

  // Poll 6 times over ~60 seconds (every 10s)
  for (let poll = 0; poll < 6; poll++) {
    if (poll > 0) {
      await new Promise((r) => setTimeout(r, 10000)) // wait 10s between polls
    }

    try {
      // Get recent chats with new messages
      const chatsRes = await fetch(
        `${BASE_URL}/api/v1/chats?account_id=${waAccountId}&limit=10`,
        { headers: { 'X-API-KEY': API_KEY, accept: 'application/json' } }
      )
      const chatsData = await chatsRes.json()
      const chats = chatsData.items ?? []

      for (const chat of chats) {
        // Get latest messages in this chat
        const msgRes = await fetch(
          `${BASE_URL}/api/v1/chats/${chat.id}/messages?account_id=${waAccountId}&limit=3`,
          { headers: { 'X-API-KEY': API_KEY, accept: 'application/json' } }
        )
        const msgData = await msgRes.json()
        const messages = msgData.items ?? []

        for (const msg of messages) {
          // Skip our own messages
          if (msg.is_sender) continue
          // Skip if no text
          if (!msg.text || !msg.text.trim()) continue

          // Get sender phone
          const senderPhone =
            msg.sender?.attendee_specifics?.phone_number ??
            msg.sender?.attendee_public_identifier ??
            ''
          const from = senderPhone.replace(/^\+/, '').replace(/@.*$/, '')
          if (!from) continue

          // Check if we already processed this message
          const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', users.find((u) => u.whatsapp_number === from)?.id ?? '')
            .eq('content', msg.text)
            .gte('created_at', new Date(Date.now() - 120000).toISOString()) // last 2 min
            .limit(1)

          if (existing && existing.length > 0) continue

          // Find matching user
          const user = users.find((u) => u.whatsapp_number === from)
          if (!user) continue

          console.log(`[poll-wa] New message from ${from}: ${msg.text.slice(0, 40)}`)

          // Process the message using the same webhook handler logic
          try {
            const webhookPayload = {
              message: msg.text,
              sender: {
                attendee_specifics: { phone_number: from },
              },
              chat_id: chat.id,
              message_id: msg.id ?? `poll-${Date.now()}`,
              is_sender: false,
              is_forwarded: false,
              message_type: 'text',
              attachments: [],
            }

            // Call our own webhook endpoint internally
            const internalRes = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload),
              }
            )
            if (internalRes.ok) processed++
          } catch (err) {
            console.error('[poll-wa] Process error:', (err as Error).message)
          }
        }
      }
    } catch (err) {
      console.error('[poll-wa] Poll error:', (err as Error).message)
    }
  }

  return Response.json({ ok: true, processed })
}
