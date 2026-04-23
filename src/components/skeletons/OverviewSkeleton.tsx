import { Skeleton } from '@/components/ui/skeleton'

/**
 * Overview page skeleton — matches the actual layout structure:
 * profile hero → 7-day strip → 5 KPI cards → 30-day chart + pillar performance → today's post
 */
export function OverviewSkeleton() {
  return (
    <div className="px-6 py-6 space-y-6">
      {/* Profile hero */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-5">
          <Skeleton className="size-20 rounded-full" />
          <div className="flex-1 space-y-3 pt-1">
            <Skeleton className="h-6 w-72" />
            <Skeleton className="h-4 w-56" />
            <div className="flex items-center gap-4 pt-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="size-8 rounded-md" />
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>

        {/* Week strip */}
        <div className="mt-6 grid grid-cols-7 gap-1.5">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="space-y-1.5 px-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="size-1.5 rounded-full mx-auto" />
            </div>
          ))}
        </div>
      </div>

      {/* 5 KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="size-7 rounded-md" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
        ))}
      </div>

      {/* Chart + pillar performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-48 w-full mt-2" />
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-3">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2 pt-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
