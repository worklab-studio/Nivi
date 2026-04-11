#!/usr/bin/env node

/**
 * Standalone script to scrape LinkedIn posts via Apify and insert into
 * inspiration_posts table. Runs outside Next.js — uses env vars directly.
 *
 * Usage: node scripts/scrape-inspiration.mjs
 */

import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

config({ path: '.env.local' })

const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY

if (!APIFY_TOKEN || !SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 105 profiles + 8 search URLs
const PROFILES = [
  'https://www.linkedin.com/in/justinwelsh','https://www.linkedin.com/in/sahilbloom','https://www.linkedin.com/in/codiesanchez',
  'https://www.linkedin.com/in/alexhormozi','https://www.linkedin.com/in/dickiebush','https://www.linkedin.com/in/laraacostar',
  'https://www.linkedin.com/in/mattgray1','https://www.linkedin.com/in/garyvaynerchuk','https://www.linkedin.com/in/sarablakely',
  'https://www.linkedin.com/in/dankoe','https://www.linkedin.com/in/nicolascole77','https://www.linkedin.com/in/timdenning',
  'https://www.linkedin.com/in/aliabdaal','https://www.linkedin.com/in/jackbutcher','https://www.linkedin.com/in/thesamparr',
  'https://www.linkedin.com/in/shaanvp','https://www.linkedin.com/in/julianshapiro','https://www.linkedin.com/in/nathanbarry',
  'https://www.linkedin.com/in/stephsmith','https://www.linkedin.com/in/dvassallo','https://www.linkedin.com/in/arvidkahl',
  'https://www.linkedin.com/in/levelsio','https://www.linkedin.com/in/marclouvion','https://www.linkedin.com/in/tonydinhguyen',
  'https://www.linkedin.com/in/patrickdang','https://www.linkedin.com/in/noahkagan','https://www.linkedin.com/in/adam-robinson-31',
  'https://www.linkedin.com/in/jasonlk','https://www.linkedin.com/in/dhaboross','https://www.linkedin.com/in/gregisenberg',
  'https://www.linkedin.com/in/chrisdonnelly77','https://www.linkedin.com/in/jasmin-alic','https://www.linkedin.com/in/roblennon',
  'https://www.linkedin.com/in/eddieshleyner','https://www.linkedin.com/in/brooklinnash','https://www.linkedin.com/in/ericaschneider1',
  'https://www.linkedin.com/in/hasantoor','https://www.linkedin.com/in/rubenhassid','https://www.linkedin.com/in/mattbarker1',
  'https://www.linkedin.com/in/jayclouse','https://www.linkedin.com/in/deaboreed','https://www.linkedin.com/in/mikisingram',
  'https://www.linkedin.com/in/samszuchan','https://www.linkedin.com/in/nathanbaugh','https://www.linkedin.com/in/tombillyeu',
  'https://www.linkedin.com/in/chrishlad','https://www.linkedin.com/in/katelyn-bourgoin','https://www.linkedin.com/in/amandanat',
  'https://www.linkedin.com/in/chriswalker171','https://www.linkedin.com/in/davegerhardt','https://www.linkedin.com/in/emilykramer',
  'https://www.linkedin.com/in/kylepoyar','https://www.linkedin.com/in/elenaverna','https://www.linkedin.com/in/leahtharin',
  'https://www.linkedin.com/in/john-bonini','https://www.linkedin.com/in/joshbraun','https://www.linkedin.com/in/nealogrady',
  'https://www.linkedin.com/in/thealexgarcia','https://www.linkedin.com/in/amandanatividad','https://www.linkedin.com/in/rosshudgens',
  'https://www.linkedin.com/in/lennyrachitsky','https://www.linkedin.com/in/weskao','https://www.linkedin.com/in/aprildunford',
  'https://www.linkedin.com/in/shreyas-doshi','https://www.linkedin.com/in/johncutlefish','https://www.linkedin.com/in/jackiebavaro',
  'https://www.linkedin.com/in/gibsonbiddle','https://www.linkedin.com/in/terenshatkin','https://www.linkedin.com/in/zainkahn',
  'https://www.linkedin.com/in/bentossell','https://www.linkedin.com/in/liambolt','https://www.linkedin.com/in/mattshumer',
  'https://www.linkedin.com/in/itsmattbeale','https://www.linkedin.com/in/danshipper','https://www.linkedin.com/in/joao-romben',
  'https://www.linkedin.com/in/sarahguo','https://www.linkedin.com/in/aisuperhuman','https://www.linkedin.com/in/briannekimmel',
  'https://www.linkedin.com/in/packym','https://www.linkedin.com/in/turnernovak','https://www.linkedin.com/in/justmaurer',
  'https://www.linkedin.com/in/harryhurst','https://www.linkedin.com/in/nfriedman','https://www.linkedin.com/in/keenan',
  'https://www.linkedin.com/in/samcking','https://www.linkedin.com/in/jasonmbay','https://www.linkedin.com/in/cloris-chen',
  'https://www.linkedin.com/in/scottleese','https://www.linkedin.com/in/simonsinek','https://www.linkedin.com/in/braborjas',
  'https://www.linkedin.com/in/jamesoncamp','https://www.linkedin.com/in/dr-julie-gurner','https://www.linkedin.com/in/brendonburchard',
  'https://www.linkedin.com/in/melrobbins','https://www.linkedin.com/in/ankurnagpal','https://www.linkedin.com/in/tanayp',
  'https://www.linkedin.com/in/aditigoyal','https://www.linkedin.com/in/varunmayya','https://www.linkedin.com/in/rachitshukla',
  'https://www.linkedin.com/in/nivedita-verma-ossian',
]

const SEARCH_URLS = [
  'https://www.linkedin.com/search/results/content/?keywords=AI%20tools&datePosted=%22past-24h%22&origin=FACETED_SEARCH',
  'https://www.linkedin.com/search/results/content/?keywords=personal%20branding&datePosted=%22past-24h%22&origin=FACETED_SEARCH',
  'https://www.linkedin.com/search/results/content/?keywords=SaaS%20growth&datePosted=%22past-24h%22&origin=FACETED_SEARCH',
  'https://www.linkedin.com/search/results/content/?keywords=startup%20lessons&datePosted=%22past-24h%22&origin=FACETED_SEARCH',
  'https://www.linkedin.com/search/results/content/?keywords=building%20in%20public&datePosted=%22past-24h%22&origin=FACETED_SEARCH',
]

function chunk(arr, size) {
  const result = []
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size))
  return result
}

async function tagPost(content, authorName, likes) {
  if (!ANTHROPIC_KEY) return { format: 'observation', topic_pillar: 'personal_growth', engagement_tier: likes >= 10000 ? 'viral' : likes >= 1000 ? 'strong' : 'solid', creator_archetype: 'creator', hook_score: 5 }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20250512',
        max_tokens: 512,
        messages: [{ role: 'user', content: `Tag this LinkedIn post. Return JSON only:\n{"format":"hook_story|listicle|contrarian|data_led|confession|thread|observation","topic_pillar":"building_in_public|ai_tools|design_thinking|leadership|saas|personal_growth|marketing|productivity","engagement_tier":"${likes >= 10000 ? 'viral' : likes >= 1000 ? 'strong' : 'solid'}","creator_archetype":"solopreneur|founder|designer|coach|creator|investor","hook_score":1-10}\n\nPOST: ${content.slice(0, 1500)}\nAUTHOR: ${authorName}\nLIKES: ${likes}` }]
      })
    })
    const data = await res.json()
    const text = data?.content?.[0]?.text ?? ''
    let clean = text.replace(/```json\n?|```/g, '').trim()
    const f = clean.indexOf('{'), l = clean.lastIndexOf('}')
    if (f >= 0 && l > f) clean = clean.slice(f, l + 1)
    return JSON.parse(clean)
  } catch { return { format: 'observation', topic_pillar: 'personal_growth', engagement_tier: likes >= 10000 ? 'viral' : likes >= 1000 ? 'strong' : 'solid', creator_archetype: 'creator', hook_score: 5 } }
}

async function embedPost(content) {
  if (!GEMINI_KEY) return null
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${GEMINI_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'models/gemini-embedding-001', content: { parts: [{ text: content.slice(0, 4000) }] }, outputDimensionality: 768 })
    })
    const data = await res.json()
    return data?.embedding?.values ?? null
  } catch { return null }
}

async function scrapeApifyBatch(urls, limitPerSource) {
  console.log(`  Apify call: ${urls.length} URLs × ${limitPerSource} posts...`)
  const res = await fetch(
    `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls, limitPerSource, deepScrape: false, rawData: false }),
      signal: AbortSignal.timeout(300_000) }
  )
  if (!res.ok) { console.error(`  Apify error ${res.status}`); return [] }
  const items = await res.json()
  return Array.isArray(items) ? items : []
}

async function main() {
  console.log('=== Inspiration Bulk Scrape ===')
  console.log(`Profiles: ${PROFILES.length} | Search URLs: ${SEARCH_URLS.length}`)

  // Load existing for dedup
  const { data: existing } = await supabase.from('inspiration_posts').select('content')
  const hashes = new Set((existing ?? []).map(e => (e.content ?? '').slice(0, 200).toLowerCase().trim()))
  console.log(`Existing posts in DB: ${existing?.length ?? 0}`)

  let totalScraped = 0, totalInserted = 0, totalSkipped = 0

  // Batch profiles in groups of 20
  const batches = [
    ...chunk(PROFILES, 20).map(urls => ({ urls, limit: 5 })),
    { urls: SEARCH_URLS, limit: 10 },
  ]

  for (let bi = 0; bi < batches.length; bi++) {
    const b = batches[bi]
    console.log(`\n--- Batch ${bi + 1}/${batches.length} (${b.urls.length} URLs) ---`)

    let items
    try { items = await scrapeApifyBatch(b.urls, b.limit) }
    catch (e) { console.error(`  Batch failed: ${e.message}`); continue }

    console.log(`  Got ${items.length} posts from Apify`)
    totalScraped += items.length

    const rows = []
    for (const item of items) {
      const content = item.text ?? item.postText ?? item.content ?? ''
      if (!content || content.length < 50) continue
      const hash = content.slice(0, 200).toLowerCase().trim()
      if (hashes.has(hash)) { totalSkipped++; continue }
      hashes.add(hash)

      const authorName = item.authorName ?? item.author_name ?? 'Unknown'
      const likes = item.numLikes ?? item.likes ?? 0
      const comments = item.numComments ?? item.comments ?? 0
      const reposts = item.numReposts ?? 0
      const handle = (item.authorProfileUrl ?? '').match(/\/in\/([^/]+)/)?.[1] ?? null

      // Tag
      const tags = await tagPost(content, authorName, likes)
      // Embed
      const embedding = await embedPost(content)

      rows.push({
        content, author_name: authorName,
        author_headline: item.authorHeadline ?? item.author_headline ?? null,
        author_handle: handle,
        author_avatar_url: handle ? `https://unavatar.io/linkedin/${handle}` : null,
        author_followers: item.authorFollowers ?? null,
        linkedin_post_url: item.postUrl ?? item.url ?? null,
        format: tags.format, topic_pillar: tags.topic_pillar,
        engagement_tier: tags.engagement_tier, creator_archetype: tags.creator_archetype,
        hook_score: tags.hook_score,
        likes, comments, reposts,
        posted_at: item.postedAt ?? item.timestamp ?? null,
        scraped_at: new Date().toISOString(),
        is_seed: false, is_trending: false,
        embedding: embedding ? `[${embedding.join(',')}]` : null,
      })

      // Flush every 10
      if (rows.length >= 10) {
        const { error } = await supabase.from('inspiration_posts').insert(rows)
        if (error) console.error('  Insert error:', error.message)
        else { totalInserted += rows.length; console.log(`  Flushed ${rows.length} (total inserted: ${totalInserted})`) }
        rows.length = 0
      }
    }

    // Flush remaining
    if (rows.length > 0) {
      const { error } = await supabase.from('inspiration_posts').insert(rows)
      if (!error) { totalInserted += rows.length; console.log(`  Flushed remaining ${rows.length} (total: ${totalInserted})`) }
    }
  }

  // Mark trending
  const { data: topPosts } = await supabase.from('inspiration_posts')
    .select('id').order('hook_score', { ascending: false }).limit(10)
  await supabase.from('inspiration_posts').update({ is_trending: false }).eq('is_trending', true)
  if (topPosts?.length) {
    await supabase.from('inspiration_posts')
      .update({ is_trending: true, trending_week: new Date().toISOString().slice(0, 4) + '-W' + String(Math.ceil((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000 / 7)).padStart(2, '0') })
      .in('id', topPosts.map(p => p.id))
  }

  console.log(`\n=== DONE ===`)
  console.log(`Scraped: ${totalScraped}`)
  console.log(`New inserted: ${totalInserted}`)
  console.log(`Dupes skipped: ${totalSkipped}`)
  console.log(`Total in DB: ${(existing?.length ?? 0) + totalInserted}`)
}

main().catch(e => { console.error('FATAL:', e); process.exit(1) })
