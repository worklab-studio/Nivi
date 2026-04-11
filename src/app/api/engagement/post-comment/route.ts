import { auth } from '@clerk/nextjs/server'
import { postComment } from '@/lib/unipile/posts'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { opportunityId } = await req.json()
  await postComment(userId, opportunityId)
  return Response.json({ success: true })
}
