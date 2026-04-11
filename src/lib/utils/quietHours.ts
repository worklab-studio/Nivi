/**
 * Quiet-hours utility — used by both the WhatsApp tool runner and the
 * scheduler cron to suppress LinkedIn write actions during the user's
 * local night-time window.
 *
 * The point: LinkedIn's bot detection flags accounts that perform
 * automated actions at 2am local time. Real humans sleep. Nivi should
 * too — for the user's account safety.
 */

export const QUIET_HOURS_START = 23 // 11 PM
export const QUIET_HOURS_END = 7 // 7 AM (exclusive)

/**
 * LinkedIn write actions that should be deferred during quiet hours.
 * Read-only tool calls (get_linkedin_feed, get_my_linkedin_posts,
 * get_profile_viewers, etc.) are NOT in this set — browsing your own
 * profile at night is normal human behavior.
 */
export const LINKEDIN_WRITE_ACTIONS = new Set([
  'publish_linkedin_post',
  'comment_on_linkedin_post',
  'react_to_post',
  'send_connection_request',
  'send_linkedin_dm',
  'check_comment_replies', // can auto-reply, treat as write
  'find_and_comment_on_niche_posts',
  'monitor_and_engage_keywords',
])

/**
 * Returns the user's current local hour (0-23) based on a tz string,
 * or null if the tz is invalid.
 */
export function getLocalHour(timezone: string): number | null {
  try {
    const tz = timezone || 'Asia/Kolkata'
    const hourStr = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      hour12: false,
    }).format(new Date())
    // Intl can return "24" for midnight in some envs — normalize to 0
    const h = parseInt(hourStr, 10) % 24
    return Number.isFinite(h) ? h : null
  } catch {
    return null
  }
}

/**
 * True if the user's local time is currently inside the quiet window.
 * Defaults to false (allow) on tz parse failure — fail open, not closed.
 */
export function isQuietHourFor(timezone: string): boolean {
  const hour = getLocalHour(timezone)
  if (hour === null) return false
  return hour >= QUIET_HOURS_START || hour < QUIET_HOURS_END
}

/**
 * Returns a Date corresponding to the next 7:30 AM in the user's local
 * timezone. Used by the scheduler to defer publishing of scheduled posts
 * that fall inside the quiet window.
 */
export function nextSevenThirtyLocal(timezone: string): Date {
  const tz = timezone || 'Asia/Kolkata'
  const now = new Date()

  // Get the user's current local Y/M/D/H
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(now)
  const get = (k: string) => parseInt(parts.find((p) => p.type === k)?.value ?? '0', 10)
  const y = get('year')
  const m = get('month') // 1-12
  const d = get('day')
  const h = get('hour') % 24

  // If it's currently before 7:30 AM local, target today at 07:30.
  // Otherwise target tomorrow at 07:30.
  let targetD = d
  if (h >= QUIET_HOURS_END) {
    targetD = d + 1
  }

  // Build an ISO string in the user's tz, then parse back to a Date.
  // The trick: construct the string as if it were UTC, then offset.
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(targetD).padStart(2, '0')}T07:30:00`
  // Use Intl to figure out the tz offset for that local instant
  const fakeUtc = new Date(`${iso}Z`)
  const tzOffsetMin = (() => {
    const inv = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).formatToParts(fakeUtc)
    const tzn = inv.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00'
    const match = tzn.match(/([+-])(\d{1,2}):?(\d{2})?/)
    if (!match) return 0
    const sign = match[1] === '+' ? 1 : -1
    const hh = parseInt(match[2], 10)
    const mm = parseInt(match[3] ?? '0', 10)
    return sign * (hh * 60 + mm)
  })()
  return new Date(fakeUtc.getTime() - tzOffsetMin * 60_000)
}
