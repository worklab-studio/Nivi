import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const files = await req.json()

  const supabase = getSupabaseAdmin()

  // Save final (possibly edited) context files
  await supabase.from('context_files').upsert(
    {
      user_id: userId,
      writing_style: files.writing_style,
      hook_mechanics: files.hook_mechanics,
      sentence_styling: files.sentence_styling,
      post_system: files.post_system,
      version: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )

  // Mark onboarding complete
  await supabase
    .from('users')
    .update({
      onboarding_complete: true,
      onboarding_step: 8,
    })
    .eq('id', userId)

  return Response.json({ success: true })
}
