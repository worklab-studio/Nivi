import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * LinkedIn rate limits — enforced per user per day.
 *
 * Three caps tables corresponding to the three aggressiveness modes:
 *
 *   • SAFE_LIMITS     — applied to (a) accounts under NEW_ACCOUNT_DAYS old,
 *                       (b) accounts in 'safe' mode, (c) any account in a
 *                       degraded health state. The most conservative caps,
 *                       designed to stay deep below LinkedIn's natural
 *                       soft thresholds.
 *   • STANDARD_LIMITS — default for warm accounts after auto-promotion
 *                       (or backfilled from the Tier 2 migration). Roughly
 *                       the average human's daily LinkedIn activity.
 *   • POWER_LIMITS    — opt-in only via the WhatsApp `MODE POWER` command,
 *                       gated on 60+ days of connection age and 30+ days
 *                       on standard mode. Slightly higher caps but still
 *                       capped well below LinkedIn's hard limits.
 *
 * The point is to NEVER trip LinkedIn's bot detection, NOT to maximize
 * automation throughput. Even POWER_LIMITS are conservative.
 */
const SAFE_LIMITS: Record<string, number> = {
  connection_request: 3,
  comment: 2,
  post: 1,
  reaction: 5,
  dm: 1,
}

const STANDARD_LIMITS: Record<string, number> = {
  connection_request: 15,
  comment: 6,
  post: 1,
  reaction: 15,
  dm: 5,
}

const POWER_LIMITS: Record<string, number> = {
  connection_request: 20,
  comment: 8,
  post: 1,
  reaction: 20,
  dm: 8,
}

const NEW_ACCOUNT_DAYS = 14

type LinkedInMode = 'safe' | 'standard' | 'power'
type LinkedInHealth = 'ok' | 'credentials' | 'restricted' | 'stopped' | 'unknown'

interface UserModeContext {
  isNew: boolean
  mode: LinkedInMode
  health: LinkedInHealth
}

/**
 * Pull the user's mode + connection age + health status. Falls back to
 * the most-conservative defaults on any missing data.
 */
async function getUserModeContext(userId: string): Promise<UserModeContext> {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('users')
    .select('linkedin_connected_at, linkedin_mode, linkedin_health')
    .eq('id', userId)
    .single()

  const connectedAtIso = data?.linkedin_connected_at as string | undefined
  const connectedAtMs = connectedAtIso ? new Date(connectedAtIso).getTime() : 0
  const isNew = connectedAtMs > 0 && Date.now() - connectedAtMs < NEW_ACCOUNT_DAYS * 86400000

  const mode = (data?.linkedin_mode as LinkedInMode) ?? 'safe'
  const health = (data?.linkedin_health as LinkedInHealth) ?? 'ok'
  return { isNew, mode, health }
}

/**
 * Pick the right cap table for this user.
 *   • Any non-ok health → SAFE (defense in depth; the executeTool guard
 *     also blocks the action upstream).
 *   • Any account < 14 days from connection → SAFE (overrides mode).
 *   • Otherwise: respect the user's mode.
 */
async function getEffectiveLimit(userId: string, action: string): Promise<number> {
  const { isNew, mode, health } = await getUserModeContext(userId)
  if (health !== 'ok') return SAFE_LIMITS[action] ?? 0
  if (isNew) return SAFE_LIMITS[action] ?? 0
  const table =
    mode === 'power' ? POWER_LIMITS : mode === 'standard' ? STANDARD_LIMITS : SAFE_LIMITS
  return table[action] ?? 100
}

/**
 * Check if an action is within rate limits.
 * Uses user_memory to track daily counts (simple, no extra table needed).
 */
export async function checkRateLimit(
  userId: string,
  action: string
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const supabase = getSupabaseAdmin()
  const today = new Date().toISOString().split('T')[0]
  const limit = await getEffectiveLimit(userId, action)

  // Count today's increments for this action (each is a row tagged source='rate_limit')
  const { count } = await supabase
    .from('user_memory')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('source', 'rate_limit')
    .like('fact', `RATE|${today}|${action}|%`)

  const current = count ?? 0
  const allowed = current < limit
  return { allowed, remaining: limit - current, limit }
}

/**
 * Increment the rate limit counter for an action
 */
export async function incrementRateLimit(
  userId: string,
  action: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const today = new Date().toISOString().split('T')[0]
  const key = `RATE|${today}|${action}|${Date.now()}`

  await supabase.from('user_memory').insert({
    user_id: userId,
    fact: key,
    category: 'pattern',
    confidence: 1.0,
    source: 'rate_limit',
  })
}

/**
 * Clean up old rate limit entries (call daily)
 */
export async function cleanupRateLimits(): Promise<void> {
  const supabase = getSupabaseAdmin()
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  await supabase
    .from('user_memory')
    .delete()
    .eq('source', 'rate_limit')
    .lt('fact', `RATE|${yesterday}`)
}
