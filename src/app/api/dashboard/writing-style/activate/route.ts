import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { templateId } = await req.json()
  const supabase = getSupabaseAdmin()

  const { data: tpl } = await supabase
    .from('writing_template')
    .select('*')
    .eq('id', templateId)
    .single()

  if (!tpl) return Response.json({ error: 'Template not found' }, { status: 404 })

  await supabase.from('brand_identity').upsert({
    user_id: userId,
    active_template_id: tpl.id,
    hook_style: tpl.hook_style,
    sentence_style: tpl.sentence_style,
    ending_style: tpl.ending_style,
    updated_at: new Date().toISOString(),
  })

  return Response.json({ success: true })
}
