'use client'

import { useEffect, useRef, useState } from 'react'
import { getStale, setCached } from '@/lib/client/dataCache'
import { IdentitySkeleton } from '@/components/skeletons/IdentitySkeleton'
import {
  Plus,
  Briefcase,
  HelpCircle,
  X,
  ChevronDown,
  MessageSquare,
  Sparkles,
  Globe,
} from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { SectionCard } from '@/components/dashboard/SectionCard'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { IdentityStatusCard } from '@/components/identity/IdentityStatusCard'
import { OfferRow, type Offer } from '@/components/identity/OfferRow'
import { AddAudienceDialog } from '@/components/identity/AddAudienceDialog'
import { LinkedInImportDialog } from '@/components/identity/LinkedInImportDialog'
import { LinkedInUrlImportDialog } from '@/components/identity/LinkedInUrlImportDialog'
import { QuestionFlowDialog } from '@/components/identity/QuestionFlowDialog'
import { QuestionsPickerDialog } from '@/components/identity/QuestionsPickerDialog'
import { MemoryImportDialog } from '@/components/identity/MemoryImportDialog'
import { QUESTION_SETS, type QuestionSetKey } from '@/lib/identity/questionSets'

interface Audience {
  label: string
  description?: string
}
interface PersonalInfo {
  key: string
  value: string
  source?: string
}
interface Identity {
  about_you?: string
  your_story?: string
  offers?: Offer[]
  target_audience?: Audience[]
  personal_info?: PersonalInfo[]
  identity_summary?: string | null
  identity_facets?: Record<string, unknown> | null
  summary_updated_at?: string | null
  linkedin_imported_at?: string | null
  domain_imported_at?: string | null
  memory_imported_at?: string | null
}

export default function IdentityPage() {
  const [identity, setIdentity] = useState<Identity>({})
  const [identityLoaded, setIdentityLoaded] = useState(false)
  const identityRef = useRef<Identity>({})
  useEffect(() => {
    identityRef.current = identity
  }, [identity])
  const [linkedInOpen, setLinkedInOpen] = useState(false)
  const [linkedInUrlOpen, setLinkedInUrlOpen] = useState(false)
  const [audienceOpen, setAudienceOpen] = useState(false)
  const [questionPickerOpen, setQuestionPickerOpen] = useState(false)
  const [memoryOpen, setMemoryOpen] = useState(false)
  const [questionKey, setQuestionKey] = useState<QuestionSetKey | null>(null)

  async function refresh() {
    // Show stale cache instantly if available
    const cached = getStale<{ identity: Identity }>('identity')
    if (cached?.identity && !identityLoaded) {
      setIdentity(cached.identity)
      setIdentityLoaded(true)
    }
    const res = await fetch('/api/dashboard/identity')
    const data = await res.json()
    setIdentity(data.identity ?? {})
    setCached('identity', data)
    setIdentityLoaded(true)
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function patch(partial: Partial<Identity>) {
    setIdentity((prev) => ({ ...prev, ...partial }))
    await fetch('/api/dashboard/identity', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
    setTimeout(refresh, 4000)
  }

  function handleQuestionComplete(answers: Record<string, string>) {
    if (!questionKey) return
    const text = Object.values(answers).map((v) => v.trim()).filter(Boolean).join('\n\n')

    if (questionKey === 'about_you') {
      const next = identity.about_you ? `${identity.about_you}\n\n${text}` : text
      patch({ about_you: next })
    } else if (questionKey === 'your_story') {
      const next = identity.your_story ? `${identity.your_story}\n\n${text}` : text
      patch({ your_story: next })
    } else if (questionKey === 'personal_info') {
      const newRows: PersonalInfo[] = Object.entries(answers)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => ({ key: k, value: v, source: 'questions' }))
      patch({
        personal_info: [
          ...((identity.personal_info ?? []).filter((p) => p.source !== 'chat')),
          ...newRows,
        ],
      })
    }
    setQuestionKey(null)
  }

  // Persist-able personal_info (excludes chat-sourced virtual rows)
  function persistPersonalInfo(next: PersonalInfo[]) {
    patch({ personal_info: next.filter((p) => p.source !== 'chat') })
  }

  if (!identityLoaded) {
    return <IdentitySkeleton />
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Identity"
        description="Define your positioning and values to keep every post on brand."
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger
              render={(props) => (
                <Button {...props} size="sm">
                  <Plus size={14} />
                  Import
                  <ChevronDown size={14} />
                </Button>
              )}
            />
            <DropdownMenuContent align="end" className="!w-[280px]">
              <DropdownMenuItem onClick={() => setLinkedInOpen(true)}>
                <Briefcase size={14} className="mr-2 shrink-0" />
                <span className="whitespace-nowrap">Auto-fetch from LinkedIn</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLinkedInUrlOpen(true)}>
                <Globe size={14} className="mr-2 shrink-0" />
                <span className="whitespace-nowrap">Paste LinkedIn URL</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setMemoryOpen(true)}>
                <MessageSquare size={14} className="mr-2 shrink-0" />
                <span className="whitespace-nowrap">Import ChatGPT / Claude memory</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setQuestionPickerOpen(true)}>
                <HelpCircle size={14} className="mr-2 shrink-0" />
                <span className="whitespace-nowrap">Update via questions</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT — sections */}
        <div className="lg:col-span-2 space-y-5">
          {/* About You */}
          <SectionCard
            title="About you"
            description="Your professional background and what makes you unique."
          >
            <Textarea
              value={identity.about_you ?? ''}
              placeholder="My background is in…"
              rows={5}
              className="resize-none"
              onChange={(e) =>
                setIdentity({ ...identity, about_you: e.target.value })
              }
              onBlur={() => patch({ about_you: identity.about_you })}
            />
          </SectionCard>

          {/* Your Story */}
          <SectionCard
            title="Your story"
            description="Your journey, challenges you've overcome, and what drives you."
          >
            <Textarea
              value={identity.your_story ?? ''}
              placeholder="I used to…"
              rows={6}
              className="resize-none"
              onChange={(e) =>
                setIdentity({ ...identity, your_story: e.target.value })
              }
              onBlur={() => patch({ your_story: identity.your_story })}
            />
          </SectionCard>

          {/* Offers */}
          <SectionCard
            title="Your offers"
            description="The products or services you provide. Add a URL to auto-extract details."
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next = [
                    ...(identity.offers ?? []),
                    { name: '', description: '', url: '' },
                  ]
                  setIdentity({ ...identity, offers: next })
                }}
              >
                <Plus size={14} />
                Add offer
              </Button>
            }
          >
            {(identity.offers ?? []).length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No offers yet. Click Add offer, paste a URL, and Nivi extracts the details.
              </p>
            ) : (
              <div className="space-y-3">
                {(identity.offers ?? []).map((o, i) => (
                  <OfferRow
                    key={i}
                    offer={o}
                    onChange={(next) => {
                      const offers = [...(identityRef.current.offers ?? [])]
                      offers[i] = next
                      setIdentity({ ...identityRef.current, offers })
                    }}
                    onRemove={() => {
                      const offers = (identityRef.current.offers ?? []).filter(
                        (_, j) => j !== i
                      )
                      patch({ offers })
                    }}
                    onCommit={() =>
                      patch({ offers: identityRef.current.offers })
                    }
                    onExtracted={(extracted) => {
                      const offers = [...(identityRef.current.offers ?? [])]
                      offers[i] = extracted
                      patch({ offers })
                    }}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Audience */}
          <SectionCard
            title="Target audience"
            description="The specific groups of people you create content for."
            actions={
              <Button size="sm" variant="outline" onClick={() => setAudienceOpen(true)}>
                <Plus size={14} />
                Add audience
              </Button>
            }
          >
            {(identity.target_audience ?? []).length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No audiences yet. Add manually or let Nivi suggest from your Identity.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(identity.target_audience ?? []).map((a, i) => (
                  <div
                    key={i}
                    className="inline-flex items-start gap-2 bg-accent text-accent-foreground rounded-lg px-3 py-2 max-w-[280px]"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold leading-tight">
                        {a.label}
                      </p>
                      {a.description && (
                        <p className="text-[11px] opacity-80 mt-0.5 line-clamp-2">
                          {a.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        const next = (identity.target_audience ?? []).filter(
                          (_, j) => j !== i
                        )
                        patch({ target_audience: next })
                      }}
                      className="opacity-60 hover:opacity-100 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Personal Info */}
          <SectionCard
            title="Personal information"
            description="Key facts that personalize your content. Nivi automatically pulls facts she learns from your chats."
            actions={
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const next = [
                    ...(identity.personal_info ?? []),
                    { key: '', value: '', source: 'manual' },
                  ]
                  setIdentity({ ...identity, personal_info: next })
                }}
              >
                <Plus size={14} />
                Add info
              </Button>
            }
          >
            {(identity.personal_info ?? []).length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No personal information yet. Chat with Nivi or import memories.
              </p>
            ) : (
              <div className="space-y-2">
                {(identity.personal_info ?? []).map((p, i) => {
                  const isChat = p.source === 'chat'
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2 ${
                        isChat ? 'bg-accent/40 border border-accent rounded-md px-2 py-1' : ''
                      }`}
                    >
                      <Input
                        placeholder="Key"
                        value={p.key}
                        readOnly={isChat}
                        className="max-w-[180px]"
                        onChange={(e) => {
                          const next = [...(identity.personal_info ?? [])]
                          next[i] = { ...p, key: e.target.value }
                          setIdentity({ ...identity, personal_info: next })
                        }}
                        onBlur={() => persistPersonalInfo(identity.personal_info ?? [])}
                      />
                      <Input
                        placeholder="Value"
                        value={p.value}
                        readOnly={isChat}
                        onChange={(e) => {
                          const next = [...(identity.personal_info ?? [])]
                          next[i] = { ...p, value: e.target.value }
                          setIdentity({ ...identity, personal_info: next })
                        }}
                        onBlur={() => persistPersonalInfo(identity.personal_info ?? [])}
                      />
                      <span
                        className={`text-[10px] uppercase tracking-wide w-[60px] text-right shrink-0 ${
                          isChat
                            ? 'text-primary font-medium'
                            : 'text-muted-foreground'
                        }`}
                      >
                        {isChat ? (
                          <span className="inline-flex items-center gap-1">
                            <Sparkles size={9} /> chat
                          </span>
                        ) : (
                          p.source ?? 'manual'
                        )}
                      </span>
                      {!isChat && (
                        <button
                          onClick={() => {
                            const next = (identity.personal_info ?? []).filter(
                              (_, j) => j !== i
                            )
                            persistPersonalInfo(next)
                          }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </div>

        {/* RIGHT — status sidebar */}
        <div className="lg:col-span-1">
          <IdentityStatusCard identity={identity} />
        </div>
      </div>

      {/* Dialogs */}
      <LinkedInUrlImportDialog
        open={linkedInUrlOpen}
        onOpenChange={setLinkedInUrlOpen}
        onApply={(s) => {
          const merged: Partial<Identity> = {
            about_you: s.about_you || identity.about_you,
            your_story: s.your_story || identity.your_story,
          }
          if (s.target_audience_suggestions?.length) {
            merged.target_audience = [
              ...(identity.target_audience ?? []),
              ...s.target_audience_suggestions,
            ]
          }
          if (s.offer_suggestions?.length) {
            merged.offers = [
              ...(identity.offers ?? []),
              ...s.offer_suggestions.map((o) => ({
                name: o.name,
                description: o.description,
                url: o.url ?? '',
              })),
            ]
          }
          patch(merged)
        }}
      />

      <LinkedInImportDialog
        open={linkedInOpen}
        onOpenChange={setLinkedInOpen}
        onApply={(s) => {
          const merged: Partial<Identity> = {
            about_you: s.about_you || identity.about_you,
            your_story: s.your_story || identity.your_story,
          }
          if (s.target_audience_suggestions?.length) {
            merged.target_audience = [
              ...(identity.target_audience ?? []),
              ...s.target_audience_suggestions,
            ]
          }
          if (s.offer_suggestions?.length) {
            merged.offers = [
              ...(identity.offers ?? []),
              ...s.offer_suggestions.map((o) => ({
                name: o.name,
                description: o.description,
                url: o.url ?? '',
              })),
            ]
          }
          patch(merged)
        }}
      />

      <AddAudienceDialog
        open={audienceOpen}
        onOpenChange={setAudienceOpen}
        onAdd={(a) => {
          const additions = Array.isArray(a) ? a : [a]
          patch({
            target_audience: [...(identity.target_audience ?? []), ...additions],
          })
        }}
      />

      <QuestionsPickerDialog
        open={questionPickerOpen}
        onOpenChange={setQuestionPickerOpen}
        onPick={(k) => setQuestionKey(k)}
      />

      <MemoryImportDialog
        open={memoryOpen}
        onOpenChange={setMemoryOpen}
        onImported={refresh}
      />

      {questionKey && (
        <QuestionFlowDialog
          open={!!questionKey}
          onOpenChange={(o) => !o && setQuestionKey(null)}
          title={QUESTION_SETS[questionKey].title}
          subtitle={QUESTION_SETS[questionKey].subtitle}
          questions={QUESTION_SETS[questionKey].questions}
          onComplete={handleQuestionComplete}
        />
      )}
    </div>
  )
}
