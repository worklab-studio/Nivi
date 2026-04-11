import { getEnv } from '@/lib/config'

/**
 * Central model router for Nivi.
 *
 * One place decides which model each call uses. Callers pass a semantic "role"
 * (what is this call trying to do?) and get back a model string. The
 * anthropic-compat wrapper then routes that string to either the real
 * Anthropic SDK (claude-*) or Gemini (gemini-*).
 *
 * Nivi pricing is a single $29/mo plan, so the matrix is role-based only —
 * there is no plan-tier branching.
 *
 * Matrix (as of the Tier 1 rollout):
 *
 *   Sonnet 4.5  — user-visible or publicly-posted prose
 *   Haiku 4.5   — internal Nivi-to-user DMs / cheap classifiers
 *   Flash 2.5   — structured JSON extraction / throwaway / multimodal OCR
 */
export type CallRole =
  // Sonnet — user-facing / publicly-posted prose
  | 'whatsapp-conversation'
  | 'post-generation'
  | 'comment-generation'
  | 'engagement-brief'
  | 'comment-digest'
  | 'onboarding-context'
  | 'style-analysis'
  // Haiku — internal status messages / classifiers / cheap prose
  | 'morning-brief'
  | 'weekly-summary'
  | 'tool-router'
  | 'edit-rewrite'
  // Flash — structured / throwaway / multimodal
  | 'memory-extraction'
  | 'knowledge-extraction'
  | 'image-prompt'
  | 'multimodal-ocr'

// Model identifiers. The anthropic-compat wrapper checks the `claude-` prefix
// to decide which SDK to use.
const SONNET = 'claude-sonnet-4-5'
const HAIKU = 'claude-haiku-4-5'
const FLASH = 'gemini-2.5-flash'

export function pickModel(role: CallRole): string {
  // If there's no Anthropic API key provisioned, downgrade every Claude role
  // to Flash so Nivi keeps working. Logged once at module load.
  if (!hasAnthropicKey()) {
    return FLASH
  }

  switch (role) {
    case 'whatsapp-conversation':
    case 'post-generation':
    case 'comment-generation':
    case 'engagement-brief':
    case 'comment-digest':
    case 'onboarding-context':
    case 'style-analysis':
      return SONNET

    case 'morning-brief':
    case 'weekly-summary':
    case 'tool-router':
    case 'edit-rewrite':
      return HAIKU

    case 'memory-extraction':
    case 'knowledge-extraction':
    case 'image-prompt':
    case 'multimodal-ocr':
      return FLASH
  }
}

let anthropicKeyChecked = false
let anthropicKeyPresent = false
function hasAnthropicKey(): boolean {
  if (!anthropicKeyChecked) {
    anthropicKeyPresent = Boolean(getEnv('ANTHROPIC_API_KEY'))
    anthropicKeyChecked = true
    if (!anthropicKeyPresent) {
      console.warn(
        '[AI Router] ANTHROPIC_API_KEY is not set — all claude-* roles will be downgraded to Gemini Flash. Voice quality will suffer.'
      )
    }
  }
  return anthropicKeyPresent
}
