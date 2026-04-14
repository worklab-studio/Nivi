import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getEnv } from '@/lib/config'

export const maxDuration = 60

/**
 * Universal cron tick — call this every minute via setInterval or external cron.
 * Handles: reminders, proactive messages, scheduled posts, comment digests.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${getEnv('CRON_SECRET')}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  const results: string[] = []

  // === 1. REMINDERS ===
  try {
    // Check user_memory for REMINDER| entries (fallback storage)
    const { data: memoryReminders } = await supabase
      .from('user_memory')
      .select('id, user_id, fact')
      .eq('source', 'reminder')
      .limit(20)

    for (const m of memoryReminders ?? []) {
      if (!m.fact.startsWith('REMINDER|')) continue
      const parts = m.fact.split('|')
      if (parts.length < 3) continue

      const remindAt = new Date(parts[1])
      if (remindAt <= now) {
        const reminderText = parts.slice(2).join('|')
        const { data: user } = await supabase
          .from('users')
          .select('whatsapp_number')
          .eq('id', m.user_id)
          .single()

        if (user?.whatsapp_number) {
          await sendWhatsApp(user.whatsapp_number, `hey! you asked me to remind you: ${reminderText}`)
          await supabase.from('user_memory').delete().eq('id', m.id)
          results.push(`reminder sent to ${m.user_id}`)
        }
      }
    }

    // Also check reminders table if it exists
    const { data: tableReminders } = await supabase
      .from('reminders')
      .select('id, user_id, reminder_text, users!inner(whatsapp_number)')
      .eq('status', 'pending')
      .lte('remind_at', now.toISOString())
      .limit(20)

    for (const r of tableReminders ?? []) {
      const phone = (r.users as unknown as { whatsapp_number: string })?.whatsapp_number
      if (phone) {
        await sendWhatsApp(phone, `hey! you asked me to remind you: ${r.reminder_text}`)
        await supabase.from('reminders').update({ status: 'sent' }).eq('id', r.id)
        results.push(`reminder sent`)
      }
    }
  } catch { /* reminders table might not exist */ }

  // === 2. SCHEDULED POSTS ===
  try {
    const { data: duePosts } = await supabase
      .from('scheduled_posts')
      .select('id, post_id, user_id')
      .eq('status', 'pending')
      .lte('scheduled_at', now.toISOString())
      .limit(10)

    for (const sp of duePosts ?? []) {
      const { publishToLinkedIn } = await import('@/lib/unipile/posts')
      await supabase.from('scheduled_posts').update({ status: 'processing' }).eq('id', sp.id)
      try {
        await publishToLinkedIn(sp.user_id, sp.post_id)
        await supabase.from('scheduled_posts').update({ status: 'done' }).eq('id', sp.id)
        results.push(`scheduled post published`)
      } catch {
        await supabase.from('scheduled_posts').update({ status: 'failed' }).eq('id', sp.id)
      }
    }
  } catch { /* skip */ }

  // === 3. LINKEDIN ANALYTICS SYNC (once daily, only active paid users) ===
  try {
    const { data: users } = await supabase
      .from('users')
      .select('id, unipile_account_id')
      .not('unipile_account_id', 'is', null)
      .in('plan', ['dashboard', 'complete'])
      .limit(50)

    // Only run between 3-4 AM UTC to avoid duplicate runs
    const hour = now.getUTCHours()
    if (hour === 3) {
      for (const u of users ?? []) {
        try {
          const { syncLinkedInAnalytics } = await import('@/lib/unipile/syncAnalytics')
          const result = await syncLinkedInAnalytics(u.id)
          results.push(`analytics synced for ${u.id}: ${result.synced} posts`)
        } catch {
          // skip failed syncs
        }
      }
    }
  } catch { /* skip */ }

  // === 4. TRIAL NOTIFICATIONS ===
  try {
    const { data: trialUsers } = await supabase
      .from('users')
      .select('id, name, whatsapp_number, plan, created_at')
      .eq('plan', 'free')
      .not('whatsapp_number', 'is', null)
      .limit(50)

    for (const u of trialUsers ?? []) {
      const createdAt = new Date(u.created_at).getTime()
      const daysSinceSignup = Math.floor((Date.now() - createdAt) / 86400000)

      // Day 0: Welcome message (only within first hour)
      const hoursSinceSignup = (Date.now() - createdAt) / 3600000
      if (hoursSinceSignup < 1) {
        // Check if we already sent welcome (count all markers)
        const { count: sentCount } = await supabase
          .from('user_memory')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', u.id)
          .eq('category', 'trial_welcome_sent')

        if ((sentCount ?? 0) === 0) {
          // Insert marker FIRST, then send
          await supabase.from('user_memory').insert({
            user_id: u.id,
            category: 'trial_welcome_sent',
            fact: `sent_${Date.now()}`,
            source: 'system',
          })

          // Re-check immediately — if another cron inserted between our check and insert,
          // there will be more than 1 row. Only send if we're the first.
          const { count: doubleCheck } = await supabase
            .from('user_memory')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)
            .eq('category', 'trial_welcome_sent')

          if ((doubleCheck ?? 0) <= 1) {
            await sendWhatsApp(
              u.whatsapp_number,
              `hey ${u.name}! welcome to hello nivi 🎉\n\nyour 7-day free trial just started. here's what i can do for you:\n\n- write linkedin posts in your voice\n- draft strategic comments\n- manage your content calendar\n- morning briefs every day\n\njust text me anytime. let's start with your first post?`
            )
            results.push(`trial welcome sent to ${u.name}`)
          }
        }
      }

      // Day 6: Expiry warning
      if (daysSinceSignup === 6) {
        const { data: sent } = await supabase
          .from('user_memory')
          .select('id')
          .eq('user_id', u.id)
          .eq('category', 'trial_expiry_sent')
          .limit(1)

        if (!sent || sent.length === 0) {
          // Insert marker FIRST then double-check to prevent race conditions
          await supabase.from('user_memory').insert({
            user_id: u.id,
            category: 'trial_expiry_sent',
            fact: `sent_${Date.now()}`,
            source: 'system',
          })
          const { count: doubleCheck } = await supabase
            .from('user_memory')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)
            .eq('category', 'trial_expiry_sent')
          if ((doubleCheck ?? 0) > 1) continue

          // Count what we did together
          const { count: postCount } = await supabase
            .from('posts')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)

          const { count: commentCount } = await supabase
            .from('comment_opportunities')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)
            .eq('status', 'posted')

          const { count: convCount } = await supabase
            .from('conversations')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', u.id)

          await sendWhatsApp(
            u.whatsapp_number,
            `hey ${u.name}, just checking in.\n\nwe had an amazing week together. here's what we did:\n- ${postCount ?? 0} posts created\n- ${commentCount ?? 0} strategic comments\n- ${convCount ?? 0} conversations\n\nhowever, i see you haven't upgraded your hello nivi plan yet. i have just 1 day left to work with you.\n\nmake sure you upgrade if you want us to keep working together on your linkedin: ${process.env.NEXT_PUBLIC_APP_URL}/pricing`
          )
          results.push(`trial expiry warning sent to ${u.name}`)
        }
      }
    }
  } catch { /* skip */ }

  return Response.json({ ok: true, results, time: now.toISOString() })
}
