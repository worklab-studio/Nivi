'use client'

import { useEffect, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'

/**
 * Top-of-dashboard banner shown when a paid user has lost their LinkedIn
 * connection (e.g. their plan was on `free`, they got cleaned up by the
 * billing job, then resubscribed). Renders nothing in any other case.
 *
 * Uses the same `/api/onboarding/linkedin-auth` flow as the wizard +
 * settings page so the popup, callback, and `unipile_account_id` write
 * are identical and tested.
 */
export function ReconnectLinkedInBanner() {
  const [needsReconnect, setNeedsReconnect] = useState(false)
  const [connecting, setConnecting] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard/settings')
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        const s = d.settings as
          | { plan?: string; unipile_account_id?: string | null }
          | undefined
        const plan = s?.plan ?? 'free'
        const isPaid = plan === 'dashboard' || plan === 'complete'
        const hasLinkedIn = !!s?.unipile_account_id
        setNeedsReconnect(isPaid && !hasLinkedIn)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function handleReconnect() {
    if (connecting) return
    setConnecting(true)
    try {
      const res = await fetch('/api/onboarding/linkedin-auth', { method: 'POST' })
      const data = await res.json()
      if (!res.ok || !data.url) {
        setConnecting(false)
        return
      }
      const popup = window.open(data.url, 'linkedin-auth', 'width=600,height=700,scrollbars=yes')
      const check = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(check)
          try {
            const r = await fetch('/api/onboarding/check-linkedin')
            const d = await r.json()
            if (d.connected) setNeedsReconnect(false)
          } catch {
            // ignore
          }
          setConnecting(false)
        }
      }, 500)
    } catch {
      setConnecting(false)
    }
  }

  if (!needsReconnect) return null

  return (
    <div className="border-b border-amber-500/20 bg-amber-500/5 px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
            <Link2 size={14} className="text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">
              Reconnect your LinkedIn
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Welcome back. Relink LinkedIn so Nivi can keep posting and tracking analytics for you.
            </p>
          </div>
        </div>
        <button
          onClick={handleReconnect}
          disabled={connecting}
          className="flex items-center gap-2 bg-[#0A66C2] hover:bg-[#0958a8] text-white px-4 py-2 rounded-md text-[13px] font-medium transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {connecting ? (
            <>
              <Loader2 size={12} className="animate-spin" />
              Opening...
            </>
          ) : (
            'Reconnect LinkedIn'
          )}
        </button>
      </div>
    </div>
  )
}
