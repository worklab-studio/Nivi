'use client'

import { useState, useEffect } from 'react'

interface Step3Props {
  onNext: () => void
  onBack: () => void
}

export function Step3WhatsApp({ onNext, onBack }: Step3Props) {
  const [phone, setPhone] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [connected, setConnected] = useState(false)

  // Poll for WhatsApp connection after message is sent
  useEffect(() => {
    if (!sent || connected) return
    const interval = setInterval(async () => {
      try {
        const r = await fetch('/api/onboarding/check-whatsapp')
        const d = await r.json()
        if (d.connected) {
          setConnected(true)
          clearInterval(interval)
          setTimeout(onNext, 1500)
        }
      } catch {
        // ignore polling errors
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [sent, connected, onNext])

  async function handleSend() {
    if (!phone.trim() || sending) return
    setSending(true)
    try {
      const res = await fetch('/api/onboarding/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phone }),
      })
      const data = await res.json()
      if (data.ok) setSent(true)
    } catch { /* ignore */ }
    setSending(false)
  }

  return (
    <div className="flex-1 flex flex-col justify-center p-12">
      <h2 className="text-[28px] font-medium text-foreground mb-2">
        Connect your WhatsApp
      </h2>
      <p className="text-muted-foreground text-[15px] mb-10">
        Nivi lives in your WhatsApp — morning briefs, engagement alerts, and post writing all happen right there.
      </p>

      {connected ? (
        <div className="flex items-center gap-3 text-emerald-600 animate-fade-in">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <span className="text-black text-[11px] font-bold">✓</span>
          </div>
          <span className="font-sans text-[13px]">
            WhatsApp connected! Taking you to the next step...
          </span>
        </div>
      ) : !sent ? (
        <div className="space-y-4">
          <div className="border border-border rounded-lg p-5">
            <p className="text-foreground text-[15px] mb-3">
              Enter your WhatsApp number
            </p>
            <div className="flex items-center gap-3">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 93061 25452"
                className="flex-1 bg-secondary border border-border rounded-md px-4 py-3 text-[16px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSend}
                disabled={!phone.trim() || sending}
                className="px-5 py-3 bg-primary text-primary-foreground rounded-md text-[14px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Include country code (e.g. +91 for India, +1 for US)
            </p>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Nivi will send you a WhatsApp message. Just reply <span className="font-semibold text-foreground">YES</span> to connect.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-emerald-500/30 bg-emerald-500/5 rounded-lg p-5">
            <p className="text-[15px] text-emerald-600 font-medium mb-1">
              Message sent to {phone}
            </p>
            <p className="text-[13px] text-muted-foreground">
              Open WhatsApp and reply <span className="font-semibold text-foreground">YES</span> to Nivi&apos;s message.
            </p>
          </div>
          <p className="font-sans text-[11px] text-muted-foreground animate-pulse">
            Waiting for your reply...
          </p>
        </div>
      )}

      <div className="mt-auto flex justify-between pt-6">
        <button
          onClick={onBack}
          className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        {(connected || sent) && (
          <button
            onClick={onNext}
            className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
          >
            {connected ? 'Next →' : 'Skip for now →'}
          </button>
        )}
      </div>
    </div>
  )
}
