import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { handleConversation } from '@/lib/whatsapp/handlers/conversation'

export const maxDuration = 300

/**
 * WhatsApp polling — routes through handleConversation (full tools)
 * for users with LinkedIn connected, falls back to simple Anthropic
 * for chat-only users.
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

  // Get WhatsApp account
  let waAccountId: string | null = null
  try {
    const res = await fetch(`${BASE_URL}/api/v1/accounts`, { headers })
    const data = await res.json()
    waAccountId = (data.items ?? []).find((a: { type: string }) => a.type === 'WHATSAPP')?.id ?? null
  } catch { return Response.json({ ok: false, error: 'accounts' }) }
  if (!waAccountId) return Response.json({ ok: false, error: 'no wa' })

  const processedIds = new Set<string>()
  let totalProcessed = 0

  for (let poll = 0; poll < 3; poll++) {
    if (poll > 0) await new Promise((r) => setTimeout(r, 18000))

    try {
      const chatsRes = await fetch(`${BASE_URL}/api/v1/chats?account_id=${waAccountId}&limit=10`, { headers })
      const chats = (await chatsRes.json()).items ?? []

      for (const chat of chats) {
        const providerId = (chat.provider_id ?? '') as string
        const phone = providerId.replace(/@.*$/, '').replace(/^\+/, '')
        if (!phone || phone.length < 10) continue

        const { data: user } = await supabase
          .from('users')
          .select('id, name, whatsapp_number, unipile_account_id, timezone, niche, plan, streak_count, onboarding_complete')
          .eq('whatsapp_number', phone)
          .single()

        if (!user) {
          // Check if this is a pending WhatsApp verification (user entered number, replied "ok")
          const { data: pendingUser } = await supabase
            .from('users')
            .select('id, name')
            .eq('pending_whatsapp', phone)
            .single()

          if (pendingUser) {
            // Check latest message from them
            const verifyRes = await fetch(
              `${BASE_URL}/api/v1/chats/${chat.id}/messages?account_id=${waAccountId}&limit=1`,
              { headers }
            )
            const verifyMsgs = (await verifyRes.json()).items ?? []
            const latestMsg = verifyMsgs[0]
            if (
              latestMsg &&
              !latestMsg.is_sender &&
              latestMsg.text &&
              ['yes', 'y', 'ok', 'okay', 'yep', 'sure', 'hi', 'hello', 'hey'].includes(
                latestMsg.text.trim().toLowerCase()
              )
            ) {
              // Dedup this verification
              const vKey = `wa_verify_${pendingUser.id}`
              const { data: alreadyDone } = await supabase
                .from('user_memory')
                .select('id')
                .eq('user_id', pendingUser.id)
                .eq('fact', vKey)
                .eq('category', 'poll_dedup')
                .limit(1)
              if (!alreadyDone || alreadyDone.length === 0) {
                await supabase.from('user_memory').insert({
                  user_id: pendingUser.id,
                  fact: vKey,
                  category: 'poll_dedup',
                  source: 'system',
                })
                // Connect the user
                await supabase
                  .from('users')
                  .update({ whatsapp_number: phone, pending_whatsapp: null })
                  .eq('id', pendingUser.id)
                await sendWhatsApp(
                  phone,
                  `connected! hey ${pendingUser.name}, i'm nivi. your linkedin brand strategist.\n\njust text me anytime you need a post, comment, or anything linkedin.`
                )
                totalProcessed++
                console.log(`[poll-wa] verified & connected ${phone} for ${pendingUser.name}`)
              }
            }
          }
          continue
        }

        // Cooldown: skip if Nivi replied to this user in the last 2 minutes
        // (prevents overlapping cron invocations from double-replying)
        const { data: recentReply } = await supabase
          .from('conversations')
          .select('created_at')
          .eq('user_id', user.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
        if (recentReply?.[0]?.created_at) {
          const lastReplyAge = Date.now() - new Date(recentReply[0].created_at).getTime()
          if (lastReplyAge < 120000) continue // replied less than 2 min ago, skip
        }

        const msgRes = await fetch(
          `${BASE_URL}/api/v1/chats/${chat.id}/messages?account_id=${waAccountId}&limit=5`,
          { headers }
        )
        const messages = (await msgRes.json()).items ?? []

        // Collect all new unprocessed messages from this user into one batch
        const newTexts: string[] = []
        const newMsgIds: string[] = []

        for (const msg of messages) {
          if (msg.is_sender) continue
          if (!msg.text?.trim()) continue
          if (processedIds.has(msg.id)) continue

          const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
          if (msgTime && msgTime < Date.now() - 120000) continue

          // Dedup by message ID
          const dedupKey = `wa_msg_${msg.id}`
          const { data: alreadyProcessed } = await supabase
            .from('user_memory')
            .select('id')
            .eq('user_id', user.id)
            .eq('fact', dedupKey)
            .eq('category', 'poll_dedup')
            .limit(1)
          if (alreadyProcessed && alreadyProcessed.length > 0) continue

          newTexts.push(msg.text.trim())
          newMsgIds.push(msg.id)
        }

        // Nothing new from this user
        if (newTexts.length === 0) continue

        // Mark ALL collected messages as processed BEFORE replying
        for (const msgId of newMsgIds) {
          await supabase.from('user_memory').insert({
            user_id: user.id,
            fact: `wa_msg_${msgId}`,
            category: 'poll_dedup',
            source: 'system',
          })
          processedIds.add(msgId)
        }

        // Combine multiple messages into one user message
        const combinedText = newTexts.length === 1
          ? newTexts[0]
          : newTexts.join('\n')

        // === ATOMIC LOCK: prevent overlapping cron invocations ===
        // Try to claim this user by setting last_active_at to NOW.
        // Only proceed if last_active_at was > 30s ago (meaning no other
        // cron invocation is currently processing this user).
        const { data: lockCheck } = await supabase
          .from('users')
          .select('last_active_at')
          .eq('id', user.id)
          .single()
        const lastActive = lockCheck?.last_active_at
          ? new Date(lockCheck.last_active_at).getTime()
          : 0
        if (Date.now() - lastActive < 30000) {
          console.log(`[poll-wa] skipping ${phone} — another invocation is processing`)
          continue
        }
        // Claim the lock
        await supabase
          .from('users')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', user.id)

        console.log(`[poll-wa] ${phone}: "${combinedText.slice(0, 60)}" (${newTexts.length} msgs)`)

        // Route through handleConversation (full tools: LinkedIn, posts, comments, etc.)
        try {
          const fullUser = {
            ...user,
            chatId: chat.id,
            timezone: user.timezone || 'Asia/Kolkata',
            niche: user.niche || null,
            plan: user.plan || 'free',
            streak_count: user.streak_count || 0,
            onboarding_complete: user.onboarding_complete ?? true,
          }
          await handleConversation(user.id, fullUser, combinedText)
          totalProcessed++
          console.log(`[poll-wa] handled via conversation for ${phone}`)
        } catch (err) {
          console.error('[poll-wa] handleConversation error:', (err as Error).message)
        }
      }
    } catch (err) {
      console.error('[poll-wa] poll error:', (err as Error).message)
    }
  }

  return Response.json({ ok: true, processed: totalProcessed })
}
