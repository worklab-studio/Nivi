'use client'

import { useEffect, useRef } from 'react'
import {
  endOfMonth,
  endOfWeek,
  eachDayOfInterval,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { toast } from 'sonner'
import type { CalendarPost } from './CalendarEventBlock'

interface Props {
  month: Date
  posts: CalendarPost[]
  onEventClick: (post: CalendarPost) => void
  onDropDraft?: (draftId: string, when: Date) => void
  onMovePost?: (postId: string, when: Date) => void
  onSwipe?: (direction: 'left' | 'right') => void
}

export function CalendarMonthGrid({
  month,
  posts,
  onEventClick,
  onDropDraft,
  onMovePost,
  onSwipe,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wheelAccum = useRef(0)
  const wheelTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trackpad swipe
  useEffect(() => {
    const el = containerRef.current
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

  const now = new Date()
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  function postsForDay(day: Date) {
    return posts.filter((p) => {
      const when = p.scheduled_at ?? p.published_at
      if (!when) return false
      return isSameDay(new Date(when), day)
    })
  }

  function handleDrop(e: React.DragEvent, day: Date) {
    e.preventDefault()
    const data = e.dataTransfer.getData('text/plain')
    if (!data) return
    const when = new Date(startOfDay(day).getTime())
    when.setHours(9, 0, 0, 0)

    if (isBefore(when, now)) {
      toast.error("Can't schedule in the past")
      return
    }

    if (data.startsWith('scheduled:')) {
      const postId = data.replace('scheduled:', '')
      onMovePost?.(postId, when)
    } else {
      onDropDraft?.(data, when)
    }
  }

  function handleDragOver(e: React.DragEvent, day: Date) {
    e.preventDefault()
    const dayEnd = new Date(startOfDay(day).getTime())
    dayEnd.setHours(23, 59, 59, 999)
    if (isBefore(dayEnd, now)) {
      e.dataTransfer.dropEffect = 'none'
    } else {
      e.dataTransfer.dropEffect = 'move'
    }
  }

  return (
    <div ref={containerRef} className="flex-1 overflow-auto p-4">
      <div className="grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="font-sans text-[10px] text-muted-foreground text-center py-2"
          >
            {d}
          </div>
        ))}
        {days.map((day) => {
          const inMonth = isSameMonth(day, month)
          const today = isToday(day)
          const past = isBefore(day, startOfDay(now)) && !today
          const dayPosts = postsForDay(day)
          return (
            <div
              key={day.toISOString()}
              onDrop={(e) => handleDrop(e, day)}
              onDragOver={(e) => handleDragOver(e, day)}
              className={`border rounded min-h-[90px] p-2 transition-colors ${
                today
                  ? 'bg-accent border-primary/40'
                  : past
                    ? 'bg-muted/30 border-border'
                    : 'bg-card border-border hover:bg-secondary/30'
              }`}
            >
              <p
                className={`font-sans text-[11px] ${
                  today
                    ? 'text-primary font-semibold'
                    : inMonth
                      ? 'text-muted-foreground'
                      : 'text-muted-foreground/50'
                }`}
              >
                {format(day, 'd')}
              </p>
              <div className="space-y-1 mt-1">
                {dayPosts.slice(0, 3).map((p) => {
                  const isDraggable = p.status !== 'published'
                  return (
                    <button
                      key={p.id}
                      onClick={() => onEventClick(p)}
                      draggable={isDraggable}
                      onDragStart={
                        isDraggable
                          ? (e) => {
                              e.dataTransfer.setData(
                                'text/plain',
                                `scheduled:${p.id}`
                              )
                              e.dataTransfer.effectAllowed = 'move'
                            }
                          : undefined
                      }
                      className={`w-full text-left text-[10px] truncate text-muted-foreground hover:text-foreground ${
                        isDraggable ? 'cursor-grab active:cursor-grabbing' : ''
                      }`}
                    >
                      {format(
                        new Date((p.scheduled_at ?? p.published_at) as string),
                        'HH:mm'
                      )}{' '}
                      {p.content.slice(0, 22)}
                    </button>
                  )
                })}
                {dayPosts.length > 3 && (
                  <p className="font-sans text-[9px] text-muted-foreground">
                    +{dayPosts.length - 3} more
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
