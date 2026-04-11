import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { getEnv } from '@/lib/config'

/**
 * Account health worker — polls Unipile per-account status, detects when
 * LinkedIn has flagged the account, auto-pauses write actions (via the
 * executeTool health guard in conversation.ts), and notifies the user.
 *
 * Called every 30 minutes from the scheduler for each onboarded user with
 * a unipile_account_id. Per-call cost is one Unipile HTTP request — at
 * 500 users that's 1000 calls/hour, well within Unipile's rate limits
 * for the accounts endpoint (this is a metadata read, not LinkedIn API).
 *
 * Soft-fails on Unipile API errors so a brief Unipile outage doesn't
 * mark every user as restricted.
 */

type LinkedInHealth = 'ok' | 'credentials' | 'restricted' | 'stopped' | 'unknown'

export async function accountHealthCheck(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('id, unipile_account_id, whatsapp_number, name, linkedin_health')
    .eq('id', userId)
    .single()

  if (!user?.unipile_account_id) return

  // Poll Unipile metadata endpoint (NOT a LinkedIn API call — safe to
  // do at high frequency, no rate-limit risk).
  let raw: Record<string, unknown> | null = null
  try {
    const res = await fetch(
      `${getEnv('UNIPILE_BASE_URL')}/api/v1/accounts/${user.unipile_account_id}`,
      {
        headers: {
          'X-API-KEY': getEnv('UNIPILE_API_KEY'),
          accept: 'application/json',
        },
      }
    )
    if (!res.ok) {
      // Soft-fail: don't mark unhealthy on a single API blip
      console.error(
        `[health] Unipile ${res.status} for user ${userId} — leaving status unchanged`
      )
      return
    }
    raw = await res.json()
  } catch (err) {
    console.error(`[health] fetch failed for user ${userId}:`, err)
    return
  }

  const internal = mapUnipileStatus(raw)
  const prev = (user.linkedin_health ?? 'ok') as LinkedInHealth

  // Always update the timestamp so we know the check ran
  if (internal === prev) {
    await supabase
      .from('users')
      .update({ linkedin_health_checked_at: new Date().toISOString() })
      .eq('id', userId)
    return
  }

  // Status changed — log + notify
  const message = humanMessageFor(internal, user.name ?? undefined)
  await supabase
    .from('users')
    .update({
      linkedin_health: internal,
      linkedin_health_message: message,
      linkedin_health_checked_at: new Date().toISOString(),
    })
    .eq('id', userId)

  await supabase.from('nivi_linkedin_health_events').insert({
    user_id: userId,
    prev_status: prev,
    new_status: internal,
    message,
    unipile_raw: raw,
  })

  if (user.whatsapp_number) {
    if (internal === 'ok') {
      await sendWhatsApp(
        user.whatsapp_number,
        `okay youre back ✅ linkedin cleared your account. im gonna take it slow for the next day or two — no automated comments/connections — just to be safe.`
      )
    } else {
      await sendWhatsApp(user.whatsapp_number, message)
    }
  }
}

function mapUnipileStatus(raw: Record<string, unknown> | null): LinkedInHealth {
  if (!raw) return 'unknown'
  // Unipile shape varies by version. Try a few likely paths.
  const sources = (raw.sources as Array<Record<string, unknown>>) ?? []
  const sourceStatus = sources[0]?.status as string | undefined
  const cpStatus = (raw.connection_params as Record<string, unknown> | undefined)
    ?.status as string | undefined
  const topStatus = raw.status as string | undefined

  const candidate = (sourceStatus ?? cpStatus ?? topStatus ?? '').toString().toUpperCase()

  if (candidate === 'OK' || candidate === 'CONNECTED' || candidate === 'ACTIVE') return 'ok'
  if (candidate.includes('CREDENTIAL') || candidate === 'EXPIRED') return 'credentials'
  if (
    candidate.includes('RESTRICT') ||
    candidate.includes('LIMIT') ||
    candidate.includes('CHECKPOINT') ||
    candidate.includes('CAPTCHA')
  )
    return 'restricted'
  if (candidate === 'STOPPED' || candidate === 'DISCONNECTED' || candidate === 'DISABLED')
    return 'stopped'
  return 'unknown'
}

function humanMessageFor(status: LinkedInHealth, name?: string): string {
  const greet = name ? `hey ${name} — ` : 'heads up — '
  switch (status) {
    case 'restricted':
      return `${greet}linkedin flagged your account 😬 looks like a temporary restriction. ill pause all automated comments + posts on my side until they clear it (usually 7 days). best to take a break from automation entirely for a week and post manually if you can. ill check back daily and let you know when youre good.`
    case 'credentials':
      return `${greet}your linkedin session expired — i cant post or comment until you reconnect. open the dashboard → settings → reconnect linkedin to fix it. ill be quiet on the linkedin side until thats sorted.`
    case 'stopped':
      return `${greet}linkedin disconnected entirely. open dashboard → settings → reconnect linkedin to get me back on.`
    case 'unknown':
      return `${greet}something looks off with your linkedin account on my end. ill check again in a bit and let you know if anything actually broke.`
    case 'ok':
    default:
      return `${greet}linkedin looks healthy ✅`
  }
}
