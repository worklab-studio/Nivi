import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { generateDailyPost } from '@/lib/claude/generatePost'
import { extractEditMemory } from '@/lib/claude/extractMemory'
import { sendWhatsApp } from '@/lib/whatsapp/send'

export async function handleEdit(
  userId: string,
  user: { whatsapp_number: string; chatId?: string },
  rawText: string
): Promise<Response> {
  const notes = rawText.replace(/^EDIT:\s*/i, '').trim()
  const supabase = getSupabaseAdmin()

  // Get the current draft to reference
  const { data: currentDraft } = await supabase
    .from('posts')
    .select('content')
    .eq('user_id', userId)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const originalContent = currentDraft?.content ?? ''

  // Generate new version with edit instructions
  const post = await generateDailyPost(
    userId,
    `The user wants to edit their current draft. Their instruction: "${notes}"\n\nCurrent draft:\n"${originalContent.slice(0, 500)}"\n\nRewrite the post incorporating their feedback. Keep the same core idea but apply their changes.`
  )

  // Learn from the edit (async, don't block)
  if (originalContent) {
    extractEditMemory(userId, originalContent, notes, post.content).catch(() => {})
  }

  // Increment edit count
  if (currentDraft) {
    await supabase
      .from('posts')
      .update({ status: 'skipped' })
      .eq('user_id', userId)
      .eq('status', 'draft')
      .neq('id', post.id)
  }

  await sendWhatsApp(
    user.whatsapp_number,
    `---\n${post.content}\n---\n\nchanges applied. POST / EDIT: [more notes] / SKIP`,
    user.chatId
  )
  return Response.json({ ok: true })
}
