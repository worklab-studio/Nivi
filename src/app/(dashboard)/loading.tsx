import { Skeleton } from '@/components/ui/skeleton'

/**
 * Generic dashboard skeleton — shown by Next.js during route transitions
 * before the page-specific skeleton takes over. Mirrors the typical page shape:
 * header, KPI row, content card.
 */
export default function DashboardLoading() {
  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        ))}
      </div>

      {/* Content card */}
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
