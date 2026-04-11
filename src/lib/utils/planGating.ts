import { getSupabaseAdmin } from '@/lib/supabase/admin'

const PLAN_RANK: Record<string, number> = {
  starter: 0,
  pro: 1,
  agency: 2,
}

const POST_LIMITS: Record<string, number> = {
  starter: 30,
  pro: 90,
  agency: 99999,
}

export async function checkPlan(
  userId: string,
  requiredPlan: 'pro' | 'agency'
): Promise<{ allowed: boolean; currentPlan: string }> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()
  const plan = user?.plan ?? 'starter'

  const allowed =
    (PLAN_RANK[plan] ?? 0) >= (PLAN_RANK[requiredPlan] ?? 0)

  return { allowed, currentPlan: plan }
}

export async function checkPostLimit(
  userId: string
): Promise<boolean> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('plan')
    .eq('id', userId)
    .single()
  const plan = user?.plan ?? 'starter'
  const limit = POST_LIMITS[plan] ?? 30

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
