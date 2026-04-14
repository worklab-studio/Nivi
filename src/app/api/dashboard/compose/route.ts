import { auth } from '@clerk/nextjs/server'
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { buildComposeSystemPrompt } from '@/lib/claude/composeSystemPrompt'
import { extractAndSaveMemory, extractEditMemory } from '@/lib/claude/extractMemory'

/**
 * Compose chat handler.
 *
 * Same memory + identity as WhatsApp Nivi:
 *  - Memory retrieval uses the user's actual message as the query
 *  - After every exchange, extractAndSaveMemory runs (learns preferences)
 *  - After every draft edit, extractEditMemory runs (learns edit patterns)
 */

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ComposeRequest {
  postId?: string | null
  messages: ChatMessage[]
  currentDraft: string
  userMessage: string
  // Section-level edit support
  editMode?: 'full' | 'section'
  selectedText?: string
  editAction?: 'rewrite' | 'shorter' | 'expand' | 'punchier' | 'custom'
  // Context from chat panel menus
  targetAudience?: string
  templateId?: string
  webSearch?: boolean
  useIdentity?: boolean
  inspirationId?: string
  knowledgeSourceId?: string
}

const UPDATE_DRAFT_TOOL = {
  name: 'update_draft',
  description:
    'Update the LinkedIn post draft. Use this whenever you create the first draft or apply a change the user asked for (rewrite, shorter, stronger hook, different angle, etc). Pass the FULL new draft content, not just a diff. Also include "why" — a one-sentence rationale.',
  input_schema: {
    type: 'object' as const,
    properties: {
      content: {
        type: 'string',
        description: 'Full new post content (the entire LinkedIn post text)',
      },
      why: {
        type: 'string',
        description: 'One sentence explaining what changed and why',
      },
    },
    required: ['content', 'why'],
  },
}

export async function POST(req: Request) {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as ComposeRequest | null
  if (!body || typeof body.userMessage !== 'string') {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const {
    postId,
    messages,
    currentDraft,
    userMessage,
    editMode,
    selectedText,
    editAction,
    targetAudience,
    templateId,
    knowledgeSourceId,
    inspirationId,
  } = body
  const supabase = getSupabaseAdmin()

  // Strip broken Unicode surrogates that crash the Anthropic API
  function sanitize(str: string): string {
    // eslint-disable-next-line no-control-regex
    return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
  }

  // Build the system prompt with the user's message as the memory retrieval query
  // (same as WhatsApp — contextually retrieves relevant memories)
  const systemPrompt = await buildComposeSystemPrompt(userId, userMessage)
  systemPrompt.static = sanitize(systemPrompt.static)
  systemPrompt.dynamic = sanitize(systemPrompt.dynamic)

  // Build extra context from the chat panel menus
  const contextBlocks: string[] = []

  if (targetAudience) {
    contextBlocks.push(`TARGET AUDIENCE FOR THIS POST: ${targetAudience}`)
  }

  // Fetch writing template if selected
  if (templateId) {
    const { data: tpl } = await supabase
      .from('writing_template')
      .select('name, voice_dna, source_posts')
      .eq('id', templateId)
      .maybeSingle()
    if (tpl) {
      contextBlocks.push(`WRITING STYLE: Write in the voice of "${tpl.name}".${
        tpl.voice_dna ? `\nVoice DNA: ${JSON.stringify(tpl.voice_dna).slice(0, 500)}` : ''
      }${
        tpl.source_posts?.[0] ? `\nReference post:\n"${tpl.source_posts[0].slice(0, 300)}"` : ''
      }`)
    }
  }

  // Fetch knowledge source if selected
  if (knowledgeSourceId) {
    const { data: src } = await supabase
      .from('knowledge_sources')
      .select('title, insights, raw_text')
      .eq('id', knowledgeSourceId)
      .maybeSingle()
    if (src) {
      const content = src.insights || src.raw_text?.slice(0, 1000) || ''
      contextBlocks.push(`KNOWLEDGE CONTEXT from "${src.title}":\n${content}`)
    }
  }

  // Fetch inspiration post if selected
  if (inspirationId) {
    const { data: post } = await supabase
      .from('inspiration_posts')
      .select('content, author_name, topic_pillar, hook_type')
      .eq('id', inspirationId)
      .maybeSingle()
    if (post) {
      contextBlocks.push(`INSPIRATION POST by ${post.author_name || 'Unknown'}${
        post.hook_type ? ` (hook: ${post.hook_type})` : ''
      }:\n"${post.content.slice(0, 500)}"`)
    }
  }

  // Section-edit instruction
  const sectionInstruction =
    editMode === 'section' && selectedText
      ? `\n\n=== SECTION EDIT MODE ===
The user has selected a SPECIFIC section of the post and wants ONLY that section changed. Here is the selected text:
"${selectedText}"

Action requested: ${editAction ?? 'rewrite'}

CRITICAL RULES FOR SECTION EDIT:
- Edit ONLY the selected section. Return the FULL post with that section replaced.
- Every word outside the selection must remain EXACTLY the same — do not touch the hook, the ending, or any other paragraph.
- If the action is "shorter": compress the selection by ~40%.
- If the action is "expand": add 1-2 sentences of depth to the selection.
- If the action is "punchier": make the selection more direct, remove filler words.
- If the action is "rewrite": completely rewrite the selection with a fresh angle, same length.
- If the action is "custom": follow the user's specific instruction for this section only.
`
      : ''

  const extraContext = contextBlocks.length > 0
    ? `\n\n=== ADDITIONAL CONTEXT (selected by user) ===\n${contextBlocks.join('\n\n')}`
    : ''

  const dynamicWithDraft = sanitize(`${systemPrompt.dynamic}${sectionInstruction}${extraContext}

=== CURRENT DRAFT (the post you're iterating on — may be empty on the first turn) ===
${currentDraft || '(no draft yet — this is the first turn)'}`)


  // Build the messages array: prior chat history + the new user message
  const fullMessages = [
    ...messages.map((m) => ({ role: m.role, content: sanitize(m.content) })),
    { role: 'user' as const, content: sanitize(userMessage) },
  ]

  let response
  try {
    response = await new Anthropic().messages.create({
      model: pickModel('post-generation'),
      max_tokens: 8192,
      system: [
        {
          type: 'text',
          text: systemPrompt.static,
          cache_control: { type: 'ephemeral', ttl: '5m' },
        },
        { type: 'text', text: dynamicWithDraft },
      ],
      messages: fullMessages,
      tools: [UPDATE_DRAFT_TOOL],
      metadata: { userId, role: 'post-generation' },
    })
  } catch (err) {
    console.error('[/api/dashboard/compose] Anthropic error:', err)
    return Response.json(
      { error: 'compose model call failed', details: String(err) },
      { status: 500 }
    )
  }

  // Extract reply text and any update_draft tool call
  let reply = ''
  let updatedDraft: string | null = null
  let why: string | null = null

  for (const block of response.content) {
    if (block.type === 'text') {
      reply += block.text
    } else if (block.type === 'tool_use' && block.name === 'update_draft') {
      const input = block.input as { content?: string; why?: string }
      if (typeof input.content === 'string' && input.content.trim().length > 0) {
        updatedDraft = input.content
        why = input.why ?? null
      }
    }
  }

  if (!reply.trim() && updatedDraft) {
    reply = why ? `okay, ${why.toLowerCase()}` : 'okay, updated the draft'
  }
  if (!reply.trim()) {
    reply = 'hmm let me think on that'
  }

  // Persist to posts table if a draft was produced
  let savedPostId = postId ?? null
  let saved = false

  if (updatedDraft) {
    if (savedPostId) {
      const { error } = await supabase
        .from('posts')
        .update({
          content: updatedDraft,
          edit_count: 1,
        })
        .eq('id', savedPostId)
        .eq('user_id', userId)
      if (!error) saved = true
    } else {
      const { data: inserted } = await supabase
        .from('posts')
        .insert({
          user_id: userId,
          content: updatedDraft,
          status: 'draft',
        })
        .select('id')
        .single()
      if (inserted?.id) {
        savedPostId = inserted.id
        saved = true
      }
    }
  }

  // ─── Memory learning (same as WhatsApp) ─────────────────────
  // Run in background — don't block the response
  // 1. Extract conversational memory (preferences, facts, goals)
  extractAndSaveMemory(userId, userMessage, reply).catch((err) =>
    console.error('[compose] memory extraction failed:', err)
  )
  // 2. Extract edit pattern memory when a draft was changed
  if (updatedDraft && currentDraft) {
    extractEditMemory(userId, currentDraft, userMessage, updatedDraft).catch(
      (err) => console.error('[compose] edit memory extraction failed:', err)
    )
  }

  // Log event for Nivi proactive outreach (fire-and-forget, don't block response)
  if (saved && savedPostId) {
    void supabase.from('user_events').insert({
      user_id: userId,
      event_type: 'draft_created',
      metadata: { post_id: savedPostId },
    })
  }
  void supabase.from('users').update({ last_active_at: new Date().toISOString() }).eq('id', userId)

  return Response.json({
    reply: reply.trim(),
    updatedDraft,
    why,
    draftChanged: updatedDraft !== null,
    saved,
    postId: savedPostId,
  })
}
