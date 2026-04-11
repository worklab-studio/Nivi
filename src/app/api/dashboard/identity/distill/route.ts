import { auth } from '@clerk/nextjs/server'
import { distillIdentity } from '@/lib/identity/distill'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await distillIdentity(userId)
    return Response.json({ ok: true, result })
  } catch (e) {
    return Response.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    )
  }
}
