import { Skeleton } from '@/components/ui/skeleton'

/**
 * Inspiration page skeleton — masonry grid of inspiration post cards.
 */
export function InspirationSkeleton() {
  // Vary heights so it looks like a real masonry grid
  const heights = [180, 240, 200, 280, 160, 220, 260, 190, 240, 200, 220, 180]
  return (
    <div className="px-6 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-48 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-7 w-24 rounded-full" />
        ))}
      </div>

      {/* Masonry grid */}
      <div className="columns-1 md:columns-2 lg:columns-3 gap-3 space-y-3">
        {heights.map((h, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3 break-inside-avoid">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-full" />
              <div className="space-y-1 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-16" />
              </div>
            </div>
            <Skeleton style={{ height: h - 80 }} className="w-full" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
