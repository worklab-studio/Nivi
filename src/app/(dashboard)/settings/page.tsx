'use client'

import { useState, useEffect, useCallback } from 'react'
import { useUser, SignOutButton } from '@clerk/nextjs'
import {
  Link2,
  MessageCircle,
  Loader2,
  Clock,
  Globe,
  CreditCard,
  User,
  Shield,
  LogOut,
  Trash2,
  Check,
  ChevronRight,
  Crown,
  Target,
} from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from 'sonner'

interface UserSettings {
  posting_time: string
  engagement_time: string
  timezone: string
  plan: string
  whatsapp_number: string | null
  unipile_account_id: string | null
  brand_kit: Record<string, unknown>
  ls_subscription_id: string | null
  posting_goal: number | null
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
  'Pacific/Auckland',
]

export default function SettingsPage() {
  const { user: clerkUser } = useUser()
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [saving, setSaving] = useState<string | null>(null)
  const [linkedInConnecting, setLinkedInConnecting] = useState(false)
  const [showWhatsAppConnect, setShowWhatsAppConnect] = useState(false)
  const [waPhone, setWaPhone] = useState('')
  const [waSending, setWaSending] = useState(false)
  const [waSent, setWaSent] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/settings')
      .then((r) => r.json())
      .then((d) => setSettings(d.settings))
      .catch(() => {})
  }, [])

  const saveField = useCallback(async (field: string, value: string) => {
    setSaving(field)
    await fetch('/api/dashboard/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    setSettings((prev) => (prev ? { ...prev, [field]: value } : prev))
    setSaving(null)
    toast.success('Saved')
  }, [])

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
            setSettings((prev) => prev ? { ...prev, unipile_account_id: 'connected' } : prev)
            toast.success('LinkedIn connected')
          }
          setLinkedInConnecting(false)
        }
      }, 500)
    } catch { setLinkedInConnecting(false) }
  }

  async function handleSendWhatsApp() {
    if (!waPhone.trim() || waSending) return
    setWaSending(true)
    try {
      const res = await fetch('/api/onboarding/send-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: waPhone }),
      })
      const data = await res.json()
      if (data.ok) { setWaSent(true); toast.success('Message sent!') }
    } catch { /* ignore */ }
    setWaSending(false)
  }

  async function handleManageSubscription() {
    const res = await fetch('/api/lemonsqueezy/portal', { method: 'POST' })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    else toast.error(data.error ?? 'Could not open portal')
  }

  const handleDeleteAccount = async () => {
    await fetch('/api/account/delete', { method: 'DELETE' })
    window.location.href = '/'
  }

  const planLabel = settings?.plan === 'complete' ? 'Nivi Pro' : settings?.plan === 'dashboard' ? 'Nivi Starter' : 'Free Trial'
  const planPrice = settings?.plan === 'complete' ? '$35/mo' : settings?.plan === 'dashboard' ? '$29/mo' : 'Free'
  const isPaid = settings?.plan === 'dashboard' || settings?.plan === 'complete'

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-foreground">Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Manage your account, connections, and preferences</p>
      </div>

      <div className="space-y-5">
        {/* ──── PROFILE ──── */}
        <Section icon={User} title="Profile">
          <div className="flex items-center gap-4">
            {clerkUser?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clerkUser.imageUrl} alt="" className="w-14 h-14 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-lg font-semibold">
                {(clerkUser?.fullName ?? '?').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-[15px] font-semibold text-foreground">{clerkUser?.fullName ?? 'User'}</p>
              <p className="text-[12px] text-muted-foreground">{clerkUser?.primaryEmailAddress?.emailAddress}</p>
            </div>
          </div>
        </Section>

        {/* ──── PLAN ──── */}
        <Section icon={Crown} title="Plan">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${
                isPaid ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
              }`}>
                {planLabel}
              </div>
              <span className="text-[13px] text-muted-foreground">{planPrice}</span>
            </div>
            {isPaid ? (
              <button
                onClick={handleManageSubscription}
                className="text-[12px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                Manage <ChevronRight size={12} />
              </button>
            ) : (
              <button
                onClick={() => { window.location.href = '/pricing' }}
                className="text-[12px] px-4 py-1.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
              >
                Upgrade
              </button>
            )}
          </div>
          {!isPaid && (
            <p className="text-[11px] text-muted-foreground mt-2">
              You&apos;re on a 7-day free trial. Upgrade to keep all features.
            </p>
          )}
        </Section>

        {/* ──── CONNECTIONS ──── */}
        <Section icon={Link2} title="Connections">
          <div className="space-y-4">
            {/* LinkedIn */}
            <ConnectionRow
              name="LinkedIn"
              description={settings?.unipile_account_id ? 'Connected — posting & analytics active' : 'Connect to publish posts and sync analytics'}
              connected={!!settings?.unipile_account_id}
              actionLabel={linkedInConnecting ? 'Connecting…' : settings?.unipile_account_id ? 'Reconnect' : 'Connect'}
              onAction={handleLinkedInConnect}
              disabled={linkedInConnecting}
            />

            {/* WhatsApp */}
            <div>
              <ConnectionRow
                name="WhatsApp"
                description={
                  settings?.whatsapp_number
                    ? `Connected · +${settings.whatsapp_number.slice(0, 2)} ••••• ${settings.whatsapp_number.slice(-4)}`
                    : 'Connect for morning briefs & post approvals'
                }
                connected={!!settings?.whatsapp_number}
                actionLabel={settings?.whatsapp_number ? 'Disconnect' : 'Connect'}
                onAction={() => {
                  if (settings?.whatsapp_number) {
                    saveField('whatsapp_number', '')
                  } else {
                    setShowWhatsAppConnect(true)
                  }
                }}
              />

              {showWhatsAppConnect && !settings?.whatsapp_number && (
                <div className="mt-3 ml-9 p-4 bg-secondary/50 border border-border rounded-lg">
                  {!waSent ? (
                    <div className="space-y-3">
                      <p className="text-[12px] text-foreground">Enter your WhatsApp number — Nivi will message you.</p>
                      <div className="flex items-center gap-2">
                        <input
                          type="tel"
                          value={waPhone}
                          onChange={(e) => setWaPhone(e.target.value)}
                          placeholder="+91 98765 43210"
                          className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                        />
                        <button
                          onClick={handleSendWhatsApp}
                          disabled={!waPhone.trim() || waSending}
                          className="text-[12px] px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50"
                        >
                          {waSending ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                        </button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Include country code (e.g. +91 for India)</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <p className="text-[12px] text-emerald-600 font-medium flex items-center gap-1.5">
                        <Check size={14} /> Message sent to {waPhone}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Reply <span className="font-semibold text-foreground">ok</span> on WhatsApp, then refresh this page.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </Section>

        {/* ──── SCHEDULE ──── */}
        <Section icon={Clock} title="Schedule">
          <div className="space-y-4">
            <SettingRow
              label="Daily post time"
              description="When Nivi sends your morning brief"
            >
              <input
                type="time"
                value={settings?.posting_time ?? '09:00'}
                onChange={(e) => saveField('posting_time', e.target.value)}
                className="bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground text-[12px] focus:outline-none focus:border-primary w-[120px]"
              />
            </SettingRow>
            <SettingRow
              label="Engagement brief time"
              description="When Nivi sends commenting opportunities"
            >
              <input
                type="time"
                value={settings?.engagement_time ?? '10:00'}
                onChange={(e) => saveField('engagement_time', e.target.value)}
                className="bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground text-[12px] focus:outline-none focus:border-primary w-[120px]"
              />
            </SettingRow>
          </div>
        </Section>

        {/* ──── POSTING GOAL ──── */}
        <Section icon={Target} title="Posting Goal">
          <SettingRow label="Posts per week" description="Nivi will nudge you to stay consistent">
            <div className="flex items-center gap-3">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <button
                  key={n}
                  onClick={() => saveField('posting_goal', String(n))}
                  className={`w-8 h-8 rounded-lg text-[12px] font-medium transition-all ${
                    (settings?.posting_goal ?? 4) === n
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </SettingRow>
        </Section>

        {/* ──── TIMEZONE ──── */}
        <Section icon={Globe} title="Timezone">
          <SettingRow label="Your timezone" description="Used for scheduling and brief delivery">
            <select
              value={settings?.timezone ?? 'Asia/Kolkata'}
              onChange={(e) => saveField('timezone', e.target.value)}
              className="bg-secondary border border-border rounded-md px-3 py-1.5 text-foreground text-[12px] focus:outline-none focus:border-primary w-[180px]"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz.replace('_', ' ')}</option>
              ))}
            </select>
          </SettingRow>
        </Section>

        {/* ──── ACCOUNT ──── */}
        <Section icon={Shield} title="Account">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] text-foreground">Sign out</p>
              <p className="text-[11px] text-muted-foreground">Sign out of your Nivi account</p>
            </div>
            <SignOutButton>
              <button className="text-[12px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground flex items-center gap-1.5 transition-colors">
                <LogOut size={12} />
                Sign out
              </button>
            </SignOutButton>
          </div>
        </Section>

        {/* ──── DANGER ──── */}
        <div className="border border-destructive/20 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trash2 size={14} className="text-destructive" />
            <h3 className="text-[13px] font-medium text-destructive">Danger zone</h3>
          </div>
          <p className="text-[12px] text-muted-foreground mb-4">
            Permanently delete your account and all data. This action cannot be undone.
          </p>
          <Dialog>
            <DialogTrigger className="text-[12px] px-3 py-1.5 border border-destructive/30 text-destructive rounded-md hover:bg-destructive/10 transition-colors">
              Delete account
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-foreground">Delete Account</DialogTitle>
              </DialogHeader>
              <p className="text-muted-foreground text-[13px] mb-4">
                Type <span className="font-mono text-foreground">delete my account</span> to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="delete my account"
                className="w-full bg-secondary border border-border rounded-md px-4 py-2.5 text-foreground text-[13px] focus:outline-none focus:border-destructive"
              />
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'delete my account'}
                className="mt-3 w-full text-[12px] py-2.5 bg-destructive text-white rounded-md disabled:opacity-30 hover:bg-destructive/80 transition-colors font-medium"
              >
                Permanently Delete
              </button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {saving && (
        <div className="fixed bottom-4 right-4 bg-card border border-border rounded-lg px-3 py-2 shadow-lg flex items-center gap-2 text-[11px] text-muted-foreground animate-in fade-in">
          <Loader2 size={12} className="animate-spin" /> Saving...
        </div>
      )}
    </div>
  )
}

/** Section wrapper with icon + title */
function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} className="text-muted-foreground" />
        <h2 className="text-[13px] font-medium text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  )
}

/** Connection row */
function ConnectionRow({
  name,
  description,
  connected,
  actionLabel,
  onAction,
  disabled,
}: {
  name: string
  description: string
  connected: boolean
  actionLabel: string
  onAction: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
        <div>
          <p className="text-[13px] text-foreground font-medium">{name}</p>
          <p className="text-[11px] text-muted-foreground">{description}</p>
        </div>
      </div>
      <button
        onClick={onAction}
        disabled={disabled}
        className="text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors disabled:opacity-50"
      >
        {actionLabel}
      </button>
    </div>
  )
}

/** Setting row with label + description + control */
function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-[13px] text-foreground">{label}</p>
        <p className="text-[11px] text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  )
}
