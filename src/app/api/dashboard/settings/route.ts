import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('users')
    .select('posting_time, engagement_time, timezone, plan, whatsapp_number, unipile_account_id, brand_kit, created_at')
    .eq('id', userId)
    .single()

  return Response.json({ settings: data })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const allowedFields = ['posting_time', 'engagement_time', 'timezone', 'whatsapp_number', 'brand_kit']
  const updates: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (allowedFields.includes(key)) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) return Response.json({ error: 'No valid fields' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  await supabase.from('users').update(updates).eq('id', userId)

  return Response.json({ success: true })
}
