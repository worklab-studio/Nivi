import { currentUser } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { captureServerEvent } from '@/lib/analytics/posthog'

// In-memory cache of confirmed users — avoids Supabase round-trip on every API call.
// Survives across requests within the same Vercel function instance (~10-15 min lifetime).
// Worst case on cold start: one extra Supabase query, then cached.
const KNOWN_USERS = new Set<string>()

/**
 * Ensures a Supabase user row exists for the given Clerk userId.
 * If missing (e.g., webhook didn't fire), creates it from Clerk profile.
 * Idempotent — safe to call repeatedly. Cached in-memory for speed.
 */
export async function ensureUser(userId: string): Promise<void> {
  // Hot path: already confirmed this user in this function instance
  if (KNOWN_USERS.has(userId)) return

  const supabase = getSupabaseAdmin()

  // Cold path: check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) {
    KNOWN_USERS.add(userId)
    return
  }

  // User missing — fetch from Clerk and create
  try {
    const clerk = await currentUser()
    if (!clerk || clerk.id !== userId) {
      console.error('[ensureUser] Clerk user mismatch or not found:', userId)
      return
    }

    const email = clerk.emailAddresses[0]?.emailAddress || ''
    const name = `${clerk.firstName ?? ''} ${clerk.lastName ?? ''}`.trim() || 'User'

    // Stagger posting time across new signups
    const slots: string[] = []
    for (let h = 8; h <= 11; h++) {
      for (const m of [0, 15, 30, 45]) {
        if (h === 11 && m > 30) continue
        slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
      }
    }
    const postingTime = slots[Math.floor(Math.random() * slots.length)]

    await supabase.from('users').insert({
      id: userId,
      email,
      name,
      posting_time: postingTime,
      plan: 'free',
    })

    // Track in PostHog (fallback creation path)
    captureServerEvent(userId, 'user_created', { source: 'fallback', email })

    KNOWN_USERS.add(userId)
    console.log(`[ensureUser] auto-created user ${userId} (${email})`)
  } catch (err) {
    console.error('[ensureUser] failed:', (err as Error).message)
  }
}
