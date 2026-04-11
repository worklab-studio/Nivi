export async function register() {
  // Only run on the server, not during build
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Start the background scheduler
    startScheduler()
  }
}

function startScheduler() {
  const CRON_SECRET = process.env.CRON_SECRET || 'your-random-secret-string'
  const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  console.log('[Scheduler] Starting background scheduler...')

  // Tick every 60 seconds — checks reminders, scheduled posts, proactive messages
  setInterval(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/cron/tick`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      })
      if (!res.ok) {
        console.error('[Scheduler] Tick failed:', res.status)
      }
    } catch {
      // Server might not be ready yet, skip silently
    }
  }, 60_000) // Every 60 seconds

  // Proactive check every 4 hours — Nivi texts users if she has something to say
  setInterval(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/cron/proactive`, {
        headers: { Authorization: `Bearer ${CRON_SECRET}` },
      })
      if (!res.ok) {
        console.error('[Scheduler] Proactive failed:', res.status)
      }
    } catch {
      // skip
    }
  }, 4 * 60 * 60_000) // Every 4 hours
}
