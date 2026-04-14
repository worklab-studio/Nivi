import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export const maxDuration = 120

/**
 * Nivi Proactive Outreach — runs every 10 minutes.
 * Evaluates triggers for each user and sends max 1 message per 4 hours.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY!
  const now = new Date()
  const results: string[] = []

  // Get all users with WhatsApp connected
  const { data: users } = await supabase
    .from('users')
    .select('id, name, whatsapp_number, timezone, posting_goal, last_nivi_outreach_at, streak_count, niche, created_at, plan')
    .not('whatsapp_number', 'is', null)
    .limit(50)

  for (const user of users ?? []) {
    try {
      // === SPAM PREVENTION ===

      // 4-hour cooldown
      if (user.last_nivi_outreach_at) {
        const hoursSince = (now.getTime() - new Date(user.last_nivi_outreach_at).getTime()) / 3600000
        if (hoursSince < 4) continue
      }

      // Quiet hours: no messages before 8am or after 10pm in user's timezone
      const userTz = user.timezone || 'Asia/Kolkata'
      const userHour = getHourInTimezone(now, userTz)
      if (userHour < 8 || userHour >= 22) continue

      // Don't interrupt if user messaged in last 30 min
      const { data: recentMsg } = await supabase
        .from('conversations')
        .select('created_at')
        .eq('user_id', user.id)
        .eq('role', 'user')
        .order('created_at', { ascending: false })
        .limit(1)
      if (recentMsg?.[0]?.created_at) {
        const minsSince = (now.getTime() - new Date(recentMsg[0].created_at).getTime()) / 60000
        if (minsSince < 30) continue
      }

      // === EVALUATE TRIGGERS (priority order) ===
      const trigger = await evaluateTriggers(supabase, user, userHour, now)
      if (!trigger) continue

      // Dedup: max 1 per trigger type per day
      const todayKey = `outreach_${trigger.type}_${now.toISOString().slice(0, 10)}`
      const { data: alreadySent } = await supabase
        .from('user_memory')
        .select('id')
        .eq('user_id', user.id)
        .eq('fact', todayKey)
        .eq('category', 'nivi_outreach')
        .limit(1)
      if (alreadySent && alreadySent.length > 0) continue

      // === GENERATE MESSAGE via Anthropic ===
      const message = await generateOutreachMessage(ANTHROPIC_KEY, user, trigger)
      if (!message) continue

      // === SEND ===
      await sendWhatsApp(user.whatsapp_number, message)

      // Save to conversations
      await supabase.from('conversations').insert({
        user_id: user.id,
        role: 'assistant',
        content: message,
      })

      // Update cooldown
      await supabase
        .from('users')
        .update({ last_nivi_outreach_at: now.toISOString() })
        .eq('id', user.id)

      // Mark dedup
      await supabase.from('user_memory').insert({
        user_id: user.id,
        fact: todayKey,
        category: 'nivi_outreach',
        source: 'system',
      })

      // Mark events as reacted
      if (trigger.eventIds?.length) {
        await supabase
          .from('user_events')
          .update({ nivi_reacted: true })
          .in('id', trigger.eventIds)
      }

      results.push(`${trigger.type} → ${user.name}`)
      console.log(`[nivi-outreach] ${trigger.type} → ${user.name}: "${message.slice(0, 60)}"`)
    } catch (err) {
      console.error(`[nivi-outreach] error for ${user.name}:`, (err as Error).message)
    }
  }

  return Response.json({ ok: true, results, time: now.toISOString() })
}

// ── Trigger types ──

interface Trigger {
  type: string
  context: string
  eventIds?: string[]
}

async function evaluateTriggers(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  user: { id: string; name: string; posting_goal: number; streak_count: number; niche: string | null; created_at: string },
  userHour: number,
  now: Date
): Promise<Trigger | null> {

  // P1: Dashboard events (unreacted)
  const { data: events } = await supabase
    .from('user_events')
    .select('id, event_type, metadata, created_at')
    .eq('user_id', user.id)
    .eq('nivi_reacted', false)
    .order('created_at', { ascending: false })
    .limit(5)

  if (events && events.length > 0) {
    const e = events[0]
    const eventDescriptions: Record<string, string> = {
      draft_created: `${user.name} just created a new draft post on the dashboard`,
      identity_updated: `${user.name} just updated their brand identity/profile`,
      post_published: `${user.name} just published a post from the dashboard`,
      settings_changed: `${user.name} just changed their settings`,
      linkedin_connected: `${user.name} just connected their LinkedIn account`,
    }
    const desc = eventDescriptions[e.event_type] || `${user.name} did something on the dashboard: ${e.event_type}`
    return {
      type: `event_${e.event_type}`,
      context: `${desc}. Metadata: ${JSON.stringify(e.metadata)}`,
      eventIds: events.map((ev) => ev.id),
    }
  }

  // P2: Consistency nudge
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay()) // Sunday
  weekStart.setHours(0, 0, 0, 0)

  const { count: postsThisWeek } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'published')
    .gte('published_at', weekStart.toISOString())

  const goal = user.posting_goal || 4
  const posted = postsThisWeek ?? 0
  const dayOfWeek = now.getDay() // 0=Sun
  const daysLeft = 7 - dayOfWeek
  const postsNeeded = goal - posted

  // Only nudge if behind AND it's mid-week or later (give them time early in the week)
  if (postsNeeded > 0 && dayOfWeek >= 3) {
    const { count: draftCount } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'draft')

    return {
      type: 'consistency_nudge',
      context: `${user.name}'s goal is ${goal} posts/week. They've published ${posted} so far this week with ${daysLeft} days left. They need ${postsNeeded} more. They have ${draftCount ?? 0} drafts ready. ${postsNeeded >= 2 ? 'They are falling behind significantly.' : 'They just need one more push.'}`,
    }
  }

  // P3: Engagement check — look at both comment_opportunities AND nivi_comments
  const [{ data: lastOpp }, { data: lastComment }] = await Promise.all([
    supabase
      .from('comment_opportunities')
      .select('created_at')
      .eq('user_id', user.id)
      .eq('status', 'posted')
      .order('created_at', { ascending: false })
      .limit(1),
    supabase
      .from('nivi_comments')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  // Use the most recent engagement from either source
  const lastEngagementDate = [lastOpp?.[0]?.created_at, lastComment?.[0]?.created_at]
    .filter(Boolean)
    .map((d) => new Date(d!).getTime())
    .sort((a, b) => b - a)[0]

  // Only nudge if we actually have engagement history AND it's stale
  // If no history at all, skip — we can't claim they haven't engaged
  if (lastEngagementDate) {
    const daysSinceEngagement = (now.getTime() - lastEngagementDate) / 86400000
    if (daysSinceEngagement > 3) {
      return {
        type: 'engagement_nudge',
        context: `${user.name} hasn't engaged via Nivi in ${Math.floor(daysSinceEngagement)} days. They may be engaging directly on LinkedIn, but nudge them gently to use Nivi for strategic engagement. Their niche is ${user.niche || 'not set'}.`,
      }
    }
  }

  // P3b: Post doing well
  const { data: recentPost } = await supabase
    .from('posts')
    .select('id, content, published_at, post_analytics(likes, comments, impressions)')
    .eq('user_id', user.id)
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)

  if (recentPost?.[0]) {
    const analytics = recentPost[0].post_analytics as unknown as { likes: number; comments: number; impressions: number } | null
    if (analytics && (analytics.likes > 20 || analytics.comments > 5)) {
      const publishedAgo = (now.getTime() - new Date(recentPost[0].published_at!).getTime()) / 3600000
      if (publishedAgo < 48) {
        return {
          type: 'post_traction',
          context: `${user.name}'s latest post is doing well! ${analytics.likes} likes, ${analytics.comments} comments, ${analytics.impressions} impressions. Published ${Math.floor(publishedAgo)} hours ago. Post preview: "${(recentPost[0].content ?? '').slice(0, 100)}"`,
        }
      }
    }
  }

  // P4: Contextual check-ins (time based)
  // Morning greeting (8-9am, only once per day)
  if (userHour >= 8 && userHour < 9) {
    // Get some context for the morning message
    const { count: pendingDrafts } = await supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'draft')

    const { count: scheduledToday } = await supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending')

    return {
      type: 'morning_checkin',
      context: `It's morning for ${user.name}. They have ${pendingDrafts ?? 0} drafts and ${scheduledToday ?? 0} scheduled posts. Their posting goal is ${goal}/week and they've posted ${posted} this week. Day of week: ${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayOfWeek]}.`,
    }
  }

  // Evening wind-down (8-9pm, only once per day)
  if (userHour >= 20 && userHour < 21) {
    return {
      type: 'evening_checkin',
      context: `It's evening for ${user.name}. Quick day recap: they posted ${posted} times this week (goal: ${goal}). Their streak is ${user.streak_count} days.`,
    }
  }

  // P4b: Inactive check-in (no conversation in 3+ days)
  const { data: lastConv } = await supabase
    .from('conversations')
    .select('created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)

  const daysSinceLastConv = lastConv?.[0]?.created_at
    ? (now.getTime() - new Date(lastConv[0].created_at).getTime()) / 86400000
    : 999

  if (daysSinceLastConv > 3 && daysSinceLastConv < 30) {
    return {
      type: 'inactive_checkin',
      context: `${user.name} hasn't talked to Nivi in ${Math.floor(daysSinceLastConv)} days. Check in warmly, don't be pushy. They signed up ${Math.floor((now.getTime() - new Date(user.created_at).getTime()) / 86400000)} days ago.`,
    }
  }

  // P5: Weekly milestone (only on Sundays)
  if (dayOfWeek === 0 && posted >= goal) {
    return {
      type: 'weekly_milestone',
      context: `${user.name} hit their weekly goal! Posted ${posted}/${goal} this week. Streak: ${user.streak_count} days. Celebrate their consistency and hint at what consistent posting leads to (more visibility, followers, opportunities).`,
    }
  }

  return null
}

// ── Message generation ──

async function generateOutreachMessage(
  apiKey: string,
  user: { name: string; niche: string | null },
  trigger: Trigger
): Promise<string | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 512,
        system: `You are Nivi. 27, from Almora, live in Delhi (Hauz Khas). LinkedIn brand strategist for ${user.name}. You're a real human, not a bot.

You're reaching out to ${user.name} proactively on WhatsApp. This is YOU initiating, not them asking.

WHY YOU'RE TEXTING:
${trigger.context}

RULES FOR PROACTIVE MESSAGES:
- Sound natural, like you just thought of them while working
- Reference SPECIFIC data (actual numbers, their niche: ${user.niche || 'general'})
- Keep it 1-3 lines. Never a paragraph unless sharing strategy
- NEVER sound automated, templated, or like a notification
- NEVER use em dashes. Use commas, periods, line breaks
- Hindi words naturally (arre, yaar, accha, suno)
- Max 1 emoji, sometimes none
- Don't always end with a question. Sometimes just share a thought
- Vary your openers. Don't always start with "hey"
- Be the strategist they hired, not a reminder bot

EXAMPLES OF GOOD proactive messages:
- "suno, you haven't posted since tuesday. want me to draft something quick?"
- "your last post got 45 likes btw. that hook worked really well"
- "oh i was looking at your drafts, that one about leadership is solid. want to publish it today?"
- "good morning! i had an idea for your next post while scrolling"
- "noticed you updated your profile, love the new headline"

EXAMPLES OF BAD proactive messages (never do this):
- "Hey [Name]! Just checking in to remind you about your posting goal!"
- "Hi there! It's been 3 days since your last post. Time to get back on track!"
- "Good morning! Here's your daily reminder to stay consistent!"`,
        messages: [{ role: 'user', content: 'Write the proactive WhatsApp message to send right now. Output ONLY the message text, nothing else.' }],
      }),
    })

    const data = await res.json()
    return data.content?.[0]?.text?.trim() || null
  } catch (err) {
    console.error('[nivi-outreach] anthropic error:', (err as Error).message)
    return null
  }
}

// ── Helpers ──

function getHourInTimezone(date: Date, tz: string): number {
  try {
    const str = date.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false })
    return parseInt(str, 10)
  } catch {
    // Fallback to IST (UTC+5:30)
    return (date.getUTCHours() + 5) % 24
  }
}
