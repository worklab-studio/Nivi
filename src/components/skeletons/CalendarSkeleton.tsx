import { Skeleton } from '@/components/ui/skeleton'

/**
 * Calendar page skeleton — month header, weekday row, 5-row grid of day cells.
 */
export function CalendarSkeleton() {
  return (
    <div className="px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 gap-2">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-12 mx-auto" />
        ))}
      </div>

      {/* Day grid (5 rows × 7 cols) */}
      <div className="grid grid-cols-7 gap-2">
        {[...Array(35)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-lg aspect-square p-2 space-y-1.5">
            <Skeleton className="h-3 w-6" />
            {i % 4 === 1 && <Skeleton className="h-3 w-full" />}
            {i % 5 === 2 && <Skeleton className="h-3 w-3/4" />}
          </div>
        ))}
      </div>
    </div>
  )
}
