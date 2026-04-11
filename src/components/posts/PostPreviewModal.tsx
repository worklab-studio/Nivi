'use client'

import { format } from 'date-fns'
import { useRouter } from 'next/navigation'
import {
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Send,
  RefreshCw,
  Copy,
  Trash2,
  Loader2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { PostStatusBadge } from '@/components/dashboard/PostStatusBadge'
import { toast } from 'sonner'
import { useState } from 'react'
import type { Post } from './PostCard'

interface Props {
  post: Post | null
  onClose: () => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  authorName?: string
  authorHeadline?: string
  authorAvatarUrl?: string
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

export function PostPreviewModal({
  post,
  onClose,
  onDelete,
  onDuplicate,
  authorName = 'You',
  authorHeadline = '',
  authorAvatarUrl = '',
}: Props) {
  const router = useRouter()
  const [repurposing, setRepurposing] = useState(false)

  if (!post) return null

  const date = post.published_at ?? post.created_at
  const isPublished = post.status === 'published'
  const initials = authorName
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  async function handleRepurpose() {
    if (!post) return
    setRepurposing(true)
    try {
      const res = await fetch('/api/posts/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id }),
      })
      const data = await res.json()
      if (data.ok && data.post) {
        toast.success('Created new draft — opening in Compose')
        onClose()
        router.push(`/compose?draft=${data.post.id}`)
      } else {
        toast.error(data.error ?? 'Could not repurpose')
      }
    } catch {
      toast.error('Repurpose failed')
    } finally {
      setRepurposing(false)
    }
  }

  return (
    <Dialog open={!!post} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100vh-80px)] flex flex-col overflow-hidden p-0">
        {/* LinkedIn-style post card */}
        <div className="flex-1 overflow-y-auto">
          {/* Author header */}
          <div className="flex items-center gap-3 px-5 pt-5 pb-3">
            {authorAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={authorAvatarUrl}
                alt={authorName}
                width={48}
                height={48}
                className="w-12 h-12 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[15px] font-semibold shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground">
                {authorName}
              </p>
              {authorHeadline && (
                <p className="text-[12px] text-muted-foreground truncate">
                  {authorHeadline}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">
                {format(new Date(date), 'MMM d, yyyy · h:mm a')}
              </p>
            </div>
            <PostStatusBadge status={post.status} />
          </div>

          {/* Post body */}
          <div className="px-5 pb-4">
            <p className="text-[14px] text-foreground leading-[1.65] whitespace-pre-line">
              {post.content}
            </p>
          </div>

          {/* Engagement stats (published only) */}
          {isPublished && (post.impressions > 0 || post.likes > 0) && (
            <div className="px-5 py-2 text-[12px] text-muted-foreground flex items-center gap-3 border-t border-border">
              <span>{fmt(post.impressions)} impressions</span>
              <span>·</span>
              <span>{fmt(post.likes)} reactions</span>
              <span>·</span>
              <span>{post.comments} comments</span>
              {post.engagement_rate > 0 && (
                <>
                  <span>·</span>
                  <span>{post.engagement_rate}% engagement</span>
                </>
              )}
            </div>
          )}

          {/* LinkedIn action bar (visual) */}
          <div className="px-5 py-2.5 border-t border-border flex items-center justify-around text-muted-foreground">
            {[
              { Icon: ThumbsUp, label: 'Like' },
              { Icon: MessageCircle, label: 'Comment' },
              { Icon: Repeat2, label: 'Repost' },
              { Icon: Send, label: 'Send' },
            ].map(({ Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 text-[12px]"
              >
                <Icon size={15} />
                <span>{label}</span>
              </div>
            ))}
          </div>

          {/* Meta */}
          {(post.content_pillar || post.hook_type) && (
            <div className="px-5 py-3 border-t border-border flex items-center gap-2 flex-wrap">
              {post.content_pillar && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                  Pillar {post.content_pillar}
                </span>
              )}
              {post.hook_type && (
                <span className="text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {post.hook_type}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action footer */}
        <div className="shrink-0 px-5 py-3 border-t border-border bg-secondary/30 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onDuplicate(post.id)
                onClose()
              }}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              <Copy size={12} /> Duplicate
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this post?')) {
                  onDelete(post.id)
                  onClose()
                }
              }}
              className="text-[12px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} /> Delete
            </button>
          </div>

          <Button size="sm" onClick={handleRepurpose} disabled={repurposing}>
            {repurposing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            Repurpose as new post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
