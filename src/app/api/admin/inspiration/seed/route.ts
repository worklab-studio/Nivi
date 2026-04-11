import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { tagPost } from '@/lib/inspiration/tagPost'
import { embedInspirationPost } from '@/lib/inspiration/embedPost'

export async function POST(req: Request) {
  console.log('[inspiration/seed] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const posts = body.posts as Array<{
      content: string
      author_name: string
      author_headline?: string
      linkedin_post_url?: string
      likes?: number
      comments?: number
    }>

    if (!Array.isArray(posts) || posts.length === 0) {
      return Response.json(
        { ok: false, error: 'posts array required' },
        { status: 400 }
      )
    }

    const supabase = getSupabaseAdmin()
    let inserted = 0

    for (const p of posts) {
      if (!p.content || p.content.length < 30) continue

      const tags = await tagPost(p.content, p.author_name, p.likes ?? 0)
      const embedding = await embedInspirationPost(p.content)

      const { error } = await supabase.from('inspiration_posts').insert({
        content: p.content,
        author_name: p.author_name,
        author_headline: p.author_headline ?? null,
        linkedin_post_url: p.linkedin_post_url ?? null,
        likes: p.likes ?? 0,
        comments: p.comments ?? 0,
        format: tags.format,
        topic_pillar: tags.topic_pillar,
        engagement_tier: tags.engagement_tier,
        creator_archetype: tags.creator_archetype,
        hook_score: tags.hook_score,
        is_seed: true,
        embedding: embedding ? `[${embedding.join(',')}]` : null,
      })

      if (!error) inserted++
    }

    return Response.json({ ok: true, inserted })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[inspiration/seed] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
