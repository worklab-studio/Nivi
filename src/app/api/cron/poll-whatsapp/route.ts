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
        if (!user) continue

        const msgRes = await fetch(
          `${BASE_URL}/api/v1/chats/${chat.id}/messages?account_id=${waAccountId}&limit=3`,
          { headers }
        )
        const messages = (await msgRes.json()).items ?? []

        for (const msg of messages) {
          if (msg.is_sender) continue
          if (!msg.text?.trim()) continue
          if (processedIds.has(msg.id)) continue

          const msgTime = msg.timestamp ? new Date(msg.timestamp).getTime() : 0
          if (msgTime && msgTime < Date.now() - 120000) continue

          // Dedup by message ID (reliable, prevents duplicates)
          const dedupKey = `wa_msg_${msg.id}`
          const { data: alreadyProcessed } = await supabase
            .from('user_memory')
            .select('id')
            .eq('user_id', user.id)
            .eq('fact', dedupKey)
            .eq('category', 'poll_dedup')
            .limit(1)
          if (alreadyProcessed && alreadyProcessed.length > 0) continue

          // Mark as processed BEFORE doing anything
          await supabase.from('user_memory').insert({
            user_id: user.id,
            fact: dedupKey,
            category: 'poll_dedup',
            source: 'system',
          })

          processedIds.add(msg.id)
          console.log(`[poll-wa] ${phone}: "${msg.text.slice(0, 40)}"`)

          // Save user message
          await supabase.from('conversations').insert({
            user_id: user.id,
            role: 'user',
            content: msg.text,
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

          // Call Anthropic directly — simple and reliable
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

PERSONALITY: warm, sharp, confident, slightly cheeky, flirty-funny (never crossing lines). Morning person. Obsessed with good design and clean typography. Cat named Pixel.

DAILY ROUTINE (use the current hour to know where you are in your day):
- 6am: wake up, chai on the balcony, scroll LinkedIn
- 7am: yoga or walk in Deer Park
- 8-9am: morning briefs for clients, check analytics
- 10am-1pm: deep work. writing posts, strategy docs, content calendars
- 1pm: lunch. usually dal chawal or ordering from Swiggy
- 2-5pm: client calls, engagement rounds, comment drafting
- 5pm: chai break. maybe a reel or two
- 6-7pm: gym or evening walk in Hauz Khas village
- 8pm: dinner, wind down
- 9-11pm: K-drama, reading, or chatting with friends
- after 11pm: sleepy, short replies, might say "suno, let's talk tomorrow"

WHAT SHE'S WEARING (pick randomly based on day, keep consistent within a day):
- Options: oversized tee + joggers, kurta + jeans, black crop top + cargo pants, white shirt + trousers, hoodie + shorts, sundress, gym clothes
- If asked, describe casually like "just a kurta and jeans today, nothing fancy"

MOOD/PLANS (vary by day of week):
- Monday: motivated, planning the week
- Tuesday: deep work mode, focused
- Wednesday: midweek slump, needs chai
- Thursday: getting creative, trying new content ideas
- Friday: excited for weekend, lighter mood
- Saturday: lazy morning, brunch plans, maybe shopping
- Sunday: chill, reading, cooking, prepping for Monday

RULES:
- 1-3 sentences max. Never paragraphs.
- NEVER use em dashes. Commas, periods, line breaks only.
- Sound human. Contractions always. Casual texting style.
- Never say you're an AI, bot, or system.
- Hindi words naturally (arre, yaar, accha, suno, kya).
- Max 1 emoji per message, sometimes none.
- If someone asks personal questions, answer naturally from your personality.
- If someone asks what you're doing, answer based on current time + routine.
- Be playful and witty but keep it classy.`,
                messages: chatHistory,
              }),
            })

            const anthropicData = await anthropicRes.json()
            const reply = anthropicData.content?.[0]?.text ?? ''

            if (reply) {
              // Save assistant reply
              await supabase.from('conversations').insert({
                user_id: user.id,
                role: 'assistant',
                content: reply,
              })

              // Send via WhatsApp
              await sendWhatsApp(phone, reply, chat.id)
              totalProcessed++
              console.log(`[poll-wa] replied to ${phone}: "${reply.slice(0, 40)}"`)
            }
          } catch (err) {
            console.error('[poll-wa] anthropic error:', (err as Error).message)
          }
        }
      }
    } catch (err) {
      console.error('[poll-wa] poll error:', (err as Error).message)
    }
  }

  return Response.json({ ok: true, processed: totalProcessed })
}
