import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getEnv } from '@/lib/config'
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { buildPerformanceContext } from '@/lib/claude/performanceIntel'

export const maxDuration = 120

/**
 * Proactive Nivi — she texts users by herself when she has something worth saying.
 * Runs every 4 hours. Not every run sends a message — only when there's a reason.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${getEnv('CRON_SECRET')}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  const hour = now.getHours()

  // Only send proactive messages during reasonable hours (8 AM - 9 PM IST)
  if (hour < 8 || hour > 21) {
    return Response.json({ ok: true, skipped: 'outside hours' })
  }

  const { data: users } = await supabase
    .from('users')
    .select('id, name, whatsapp_number, timezone, onboarding_complete, created_at')
    .not('whatsapp_number', 'is', null)

  let sent = 0

  for (const user of users ?? []) {
    try {
      // Check when we last messaged this user proactively
      const { data: lastProactive } = await supabase
        .from('conversations')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('role', 'assistant')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      const lastMsgTime = lastProactive?.created_at ? new Date(lastProactive.created_at) : null
      const hoursSinceLastMsg = lastMsgTime
        ? (now.getTime() - lastMsgTime.getTime()) / 3600000
        : 999

      // Don't spam — minimum 3 hours between proactive messages
      if (hoursSinceLastMsg < 3) continue

      // Get performance context to decide what to say
      const perfContext = await buildPerformanceContext(user.id)

      // Get recent memories
      const { data: memories } = await supabase
        .from('user_memory')
        .select('fact, category')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)

      const memoryBlock = (memories ?? []).map(m => `[${m.category}] ${m.fact}`).join('\n')

      // Check if this is a NEW user (first 24 hours)
      const daysSinceSignup = Math.floor((now.getTime() - new Date(user.created_at).getTime()) / 86400000)
      const isNewUser = daysSinceSignup < 1

      // Check if context files exist
      const { data: ctx } = await supabase
        .from('context_files')
        .select('id')
        .eq('user_id', user.id)
        .single()

      const hasContextFiles = !!ctx

      // Build the proactive prompt
      let proactiveInstruction = ''

      if (isNewUser && !hasContextFiles) {
        // FIRST MESSAGE — introduce yourself properly
        proactiveInstruction = `This is a NEW user who just signed up. Send them a warm, personal introduction. You are Nivi (Nivedita), 27, from Almora, Uttarakhand. You are their personal brand strategist.

Your message should:
1. Introduce yourself warmly and briefly — first name, what you do, that youre excited to work with them
2. Ask them to fill in their profile on the dashboard so you can read their files and learn about them
3. Keep it casual and warm, like meeting someone for the first time
4. End with something like "once i go through your stuff, were gonna make a great team [name]"

MAX 3-4 short sentences. Sound like a real person, not an onboarding email.`

      } else if (isNewUser && hasContextFiles) {
        // They filled in context files — acknowledge it
        proactiveInstruction = `This user just set up their profile and you now have their context files. Send them a message like "oh i just went through your files and honestly? youre way more interesting than i expected lol. we're gonna be a great team ${user.name}. want me to write your first post?"`

      } else {
        // Existing user — decide if there's something worth saying
        proactiveInstruction = `You are Nivi proactively texting ${user.name}. Based on the performance data and memories below, decide if there's something genuinely worth messaging about RIGHT NOW.

Reasons to message (pick ONE, the most interesting):
- Their recent post is gaining traction (mention specific numbers)
- They havent posted in 3+ days (gentle nudge, offer to draft something)
- Follower growth milestone or profile views spike
- Someone interesting commented on their post
- A content idea based on whats trending in their niche
- Just checking in if they havent chatted in a while — be casual, not work-focused
- Noticed a pattern in their data worth sharing
- Someone they should connect with based on their niche

If theres NOTHING worth saying, respond with exactly: SKIP

If there IS something, write a short casual WhatsApp message (1-2 sentences max). Sound like youre just casually texting them, not running a campaign.

Performance data:
${perfContext}

Memories:
${memoryBlock}`
      }

      const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })

      const response = await anthropic.messages.create({
        model: pickModel('whatsapp-conversation'),
        max_tokens: 8192,
        messages: [{ role: 'user', content: proactiveInstruction }],
      })

      const message = response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : ''

      // Skip if Claude decided there's nothing to say
      if (!message || message === 'SKIP' || message.includes('SKIP')) continue

      // Send the proactive message
      await sendWhatsApp(user.whatsapp_number!, message)

      // Save to conversations
      await supabase.from('conversations').insert({
        user_id: user.id,
        role: 'assistant',
        content: message,
        message_type: 'proactive',
      })

      sent++
    } catch (err) {
      console.error(`[Proactive] Failed for ${user.id}:`, err)
    }
  }

  return Response.json({ ok: true, sent, time: now.toISOString() })
}
