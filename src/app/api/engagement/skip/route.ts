import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { opportunityId } = await req.json()
  const supabase = getSupabaseAdmin()
  await supabase.from('comment_opportunities').update({ status: 'skipped' }).eq('id', opportunityId).eq('user_id', userId)
  return Response.json({ success: true })
}
