import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  console.log('[import-linkedin] entered POST', req.url)
  try {
    const { userId } = await auth()
    console.log('[import-linkedin] auth userId=', userId)
    if (!userId) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Dynamic import so any module-load error inside extractFromLinkedIn /
    // unipile is caught here and surfaced — instead of preventing the
    // entire route module from loading and returning a generic 400.
    const { importFromLinkedIn } = await import(
      '@/lib/identity/extractFromLinkedIn'
    )
    console.log('[import-linkedin] module loaded, calling Unipile…')

    const suggestion = await importFromLinkedIn(userId)
    console.log('[import-linkedin] success')

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
    console.error('[import-linkedin] failed:', message)
    console.error('[import-linkedin] stack:', stack.slice(0, 600))
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
