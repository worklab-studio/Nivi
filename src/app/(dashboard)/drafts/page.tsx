'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NiviMessage } from '@/components/nivi/NiviMessage'
import { PostStatusBadge } from '@/components/dashboard/PostStatusBadge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { format } from 'date-fns'

interface Draft {
  id: string
  content: string
  hook_type: string | null
  content_pillar: number | null
  created_at: string
}

export default function DraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  useEffect(() => {
    fetch('/api/dashboard/drafts')
      .then((r) => r.json())
      .then((d) => setDrafts(d.drafts ?? []))
      .catch(() => {})
  }, [])

  const handlePostNow = async (postId: string) => {
    await fetch('/api/posts/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    })
    setDrafts((prev) => prev.filter((d) => d.id !== postId))
  }

  const handleSchedule = async (postId: string, time: string) => {
    const now = new Date()
    let scheduledAt: Date

    switch (time) {
      case '1h': scheduledAt = new Date(now.getTime() + 3600000); break
      case '3pm': scheduledAt = new Date(now); scheduledAt.setHours(15, 0, 0, 0); break
      case '6pm': scheduledAt = new Date(now); scheduledAt.setHours(18, 0, 0, 0); break
      case 'tomorrow': scheduledAt = new Date(now); scheduledAt.setDate(scheduledAt.getDate() + 1); scheduledAt.setHours(9, 0, 0, 0); break
      default: scheduledAt = new Date(now.getTime() + 3600000)
    }

    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, scheduledAt: scheduledAt.toISOString() }),
    })
    setDrafts((prev) => prev.filter((d) => d.id !== postId))
  }

  const handleSaveEdit = async (postId: string) => {
    await fetch('/api/posts/update', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, content: editContent }),
    })
    setDrafts((prev) =>
      prev.map((d) => (d.id === postId ? { ...d, content: editContent } : d))
    )
    setEditingId(null)
  }

  const handleRegenerate = async (postId: string) => {
    const res = await fetch('/api/generate', { method: 'POST' })
    const data = await res.json()
    if (data.post) {
      setDrafts((prev) =>
        prev.map((d) => (d.id === postId ? { ...d, content: data.post.content } : d))
      )
    }
  }

  const handleDelete = async (postId: string) => {
    await fetch('/api/posts/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    })
    setDrafts((prev) => prev.filter((d) => d.id !== postId))
  }

  if (drafts.length === 0) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="font-sans text-2xl font-medium text-foreground">Drafts</h1>
          <p className="font-sans text-xs text-muted-foreground mt-1 tracking-wider uppercase">Your unpublished posts</p>
        </div>
        <NiviMessage
          message="No drafts right now. Send me an idea on WhatsApp and I'll write one for you."
          timestamp="now"
        />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="font-sans text-2xl font-medium text-foreground">Drafts</h1>
        <p className="font-sans text-xs text-muted-foreground mt-1 tracking-wider uppercase">
          {drafts.length} draft{drafts.length !== 1 ? 's' : ''} ready
        </p>
      </div>

      <div className="space-y-4">
        {drafts.map((draft) => {
          const isExpanded = expandedId === draft.id
          const isEditing = editingId === draft.id
          return (
            <div
              key={draft.id}
              className="bg-card border border-border rounded-lg p-5 hover:border-border transition-colors"
            >
              {isEditing ? (
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={10}
                    className="w-full bg-secondary border border-border rounded-md px-4 py-3 text-foreground text-[14px] font-sans leading-[1.8] focus:outline-none focus:border-border resize-none"
                  />
                  <p className="font-sans text-[10px] text-muted-foreground mt-1">
                    {editContent.length} characters
                  </p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleSaveEdit(draft.id)}
                      className="font-sans text-[11px] px-3 py-1.5 bg-white text-black rounded-md hover:bg-white/90 transition-colors"
                    >
                      Save changes
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                    className="text-left w-full"
                  >
                    <p className="font-sans text-[14px] text-muted-foreground leading-[1.8]">
                      {isExpanded
                        ? draft.content
                        : `${draft.content.slice(0, 200)}${draft.content.length > 200 ? '...' : ''}`}
                    </p>
                  </button>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-sans text-[10px] text-muted-foreground">
                        {format(new Date(draft.created_at), 'MMM d, h:mm a')}
                      </span>
                      {draft.content_pillar && (
                        <span className="font-sans text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                          P{draft.content_pillar}
                        </span>
                      )}
                      {draft.hook_type && (
                        <span className="font-sans text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                          {draft.hook_type}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/compose?draft=${draft.id}`}
                        className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground hover:bg-accent transition-colors"
                      >
                        Continue editing
                      </Link>
                      <button
                        onClick={() => handlePostNow(draft.id)}
                        className="font-sans text-[11px] px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition-opacity"
                      >
                        Post now
                      </button>
                      <Popover>
                        <PopoverTrigger className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors">
                          Schedule
                        </PopoverTrigger>
                        <PopoverContent className="w-48 bg-accent border-border p-2">
                          <p className="font-sans text-[10px] text-muted-foreground mb-2">
                            Schedule for:
                          </p>
                          {[
                            { label: 'In 1 hour', value: '1h' },
                            { label: 'Today 3PM', value: '3pm' },
                            { label: 'Today 6PM', value: '6pm' },
                            { label: 'Tomorrow 9AM', value: 'tomorrow' },
                          ].map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() => handleSchedule(draft.id, opt.value)}
                              className="block w-full text-left font-sans text-[11px] px-2 py-1.5 rounded text-muted-foreground hover:bg-secondary hover:text-white transition-colors"
                            >
                              {opt.label}
                            </button>
                          ))}
                        </PopoverContent>
                      </Popover>
                      <button
                        onClick={() => {
                          setEditingId(draft.id)
                          setEditContent(draft.content)
                        }}
                        className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRegenerate(draft.id)}
                        className="font-sans text-[11px] px-2 py-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        ↻
                      </button>
                      <button
                        onClick={() => handleDelete(draft.id)}
                        className="font-sans text-[11px] px-2 py-1.5 text-destructive/60 hover:text-destructive transition-colors"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
