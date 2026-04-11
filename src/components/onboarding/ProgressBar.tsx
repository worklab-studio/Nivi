'use client'

export function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="w-full h-1 bg-border rounded-full overflow-hidden">
      <div
        className="h-full bg-white transition-all duration-300"
        style={{ width: `${(step / total) * 100}%` }}
      />
    </div>
  )
}
