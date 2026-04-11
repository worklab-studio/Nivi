import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getEnv } from '@/lib/config'

export interface VoiceDNA {
  hook_formula: {
    pattern: string
    example: string
    why_it_works: string
  }
  logic_flow: string[]
  rhetorical_devices: string[]
  sentence_rhythm: {
    avg_line_length: string
    paragraph_pattern: string
    pacing: string
  }
  vocabulary_signature: {
    signature_words: string[]
    avoided_words: string[]
  }
  psychological_hooks: string[]
  formatting_patterns: {
    uses_bullets: boolean
    bullet_style: string
    uses_bold: boolean
    whitespace: string
    line_breaks: string
  }
  closing_pattern: {
    technique: string
    example: string
    psychology: string
  }
}

export interface ExtractedTemplate {
  name: string
  author_name: string
  author_headline: string
  post_body: string
  hook_style: string
  sentence_style: string
  ending_style: string
  avatar_url?: string
  voice_dna?: VoiceDNA
}

/**
 * Pull the LinkedIn profile photo URL out of Jina Reader markdown.
 */
function findAvatarUrlInMarkdown(markdown: string): string | undefined {
  const photoMatch = markdown.match(
    /https:\/\/media\.licdn\.com\/dms\/image\/[^\s)"'<>]*profile-displayphoto[^\s)"'<>]+/
  )
  return photoMatch?.[0]
}

/**
 * If Claude flattens the post body, split on strong sentence boundaries.
 * Conservative: only reflows when there are zero blank lines.
 */
function reflowParagraphs(text: string): string {
  if (!text || text.length < 200) return text
  if (/\n\s*\n/.test(text)) return text
  return text
    .replace(/([.!?])\s+(?=[A-Z"'“])/g, '$1\n\n')
    .replace(/\s*(?:—|–)\s*/g, ' — ')
    .replace(/(^|\n)\s*(→|✦|•)\s*/g, '\n\n$2 ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[extractTemplateFromUrl] JSON parse failed', e, text.slice(0, 200))
    return null
  }
}

/**
 * Fetch a LinkedIn post URL via Jina Reader and use Claude Sonnet to
 * deep-extract the replicable voice DNA — hook formula, logic flow,
 * rhetorical devices, sentence rhythm, vocabulary signature, psychological
 * hooks, formatting patterns, and closing pattern.
 *
 * The voice_dna JSON is what drives Nivi's post generation at prompt time.
 * The flat hook_style / sentence_style / ending_style strings are derived
 * human-readable summaries used by the UI modal.
 */
export async function extractTemplateFromUrl(
  url: string
): Promise<ExtractedTemplate> {
  let normalized = url.trim()
  if (!/^https?:\/\//.test(normalized)) normalized = `https://${normalized}`
  if (!/linkedin\.com/i.test(normalized)) {
    throw new Error('Please paste a LinkedIn post URL')
  }

  let pageText = ''
  try {
    const res = await fetch(`https://r.jina.ai/${normalized}`, {
      headers: { 'X-Return-Format': 'markdown' },
    })
    if (!res.ok) throw new Error(`Jina Reader returned ${res.status}`)
    pageText = await res.text()
    console.log('[extractTemplateFromUrl] jina', normalized, 'len=', pageText.length)
  } catch (e) {
    throw new Error(`Failed to fetch post: ${(e as Error).message}`)
  }

  if (!pageText || pageText.length < 200) {
    throw new Error('LinkedIn returned a login wall or empty page for this post.')
  }

  const regexAvatar = findAvatarUrlInMarkdown(pageText)

  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const response = await anthropic.messages.create({
    model: pickModel('style-analysis'),
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are a senior copy analyst. Your job is to reverse-engineer a LinkedIn post into a REPLICABLE template — the voice DNA that another writer can use to produce new posts in exactly the same style.

Find the main post body in the Jina-scraped markdown below (NOT comments, NOT related posts, NOT navigation). It's usually the longest contiguous block of text by the author near the top.

YOUR OUTPUT HAS TWO PARTS:

PART 1 — labelled metadata, the verbatim post body, and short human-readable summaries.
PART 2 — a rich voice_dna JSON object that captures the FULL replicable pattern.

CRITICAL RULES:
- Do NOT describe what the post is about. Extract the STRUCTURE so another writer can replicate it on any topic.
- Every claim must be anchored in the actual post text. Quote fragments directly when possible.
- When in doubt, extract MORE specificity, not less. This DNA will feed a post generator.
- Preserve every line break in the post body exactly. One thought per line, blank line between paragraphs.

=============================================================
PART 1 — labelled output
=============================================================

NAME: <author first name + " Style", e.g. "Justin Style">
AUTHOR: <full author name>
HEADLINE: <their LinkedIn headline, or a short descriptor>
AVATAR_URL: <author's PROFILE PHOTO URL — must contain "profile-displayphoto" in the path (NOT profile-displaybackgroundimage, NOT feedshare, NOT company-logo). Leave empty if no profile-displayphoto URL is visible.>
HOOK_STYLE: <one sentence naming the hook TYPE, e.g. "Concrete dollar figure + period-separated disqualifiers">
SENTENCE_STYLE: <one sentence naming the rhythm, e.g. "Short asyndeton fragments + one anaphoric timeline block">
ENDING_STYLE: <one sentence naming the closing technique, e.g. "Binary rhetorical question forcing self-placement">
<<<POST>>>
<FULL post text, real line breaks, one thought per line, blank line between paragraphs>
<<<END>>>

=============================================================
PART 2 — voice_dna JSON
=============================================================

Output this between <<<DNA>>> and <<<ENDDNA>>> sentinels. Pure JSON only, no markdown fences.

<<<DNA>>>
{
  "hook_formula": {
    "pattern": "<the replicable opening structure in abstract terms, e.g. 'Specific number + period-separated self-disqualifiers + contrarian pivot'>",
    "example": "<the verbatim opening fragment from the post>",
    "why_it_works": "<1 sentence on the psychological mechanism>"
  },
  "logic_flow": [
    "<Beat 1 — what the opening does>",
    "<Beat 2 — how it transitions>",
    "<Beat 3 — ... continue for 5-8 beats total>"
  ],
  "rhetorical_devices": [
    "<Named device (Anaphora, Asyndeton, Interrogatio, Antithesis, etc.) — one-line explanation of how this post uses it>",
    "<... 3-5 devices>"
  ],
  "sentence_rhythm": {
    "avg_line_length": "<e.g. '6-10 words'>",
    "paragraph_pattern": "<e.g. '1-1-2-4-1-1-1 lines per paragraph'>",
    "pacing": "<e.g. 'Stark-stark-stark-expansion-stark — compression builds tension, expansion releases it'>"
  },
  "vocabulary_signature": {
    "signature_words": ["<reusable phrases this author would write>", "..."],
    "avoided_words": ["<LinkedIn clichés this post conspicuously avoids>", "..."]
  },
  "psychological_hooks": [
    "<Named hook (Curiosity gap, Social proof, Contrarian authority, Self-identification, etc.) — how this post uses it>",
    "<... 3-5 hooks>"
  ],
  "formatting_patterns": {
    "uses_bullets": <true|false>,
    "bullet_style": "<'arrow (→)' / 'diamond (✦)' / 'numbered' / 'dash' / 'none'>",
    "uses_bold": <true|false>,
    "whitespace": "<'blank line between every 1-2 lines' / 'dense, no gaps' / ...>",
    "line_breaks": "<'aggressive' / 'moderate' / 'conservative'>"
  },
  "closing_pattern": {
    "technique": "<the closing move in structural terms>",
    "example": "<verbatim closing line>",
    "psychology": "<why it drives replies / engagement>"
  }
}
<<<ENDDNA>>>

If the page is a login wall or no post body exists, output exactly:
ERROR: no post found

=============================================================
WORKED EXAMPLE (do not copy — for quality reference only)
=============================================================

For a hypothetical Justin Welsh post "I made $5.4M in 4 years. Solo. No team. No office. No VC. Here's the truth no one talks about: → The first year was painfully quiet → The second year I almost quit twice → The third year I finally "got" it → The fourth year compounded everything. If you're in year one right now, please read this carefully: Your "overnight success" is going to take 3-5 years of boring, repetitive, unsexy work. That's the deal. Most people won't pay it. That's why the reward is so large for the ones who do. What year are you in?"

The voice_dna should look like this (abstract enough to apply to any topic):

{
  "hook_formula": {
    "pattern": "Concrete dollar amount + period-separated self-disqualifiers + 'here's the truth no one talks about' contrarian pivot",
    "example": "I made $5.4M in 4 years. Solo. No team. No office. No VC.",
    "why_it_works": "The number is specific enough to feel real; the fragments are ego-bait and reading rhythm in one move."
  },
  "logic_flow": [
    "Hook: concrete achievement with surprising specificity",
    "Qualifiers: period-separated fragments disqualifying easy explanations",
    "Pivot: insider-framing transition ('here's the truth')",
    "Timeline breakdown: 3-5 arrow beats showing progression",
    "Direct address: 'if you're in year one' speaks to one reader",
    "Payoff: short absolute statement ('That's the deal')",
    "Reward framing: explains why the pattern persists",
    "Close: binary self-placement question"
  ],
  "rhetorical_devices": [
    "Asyndeton — period fragments without conjunctions create velocity",
    "Anaphora — 'The first year / The second year' repeated openings build momentum",
    "Interrogatio — closes with a question that demands self-categorization",
    "Contrarian authority — 'the truth no one talks about' creates insider status"
  ],
  "sentence_rhythm": {
    "avg_line_length": "6-10 words",
    "paragraph_pattern": "1-1-4-1-1-1-1 lines per paragraph",
    "pacing": "Stark-stark-expansion-stark — compression builds, expansion releases"
  },
  "vocabulary_signature": {
    "signature_words": ["Solo", "That's the deal", "boring", "unsexy", "compounded", "quietly"],
    "avoided_words": ["excited", "thrilled", "journey", "grateful", "humbled", "blessed"]
  },
  "psychological_hooks": [
    "Curiosity gap — the number invites the reader to find out how",
    "Social proof — $5.4M as self-evident credential, no validation needed",
    "Contrarian authority — positions the writer as seeing through the noise",
    "Self-identification — the closing question forces the reader into the story"
  ],
  "formatting_patterns": {
    "uses_bullets": true,
    "bullet_style": "arrow (→)",
    "uses_bold": false,
    "whitespace": "blank line between every 1-2 lines",
    "line_breaks": "aggressive"
  },
  "closing_pattern": {
    "technique": "Binary rhetorical question forcing self-placement into a named category",
    "example": "What year are you in?",
    "psychology": "Categorical self-placement has a much higher reply rate than open-ended 'what do you think' — the reader already has an answer the moment they read the hook"
  }
}

=============================================================
PAGE CONTENT
=============================================================
${pageText.slice(0, 12000)}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  console.log('[extractTemplateFromUrl] response len=', text.length)

  if (/^ERROR:/m.test(text)) {
    throw new Error('Could not find a post body — page may be a login wall')
  }

  // Parse the labelled output
  const grab = (label: string) => {
    const m = text.match(new RegExp(`^${label}:\\s*(.+)$`, 'm'))
    return m?.[1]?.trim() ?? ''
  }
  const postMatch = text.match(/<<<POST>>>\s*([\s\S]*?)\s*<<<END>>>/)
  let postBody = postMatch?.[1]?.trim() ?? ''

  if (!postBody) {
    console.error('[extractTemplateFromUrl] no post body parsed', text.slice(0, 400))
    throw new Error('Could not extract a post from this URL')
  }

  postBody = reflowParagraphs(postBody)

  // Parse the voice_dna JSON between <<<DNA>>> and <<<ENDDNA>>>
  const dnaMatch = text.match(/<<<DNA>>>\s*([\s\S]*?)\s*<<<ENDDNA>>>/)
  let voice_dna: VoiceDNA | undefined
  if (dnaMatch?.[1]) {
    const parsed = safeJson<VoiceDNA>(dnaMatch[1])
    if (parsed) voice_dna = parsed
    else console.warn('[extractTemplateFromUrl] voice_dna JSON parse failed')
  } else {
    console.warn('[extractTemplateFromUrl] no <<<DNA>>> sentinel found')
  }

  const author_name = grab('AUTHOR') || 'Unknown'
  const name = grab('NAME') || `${author_name.split(' ')[0]} Style`
  const claudeAvatar = grab('AVATAR_URL')
  const avatar_url = regexAvatar || claudeAvatar || undefined

  return {
    name,
    author_name,
    author_headline: grab('HEADLINE'),
    post_body: postBody,
    hook_style: grab('HOOK_STYLE'),
    sentence_style: grab('SENTENCE_STYLE'),
    ending_style: grab('ENDING_STYLE'),
    avatar_url,
    voice_dna,
  }
}
