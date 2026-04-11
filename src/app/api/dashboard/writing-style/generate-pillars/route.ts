import { auth } from '@clerk/nextjs/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { Anthropic } from '@/lib/ai/anthropic-compat'
import { pickModel } from '@/lib/ai/router'
import { getEnv } from '@/lib/config'

interface Pillar {
  name: string
  description: string
  example_topics?: string[]
  funnel_stage?: 'awareness' | 'consideration' | 'decision'
  audience_pain?: string
  writer_moat?: string
  offer_adjacency?: string
  proof_moment?: string
  locked?: boolean
}

interface StrategyMap {
  unique_expertise_zones: string[]
  audience_pain_clusters: string[]
  offer_adjacencies: { offer: string; natural_content_topics: string[] }[]
  best_performing_topics: string[]
  best_performing_hooks: string[]
  market_gaps: string[]
  proof_points: string[]
}

function safeJson<T>(text: string): T | null {
  try {
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const first = clean.indexOf('{')
    const last = clean.lastIndexOf('}')
    if (first >= 0 && last > first) clean = clean.slice(first, last + 1)
    return JSON.parse(clean) as T
  } catch (e) {
    console.error('[generate-pillars] parse failed', e, text.slice(0, 200))
    return null
  }
}

function buildIdentityContext(identity: {
  identity_summary?: string | null
  identity_facets?: Record<string, unknown> | null
  about_you?: string | null
  your_story?: string | null
  offers?: unknown
  target_audience?: unknown
}) {
  const offers = (identity.offers ?? []) as Array<{
    name?: string
    description?: string
  }>
  const audience = (identity.target_audience ?? []) as Array<{
    label?: string
    description?: string
  }>
  const facetsBlock = identity.identity_facets
    ? Object.entries(identity.identity_facets as Record<string, unknown>)
        .map(([k, v]) =>
          Array.isArray(v)
            ? `${k.toUpperCase().replace(/_/g, ' ')}:\n- ${(v as string[]).join('\n- ')}`
            : `${k.toUpperCase().replace(/_/g, ' ')}: ${String(v)}`
        )
        .join('\n\n')
    : '(none)'

  return `DISTILLED IDENTITY:
${identity.identity_summary ?? '(not yet distilled)'}

FACETS:
${facetsBlock}

ABOUT:
${identity.about_you ?? '(empty)'}

YOUR STORY:
${identity.your_story ?? '(empty)'}

OFFERS:
${offers.length ? offers.map((o, i) => `${i + 1}. ${o.name ?? ''} — ${o.description ?? ''}`).join('\n') : '(none)'}

TARGET AUDIENCE:
${audience.length ? audience.map((a) => `- ${a.label ?? ''}${a.description ? `: ${a.description}` : ''}`).join('\n') : '(none)'}`
}

function formatExistingPillars(pillars: Pillar[]) {
  return pillars
    .map(
      (p, i) =>
        `${i + 1}. ${p.name || '(unnamed)'}\n   ${p.description || ''}`
    )
    .join('\n\n')
}

interface PublishedPost {
  content: string
  hook_type: string | null
  impressions: number
  likes: number
  comments: number
}

async function fetchPublishedPerformance(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<PublishedPost[]> {
  const { data } = await supabase
    .from('posts')
    .select(
      'content, hook_type, post_analytics(impressions, likes, comments)'
    )
    .eq('user_id', userId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(30)

  return (data ?? []).map(
    (p: {
      content: string
      hook_type: string | null
      post_analytics?: Array<{
        impressions?: number
        likes?: number
        comments?: number
      }>
    }) => ({
      content: p.content,
      hook_type: p.hook_type,
      impressions: p.post_analytics?.[0]?.impressions ?? 0,
      likes: p.post_analytics?.[0]?.likes ?? 0,
      comments: p.post_analytics?.[0]?.comments ?? 0,
    })
  )
}

function formatPerformanceBlock(posts: PublishedPost[]): string {
  if (posts.length === 0) {
    return '(no published posts yet — no performance data available)'
  }
  const sorted = [...posts].sort(
    (a, b) =>
      b.likes * 2 + b.comments * 5 + b.impressions / 100 -
      (a.likes * 2 + a.comments * 5 + a.impressions / 100)
  )
  const top = sorted.slice(0, 10)
  return top
    .map(
      (p, i) =>
        `${i + 1}. [${p.impressions} imp · ${p.likes} likes · ${p.comments} comments] ${p.hook_type ? `(hook: ${p.hook_type})` : ''}\n   "${p.content.slice(0, 180).replace(/\s+/g, ' ')}${p.content.length > 180 ? '…' : ''}"`
    )
    .join('\n\n')
}

// ═══════════════════════════════════════════════
// Pass 1 — Strategy Map
// ═══════════════════════════════════════════════
async function buildStrategyMap(
  anthropic: Anthropic,
  identityContext: string,
  performanceBlock: string
): Promise<StrategyMap | null> {
  const response = await anthropic.messages.create({
    model: pickModel('style-analysis'),
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: `You are a senior content strategist building a strategy map for a personal brand before deriving content pillars.

Your job: map the intersection of three axes — what the writer uniquely knows, what the audience genuinely struggles with, and what naturally leads to the writer's offers. Output a strategy JSON that a junior strategist will use to write 5 pillars.

Return ONLY this JSON, no prose, no markdown fences:
{
  "unique_expertise_zones": [
    "<specific zone where this writer has standing that 999 out of 1000 people don't>",
    "<3-5 zones>"
  ],
  "audience_pain_clusters": [
    "<specific pain the reader actively has — not generic 'wants more clients'>",
    "<4-6 clusters, each narrow and named>"
  ],
  "offer_adjacencies": [
    { "offer": "<offer name>", "natural_content_topics": ["<topic 1>", "<topic 2>", "<topic 3>"] }
  ],
  "best_performing_topics": [
    "<topic that worked based on post data, or empty if no data>"
  ],
  "best_performing_hooks": [
    "<hook type that worked, or empty if no data>"
  ],
  "market_gaps": [
    "<a pain the audience has that nobody in their niche is talking about well>"
  ],
  "proof_points": [
    "<concrete moment / number / named outcome from the writer's story or offers that can anchor posts>"
  ]
}

RULES:
- Never invent facts. If the identity or performance data doesn't support a claim, leave it out.
- Specificity wins. 'Founders drowning in 15-tool SaaS stacks' beats 'SaaS founders struggling.'
- unique_expertise_zones must pass the moat test: could 1000 other people credibly say this? If yes, it's not a moat.
- audience_pain_clusters must be things the reader actively feels right now, not things they 'should' care about.
- If performance data is provided, your best_performing_topics and best_performing_hooks MUST come from what actually worked, not what you think should work.

IDENTITY
========
${identityContext}

RECENT POSTS WITH PERFORMANCE (sorted by engagement)
====================================================
${performanceBlock}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  console.log('[generate-pillars] strategy map response len=', text.length)
  return safeJson<StrategyMap>(text)
}

// ═══════════════════════════════════════════════
// Pass 2 — Pillar Synthesis
// ═══════════════════════════════════════════════
async function synthesizePillars(
  anthropic: Anthropic,
  identityContext: string,
  strategy: StrategyMap,
  lockedPillars: Pillar[],
  slotsToGenerate: number
): Promise<Pillar[] | null> {
  const strategyBlock = `
UNIQUE EXPERTISE ZONES (the writer's moats):
${(strategy.unique_expertise_zones ?? []).map((z) => `- ${z}`).join('\n') || '(none mapped)'}

AUDIENCE PAIN CLUSTERS (what the reader actively struggles with):
${(strategy.audience_pain_clusters ?? []).map((p) => `- ${p}`).join('\n') || '(none mapped)'}

OFFER ADJACENCIES (what leads to conversion):
${(strategy.offer_adjacencies ?? []).map((o) => `- ${o.offer}: ${(o.natural_content_topics ?? []).join(' · ')}`).join('\n') || '(none mapped)'}

WHAT WORKED IN PAST POSTS:
Topics: ${(strategy.best_performing_topics ?? []).join(' · ') || '(no data yet)'}
Hooks: ${(strategy.best_performing_hooks ?? []).join(' · ') || '(no data yet)'}

MARKET GAPS (underserved pains in their niche):
${(strategy.market_gaps ?? []).map((g) => `- ${g}`).join('\n') || '(none mapped)'}

PROOF POINTS (concrete moments / numbers / outcomes to anchor posts):
${(strategy.proof_points ?? []).map((p) => `- ${p}`).join('\n') || '(none mapped)'}
`

  const lockedBlock =
    lockedPillars.length > 0
      ? `\nLOCKED PILLARS (already exist — DO NOT duplicate or overlap with these):\n${formatExistingPillars(lockedPillars)}\n`
      : ''

  const response = await anthropic.messages.create({
    model: pickModel('style-analysis'),
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: `You are synthesizing ${slotsToGenerate} content pillar${slotsToGenerate === 1 ? '' : 's'} from a strategy map. Each pillar must pass 5 tests and have explicit reasoning attached.

Return ONLY this JSON, no prose, no markdown fences:
{
  "pillars": [
    {
      "name": "<4-6 word pillar name, specific enough to feel owned>",
      "description": "<one sentence on what this pillar covers and why it matters to their audience>",
      "funnel_stage": "<awareness | consideration | decision>",
      "audience_pain": "<the specific pain this pillar addresses, quoted from the audience_pain_clusters>",
      "writer_moat": "<why only this writer can credibly own this territory — quoted from unique_expertise_zones>",
      "offer_adjacency": "<which offer this pillar naturally leads to, if any>",
      "proof_moment": "<a concrete moment / number / outcome from the writer's story that anchors this pillar>",
      "example_topics": ["<specific post topic>", "<specific post topic>", "<specific post topic>"]
    }
  ]
}

THE 5 TESTS each pillar must pass:
1. MOAT TEST — Does the writer own this territory, or could 1000 others write it? (writer_moat must be real)
2. PAIN TEST — Is the audience_pain specific enough that one reader will say "this is exactly me"?
3. OFFER TEST — Does a path from "read this post" to "buy this thing" exist? (offer_adjacency should be set unless the pillar is pure top-of-funnel)
4. PROOF TEST — Is there a concrete proof_moment from the writer's actual experience?
5. DISTINCTNESS TEST — Different from the other ${slotsToGenerate - 1} being generated AND different from any locked pillars

COVERAGE RULES for the full set:
- Across all ${slotsToGenerate} pillars, span at least 2 funnel_stages (not all awareness)
- Across all ${slotsToGenerate} pillars, hit at least ${Math.min(3, slotsToGenerate)} different audience_pain_clusters (no 3+ pillars on the same pain)
- At least 1 pillar should lean into a best_performing_topic if any are provided
- Reuse real vocabulary from the strategy map — do not invent new categories

Must return EXACTLY ${slotsToGenerate} pillar${slotsToGenerate === 1 ? '' : 's'}.

IDENTITY
========
${identityContext}

STRATEGY MAP
============
${strategyBlock}${lockedBlock}`,
      },
    ],
  })

  const text = response.content[0]?.type === 'text' ? response.content[0].text : ''
  console.log('[generate-pillars] synthesis response len=', text.length)
  const parsed = safeJson<{ pillars: Pillar[] }>(text)
  if (!parsed?.pillars || !Array.isArray(parsed.pillars)) return null

  return parsed.pillars.slice(0, slotsToGenerate).map((p) => ({
    name: p.name ?? '',
    description: p.description ?? '',
    example_topics: Array.isArray(p.example_topics) ? p.example_topics : [],
    funnel_stage: p.funnel_stage,
    audience_pain: p.audience_pain,
    writer_moat: p.writer_moat,
    offer_adjacency: p.offer_adjacency,
    proof_moment: p.proof_moment,
  }))
}

// ═══════════════════════════════════════════════
// Route handler
// ═══════════════════════════════════════════════
export async function POST(req: Request) {
  console.log('[generate-pillars] entered POST')
  try {
    const { userId } = await auth()
    if (!userId)
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const regenerateIndex: number | undefined =
      typeof body?.regenerate_index === 'number'
        ? body.regenerate_index
        : undefined

    const supabase = getSupabaseAdmin()
    const { data: identity } = await supabase
      .from('brand_identity')
      .select(
        'identity_summary, identity_facets, about_you, your_story, offers, target_audience, content_pillars'
      )
      .eq('user_id', userId)
      .maybeSingle()

    if (
      !identity?.identity_summary &&
      !identity?.about_you &&
      ((identity?.offers as unknown[]) ?? []).length === 0
    ) {
      return Response.json(
        {
          ok: false,
          error:
            'Fill out Identity first — About, Story, and at least one Offer or Audience.',
        },
        { status: 422 }
      )
    }

    const currentPillars = (identity?.content_pillars ?? []) as Pillar[]
    const identityContext = buildIdentityContext(identity ?? {})
    const publishedPosts = await fetchPublishedPerformance(supabase, userId)
    const performanceBlock = formatPerformanceBlock(publishedPosts)

    const anthropic = new Anthropic({ apiKey: getEnv('ANTHROPIC_API_KEY') })

    // ───────────────────────────────────────────────
    // Branch 1: single-slot regeneration
    // Uses strategy map too so the replacement is intelligent.
    // ───────────────────────────────────────────────
    if (
      regenerateIndex !== undefined &&
      regenerateIndex >= 0 &&
      regenerateIndex < currentPillars.length
    ) {
      const others = currentPillars.filter((_, i) => i !== regenerateIndex)
      const strategy = await buildStrategyMap(
        anthropic,
        identityContext,
        performanceBlock
      )
      if (!strategy) {
        return Response.json(
          { ok: false, error: 'Could not build strategy map' },
          { status: 502 }
        )
      }
      const synthesized = await synthesizePillars(
        anthropic,
        identityContext,
        strategy,
        others,
        1
      )
      if (!synthesized || synthesized.length === 0) {
        return Response.json(
          { ok: false, error: 'Could not synthesize pillar' },
          { status: 502 }
        )
      }

      const newPillar = synthesized[0]
      const nextPillars = [...currentPillars]
      nextPillars[regenerateIndex] = {
        ...newPillar,
        locked: currentPillars[regenerateIndex]?.locked,
      }

      await supabase.from('brand_identity').upsert({
        user_id: userId,
        content_pillars: nextPillars,
        updated_at: new Date().toISOString(),
      })

      return Response.json({
        ok: true,
        pillar: newPillar,
        index: regenerateIndex,
      })
    }

    // ───────────────────────────────────────────────
    // Branch 2 + 3: bulk regen (locked-aware or full)
    // Both use the two-pass strategy → synthesis flow.
    // ───────────────────────────────────────────────
    const lockedPillars = currentPillars.filter((p) => p.locked)
    const slotsToGenerate = 5 - lockedPillars.length

    if (slotsToGenerate <= 0) {
      return Response.json(
        { ok: false, error: 'Unlock at least one pillar to regenerate' },
        { status: 400 }
      )
    }

    const strategy = await buildStrategyMap(
      anthropic,
      identityContext,
      performanceBlock
    )
    if (!strategy) {
      return Response.json(
        { ok: false, error: 'Could not build strategy map' },
        { status: 502 }
      )
    }

    const synthesized = await synthesizePillars(
      anthropic,
      identityContext,
      strategy,
      lockedPillars,
      slotsToGenerate
    )
    if (!synthesized || synthesized.length === 0) {
      return Response.json(
        { ok: false, error: 'Could not synthesize pillars' },
        { status: 502 }
      )
    }

    // Merge: locked pillars stay in their original indices, new pillars fill holes in order.
    let poolIdx = 0
    const merged: Pillar[] = []
    const totalSlots = Math.max(5, currentPillars.length)
    for (let i = 0; i < totalSlots; i++) {
      const existing = currentPillars[i]
      if (existing?.locked) {
        merged.push(existing)
      } else if (poolIdx < synthesized.length) {
        merged.push(synthesized[poolIdx++])
      }
    }
    // Pad any remaining slots (no-op in normal case)
    while (merged.length < 5 && poolIdx < synthesized.length) {
      merged.push(synthesized[poolIdx++])
    }
    const finalPillars = merged.slice(0, 5)

    await supabase.from('brand_identity').upsert({
      user_id: userId,
      content_pillars: finalPillars,
      updated_at: new Date().toISOString(),
    })

    return Response.json({ ok: true, pillars: finalPillars, strategy })
  } catch (e) {
    const message = (e as Error).message ?? 'unknown error'
    console.error('[generate-pillars] failed:', message)
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
