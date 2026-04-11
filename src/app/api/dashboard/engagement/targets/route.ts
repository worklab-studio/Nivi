import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

function parseLinkedInHandle(url: string): string | null {
  const m = url.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/i)
  return m?.[1] ?? null
}

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('engagement_targets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  return Response.json({ targets: data ?? [] })
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const {
    linkedin_url,
    mode = 'whitelist',
    note,
    author_name,
    author_headline,
  } = body as {
    linkedin_url?: string
    mode?: 'whitelist' | 'blacklist'
    note?: string
    author_name?: string
    author_headline?: string
  }

  if (!linkedin_url) {
    return Response.json({ error: 'linkedin_url required' }, { status: 400 })
  }

  const handle = parseLinkedInHandle(linkedin_url)
  if (!handle) {
    return Response.json(
      { error: 'Invalid LinkedIn profile URL (expected linkedin.com/in/handle)' },
      { status: 400 }
    )
  }

  const avatar_url = `https://unavatar.io/linkedin/${handle}?fallback=false`

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from('engagement_targets')
    .insert({
      user_id: userId,
      linkedin_url,
      author_handle: handle,
      author_name: author_name ?? handle,
      author_headline: author_headline ?? null,
      avatar_url,
      mode: mode === 'blacklist' ? 'blacklist' : 'whitelist',
      note: note ?? null,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true, target: data })
}
