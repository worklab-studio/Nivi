'use client'

import { ThumbsUp, MessageCircle, Repeat2, Send } from 'lucide-react'

/**
 * The Like / Comment / Repost / Send footer that appears on every
 * LinkedIn post. Theme-aware.
 */
export function LinkedInEngagementBar() {
  const buttons = [
    { icon: ThumbsUp, label: 'Like' },
    { icon: MessageCircle, label: 'Comment' },
    { icon: Repeat2, label: 'Repost' },
    { icon: Send, label: 'Send' },
  ]

  return (
    <div className="grid grid-cols-4">
      {buttons.map(({ icon: Icon, label }) => (
        <button
          key={label}
          type="button"
          tabIndex={-1}
          className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-accent transition-colors rounded"
        >
          <Icon
            className="size-[18px] text-muted-foreground"
            strokeWidth={2}
          />
          <span className="text-[13px] font-semibold text-muted-foreground">
            {label}
          </span>
        </button>
      ))}
    </div>
  )
}
