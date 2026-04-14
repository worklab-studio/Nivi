import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { distillIdentity } from '@/lib/identity/distill'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const [{ data }, { data: chatFacts }] = await Promise.all([
    supabase.from('brand_identity').select('*').eq('user_id', userId).maybeSingle(),
    supabase
      .from('user_memory')
      .select('id, fact, category')
      .eq('user_id', userId)
      .in('category', ['fact', 'preference', 'goal'])
      .order('confidence', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  // Merge chat-derived facts as virtual personal_info entries (read-only,
  // not persisted) so the user sees what Nivi has learned in conversation.
  const stored = (data?.personal_info ?? []) as Array<{
    key: string
    value: string
    source?: string
  }>
  const chatRows = (chatFacts ?? []).map((m) => ({
    key: m.category,
    value: m.fact,
    source: 'chat' as const,
  }))

  const identity = data
    ? { ...data, personal_info: [...stored, ...chatRows] }
    : { personal_info: chatRows }

  return Response.json({ identity })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const updates = await req.json()
  delete updates.user_id

  // Strip virtual chat-sourced personal_info rows before persisting — they
  // live in user_memory, not brand_identity.
  if (Array.isArray(updates.personal_info)) {
    updates.personal_info = updates.personal_info.filter(
      (p: { source?: string }) => p.source !== 'chat'
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('brand_identity')
    .upsert({
      user_id: userId,
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // Background distillation — don't block the response.
  // Debounced server-side: skip if summary was updated within the last 5s.
  const last = data?.summary_updated_at ? new Date(data.summary_updated_at).getTime() : 0
  if (Date.now() - last > 5000) {
    distillIdentity(userId).catch(() => {})
  }

  // Log event for Nivi proactive outreach
  void supabase.from('user_events').insert({
    user_id: userId,
    event_type: 'identity_updated',
    metadata: { fields: Object.keys(updates) },
  })
  void supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', userId)

  return Response.json({ identity: data })
}
