'use client'

import { useState } from 'react'
import {
  ExternalLink,
  Loader2,
  Sparkles,
  RotateCw,
  Scissors,
  Swords,
  BookOpen,
  Check,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export interface Opportunity {
  id: string
  author_name: string | null
  author_headline: string | null
  author_followers: number | null
  author_handle: string | null
  author_avatar_url: string | null
  post_preview: string | null
  linkedin_post_url: string | null
  drafted_comment: string | null
  relevance_score: number | null
  matched_pillar: string | null
  status: string
  created_at: string
}

function formatFollowers(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const h = Math.floor((Date.now() - d.getTime()) / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

interface Props {
  opp: Opportunity
  onPost: (id: string) => Promise<void>
  onSkip: (id: string) => Promise<void>
  onUpdate: (id: string, draftedComment: string) => void
  onOpenPost: (opp: Opportunity) => void
  /** In compact mode, only shows comment textarea + actions (no post preview or author header) */
  compactMode?: boolean
}

type Angle = 'fresh' | 'shorter' | 'contrarian' | 'story'

export function OpportunityCard({
  opp,
  onPost,
  onSkip,
  onUpdate,
  onOpenPost,
  compactMode = false,
}: Props) {
  const [comment, setComment] = useState(opp.drafted_comment ?? '')
  const [posting, setPosting] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [regenerating, setRegenerating] = useState<Angle | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [avatarBroken, setAvatarBroken] = useState(false)

  const hasComment = !!comment.trim()

  const initials = (opp.author_name ?? '')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const relevancePct = Math.round((opp.relevance_score ?? 0) * 100)
  const relevanceColor =
    relevancePct >= 80
      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
      : relevancePct >= 60
        ? 'bg-blue-500/10 text-blue-600 border-blue-500/30'
        : 'bg-amber-500/10 text-amber-600 border-amber-500/30'

  async function persistEdit(value: string) {
    if (value === opp.drafted_comment) return
    onUpdate(opp.id, value)
    try {
      await fetch('/api/engagement/comment', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          opportunityId: opp.id,
          draftedComment: value,
        }),
      })
    } catch (e) {
      toast.error(`Save failed: ${(e as Error).message}`)
    }
  }

  async function handleRegenerate(angle: Angle) {
    setRegenerating(angle)
    try {
      const res = await fetch('/api/engagement/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: opp.id, angle }),
      })
      const data = await res.json()
      if (data.ok && data.drafted_comment) {
        setComment(data.drafted_comment)
        onUpdate(opp.id, data.drafted_comment)
        toast.success('Regenerated')
      } else {
        toast.error(data.error ?? 'Could not regenerate')
      }
    } catch (e) {
      toast.error(`Regenerate failed: ${(e as Error).message}`)
    } finally {
      setRegenerating(null)
    }
  }

  async function handlePost() {
    setPosting(true)
    try {
      await onPost(opp.id)
    } finally {
      setPosting(false)
    }
  }

  async function handleSkip() {
    setSkipping(true)
    try {
      await onSkip(opp.id)
    } finally {
      setSkipping(false)
    }
  }

  async function handleDraftComment() {
    setDrafting(true)
    try {
      const res = await fetch('/api/engagement/draft-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: opp.id }),
      })
      const data = await res.json()
      if (data.ok && data.drafted_comment) {
        setComment(data.drafted_comment)
        onUpdate(opp.id, data.drafted_comment)
        toast.success('Comment drafted')
      } else {
        toast.error(data.error ?? 'Could not draft comment')
      }
    } catch (e) {
      toast.error(`Draft failed: ${(e as Error).message}`)
    } finally {
      setDrafting(false)
    }
  }

  return (
    <div className={compactMode ? '' : 'bg-card border border-border rounded-xl p-5 transition-colors hover:border-primary/30'}>
      {/* Author row */}
      {!compactMode && (<div className="flex items-start gap-3 mb-3">
        {opp.author_avatar_url && !avatarBroken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={opp.author_avatar_url}
            alt={opp.author_name ?? ''}
            onError={() => setAvatarBroken(true)}
            className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[12px] font-semibold shrink-0">
            {initials || '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground truncate">
            {opp.author_name ?? 'Unknown'}
          </p>
          {opp.author_headline && (
            <p className="text-[11px] text-muted-foreground truncate">
              {opp.author_headline}
            </p>
          )}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {formatFollowers(opp.author_followers)} followers
            </span>
            <span className="text-[10px] text-muted-foreground/60">·</span>
            <span className="text-[11px] text-muted-foreground">
              {formatRelative(opp.created_at)}
            </span>
            {opp.relevance_score !== null && opp.relevance_score > 0 && (
              <>
                <span className="text-[10px] text-muted-foreground/60">·</span>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${relevanceColor}`}
                >
                  {relevancePct}% relevance
                </span>
              </>
            )}
            {opp.matched_pillar && (
              <>
                <span className="text-[10px] text-muted-foreground/60">·</span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                  {opp.matched_pillar}
                </span>
              </>
            )}
          </div>
        </div>
      </div>)}

      {/* Post preview */}
      {!compactMode && opp.post_preview && (
        <button
          onClick={() => onOpenPost(opp)}
          className="w-full text-left bg-secondary/40 border border-border rounded-lg p-3 mb-3 hover:border-primary/40 transition-colors"
        >
          <p className="text-[12.5px] text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-line">
            {opp.post_preview}
          </p>
          <p className="text-[11px] text-primary mt-1.5">Read full post →</p>
        </button>
      )}

      {/* Comment section */}
      {hasComment ? (
        <>
          {/* Drafted comment — editable */}
          <div className="mb-3">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles size={11} className="text-primary" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Your comment
              </p>
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={(e) => persistEdit(e.target.value)}
              rows={4}
              className="resize-none text-[13px] leading-relaxed"
            />
          </div>

          {/* Regenerate toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 mb-3">
            {[
              { angle: 'fresh' as Angle, Icon: RotateCw, label: 'Fresh angle' },
              { angle: 'shorter' as Angle, Icon: Scissors, label: 'Shorter' },
              { angle: 'contrarian' as Angle, Icon: Swords, label: 'Contrarian' },
              { angle: 'story' as Angle, Icon: BookOpen, label: 'Add story' },
            ].map(({ angle, Icon, label }) => (
              <button
                key={angle}
                onClick={() => handleRegenerate(angle)}
                disabled={regenerating !== null || posting || skipping}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-border bg-card text-muted-foreground hover:text-foreground hover:border-border disabled:opacity-50 transition-colors"
              >
                {regenerating === angle ? (
                  <Loader2 size={11} className="animate-spin" />
                ) : (
                  <Icon size={11} />
                )}
                {label}
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handlePost}
              disabled={posting || skipping || regenerating !== null}
            >
              {posting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Post comment
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSkip}
              disabled={posting || skipping || regenerating !== null}
            >
              {skipping ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <X size={14} />
              )}
              Skip
            </Button>
            {opp.linkedin_post_url && (
              <a
                href={opp.linkedin_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink size={11} />
                View on LinkedIn
              </a>
            )}
          </div>
        </>
      ) : (
        /* No comment yet — show Draft button */
        <div className="space-y-2">
          <Button
            size="sm"
            onClick={handleDraftComment}
            disabled={drafting}
            className="w-full"
          >
            {drafting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Sparkles size={14} />
            )}
            {drafting ? 'Nivi is drafting…' : 'Draft comment with Nivi'}
          </Button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSkip}
              disabled={skipping || drafting}
              className="flex-1"
            >
              {skipping ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <X size={14} />
              )}
              Skip
            </Button>
            {opp.linkedin_post_url && (
              <a
                href={opp.linkedin_post_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink size={11} />
                View on LinkedIn
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
