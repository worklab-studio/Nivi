import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { createClient } from '@supabase/supabase-js'
import { buildNiviSystemPrompt } from '@/lib/claude/buildSystemPrompt'
import { sendWhatsApp } from '@/lib/whatsapp/send'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function sendEngagementBrief(userId: string): Promise<void> {
  const supabase = getSupabase()
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const { data: user } = await supabase
    .from('users')
    .select('*')
    .eq('id', userId)
    .single()

  if (!user?.whatsapp_number || !user?.unipile_account_id) return

  // Fetch user's LinkedIn feed via Unipile
  const feedRes = await fetch(
    `${process.env.UNIPILE_BASE_URL}/api/v1/users/feed?account_id=${user.unipile_account_id}&limit=30`,
    { headers: { 'X-API-KEY': process.env.UNIPILE_API_KEY! } }
  )

  if (!feedRes.ok) return

  const feedData = await feedRes.json()
  const posts = feedData.items ?? feedData ?? []

  if (posts.length === 0) return

  const systemPrompt = await buildNiviSystemPrompt(userId)

  const selectionRes = await anthropic.messages.create({
    model: pickModel('engagement-brief'),
    max_tokens: 8192,
    system: [
      { type: 'text', text: systemPrompt.static, cache_control: { type: 'ephemeral', ttl: '5m' } },
      { type: 'text', text: systemPrompt.dynamic },
    ],
    messages: [
      {
        role: 'user',
        content: `Here are LinkedIn posts from ${user.name}'s feed. Pick the 5 best for them to comment on.

Selection criteria:
1. Author has large following (maximum visibility return)
2. Post published within last 8 hours (gaining momentum)
3. Topic aligns with their content pillars
4. They have a GENUINE unique insight from their background
5. NOT a competitor or spammy post

For each post, draft a comment that:
- Sounds EXACTLY like ${user.name} wrote it \u2014 not generic, not AI-sounding
- Adds genuine value from their real experience and background
- Is 3-5 sentences maximum
- Creates a hook that invites a reply
- Never starts with "Great post!" or "I totally agree"

Return ONLY a JSON array of exactly 5 objects:
[{"postId": "...", "authorName": "...", "authorFollowers": 0, "postPreview": "first 60 chars...", "draftedComment": "the full comment"}]

Feed posts:
${JSON.stringify(
  posts.slice(0, 30).map((p: Record<string, unknown>) => ({
    id: p.id ?? p.social_id,
    author: p.author_name ?? p.author,
    followers: p.author_followers ?? 0,
    preview: typeof p.text === 'string' ? p.text.slice(0, 200) : '',
    reactions: p.reaction_counter ?? 0,
    date: p.date ?? p.parsed_datetime,
  })),
  null,
  2
)}`,
      },
    ],
  })

  const rawText =
    selectionRes.content[0].type === 'text'
      ? selectionRes.content[0].text.trim()
      : '[]'
  const clean = rawText.replace(/```json\n?|```/g, '').trim()

  let opps: {
    postId: string
    authorName: string
    authorFollowers?: number
    postPreview: string
    draftedComment: string
  }[]
  try {
    opps = JSON.parse(clean)
    if (!Array.isArray(opps) || opps.length === 0) return
  } catch {
    return
  }

  // Save to DB
  const { data: saved } = await supabase
    .from('comment_opportunities')
    .insert(
      opps.map((o) => ({
        user_id: userId,
        linkedin_post_id: o.postId,
        author_name: o.authorName,
        author_followers: o.authorFollowers ?? 0,
        post_preview: o.postPreview,
        drafted_comment: o.draftedComment,
        status: 'pending',
      }))
    )
    .select()

  if (!saved || saved.length === 0) return

  // Format WhatsApp message
  const oppLines = saved
    .map(
      (o, i) =>
        `\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nC${i + 1}. ${o.author_name} (${(o.author_followers ?? 0).toLocaleString()} followers)\n"${o.post_preview?.slice(0, 80)}..."\n\nDrafted comment:\n${o.drafted_comment}`
    )
    .join('\n\n')

  await sendWhatsApp(
    user.whatsapp_number,
    `\ud83c\udfaf 5 engagement opportunities today\n\n${oppLines}\n\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\nReply C1 C3 to post those\nALL to post all 5\nSKIP to skip today`
  )
}
