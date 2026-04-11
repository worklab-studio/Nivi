import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { extractIdentityFromMemoryDump } from '@/lib/identity/extractMemoriesFromText'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = await req.json()
  if (!text || typeof text !== 'string') {
    return Response.json({ error: 'text required' }, { status: 400 })
  }

  const result = await extractIdentityFromMemoryDump(text)
  if (!result) {
    return Response.json({ ok: false, error: 'Could not parse memory dump' }, { status: 422 })
  }

  const supabase = getSupabaseAdmin()
  const { data: existing } = await supabase
    .from('brand_identity')
    .select('about_you, your_story, offers, target_audience, personal_info')
    .eq('user_id', userId)
    .maybeSingle()

  const existingOffers = (existing?.offers ?? []) as Array<{
    name: string
    description: string
    url?: string
  }>
  const existingAudience = (existing?.target_audience ?? []) as Array<{
    label: string
    description?: string
  }>
  const existingPI = (existing?.personal_info ?? []) as Array<{
    key: string
    value: string
    source?: string
  }>

  // Dedupe offers by lowercase name
  const offerKeys = new Set(existingOffers.map((o) => o.name.toLowerCase().trim()))
  const newOffers = result.offers.filter(
    (o) => o.name && !offerKeys.has(o.name.toLowerCase().trim())
  )

  // Dedupe audience by lowercase label
  const audKeys = new Set(existingAudience.map((a) => a.label.toLowerCase().trim()))
  const newAudience = result.target_audience.filter(
    (a) => a.label && !audKeys.has(a.label.toLowerCase().trim())
  )

  const newPI = result.personal_info
    .filter((p) => p.key && p.value)
    .map((p) => ({ key: p.key, value: p.value, source: 'memory' as const }))

  // About/Story only fill if currently empty
  const updates: Record<string, unknown> = {
    user_id: userId,
    memory_imported_at: new Date().toISOString(),
    offers: [...existingOffers, ...newOffers],
    target_audience: [...existingAudience, ...newAudience],
    personal_info: [...existingPI, ...newPI],
  }
  if (!existing?.about_you?.trim() && result.about_you?.trim()) {
    updates.about_you = result.about_you
  }
  if (!existing?.your_story?.trim() && result.your_story?.trim()) {
    updates.your_story = result.your_story
  }

  await supabase.from('brand_identity').upsert(updates)

  return Response.json({
    ok: true,
    counts: {
      facts: newPI.length,
      offers: newOffers.length,
      audiences: newAudience.length,
      about_filled: !!updates.about_you,
      story_filled: !!updates.your_story,
    },
  })
}
