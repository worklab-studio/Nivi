import Stripe from 'stripe'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Single-plan Stripe webhook. Nivi is $29/mo, one plan only:
 *   • checkout.session.completed  → mark user as 'active'
 *   • customer.subscription.deleted → mark user as 'inactive'
 *
 * The old starter/pro/agency price-id mapping is gone.
 */
export async function POST(req: Request) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')

  if (!sig) return Response.json({ error: 'No signature' }, { status: 400 })

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      if (userId) {
        await supabase
          .from('users')
          .update({ plan: 'active' })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .eq('stripe_customer_id', sub.customer as string)
        .single()
      if (user) {
        await supabase
          .from('users')
          .update({ plan: 'inactive' })
          .eq('id', user.id)
      }
      break
    }
  }

  return Response.json({ ok: true })
}
