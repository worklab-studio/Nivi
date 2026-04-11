// Scheduler — run as standalone process with PM2
// pm2 start "npx tsx src/lib/queue/scheduler.ts" --name nivi-scheduler

import cron from 'node-cron'
import { createClient } from '@supabase/supabase-js'
import { sendMorningBrief } from './workers/morningBrief'
import { publishToLinkedIn } from '../unipile/posts'
import { sendEngagementBrief } from './workers/engagementBrief'
import { sendWeeklySummary } from './workers/weeklySummary'
import { syncAllUserAnalytics } from '../unipile/analytics'
import { accountHealthCheck } from './workers/accountHealthCheck'
import { runModeAutoPromote } from './workers/modeAutoPromote'
import { isQuietHourFor, nextSevenThirtyLocal } from '../utils/quietHours'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Every minute — publish due scheduled posts
// Quiet-hours guard: if the user's local time is in [23:00, 07:00),
// the post is deferred to next 07:30 local instead of publishing now.
// LinkedIn aggressively flags accounts that publish at 3am.
cron.schedule('* * * * *', async () => {
  const supabase = getSupabase()

  const { data: due } = await supabase
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'pending')
    .lte('scheduled_at', new Date().toISOString())
    .limit(50)

  for (const sp of due ?? []) {
    // Look up user timezone for the quiet-hours check
    const { data: u } = await supabase
      .from('users')
      .select('timezone')
      .eq('id', sp.user_id)
      .single()
    const tz = u?.timezone ?? 'Asia/Kolkata'

    if (isQuietHourFor(tz)) {
      const next = nextSevenThirtyLocal(tz)
      await supabase
        .from('scheduled_posts')
        .update({
          status: 'pending',
          scheduled_at: next.toISOString(),
        })
        .eq('id', sp.id)
      console.log(`[scheduler] deferring scheduled_post ${sp.id} for user ${sp.user_id} from quiet hours → ${next.toISOString()}`)
      continue
    }

    await supabase
      .from('scheduled_posts')
      .update({ status: 'processing' })
      .eq('id', sp.id)
    try {
      await publishToLinkedIn(sp.user_id, sp.post_id)
      await supabase
        .from('scheduled_posts')
        .update({ status: 'done' })
        .eq('id', sp.id)
    } catch {
      await supabase
        .from('scheduled_posts')
        .update({
          status: sp.retry_count >= 2 ? 'failed' : 'pending',
          retry_count: sp.retry_count + 1,
        })
        .eq('id', sp.id)
    }
  }
})

// Every minute — send morning briefs for users whose posting_time matches
cron.schedule('* * * * *', async () => {
  const supabase = getSupabase()
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('onboarding_complete', true)
    .not('whatsapp_number', 'is', null)
    .like('posting_time', `${currentTime}%`)

  for (const user of users ?? []) {
    sendMorningBrief(user.id).catch(console.error)
  }
})

// Every minute — send engagement briefs
cron.schedule('* * * * *', async () => {
  const supabase = getSupabase()
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  const currentTime = `${hh}:${mm}`

  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('onboarding_complete', true)
    .not('unipile_account_id', 'is', null)
    .like('engagement_time', `${currentTime}%`)

  for (const user of users ?? []) {
    sendEngagementBrief(user.id).catch(console.error)
  }
})

// Every Monday at 8AM — weekly summaries
cron.schedule('0 8 * * 1', async () => {
  const supabase = getSupabase()
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('onboarding_complete', true)
    .not('whatsapp_number', 'is', null)

  for (const user of users ?? []) {
    sendWeeklySummary(user.id).catch(console.error)
  }
})

// Every Sunday at 6AM — refresh inspiration library via Apify
cron.schedule('0 6 * * 0', async () => {
  console.log('[Scheduler] Running weekly inspiration refresh')
  try {
    const { scrapeAndRefreshInspiration } = await import(
      '@/lib/inspiration/scrapeAndRefresh'
    )
    const result = await scrapeAndRefreshInspiration()
    console.log(
      `[Scheduler] Inspiration refresh done: scraped=${result.scraped} inserted=${result.inserted} trending=${result.trending}`
    )
  } catch (err) {
    console.error('[Scheduler] Inspiration refresh failed:', err)
  }
})

// Every 30 minutes — sync analytics for all users
cron.schedule('*/30 * * * *', async () => {
  const supabase = getSupabase()
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('onboarding_complete', true)
    .not('unipile_account_id', 'is', null)

  for (const user of users ?? []) {
    syncAllUserAnalytics(user.id).catch(console.error)
  }
})

// Every 4 hours — proactive message cron. Hits the /api/cron/proactive
// endpoint instead of reimplementing the logic here, so the endpoint
// remains a single source of truth (callable from Vercel cron too).
// This replaces the in-process setInterval in src/instrumentation.ts,
// which doesn't survive on serverless hosts.
const PROACTIVE_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const PROACTIVE_CRON_SECRET =
  process.env.CRON_SECRET ?? 'your-random-secret-string'

cron.schedule('0 */4 * * *', async () => {
  try {
    const res = await fetch(`${PROACTIVE_BASE_URL}/api/cron/proactive`, {
      headers: { Authorization: `Bearer ${PROACTIVE_CRON_SECRET}` },
    })
    if (!res.ok) {
      console.error('[scheduler] proactive trigger failed:', res.status, await res.text().catch(() => ''))
    } else {
      const body = await res.json().catch(() => ({}))
      console.log('[scheduler] proactive:', body)
    }
  } catch (err) {
    console.error('[scheduler] proactive fetch error:', err)
  }
})

// Every 30 minutes — LinkedIn account health check for all connected users.
// Catches restrictions/credential expiry/disconnects early and notifies the
// user via WhatsApp before things escalate to a permanent ban.
cron.schedule('*/30 * * * *', async () => {
  const supabase = getSupabase()
  const { data: users } = await supabase
    .from('users')
    .select('id')
    .eq('onboarding_complete', true)
    .not('unipile_account_id', 'is', null)

  for (const user of users ?? []) {
    accountHealthCheck(user.id).catch((err) =>
      console.error('[scheduler] health check failed:', user.id, err)
    )
  }
})

// Daily at 9am UTC — auto-promote eligible safe-mode users to standard
// mode after 30 days of clean operation. Patient users get rewarded with
// slightly higher daily caps; reckless users stay on safe forever.
cron.schedule('0 9 * * *', async () => {
  await runModeAutoPromote().catch((err) =>
    console.error('[scheduler] mode auto-promote failed:', err)
  )
})

console.log('Nivi scheduler running...')
