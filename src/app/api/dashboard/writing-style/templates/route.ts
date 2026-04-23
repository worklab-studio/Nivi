import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { promises as fs } from 'fs'
import path from 'path'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('writing_template')
    .select('*')
    .or(`is_curated.eq.true,user_id.eq.${userId}`)
    .order('is_curated', { ascending: false })

  return Response.json({ templates: data ?? [] }, {
    headers: { 'Cache-Control': 'private, max-age=300, stale-while-revalidate=3600' },
  })
}

/**
 * Download a remote avatar image and save it to public/templates/<id>.jpg.
 * Returns the public-relative URL on success, or null on any failure.
 * Never throws — the template still inserts without an image.
 */
async function downloadAvatar(
  templateId: string,
  remoteUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(remoteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })
    if (!res.ok) {
      console.warn('[templates POST] avatar fetch failed', res.status, remoteUrl)
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.length < 500) {
      console.warn('[templates POST] avatar too small', buf.length)
      return null
    }
    const dir = path.join(process.cwd(), 'public', 'templates')
    await fs.mkdir(dir, { recursive: true })
    const filename = `${templateId}.jpg`
    await fs.writeFile(path.join(dir, filename), buf)
    console.log('[templates POST] avatar saved', filename, buf.length, 'bytes')
    return `/templates/${filename}`
  } catch (e) {
    console.warn('[templates POST] avatar download threw', (e as Error).message)
    return null
  }
}

export async function POST(req: Request) {
  console.log('[writing-style/templates POST] entered')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return Response.json({ ok: false, error: 'url required' }, { status: 400 })
    }

    const { extractTemplateFromUrl } = await import(
      '@/lib/identity/extractTemplateFromUrl'
    )
    const extracted = await extractTemplateFromUrl(url)

    const id = `custom-${userId.slice(0, 8)}-${Date.now().toString(36)}`

    // Best-effort avatar download — never blocks the insert
    let avatar_url: string | null = null
    if (extracted.avatar_url) {
      avatar_url = await downloadAvatar(id, extracted.avatar_url)
    }

    const supabase = getSupabaseAdmin()
    const { data, error } = await supabase
      .from('writing_template')
      .insert({
        id,
        user_id: userId,
        name: extracted.name,
        author_name: extracted.author_name,
        author_headline: extracted.author_headline,
        source_posts: [extracted.post_body],
        hook_style: extracted.hook_style,
        sentence_style: extracted.sentence_style,
        ending_style: extracted.ending_style,
        voice_dna: extracted.voice_dna ?? null,
        avatar_url,
        is_curated: false,
      })
      .select()
      .single()

    if (error) {
      console.error('[writing-style/templates POST] insert error', error.message)
      return Response.json({ ok: false, error: error.message }, { status: 500 })
    }

    return Response.json({ ok: true, template: data })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[writing-style/templates POST] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
