import { auth } from '@clerk/nextjs/server'
import { publishToLinkedIn } from '@/lib/unipile/posts'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await req.json()
  await publishToLinkedIn(userId, postId)
  return Response.json({ success: true })
}
