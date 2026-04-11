import { createClient } from '@supabase/supabase-js'
import { postComment } from '@/lib/unipile/posts'
import { sendWhatsApp } from '@/lib/whatsapp/send'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function handleCommentApproval(
  userId: string,
  user: { whatsapp_number: string },
  cmd: string
): Promise<Response> {
  const supabase = getSupabase()

  // Get pending comment opportunities
  const { data: opportunities } = await supabase
    .from('comment_opportunities')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(5)

  if (!opportunities || opportunities.length === 0) {
    await sendWhatsApp(
      user.whatsapp_number,
      'No pending comments to approve.'
    )
    return Response.json({ ok: true })
  }

  let indicesToApprove: number[]

  if (cmd === 'ALL') {
    indicesToApprove = opportunities.map((_, i) => i)
  } else {
    // Parse C1 C3 C5 format
    indicesToApprove = cmd
      .match(/C(\d)/gi)
      ?.map((c) => parseInt(c.slice(1)) - 1)
      .filter((i) => i >= 0 && i < opportunities.length) ?? []
  }

  let posted = 0
  let capHit = false
  let capMsg = ''
  for (const idx of indicesToApprove) {
    const opp = opportunities[idx]
    const result = await postComment(userId, opp.id)
    if (result.ok) {
      posted++
    } else if (result.reason?.includes('cap')) {
      capHit = true
      capMsg = result.reason
      break
    }
  }

  // Skip the rest (anything not approved + anything that errored after cap)
  const skippedIds = opportunities
    .filter((_, i) => !indicesToApprove.includes(i))
    .map((o) => o.id)

  if (skippedIds.length > 0) {
    await supabase
      .from('comment_opportunities')
      .update({ status: 'skipped' })
      .in('id', skippedIds)
  }

  const reply = capHit
    ? `posted ${posted} but hit ${capMsg}. lets pick this up tomorrow — dont want linkedin flagging you.`
    : `\u2705 ${posted} comment${posted !== 1 ? 's' : ''} posted.`

  await sendWhatsApp(user.whatsapp_number, reply)
  return Response.json({ ok: true })
}
