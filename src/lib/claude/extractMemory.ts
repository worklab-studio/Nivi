import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { getEnv } from '@/lib/config'
import { storeUserMemory } from '@/lib/vector/memoryStore'

/**
 * Layer 2 — Continuous Memory Extraction
 * Runs after EVERY conversation. Extracts everything worth remembering.
 * Gets smarter over time as more facts accumulate.
 */
export async function extractAndSaveMemory(
  userId: string,
  userMessage: string,
  niviReply: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })

  // Load existing facts for dedup
  const { data: existing } = await supabase
    .from('user_memory')
    .select('fact, category')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(80)

  const existingFacts = existing?.map((m) => `[${m.category}] ${m.fact}`).join('\n') ?? ''

  const response = await anthropic.messages.create({
    model: pickModel('memory-extraction'),
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `You are Nivi's memory system. Extract EVERYTHING worth remembering from this exchange.

EXTRACT AGGRESSIVELY. Categories:

PREFERENCE — how they like things done:
- Post length preferences (wanted shorter/longer)
- Tone preferences (more casual, more professional)
- Hook style preferences (which they responded to positively)
- Editing patterns (what they always change)
- Formatting preferences
- Topics they want more/less of
- "Make it shorter" → preference: prefers concise posts under 150 words
- "I like this hook style" → preference: responds well to almost-formula hooks

FACT — permanent truths about them:
- Business details, products, revenue, team size
- Background, experience, skills
- Current projects, clients, partnerships
- Personal details they share (family, location, routines)
- Tech stack, tools they use

GOAL — what they're trying to achieve:
- LinkedIn follower targets
- Revenue goals, launch dates
- Content strategy objectives
- Brand positioning goals
- "I want to be known for X"

PATTERN — behavioral patterns you notice:
- When they're most active (time of day)
- How they respond to different post types
- What makes them skip posts
- Their editing habits
- Engagement patterns
- "They always edit hooks" → pattern: frequently requests hook rewrites
- "They post more on weekdays" → pattern: prefers weekday posting

AVOID — things they don't want:
- Topics they rejected
- Phrases they don't like
- Styles they pushed back on
- "Don't use emojis" → avoid: emojis in posts
- "Stop being so formal" → avoid: formal corporate tone

USER: "${userMessage}"
NIVI: "${niviReply}"

EXISTING (do NOT duplicate):
${existingFacts}

Return JSON array. Empty [] if nothing new. Be thorough but avoid duplicates.
[{"fact": "specific fact", "category": "preference|fact|goal|pattern|avoid", "confidence": 0.6-1.0}]
confidence: 0.6=implied, 0.8=stated clearly, 1.0=explicit statement`,
      },
    ],
  })

  try {
    const text =
      response.content[0].type === 'text'
        ? response.content[0].text.trim()
        : '[]'
    const clean = text.replace(/```json\n?|```/g, '').trim()
    const facts: { fact: string; category: string; confidence?: number }[] =
      JSON.parse(clean)

    if (!Array.isArray(facts) || facts.length === 0) return

    const validCategories = ['preference', 'fact', 'goal', 'pattern', 'avoid']
    const rows = facts
      .filter((f) => f.fact && validCategories.includes(f.category))
      .map((f) => ({
        user_id: userId,
        fact: f.fact,
        category: f.category,
        confidence: f.confidence ?? 0.8,
        source: 'conversation',
      }))

    if (rows.length > 0) {
      // Insert into Supabase, then fan out to the embedding write. The
      // embedding lives in the same row (user_memory.embedding vector(768))
      // so storeUserMemory does an UPDATE, not a separate index write.
      const { data: inserted } = await supabase
        .from('user_memory')
        .insert(rows)
        .select('id, fact, category')

      if (inserted) {
        await Promise.all(
          inserted.map((row) =>
            storeUserMemory(userId, row.id, row.fact, row.category)
          )
        )
      }
    }
  } catch {
    // Parsing failed — skip silently
  }
}

/**
 * Extract memory from a post edit — learns editing preferences
 */
export async function extractEditMemory(
  userId: string,
  originalPost: string,
  editInstruction: string,
  editedPost: string
): Promise<void> {
  const supabase = getSupabaseAdmin()
  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })

  const response = await anthropic.messages.create({
    model: pickModel('memory-extraction'),
    max_tokens: 8192,
    messages: [
      {
        role: 'user',
        content: `User edited a post. What does this tell us about their preferences?

ORIGINAL: "${originalPost.slice(0, 200)}"
EDIT REQUEST: "${editInstruction}"
RESULT: "${editedPost.slice(0, 200)}"

Extract 1-3 preference/pattern facts. Return JSON array.
[{"fact": "...", "category": "preference|pattern", "confidence": 0.9}]`,
      },
    ],
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]'
    const clean = text.replace(/```json\n?|```/g, '').trim()
    const facts = JSON.parse(clean)
    if (Array.isArray(facts) && facts.length > 0) {
      const rows = facts
        .filter(
          (f: { fact: string; category: string }) =>
            f.fact && ['preference', 'pattern', 'avoid'].includes(f.category)
        )
        .map((f: { fact: string; category: string; confidence?: number }) => ({
          user_id: userId,
          fact: f.fact,
          category: f.category,
          confidence: f.confidence ?? 0.9,
          source: 'edit_pattern',
        }))

      if (rows.length > 0) {
        const { data: inserted } = await supabase
          .from('user_memory')
          .insert(rows)
          .select('id, fact, category')

        if (inserted) {
          await Promise.all(
            inserted.map((row) =>
              storeUserMemory(userId, row.id, row.fact, row.category)
            )
          )
        }
      }
    }
  } catch { /* skip */ }
}
