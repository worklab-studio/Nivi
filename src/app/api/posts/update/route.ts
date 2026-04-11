import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { postId, content, status, scheduled_at } = body as {
    postId: string
    content?: string
    status?: string
    scheduled_at?: string | null
  }
  const supabase = getSupabaseAdmin()
  const update: Record<string, unknown> = {}
  if (typeof content === 'string') {
    update.content = content
    update.edit_count = 1
  }
  if (status) update.status = status
  if (scheduled_at !== undefined) update.scheduled_at = scheduled_at
  await supabase.from('posts').update(update).eq('id', postId).eq('user_id', userId)
  if (status === 'draft') {
    await supabase.from('scheduled_posts').delete().eq('post_id', postId).eq('user_id', userId)
  }
  return Response.json({ success: true })
}
