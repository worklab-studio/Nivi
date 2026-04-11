'use client'

import { format } from 'date-fns'
import { Copy, Trash2 } from 'lucide-react'
import { PostStatusBadge } from '@/components/dashboard/PostStatusBadge'
import type { Post } from './PostCard'

interface Props {
  posts: Post[]
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onPostClick: (post: Post) => void
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

export function PostListView({ posts, onDelete, onDuplicate, onPostClick }: Props) {
  if (posts.length === 0) return null

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead className="border-b border-border bg-secondary/30">
          <tr>
            <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[90px]">
              Date
            </th>
            <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
              Content
            </th>
            <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[60px]">
              Pillar
            </th>
            <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[80px]">
              Status
            </th>
            <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[70px]">
              Impr.
            </th>
            <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[60px]">
              Likes
            </th>
            <th className="text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[60px]">
              Eng %
            </th>
            <th className="w-[80px] px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {posts.map((post) => {
            const date = post.published_at ?? post.created_at
            const isPublished = post.status === 'published'
            return (
              <tr
                key={post.id}
                onClick={() => onPostClick(post)}
                className="group hover:bg-secondary/30 cursor-pointer"
              >
                <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                  {format(new Date(date), 'MMM d')}
                </td>
                <td className="px-4 py-3 text-[13px] text-foreground line-clamp-1">
                  {post.content.slice(0, 120)}
                </td>
                <td className="px-4 py-3 text-[11px] text-muted-foreground">
                  {post.content_pillar ? `P${post.content_pillar}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <PostStatusBadge status={post.status} />
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground text-right tabular-nums">
                  {isPublished ? fmt(post.impressions) : '—'}
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground text-right tabular-nums">
                  {isPublished ? fmt(post.likes) : '—'}
                </td>
                <td className="px-4 py-3 text-[12px] text-muted-foreground text-right tabular-nums">
                  {isPublished ? `${post.engagement_rate}%` : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); onDuplicate(post.id) }}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground"
                      title="Duplicate"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (confirm('Delete this post?')) onDelete(post.id)
                      }}
                      className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"
                      title="Delete"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
