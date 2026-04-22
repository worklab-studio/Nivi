'use client'

import { format } from 'date-fns'
import { ThumbsUp, MessageCircle, Repeat2, Send, Copy, Trash2 } from 'lucide-react'
import { PostStatusBadge } from '@/components/dashboard/PostStatusBadge'
import type { Post } from './PostCard'

interface Props {
  posts: Post[]
  authorName: string
  authorHeadline: string
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onPostClick: (post: Post) => void
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

export function PostLinkedInView({
  posts,
  authorName,
  authorHeadline,
  onDelete,
  onDuplicate,
  onPostClick,
}: Props) {
  return (
    <div className="max-w-[560px] mx-auto space-y-4">
      {posts.map((post) => {
        const date = post.published_at ?? post.created_at
        const isPublished = post.status === 'published'
        return (
          <div
            key={post.id}
            onClick={() => onPostClick(post)}
            className="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors cursor-pointer"
          >
            {/* Status badge overlay */}
            <div className="absolute top-3 right-3 z-10">
              <PostStatusBadge status={post.status} />
            </div>

            {/* Author header */}
            <div className="flex items-center gap-3 px-4 pt-4 pb-3">
              <div className="w-11 h-11 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[14px] font-semibold shrink-0">
                {authorName
                  .split(' ')
                  .map((s) => s[0])
                  .join('')
                  .slice(0, 2)
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-foreground">
                  {authorName}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {authorHeadline}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(new Date(date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>

            {/* Post body */}
            <div className="px-4 pb-3">
              <p className="text-[14px] text-foreground leading-[1.6] whitespace-pre-line">
                {post.content}
              </p>
            </div>

            {/* Image (LinkedIn-style full-width below text) */}
            {post.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={post.image_url}
                alt=""
                loading="lazy"
                className="w-full max-h-[480px] object-cover border-t border-border"
              />
            )}

            {/* Engagement bar */}
            {isPublished && (post.impressions > 0 || post.likes > 0) && (
              <div className="px-4 py-2 text-[11px] text-muted-foreground flex items-center gap-3">
                <span>{fmt(post.impressions)} impressions</span>
                <span>·</span>
                <span>{fmt(post.likes)} reactions</span>
                <span>·</span>
                <span>{post.comments} comments</span>
              </div>
            )}

            {/* LinkedIn action bar */}
            <div className="px-4 pt-2 pb-3 border-t border-border flex items-center justify-around text-muted-foreground">
              {[
                { Icon: ThumbsUp, label: 'Like' },
                { Icon: MessageCircle, label: 'Comment' },
                { Icon: Repeat2, label: 'Repost' },
                { Icon: Send, label: 'Send' },
              ].map(({ Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1 text-[12px]"
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {/* Actions — bottom bar */}
            <div className="px-4 py-2 border-t border-border bg-secondary/30 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => { e.stopPropagation(); onDuplicate(post.id) }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <Copy size={11} /> Duplicate
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  if (confirm('Delete this post?')) onDelete(post.id)
                }}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 ml-auto"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
