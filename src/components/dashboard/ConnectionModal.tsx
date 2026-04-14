'use client'

import { useState, useEffect } from 'react'
import { X, Link2, MessageCircle, Loader2, Check, Shield, Lock } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  linkedinConnected: boolean
  whatsappConnected: boolean
  onLinkedInConnected?: () => void
  onWhatsAppConnected?: () => void
}

export function ConnectionModal({
  open,
  onClose,
  linkedinConnected,
  whatsappConnected,
  onLinkedInConnected,
  onWhatsAppConnected,
}: Props) {
  const [liConnecting, setLiConnecting] = useState(false)
  const [liDone, setLiDone] = useState(linkedinConnected)
  const [waPhone, setWaPhone] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waSent, setWaSent] = useState(false)
  const [waDone, setWaDone] = useState(whatsappConnected)

  async function handleLinkedInConnect() {
    setLiConnecting(true)
    try {
      const res = await fetch('/api/onboarding/linkedin-auth', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setLiConnecting(false); return }

      const popup = window.open(data.url, 'linkedin-auth', 'width=600,height=700,scrollbars=yes')
      const check = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(check)
          const r = await fetch('/api/onboarding/check-linkedin')
          const d = await r.json()
          if (d.connected) {
            setLiDone(true)
            onLinkedInConnected?.()
            // Auto-generate pillars in background (identity import happens in callback)
            fetch('/api/dashboard/writing-style/generate-pillars', { method: 'POST' }).catch(() => {})
          }
          setLiConnecting(false)
        }
      }, 500)
    } catch {
      setLiConnecting(false)
    }
  }

  async function handleWhatsAppSend() {
    if (!waPhone.trim() || waSending) return
    setWaSending(true)
    try {
      const res = await fetch('/api/onboarding/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: waPhone }),
      })
      const data = await res.json()
      if (data.ok) setWaSent(true)
    } catch { /* ignore */ }
    setWaSending(false)
  }

  // Poll for WhatsApp connection after message is sent
  useEffect(() => {
    if (!waSent || waDone) return
    const interval = setInterval(async () => {
      try {
        const r = await fetch('/api/onboarding/check-whatsapp')
        const d = await r.json()
        if (d.connected) {
          setWaDone(true)
          onWhatsAppConnected?.()
          clearInterval(interval)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => clearInterval(interval)
  }, [waSent, waDone, onWhatsAppConnected])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-[18px] font-semibold text-foreground">Connect your accounts</h2>
            <p className="text-[12px] text-muted-foreground mt-0.5">Link LinkedIn and WhatsApp to unlock all features</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* LinkedIn */}
          <div className={`border rounded-xl p-4 transition-colors ${liDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg flex items-center justify-center ${liDone ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}>
                  <Link2 size={18} className={liDone ? 'text-emerald-600' : 'text-blue-600'} />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-foreground">LinkedIn</p>
                  <p className="text-[11px] text-muted-foreground">
                    {liDone ? 'Connected securely' : 'Required for posting & analytics'}
                  </p>
                </div>
              </div>
              {liDone ? (
                <div className="size-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
              ) : (
                <button
                  onClick={handleLinkedInConnect}
                  disabled={liConnecting}
                  className="text-[12px] px-4 py-2 bg-[#0A66C2] text-white rounded-lg font-medium hover:bg-[#0958a8] transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {liConnecting ? <Loader2 size={14} className="animate-spin" /> : <><Lock size={11} /> Connect</>}
                </button>
              )}
            </div>

            {!liDone && !liConnecting && (
              <div className="mt-3 pt-3 border-t border-border/50 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Shield size={10} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-[10px] text-muted-foreground">Password encrypted, never stored on our servers</p>
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={10} className="text-emerald-600 flex-shrink-0" />
                  <p className="text-[10px] text-muted-foreground">Powered by Unipile, enterprise integration platform</p>
                </div>
              </div>
            )}
          </div>

          {/* WhatsApp */}
          <div className={`border rounded-xl p-4 transition-colors ${waDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`size-10 rounded-lg flex items-center justify-center ${waDone ? 'bg-emerald-500/10' : 'bg-green-500/10'}`}>
                  <MessageCircle size={18} className={waDone ? 'text-emerald-600' : 'text-green-600'} />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-foreground">WhatsApp</p>
                  <p className="text-[11px] text-muted-foreground">
                    {waDone ? 'Connected — Nivi is ready to chat' : 'For morning briefs & post approvals'}
                  </p>
                </div>
              </div>
              {waDone && (
                <div className="size-6 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Check size={14} className="text-white" />
                </div>
              )}
            </div>

            {!waDone && !waSent && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="tel"
                  value={waPhone}
                  onChange={(e) => setWaPhone(e.target.value)}
                  placeholder="+91 93061 25452"
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleWhatsAppSend}
                  disabled={!waPhone.trim() || waSending}
                  className="text-[12px] px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {waSending ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                </button>
              </div>
            )}

            {!waDone && waSent && (
              <div className="mt-3 p-3 bg-secondary/50 rounded-lg">
                <p className="text-[12px] text-emerald-600 font-medium">Message sent to {waPhone}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Open WhatsApp and reply <span className="font-semibold text-foreground">ok</span> to connect.
                </p>
              </div>
            )}
          </div>

          {/* Skip */}
          {(!liDone || !waDone) && (
            <button
              onClick={onClose}
              className="w-full text-center text-[12px] text-muted-foreground hover:text-foreground transition-colors py-2"
            >
              I&apos;ll do this later
            </button>
          )}

          {liDone && waDone && (
            <button
              onClick={() => { onClose(); window.location.reload() }}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg text-[13px] font-medium hover:opacity-90 transition-opacity"
            >
              All set — let&apos;s go!
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
