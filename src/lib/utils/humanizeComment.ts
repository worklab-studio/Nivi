/**
 * Apply controlled randomness to LLM-generated comment text so it's
 * harder for LinkedIn's spam ML to fingerprint as bot output.
 *
 * The transformations are intentionally subtle:
 *   • never mangle the meaning
 *   • never apply more than 2 transformations to a single comment
 *   • deterministic per-user-per-day-per-text-length (so re-generating
 *     the same draft for the same user produces the same humanized
 *     output — important for the C1/C2/C3 approve flow where the user
 *     might see the draft, dismiss it, and ask for it again)
 *
 * This is one of the cheaper Tier 2 wins — drops AI-classifier
 * confidence on the comment significantly without touching voice quality.
 */
export function humanizeComment(text: string, userId: string): string {
  if (!text || text.length < 10) return text

  const seed = `${userId}|${new Date().toISOString().split('T')[0]}|${text.length}`
  const rng = mulberry32(hashSeed(seed))

  const transformations: Array<(s: string) => string> = []

  // ~30% drop trailing period
  if (rng() < 0.3 && /\.$/.test(text.trim())) {
    transformations.push((s) => s.trim().replace(/\.$/, ''))
  }

  // ~25% lowercase first letter (reactions like "ngl, this is fire" feel right)
  if (rng() < 0.25 && /^[A-Z]/.test(text)) {
    transformations.push((s) => s.charAt(0).toLowerCase() + s.slice(1))
  }

  // ~20% drop apostrophes in common contractions
  if (rng() < 0.2) {
    transformations.push((s) =>
      s.replace(
        /\b(you|it|that|don|can|isn|wasn|won|they|we|i|youve|theyre|weve)'(re|s|t|ll|ve|d)\b/gi,
        '$1$2'
      )
    )
  }

  // ~15% replace em-dash with " - " or "..."
  if (rng() < 0.15 && /—/.test(text)) {
    transformations.push((s) => s.replace(/—/g, rng() < 0.5 ? ' - ' : '...'))
  }

  // Cap at 2 transformations to avoid mangling
  const applied = transformations.slice(0, 2)
  return applied.reduce((acc, t) => t(acc), text)
}

/** Tiny FNV-1a 32-bit hash for deterministic seeding */
function hashSeed(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Small fast deterministic PRNG */
function mulberry32(a: number): () => number {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
