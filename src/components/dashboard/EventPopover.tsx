'use client'

import Link from 'next/link'
import { format } from 'date-fns'
import { PostStatusBadge } from '@/components/dashboard/PostStatusBadge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { CalendarPost } from './CalendarEventBlock'

interface Props {
  post: CalendarPost | null
  onClose: () => void
  onDelete: (postId: string) => void
  onReschedule: (postId: string) => void
}

export function EventPopover({ post, onClose, onDelete, onReschedule }: Props) {
  return (
    <Sheet open={!!post} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="bg-card border-l border-border">
        <SheetHeader>
          <SheetTitle className="font-sans text-lg text-foreground">
            Post detail
          </SheetTitle>
        </SheetHeader>
        {post && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <PostStatusBadge status={post.status} />
              {post.hook_type && (
                <span className="font-sans text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                  {post.hook_type}
                </span>
              )}
              {(post.scheduled_at || post.published_at) && (
                <span className="font-sans text-[10px] text-muted-foreground">
                  {format(
                    new Date(
                      (post.published_at ?? post.scheduled_at) as string
                    ),
                    'MMM d, h:mm a'
                  )}
                </span>
              )}
            </div>

            <div className="font-sans text-[13px] text-muted-foreground leading-[1.8] whitespace-pre-wrap max-h-[400px] overflow-y-auto bg-secondary border border-border rounded-md p-3">
              {post.content}
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href={`/compose?draft=${post.id}`}
                className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground hover:bg-accent transition-colors"
              >
                Edit post
              </Link>
              {post.status !== 'published' && (
                <button
                  onClick={() => onReschedule(post.id)}
                  className="font-sans text-[11px] px-3 py-1.5 border border-border text-muted-foreground rounded-md hover:text-foreground hover:bg-accent transition-colors"
                >
                  Change schedule
                </button>
              )}
              {post.status !== 'published' && (
                <button
                  onClick={() => onDelete(post.id)}
                  className="font-sans text-[11px] px-3 py-1.5 text-destructive/70 hover:text-destructive transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
