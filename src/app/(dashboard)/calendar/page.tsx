'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns'
import { ChevronLeft, ChevronRight, PanelLeftOpen } from 'lucide-react'
import { toast } from 'sonner'
import { CalendarWeekGrid } from '@/components/dashboard/CalendarWeekGrid'
import { CalendarMonthGrid } from '@/components/dashboard/CalendarMonthGrid'
import {
  UnscheduledDraftsList,
  type DraftItem,
} from '@/components/dashboard/UnscheduledDraftsList'
import { EventPopover } from '@/components/dashboard/EventPopover'
import type { CalendarPost } from '@/components/dashboard/CalendarEventBlock'

type ViewMode = 'week' | 'month'

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week')
  const [anchor, setAnchor] = useState(new Date())
  const [posts, setPosts] = useState<CalendarPost[]>([])
  const [drafts, setDrafts] = useState<DraftItem[]>([])
  const [showSidebar, setShowSidebar] = useState(true)
  const [selected, setSelected] = useState<CalendarPost | null>(null)

  const weekStart = useMemo(
    () => startOfWeek(anchor, { weekStartsOn: 1 }),
    [anchor]
  )

  const range = useMemo(() => {
    if (view === 'week') {
      return {
        start: weekStart,
        end: endOfWeek(anchor, { weekStartsOn: 1 }),
      }
    }
    return {
      start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
    }
  }, [view, anchor, weekStart])

  const loadPosts = useCallback(async () => {
    const start = format(range.start, 'yyyy-MM-dd')
    const end = format(range.end, 'yyyy-MM-dd')
    const res = await fetch(`/api/dashboard/calendar?start=${start}&end=${end}`)
    const data = await res.json()
    setPosts(data.posts ?? [])
  }, [range])

  const loadDrafts = useCallback(async () => {
    const res = await fetch('/api/dashboard/drafts')
    const data = await res.json()
    setDrafts(data.drafts ?? [])
  }, [])

  useEffect(() => {
    loadPosts()
  }, [loadPosts])

  useEffect(() => {
    loadDrafts()
  }, [loadDrafts])

  async function handleDropDraft(draftId: string, when: Date) {
    // Optimistic: remove from drafts, insert into posts
    const draft = drafts.find((d) => d.id === draftId)
    if (!draft) return
    setDrafts((prev) => prev.filter((d) => d.id !== draftId))
    setPosts((prev) => [
      ...prev,
      {
        id: draft.id,
        content: draft.content,
        status: 'scheduled',
        hook_type: draft.hook_type ?? null,
        content_pillar: draft.content_pillar ?? null,
        scheduled_at: when.toISOString(),
        published_at: null,
        created_at: draft.created_at ?? new Date().toISOString(),
      },
    ])
    try {
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: draftId, scheduledAt: when.toISOString() }),
      })
    } catch {
      // refetch on failure
      loadPosts()
      loadDrafts()
    }
  }

  async function handleDelete(postId: string) {
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    setSelected(null)
    await fetch('/api/posts/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    })
    loadDrafts()
  }

  function handleReschedule(postId: string) {
    handleUnschedule(postId)
  }

  async function handleMovePost(postId: string, when: Date) {
    // Optimistic: update the post's scheduled_at in local state
    setPosts((prev) =>
      prev.map((p) =>
        p.id === postId
          ? { ...p, scheduled_at: when.toISOString() }
          : p
      )
    )
    try {
      await fetch('/api/posts/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId,
          scheduled_at: when.toISOString(),
        }),
      })
      // Also update the scheduled_posts table
      await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, scheduledAt: when.toISOString() }),
      })
      toast.success(`Moved to ${format(when, 'EEE, MMM d · h:mm a')}`)
    } catch {
      loadPosts()
      toast.error('Failed to move post')
    }
  }

  async function handleUnschedule(postId: string) {
    const post = posts.find((p) => p.id === postId)
    if (post?.status === 'published') return // Can't unschedule published posts

    // Optimistic: remove from calendar, add to drafts
    setPosts((prev) => prev.filter((p) => p.id !== postId))
    if (post) {
      setDrafts((prev) => [
        ...prev,
        {
          id: post.id,
          content: post.content,
          hook_type: post.hook_type,
          content_pillar: post.content_pillar,
          created_at: post.created_at,
        },
      ])
    }
    setSelected(null)
    try {
      await fetch('/api/posts/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, status: 'draft', scheduled_at: null }),
      })
      toast.success('Moved back to drafts')
    } catch {
      loadPosts()
      loadDrafts()
      toast.error('Failed to unschedule')
    }
  }

  function prev() {
    setAnchor(view === 'week' ? subWeeks(anchor, 1) : subMonths(anchor, 1))
  }
  function next() {
    setAnchor(view === 'week' ? addWeeks(anchor, 1) : addMonths(anchor, 1))
  }
  function handleSwipe(direction: 'left' | 'right') {
    // Swipe left = go forward (next), swipe right = go backward (prev)
    if (direction === 'left') next()
    else prev()
  }

  const tz =
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'local'

  const rangeLabel =
    view === 'week'
      ? `${format(weekStart, 'MMM d')} – ${format(addDays(weekStart, 6), 'MMM d, yyyy')}`
      : format(anchor, 'MMMM yyyy')

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          {!showSidebar && (
            <button
              onClick={() => setShowSidebar(true)}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Show drafts"
            >
              <PanelLeftOpen size={16} />
            </button>
          )}
          <div>
            <h1 className="font-sans text-[18px] text-foreground leading-none">
              Calendar
            </h1>
            <p className="text-[11px] text-muted-foreground mt-1 font-sans">
              {posts.filter((p) => p.status === 'scheduled').length} scheduled · tz: {tz}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-secondary rounded-md p-0.5">
            {(['week', 'month'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                className={`font-sans text-[11px] px-3 py-1 rounded transition-colors ${
                  view === m
                    ? 'bg-card text-foreground'
                    : 'text-muted-foreground hover:text-muted-foreground'
                }`}
              >
                {m === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={prev}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-sans text-[12px] text-muted-foreground min-w-[180px] text-center">
              {rangeLabel}
            </span>
            <button
              onClick={next}
              className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => setAnchor(new Date())}
            className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground hover:bg-accent transition-colors"
          >
            Today
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {showSidebar && (
          <UnscheduledDraftsList
            drafts={drafts}
            onHide={() => setShowSidebar(false)}
            onUnschedule={handleUnschedule}
          />
        )}
        {view === 'week' ? (
          <CalendarWeekGrid
            weekStart={weekStart}
            posts={posts}
            onEventClick={setSelected}
            onDropDraft={handleDropDraft}
            onMovePost={handleMovePost}
            onSwipe={handleSwipe}
          />
        ) : (
          <CalendarMonthGrid
            month={anchor}
            posts={posts}
            onEventClick={setSelected}
            onDropDraft={handleDropDraft}
            onMovePost={handleMovePost}
            onSwipe={handleSwipe}
          />
        )}
      </div>

      <EventPopover
        post={selected}
        onClose={() => setSelected(null)}
        onDelete={handleDelete}
        onReschedule={handleReschedule}
      />
    </div>
  )
}
