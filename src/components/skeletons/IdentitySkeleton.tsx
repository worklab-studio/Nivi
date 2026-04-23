import { Skeleton } from '@/components/ui/skeleton'

/**
 * Identity page skeleton — title + 3-column layout of identity sections.
 */
export function IdentitySkeleton() {
  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Two-column layout: main sections + identity score sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column (2/3) */}
        <div className="lg:col-span-2 space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-3 w-72" />
              <div className="space-y-2 pt-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar (1/3) */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5 space-y-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-2 w-full rounded-full" />
            <Skeleton className="h-3 w-32" />
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
