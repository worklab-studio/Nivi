import { getEnv } from '@/lib/config'

/**
 * Unified AI client — wraps Gemini API with a simple interface.
 * Drop-in replacement for Anthropic calls throughout Nivi.
 */

const GEMINI_MODEL = 'gemini-2.5-flash'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Tool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface TextBlock {
  type: 'text'
  text: string
}

type ContentBlock = TextBlock | ToolUseBlock

interface AIResponse {
  content: ContentBlock[]
  stop_reason: 'end_turn' | 'tool_use'
}

function buildGeminiContents(
  systemPrompt: string,
  messages: Message[]
): { system_instruction: { parts: { text: string }[] }; contents: { role: string; parts: { text: string }[] }[] } {
  return {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  }
}

function buildGeminiTools(tools: Tool[]): { function_declarations: { name: string; description: string; parameters: unknown }[] }[] {
  if (tools.length === 0) return []
  return [{
    function_declarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: t.input_schema.properties,
        required: t.input_schema.required ?? [],
      },
    })),
  }]
}

export async function generateAI(opts: {
  system: string
  messages: Message[]
  maxTokens?: number
  tools?: Tool[]
}): Promise<AIResponse> {
  const apiKey = getEnv('GEMINI_API_KEY')
  const { system, messages, maxTokens = 8192, tools = [] } = opts

  const geminiBody: Record<string, unknown> = {
    ...buildGeminiContents(system, messages),
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.9,
    },
  }

  const geminiTools = buildGeminiTools(tools as Tool[])
  if (geminiTools.length > 0) {
    geminiBody.tools = geminiTools
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    }
  )

  const data = await res.json()

  if (data.error) {
    console.error('[AI Error]', data.error.message)
    return { content: [{ type: 'text', text: 'hmm something went wrong on my end, try again?' }], stop_reason: 'end_turn' }
  }

  const candidate = data.candidates?.[0]
  if (!candidate) {
    return { content: [{ type: 'text', text: '' }], stop_reason: 'end_turn' }
  }

  const parts = candidate.content?.parts ?? []
  const blocks: ContentBlock[] = []
  let hasToolUse = false

  for (const part of parts) {
    if (part.functionCall) {
      hasToolUse = true
      blocks.push({
        type: 'tool_use',
        id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
      })
    } else if (part.text) {
      blocks.push({ type: 'text', text: part.text })
    }
  }

  return {
    content: blocks,
    stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
  }
}

/**
 * Send tool results back to Gemini and get the follow-up response
 */
export async function generateAIWithToolResults(opts: {
  system: string
  messages: Message[]
  toolResults: { name: string; result: string }[]
  maxTokens?: number
  tools?: Tool[]
}): Promise<AIResponse> {
  const apiKey = getEnv('GEMINI_API_KEY')
  const { system, messages, toolResults, maxTokens = 8192, tools = [] } = opts

  // Build conversation with tool call + results
  const contents: { role: string; parts: Record<string, unknown>[] }[] = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  // Add tool results as function responses
  if (toolResults.length > 0) {
    contents.push({
      role: 'user',
      parts: toolResults.map((tr) => ({
        functionResponse: {
          name: tr.name,
          response: { result: tr.result },
        },
      })),
    })
  }

  const geminiBody: Record<string, unknown> = {
    system_instruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.9 },
  }

  const geminiTools = buildGeminiTools(tools as Tool[])
  if (geminiTools.length > 0) {
    geminiBody.tools = geminiTools
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    }
  )

  const data = await res.json()

  if (data.error) {
    console.error('[AI Error]', data.error.message)
    return { content: [{ type: 'text', text: '' }], stop_reason: 'end_turn' }
  }

  const parts = data.candidates?.[0]?.content?.parts ?? []
  const blocks: ContentBlock[] = []
  let hasToolUse = false

  for (const part of parts) {
    if (part.functionCall) {
      hasToolUse = true
      blocks.push({
        type: 'tool_use',
        id: `tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: part.functionCall.name,
        input: part.functionCall.args ?? {},
      })
    } else if (part.text) {
      blocks.push({ type: 'text', text: part.text })
    }
  }

  return {
    content: blocks,
    stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
  }
}
