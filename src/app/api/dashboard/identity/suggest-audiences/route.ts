import { auth } from '@clerk/nextjs/server'
import { suggestAudiences } from '@/lib/identity/suggestAudiences'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const suggestions = await suggestAudiences(userId)
  return Response.json({ ok: true, suggestions })
}
