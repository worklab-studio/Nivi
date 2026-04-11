import { auth } from '@clerk/nextjs/server'
import { createClient } from '@supabase/supabase-js'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ code: '' })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('users')
    .select('whatsapp_opt_in_code')
    .eq('id', userId)
    .single()

  return Response.json({ code: data?.whatsapp_opt_in_code || '' })
}
