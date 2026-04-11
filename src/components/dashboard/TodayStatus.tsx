'use client'

import { PostStatusBadge } from './PostStatusBadge'

interface TodayStatusProps {
  status: 'draft' | 'scheduled' | 'published' | null
  preview?: string
  scheduledTime?: string
  publishedTime?: string
  impressions?: number
  onPostNow?: () => void
  onGenerate?: () => void
  onSkip?: () => void
}

export function TodayStatus({
  status,
  preview,
  scheduledTime,
  publishedTime,
  impressions,
  onPostNow,
  onGenerate,
  onSkip,
}: TodayStatusProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-widest">
          Today
        </p>
        {status && <PostStatusBadge status={status} />}
      </div>

      {status === 'draft' && (
        <>
          <p className="font-sans text-[14px] text-muted-foreground leading-relaxed mb-4">
            {preview?.slice(0, 150)}
            {(preview?.length ?? 0) > 150 ? '...' : ''}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onPostNow}
              className="font-sans text-[11px] px-3 py-1.5 bg-white text-black rounded-md hover:bg-white/90 transition-colors"
            >
              Post now
            </button>
            <button
              onClick={onSkip}
              className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              Skip today
            </button>
          </div>
        </>
      )}

      {status === 'scheduled' && (
        <p className="font-sans text-[13px] text-amber-600">
          Publishing today at {scheduledTime}
        </p>
      )}

      {status === 'published' && (
        <div>
          <p className="font-sans text-[13px] text-emerald-600 mb-1">
            Published at {publishedTime}
          </p>
          {impressions !== undefined && (
            <p className="font-sans text-[11px] text-muted-foreground">
              {impressions.toLocaleString()} impressions so far
            </p>
          )}
        </div>
      )}

      {!status && (
        <>
          <p className="font-sans text-[14px] text-muted-foreground mb-4">
            No post today. Want me to generate one?
          </p>
          <button
            onClick={onGenerate}
            className="font-sans text-[11px] px-3 py-1.5 bg-white text-black rounded-md hover:bg-white/90 transition-colors"
          >
            Generate now
          </button>
        </>
      )}
    </div>
  )
}
