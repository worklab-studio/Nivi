import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkPlan } from '@/lib/utils/planGating'
import { cleanupExpiredAccess } from '@/lib/billing/cleanupExpiredAccess'
import { sendWhatsApp } from './send'

const UPGRADE_PROMPT_COOLDOWN_HOURS = 24

/**
 * If the user's trial/subscription has ended, send a fixed upgrade prompt
 * (rate-limited to once per 24h), cut off their billable Unipile account,
 * and return { allowed: false }. Caller should skip any further processing
 * when allowed=false.
 *
 * Trial users (within 7 days of signup) and paid users (dashboard/complete)
 * pass through with allowed=true.
 *
 * Disconnect-on-expiry rationale: Unipile bills per connected account, so
 * leaving an expired user's LinkedIn linked is a real recurring cost. We
 * delete the Unipile account and clear the user's whatsapp_number the same
 * moment we tell them their access ended.
 */
export async function sendUpgradePromptIfNeeded(
  user: { id: string; name: string; whatsapp_number: string },
  chatId?: string
): Promise<{ allowed: boolean; promptSent: boolean }> {
  const { allowed } = await checkPlan(user.id, 'complete')
  if (allowed) return { allowed: true, promptSent: false }

  const supabase = getSupabaseAdmin()
  const cooldownAgo = new Date(
    Date.now() - UPGRADE_PROMPT_COOLDOWN_HOURS * 3600_000
  ).toISOString()

  const { data: recentPrompt } = await supabase
    .from('user_memory')
    .select('id')
    .eq('user_id', user.id)
    .eq('category', 'upgrade_prompt_sent')
    .gte('created_at', cooldownAgo)
    .limit(1)

  if (recentPrompt && recentPrompt.length > 0) {
    return { allowed: false, promptSent: false }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hellonivi.com'
  // The prompt mentions reconnecting LinkedIn because we delete the user's
  // Unipile LinkedIn account on cleanup — they need to relink it after they
  // resubscribe. WhatsApp stays connected so this very message can be
  // delivered and so they can reply to upgrade.
  const message = `hey ${user.name}, your nivi trial has ended.\n\nresubscribe to keep chatting on whatsapp: ${appUrl}/pricing\n\nonce you're back, you'll need to reconnect your linkedin from the dashboard so i can keep posting + tracking analytics for you.`

  await sendWhatsApp(user.whatsapp_number, message, chatId)

  await supabase.from('user_memory').insert({
    user_id: user.id,
    category: 'upgrade_prompt_sent',
    fact: `prompt_${Date.now()}`,
    source: 'system',
  })

  // Disconnect LinkedIn (per-Unipile-account billable) but leave the user's
  // WhatsApp number intact so future "resubscribed" / "i upgraded" messages
  // still reach us. Best-effort; never throws.
  cleanupExpiredAccess(user.id).catch((err) =>
    console.error(`[upgradePrompt] cleanup failed for ${user.id}:`, err)
  )

  console.log(`[upgradePrompt] sent + scheduled LinkedIn cleanup for ${user.name} (${user.id})`)
  return { allowed: false, promptSent: true }
}
