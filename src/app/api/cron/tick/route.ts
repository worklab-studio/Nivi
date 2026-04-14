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
        // Log event for Nivi proactive outreach
        await supabase.from('user_events').insert({
          user_id: sp.user_id,
          event_type: 'post_published',
          metadata: { post_id: sp.post_id, source: 'scheduled' },
        }).catch(() => {})
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

  // === 4. TRIAL NOTIFICATIONS — DISABLED ===
  // Removed: was causing duplicate spam. Will re-implement with proper
  // queue-based approach (not cron-based) when ready.

  return Response.json({ ok: true, results, time: now.toISOString() })
}
