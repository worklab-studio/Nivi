import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Returns the Lemon Squeezy customer portal URL for managing subscriptions.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('ls_subscription_id')
    .eq('id', userId)
    .single()

  if (!user?.ls_subscription_id) {
    return Response.json({ error: 'No active subscription' }, { status: 404 })
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'Payment not configured' }, { status: 500 })
  }

  try {
    const res = await fetch(
      `https://api.lemonsqueezy.com/v1/subscriptions/${user.ls_subscription_id}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: 'application/vnd.api+json',
        },
      }
    )

    if (!res.ok) {
      return Response.json({ error: 'Could not fetch subscription' }, { status: 500 })
    }

    const data = await res.json()
    const portalUrl = data.data?.attributes?.urls?.customer_portal

    if (!portalUrl) {
      return Response.json({ error: 'No portal URL' }, { status: 500 })
    }

    return Response.json({ url: portalUrl })
  } catch {
    return Response.json({ error: 'Portal fetch failed' }, { status: 500 })
  }
}
