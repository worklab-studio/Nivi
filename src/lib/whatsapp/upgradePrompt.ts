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
  const message = `Hey ${user.name}! Your Nivi access has ended.\n\nTo keep chatting with me on WhatsApp, upgrade to the Complete plan ($35/mo).\n\nVisit: ${appUrl}/pricing`

  // Send the prompt FIRST while we still know how to reach them (cleanup
  // clears whatsapp_number, so reversing the order would break delivery).
  await sendWhatsApp(user.whatsapp_number, message, chatId)

  await supabase.from('user_memory').insert({
    user_id: user.id,
    category: 'upgrade_prompt_sent',
    fact: `prompt_${Date.now()}`,
    source: 'system',
  })

  // Now disconnect: delete Unipile account, null out whatsapp_number /
  // pending_whatsapp / unipile_account_id. Best-effort; never throws.
  cleanupExpiredAccess(user.id).catch((err) =>
    console.error(`[upgradePrompt] cleanup failed for ${user.id}:`, err)
  )

  console.log(`[upgradePrompt] sent + scheduled cleanup for ${user.name} (${user.id})`)
  return { allowed: false, promptSent: true }
}
