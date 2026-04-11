'use client'

import { useState } from 'react'

interface Step2Props {
  onNext: () => void
  onBack: () => void
}

export function Step2LinkedIn({ onNext, onBack }: Step2Props) {
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')

  const handleConnect = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/onboarding/linkedin-auth', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Connection failed. Please try again.')
        setLoading(false)
        return
      }

      const popup = window.open(
        data.url,
        'linkedin-auth',
        'width=600,height=700,scrollbars=yes'
      )

      const checkPopup = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(checkPopup)
          try {
            const r = await fetch('/api/onboarding/check-linkedin')
            const d = await r.json()
            if (d.connected) setConnected(true)
          } catch {
            // polling failed, user can retry
          }
          setLoading(false)
        }
      }, 500)
    } catch {
      setError('Connection failed. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col justify-center p-12">
      <h2 className="text-[28px] font-medium text-foreground mb-2">
        Connect your LinkedIn
      </h2>
      <p className="text-muted-foreground text-[15px] mb-10 leading-relaxed">
        Nivi needs access to post on your behalf. This uses a secure OAuth
        connection — your password is never shared.
      </p>

      {!connected ? (
        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-fit flex items-center gap-3 bg-[#0A66C2] hover:bg-[#0958a8] text-white px-6 py-3 rounded-md font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Connecting...' : 'Connect LinkedIn Account'}
        </button>
      ) : (
        <div className="flex items-center gap-3 text-emerald-600">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-black text-[11px] font-bold">✓</span>
          </div>
          <span className="font-sans text-[13px]">LinkedIn connected</span>
        </div>
      )}

      {error && (
        <p className="text-destructive text-[13px] mt-3 font-sans">{error}</p>
      )}

      <div className="mt-auto flex justify-between">
        <button
          onClick={onBack}
          className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={onNext}
            className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
          {connected && (
            <button
              onClick={onNext}
              className="bg-white text-black px-6 py-2.5 rounded-md font-medium text-[14px] hover:bg-white/90 transition-colors"
            >
              Continue →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
