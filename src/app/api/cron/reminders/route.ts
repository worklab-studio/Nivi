import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export const maxDuration = 60

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getSupabaseAdmin()
  const now = new Date().toISOString()
  let sent = 0

  // Check reminders table
  try {
    const { data: dueReminders } = await supabase
      .from('reminders')
      .select('*, users!inner(whatsapp_number)')
      .eq('status', 'pending')
      .lte('remind_at', now)
      .limit(20)

    for (const r of dueReminders ?? []) {
      const phone = (r.users as { whatsapp_number: string })?.whatsapp_number
      if (phone) {
        await sendWhatsApp(phone, `hey! you asked me to remind you: ${r.reminder_text}`)
        await supabase.from('reminders').update({ status: 'sent' }).eq('id', r.id)
        sent++
      }
    }
  } catch {
    // reminders table might not exist yet — check user_memory fallback
  }

  // Fallback: check user_memory for REMINDER| entries
  try {
    const { data: memoryReminders } = await supabase
      .from('user_memory')
      .select('id, user_id, fact')
      .eq('source', 'reminder')
      .limit(50)

    for (const m of memoryReminders ?? []) {
      if (!m.fact.startsWith('REMINDER|')) continue
      const parts = m.fact.split('|')
      if (parts.length < 3) continue

      const remindAt = new Date(parts[1])
      if (remindAt <= new Date()) {
        const reminderText = parts.slice(2).join('|')
        const { data: user } = await supabase
          .from('users')
          .select('whatsapp_number')
          .eq('id', m.user_id)
          .single()

        if (user?.whatsapp_number) {
          await sendWhatsApp(user.whatsapp_number, `hey! you asked me to remind you: ${reminderText}`)
          // Delete the memory entry after sending
          await supabase.from('user_memory').delete().eq('id', m.id)
          sent++
        }
      }
    }
  } catch {
    // skip
  }

  return Response.json({ ok: true, sent })
}
