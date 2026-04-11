import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendMorningBrief } from '@/lib/queue/workers/morningBrief'

export const maxDuration = 300

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  // Find users whose posting_time matches current minute
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('onboarding_complete', true)
    .not('whatsapp_number', 'is', null)

  // Filter by posting_time (stored as TIME type)
  const eligibleUsers = (users ?? []).filter(() => {
    // For now, send to all users — proper time matching needs timezone handling
    return true
  })

  let sent = 0
  for (const user of eligibleUsers.slice(0, 10)) {
    try {
      await sendMorningBrief(user.id)
      sent++
    } catch (err) {
      console.error(`[Cron] Morning brief failed for ${user.id}:`, err)
    }
  }

  return Response.json({ ok: true, sent, time: currentTime })
}
