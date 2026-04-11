import { getSupabaseAdmin } from '@/lib/supabase/admin'
import crypto from 'crypto'

/**
 * Lemon Squeezy webhook handler.
 * Events: subscription_created, subscription_updated,
 *         subscription_cancelled, subscription_expired
 */
export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('x-signature') ?? ''
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''

  // Verify signature
  if (secret) {
    const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex')
    if (hmac !== sig) {
      console.error('[lemonsqueezy/webhook] invalid signature')
      return Response.json({ error: 'Invalid signature' }, { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(body)
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventName = (payload.meta as Record<string, unknown>)?.event_name as string
  const customData = (payload.meta as Record<string, unknown>)?.custom_data as Record<string, string> | undefined
  const userId = customData?.user_id
  const attrs = (payload.data as Record<string, unknown>)?.attributes as Record<string, unknown> | undefined

  const variantId = String(attrs?.variant_id ?? '')
  const subscriptionId = String((payload.data as Record<string, unknown>)?.id ?? '')
  const customerId = String(attrs?.customer_id ?? '')
  const status = attrs?.status as string | undefined

  console.log(`[lemonsqueezy/webhook] ${eventName} | userId=${userId} | variant=${variantId} | status=${status}`)

  const supabase = getSupabaseAdmin()

  // Map variant ID to plan
  const dashboardVariant = process.env.LEMONSQUEEZY_VARIANT_DASHBOARD ?? ''
  const completeVariant = process.env.LEMONSQUEEZY_VARIANT_COMPLETE ?? ''

  function variantToPlan(vid: string): 'dashboard' | 'complete' {
    if (vid === completeVariant) return 'complete'
    if (vid === dashboardVariant) return 'dashboard'
    // Default to dashboard if unknown
    return 'dashboard'
  }

  // Find user — by userId in custom_data, or by ls_customer_id
  let targetUserId = userId
  if (!targetUserId && customerId) {
    const { data: u } = await supabase
      .from('users')
      .select('id')
      .eq('ls_customer_id', customerId)
      .single()
    targetUserId = u?.id
  }

  if (!targetUserId) {
    console.error('[lemonsqueezy/webhook] no user found for event')
    return Response.json({ ok: true }) // Don't fail — LS retries on 4xx/5xx
  }

  switch (eventName) {
    case 'subscription_created':
    case 'subscription_resumed': {
      const plan = variantToPlan(variantId)
      await supabase
        .from('users')
        .update({
          plan,
          ls_customer_id: customerId,
          ls_subscription_id: subscriptionId,
          ls_variant_id: variantId,
        })
        .eq('id', targetUserId)
      console.log(`[lemonsqueezy] user ${targetUserId} → plan=${plan}`)
      break
    }

    case 'subscription_updated': {
      const plan = variantToPlan(variantId)
      const update: Record<string, unknown> = {
        ls_variant_id: variantId,
      }
      // Only update plan if subscription is active
      if (status === 'active') {
        update.plan = plan
      }
      await supabase.from('users').update(update).eq('id', targetUserId)
      console.log(`[lemonsqueezy] user ${targetUserId} updated → plan=${plan}, status=${status}`)
      break
    }

    case 'subscription_cancelled':
    case 'subscription_expired': {
      // Set end date but don't immediately downgrade — they paid till end of period
      const endsAt = attrs?.ends_at as string | undefined
      if (endsAt) {
        await supabase
          .from('users')
          .update({ plan_expires_at: endsAt })
          .eq('id', targetUserId)
      } else {
        await supabase
          .from('users')
          .update({ plan: 'free', ls_subscription_id: null, plan_expires_at: null })
          .eq('id', targetUserId)
      }
      console.log(`[lemonsqueezy] user ${targetUserId} cancelled/expired`)
      break
    }
  }

  return Response.json({ ok: true })
}
