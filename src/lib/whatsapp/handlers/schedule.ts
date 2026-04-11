import { createClient } from '@supabase/supabase-js'
import { sendWhatsApp } from '@/lib/whatsapp/send'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function parseScheduleTime(timeStr: string): Date | null {
  const now = new Date()
  const str = timeStr.toUpperCase()

  const isTomorrow = str.startsWith('TOMORROW')
  const timePart = isTomorrow ? str.replace('TOMORROW', '').trim() : str

  const match = timePart.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/)
  if (!match) return null

  let hours = parseInt(match[1])
  const minutes = parseInt(match[2] ?? '0')
  const meridiem = match[3]

  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0

  const result = new Date(now)
  if (isTomorrow) result.setDate(result.getDate() + 1)
  result.setHours(hours, minutes, 0, 0)

  return result
}

export async function handleSchedule(
  userId: string,
  user: { whatsapp_number: string },
  rawText: string
): Promise<Response> {
  const supabase = getSupabase()
  const timeStr = rawText.replace(/^SCHEDULE\s+/i, '').trim()
  const scheduledAt = parseScheduleTime(timeStr)

  if (!scheduledAt) {
    await sendWhatsApp(
      user.whatsapp_number,
      "I didn't understand that time. Try:\nSCHEDULE 3PM\nSCHEDULE 6:30PM\nSCHEDULE TOMORROW 9AM"
    )
    return Response.json({ ok: true })
  }

  const { data: draft } = await supabase
    .from('posts')
    .select('id')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!draft) {
    await sendWhatsApp(user.whatsapp_number, 'No draft to schedule.')
    return Response.json({ ok: true })
  }

  await supabase
    .from('posts')
    .update({
      status: 'scheduled',
      scheduled_at: scheduledAt.toISOString(),
    })
    .eq('id', draft.id)

  await supabase.from('scheduled_posts').insert({
    post_id: draft.id,
    user_id: userId,
    scheduled_at: scheduledAt.toISOString(),
  })

  const formatted = scheduledAt.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
  await sendWhatsApp(
    user.whatsapp_number,
    `\u2705 Scheduled for ${formatted}\nI'll confirm when it goes live.`
  )
  return Response.json({ ok: true })
}
