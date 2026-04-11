import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('posts')
    .select('id, content, hook_type, content_pillar, status, created_at, published_at, scheduled_at')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json({ post: data })
}
