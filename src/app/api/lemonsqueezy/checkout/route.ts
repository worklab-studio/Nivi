import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Creates a Lemon Squeezy checkout URL for the given plan.
 * Uses the LS API to create a checkout with the user's email
 * and userId embedded in custom_data for webhook matching.
 */
export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = (await req.json()) as { plan: 'dashboard' | 'complete' }

  const variantId =
    plan === 'complete'
      ? process.env.LEMONSQUEEZY_VARIANT_COMPLETE
      : process.env.LEMONSQUEEZY_VARIANT_DASHBOARD

  if (!variantId) {
    return Response.json({ error: 'Plan not configured' }, { status: 500 })
  }

  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', userId)
    .single()

  const storeId = process.env.LEMONSQUEEZY_STORE_ID
  const apiKey = process.env.LEMONSQUEEZY_API_KEY

  if (!storeId || !apiKey) {
    return Response.json({ error: 'Payment not configured' }, { status: 500 })
  }

  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/vnd.api+json',
        Accept: 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: user?.email ?? '',
              name: user?.name ?? '',
              custom: {
                user_id: userId,
              },
            },
            product_options: {
              redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/overview?upgraded=true`,
            },
          },
          relationships: {
            store: { data: { type: 'stores', id: storeId } },
            variant: { data: { type: 'variants', id: variantId } },
          },
        },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[lemonsqueezy/checkout] error:', res.status, err.slice(0, 300))
      return Response.json({ error: 'Checkout creation failed' }, { status: 500 })
    }

    const data = await res.json()
    const checkoutUrl = data.data?.attributes?.url
    if (!checkoutUrl) {
      return Response.json({ error: 'No checkout URL returned' }, { status: 500 })
    }

    return Response.json({ url: checkoutUrl })
  } catch (err) {
    console.error('[lemonsqueezy/checkout] threw:', err)
    return Response.json({ error: 'Checkout failed' }, { status: 500 })
  }
}
