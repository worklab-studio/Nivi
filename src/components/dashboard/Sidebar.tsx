'use client'

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

  return (
    <aside className="fixed left-0 top-0 h-full w-[220px] bg-card border-r border-border flex flex-col z-50">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-4 shrink-0">
        <Link href="/overview" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-[13px] font-bold">
            N
          </div>
          <span className="text-[16px] font-semibold text-foreground tracking-tight">
            Nivi
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
