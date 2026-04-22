import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkPlan } from '@/lib/utils/planGating'
import { sendWhatsApp } from './send'

const UPGRADE_PROMPT_COOLDOWN_HOURS = 24

/**
 * If the user's trial/subscription has ended, send a fixed upgrade prompt
 * (rate-limited to once per 24h) and return { allowed: false }.
 * Caller should skip any further processing when allowed=false.
 *
 * Trial users (within 7 days of signup) and paid users (dashboard/complete)
 * pass through with allowed=true.
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

  await sendWhatsApp(user.whatsapp_number, message, chatId)

  await supabase.from('user_memory').insert({
    user_id: user.id,
    category: 'upgrade_prompt_sent',
    fact: `prompt_${Date.now()}`,
    source: 'system',
  })

  console.log(`[upgradePrompt] sent to ${user.name} (${user.id})`)
  return { allowed: false, promptSent: true }
}
