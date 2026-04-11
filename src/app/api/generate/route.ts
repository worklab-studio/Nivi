import { auth } from '@clerk/nextjs/server'
import { generateDailyPost } from '@/lib/claude/generatePost'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const hint = body.hint as string | undefined

  const post = await generateDailyPost(userId, hint)
  return Response.json({ post })
}
