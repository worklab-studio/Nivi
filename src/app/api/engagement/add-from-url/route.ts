import { auth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  console.log('[engagement/add-from-url] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return Response.json(
        { ok: false, error: 'url required' },
        { status: 400 }
      )
    }

    const { draftFromPostUrl } = await import(
      '@/lib/engagement/draftFromPostUrl'
    )
    const opportunity = await draftFromPostUrl(userId, url)
    return Response.json({ ok: true, opportunity })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[engagement/add-from-url] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
