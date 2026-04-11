export default function DashboardLoading() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="h-8 w-48 bg-card rounded animate-pulse mb-2" />
      <div className="h-3 w-32 bg-card rounded animate-pulse mb-8" />
      <div className="h-16 w-full bg-card rounded animate-pulse mb-6" />
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-20 bg-card rounded animate-pulse" />
        ))}
      </div>
      <div className="h-48 w-full bg-card rounded animate-pulse" />
    </div>
  )
}
