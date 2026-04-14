import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  const status = req.nextUrl.searchParams.get('status')
  const accountId = req.nextUrl.searchParams.get('account_id')

  if (userId && status === 'connected' && accountId) {
    const supabase = getSupabaseAdmin()
    // Track LinkedIn connection time so the rate limiter can apply
    // stricter caps to accounts under 14 days old (the most ban-vulnerable
    // window). See src/lib/utils/rateLimiter.ts NEW_ACCOUNT_LIMITS.
    await supabase
      .from('users')
      .update({
        unipile_account_id: accountId,
        linkedin_connected_at: new Date().toISOString(),
      })
      .eq('id', userId)

    // Trigger immediate analytics sync so KPIs show from the start
    try {
      const { syncLinkedInAnalytics } = await import('@/lib/unipile/syncAnalytics')
      await syncLinkedInAnalytics(userId)
    } catch (err) {
      console.error('[linkedin-callback] analytics sync failed:', (err as Error).message)
    }

    // Log event for Nivi proactive outreach
    void supabase.from('user_events').insert({
      user_id: userId,
      event_type: 'linkedin_connected',
      metadata: { account_id: accountId },
    })
  }

  // Close popup window
  return new Response(
    '<html><body><script>window.close();</script></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  )
}
