'use client'

import { PostCard, type Post } from './PostCard'

interface Props {
  posts: Post[]
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onPostClick: (post: Post) => void
}

const COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: 'text-muted-foreground' },
  { key: 'scheduled', label: 'Scheduled', color: 'text-amber-600' },
  { key: 'published', label: 'Published', color: 'text-emerald-600' },
]

export function PostKanbanView({ posts, onDelete, onDuplicate, onPostClick }: Props) {
  return (
    <div className="grid grid-cols-3 gap-4 min-h-[400px]">
      {COLUMNS.map((col) => {
        const colPosts = posts.filter((p) => p.status === col.key)
        return (
          <div
            key={col.key}
            className="bg-secondary/30 border border-border rounded-xl p-3 flex flex-col"
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <span className={`text-[13px] font-semibold ${col.color}`}>
                {col.label}
              </span>
              <span className="text-[11px] text-muted-foreground tabular-nums bg-secondary rounded-full px-2 py-0.5">
                {colPosts.length}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 space-y-2 overflow-y-auto">
              {colPosts.length === 0 ? (
                <p className="text-[12px] text-muted-foreground text-center py-8">
                  No {col.label.toLowerCase()} posts
                </p>
              ) : (
                colPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onPostClick={onPostClick}
                    compact
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
