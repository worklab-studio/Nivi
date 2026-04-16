import { currentUser } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Ensures a Supabase user row exists for the given Clerk userId.
 * If missing (e.g., webhook didn't fire), creates it from Clerk profile.
 * Idempotent — safe to call repeatedly.
 */
export async function ensureUser(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin()

  // Fast path: check if user exists
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('id', userId)
    .maybeSingle()

  if (existing) return

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

    console.log(`[ensureUser] auto-created user ${userId} (${email})`)
  } catch (err) {
    console.error('[ensureUser] failed:', (err as Error).message)
  }
}
