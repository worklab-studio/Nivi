import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = getSupabaseAdmin()

  // Only allow deleting the user's own (non-curated) templates.
  const { data: tpl } = await supabase
    .from('writing_template')
    .select('id, user_id, is_curated')
    .eq('id', id)
    .maybeSingle()

  if (!tpl) return Response.json({ error: 'Not found' }, { status: 404 })
  if (tpl.is_curated || tpl.user_id !== userId) {
    return Response.json(
      { error: 'Curated templates can only be hidden, not deleted.' },
      { status: 403 }
    )
  }

  const { error } = await supabase
    .from('writing_template')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // If this template was the active one, clear it from brand_identity
  await supabase
    .from('brand_identity')
    .update({ active_template_id: null })
    .eq('user_id', userId)
    .eq('active_template_id', id)

  return Response.json({ ok: true })
}
