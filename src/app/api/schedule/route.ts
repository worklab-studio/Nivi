import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId, scheduledAt } = await req.json()

  const supabase = getSupabase()

  await supabase
    .from('posts')
    .update({ status: 'scheduled', scheduled_at: scheduledAt })
    .eq('id', postId)
    .eq('user_id', userId)

  await supabase.from('scheduled_posts').insert({
    post_id: postId,
    user_id: userId,
    scheduled_at: scheduledAt,
  })

  return Response.json({ success: true })
}
