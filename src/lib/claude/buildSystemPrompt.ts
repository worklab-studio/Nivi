import { createClient } from '@supabase/supabase-js'
import { queryRelevantMemories } from '@/lib/vector/memoryStore'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

interface AnalyticsSummary {
  bestPostPreview: string
  bestHookType: string
  recentPillars: string
  missingPillar: number
  daysSinceLastPost: number
  avgEngagementRate: string
}

async function getAnalyticsSummary(
  userId: string
): Promise<AnalyticsSummary> {
  const supabase = getSupabase()
  const { data: posts } = await supabase
    .from('posts')
    .select('*, post_analytics(*)')
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(30)

  if (!posts || posts.length === 0) {
    return {
      bestPostPreview: 'No posts yet',
      bestHookType: 'almost_formula',
      recentPillars: 'None yet',
      missingPillar: 1,
      daysSinceLastPost: 0,
      avgEngagementRate: '0',
    }
  }

  const sorted = [...posts].sort(
    (a, b) =>
      (b.post_analytics?.[0]?.impressions ?? 0) -
      (a.post_analytics?.[0]?.impressions ?? 0)
  )

  const recentPillarNums = posts
    .slice(0, 10)
    .map((p) => p.content_pillar)
    .filter(Boolean)
  const pillarCounts = [1, 2, 3, 4, 5].map((p) => ({
    p,
    count: recentPillarNums.filter((n) => n === p).length,
  }))
  const missingPillar = pillarCounts.sort((a, b) => a.count - b.count)[0].p

  const hooksByEngagement: Record<string, number> = {}
  posts.forEach((p) => {
    if (p.hook_type && p.post_analytics?.[0]) {
      hooksByEngagement[p.hook_type] =
        (hooksByEngagement[p.hook_type] ?? 0) +
        (p.post_analytics[0].likes ?? 0)
    }
  })
  const bestHookType =
    Object.entries(hooksByEngagement).sort((a, b) => b[1] - a[1])[0]?.[0] ??
    'almost_formula'

  const last = posts[0]
  const daysSince = Math.floor(
    (Date.now() - new Date(last.created_at).getTime()) / 86400000
  )

  const totalEngagement = posts.reduce(
    (sum, p) => sum + (p.post_analytics?.[0]?.engagement_rate ?? 0),
    0
  )
  const avgEngagementRate = (totalEngagement / posts.length).toFixed(1)

  return {
    bestPostPreview: sorted[0]?.content?.slice(0, 100) ?? '',
    bestHookType,
    recentPillars: recentPillarNums.slice(0, 5).join(', '),
    missingPillar,
    daysSinceLastPost: daysSince,
    avgEngagementRate,
  }
}

/**
 * Returns the Nivi system prompt split into two blocks:
 *   - `static`  → cacheable. Stable per user across turns (identity, voice
 *                  files, post-writing rules).
 *   - `dynamic` → not cached. Per-turn state (memories, recent performance,
 *                  recent posts) that would bust the cache key.
 *
 * Callers should pass them as:
 *   system: [
 *     { type: 'text', text: prompt.static, cache_control: { type: 'ephemeral', ttl: '5m' } },
 *     { type: 'text', text: prompt.dynamic },
 *   ]
 */
export interface NiviSystemPrompt {
  static: string
  dynamic: string
  /** Ids of `user_memory` rows injected into the dynamic block. Used by
   *  post-generation paths to snapshot into `post_memory_links` for
   *  future performance-weighted retrieval. */
  injectedMemoryIds: string[]
}

const BRIEF_MEMORY_QUERY =
  'posting today, content strategy, voice, recent performance, what they want to be known for, what they avoid'

export async function buildNiviSystemPrompt(
  userId: string,
  /** Optional focus query for memory retrieval. Defaults to a posting-focused
   * query suitable for morning/weekly/engagement briefs. Chat callers should
   * pass the user's incoming message text. */
  retrievalQuery: string = BRIEF_MEMORY_QUERY
): Promise<NiviSystemPrompt> {
  const supabase = getSupabase()

  const [userRes, contextRes, identityRes, goalAvoidRes, analytics, recentRes, retrieved] =
    await Promise.all([
      supabase.from('users').select('*').eq('id', userId).single(),
      supabase
        .from('context_files')
        .select('*')
        .eq('user_id', userId)
        .single(),
      supabase
        .from('brand_identity')
        .select(
          'identity_summary, identity_facets, writing_preferences, content_pillars, active_template_id, hook_style, sentence_style, ending_style'
        )
        .eq('user_id', userId)
        .maybeSingle(),
      supabase
        .from('user_memory')
        .select('id, fact, category')
        .eq('user_id', userId)
        .in('category', ['goal', 'avoid'])
        .order('confidence', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(5),
      getAnalyticsSummary(userId),
      supabase
        .from('posts')
        .select('content,hook_type,content_pillar,status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10),
      queryRelevantMemories(userId, retrievalQuery, 8),
    ])

  const user = userRes.data
  const ctx = contextRes.data
  const ident = identityRes.data as
    | {
        identity_summary?: string | null
        identity_facets?: Record<string, unknown> | null
        writing_preferences?: string[] | null
        content_pillars?:
          | Array<{
              name: string
              description: string
              example_topics?: string[]
              funnel_stage?: string
              audience_pain?: string
              writer_moat?: string
              offer_adjacency?: string
              proof_moment?: string
            }>
          | null
        active_template_id?: string | null
        hook_style?: string | null
        sentence_style?: string | null
        ending_style?: string | null
      }
    | null
  const recent = recentRes.data ?? []

  // Fetch the active writing template row (if any) for its sample post + voice DNA.
  // Dependent query — not in the parallel batch above because it needs ident.
  interface ActiveTemplate {
    name: string
    author_name: string
    source_posts: string[] | null
    voice_dna: Record<string, unknown> | null
  }
  let activeTemplate: ActiveTemplate | null = null
  if (ident?.active_template_id) {
    const { data: tpl } = await supabase
      .from('writing_template')
      .select('name, author_name, source_posts, voice_dna')
      .eq('id', ident.active_template_id)
      .maybeSingle()
    activeTemplate = (tpl as ActiveTemplate | null) ?? null
  }

  // Prefer the distilled brand_identity block when available; falls back to
  // legacy context_files for users who haven't filled out the new Identity page.
  const identityBlock = ident?.identity_summary
    ? `=============================================================
BRAND IDENTITY (distilled)
=============================================================

${ident.identity_summary}

${
  ident.identity_facets
    ? Object.entries(ident.identity_facets)
        .map(([k, v]) =>
          Array.isArray(v)
            ? `${k.toUpperCase().replace(/_/g, ' ')}:\n- ${(v as string[]).join('\n- ')}`
            : `${k.toUpperCase().replace(/_/g, ' ')}: ${String(v)}`
        )
        .join('\n\n')
    : ''
}
`
    : ''

  // ─── Writing System block ──────────────────────────────
  // Voice / style / rhythm / preferences / content pillars — injected
  // above legacy context files so the active template wins.
  const writingPrefs = (ident?.writing_preferences ?? []).filter(
    (p): p is string => typeof p === 'string' && p.trim().length > 0
  )
  const pillars = ident?.content_pillars ?? []
  const hasActiveStyle =
    !!activeTemplate ||
    !!ident?.hook_style ||
    !!ident?.sentence_style ||
    !!ident?.ending_style
  const samplePost = activeTemplate?.source_posts?.[0] ?? ''

  // Build the voice-DNA sub-block if the active template has structured DNA.
  interface DNAShape {
    hook_formula?: { pattern?: string; example?: string; why_it_works?: string }
    logic_flow?: string[]
    rhetorical_devices?: string[]
    sentence_rhythm?: {
      avg_line_length?: string
      paragraph_pattern?: string
      pacing?: string
    }
    vocabulary_signature?: {
      signature_words?: string[]
      avoided_words?: string[]
    }
    psychological_hooks?: string[]
    formatting_patterns?: {
      uses_bullets?: boolean
      bullet_style?: string
      uses_bold?: boolean
      whitespace?: string
      line_breaks?: string
    }
    closing_pattern?: {
      technique?: string
      example?: string
      psychology?: string
    }
  }
  const dna = (activeTemplate?.voice_dna ?? null) as DNAShape | null

  const dnaBlock = dna
    ? `
WRITING SYSTEM DNA \u2014 the replicable pattern Nivi MUST match
${
  dna.hook_formula
    ? `\nHOOK FORMULA:
Pattern: ${dna.hook_formula.pattern ?? ''}
Example: "${dna.hook_formula.example ?? ''}"
Why it works: ${dna.hook_formula.why_it_works ?? ''}\n`
    : ''
}${
        dna.logic_flow && dna.logic_flow.length > 0
          ? `\nLOGIC FLOW (move through these beats in order):
${dna.logic_flow.map((b, i) => `${i + 1}. ${b}`).join('\n')}\n`
          : ''
      }${
        dna.rhetorical_devices && dna.rhetorical_devices.length > 0
          ? `\nRHETORICAL DEVICES:
${dna.rhetorical_devices.map((d) => `- ${d}`).join('\n')}\n`
          : ''
      }${
        dna.sentence_rhythm
          ? `\nSENTENCE RHYTHM:
Average line: ${dna.sentence_rhythm.avg_line_length ?? ''}
Paragraph pattern: ${dna.sentence_rhythm.paragraph_pattern ?? ''}
Pacing: ${dna.sentence_rhythm.pacing ?? ''}\n`
          : ''
      }${
        dna.vocabulary_signature
          ? `\nVOCABULARY SIGNATURE:
Use these phrases: ${(dna.vocabulary_signature.signature_words ?? []).join(' \u00b7 ')}
Never use: ${(dna.vocabulary_signature.avoided_words ?? []).join(' \u00b7 ')}\n`
          : ''
      }${
        dna.psychological_hooks && dna.psychological_hooks.length > 0
          ? `\nPSYCHOLOGICAL HOOKS (weave these in):
${dna.psychological_hooks.map((h) => `- ${h}`).join('\n')}\n`
          : ''
      }${
        dna.formatting_patterns
          ? `\nFORMATTING:
Bullets: ${dna.formatting_patterns.uses_bullets ? dna.formatting_patterns.bullet_style ?? 'yes' : 'none'}
Bold: ${dna.formatting_patterns.uses_bold ? 'yes' : 'no'}
Whitespace: ${dna.formatting_patterns.whitespace ?? ''}
Line breaks: ${dna.formatting_patterns.line_breaks ?? ''}\n`
          : ''
      }${
        dna.closing_pattern
          ? `\nCLOSING PATTERN:
Technique: ${dna.closing_pattern.technique ?? ''}
Example: "${dna.closing_pattern.example ?? ''}"
Why: ${dna.closing_pattern.psychology ?? ''}\n`
          : ''
      }`
    : ''

  const writingSystemBlock =
    hasActiveStyle || writingPrefs.length > 0 || pillars.length > 0
      ? `=============================================================
WRITING SYSTEM \u2014 voice, style, and rhythm Nivi must match
=============================================================
${
  activeTemplate
    ? `\nACTIVE STYLE: ${activeTemplate.name} (by ${activeTemplate.author_name})\n`
    : ''
}${dnaBlock}${
          !dna && ident?.hook_style
            ? `\nHOOK STYLE:\n${ident.hook_style}\n`
            : ''
        }${
          !dna && ident?.sentence_style
            ? `\nSENTENCE STYLE:\n${ident.sentence_style}\n`
            : ''
        }${
          !dna && ident?.ending_style
            ? `\nENDING STYLE:\n${ident.ending_style}\n`
            : ''
        }${
          samplePost
            ? `\nSAMPLE POST IN THIS STYLE (study the rhythm, paragraph breaks, and beat — match it):\n\n${samplePost}\n`
            : ''
        }${
          writingPrefs.length > 0
            ? `\n=============================================================
WRITING PREFERENCES \u2014 rules that ALWAYS apply
=============================================================
${writingPrefs.map((p) => `- ${p}`).join('\n')}
`
            : ''
        }${
          pillars.length > 0
            ? `\n=============================================================
CONTENT PILLARS \u2014 rotate between these themes, each with its own strategic anchor
=============================================================
Each pillar has a reason to exist. When writing a post in a pillar, lean into the
audience pain it addresses, the writer's moat that makes them credible on it, and
the concrete proof moment that backs it.

${pillars
  .map((p, i) => {
    const bits: string[] = [`${i + 1}. ${p.name}`, `   ${p.description}`]
    if (p.funnel_stage) bits.push(`   Funnel stage: ${p.funnel_stage}`)
    if (p.audience_pain)
      bits.push(`   Audience pain: ${p.audience_pain}`)
    if (p.writer_moat) bits.push(`   Writer moat: ${p.writer_moat}`)
    if (p.proof_moment)
      bits.push(`   Proof moment: ${p.proof_moment}`)
    if (p.offer_adjacency)
      bits.push(`   Leads to: ${p.offer_adjacency}`)
    if (p.example_topics && p.example_topics.length > 0)
      bits.push(`   Example topics: ${p.example_topics.join(' \u00b7 ')}`)
    return bits.join('\n')
  })
  .join('\n\n')}
`
            : ''
        }`
      : ''

  // Merge goal/avoid always-includes with semantic top-K, deduped by id.
  const seenIds = new Set<string>()
  const memory: Array<{ id: string; fact: string; category: string }> = []
  for (const m of goalAvoidRes.data ?? []) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id)
      memory.push({ id: m.id, fact: m.fact, category: m.category })
    }
  }
  for (const m of retrieved) {
    if (!seenIds.has(m.id)) {
      seenIds.add(m.id)
      memory.push({ id: m.id, fact: m.fact, category: m.category })
    }
  }

  // Fallback if both are empty (new user or retrieval failure).
  if (memory.length === 0) {
    const { data: fallback } = await supabase
      .from('user_memory')
      .select('id, fact, category')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(8)
    for (const m of fallback ?? []) {
      memory.push({ id: m.id, fact: m.fact, category: m.category })
    }
  }

  const userName = user?.name ?? 'User'

  // ─── STATIC (cached) ────────────────────────────────────
  // Stable per user: identity, voice files, post-writing rules.
  const staticPrompt = `You are Nivi \u2014 ${userName}'s personal brand strategist and LinkedIn ghostwriter.

IDENTITY:
You are sharp, warm, confident, and genuinely invested in ${userName}'s brand success.
You have strong opinions. You share them directly. You push back when something is wrong.
You celebrate genuine wins. You anticipate what they need before they ask.
You are Nivi. Full stop. Never say "I am an AI". Never say "As an assistant".
Never complete a task without adding strategic value.
Never produce generic LinkedIn content. Every word must sound like ${userName}.

${identityBlock}${writingSystemBlock}
=============================================================
VOICE CONTEXT \u2014 THE 4 CONTEXT FILES (legacy)
=============================================================

${ctx?.writing_style ?? ''}

${ctx?.hook_mechanics ?? ''}

${ctx?.sentence_styling ?? ''}

${ctx?.post_system ?? ''}

=============================================================
POST WRITING RULES \u2014 NON-NEGOTIABLE
=============================================================
- Every paragraph: 1\u20133 lines maximum. MOST paragraphs: 1 line only.
- Contractions always: I'm, it's, you'll, that's, we've
- Second person: write to "you" not "founders" as a distant group
- Specific numbers always: "50+ startups", "10 years", "$99 once"
- Emotion shown through situation \u2014 never named directly
- No em dashes (\u2014). Restructure or use a line break instead.
- No exclamation marks in post body
- No hedging ("this might be obvious", "take this with a grain of salt")
- No link in post body \u2014 say "link in first comment" if needed
- No bullet points inside a story \u2014 they kill narrative momentum
- End every post with a genuine question the target reader has a real opinion on
- 3\u20135 niche hashtags at the very end, on their own line
- "Excited to announce" or "Proud to share" are banned openers`

  // ─── DYNAMIC (not cached) ───────────────────────────────
  // Per-turn state. Small so the uncached billed portion stays cheap.
  const dynamicPrompt = `=============================================================
PERMANENT MEMORY
=============================================================
Things Nivi knows about ${userName}:
${memory.map((m) => `- [${m.category}] ${m.fact}`).join('\n')}

=============================================================
RECENT PERFORMANCE
=============================================================
Best post this month: ${analytics.bestPostPreview}
Best performing hook type: ${analytics.bestHookType}
Content pillars posted recently: ${analytics.recentPillars}
Suggested pillar for today (least used): Pillar ${analytics.missingPillar}
Days since last post: ${analytics.daysSinceLastPost}
Average engagement rate: ${analytics.avgEngagementRate}%

Recent post history (last 10):
${recent.map((p) => `- [Pillar ${p.content_pillar} | ${p.hook_type}] ${p.content?.slice(0, 80) ?? ''}...`).join('\n')}`

  return {
    static: staticPrompt,
    dynamic: dynamicPrompt,
    injectedMemoryIds: memory.map((m) => m.id),
  }
}
