import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getEnv } from '@/lib/config'

export interface ExtractedOffer {
  name: string
  description: string
  url: string
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[extractOfferFromUrl] parse failed', e, text.slice(0, 200))
    return null
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchPageText(normalized: string): Promise<{ text: string; source: string }> {
  // Try Jina Reader first — clean markdown
  try {
    const res = await fetch(`https://r.jina.ai/${normalized}`, {
      headers: { 'X-Return-Format': 'markdown' },
    })
    if (res.ok) {
      const text = await res.text()
      console.log('[extractOfferFromUrl] jina', normalized, 'len=', text.length)
      if (text && text.length > 200) return { text, source: 'jina' }
    } else {
      console.warn('[extractOfferFromUrl] jina returned', res.status)
    }
  } catch (e) {
    console.warn('[extractOfferFromUrl] jina threw', e)
  }

  // Fallback: plain HTML fetch + tag strip
  try {
    const res = await fetch(normalized, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()
    const text = stripHtml(html)
    console.log('[extractOfferFromUrl] fallback html', normalized, 'len=', text.length)
    return { text, source: 'html' }
  } catch (e) {
    throw new Error(`Failed to fetch ${normalized}: ${(e as Error).message}`)
  }
}

export async function extractOfferFromUrl(url: string): Promise<ExtractedOffer> {
  let normalized = url.trim()
  if (!/^https?:\/\//.test(normalized)) normalized = `https://${normalized}`

  const { text: pageText, source } = await fetchPageText(normalized)

  if (!pageText || pageText.length < 50) {
    throw new Error('Page returned too little content')
  }

  const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })
  const response = await anthropic.messages.create({
    model: pickModel('edit-rewrite'),
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Read this webpage and extract the offer (product / service / company) it represents. Write a sharp, founder-voice description that will be dropped directly into the user's personal-brand Identity.

Required quality bar:
- 5-7 sentences, dense and specific. No fluff, no marketing-speak.
- First person ("I built…" / "I help…" / "We're building…").
- Sentence 1: WHAT it is in plain English (category + one-line distinctive).
- Sentence 2-3: WHO it's for and the specific pain it solves.
- Sentence 4-5: HOW it works / what makes it different (1-2 concrete mechanics).
- Sentence 6-7: OUTCOME the user gets (numbers if the page has them, otherwise concrete results).
- Pull real names, real numbers, real features from the page. Never invent.
- If the page mentions a target audience explicitly, name them.
- No "leverage", no "unlock", no "empower", no "seamless", no em dashes.

Return ONLY a JSON object, no prose, no markdown fences:
{"name":"<short product/service name>","description":"<5-7 sentences as specified>","url":"${normalized}"}

PAGE CONTENT (source: ${source}):
${pageText.slice(0, 12000)}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  console.log('[extractOfferFromUrl] response len=', text.length)
  const parsed = safeJson<ExtractedOffer>(text)
  if (!parsed) throw new Error('Claude returned unparseable response')
  return parsed
}
