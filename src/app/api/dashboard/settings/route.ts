import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('users')
    .select('posting_time, engagement_time, timezone, plan, whatsapp_number, unipile_account_id, brand_kit, created_at, posting_goal')
    .eq('id', userId)
    .single()

  return Response.json({ settings: data })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowedFields = ['posting_time', 'engagement_time', 'timezone', 'whatsapp_number', 'brand_kit', 'posting_goal']
  const updates: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (allowedFields.includes(key)) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) return Response.json({ error: 'No valid fields' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  await supabase.from('users').update(updates).eq('id', userId)

  // Log event for Nivi proactive outreach
  void supabase.from('user_events').insert({
    user_id: userId,
    event_type: 'settings_changed',
    metadata: { fields: Object.keys(updates) },
  })
  void supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', userId)

  return Response.json({ success: true })
}
