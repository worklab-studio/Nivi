'use client'

import { useState } from 'react'
import Link from 'next/link'
import { GripVertical, Pencil } from 'lucide-react'

export interface DraftItem {
  id: string
  content: string
  hook_type?: string | null
  content_pillar?: number | null
  created_at?: string
}

interface Props {
  drafts: DraftItem[]
  onHide?: () => void
  onUnschedule?: (postId: string) => void
}

export function UnscheduledDraftsList({ drafts, onHide, onUnschedule }: Props) {
  const [dragOver, setDragOver] = useState(false)

  function handleDragStart(e: React.DragEvent, draftId: string) {
    e.dataTransfer.setData('text/plain', draftId)
    e.dataTransfer.effectAllowed = 'move'
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const data = e.dataTransfer.getData('text/plain')
    if (!data) return
    if (data.startsWith('scheduled:')) {
      const postId = data.replace('scheduled:', '')
      onUnschedule?.(postId)
    }
  }

  function handleDragOver(e: React.DragEvent) {
    const data = e.dataTransfer.types.includes('text/plain')
    if (!data) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  return (
    <aside
      className={`w-[280px] shrink-0 border-r bg-card flex flex-col h-full transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border'
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-sans text-[14px] text-foreground">
            Unscheduled posts ({drafts.length})
          </h2>
          <p className="font-sans text-[10px] text-muted-foreground mt-0.5">
            Drag posts to calendar or drop here to unschedule
          </p>
        </div>
        {onHide && (
          <button
            onClick={onHide}
            className="font-sans text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Hide
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {dragOver && (
          <div className="border-2 border-dashed border-primary/40 rounded-md p-4 text-center">
            <p className="font-sans text-[11px] text-primary">
              Drop here to unschedule
            </p>
          </div>
        )}
        {drafts.length === 0 && !dragOver ? (
          <p className="font-sans text-[11px] text-muted-foreground text-center mt-6">
            No unscheduled drafts
          </p>
        ) : (
          drafts.map((d) => {
            const title = d.content.slice(0, 40).trim()
            const preview = d.content.slice(40, 120).trim()
            return (
              <div
                key={d.id}
                draggable
                onDragStart={(e) => handleDragStart(e, d.id)}
                className="group bg-secondary border border-border rounded-md p-3 cursor-grab active:cursor-grabbing hover:border-border transition-colors"
              >
                <div className="flex items-start gap-2">
                  <GripVertical
                    size={12}
                    className="text-muted-foreground mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-[12px] text-foreground leading-snug line-clamp-2">
                      {title}
                      {d.content.length > 40 ? '…' : ''}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-sans text-[9px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                        Draft
                      </span>
                      <Link
                        href={`/compose?draft=${d.id}`}
                        className="font-sans text-[9px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors flex items-center gap-0.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Pencil size={8} />
                        Edit
                      </Link>
                    </div>
                    {preview && (
                      <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2">
                        &quot;{preview}…&quot;
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
