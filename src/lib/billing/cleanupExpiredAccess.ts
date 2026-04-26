import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'

/**
 * Disconnect a user's billable Unipile account and clear their WhatsApp link
 * so we stop paying Unipile for an expired user.
 *
 * Idempotent — safe to call repeatedly. Returns what was actually cleared so
 * the caller can log/audit. Never throws (best-effort cleanup): failures are
 * logged but do not propagate.
 *
 * Called from:
 *   - `sendUpgradePromptIfNeeded` the first time the gate fires for a user
 *     who has past-trial access. Means the disconnect happens at the moment
 *     the user is told their access ended, not the next day.
 *   - `/api/cron/cleanup-expired` daily sweep, in case a user never sends a
 *     message after their trial ends (so the upgrade-prompt path never runs).
 */
export interface CleanupResult {
  userId: string
  unipileDeleted: boolean
  unipileAccountId: string | null
  whatsappCleared: boolean
}

export async function cleanupExpiredAccess(userId: string): Promise<CleanupResult> {
  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id, unipile_account_id, whatsapp_number, pending_whatsapp')
    .eq('id', userId)
    .single()

  if (!user) {
    return {
      userId,
      unipileDeleted: false,
      unipileAccountId: null,
      whatsappCleared: false,
    }
  }

  const result: CleanupResult = {
    userId,
    unipileDeleted: false,
    unipileAccountId: user.unipile_account_id ?? null,
    whatsappCleared: false,
  }

  // 1. Delete LinkedIn from Unipile (per-account billable). Skip if already
  //    cleared. We DO NOT touch Nivi's shared WhatsApp account — only the
  //    user's per-LinkedIn account.
  if (user.unipile_account_id) {
    const baseUrl = getEnv('UNIPILE_BASE_URL')
    const apiKey = getEnv('UNIPILE_API_KEY')
    if (baseUrl && apiKey) {
      try {
        const res = await fetch(
          `${baseUrl}/api/v1/accounts/${user.unipile_account_id}`,
          {
            method: 'DELETE',
            headers: { 'X-API-KEY': apiKey, accept: 'application/json' },
            signal: AbortSignal.timeout(8000),
          }
        )
        // Treat 404 as success (already gone) — we still null the column.
        if (res.ok || res.status === 404) {
          result.unipileDeleted = true
          console.log(
            `[cleanupExpiredAccess] deleted unipile account ${user.unipile_account_id} for user ${userId} (status=${res.status})`
          )
        } else {
          const body = await res.text()
          console.error(
            `[cleanupExpiredAccess] Unipile DELETE failed for ${userId}:`,
            res.status,
            body.slice(0, 200)
          )
        }
      } catch (err) {
        console.error(
          `[cleanupExpiredAccess] Unipile DELETE threw for ${userId}:`,
          (err as Error).message
        )
      }
    } else {
      console.error(
        '[cleanupExpiredAccess] UNIPILE_BASE_URL or UNIPILE_API_KEY missing — cannot delete account'
      )
    }
  }

  // 2. Clear the columns that gate WhatsApp routing + future Unipile calls.
  //    We do this even if the Unipile DELETE failed: the row in our DB no
  //    longer points at a paying account, and the next webhook from this
  //    number simply won't match a user.
  const hadWhatsApp = !!(user.whatsapp_number || user.pending_whatsapp)
  if (user.unipile_account_id || hadWhatsApp) {
    const { error: updErr } = await supabase
      .from('users')
      .update({
        unipile_account_id: null,
        linkedin_connected_at: null,
        whatsapp_number: null,
        pending_whatsapp: null,
      })
      .eq('id', userId)
    if (updErr) {
      console.error(
        `[cleanupExpiredAccess] DB clear failed for ${userId}:`,
        updErr.message
      )
    } else {
      result.whatsappCleared = hadWhatsApp
      console.log(
        `[cleanupExpiredAccess] cleared connection columns for user ${userId} (had_whatsapp=${hadWhatsApp})`
      )
    }
  }

  return result
}
