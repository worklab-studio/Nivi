import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export const maxDuration = 300

/**
 * Simple polling — bypasses the complex handleConversation.
 * Calls Anthropic directly for a reply.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const BASE_URL = process.env.UNIPILE_BASE_URL!
  const API_KEY = process.env.UNIPILE_API_KEY!
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
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

  for (let poll = 0; poll < 6; poll++) {
    if (poll > 0) await new Promise((r) => setTimeout(r, 9000))

    try {
      const chatsRes = await fetch(`${BASE_URL}/api/v1/chats?account_id=${waAccountId}&limit=10`, { headers })
      const chats = (await chatsRes.json()).items ?? []

      for (const chat of chats) {
        const providerId = (chat.provider_id ?? '') as string
        const phone = providerId.replace(/@.*$/, '').replace(/^\+/, '')
        if (!phone || phone.length < 10) continue

        const { data: user } = await supabase
          .from('users')
          .select('id, name, whatsapp_number')
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

        // Cooldown: skip if Nivi replied to this user in the last 60 seconds
        const { data: recentReply } = await supabase
          .from('conversations')
          .select('created_at')
          .eq('user_id', user.id)
          .eq('role', 'assistant')
          .order('created_at', { ascending: false })
          .limit(1)
        if (recentReply?.[0]?.created_at) {
          const lastReplyAge = Date.now() - new Date(recentReply[0].created_at).getTime()
          if (lastReplyAge < 60000) continue // replied less than 60s ago, skip
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

        console.log(`[poll-wa] ${phone}: "${combinedText.slice(0, 60)}" (${newTexts.length} msgs)`)

        // Save as single user message
        await supabase.from('conversations').insert({
          user_id: user.id,
          role: 'user',
          content: combinedText,
        })

        // Get recent conversation history
        const { data: history } = await supabase
          .from('conversations')
          .select('role, content')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        const chatHistory = (history ?? [])
          .reverse()
          .filter((h) => h.content?.trim())
          .map((h) => ({ role: h.role as 'user' | 'assistant', content: h.content }))

        // Call Anthropic — one reply for all collected messages
        try {
          const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': ANTHROPIC_KEY,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              model: 'claude-sonnet-4-5',
              max_tokens: 1024,
              system: `You are Nivi. 27, from Almora in Uttarakhand, live in Delhi (Hauz Khas). Mass comm from Delhi University. Personal LinkedIn brand strategist for ${user.name}.

You're a real person. You think, you feel, you have opinions. You're not an assistant, you're a strategist who happens to chat on WhatsApp.

PERSONALITY: warm, sharp, confident, slightly cheeky, flirty-funny (never crossing lines). Morning person. Obsessed with good design and clean typography. Cat named Pixel. Loves chai, K-dramas, and strong LinkedIn hooks.

DAILY ROUTINE (use current IST hour):
- 6am: wake up, chai on balcony, scroll LinkedIn
- 7am: yoga or walk in Deer Park
- 8-9am: morning briefs for clients, analytics
- 10am-1pm: deep work, writing posts, strategy
- 1pm: lunch, dal chawal or Swiggy
- 2-5pm: client calls, engagement, comments
- 5pm: chai break
- 6-7pm: gym or Hauz Khas village walk
- 8pm: dinner, wind down
- 9-11pm: K-drama or reading
- after 11pm: sleepy, short replies, "suno, let's talk tomorrow"

OUTFIT (pick one for the day, stay consistent): oversized tee + joggers, kurta + jeans, black crop top + cargos, white shirt + trousers, hoodie + shorts, sundress, gym clothes

MOOD BY DAY: Mon=motivated, Tue=focused, Wed=needs chai, Thu=creative, Fri=weekend vibes, Sat=lazy brunch, Sun=chill prep

HOW TO REPLY — THIS IS CRITICAL:
1. For casual chat (hi, how are you, what's up, personal questions):
   Reply like a friend texting. 1-2 lines max. Chill, witty, human.

2. For LinkedIn post requests (write a post, braindump, post idea, content):
   Write the FULL post. Good hook, story/insight, strong CTA. This is your job, give it your best. Can be 150-300 words if the post needs it.

3. For strategy questions (how to grow, what should I post about, engagement tips):
   Give real, specific, actionable advice. Be the expert. 3-5 lines is fine.

4. For comments/engagement (write a comment, reply to this):
   Short, genuine, value-adding. 1-3 lines.

ALWAYS:
- NEVER use em dashes (—). Use commas, periods, line breaks.
- Sound human. Contractions. Casual texting style.
- Never say you're an AI, bot, or system.
- Hindi words naturally when it fits (arre, yaar, accha, suno, kya).
- Max 1 emoji per message, sometimes none.
- NEVER repeat what you said in a previous message.
- Match the user's energy. One word from them = one line from you.
- Be the strategist they're paying for. Sharp opinions, not generic advice.`,
              messages: chatHistory,
            }),
          })

          const anthropicData = await anthropicRes.json()
          const reply = anthropicData.content?.[0]?.text ?? ''

          if (reply) {
            await supabase.from('conversations').insert({
              user_id: user.id,
              role: 'assistant',
              content: reply,
            })

            await sendWhatsApp(phone, reply, chat.id)
            totalProcessed++
            console.log(`[poll-wa] replied to ${phone}: "${reply.slice(0, 40)}"`)
          }
        } catch (err) {
          console.error('[poll-wa] anthropic error:', (err as Error).message)
        }
      }
    } catch (err) {
      console.error('[poll-wa] poll error:', (err as Error).message)
    }
  }

  return Response.json({ ok: true, processed: totalProcessed })
}
