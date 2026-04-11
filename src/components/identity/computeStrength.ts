interface IdentityShape {
  about_you?: string | null
  your_story?: string | null
  offers?: unknown[]
  target_audience?: unknown[]
  personal_info?: unknown[]
}

export function computeIdentityStrength(identity: IdentityShape | null | undefined): number {
  if (!identity) return 0
  let filled = 0
  if (identity.about_you && identity.about_you.trim().length > 20) filled++
  if (identity.your_story && identity.your_story.trim().length > 20) filled++
  if ((identity.offers ?? []).length > 0) filled++
  if ((identity.target_audience ?? []).length > 0) filled++
  if ((identity.personal_info ?? []).length > 0) filled++
  return Math.round((filled / 5) * 100)
}
