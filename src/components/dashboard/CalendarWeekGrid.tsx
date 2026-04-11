'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { addDays, format, isBefore, isSameDay, isToday, startOfDay } from 'date-fns'
import { CalendarEventBlock, type CalendarPost } from './CalendarEventBlock'
import { toast } from 'sonner'

const HOUR_START = 0
const HOUR_END = 23 // Full 24 hours
const ROW_HEIGHT = 72 // px
const SNAP_MINUTES = 15 // 15-minute intervals
const SNAPS_PER_HOUR = 60 / SNAP_MINUTES // 4
const SNAP_HEIGHT = ROW_HEIGHT / SNAPS_PER_HOUR // 18px per snap zone

interface Props {
  weekStart: Date // a Monday
  posts: CalendarPost[]
  onEventClick: (post: CalendarPost) => void
  onDropDraft: (draftId: string, when: Date) => void
  onMovePost?: (postId: string, when: Date) => void
  onSwipe?: (direction: 'left' | 'right') => void
}

export function CalendarWeekGrid({
  weekStart,
  posts,
  onEventClick,
  onDropDraft,
  onMovePost,
  onSwipe,
}: Props) {
  const [now, setNow] = useState(new Date())
  const scrollRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const wheelAccum = useRef(0)
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track which cell + snap quarter is being hovered during drag
  const [dragTarget, setDragTarget] = useState<{
    dayIdx: number
    hour: number
    quarter: number // 0-3 (0=:00, 1=:15, 2=:30, 3=:45)
  } | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  // Auto-scroll to current time on mount
  useEffect(() => {
    if (!scrollRef.current) return
    const currentHour = new Date().getHours()
    if (currentHour >= HOUR_START && currentHour <= HOUR_END) {
      const scrollTop = (currentHour - HOUR_START) * ROW_HEIGHT - 120
      scrollRef.current.scrollTop = Math.max(0, scrollTop)
    }
  }, [])

  // Trackpad horizontal swipe (two-finger)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onSwipe) return

    function handleWheel(e: WheelEvent) {
      if (Math.abs(e.deltaX) < 30 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5) return
      wheelAccum.current += e.deltaX
      if (wheelTimeout.current) clearTimeout(wheelTimeout.current)
      wheelTimeout.current = setTimeout(() => {
        if (Math.abs(wheelAccum.current) > 100) {
          onSwipe!(wheelAccum.current > 0 ? 'left' : 'right')
        }
        wheelAccum.current = 0
      }, 150)
    }

    el.addEventListener('wheel', handleWheel, { passive: true })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [onSwipe])

  // Touch swipe for mobile
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !onSwipe) return

    function handleTouchStart(e: TouchEvent) {
      if (e.touches.length === 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        }
      }
    }

    function handleTouchEnd(e: TouchEvent) {
      if (!touchStartRef.current || e.changedTouches.length !== 1) return
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const dy = e.changedTouches[0].clientY - touchStartRef.current.y
      touchStartRef.current = null
      if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy) * 2) {
        onSwipe!(dx < 0 ? 'left' : 'right')
      }
    }

    el.addEventListener('touchstart', handleTouchStart, { passive: true })
    el.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', handleTouchStart)
      el.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onSwipe])

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from(
    { length: HOUR_END - HOUR_START + 1 },
    (_, i) => HOUR_START + i
  )

  const todayIndex = days.findIndex((d) => isToday(d))

  function postsForCell(day: Date, hour: number) {
    return posts.filter((p) => {
      const when = p.scheduled_at ?? p.published_at
      if (!when) return false
      const d = new Date(when)
      return isSameDay(d, day) && d.getHours() === hour
    })
  }

  function isInPast(day: Date, hour: number, minute = 0): boolean {
    const cellTime = new Date(startOfDay(day).getTime())
    cellTime.setHours(hour, minute + SNAP_MINUTES - 1, 59, 999)
    return isBefore(cellTime, now)
  }

  /** Get the 15-minute snap quarter from the mouse Y position within a cell */
  const getQuarter = useCallback((e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const y = e.clientY - rect.top
    return Math.min(SNAPS_PER_HOUR - 1, Math.max(0, Math.floor(y / SNAP_HEIGHT)))
  }, [])

  function handleDrop(e: React.DragEvent, day: Date, hour: number) {
    e.preventDefault()
    setDragTarget(null)
    const data = e.dataTransfer.getData('text/plain')
    if (!data) return

    const quarter = getQuarter(e)
    const minutes = quarter * SNAP_MINUTES
    const when = new Date(startOfDay(day).getTime())
    when.setHours(hour, minutes, 0, 0)

    if (isBefore(when, now)) {
      toast.error("Can't schedule in the past")
      return
    }

    if (data.startsWith('scheduled:')) {
      const postId = data.replace('scheduled:', '')
      onMovePost?.(postId, when)
    } else {
      onDropDraft(data, when)
    }
  }

  function handleDragOver(e: React.DragEvent, dayIdx: number, day: Date, hour: number) {
    e.preventDefault()
    const quarter = getQuarter(e)
    const minutes = quarter * SNAP_MINUTES

    if (isInPast(day, hour, minutes)) {
      e.dataTransfer.dropEffect = 'none'
      setDragTarget(null)
    } else {
      e.dataTransfer.dropEffect = 'move'
      setDragTarget({ dayIdx, hour, quarter })
    }
  }

  function handleDragLeave() {
    setDragTarget(null)
  }

  // Current time position
  const nowHour = now.getHours()
  const nowInRange = nowHour >= HOUR_START && nowHour <= HOUR_END
  const [headerHeight, setHeaderHeight] = useState(54)

  useEffect(() => {
    if (headerRef.current) {
      setHeaderHeight(headerRef.current.offsetHeight)
    }
  }, [])

  const nowTopPx = nowInRange
    ? (nowHour - HOUR_START) * ROW_HEIGHT +
      (now.getMinutes() / 60) * ROW_HEIGHT +
      headerHeight
    : null

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto bg-background relative">
      <div
        className="grid relative"
        style={{ gridTemplateColumns: '60px repeat(7, minmax(120px, 1fr))' }}
      >
        {/* Header row */}
        <div ref={headerRef} className="sticky top-0 z-30 bg-card border-b border-r border-border" />
        {days.map((day) => {
          const today = isToday(day)
          return (
            <div
              key={day.toISOString()}
              className={`sticky top-0 z-30 border-b border-r border-border px-3 py-2 ${
                today ? 'bg-accent' : 'bg-card'
              }`}
            >
              <p className="font-sans text-[10px] text-muted-foreground uppercase">
                {format(day, 'EEE')}
              </p>
              <p
                className={`font-sans text-[16px] ${
                  today
                    ? 'text-primary font-semibold'
                    : 'text-muted-foreground'
                }`}
              >
                {format(day, 'd')}
              </p>
            </div>
          )
        })}

        {/* Hour rows */}
        {hours.map((hour) => (
          <div key={hour} className="contents">
            <div
              className="border-b border-r border-border px-2 py-1 bg-card text-right"
              style={{ height: ROW_HEIGHT }}
            >
              <span className="font-sans text-[10px] text-muted-foreground">
                {String(hour).padStart(2, '0')}:00
              </span>
            </div>
            {days.map((day, dayIdx) => {
              const cellPosts = postsForCell(day, hour)
              const today = isToday(day)
              const past = isInPast(day, hour)
              const isSnapTarget = dragTarget?.dayIdx === dayIdx && dragTarget?.hour === hour

              return (
                <div
                  key={`${day.toISOString()}-${hour}`}
                  onDrop={(e) => handleDrop(e, day, hour)}
                  onDragOver={(e) => handleDragOver(e, dayIdx, day, hour)}
                  onDragLeave={handleDragLeave}
                  className={`relative border-b border-r border-border transition-colors ${
                    past
                      ? 'bg-muted/30'
                      : today
                        ? 'bg-accent/30 hover:bg-secondary/40'
                        : 'hover:bg-secondary/40'
                  }`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Snap indicator — shows which 15-min slot the user is hovering */}
                  {isSnapTarget && dragTarget && (
                    <div className="absolute left-0 right-0 pointer-events-none z-[5] transition-all duration-75">
                      <div
                        className="absolute left-1 right-1 rounded-md bg-primary/15 border border-primary/40 flex items-center justify-center"
                        style={{
                          top: dragTarget.quarter * SNAP_HEIGHT,
                          height: SNAP_HEIGHT,
                        }}
                      >
                        <span className="font-sans text-[9px] font-medium text-primary/70">
                          {String(hour).padStart(2, '0')}:{String(dragTarget.quarter * SNAP_MINUTES).padStart(2, '0')}
                        </span>
                      </div>
                    </div>
                  )}

                  {cellPosts.map((p) => (
                    <CalendarEventBlock
                      key={p.id}
                      post={p}
                      onClick={() => onEventClick(p)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Current time red line — spans full width, positioned absolutely */}
      {nowTopPx !== null && todayIndex >= 0 && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: nowTopPx }}
        >
          {/* Time label on left gutter */}
          <div
            className="absolute font-sans text-[9px] font-medium text-red-500 bg-red-500 text-white px-1 py-px rounded-sm"
            style={{ left: 4, top: -7 }}
          >
            {format(now, 'HH:mm')}
          </div>
          {/* Red line across the full row */}
          <div className="h-[2px] bg-red-500 ml-[60px]" />
          {/* Red dot at today's column start */}
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-red-500"
            style={{
              left: `calc(60px + ${todayIndex} * ((100% - 60px) / 7))`,
              top: -4,
            }}
          />
        </div>
      )}
    </div>
  )
}
