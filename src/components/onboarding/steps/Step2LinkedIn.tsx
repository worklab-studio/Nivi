'use client'

import { useState } from 'react'
import { Shield, Lock, Eye, LogOut, CheckCircle2, ExternalLink } from 'lucide-react'
import { usePostHog } from 'posthog-js/react'

interface Step2Props {
  onNext: () => void
  onBack: () => void
}

export function Step2LinkedIn({ onNext, onBack }: Step2Props) {
  const ph = usePostHog()
  const [loading, setLoading] = useState(false)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState('')
  const [showTrust, setShowTrust] = useState(true)

  const handleConnect = async () => {
    ph?.capture('linkedin_connect_clicked', { source: 'onboarding' })
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
            if (d.connected) {
              setConnected(true)
              // Auto-generate pillars in background
              fetch('/api/dashboard/writing-style/generate-pillars', { method: 'POST' }).catch(() => {})
            }
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
      <p className="text-muted-foreground text-[15px] mb-8 leading-relaxed">
        Nivi needs access to your LinkedIn to post, engage, and track analytics on your behalf.
      </p>

      {connected ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={18} className="text-white" />
            </div>
            <div>
              <p className="text-[14px] font-medium text-emerald-600">LinkedIn connected securely</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Your credentials are encrypted end-to-end</p>
            </div>
          </div>
        </div>
      ) : showTrust ? (
        <div className="space-y-5">
          {/* Security info card */}
          <div className="border border-border rounded-xl p-5 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-primary" />
              <span className="text-[13px] font-medium text-foreground">Secure connection</span>
            </div>

            <p className="text-[12px] text-muted-foreground mb-4 leading-relaxed">
              You&apos;ll be redirected to a secure login page to sign in with your LinkedIn credentials. Here&apos;s what you should know:
            </p>

            <div className="space-y-3">
              <TrustItem
                icon={Lock}
                text="Your password is encrypted and never stored on our servers"
              />
              <TrustItem
                icon={Eye}
                text="We only access posting and analytics. No messages, no contacts"
              />
              <TrustItem
                icon={LogOut}
                text="You can disconnect anytime from Settings"
              />
              <TrustItem
                icon={Shield}
                text="Powered by Unipile, an enterprise LinkedIn integration platform used by 1000+ brands"
              />
            </div>
          </div>

          <button
            onClick={() => { setShowTrust(false); handleConnect() }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#0A66C2] hover:bg-[#0958a8] text-white px-6 py-3.5 rounded-xl font-medium transition-colors disabled:opacity-50 text-[14px]"
          >
            {loading ? (
              'Opening secure login...'
            ) : (
              <>
                <Lock size={14} />
                Connect LinkedIn securely
              </>
            )}
          </button>

          <a
            href="https://www.unipile.com/security"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Learn more about security
            <ExternalLink size={10} />
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-primary/20 bg-primary/5 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <p className="text-[13px] font-medium text-foreground">Waiting for LinkedIn login...</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Complete the login in the popup window. If the window didn&apos;t open,{' '}
              <button onClick={handleConnect} className="text-primary underline">click here</button>.
            </p>
          </div>

          {error && (
            <p className="text-destructive text-[12px]">{error}</p>
          )}

          <button
            onClick={() => { setShowTrust(true); setLoading(false) }}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      <div className="mt-auto flex justify-between pt-6">
        <button
          onClick={onBack}
          className="text-muted-foreground text-[13px] font-sans hover:text-foreground transition-colors"
        >
          Back
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
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function TrustItem({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon size={11} className="text-emerald-600" />
      </div>
      <p className="text-[12px] text-foreground/80 leading-relaxed">{text}</p>
    </div>
  )
}
