'use client'

import { format } from 'date-fns'
import { Copy, Trash2 } from 'lucide-react'
import { PostStatusBadge } from '@/components/dashboard/PostStatusBadge'
import { toast } from 'sonner'

export interface Post {
  id: string
  content: string
  hook_type: string | null
  content_pillar: number | null
  status: string
  created_at: string
  published_at: string | null
  impressions: number
  likes: number
  comments: number
  engagement_rate: number
}

interface Props {
  post: Post
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onPostClick?: (post: Post) => void
  compact?: boolean
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

export function PostCard({
  post,
  onDelete,
  onDuplicate,
  onPostClick,
  compact = false,
}: Props) {
  const date = post.published_at ?? post.created_at
  const isPublished = post.status === 'published'

  return (
    <div
      onClick={() => onPostClick?.(post)}
      className="group relative bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors flex flex-col cursor-pointer"
    >
      {/* Top row: date + status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {format(new Date(date), 'MMM d, yyyy')}
        </span>
        <PostStatusBadge status={post.status} />
      </div>

      {/* Content preview */}
      <p
        className={`text-[13px] text-foreground leading-relaxed whitespace-pre-line flex-1 ${
          compact ? 'line-clamp-3' : 'line-clamp-5'
        }`}
      >
        {post.content}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {post.content_pillar && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
            P{post.content_pillar}
          </span>
        )}
        {post.hook_type && (
          <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
            {post.hook_type}
          </span>
        )}
        {isPublished && (
          <span className="text-[10px] text-muted-foreground tabular-nums ml-auto">
            {fmt(post.impressions)} imp · {fmt(post.likes)} likes · {post.comments} comments
          </span>
        )}
      </div>

      {/* Actions — hover visible */}
      <div className="absolute top-2 right-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate(post.id)
          }}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          title="Duplicate"
        >
          <Copy size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (confirm('Delete this post?')) onDelete(post.id)
          }}
          className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="Delete"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}
