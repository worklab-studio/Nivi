import Anthropic_SDK from '@anthropic-ai/sdk'
import { getEnv } from '@/lib/config'

/**
 * Unified LLM client that exposes an Anthropic-shaped interface and routes
 * each call to either the real Anthropic SDK (claude-*) or Gemini
 * (gemini-*) based on the `model` string.
 *
 * Callers use the `Anthropic` class just like the real SDK:
 *
 *   import { Anthropic } from '@/lib/ai/anthropic-compat'
 *   import { pickModel } from '@/lib/ai/router'
 *
 *   const client = new Anthropic()
 *   const res = await client.messages.create({
 *     model: pickModel('whatsapp-conversation'),
 *     max_tokens: 8192,
 *     system: [...],
 *     messages: [...],
 *     tools: [...],
 *   })
 *
 * The response shape is always:
 *   { content: ContentBlock[], stop_reason: 'end_turn' | 'tool_use',
 *     usage?: { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens } }
 *
 * Where ContentBlock is `{ type: 'text', text }` or
 * `{ type: 'tool_use', id, name, input }`.
 */

const GEMINI_MODEL_DEFAULT = 'gemini-2.5-flash'

// ──────────────────────────────────────────────────────────────
// Public types (kept identical to the previous shim)
// ──────────────────────────────────────────────────────────────

interface MessageParam {
  role: 'user' | 'assistant'
  content: string | ContentBlock[] | ToolResultBlock[]
}

interface TextBlock {
  type: 'text'
  text: string
  /** Optional cache breakpoint. Anthropic caches everything up to and
   *  including the block with this field set. Used for incremental
   *  history caching on the `messages` array. Stripped before Gemini. */
  cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' }
}

interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string
}

type ContentBlock = TextBlock | ToolUseBlock

interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

// Allow an Anthropic-style cacheable system block.
type SystemBlock =
  | string
  | Array<{ type: 'text'; text: string; cache_control?: { type: 'ephemeral'; ttl?: '5m' | '1h' } }>

interface CreateParams {
  model: string
  max_tokens: number
  system?: SystemBlock
  messages: MessageParam[]
  tools?: ToolDef[]
  temperature?: number
  /**
   * Optional sidecar for logging. When provided, the router writes a row
   * to `nivi_llm_usage` after the call returns. Best-effort, non-blocking.
   * Not forwarded to the upstream SDK.
   */
  metadata?: {
    userId?: string
    role?: string
  }
}

interface Usage {
  input_tokens?: number
  output_tokens?: number
  cache_creation_input_tokens?: number
  cache_read_input_tokens?: number
}

interface CreateResponse {
  content: ContentBlock[]
  stop_reason: 'end_turn' | 'tool_use'
  usage?: Usage
}

// ──────────────────────────────────────────────────────────────
// Anthropic path — forwards to the real SDK
// ──────────────────────────────────────────────────────────────

let cachedAnthropic: Anthropic_SDK | null = null
function getAnthropic(): Anthropic_SDK {
  if (!cachedAnthropic) {
    cachedAnthropic = new Anthropic_SDK({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  }
  return cachedAnthropic
}

/** Strip broken Unicode surrogates that crash the Anthropic JSON parser */
function sanitizeText(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '')
}

function sanitizeParams(params: CreateParams): CreateParams {
  // Sanitize system prompt
  let system = params.system
  if (typeof system === 'string') {
    system = sanitizeText(system)
  } else if (Array.isArray(system)) {
    system = system.map((s) => ({ type: s.type, text: sanitizeText(s.text), cache_control: s.cache_control }))
  }

  // Sanitize messages
  const messages: MessageParam[] = params.messages.map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: sanitizeText(m.content) }
    }
    // For array content (tool_use, tool_result, text blocks), sanitize text fields
    if (Array.isArray(m.content)) {
      const cleaned = m.content.map((block) => {
        if (block.type === 'text') return { type: 'text' as const, text: sanitizeText((block as TextBlock).text) }
        if (block.type === 'tool_result') return { type: 'tool_result' as const, tool_use_id: (block as ToolResultBlock).tool_use_id, content: sanitizeText((block as ToolResultBlock).content) }
        return block
      })
      return { role: m.role, content: cleaned } as MessageParam
    }
    return m
  })

  return { ...params, system, messages }
}

async function callAnthropic(params: CreateParams): Promise<CreateResponse> {
  const client = getAnthropic()
  const sanitized = sanitizeParams(params)

  const res = await client.messages.create({
    model: sanitized.model,
    max_tokens: sanitized.max_tokens,
    temperature: sanitized.temperature ?? 0.9,
    system: sanitized.system as never,
    messages: sanitized.messages as never,
    tools: sanitized.tools as never,
  })

  // Normalize the SDK response into our internal ContentBlock shape.
  const blocks: ContentBlock[] = []
  for (const block of res.content) {
    if (block.type === 'text') {
      blocks.push({ type: 'text', text: block.text })
    } else if (block.type === 'tool_use') {
      blocks.push({
        type: 'tool_use',
        id: block.id,
        name: block.name,
        input: (block.input ?? {}) as Record<string, unknown>,
      })
    }
    // Other block types (thinking, etc.) are ignored for now.
  }

  const stopReason: 'end_turn' | 'tool_use' =
    res.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn'

  return {
    content: blocks.length > 0 ? blocks : [{ type: 'text', text: '' }],
    stop_reason: stopReason,
    usage: {
      input_tokens: res.usage?.input_tokens,
      output_tokens: res.usage?.output_tokens,
      cache_creation_input_tokens: res.usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: res.usage?.cache_read_input_tokens ?? 0,
    },
  }
}

// ──────────────────────────────────────────────────────────────
// Gemini path — hand-rolled REST call with Anthropic-shaped I/O
// ──────────────────────────────────────────────────────────────

async function callGemini(params: CreateParams): Promise<CreateResponse> {
  const apiKey = getEnv('GEMINI_API_KEY')
  const model = params.model.startsWith('gemini-') ? params.model : GEMINI_MODEL_DEFAULT

  // Extract system prompt text (strip cache_control — Gemini has no cache API).
  let systemText = ''
  if (typeof params.system === 'string') {
    systemText = params.system
  } else if (Array.isArray(params.system)) {
    systemText = params.system.map((s) => s.text).join('\n\n')
  }

  // Build Gemini contents from Anthropic-style messages.
  const contents: { role: string; parts: Record<string, unknown>[] }[] = []
  for (const msg of params.messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user'

    if (typeof msg.content === 'string') {
      contents.push({ role, parts: [{ text: msg.content }] })
      continue
    }

    if (!Array.isArray(msg.content)) continue

    const parts: Record<string, unknown>[] = []
    for (const block of msg.content) {
      if (block.type === 'text') {
        parts.push({ text: (block as TextBlock).text })
      } else if (block.type === 'tool_use') {
        const tu = block as ToolUseBlock
        parts.push({ functionCall: { name: tu.name, args: tu.input } })
      } else if (block.type === 'tool_result') {
        const tr = block as ToolResultBlock
        const toolName = findToolName(params.messages, tr.tool_use_id)
        parts.push({
          functionResponse: { name: toolName, response: { result: tr.content } },
        })
      }
    }
    if (parts.length > 0) contents.push({ role, parts })
  }

  const geminiTools =
    params.tools && params.tools.length > 0
      ? [
          {
            function_declarations: params.tools.map((t) => ({
              name: t.name,
              description: t.description,
              parameters: t.input_schema,
            })),
          },
        ]
      : undefined

  const body: Record<string, unknown> = {
    system_instruction: systemText ? { parts: [{ text: systemText }] } : undefined,
    contents,
    generationConfig: {
      maxOutputTokens: params.max_tokens,
      temperature: params.temperature ?? 0.9,
    },
  }
  if (geminiTools) body.tools = geminiTools

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  const data = await res.json()

  if (data.error) {
    console.error('[Gemini Error]', data.error.message)
    return {
      content: [{ type: 'text', text: 'hmm something went wrong, try again?' }],
      stop_reason: 'end_turn',
    }
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

  if (blocks.length === 0) {
    blocks.push({ type: 'text', text: '' })
  }

  return {
    content: blocks,
    stop_reason: hasToolUse ? 'tool_use' : 'end_turn',
  }
}

function findToolName(messages: MessageParam[], toolUseId: string): string {
  for (const msg of messages) {
    if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.type === 'tool_use' && (block as ToolUseBlock).id === toolUseId) {
          return (block as ToolUseBlock).name
        }
      }
    }
  }
  return 'unknown'
}

// ──────────────────────────────────────────────────────────────
// Router entry point
// ──────────────────────────────────────────────────────────────

async function routeCreate(params: CreateParams): Promise<CreateResponse> {
  // Empty model string or explicit gemini → Gemini. Any claude-* → real SDK.
  let result: CreateResponse
  let actualModel = params.model

  if (params.model?.startsWith('claude-')) {
    // Safety: if the env var is missing, fall back to Gemini rather than
    // crashing the request.
    if (!getEnv('ANTHROPIC_API_KEY')) {
      actualModel = GEMINI_MODEL_DEFAULT
      const downgraded = { ...params, model: GEMINI_MODEL_DEFAULT }
      result = await callGemini(downgraded)
    } else {
      result = await callAnthropic(params)
    }
  } else {
    result = await callGemini(params)
  }

  // Fire-and-forget usage logging — feeds Tier 2 cost attribution.
  if (params.metadata?.userId && result.usage) {
    logLLMUsage({
      userId: params.metadata.userId,
      role: params.metadata.role ?? null,
      model: actualModel,
      usage: result.usage,
    }).catch(() => {})
  }

  return result
}

/**
 * Best-effort write to nivi_llm_usage. Uses a lazily-constructed Supabase
 * service client so this file doesn't add a hard dependency on the admin
 * client during module import.
 */
let _supaForLogging: { from: (t: string) => { insert: (row: Record<string, unknown>) => Promise<unknown> } } | null = null
async function logLLMUsage(row: {
  userId: string
  role: string | null
  model: string
  usage: Usage
}): Promise<void> {
  try {
    if (!_supaForLogging) {
      const { createClient } = await import('@supabase/supabase-js')
      const url = getEnv('NEXT_PUBLIC_SUPABASE_URL')
      const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
      if (!url || !key) return
      _supaForLogging = createClient(url, key) as unknown as typeof _supaForLogging
    }
    await _supaForLogging!.from('nivi_llm_usage').insert({
      user_id: row.userId,
      role: row.role,
      model: row.model,
      input_tokens: row.usage.input_tokens ?? 0,
      output_tokens: row.usage.output_tokens ?? 0,
      cache_creation_input_tokens: row.usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: row.usage.cache_read_input_tokens ?? 0,
    })
  } catch {
    // Never let logging break a user-facing call.
  }
}

/**
 * Anthropic-compatible facade used throughout Nivi.
 *
 * Usage: `new Anthropic().messages.create({ model: pickModel(role), ... })`
 *
 * The constructor's `apiKey` argument is accepted for backwards compatibility
 * with the old shim but IGNORED — the router reads `ANTHROPIC_API_KEY` and
 * `GEMINI_API_KEY` directly via `getEnv()`.
 */
export class Anthropic {
  messages: { create: (params: CreateParams) => Promise<CreateResponse> }

  constructor(_opts?: { apiKey?: string }) {
    this.messages = {
      create: routeCreate,
    }
  }
}

// Re-export type namespace that conversation.ts and others consume.
export namespace Anthropic {
  export namespace Messages {
    export type Tool = ToolDef
    export type MessageParam = {
      role: 'user' | 'assistant'
      content: string | ContentBlock[] | ToolResultBlock[]
    }
    export type ToolResultBlockParam = ToolResultBlock
  }
}
