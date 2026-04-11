'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import { createPortal } from 'react-dom'

export interface CalendarPost {
  id: string
  content: string
  status: string
  hook_type: string | null
  content_pillar: number | null
  scheduled_at: string | null
  published_at: string | null
  created_at: string
  impressions?: number
  likes?: number
  comments?: number
}

const STATUS_BG: Record<string, string> = {
  draft: 'bg-secondary border-border text-muted-foreground',
  scheduled: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
  published: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
  skipped: 'bg-destructive/10 border-destructive/30 text-destructive/80',
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Draft', cls: 'bg-secondary text-muted-foreground' },
  scheduled: { label: 'Scheduled', cls: 'bg-blue-500/15 text-blue-600' },
  published: { label: 'Published', cls: 'bg-emerald-500/15 text-emerald-600' },
  skipped: { label: 'Skipped', cls: 'bg-destructive/15 text-destructive' },
}

interface Props {
  post: CalendarPost
  onClick: () => void
}

export function CalendarEventBlock({ post, onClick }: Props) {
  const when = post.published_at ?? post.scheduled_at
  const time = when ? format(new Date(when), 'HH:mm') : ''
  const style = STATUS_BG[post.status] ?? STATUS_BG.draft
  const isDraggable = post.status !== 'published'

  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const blockRef = useRef<HTMLButtonElement>(null)

  const clearTimer = useCallback(() => {
    if (hoverTimer.current) {
      clearTimeout(hoverTimer.current)
      hoverTimer.current = null
    }
  }, [])

  function handleMouseEnter() {
    clearTimer()
    hoverTimer.current = setTimeout(() => {
      if (!blockRef.current) return
      const rect = blockRef.current.getBoundingClientRect()
      const viewW = window.innerWidth
      const tooltipW = 340
      // Open to the right by default; if not enough space, open left
      const openRight = rect.right + tooltipW + 12 < viewW
      setTooltipPos({
        top: rect.top,
        left: openRight ? rect.right + 8 : rect.left - tooltipW - 8,
      })
      setShowTooltip(true)
    }, 1000)
  }

  function handleMouseLeave() {
    clearTimer()
    setShowTooltip(false)
  }

  function handleDragStart(e: React.DragEvent) {
    e.dataTransfer.setData('text/plain', `scheduled:${post.id}`)
    e.dataTransfer.effectAllowed = 'move'
    clearTimer()
    setShowTooltip(false)
  }

  // Close on scroll
  useEffect(() => {
    if (!showTooltip) return
    function hide() { setShowTooltip(false) }
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [showTooltip])

  const hookLine = post.content.split('\n')[0]?.slice(0, 60) || ''
  const dateLabel = when ? format(new Date(when), 'EEE, MMM d · h:mm a') : ''
  // Position block within the cell based on its minute offset
  const minute = when ? new Date(when).getMinutes() : 0
  const topPercent = (minute / 60) * 100
  const statusInfo = STATUS_LABEL[post.status] ?? STATUS_LABEL.draft
  const hasStats = post.status === 'published' && ((post.impressions ?? 0) > 0 || (post.likes ?? 0) > 0)

  return (
    <>
      <button
        ref={blockRef}
        onClick={onClick}
        draggable={isDraggable}
        onDragStart={isDraggable ? handleDragStart : undefined}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`absolute left-1 right-1 z-10 rounded-lg border px-2.5 py-1.5 text-left overflow-hidden hover:shadow-md transition-all ${style} ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
        style={{
          top: `calc(${topPercent}% + 2px)`,
          height: `calc(${100 - topPercent}% - 4px)`,
          minHeight: 28,
        }}
      >
        <p className="font-sans text-[9px] opacity-70 font-medium leading-none">{time}</p>
        <p className="font-sans text-[11px] leading-[1.3] line-clamp-2 mt-0.5 font-medium">
          {hookLine}
          {hookLine.length < (post.content.split('\n')[0]?.length ?? 0) ? '…' : ''}
        </p>
      </button>

      {/* Tooltip rendered via portal to avoid overflow/overlap issues */}
      {showTooltip && tooltipPos && typeof document !== 'undefined' &&
        createPortal(
          <div
            onMouseEnter={() => clearTimer()}
            onMouseLeave={handleMouseLeave}
            className="fixed z-[9999] w-[340px] bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: Math.min(tooltipPos.top, window.innerHeight - 420),
              left: tooltipPos.left,
            }}
          >
            {/* Header */}
            <div className="px-4 pt-3.5 pb-2 flex items-center justify-between border-b border-border">
              <p className="font-sans text-[12px] text-muted-foreground">
                {dateLabel}
              </p>
              <span
                className={`font-sans text-[10px] px-2 py-0.5 rounded-full font-medium ${statusInfo.cls}`}
              >
                {statusInfo.label}
              </span>
            </div>

            {/* Post content — LinkedIn style */}
            <div className="px-4 py-3 max-h-[280px] overflow-y-auto">
              <p className="font-sans text-[13px] text-foreground leading-[1.7] whitespace-pre-line">
                {post.content.length > 500
                  ? post.content.slice(0, 500) + '…'
                  : post.content}
              </p>
            </div>

            {/* Stats (published only) */}
            {hasStats && (
              <div className="px-4 py-2 border-t border-border flex items-center gap-3 text-[11px] text-muted-foreground">
                {(post.impressions ?? 0) > 0 && (
                  <span>{(post.impressions ?? 0).toLocaleString()} impressions</span>
                )}
                {(post.likes ?? 0) > 0 && <span>· {post.likes} reactions</span>}
                {(post.comments ?? 0) > 0 && <span>· {post.comments} comments</span>}
              </div>
            )}

            {/* LinkedIn action bar */}
            <div className="px-4 py-2.5 border-t border-border flex items-center justify-around text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12"/><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"/></svg>
                Like
              </span>
              <span className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
                Comment
              </span>
              <span className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/></svg>
                Repost
              </span>
              <span className="flex items-center gap-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9"/></svg>
                Send
              </span>
            </div>
          </div>,
          document.body
        )}
    </>
  )
}
