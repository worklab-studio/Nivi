'use client'

import { useState, useEffect } from 'react'

interface Step3Props {
  onNext: () => void
  onBack: () => void
}

export function Step3WhatsApp({ onNext, onBack }: Step3Props) {
  const [optInCode, setOptInCode] = useState('')
  const [connected, setConnected] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/onboarding/get-opt-in-code')
      .then((r) => r.json())
      .then((d) => setOptInCode(d.code))
      .catch(() => {})
  }, [])

  // Poll for WhatsApp connection
  useEffect(() => {
    if (connected) return
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
  }, [connected, onNext])

  const copyMessage = () => {
    navigator.clipboard.writeText(`START ${optInCode}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex-1 flex flex-col justify-center p-12">
      <h2 className="text-[28px] font-medium text-foreground mb-2">
        Connect your WhatsApp
      </h2>
      <p className="text-muted-foreground text-[15px] mb-10">
        Nivi lives in your WhatsApp. Do these two steps:
      </p>

      <div className="space-y-6">
        <div className="border border-border rounded-lg p-5">
          <p className="font-sans text-[11px] text-muted-foreground uppercase tracking-widest mb-2">
            Step 1
          </p>
          <p className="text-foreground text-[15px] mb-1">
            Save this number in your contacts
          </p>
          <p className="font-sans text-[20px] text-white tracking-wider">
            +91 00000 00000
          </p>
          <p className="font-sans text-[11px] text-muted-foreground mt-1">
            Save as &ldquo;Nivi — My Brand Strategist&rdquo;
          </p>
        </div>

        <div className="border border-border rounded-lg p-5">
          <p className="font-sans text-[11px] text-muted-foreground uppercase tracking-widest mb-2">
            Step 2
          </p>
          <p className="text-foreground text-[15px] mb-3">
            Send this message to Nivi on WhatsApp
          </p>
          <div className="flex items-center gap-3">
            <code className="font-sans text-[16px] text-white bg-accent px-4 py-2 rounded">
              START {optInCode || '--------'}
            </code>
            <button
              onClick={copyMessage}
              className="font-sans text-[11px] text-muted-foreground border border-border px-3 py-2 rounded hover:border-border transition-colors"
            >
              {copied ? 'Copied ✓' : 'Copy'}
            </button>
          </div>
        </div>

        {connected ? (
          <div className="flex items-center gap-3 text-emerald-600 animate-fade-in">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
              <span className="text-black text-[11px] font-bold">✓</span>
            </div>
            <span className="font-sans text-[13px]">
              WhatsApp connected! Taking you to the next step...
            </span>
          </div>
        ) : (
          <p className="font-sans text-[11px] text-muted-foreground animate-pulse">
            Waiting for your WhatsApp message...
          </p>
        )}
      </div>

      <div className="mt-auto flex justify-between pt-6">
        <button
          onClick={onBack}
          className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
        >
          Skip for now →
        </button>
      </div>
    </div>
  )
}
