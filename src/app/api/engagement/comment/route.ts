import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId)
    return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { opportunityId, draftedComment } = await req.json()
  if (!opportunityId || typeof draftedComment !== 'string') {
    return Response.json(
      { error: 'opportunityId + draftedComment required' },
      { status: 400 }
    )
  }

  const supabase = getSupabaseAdmin()
  const { error } = await supabase
    .from('comment_opportunities')
    .update({ drafted_comment: draftedComment })
    .eq('id', opportunityId)
    .eq('user_id', userId)

  if (error)
    return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
