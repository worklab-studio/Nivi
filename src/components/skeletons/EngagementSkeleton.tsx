import { Skeleton } from '@/components/ui/skeleton'

/**
 * Engagement page skeleton — header + tabs + list of comment opportunity cards.
 */
export function EngagementSkeleton() {
  return (
    <div className="px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-md" />
        ))}
      </div>

      {/* Opportunity cards */}
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-56" />
              </div>
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="space-y-1.5 pl-13">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-3/4" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Skeleton className="h-7 w-20 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
