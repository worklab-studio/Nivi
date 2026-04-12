import { auth } from '@clerk/nextjs/server'
import { syncLinkedInAnalytics } from '@/lib/unipile/syncAnalytics'

/**
 * Triggers a LinkedIn analytics sync for the current user.
 * Called from the Overview page or manually.
 */
export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await syncLinkedInAnalytics(userId)
    return Response.json({ ok: true, ...result })
  } catch (err) {
    console.error('[sync-analytics] failed:', err)
    return Response.json(
      { error: (err as Error).message },
      { status: 500 }
    )
  }
}
