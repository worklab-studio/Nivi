import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  console.log('[import-linkedin-url] entered POST')
  try {
    const { userId } = await auth()
    if (!userId) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return Response.json({ ok: false, error: 'url required' }, { status: 400 })
    }

    const { importFromLinkedInUrl } = await import(
      '@/lib/identity/extractFromLinkedInUrl'
    )
    const suggestion = await importFromLinkedInUrl(url)

    await getSupabaseAdmin()
      .from('brand_identity')
      .upsert({
        user_id: userId,
        linkedin_imported_at: new Date().toISOString(),
      })

    return Response.json({ ok: true, suggestion })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    const stack = (e as Error).stack ?? ''
    console.error('[import-linkedin-url] failed:', message)
    console.error('[import-linkedin-url] stack:', stack.slice(0, 600))
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
