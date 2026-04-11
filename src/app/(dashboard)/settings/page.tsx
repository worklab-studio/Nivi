'use client'

import { useState, useEffect, useCallback } from 'react'
import { NiviMessage } from '@/components/nivi/NiviMessage'
import { useUser, SignOutButton } from '@clerk/nextjs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

interface UserSettings {
  posting_time: string
  engagement_time: string
  timezone: string
  plan: string
  whatsapp_number: string | null
  unipile_account_id: string | null
  brand_kit: Record<string, unknown>
}

const TIMEZONES = [
  'Asia/Kolkata',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
]

export default function SettingsPage() {
  const { user: clerkUser } = useUser()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [linkedInConnecting, setLinkedInConnecting] = useState(false)
  const [showWhatsAppConnect, setShowWhatsAppConnect] = useState(false)
  const [optInCode, setOptInCode] = useState('')
  const [waCopied, setWaCopied] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/settings')
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => {})
  }, [])

  const saveField = useCallback(
    async (field: string, value: string) => {
      setSaving(true)
      await fetch('/api/dashboard/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      })
      setSettings((prev) => (prev ? { ...prev, [field]: value } : prev))
      setSaving(false)
    },
    []
  )

  async function handleLinkedInConnect() {
    setLinkedInConnecting(true)
    try {
      const res = await fetch('/api/onboarding/linkedin-auth', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setLinkedInConnecting(false); return }

      const popup = window.open(data.url, 'linkedin-auth', 'width=600,height=700,scrollbars=yes')
      const check = setInterval(async () => {
        if (popup?.closed) {
          clearInterval(check)
          const r = await fetch('/api/onboarding/check-linkedin')
          const d = await r.json()
          if (d.connected) {
            setSettings((prev) => prev ? { ...prev, unipile_account_id: d.accountId ?? 'connected' } : prev)
          }
          setLinkedInConnecting(false)
        }
      }, 500)
    } catch {
      setLinkedInConnecting(false)
    }
  }

  async function handleWhatsAppConnect() {
    setShowWhatsAppConnect(true)
    if (!optInCode) {
      const res = await fetch('/api/onboarding/get-opt-in-code')
      const data = await res.json()
      setOptInCode(data.code ?? '')
    }
  }

  const handleUpgrade = async () => {
    const res = await fetch('/api/stripe/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
  }

  const handleDeleteAccount = async () => {
    await fetch('/api/account/delete', { method: 'DELETE' })
    window.location.href = '/'
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="font-sans text-2xl font-medium text-foreground">Settings</h1>
        <p className="font-sans text-xs text-muted-foreground mt-1 tracking-wider uppercase">
          Manage your account
        </p>
      </div>

      {/* Connections */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-sans text-[11px] text-muted-foreground uppercase tracking-widest mb-4">
          Connections
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full ${
                  settings?.unipile_account_id ? 'bg-emerald-500' : 'bg-destructive'
                }`}
              />
              <div>
                <p className="text-[13px] text-foreground">LinkedIn</p>
                <p className="font-sans text-[10px] text-muted-foreground">
                  {settings?.unipile_account_id ? 'Connected' : 'Not connected'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLinkedInConnect}
              disabled={linkedInConnecting}
              className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors disabled:opacity-50"
            >
              {linkedInConnecting ? 'Connecting…' : settings?.unipile_account_id ? 'Reconnect' : 'Connect'}
            </button>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`w-2 h-2 rounded-full ${
                    settings?.whatsapp_number ? 'bg-emerald-500' : 'bg-destructive'
                  }`}
                />
                <div>
                  <p className="text-[13px] text-foreground">WhatsApp</p>
                  <p className="font-sans text-[10px] text-muted-foreground">
                    {settings?.whatsapp_number
                      ? `+${settings.whatsapp_number.slice(0, 4)}XXX XXXXX`
                      : 'Not connected'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!settings?.whatsapp_number && (
                  <button
                    onClick={handleWhatsAppConnect}
                    className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors"
                  >
                    Connect
                  </button>
                )}
                {settings?.whatsapp_number && (
                  <button
                    onClick={() => saveField('whatsapp_number', '')}
                    className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors"
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </div>

            {/* WhatsApp connect instructions */}
            {showWhatsAppConnect && !settings?.whatsapp_number && (
              <div className="mt-3 p-4 bg-secondary/50 border border-border rounded-lg space-y-3">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Step 1</p>
                  <p className="text-[12px] text-foreground">Save this number in your contacts:</p>
                  <p className="text-[15px] font-semibold text-foreground mt-1">+91 93061 25452</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Save as &ldquo;Nivi&rdquo;</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium mb-1">Step 2</p>
                  <p className="text-[12px] text-foreground mb-2">Send this message to Nivi on WhatsApp:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[13px] text-foreground bg-accent px-3 py-1.5 rounded font-mono">
                      START {optInCode || '…'}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`START ${optInCode}`)
                        setWaCopied(true)
                        setTimeout(() => setWaCopied(false), 2000)
                      }}
                      className="text-[10px] text-muted-foreground border border-border px-2 py-1 rounded hover:text-foreground transition-colors"
                    >
                      {waCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  After sending, refresh this page to see the connection status.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Posting Preferences */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-sans text-[11px] text-muted-foreground uppercase tracking-widest mb-4">
          Posting Preferences
        </h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-[13px] text-muted-foreground">Daily post time</label>
            <input
              type="time"
              value={settings?.posting_time ?? '09:00'}
              onChange={(e) => saveField('posting_time', e.target.value)}
              className="bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground font-sans text-[12px] focus:outline-none focus:border-border"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[13px] text-muted-foreground">Engagement brief time</label>
            <input
              type="time"
              value={settings?.engagement_time ?? '10:00'}
              onChange={(e) => saveField('engagement_time', e.target.value)}
              className="bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground font-sans text-[12px] focus:outline-none focus:border-border"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-[13px] text-muted-foreground">Timezone</label>
            <select
              value={settings?.timezone ?? 'Asia/Kolkata'}
              onChange={(e) => saveField('timezone', e.target.value)}
              className="bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground font-sans text-[12px] focus:outline-none focus:border-border"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>
        {saving && (
          <p className="font-sans text-[10px] text-muted-foreground mt-2">Saving...</p>
        )}
      </section>

      {/* Plan & Billing */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-sans text-[11px] text-muted-foreground uppercase tracking-widest mb-4">
          Plan & Billing
        </h2>
        <div className="flex items-center gap-3 mb-4">
          <span
            className={`font-sans text-[11px] px-3 py-1 rounded-full border ${
              settings?.plan === 'pro'
                ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
                : settings?.plan === 'agency'
                  ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
                  : 'border-border text-muted-foreground'
            }`}
          >
            {settings?.plan ?? 'starter'}
          </span>
        </div>
        <button
          onClick={handleUpgrade}
          className="font-sans text-[11px] px-4 py-1.5 bg-white text-black rounded-md hover:bg-white/90 transition-colors"
        >
          {settings?.plan === 'starter' ? 'Upgrade' : 'Manage subscription'}
        </button>
      </section>

      {/* Account */}
      <section className="bg-card border border-border rounded-lg p-5">
        <h2 className="font-sans text-[11px] text-muted-foreground uppercase tracking-widest mb-4">
          Account
        </h2>
        <div className="space-y-2 mb-4">
          <p className="text-[13px] text-foreground">
            {clerkUser?.fullName ?? 'User'}
          </p>
          <p className="font-sans text-[12px] text-muted-foreground">
            {clerkUser?.primaryEmailAddress?.emailAddress}
          </p>
        </div>
        <SignOutButton>
          <button className="font-sans text-[11px] px-4 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors">
            Sign out
          </button>
        </SignOutButton>
      </section>

      {/* Danger zone */}
      <section className="border border-destructive/30 rounded-lg p-5">
        <h2 className="font-sans text-[13px] text-destructive mb-2">Delete Account</h2>
        <p className="text-[13px] text-muted-foreground mb-4">
          This permanently deletes your account and all data. This cannot be undone.
        </p>
        <Dialog>
          <DialogTrigger className="font-sans text-[11px] px-4 py-1.5 border border-destructive/30 text-destructive rounded-md hover:bg-destructive/10 transition-colors">
            Delete account
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground font-sans">Delete Account</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground text-[13px] mb-4">
              Type &ldquo;delete my account&rdquo; to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="delete my account"
              className="w-full bg-secondary border border-border rounded-md px-4 py-2 text-foreground text-[14px] focus:outline-none focus:border-border"
            />
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirm !== 'delete my account'}
              className="mt-3 font-sans text-[11px] px-4 py-1.5 bg-destructive text-white rounded-md disabled:opacity-30 hover:bg-destructive/80 transition-colors"
            >
              Permanently Delete
            </button>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  )
}
