import { getEnv } from '@/lib/config'

const GEMINI_EMBED_MODEL = 'gemini-embedding-001'
const GEMINI_EMBED_DIM = 768

/**
 * Generate a 768-dim embedding for an inspiration post via Gemini.
 * Reuses the same model + dimension as memoryStore.ts.
 */
export async function embedInspirationPost(
  content: string
): Promise<number[] | null> {
  const apiKey = getEnv('GEMINI_API_KEY')
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${GEMINI_EMBED_MODEL}`,
          content: { parts: [{ text: content.slice(0, 4000) }] },
          outputDimensionality: GEMINI_EMBED_DIM,
        }),
      }
    )
    const data = await res.json()
    const values = data?.embedding?.values
    if (Array.isArray(values) && values.length === GEMINI_EMBED_DIM) {
      return values
    }
    console.error('[embedInspirationPost] unexpected response shape')
    return null
  } catch (e) {
    console.error('[embedInspirationPost] failed:', (e as Error).message)
    return null
  }
}
