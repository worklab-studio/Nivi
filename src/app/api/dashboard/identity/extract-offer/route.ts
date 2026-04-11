import { auth } from '@clerk/nextjs/server'
import { extractOfferFromUrl } from '@/lib/identity/extractOfferFromUrl'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { url } = await req.json()
  if (!url || typeof url !== 'string') {
    return Response.json({ ok: false, error: 'url required' }, { status: 400 })
  }

  try {
    const offer = await extractOfferFromUrl(url)

    // Mark domain as a successful import source so the Identity Status
    // sidebar reflects it.
    const supabase = getSupabaseAdmin()
    await supabase.from('brand_identity').upsert({
      user_id: userId,
      domain_url: offer.url,
      domain_imported_at: new Date().toISOString(),
    })

    return Response.json({ ok: true, offer })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[extract-offer] failed', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
