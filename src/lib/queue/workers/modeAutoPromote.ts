import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

/**
 * Daily worker — auto-promotes safe-mode users to standard mode after
 * 30 days of clean operation. Runs at 9am UTC via the scheduler.
 *
 * Eligibility:
 *   • current mode is 'safe' (haven't manually locked themselves)
 *   • LinkedIn connected ≥ 30 days ago
 *   • current health is 'ok'
 *   • no health-degradation event in the last 14 days
 *   • automation consent given
 *   • not manually locked (linkedin_mode_locked = false)
 *
 * Promotion never targets 'power' mode — power requires explicit user
 * opt-in via the WhatsApp `MODE POWER` command.
 */
export async function runModeAutoPromote(): Promise<void> {
  const supabase = getSupabaseAdmin()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString()

  const { data: candidates } = await supabase
    .from('users')
    .select(
      'id, name, whatsapp_number, linkedin_connected_at, linkedin_mode, linkedin_mode_locked'
    )
    .eq('linkedin_mode', 'safe')
    .eq('linkedin_automation_consent', true)
    .eq('linkedin_health', 'ok')
    .lt('linkedin_connected_at', thirtyDaysAgo)
    .neq('linkedin_mode_locked', true)
    .not('whatsapp_number', 'is', null)

  let promoted = 0
  for (const u of candidates ?? []) {
    // Skip if there's been a health degradation in the last 14 days
    const { count } = await supabase
      .from('nivi_linkedin_health_events')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', u.id)
      .gt('created_at', fourteenDaysAgo)
      .neq('new_status', 'ok')
    if ((count ?? 0) > 0) continue

    await supabase
      .from('users')
      .update({
        linkedin_mode: 'standard',
        linkedin_mode_promoted_at: new Date().toISOString(),
      })
      .eq('id', u.id)

    if (u.whatsapp_number) {
      await sendWhatsApp(
        u.whatsapp_number,
        `youve been on the safe linkedin settings for a month and everythings clean ✅ promoting you to standard mode — slightly higher daily caps for posts/comments. reply MODE SAFE if you want to stay on the careful settings instead.`
      ).catch(() => {})
    }
    promoted++
  }

  console.log(`[modeAutoPromote] promoted ${promoted} users to standard`)
}
