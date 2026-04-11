'use client'

import { useState } from 'react'
import { Sparkles, Briefcase, Globe, MessageSquare, Clock } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { computeIdentityStrength } from './computeStrength'

interface Props {
  identity: {
    about_you?: string | null
    your_story?: string | null
    offers?: unknown[]
    target_audience?: unknown[]
    personal_info?: unknown[]
    identity_summary?: string | null
    identity_facets?: Record<string, unknown> | null
    summary_updated_at?: string | null
    linkedin_imported_at?: string | null
    domain_imported_at?: string | null
    memory_imported_at?: string | null
  } | null
}

function fmt(date?: string | null) {
  if (!date) return '—'
  const d = new Date(date)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const ROW = ({
  Icon,
  label,
  value,
  active,
}: {
  Icon: typeof Briefcase
  label: string
  value: string
  active: boolean
}) => (
  <div className="flex items-center justify-between py-2">
    <div className="flex items-center gap-2">
      <div
        className={`w-6 h-6 rounded-md flex items-center justify-center ${
          active ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
        }`}
      >
        <Icon size={12} />
      </div>
      <span className="text-[12px] text-foreground">{label}</span>
    </div>
    <span
      className={`text-[12px] tabular-nums ${
        active ? 'text-foreground font-medium' : 'text-muted-foreground'
      }`}
    >
      {value}
    </span>
  </div>
)

export function IdentityStatusCard({ identity }: Props) {
  const [open, setOpen] = useState(false)
  const strength = computeIdentityStrength(identity)
  const summary = identity?.identity_summary ?? ''
  const summaryPreview = summary.split(/\s+/).slice(0, 28).join(' ') + (summary ? '…' : '')

  return (
    <>
      <Card className="bg-card border border-border rounded-xl overflow-hidden sticky top-[72px] shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {/* Strength header */}
        <div className="p-5 border-b border-border bg-gradient-to-b from-secondary/40 to-transparent">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Identity strength
            </p>
            <span className="text-[20px] font-semibold text-foreground tabular-nums leading-none">
              {strength}%
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${strength}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {strength < 40
              ? 'Just getting started — fill more sections.'
              : strength < 80
                ? 'Solid foundation. Keep going.'
                : 'Excellent — your brand is fully defined.'}
          </p>
        </div>

        {/* Sources */}
        <div className="px-5 py-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            Sources
          </p>
          <div className="divide-y divide-border">
            <ROW
              Icon={Briefcase}
              label="LinkedIn"
              value={fmt(identity?.linkedin_imported_at)}
              active={!!identity?.linkedin_imported_at}
            />
            <ROW
              Icon={Globe}
              label="Domain"
              value={fmt(identity?.domain_imported_at)}
              active={!!identity?.domain_imported_at}
            />
            <ROW
              Icon={MessageSquare}
              label="Memory import"
              value={fmt(identity?.memory_imported_at)}
              active={!!identity?.memory_imported_at}
            />
            <ROW
              Icon={Clock}
              label="Distilled"
              value={fmt(identity?.summary_updated_at)}
              active={!!identity?.summary_updated_at}
            />
          </div>
        </div>

        {/* Distilled summary preview */}
        <div className="p-5 border-t border-border bg-secondary/30">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles size={12} className="text-primary" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Distilled summary
            </p>
          </div>
          {summary ? (
            <>
              <p className="text-[12px] text-foreground/80 leading-relaxed line-clamp-3">
                {summaryPreview}
              </p>
              <button
                onClick={() => setOpen(true)}
                className="mt-2 text-[12px] font-medium text-primary hover:underline"
              >
                See more →
              </button>
            </>
          ) : (
            <p className="text-[12px] text-muted-foreground italic">
              Fill in sections to generate a distilled brand summary.
            </p>
          )}
        </div>
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          showCloseButton={false}
          className="!inset-y-[10px] !right-[10px] !h-auto !w-[460px] sm:!max-w-[460px] !rounded-2xl !border !border-border !shadow-2xl bg-card p-0 overflow-hidden flex flex-col"
        >
          <SheetHeader className="px-6 pt-5 pb-4 border-b border-border bg-gradient-to-b from-accent/40 to-card">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Sparkles size={14} />
                </div>
                <SheetTitle className="text-foreground">Distilled identity</SheetTitle>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[12px] text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {summary && (
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Summary
                </p>
                <p className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {summary}
                </p>
              </div>
            )}
            {identity?.identity_facets &&
              Object.entries(identity.identity_facets).map(([key, value]) => (
                <div key={key}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    {key.replace(/_/g, ' ')}
                  </p>
                  {Array.isArray(value) ? (
                    <ul className="space-y-1.5">
                      {(value as string[]).map((v, i) => (
                        <li
                          key={i}
                          className="text-[13px] text-foreground bg-secondary/60 border border-border rounded-md px-3 py-2"
                        >
                          {v}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-foreground">{String(value)}</p>
                  )}
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
