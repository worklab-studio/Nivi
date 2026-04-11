'use client'

import { ThemeToggle } from '@/components/theme-toggle'
import { UserButton } from '@clerk/nextjs'
import { Search } from 'lucide-react'

export function TopBar() {
  return (
    <header className="h-14 sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6">
      <button className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border transition-colors text-[12px] min-w-[220px] shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <Search size={13} />
        <span>Search</span>
        <kbd className="ml-auto text-[10px] text-muted-foreground/60 font-medium bg-secondary px-1.5 py-0.5 rounded">⌘K</kbd>
      </button>
      <div className="flex items-center gap-3">
        <ThemeToggle />
        <div className="w-px h-5 bg-border" />
        <UserButton appearance={{ elements: { avatarBox: 'w-8 h-8 ring-2 ring-border' } }} />
      </div>
    </header>
  )
}
