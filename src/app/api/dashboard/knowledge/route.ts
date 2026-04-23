import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('knowledge_chunks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return Response.json({ chunks: data ?? [] }, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' },
  })
}
