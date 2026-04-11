'use client'

const STATUS_STYLES: Record<string, string> = {
  published: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  scheduled: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  draft: 'bg-border text-muted-foreground border-border',
  skipped: 'bg-border text-muted-foreground border-border opacity-50',
}

export function PostStatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft
  return (
    <span
      className={`font-sans text-[10px] px-2 py-0.5 rounded-full border ${style}`}
    >
      {status}
    </span>
  )
}
