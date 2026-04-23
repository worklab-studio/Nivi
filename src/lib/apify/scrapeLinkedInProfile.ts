import { getEnv } from '@/lib/config'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Apify-based LinkedIn profile scraper.
 * Uses supreme_coder~linkedin-profile-scraper actor.
 * Returns rich profile data: summary, experience, education, skills, followers.
 */

export interface ApifyLinkedInProfile {
  name: string
  headline: string
  summary: string
  location: string
  profileUrl: string
  avatarUrl: string
  followerCount: number
  connectionCount: number
  experience: {
    title: string
    company: string
    description: string
    start?: string
    end?: string
  }[]
  education: { school: string; degree?: string; field?: string }[]
  skills: string[]
  organizations: { name: string; id?: string }[]
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Scrape a LinkedIn profile via Apify. Synchronous call, ~15-30s.
 */
export async function scrapeLinkedInProfile(
  publicIdentifier: string
): Promise<ApifyLinkedInProfile> {
  const token = getEnv('APIFY_API_TOKEN')
  if (!token) throw new Error('APIFY_API_TOKEN not set')

  const url = `https://api.apify.com/v2/acts/supreme_coder~linkedin-profile-scraper/run-sync-get-dataset-items?token=${token}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      urls: [{ url: `https://www.linkedin.com/in/${publicIdentifier}` }],
    }),
    signal: AbortSignal.timeout(90_000),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Apify ${res.status}: ${body.slice(0, 200)}`)
  }

  const data = await res.json()
  const items = Array.isArray(data) ? data : []
  if (items.length === 0) throw new Error('Apify returned empty dataset')

  const profile = normalizeApifyProfile(items[0])

  // Validate result is actually useful — Apify sometimes returns 1 item with
  // all fields empty (e.g. for sparse/private LinkedIn profiles it can't see).
  // Treat that as failure so the caller falls back to Unipile.
  const hasUsefulData =
    (profile.name && profile.name !== 'LinkedIn user') ||
    profile.headline ||
    profile.summary ||
    profile.experience.length > 0 ||
    profile.skills.length > 0 ||
    profile.education.length > 0
  if (!hasUsefulData) {
    throw new Error('Apify returned profile with no usable data (empty fields)')
  }

  return profile
}

/**
 * Get LinkedIn profile with caching. Tries cache first, then Apify, then Unipile fallback.
 */
export async function getLinkedInProfileCached(
  userId: string,
  opts?: { maxAgeMs?: number; forceRefresh?: boolean }
): Promise<ApifyLinkedInProfile | null> {
  const supabase = getSupabaseAdmin()
  const maxAge = opts?.maxAgeMs ?? CACHE_TTL_MS

  const { data: user } = await supabase
    .from('users')
    .select('linkedin_profile_cache, linkedin_profile_cached_at, linkedin_public_identifier, unipile_account_id')
    .eq('id', userId)
    .single()

  if (!user) return null

  // Cache hit
  if (
    !opts?.forceRefresh &&
    user.linkedin_profile_cache &&
    user.linkedin_profile_cached_at
  ) {
    const age = Date.now() - new Date(user.linkedin_profile_cached_at).getTime()
    if (age < maxAge) {
      return user.linkedin_profile_cache as unknown as ApifyLinkedInProfile
    }
  }

  // Resolve public_identifier
  let publicId = user.linkedin_public_identifier as string | null
  if (!publicId && user.unipile_account_id) {
    try {
      const meRes = await fetch(
        `${getEnv('UNIPILE_BASE_URL')}/api/v1/users/me?account_id=${user.unipile_account_id}`,
        {
          headers: { 'X-API-KEY': getEnv('UNIPILE_API_KEY'), accept: 'application/json' },
          signal: AbortSignal.timeout(8000),
        }
      )
      if (meRes.ok) {
        const me = await meRes.json()
        publicId = me.public_identifier ?? null
        if (publicId) {
          void supabase.from('users').update({ linkedin_public_identifier: publicId }).eq('id', userId)
        }
      }
    } catch {
      // Can't resolve public_identifier
    }
  }

  if (!publicId) {
    // Return stale cache if available
    if (user.linkedin_profile_cache) {
      return user.linkedin_profile_cache as unknown as ApifyLinkedInProfile
    }
    return null
  }

  // Scrape via Apify
  try {
    const profile = await scrapeLinkedInProfile(publicId)

    // Cache the result
    await supabase
      .from('users')
      .update({
        linkedin_profile_cache: profile as unknown as Record<string, unknown>,
        linkedin_profile_cached_at: new Date().toISOString(),
        linkedin_public_identifier: publicId,
        // Also update the compose preview cache
        linkedin_display_name: profile.name,
        linkedin_headline: profile.headline,
        linkedin_avatar_url: profile.avatarUrl,
        linkedin_profile_fetched_at: new Date().toISOString(),
      })
      .eq('id', userId)

    console.log(`[apify-profile] cached profile for ${profile.name}`)
    return profile
  } catch (err) {
    console.error('[apify-profile] scrape failed:', (err as Error).message)

    // Return stale cache if available
    if (user.linkedin_profile_cache) {
      console.log('[apify-profile] returning stale cache')
      return user.linkedin_profile_cache as unknown as ApifyLinkedInProfile
    }

    return null
  }
}

/**
 * Normalize the Apify actor's response to our standard interface.
 */
function normalizeApifyProfile(raw: Record<string, unknown>): ApifyLinkedInProfile {
  const positions = (raw.positions ?? []) as Array<{
    title?: string
    locationName?: string
    timePeriod?: { startDate?: { month?: number; year?: number }; endDate?: { month?: number; year?: number } | null }
    description?: string
    companyName?: string
    company?: string
    companyUrl?: string
  }>

  const educations = (raw.educations ?? []) as Array<{
    schoolName?: string
    degreeName?: string
    fieldOfStudy?: string
  }>

  const skills = (raw.skills ?? []) as Array<{ name?: string } | string>

  const formatDate = (d?: { month?: number; year?: number } | null) => {
    if (!d?.year) return undefined
    return d.month ? `${d.year}-${String(d.month).padStart(2, '0')}` : String(d.year)
  }

  return {
    name: `${raw.firstName ?? ''} ${raw.lastName ?? ''}`.trim() || 'LinkedIn user',
    headline: (raw.headline ?? '') as string,
    summary: (raw.summary ?? '') as string,
    location: (raw.geoLocationName ?? raw.locationName ?? '') as string,
    profileUrl: raw.publicIdentifier
      ? `https://linkedin.com/in/${raw.publicIdentifier}`
      : '',
    avatarUrl: (raw.pictureUrl ?? '') as string,
    followerCount: (raw.followerCount ?? 0) as number,
    connectionCount: (raw.connectionsCount ?? 0) as number,
    experience: positions.map((p) => ({
      title: p.title ?? '',
      company: p.companyName ?? p.company ?? '',
      description: p.description ?? '',
      start: formatDate(p.timePeriod?.startDate),
      end: formatDate(p.timePeriod?.endDate),
    })),
    education: educations.map((e) => ({
      school: e.schoolName ?? '',
      degree: e.degreeName,
      field: e.fieldOfStudy,
    })),
    skills: skills.map((s) => (typeof s === 'string' ? s : s.name ?? '')).filter(Boolean),
    organizations: [],
  }
}
