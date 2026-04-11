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

  const { step, answers } = await req.json()

  const supabase = getSupabaseAdmin()

  // Upsert answers into onboarding_answers table
  // Each step's answers are stored as a JSONB row
  await supabase.from('onboarding_answers').upsert(
    {
      user_id: userId,
      step,
      answers,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,step' }
  )

  // Update onboarding step counter
  const stepMap: Record<string, number> = {
    about_you: 4,
    writing_style: 5,
    content_pillars: 6,
    sample_posts: 7,
  }
  if (stepMap[step] !== undefined) {
    await supabase
      .from('users')
      .update({ onboarding_step: stepMap[step] })
      .eq('id', userId)
  }

  return Response.json({ success: true })
}
