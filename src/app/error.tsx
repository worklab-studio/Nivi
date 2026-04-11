'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md">
        <p className="font-sans text-xs text-muted-foreground uppercase tracking-widest mb-4">
          Something went wrong
        </p>
        <h2 className="font-sans text-2xl text-foreground mb-6">
          {error.message || 'Unexpected error'}
        </h2>
        <button
          onClick={reset}
          className="font-sans text-sm border border-border px-4 py-2 rounded hover:border-border transition-colors text-muted-foreground hover:text-foreground"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
