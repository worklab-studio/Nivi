import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await req.json()
  if (!postId) return Response.json({ error: 'postId required' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  const { data: source } = await supabase
    .from('posts')
    .select('content, hook_type, content_pillar')
    .eq('id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!source) return Response.json({ error: 'Post not found' }, { status: 404 })

  const { data: newPost, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      content: source.content,
      hook_type: source.hook_type,
      content_pillar: source.content_pillar,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, post: newPost })
}
