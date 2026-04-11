import type { ReactNode } from 'react'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { TopBar } from '@/components/dashboard/TopBar'

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="ml-[220px] min-h-screen flex flex-col">
        <TopBar />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  )
}
