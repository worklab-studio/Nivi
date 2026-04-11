import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('context_files')
    .select('writing_style, hook_mechanics, sentence_styling, post_system, version, updated_at')
    .eq('user_id', userId)
    .single()

  return Response.json({ files: data })
}

export async function PATCH(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { field, value } = await req.json()
  const validFields = ['writing_style', 'hook_mechanics', 'sentence_styling', 'post_system']
  if (!validFields.includes(field)) return Response.json({ error: 'Invalid field' }, { status: 400 })

  const supabase = getSupabaseAdmin()
  await supabase
    .from('context_files')
    .update({ [field]: value, updated_at: new Date().toISOString() })
    .eq('user_id', userId)

  return Response.json({ success: true })
}
