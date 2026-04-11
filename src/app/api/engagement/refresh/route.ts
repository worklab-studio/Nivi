import { auth } from '@clerk/nextjs/server'

export async function POST() {
  console.log('[engagement/refresh] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { refreshOpportunities } = await import(
      '@/lib/engagement/refreshOpportunities'
    )
    const count = await refreshOpportunities(userId)
    return Response.json({ ok: true, count })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[engagement/refresh] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
