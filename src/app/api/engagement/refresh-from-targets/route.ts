import { auth } from '@clerk/nextjs/server'

export async function POST() {
  console.log('[engagement/refresh-from-targets] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { refreshFromTargetsApify } = await import(
      '@/lib/engagement/refreshFromTargetsApify'
    )
    const result = await refreshFromTargetsApify(userId)
    return Response.json({ ok: true, ...result })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[engagement/refresh-from-targets] failed:', message)
    const status = /add targets first/i.test(message) ? 422 : 502
    return Response.json({ ok: false, error: message }, { status })
  }
}
