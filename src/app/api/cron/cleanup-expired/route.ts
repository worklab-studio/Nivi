import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { cleanupExpiredAccess } from '@/lib/billing/cleanupExpiredAccess'
import { getEnv } from '@/lib/config'

export const maxDuration = 300

const TRIAL_DAYS = 7
// One-day grace after trial/subscription end before we revoke Unipile, so a
// user who upgrades on day 8 doesn't get whacked between cron runs.
const POST_EXPIRY_GRACE_DAYS = 1

/**
 * Daily sweep: find users whose trial or paid subscription has ended and
 * still have a billable Unipile LinkedIn account, then run
 * cleanupExpiredAccess on each.
 *
 * Note we ONLY target users with a Unipile LinkedIn account here. WhatsApp
 * stays connected after expiry (so the user can receive the upgrade prompt
 * and reply to resubscribe), so a present whatsapp_number alone is not a
 * cleanup trigger.
 *
 * The upgrade-prompt path (sendUpgradePromptIfNeeded) already disconnects
 * LinkedIn on the first post-expiry message. This cron catches users who
 * never text after expiring (so the prompt path never fires) and we'd
 * otherwise pay Unipile fees forever.
 *
 * Cron schedule wired in vercel.json: daily at 03:30 UTC.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = getEnv('CRON_SECRET')
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()

  const now = Date.now()
  const trialCutoff = new Date(
    now - (TRIAL_DAYS + POST_EXPIRY_GRACE_DAYS) * 86400000
  ).toISOString()
  const paidGraceCutoff = new Date(
    now - POST_EXPIRY_GRACE_DAYS * 86400000
  ).toISOString()

  // Two cohorts to clean up:
  //   A. plan='free' AND created_at older than (TRIAL + grace) days — trial
  //      ended without conversion.
  //   B. plan_expires_at older than (grace) days — paid plan was cancelled
  //      and the post-cancellation period has passed.
  // Both cohorts must still have an attached LinkedIn (unipile_account_id)
  // — that's the only billable resource we revoke. WhatsApp stays linked.
  const { data: expiredFree } = await supabase
    .from('users')
    .select('id, email, plan, created_at, unipile_account_id')
    .eq('plan', 'free')
    .lt('created_at', trialCutoff)
    .not('unipile_account_id', 'is', null)

  const { data: expiredPaid } = await supabase
    .from('users')
    .select('id, email, plan, plan_expires_at, unipile_account_id')
    .not('plan_expires_at', 'is', null)
    .lt('plan_expires_at', paidGraceCutoff)
    .not('unipile_account_id', 'is', null)

  const candidates = [...(expiredFree ?? []), ...(expiredPaid ?? [])]
  // Dedupe by id in case a user matches both queries.
  const seen = new Set<string>()
  const unique = candidates.filter((c) => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })

  console.log(
    `[cleanup-expired] candidates: ${unique.length} (free=${expiredFree?.length ?? 0}, paid_lapsed=${expiredPaid?.length ?? 0})`
  )

  const results: Array<{
    userId: string
    email?: string
    unipileDeleted: boolean
  }> = []

  for (const u of unique) {
    const r = await cleanupExpiredAccess(u.id)
    results.push({
      userId: r.userId,
      email: u.email ?? undefined,
      unipileDeleted: r.unipileDeleted,
    })
  }

  const unipileFreed = results.filter((r) => r.unipileDeleted).length
  console.log(`[cleanup-expired] done: unipile_freed=${unipileFreed}`)

  return Response.json({
    ok: true,
    processed: unique.length,
    unipileFreed,
    results,
  })
}
