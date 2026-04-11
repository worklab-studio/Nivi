'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ThumbsUp, MessageCircle, Repeat2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export interface InspirationPost {
  id: string
  content: string
  author_name: string
  author_headline: string | null
  author_avatar_url: string | null
  author_handle: string | null
  format: string | null
  topic_pillar: string | null
  engagement_tier: string | null
  hook_score: number | null
  likes: number
  comments: number
  reposts: number
  linkedin_post_url: string | null
  is_trending: boolean
}

function fmt(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

const FORMAT_COLORS: Record<string, string> = {
  hook_story: 'bg-violet-500/10 text-violet-700',
  listicle: 'bg-blue-500/10 text-blue-700',
  contrarian: 'bg-red-500/10 text-red-700',
  data_led: 'bg-emerald-500/10 text-emerald-700',
  confession: 'bg-amber-500/10 text-amber-700',
  thread: 'bg-cyan-500/10 text-cyan-700',
  observation: 'bg-gray-500/10 text-gray-700',
}

export function InspirationCard({ post }: { post: InspirationPost }) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)

  const initials = post.author_name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const paragraphs = post.content.split(/\n{2,}/).filter(Boolean)
  const isLong = paragraphs.length > 3 || post.content.length > 400

  async function handleRemix() {
    // Duplicate as a new draft with this content as a reference
    try {
      const res = await fetch('/api/posts/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: null, // No source post — we'll create a blank draft
          inspirationContent: post.content,
        }),
      })
      // If duplicate endpoint doesn't support this, just navigate directly
      router.push(
        `/compose?remix=${encodeURIComponent(post.id)}`
      )
    } catch {
      router.push(
        `/compose?remix=${encodeURIComponent(post.id)}`
      )
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors flex flex-col">
      {/* Author header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        {post.author_avatar_url && !avatarBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.author_avatar_url}
            alt={post.author_name}
            onError={() => setAvatarBroken(true)}
            className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[12px] font-semibold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground truncate">
            {post.author_name}
          </p>
          {post.author_headline && (
            <p className="text-[11px] text-muted-foreground truncate">
              {post.author_headline}
            </p>
          )}
        </div>
        {post.is_trending && (
          <span className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 font-semibold">
            Trending
          </span>
        )}
      </div>

      {/* Post body */}
      <div className="px-4 pb-2 flex-1">
        <div
          className={`text-[13px] text-foreground leading-relaxed whitespace-pre-line ${
            !expanded && isLong ? 'line-clamp-4' : ''
          }`}
        >
          {post.content}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[11px] text-muted-foreground hover:text-foreground mt-1 flex items-center gap-0.5"
          >
            {expanded ? (
              <>
                <ChevronUp size={11} /> Show less
              </>
            ) : (
              <>
                <ChevronDown size={11} /> …see more
              </>
            )}
          </button>
        )}
      </div>

      {/* Tags + metrics */}
      <div className="px-4 pb-3 flex items-center gap-1.5 flex-wrap">
        {post.format && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              FORMAT_COLORS[post.format] ?? FORMAT_COLORS.observation
            }`}
          >
            {post.format.replace(/_/g, ' ')}
          </span>
        )}
        {post.topic_pillar && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
            {post.topic_pillar.replace(/_/g, ' ')}
          </span>
        )}
        {post.hook_score && post.hook_score > 0 && (
          <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
            Hook {post.hook_score}/10
          </span>
        )}
      </div>

      {/* Engagement */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <ThumbsUp size={12} /> {fmt(post.likes)}
        </span>
        <span className="flex items-center gap-1">
          <MessageCircle size={12} /> {fmt(post.comments)}
        </span>
        {post.reposts > 0 && (
          <span className="flex items-center gap-1">
            <Repeat2 size={12} /> {fmt(post.reposts)}
          </span>
        )}
      </div>

      {/* Remix CTA */}
      <div className="px-4 py-3 border-t border-border bg-secondary/30">
        <Button size="sm" className="w-full" onClick={handleRemix}>
          <Sparkles size={14} />
          Remix in my voice
        </Button>
      </div>
    </div>
  )
}
