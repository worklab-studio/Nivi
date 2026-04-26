import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'

/**
 * Disconnect a user's billable Unipile LinkedIn account when their trial or
 * subscription has ended, but KEEP their WhatsApp link intact so they can
 * still receive the upgrade prompt and reply to resubscribe.
 *
 * What we clear:
 *   - LinkedIn account on Unipile (per-account billable, stops the cost)
 *   - users.unipile_account_id, users.linkedin_connected_at
 *
 * What we do NOT clear:
 *   - users.whatsapp_number / users.pending_whatsapp — keeping these means
 *     the user can text "resubscribe", get matched in the webhook, hit the
 *     plan gate, and be told (once per 24h) to upgrade and reconnect their
 *     LinkedIn. Without this they'd just be silenced and confused.
 *
 * Idempotent — safe to call repeatedly. Returns what was actually cleared so
 * the caller can log/audit. Never throws (best-effort cleanup): failures are
 * logged but do not propagate.
 *
 * Called from:
 *   - `sendUpgradePromptIfNeeded` the first time the gate fires for a user
 *     who has past-trial access. Means the LinkedIn disconnect happens at
 *     the moment the user is told their access ended, not the next day.
 *   - `/api/cron/cleanup-expired` daily sweep, in case a user never sends a
 *     message after their trial ends (so the upgrade-prompt path never runs).
 */
export interface CleanupResult {
  userId: string
  unipileDeleted: boolean
  unipileAccountId: string | null
}

export async function cleanupExpiredAccess(userId: string): Promise<CleanupResult> {
  const supabase = getSupabaseAdmin()

  const { data: user } = await supabase
    .from('users')
    .select('id, unipile_account_id')
    .eq('id', userId)
    .single()

  if (!user) {
    return {
      userId,
      unipileDeleted: false,
      unipileAccountId: null,
    }
  }

  const result: CleanupResult = {
    userId,
    unipileDeleted: false,
    unipileAccountId: user.unipile_account_id ?? null,
  }

  if (!user.unipile_account_id) {
    // Nothing to clean up — no LinkedIn billable account.
    return result
  }

  // Delete LinkedIn from Unipile (per-account billable). We DO NOT touch
  // Nivi's shared WhatsApp account — only the user's per-LinkedIn account.
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

  // Null the LinkedIn columns regardless of Unipile API success — the local
  // DB no longer points at a paying account. Leave whatsapp_number alone so
  // the user can still receive the upgrade prompt.
  const { error: updErr } = await supabase
    .from('users')
    .update({
      unipile_account_id: null,
      linkedin_connected_at: null,
    })
    .eq('id', userId)
  if (updErr) {
    console.error(
      `[cleanupExpiredAccess] DB clear failed for ${userId}:`,
      updErr.message
    )
  } else {
    console.log(
      `[cleanupExpiredAccess] cleared LinkedIn columns for user ${userId}`
    )
  }

  return result
}
