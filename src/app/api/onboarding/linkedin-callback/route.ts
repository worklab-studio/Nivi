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
  const params = req.nextUrl.searchParams
  const userId = params.get('userId')
  // Unipile has historically used `status=connected` in success redirects,
  // but some provider flows come back with `status=success`, `result=success`,
  // or no status at all when the redirect query string is mangled. Treat
  // anything other than an explicit failure as a success attempt.
  const rawStatus = (params.get('status') ?? params.get('result') ?? '').toLowerCase()
  const isExplicitFailure =
    rawStatus === 'failed' || rawStatus === 'failure' || rawStatus === 'error'
  // Unipile returns the linked account under various keys depending on
  // provider + SDK version. Accept all of them.
  const accountId =
    params.get('account_id') ??
    params.get('accountId') ??
    params.get('account') ??
    params.get('id')

  console.log(
    '[linkedin-callback] hit',
    'userId=', userId,
    'status=', rawStatus || '(none)',
    'accountId=', accountId,
    'allParams=', Array.from(params.entries())
  )

  if (!userId || isExplicitFailure || !accountId) {
    console.error(
      '[linkedin-callback] SKIPPED DB update — missing required params.',
      'This is why a new user will land back on the wizard with LinkedIn still unconnected.',
      'userId=', userId, 'status=', rawStatus, 'accountId=', accountId
    )
    // Surface the failure in the popup so the user isn't staring at a blank
    // closed window thinking it worked.
    const msg = isExplicitFailure
      ? 'LinkedIn connection failed. Please try again.'
      : 'Could not finalize the LinkedIn connection. Please retry from the onboarding screen.'
    return new Response(
      `<html><body style="font-family:system-ui;padding:24px;background:#0b0b0b;color:#eee"><p>${msg}</p><script>setTimeout(()=>window.close(),2500)</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )
  }

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

  console.log('[linkedin-callback] SUCCESS user', userId, 'account', accountId)

  return new Response(
    '<html><body><script>window.close();</script></body></html>',
    { headers: { 'Content-Type': 'text/html' } }
  )
}
