import { auth } from '@clerk/nextjs/server'
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { storeKnowledgeChunk } from '@/lib/vector/memoryStore'

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { content, sourceType, sourceTitle } = await req.json()
  if (!content || content.length < 50) {
    return Response.json({ error: 'Content too short (min 50 chars)' }, { status: 400 })
  }

  const supabase = getSupabaseAdmin()

  // Save raw chunk to DB
  const { data: chunk } = await supabase
    .from('knowledge_chunks')
    .insert({
      user_id: userId,
      source_type: sourceType,
      source_title: sourceTitle,
      raw_content: content,
    })
    .select()
    .single()

  if (!chunk) {
    return Response.json({ error: 'Failed to save' }, { status: 500 })
  }

  // Extract insights via Claude
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const insightsRes = await anthropic.messages.create({
    model: pickModel('knowledge-extraction'),
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `Extract the key insights and ideas from this content that could be used in LinkedIn posts.
Focus on: unique perspectives, specific experiences, data points, frameworks, stories, opinions.
Return JSON array of insight strings. Max 15 insights.
Return ONLY the JSON array.

Content:
${content.slice(0, 6000)}`,
      },
    ],
  })

  const insightsRaw =
    insightsRes.content[0].type === 'text'
      ? insightsRes.content[0].text.trim()
      : '[]'
  const insightsClean = insightsRaw.replace(/```json\n?|```/g, '').trim()
  let insights: string[] = []
  try {
    insights = JSON.parse(insightsClean)
  } catch {
    // extraction failed, continue without insights
  }

  // Update chunk with extracted insights
  await supabase
    .from('knowledge_chunks')
    .update({
      extracted_insights: insights,
      embedding_id: chunk.id,
    })
    .eq('id', chunk.id)

  // Embed with Gemini and write into knowledge_chunks.embedding (pgvector)
  storeKnowledgeChunk(userId, chunk.id, `${sourceTitle}: ${content}`).catch(
    () => {}
  )

  return Response.json({
    chunk: { ...chunk, extracted_insights: insights },
    insightCount: insights.length,
  })
}
