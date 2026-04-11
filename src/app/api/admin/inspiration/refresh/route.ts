import { auth } from '@clerk/nextjs/server'

export async function POST() {
  console.log('[inspiration/refresh] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { scrapeAndRefreshInspiration } = await import(
      '@/lib/inspiration/scrapeAndRefresh'
    )
    const result = await scrapeAndRefreshInspiration()
    return Response.json({ ok: true, ...result })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[inspiration/refresh] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
