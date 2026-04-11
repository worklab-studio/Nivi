'use client'

import { useState } from 'react'
import {
  Mic,
  FileText,
  MessageSquare,
  StickyNote,
  Video,
  Sparkles,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface KnowledgeChunk {
  id: string
  source_type: string
  source_title: string | null
  raw_content: string | null
  extracted_insights: unknown
  created_at: string
}

interface SourceTypeMeta {
  Icon: LucideIcon
  label: string
  iconClass: string
  bgClass: string
}

const SOURCE_META: Record<string, SourceTypeMeta> = {
  transcript: {
    Icon: Mic,
    label: 'Transcript',
    iconClass: 'text-violet-600',
    bgClass: 'bg-violet-500/10',
  },
  article: {
    Icon: FileText,
    label: 'Article',
    iconClass: 'text-blue-600',
    bgClass: 'bg-blue-500/10',
  },
  post: {
    Icon: MessageSquare,
    label: 'Post',
    iconClass: 'text-emerald-600',
    bgClass: 'bg-emerald-500/10',
  },
  note: {
    Icon: StickyNote,
    label: 'Note',
    iconClass: 'text-amber-600',
    bgClass: 'bg-amber-500/10',
  },
  video: {
    Icon: Video,
    label: 'Video',
    iconClass: 'text-pink-600',
    bgClass: 'bg-pink-500/10',
  },
}

function getInsights(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string')
  }
  return []
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
  chunk: KnowledgeChunk
  onDelete: () => void
}

export function SourceCard({ chunk, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const meta = SOURCE_META[chunk.source_type] ?? SOURCE_META.note
  const insights = getInsights(chunk.extracted_insights)
  const wordCount = (chunk.raw_content ?? '').split(/\s+/).filter(Boolean).length
  const preview = insights.slice(0, 3)
  const hasMore = insights.length > 3

  return (
    <div className="group relative bg-card border border-border rounded-xl p-4 flex flex-col transition-colors hover:border-primary/40">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${meta.bgClass}`}
        >
          <meta.Icon size={15} className={meta.iconClass} />
        </div>
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-[14px] font-semibold text-foreground line-clamp-2 leading-snug">
            {chunk.source_title || 'Untitled'}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {meta.label}
            </span>
            <span className="text-[10px] text-muted-foreground/60">·</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {wordCount.toLocaleString()} words
            </span>
            <span className="text-[10px] text-muted-foreground/60">·</span>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {insights.length} insights
            </span>
            <span className="text-[10px] text-muted-foreground/60">·</span>
            <span className="text-[11px] text-muted-foreground">
              {formatDate(chunk.created_at)}
            </span>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm('Delete this source? This cannot be undone.')) {
              onDelete()
            }
          }}
          className="absolute top-3 right-3 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all"
          title="Delete source"
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <ul className="space-y-1.5">
            {(expanded ? insights : preview).map((insight, idx) => (
              <li
                key={idx}
                className="flex gap-2 text-[12.5px] text-foreground/90 leading-snug"
              >
                <Sparkles
                  size={11}
                  className="text-primary mt-1 shrink-0"
                />
                <span>{insight}</span>
              </li>
            ))}
          </ul>
          {hasMore && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {expanded ? (
                <>
                  <ChevronUp size={11} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={11} /> Show all {insights.length} insights
                </>
              )}
            </button>
          )}
        </div>
      )}

      {insights.length === 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground italic">
          No insights extracted yet
        </p>
      )}
    </div>
  )
}

export { SOURCE_META }
