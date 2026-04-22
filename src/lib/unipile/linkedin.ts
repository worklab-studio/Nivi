import { getSupabaseAdmin } from '@/lib/supabase/admin'

const BASE_URL = process.env.UNIPILE_BASE_URL!
const API_KEY = process.env.UNIPILE_API_KEY!

const headers = {
  'X-API-KEY': API_KEY,
  accept: 'application/json',
}

/**
 * Extract first image URL from a Unipile post's attachments array.
 * Unipile uses different field names depending on attachment type — try several.
 */
function extractImageUrl(attachments?: unknown[]): string | undefined {
  if (!Array.isArray(attachments) || attachments.length === 0) return undefined
  for (const att of attachments) {
    const a = att as { type?: string; mime_type?: string; url?: string; image_url?: string; src?: string; thumbnail_url?: string; large_url?: string; medium_url?: string }
    const isImage =
      a.type?.includes('image') ||
      a.type === 'img' ||
      a.mime_type?.includes('image')
    if (isImage) {
      const url = a.url || a.image_url || a.large_url || a.medium_url || a.src || a.thumbnail_url
      if (url) return url
    }
  }
  // Some Unipile responses don't tag the type — fall back to the first URL we find
  const first = attachments[0] as { url?: string; image_url?: string; large_url?: string; medium_url?: string; src?: string; thumbnail_url?: string }
  return first?.url || first?.image_url || first?.large_url || first?.medium_url || first?.src || first?.thumbnail_url
}

export interface LinkedInPost {
  id: string
  text: string
  date: string
  impressions: number
  likes: number
  comments: number
  reposts: number
  shareUrl: string
  hasImage: boolean
  imageUrl?: string
  authorName?: string
}

export interface LinkedInProfile {
  name: string
  headline: string
  location: string
  profileUrl: string
  organizations: { name: string; id: string }[]
}

/**
 * Get user's LinkedIn profile
 */
export async function getLinkedInProfile(
  accountId: string
): Promise<LinkedInProfile | null> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/users/me?account_id=${accountId}`,
      { headers }
    )
    const data = await res.json()
    return {
      name: `${data.first_name} ${data.last_name}`,
      headline: data.occupation ?? '',
      location: data.location ?? '',
      profileUrl: `https://linkedin.com/in/${data.public_identifier}`,
      organizations: (data.organizations ?? []).map(
        (o: { name: string; id: string }) => ({
          name: o.name,
          id: o.id,
        })
      ),
    }
  } catch {
    return null
  }
}

export interface LinkedInRichProfile {
  name: string
  headline: string
  summary: string
  location: string
  profileUrl: string
  experience: {
    title: string
    company: string
    description?: string
    start?: string
    end?: string
  }[]
  education: { school: string; degree?: string; field?: string }[]
  skills: string[]
  organizations: { name: string; id: string }[]
}

/**
 * Get the FULL LinkedIn profile (About summary, experience, education, skills)
 * via Unipile. Two-step:
 *   1. /api/v1/users/me?account_id=... → provider_id (LinkedIn URN)
 *   2. /api/v1/users/{provider_id}?account_id=... → full body
 *
 * Throws on hard failure with the actual cause so callers can surface it.
 */
export async function getLinkedInRichProfile(
  accountId: string
): Promise<LinkedInRichProfile> {
  // Step 1: Get public_identifier from Unipile /me (fast, reliable)
  console.log('[profile] step 1 — fetching /me for accountId=', accountId)
  const meRes = await fetch(
    `${BASE_URL}/api/v1/users/me?account_id=${accountId}`,
    { headers }
  )
  if (!meRes.ok) {
    const body = await meRes.text().catch(() => '')
    throw new Error(`Unipile /me ${meRes.status}: ${body.slice(0, 200)}`)
  }
  const me = await meRes.json()

  const publicId = me.public_identifier as string | undefined
  const meOrgs = (me.organizations ?? []) as { name: string; id: string }[]

  // Step 2: Try Apify scraper (rich data: summary, experience, education, skills)
  if (publicId) {
    try {
      const { scrapeLinkedInProfile } = await import('@/lib/apify/scrapeLinkedInProfile')
      const apify = await scrapeLinkedInProfile(publicId)
      console.log('[profile] Apify success for', apify.name)
      return {
        name: apify.name,
        headline: apify.headline,
        summary: apify.summary,
        location: apify.location,
        profileUrl: apify.profileUrl,
        experience: apify.experience,
        education: apify.education,
        skills: apify.skills,
        organizations: apify.organizations.length > 0
          ? apify.organizations.map((o) => ({ name: o.name, id: o.id ?? '' }))
          : meOrgs.map((o) => ({ name: o.name, id: o.id })),
      }
    } catch (err) {
      console.error('[profile] Apify failed, falling back to Unipile:', (err as Error).message)
    }
  }

  // Step 3: Fallback to Unipile /users/{providerId} (may return empty)
  const providerId = me.provider_id ?? me.id ?? publicId ?? me.member_id
  let data: Record<string, unknown> = {}
  if (providerId) {
    try {
      const url = `${BASE_URL}/api/v1/users/${encodeURIComponent(String(providerId))}?account_id=${accountId}`
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) })
      if (res.ok) data = await res.json()
    } catch { /* continue with /me data */ }
  }

  // Merge /me + /users data
  return {
    name: `${data.first_name ?? me.first_name ?? ''} ${data.last_name ?? me.last_name ?? ''}`.trim() || 'LinkedIn user',
    headline: (data.headline ?? data.occupation ?? me.occupation ?? '') as string,
    summary: (data.summary ?? data.about ?? '') as string,
    location: (data.location ?? me.location ?? '') as string,
    profileUrl: publicId ? `https://linkedin.com/in/${publicId}` : '',
    experience: ((data.work_experience ?? data.experience ?? data.positions ?? []) as Array<{
      position?: string; title?: string; company?: string | { name: string }
      description?: string; start?: string; end?: string
    }>).map((e) => ({
      title: e.position ?? e.title ?? '',
      company: typeof e.company === 'string' ? e.company : (e.company?.name ?? ''),
      description: e.description ?? '',
      start: e.start,
      end: e.end,
    })),
    education: ((data.education ?? []) as Array<{
      school?: string; degree?: string; field_of_study?: string
    }>).map((e) => ({
      school: e.school ?? '',
      degree: e.degree,
      field: e.field_of_study,
    })),
    skills: ((data.skills ?? []) as Array<string | { name: string }>).map((s) =>
      typeof s === 'string' ? s : s.name
    ),
    organizations: meOrgs.map((o) => ({ name: o.name, id: o.id })),
  }
}

/**
 * Get user's own recent LinkedIn posts with analytics
 */
export async function getMyRecentPosts(
  accountId: string,
  providerId: string,
  limit = 10
): Promise<LinkedInPost[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/users/${providerId}/posts?account_id=${accountId}&limit=${limit}`,
      { headers }
    )
    const data = await res.json()
    return (data.items ?? []).map(
      (p: {
        id: string
        text: string
        date: string
        parsed_datetime?: string
        impressions_counter: number
        reaction_counter: number
        comment_counter: number
        repost_counter: number
        share_url: string
        attachments?: unknown[]
      }) => ({
        id: p.id,
        text: p.text ?? '',
        date: p.parsed_datetime ?? p.date,
        impressions: p.impressions_counter ?? 0,
        likes: p.reaction_counter ?? 0,
        comments: p.comment_counter ?? 0,
        reposts: p.repost_counter ?? 0,
        shareUrl: p.share_url ?? '',
        hasImage: (p.attachments ?? []).length > 0,
        imageUrl: extractImageUrl(p.attachments),
      })
    )
  } catch {
    return []
  }
}

/**
 * Get posts from user's LinkedIn feed (for engagement opportunities)
 */
export async function getLinkedInFeed(
  accountId: string,
  limit = 20
): Promise<LinkedInPost[]> {
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/posts/feed?account_id=${accountId}&limit=${limit}`,
      { headers }
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.items ?? []).map(
      (p: {
        id: string
        text: string
        date: string
        impressions_counter: number
        reaction_counter: number
        comment_counter: number
        repost_counter: number
        share_url: string
        attachments?: unknown[]
        author?: { name: string }
      }) => ({
        id: p.id,
        text: p.text ?? '',
        date: p.date,
        impressions: p.impressions_counter ?? 0,
        likes: p.reaction_counter ?? 0,
        comments: p.comment_counter ?? 0,
        reposts: p.repost_counter ?? 0,
        shareUrl: p.share_url ?? '',
        hasImage: (p.attachments ?? []).length > 0,
        authorName: p.author?.name,
      })
    )
  } catch {
    return []
  }
}

/**
 * Build a LinkedIn context summary for Nivi's brain
 */
export async function buildLinkedInContext(
  userId: string
): Promise<string> {
  const supabase = getSupabaseAdmin()
  const { data: user } = await supabase
    .from('users')
    .select('unipile_account_id')
    .eq('id', userId)
    .single()

  if (!user?.unipile_account_id) return 'LinkedIn not connected.'

  const accountId = user.unipile_account_id

  // Get profile
  const profile = await getLinkedInProfile(accountId)

  // Get provider_id for fetching own posts
  try {
    const res = await fetch(
      `${BASE_URL}/api/v1/users/me?account_id=${accountId}`,
      { headers }
    )
    const profileData = await res.json()
    const providerId = profileData.provider_id

    const posts = await getMyRecentPosts(accountId, providerId, 5)

    const postsSummary = posts
      .map(
        (p, i) =>
          `${i + 1}. [${p.date}] ${p.impressions} imp, ${p.likes} likes, ${p.comments} comments\n   "${p.text.slice(0, 120)}..."`
      )
      .join('\n')

    const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0)
    const avgLikes = posts.length
      ? Math.round(posts.reduce((s, p) => s + p.likes, 0) / posts.length)
      : 0
    const bestPost = posts.sort((a, b) => b.impressions - a.impressions)[0]

    return `LIVE LINKEDIN DATA:
Profile: ${profile?.name} — ${profile?.headline}
Location: ${profile?.location}
Companies: ${profile?.organizations.map((o) => o.name).join(', ')}

RECENT POSTS (last ${posts.length}):
${postsSummary || 'No recent posts'}

PERFORMANCE:
Total recent impressions: ${totalImpressions}
Average likes per post: ${avgLikes}
Best performing: "${bestPost?.text.slice(0, 80)}..." (${bestPost?.impressions} impressions)
Content pattern: Posts with specific numbers and personal experiments perform best`
  } catch {
    return 'LinkedIn connected but could not fetch recent data.'
  }
}
