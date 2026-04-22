import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { handleConversation } from '@/lib/whatsapp/handlers/conversation'
import { captureServerEvent } from '@/lib/analytics/posthog'

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

  // Single poll per invocation — cron fires every 2 min, no overlap possible
  for (let poll = 0; poll < 1; poll++) {

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
        const audioMsgs: { id: string; audioId: string }[] = []

        for (const msg of messages) {
          if (msg.is_sender) continue
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

          // Detect voice note: message_type 'audio' OR audio attachment
          const isAudio =
            msg.message_type === 'audio' ||
            msg.type === 'audio' ||
            (Array.isArray(msg.attachments) && msg.attachments.some((a: { type?: string; mime_type?: string }) =>
              a.type?.includes('audio') || a.mime_type?.includes('audio')
            ))

          if (isAudio) {
            const audioAtt = (msg.attachments ?? []).find((a: { type?: string; mime_type?: string }) =>
              a.type?.includes('audio') || a.mime_type?.includes('audio')
            )
            const audioId =
              (audioAtt?.id as string) ??
              (audioAtt?.attachment_id as string) ??
              (msg.attachment_id as string) ??
              ''
            if (audioId) {
              audioMsgs.push({ id: msg.id, audioId })
            }
            continue
          }

          if (!msg.text?.trim()) continue

          newTexts.push(msg.text.trim())
          newMsgIds.push(msg.id)
        }

        // Process audio messages first — each goes through transcription + handleConversation
        for (const audio of audioMsgs) {
          // Mark processed BEFORE handling
          await supabase.from('user_memory').insert({
            user_id: user.id,
            fact: `wa_msg_${audio.id}`,
            category: 'poll_dedup',
            source: 'system',
          })
          processedIds.add(audio.id)

          // Atomic lock for audio path too
          const thirtySecsAgo = new Date(Date.now() - 30000).toISOString()
          const { data: audioLock } = await supabase
            .from('users')
            .update({ last_active_at: new Date().toISOString() })
            .eq('id', user.id)
            .or(`last_active_at.is.null,last_active_at.lt.${thirtySecsAgo}`)
            .select('id')

          if (!audioLock || audioLock.length === 0) {
            console.log(`[poll-wa] skipping audio for ${phone} — locked`)
            continue
          }

          try {
            const { handleVoiceNote } = await import('@/lib/whatsapp/handlers/voiceNote')
            await handleVoiceNote(user.id, audio.audioId, audio.id, chat.id)
            totalProcessed++
            console.log(`[poll-wa] handled voice note for ${phone}`)
          } catch (err) {
            console.error('[poll-wa] voice note error:', (err as Error).message)
          }
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
        // Update last_active_at ONLY if it's null or older than 30s.
        // If the update affects 0 rows, another invocation already claimed this user.
        const thirtySecsAgo = new Date(Date.now() - 30000).toISOString()
        const { data: lockResult } = await supabase
          .from('users')
          .update({ last_active_at: new Date().toISOString() })
          .eq('id', user.id)
          .or(`last_active_at.is.null,last_active_at.lt.${thirtySecsAgo}`)
          .select('id')

        if (!lockResult || lockResult.length === 0) {
          console.log(`[poll-wa] skipping ${phone} — locked by another invocation`)
          continue
        }

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
          // Track incoming message
          captureServerEvent(user.id, 'whatsapp_message_received', {
            messageLength: combinedText.length,
            messageCount: newTexts.length,
          })

          await handleConversation(user.id, fullUser, combinedText)
          totalProcessed++

          // Track Nivi's reply (handleConversation sends one message)
          captureServerEvent(user.id, 'whatsapp_message_sent', {
            messageType: 'reply',
          })

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
