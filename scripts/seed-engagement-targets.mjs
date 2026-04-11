#!/usr/bin/env node

/**
 * Seed engagement targets + scrape their recent posts via Apify.
 * Inserts 12 popular LinkedIn creators as whitelist targets,
 * then fetches their latest posts and drafts voice-matched comments.
 *
 * Usage: node scripts/seed-engagement-targets.mjs
 */

import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// Manual env parse — dotenv auto-inject skips some keys
const envText = readFileSync('.env.local', 'utf8')
envText.split('\n').forEach(line => {
  const eq = line.indexOf('=')
  if (eq > 0) {
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
})

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE env vars')
  process.exit(1)
}
if (!APIFY_TOKEN) {
  console.error('Missing APIFY_API_TOKEN')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const TARGETS = [
  { url: 'https://www.linkedin.com/in/justinwelsh', handle: 'justinwelsh', name: 'Justin Welsh', headline: 'Solopreneur | $5M+ solo business' },
  { url: 'https://www.linkedin.com/in/sahilbloom', handle: 'sahilbloom', name: 'Sahil Bloom', headline: 'Entrepreneur & Creator' },
  { url: 'https://www.linkedin.com/in/laraacostar', handle: 'laraacostar', name: 'Lara Acosta', headline: 'Personal Branding Expert' },
  { url: 'https://www.linkedin.com/in/alexhormozi', handle: 'alexhormozi', name: 'Alex Hormozi', headline: 'CEO @ Acquisition.com' },
  { url: 'https://www.linkedin.com/in/dankoe', handle: 'dankoe', name: 'Dan Koe', headline: 'Writer & Creator' },
  { url: 'https://www.linkedin.com/in/nicolascole77', handle: 'nicolascole77', name: 'Nicolas Cole', headline: 'Founder @ Ship 30 for 30' },
  { url: 'https://www.linkedin.com/in/dickiebush', handle: 'dickiebush', name: 'Dickie Bush', headline: 'Co-founder @ Ship 30 for 30' },
  { url: 'https://www.linkedin.com/in/mattgray1', handle: 'mattgray1', name: 'Matt Gray', headline: 'Founder & CEO' },
  { url: 'https://www.linkedin.com/in/thesamparr', handle: 'thesamparr', name: 'Sam Parr', headline: 'Founder @ The Hustle' },
  { url: 'https://www.linkedin.com/in/shaanvp', handle: 'shaanvp', name: 'Shaan Puri', headline: 'My First Million Podcast' },
  { url: 'https://www.linkedin.com/in/codiesanchez', handle: 'codiesanchez', name: 'Codie Sanchez', headline: 'Buying boring businesses' },
  { url: 'https://www.linkedin.com/in/aliabdaal', handle: 'aliabdaal', name: 'Ali Abdaal', headline: 'YouTuber & Author' },
]

async function main() {
  // 1. Get the user
  const { data: users } = await supabase
    .from('users')
    .select('id, name')
    .limit(1)

  if (!users || users.length === 0) {
    console.error('No users found in the database')
    process.exit(1)
  }

  const userId = users[0].id
  const userName = users[0].name
  console.log(`Seeding targets for user: ${userName} (${userId})`)

  // 2. Check existing targets
  const { data: existing } = await supabase
    .from('engagement_targets')
    .select('author_handle')
    .eq('user_id', userId)

  const existingHandles = new Set((existing ?? []).map(t => t.author_handle))

  // 3. Insert new targets
  const newTargets = TARGETS.filter(t => !existingHandles.has(t.handle))

  if (newTargets.length === 0) {
    console.log('All targets already exist. Skipping insert.')
  } else {
    const rows = newTargets.map(t => ({
      user_id: userId,
      linkedin_url: t.url,
      author_handle: t.handle,
      author_name: t.name,
      author_headline: t.headline,
      avatar_url: `https://unavatar.io/linkedin/${t.handle}`,
      mode: 'whitelist',
    }))

    const { error } = await supabase.from('engagement_targets').insert(rows)
    if (error) {
      console.error('Insert failed:', error.message)
      process.exit(1)
    }
    console.log(`✅ Inserted ${rows.length} targets`)
  }

  // 4. Scrape posts via Apify
  console.log('\nScraping recent posts via Apify…')
  const urls = TARGETS.map(t => t.url)

  let items = []
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/supreme_coder~linkedin-post/run-sync-get-dataset-items?token=${APIFY_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          limitPerSource: 2,
          deepScrape: false,
          rawData: false,
        }),
        signal: AbortSignal.timeout(300_000),
      }
    )

    if (!res.ok) {
      const body = await res.text()
      console.error(`Apify error ${res.status}:`, body.slice(0, 200))
      process.exit(1)
    }

    items = await res.json()
    console.log(`Scraped ${items.length} posts`)
  } catch (e) {
    console.error('Apify failed:', e.message)
    process.exit(1)
  }

  if (items.length === 0) {
    console.log('No posts scraped. Done.')
    process.exit(0)
  }

  // 5. De-dup against existing opportunities
  const { data: existingOpps } = await supabase
    .from('comment_opportunities')
    .select('post_preview')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - 48 * 3600 * 1000).toISOString())

  const existingHashes = new Set(
    (existingOpps ?? []).map(r => (r.post_preview ?? '').slice(0, 80).toLowerCase().trim())
  )

  const postsToInsert = []
  for (const item of items) {
    const content = item.text ?? item.postText ?? item.content ?? ''
    if (!content || content.length < 50) continue

    const hash = content.slice(0, 80).toLowerCase().trim()
    if (existingHashes.has(hash)) continue
    existingHashes.add(hash)

    const authorName = item.authorName ?? item.author_name ?? 'Unknown'
    const handle = (item.authorProfileUrl ?? '').match(/\/in\/([^\/]+)/)?.[1] ?? null

    postsToInsert.push({
      content,
      authorName,
      authorHeadline: item.authorHeadline ?? item.author_headline ?? '',
      handle,
      avatarUrl: handle ? `https://unavatar.io/linkedin/${handle}` : null,
      postUrl: item.postUrl ?? item.url ?? null,
      likes: item.numLikes ?? item.likes ?? 0,
    })
  }

  console.log(`${postsToInsert.length} new posts to process`)

  if (postsToInsert.length === 0) {
    console.log('All posts already in DB. Done.')
    process.exit(0)
  }

  // 6. Draft comments via Claude
  if (!ANTHROPIC_KEY) {
    console.log('No ANTHROPIC_API_KEY — inserting posts without drafted comments')
  }

  let comments = []
  if (ANTHROPIC_KEY) {
    console.log('Drafting comments via Claude…')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          messages: [{
            role: 'user',
            content: `Draft voice-matched LinkedIn comments for these posts. Each comment should be 3-5 sentences, sound genuine and human, add real value, and never start with "Great post!" or "I totally agree".

Return JSON only:
{"comments": [{"index": 0, "drafted_comment": "...", "relevance_score": 0.8}, ...]}

Posts:
${JSON.stringify(postsToInsert.slice(0, 15).map((p, i) => ({
  index: i,
  author: p.authorName,
  content: p.content.slice(0, 300),
  likes: p.likes,
})), null, 2)}`
          }],
        }),
      })

      const data = await res.json()
      const text = data.content?.[0]?.text ?? '{"comments":[]}'
      const clean = text.replace(/```json\n?|```/g, '').trim()
      const parsed = JSON.parse(clean)
      comments = parsed.comments ?? parsed ?? []
      console.log(`Got ${comments.length} drafted comments`)
    } catch (e) {
      console.error('Claude drafting failed:', e.message)
      comments = []
    }
  }

  // 7. Insert opportunities
  const rows = postsToInsert.slice(0, 15).map((p, i) => {
    const comment = comments.find(c => c.index === i)
    return {
      user_id: userId,
      linkedin_post_id: p.postUrl ?? `seed-${Date.now()}-${i}`,
      author_name: p.authorName,
      author_headline: p.authorHeadline,
      author_handle: p.handle,
      author_avatar_url: p.avatarUrl,
      linkedin_post_url: p.postUrl,
      post_preview: p.content.slice(0, 500),
      drafted_comment: comment?.drafted_comment ?? '',
      relevance_score: comment?.relevance_score ?? 0.5,
      matched_pillar: null,
      status: 'pending',
    }
  })

  const { error: insertErr } = await supabase
    .from('comment_opportunities')
    .insert(rows)

  if (insertErr) {
    console.error('Insert opportunities failed:', insertErr.message)
    process.exit(1)
  }

  console.log(`\n✅ Done! Inserted ${rows.length} engagement opportunities`)
  console.log('Go to the Engagement page to see them.')
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
