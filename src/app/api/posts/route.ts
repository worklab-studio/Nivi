import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabase()
  const { data: posts } = await supabase
    .from('posts')
    .select('*, post_analytics(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)

  return Response.json({ posts: posts ?? [] })
}
