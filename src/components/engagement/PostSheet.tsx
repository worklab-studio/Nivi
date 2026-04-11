'use client'

import { ExternalLink } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Opportunity } from './OpportunityCard'

interface Props {
  opp: Opportunity | null
  onClose: () => void
}

function formatFollowers(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toString()
}

export function PostSheet({ opp, onClose }: Props) {
  if (!opp) return null
  const initials = (opp.author_name ?? '')
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <Sheet open={!!opp} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        showCloseButton={false}
        className="!inset-y-[10px] !right-[10px] !h-auto !w-[520px] sm:!max-w-[520px] !rounded-2xl !border !border-border !shadow-2xl bg-card p-0 overflow-hidden flex flex-col"
      >
        <SheetHeader className="px-6 pt-5 pb-4 border-b border-border bg-gradient-to-b from-accent/40 to-card shrink-0">
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-foreground">Original post</SheetTitle>
            <button
              onClick={onClose}
              className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Author */}
          <div className="flex items-start gap-3">
            {opp.author_avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={opp.author_avatar_url}
                alt={opp.author_name ?? ''}
                className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[14px] font-semibold shrink-0">
                {initials || '?'}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-foreground">
                {opp.author_name ?? 'Unknown'}
              </p>
              {opp.author_headline && (
                <p className="text-[12px] text-muted-foreground">
                  {opp.author_headline}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">
                {formatFollowers(opp.author_followers)} followers
              </p>
            </div>
          </div>

          {/* Post body */}
          {opp.post_preview && (
            <div className="bg-secondary/40 border border-border rounded-lg p-4">
              <p className="text-[13.5px] text-foreground leading-[1.7] whitespace-pre-wrap">
                {opp.post_preview}
              </p>
            </div>
          )}

          {/* Nivi's drafted comment */}
          {opp.drafted_comment && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Nivi drafted
              </p>
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {opp.drafted_comment}
                </p>
              </div>
            </div>
          )}

          {/* Metadata */}
          <div className="pt-3 border-t border-border space-y-1.5 text-[12px]">
            {opp.matched_pillar && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Pillar</span>
                <span className="text-foreground">{opp.matched_pillar}</span>
              </div>
            )}
            {opp.relevance_score !== null && opp.relevance_score > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Relevance</span>
                <span className="text-foreground tabular-nums">
                  {Math.round((opp.relevance_score ?? 0) * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {opp.linkedin_post_url && (
          <div className="shrink-0 px-6 py-3 border-t border-border">
            <a
              href={opp.linkedin_post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-primary hover:underline"
            >
              <ExternalLink size={12} />
              View on LinkedIn
            </a>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
