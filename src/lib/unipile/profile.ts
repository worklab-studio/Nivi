import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'

/**
 * Cached LinkedIn profile fetcher.
 *
 * Returns the user's actual LinkedIn name, headline, and avatar URL
 * (used by the compose-page LinkedIn preview to show the real profile
 * instead of a generic placeholder).
 *
 * Lookup order:
 *   1. Cache hit (< 24h old) → return cached values from users.linkedin_*
 *   2. Cache miss + LinkedIn connected → fetch /api/v1/users/me from Unipile,
 *      cache, return.
 *   3. Cache miss + LinkedIn NOT connected → return Clerk fallback (just name).
 *   4. Unipile error → return whatever's cached (even if stale), or Clerk fallback.
 *
 * Never throws — the compose page should still render even if Unipile is down.
 */

export interface LinkedInAuthorProfile {
  name: string
  headline: string
  avatarUrl: string
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function getCachedLinkedInProfile(
  userId: string
): Promise<LinkedInAuthorProfile> {
  const supabase = getSupabaseAdmin()
  const { data: u } = await supabase
    .from('users')
    .select(
      'unipile_account_id, linkedin_display_name, linkedin_headline, linkedin_avatar_url, linkedin_profile_fetched_at, name'
    )
    .eq('id', userId)
    .single()

  // Cache hit
  const cachedAt = u?.linkedin_profile_fetched_at
    ? new Date(u.linkedin_profile_fetched_at).getTime()
    : 0
  const isFresh = Date.now() - cachedAt < CACHE_TTL_MS

  if (isFresh && u?.linkedin_display_name) {
    return {
      name: u.linkedin_display_name,
      headline: u.linkedin_headline ?? '',
      avatarUrl: u.linkedin_avatar_url ?? '',
    }
  }

  // No LinkedIn connected → return Clerk fallback
  if (!u?.unipile_account_id) {
    return {
      name: u?.name ?? 'You',
      headline: '',
      avatarUrl: '',
    }
  }

  // Refresh from Unipile
  try {
    const res = await fetch(
      `${getEnv('UNIPILE_BASE_URL')}/api/v1/users/me?account_id=${u.unipile_account_id}`,
      {
        headers: {
          'X-API-KEY': getEnv('UNIPILE_API_KEY'),
          accept: 'application/json',
        },
        signal: AbortSignal.timeout(5000),
      }
    )
    if (!res.ok) throw new Error(`unipile ${res.status}`)
    const profile = await res.json()

    const first = (profile.first_name ?? '').toString().trim()
    const last = (profile.last_name ?? '').toString().trim()
    const fullName = `${first} ${last}`.trim() || u.name || 'You'
    const headline = (
      profile.headline ??
      profile.occupation ??
      profile.title ??
      profile.summary ??
      ''
    )
      .toString()
      .slice(0, 160)
    const avatarUrl = (
      profile.profile_picture_url_large ??
      profile.profile_picture_url ??
      profile.picture_url ??
      profile.img_url ??
      profile.display_picture_url ??
      profile.image_url ??
      ''
    ).toString()

    // Persist cache (best-effort)
    await supabase
      .from('users')
      .update({
        linkedin_display_name: fullName,
        linkedin_headline: headline,
        linkedin_avatar_url: avatarUrl,
        linkedin_profile_fetched_at: new Date().toISOString(),
      })
      .eq('id', userId)

    return { name: fullName, headline, avatarUrl }
  } catch (err) {
    console.error('[unipile/profile] fetch failed:', err)
    // Fallback to whatever we have cached, then Clerk
    return {
      name: u.linkedin_display_name ?? u.name ?? 'You',
      headline: u.linkedin_headline ?? '',
      avatarUrl: u.linkedin_avatar_url ?? '',
    }
  }
}
