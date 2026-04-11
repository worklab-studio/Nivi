import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { checkAndSendCommentDigest } from '@/lib/queue/workers/commentDigest'

export const maxDuration = 300

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('onboarding_complete', true)
    .not('whatsapp_number', 'is', null)
    .not('unipile_account_id', 'is', null)

  let sent = 0
  for (const user of (users ?? []).slice(0, 10)) {
    try {
      await checkAndSendCommentDigest(user.id)
      sent++
    } catch (err) {
      console.error(`[Cron] Comment digest failed for ${user.id}:`, err)
    }
  }

  return Response.json({ ok: true, sent })
}
