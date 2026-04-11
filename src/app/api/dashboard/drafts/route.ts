import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('posts')
    .select('id, content, hook_type, content_pillar, created_at')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })

  return Response.json({ drafts: data ?? [] })
}
