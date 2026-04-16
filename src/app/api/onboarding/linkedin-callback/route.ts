import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'
import { captureServerEvent } from '@/lib/analytics/posthog'

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

    // Persist public_identifier for Apify (so future scrapes skip Unipile /me)
    try {
      const meRes = await fetch(
        `${process.env.UNIPILE_BASE_URL}/api/v1/users/me?account_id=${accountId}`,
        { headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY!, accept: 'application/json' }, signal: AbortSignal.timeout(5000) }
      )
      if (meRes.ok) {
        const me = await meRes.json()
        if (me.public_identifier) {
          await supabase.from('users').update({ linkedin_public_identifier: me.public_identifier }).eq('id', userId)
        }
      }
    } catch { /* best effort */ }

    // Trigger immediate analytics sync + identity import so data shows from the start
    // Run both in parallel, don't block the popup close
    Promise.all([
      import('@/lib/unipile/syncAnalytics')
        .then(({ syncLinkedInAnalytics }) => syncLinkedInAnalytics(userId))
        .then((r) => console.log(`[linkedin-callback] synced ${r.synced} posts`))
        .catch((err) => console.error('[linkedin-callback] analytics sync failed:', (err as Error).message)),
      import('@/lib/identity/extractFromLinkedIn')
        .then(({ importFromLinkedIn }) => importFromLinkedIn(userId))
        .then((suggestion) => {
          // Auto-save the imported identity
          const updates: Record<string, unknown> = {
            user_id: userId,
            linkedin_imported_at: new Date().toISOString(),
          }
          if (suggestion.about_you) updates.about_you = suggestion.about_you
          if (suggestion.your_story) updates.your_story = suggestion.your_story
          if (suggestion.target_audience_suggestions?.length) {
            updates.target_audience = suggestion.target_audience_suggestions
          }
          if (suggestion.offer_suggestions?.length) {
            updates.offers = suggestion.offer_suggestions
          }
          return supabase.from('brand_identity').upsert(updates)
        })
        .then(() => console.log('[linkedin-callback] identity imported'))
        .catch((err) => console.error('[linkedin-callback] identity import failed:', (err as Error).message)),
    ]).catch(() => {})

    // Log event for Nivi proactive outreach
    void supabase.from('user_events').insert({
      user_id: userId,
      event_type: 'linkedin_connected',
      metadata: { account_id: accountId },
    })

    // Track in PostHog
    captureServerEvent(userId, 'linkedin_connected', { account_id: accountId })
  }

  // Close popup window
  return new Response(
    '<html><body><script>window.close();</script></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  )
}
