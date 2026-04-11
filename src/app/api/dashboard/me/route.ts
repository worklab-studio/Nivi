import { auth, currentUser } from '@clerk/nextjs/server'
import { getCachedLinkedInProfile } from '@/lib/unipile/profile'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

/**
 * Returns the user's LinkedIn author profile (name, headline, avatarUrl)
 * for use in the compose-page LinkedIn preview and post previews.
 *
 * Lookup order:
 *   1. Unipile LinkedIn profile (cached 24h — real LinkedIn data)
 *   2. brand_identity table (LinkedIn-imported name/headline/photo)
 *   3. Clerk user profile (name + imageUrl) as final fallback
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const profile = await getCachedLinkedInProfile(userId)

  // If Unipile didn't return full data, try brand_identity
  if (!profile.avatarUrl || profile.name === 'You' || !profile.headline) {
    try {
      const supabase = getSupabaseAdmin()
      const { data: bi } = await supabase
        .from('brand_identity')
        .select('about, personal_info')
        .eq('user_id', userId)
        .maybeSingle()

      if (bi) {
        // personal_info may contain name, headline, photo from LinkedIn import
        const info = (bi.personal_info ?? []) as Array<{
          key: string
          value: string
        }>
        const findInfo = (key: string) =>
          info.find(
            (i) => i.key.toLowerCase().includes(key)
          )?.value

        if (profile.name === 'You') {
          const name = findInfo('name') || findInfo('full name')
          if (name) profile.name = name
        }
        if (!profile.headline) {
          const headline =
            findInfo('headline') ||
            findInfo('tagline') ||
            findInfo('title') ||
            findInfo('role')
          if (headline) profile.headline = headline
        }
        if (!profile.avatarUrl) {
          const photo =
            findInfo('photo') ||
            findInfo('avatar') ||
            findInfo('picture') ||
            findInfo('image')
          if (photo) profile.avatarUrl = photo
        }
      }
    } catch {
      // brand_identity fallback is best-effort
    }
  }

  // Final fallback: Clerk user profile
  if (!profile.avatarUrl || profile.name === 'You') {
    try {
      const clerk = await currentUser()
      if (clerk) {
        if (!profile.avatarUrl && clerk.imageUrl) {
          profile.avatarUrl = clerk.imageUrl
        }
        if (profile.name === 'You') {
          const clerkName = [clerk.firstName, clerk.lastName]
            .filter(Boolean)
            .join(' ')
            .trim()
          if (clerkName) profile.name = clerkName
        }
      }
    } catch {
      // Clerk fallback is best-effort
    }
  }

  return Response.json({ profile })
}
