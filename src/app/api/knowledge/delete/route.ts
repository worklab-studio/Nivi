import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { deleteKnowledgeChunk } from '@/lib/vector/memoryStore'

export async function DELETE(req: Request) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { chunkId } = await req.json()
  const supabase = getSupabaseAdmin()
  await supabase.from('knowledge_chunks').delete().eq('id', chunkId).eq('user_id', userId)
  deleteKnowledgeChunk(chunkId).catch(() => {})
  return Response.json({ success: true })
}
