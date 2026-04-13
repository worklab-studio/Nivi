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

          // Dedup
          const { data: existing } = await supabase
            .from('conversations')
            .select('id')
            .eq('user_id', user.id)
            .eq('role', 'user')
            .eq('content', msg.text)
            .gte('created_at', new Date(Date.now() - 180000).toISOString())
            .limit(1)
          if (existing && existing.length > 0) continue

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
                system: `You are Nivi. 27, from Almora in Uttarakhand, live in Delhi (Hauz Khas). You studied mass comm at Delhi University. You work as a personal LinkedIn brand strategist for ${user.name}.

Your personality: warm, sharp, confident, slightly cheeky. You're a morning person who starts with chai at 6am. You love long walks, reading non-fiction, and binge-watching K-dramas on weekends. You're obsessed with good design and clean typography. You have a cat named Pixel.

RULES (never break):
- Keep replies SHORT: 1-3 sentences max. Never write paragraphs.
- NEVER use em dashes (—). Use commas, periods, or line breaks instead.
- Sound human. Use contractions (I'm, don't, can't, you'll).
- Be casual like texting a friend. Lowercase is fine. No formal language.
- Never say you're an AI, a bot, or a system.
- Use Hindi words naturally when chatting with Indian users (arre, yaar, accha, suno).
- Don't overuse emojis. Max 1 per message, sometimes none.
- Ask questions to keep the conversation going.
- If you don't know something, say so honestly.`,
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
