'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarDays,
  FileText,
  User,
  Type,
  BookOpen,
  MessageSquare,
  PenSquare,
  Lightbulb,
  Settings,
  Crown,
  Sparkles,
} from 'lucide-react'

const GROUPS: {
  label: string
  items: { href: string; icon: typeof LayoutDashboard; label: string }[]
}[] = [
  {
    label: 'Workspace',
    items: [
      { href: '/overview', icon: LayoutDashboard, label: 'Overview' },
      { href: '/compose', icon: PenSquare, label: 'Compose' },
      { href: '/calendar', icon: CalendarDays, label: 'Calendar' },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/posts', icon: FileText, label: 'Posts' },
      { href: '/engagement', icon: MessageSquare, label: 'Engagement' },
      { href: '/inspiration', icon: Lightbulb, label: 'Inspiration' },
    ],
  },
  {
    label: 'Insights',
    items: [
      { href: '/identity', icon: User, label: 'Identity' },
      { href: '/writing-style', icon: Type, label: 'Writing style' },
      { href: '/knowledge', icon: BookOpen, label: 'Knowledge' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [plan, setPlan] = useState<{ plan: string; trialDaysLeft: number }>({ plan: 'free', trialDaysLeft: 7 })

  useEffect(() => {
    fetch('/api/dashboard/settings')
      .then((r) => r.json())
      .then((d) => {
        const userPlan = d.settings?.plan ?? 'free'
        const createdAt = d.settings?.created_at ? new Date(d.settings.created_at).getTime() : Date.now()
        const daysSince = Math.floor((Date.now() - createdAt) / 86400000)
        const trialDaysLeft = Math.max(0, 7 - daysSince)
        setPlan({ plan: userPlan, trialDaysLeft })
      })
      .catch(() => {})
  }, [])

  const isPaid = plan.plan === 'dashboard' || plan.plan === 'complete'
  const isTrial = plan.plan === 'free' && plan.trialDaysLeft > 0
  const isExpired = plan.plan === 'free' && plan.trialDaysLeft <= 0

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-card border-r border-border flex flex-col z-50">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 shrink-0">
        <Link href="/overview" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Nivi" className="w-4 h-4" />
          </div>
          <span className="text-[15px] font-semibold text-foreground tracking-tight">
            hello nivi
          </span>
        </Link>
      </div>

      {/* Edge-to-edge divider below logo */}
      <div className="h-px bg-border" />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto">
        {GROUPS.map((group, gi) => (
          <div key={group.label}>
            {gi > 0 && <div className="h-px bg-border" />}
            <div className="px-2 pt-3 pb-2">
              <p className="px-3 mb-1.5 text-[11px] text-muted-foreground/60 font-medium">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(({ href, icon: Icon, label }) => {
                  const active = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={`flex items-center gap-3 px-3 py-[6px] rounded-md text-[13px] transition-colors ${
                        active
                          ? 'bg-accent text-primary font-medium border border-border'
                          : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'
                      }`}
                    >
                      <Icon
                        size={18}
                        strokeWidth={active ? 2 : 1.5}
                        className={`shrink-0 ${active ? 'text-primary' : ''}`}
                      />
                      <span>{label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        ))}
      </nav>

      {/* Plan widget */}
      <div className="px-3 pb-2">
        {isPaid ? (
          <div className="bg-primary/5 border border-primary/20 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Crown size={14} className="text-primary" />
              <span className="text-[12px] font-semibold text-foreground">
                {plan.plan === 'complete' ? 'Nivi Pro' : 'Nivi Starter'}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">All features active</p>
          </div>
        ) : isTrial ? (
          <div className="bg-secondary border border-border rounded-lg px-3 py-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium text-foreground">Free Trial</span>
              <span className="text-[10px] text-muted-foreground">{plan.trialDaysLeft}d left</span>
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${((7 - plan.trialDaysLeft) / 7) * 100}%` }}
              />
            </div>
            <Link
              href="/pricing"
              className="mt-2.5 block text-center text-[11px] border border-border text-muted-foreground rounded-md py-1.5 font-medium hover:text-foreground hover:bg-accent transition-colors"
            >
              Upgrade
            </Link>
          </div>
        ) : isExpired ? (
          <div className="bg-secondary border border-border rounded-lg px-3 py-2.5">
            <span className="text-[12px] font-medium text-foreground">Trial ended</span>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full w-full" />
            </div>
            <Link
              href="/pricing"
              className="mt-2.5 block text-center text-[11px] bg-primary text-primary-foreground rounded-md py-1.5 font-medium hover:opacity-90 transition-opacity"
            >
              Upgrade Now
            </Link>
          </div>
        ) : null}
      </div>

      {/* Bottom */}
      <div className="h-px bg-border" />
      <div className="px-2 py-2">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-[6px] rounded-md text-[13px] transition-colors ${
            pathname === '/settings'
              ? 'bg-accent text-primary font-medium border border-border'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground border border-transparent'
          }`}
        >
          <Settings
            size={18}
            strokeWidth={pathname === '/settings' ? 2 : 1.5}
            className={`shrink-0 ${pathname === '/settings' ? 'text-primary' : ''}`}
          />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  )
}
