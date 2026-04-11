import { getSupabaseAdmin } from '@/lib/supabase/admin'

const PLAN_RANK: Record<string, number> = {
  free: 0,
  dashboard: 1,
  complete: 2,
}

const POST_LIMITS: Record<string, number> = {
  free: 5,
  dashboard: 90,
  complete: 99999,
}

/** 7-day free trial grace period */
const TRIAL_DAYS = 7

export async function getUserPlan(userId: string): Promise<{
  plan: string
  isTrialing: boolean
  trialDaysLeft: number
}> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('plan, created_at, plan_expires_at')
    .eq('id', userId)
    .single()

  const plan = user?.plan ?? 'free'
  const createdAt = user?.created_at ? new Date(user.created_at).getTime() : Date.now()
  const daysSinceSignup = (Date.now() - createdAt) / 86400000
  const isTrialing = plan === 'free' && daysSinceSignup < TRIAL_DAYS
  const trialDaysLeft = isTrialing ? Math.ceil(TRIAL_DAYS - daysSinceSignup) : 0

  // Check if plan has expired (cancelled but paid till end of period)
  if (user?.plan_expires_at && new Date(user.plan_expires_at) < new Date()) {
    // Expired — downgrade
    await supabase
      .from('users')
      .update({ plan: 'free', ls_subscription_id: null, plan_expires_at: null })
      .eq('id', userId)
    return { plan: 'free', isTrialing: false, trialDaysLeft: 0 }
  }

  return { plan, isTrialing, trialDaysLeft }
}

export async function checkPlan(
  userId: string,
  requiredPlan: 'dashboard' | 'complete'
): Promise<{ allowed: boolean; currentPlan: string; isTrialing: boolean }> {
  const { plan, isTrialing } = await getUserPlan(userId)

  // Trial users get full access
  if (isTrialing) {
    return { allowed: true, currentPlan: plan, isTrialing: true }
  }

  const allowed = (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0)
  return { allowed, currentPlan: plan, isTrialing: false }
}

export async function checkPostLimit(userId: string): Promise<boolean> {
  const { plan, isTrialing } = await getUserPlan(userId)
  if (isTrialing) return true

  const limit = POST_LIMITS[plan] ?? 5

  const supabase = getSupabaseAdmin()
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'published')
    .gte('published_at', monthStart.toISOString())

  return (count ?? 0) < limit
}
