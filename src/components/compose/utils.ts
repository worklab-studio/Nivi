/**
 * Compose-page text utilities.
 *
 * - markdownToLinkedInText: converts simple markdown (**bold**, *italic*,
 *   ~~strikethrough~~) to LinkedIn-renderable unicode-bold/italic
 *   characters. LinkedIn doesn't render markdown but DOES render the
 *   Mathematical Bold / Italic unicode block, which produces the same
 *   visual effect.
 *
 * - truncateToHook: returns the portion of the post that LinkedIn
 *   displays before "see more" cuts in. Cutoff thresholds match
 *   LinkedIn's actual feed renderer (verified against real LinkedIn).
 */

const A_UPPER = 0x41
const A_LOWER = 0x61
const ZERO = 0x30

// Mathematical Bold (U+1D400 onwards)
const BOLD_UPPER = 0x1d400
const BOLD_LOWER = 0x1d41a
const BOLD_DIGIT = 0x1d7ce

// Mathematical Italic (U+1D434 onwards)
const ITALIC_UPPER = 0x1d434
const ITALIC_LOWER = 0x1d44e

// Mathematical Bold Italic (U+1D468 onwards)
const BOLD_ITALIC_UPPER = 0x1d468
const BOLD_ITALIC_LOWER = 0x1d482

function toUnicodeRange(
  text: string,
  upperBase: number,
  lowerBase: number,
  digitBase?: number
): string {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (code >= 0x41 && code <= 0x5a) {
      out += String.fromCodePoint(upperBase + (code - A_UPPER))
    } else if (code >= 0x61 && code <= 0x7a) {
      out += String.fromCodePoint(lowerBase + (code - A_LOWER))
    } else if (digitBase && code >= 0x30 && code <= 0x39) {
      out += String.fromCodePoint(digitBase + (code - ZERO))
    } else {
      out += ch
    }
  }
  return out
}

export function toLinkedInBold(text: string): string {
  return toUnicodeRange(text, BOLD_UPPER, BOLD_LOWER, BOLD_DIGIT)
}

export function toLinkedInItalic(text: string): string {
  // Italic ASCII letter `h` is reserved (U+210E PLANCK CONSTANT) — handled by mapping inline.
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0
    if (ch === 'h') {
      out += '\u210E'
    } else if (code >= 0x41 && code <= 0x5a) {
      out += String.fromCodePoint(ITALIC_UPPER + (code - A_UPPER))
    } else if (code >= 0x61 && code <= 0x7a) {
      out += String.fromCodePoint(ITALIC_LOWER + (code - A_LOWER))
    } else {
      out += ch
    }
  }
  return out
}

export function toLinkedInBoldItalic(text: string): string {
  return toUnicodeRange(text, BOLD_ITALIC_UPPER, BOLD_ITALIC_LOWER)
}

/**
 * Convert simple markdown (**bold**, *italic*, ~~strike~~) to the
 * unicode characters LinkedIn renders natively.
 *
 * Order matters: bold-italic before bold before italic, otherwise the
 * regexes overlap incorrectly.
 */
export function markdownToLinkedInText(md: string): string {
  if (!md) return ''
  let out = md

  // Bold-italic ***text***
  out = out.replace(/\*\*\*(.+?)\*\*\*/g, (_, t) => toLinkedInBoldItalic(t))
  // Bold **text**
  out = out.replace(/\*\*(.+?)\*\*/g, (_, t) => toLinkedInBold(t))
  // Italic *text* (single asterisks)
  out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, (_, t) =>
    toLinkedInItalic(t)
  )
  // Strikethrough ~~text~~ → LinkedIn doesn't have a unicode strike block;
  // use combining stroke characters as a fallback
  out = out.replace(/~~(.+?)~~/g, (_, t: string) =>
    [...t].map((c) => `${c}\u0336`).join('')
  )

  return out
}

/**
 * LinkedIn's "see more" cutoff is character-and-line based. The actual
 * thresholds vary by viewport. Verified against real LinkedIn renders:
 *
 *   mobile  (375px wide):  ~140 chars OR 3 visual lines, whichever first
 *   tablet  (680px wide):  ~210 chars OR 4 visual lines, whichever first
 *   desktop (544px wide):  ~210 chars OR 3 visual lines (LinkedIn's
 *                           feed column is narrower than tablet because
 *                           of sidebars, but renders more chars per line)
 */
export function truncateToHook(
  text: string,
  mode: 'mobile' | 'tablet' | 'desktop'
): { visible: string; truncated: boolean } {
  if (!text) return { visible: '', truncated: false }

  const charLimit = mode === 'mobile' ? 140 : 210
  const lineLimit = mode === 'mobile' ? 3 : mode === 'tablet' ? 4 : 3

  // First check line count — split on \n and count
  const lines = text.split('\n')
  if (lines.length > lineLimit) {
    const head = lines.slice(0, lineLimit).join('\n')
    return { visible: head, truncated: true }
  }

  if (text.length > charLimit) {
    // Find the last space before the limit so we don't break a word
    const slice = text.slice(0, charLimit)
    const lastSpace = slice.lastIndexOf(' ')
    const cut = lastSpace > charLimit * 0.6 ? slice.slice(0, lastSpace) : slice
    return { visible: cut, truncated: true }
  }

  return { visible: text, truncated: false }
}

/**
 * Plain character count for the toolbar — counts unicode-aware.
 */
export function countChars(text: string): number {
  return [...(text ?? '')].length
}
