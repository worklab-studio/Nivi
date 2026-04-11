'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  Plus,
  Sparkles,
  X,
  Trash2,
  Loader2,
  Lock,
  LockOpen,
} from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { SectionCard } from '@/components/dashboard/SectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AddTemplateDialog } from '@/components/identity/AddTemplateDialog'
import { toast } from 'sonner'

interface Template {
  id: string
  name: string
  author_name: string
  author_headline: string
  hook_style?: string
  sentence_style?: string
  ending_style?: string
  source_posts?: string[] | null
  avatar_url?: string | null
  voice_dna?: Record<string, unknown> | null
  is_curated?: boolean
}

interface Pillar {
  name: string
  description: string
  example_topics?: string[]
  // Rich reasoning fields from Phase E.15 two-pass pillar synthesis.
  // Hidden from the card UI but injected into Nivi's system prompt so
  // post/comment generation knows WHY this pillar exists.
  funnel_stage?: 'awareness' | 'consideration' | 'decision'
  audience_pain?: string
  writer_moat?: string
  offer_adjacency?: string
  proof_moment?: string
  locked?: boolean
}

interface Identity {
  active_template_id?: string
  writing_preferences?: string[]
  content_pillars?: Pillar[]
}

export default function WritingStylePage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [identity, setIdentity] = useState<Identity>({})
  const [newPref, setNewPref] = useState('')
  const [openTemplate, setOpenTemplate] = useState<Template | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [generatingPillars, setGeneratingPillars] = useState(false)
  const [regeneratingIndices, setRegeneratingIndices] = useState<Set<number>>(
    new Set()
  )

  function refreshTemplates() {
    fetch('/api/dashboard/writing-style/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
  }

  useEffect(() => {
    fetch('/api/dashboard/writing-style/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
    fetch('/api/dashboard/identity')
      .then((r) => r.json())
      .then((d) => setIdentity(d.identity ?? {}))
  }, [])

  // Pin Nivi first regardless of how the API ordered them
  const orderedTemplates = useMemo(() => {
    const nivi = templates.find((t) => t.id === 'nivi-default')
    const rest = templates.filter((t) => t.id !== 'nivi-default')
    return nivi ? [nivi, ...rest] : templates
  }, [templates])

  async function activate(templateId: string) {
    setIdentity((prev) => ({ ...prev, active_template_id: templateId }))
    await fetch('/api/dashboard/writing-style/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId }),
    })
    toast.success('Writing style activated')
  }

  async function deleteTemplate(templateId: string) {
    if (!confirm('Delete this writing style? This cannot be undone.')) return
    setTemplates((prev) => prev.filter((t) => t.id !== templateId))
    setOpenTemplate(null)
    if (identity.active_template_id === templateId) {
      setIdentity((prev) => ({ ...prev, active_template_id: undefined }))
    }
    const res = await fetch(
      `/api/dashboard/writing-style/templates/${templateId}`,
      { method: 'DELETE' }
    )
    const data = await res.json()
    if (data.ok) {
      toast.success('Writing style deleted')
    } else {
      toast.error(data.error ?? 'Delete failed')
      refreshTemplates()
    }
  }

  async function patchIdentity(partial: Partial<Identity>) {
    setIdentity((prev) => ({ ...prev, ...partial }))
    await fetch('/api/dashboard/identity', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    })
  }

  function addPreference() {
    if (!newPref.trim()) return
    const next = [...(identity.writing_preferences ?? []), newPref.trim()]
    patchIdentity({ writing_preferences: next })
    setNewPref('')
  }

  function removePreference(i: number) {
    const next = (identity.writing_preferences ?? []).filter((_, j) => j !== i)
    patchIdentity({ writing_preferences: next })
  }

  async function regeneratePillars() {
    const pillars = identity.content_pillars ?? []
    const unlockedCount = pillars.filter((p) => !p.locked).length
    if (pillars.length === 5 && unlockedCount === 0) {
      toast.error('Unlock at least one pillar to regenerate')
      return
    }
    setGeneratingPillars(true)
    try {
      const res = await fetch(
        '/api/dashboard/writing-style/generate-pillars',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )
      const data = await res.json()
      if (data.ok && Array.isArray(data.pillars)) {
        setIdentity((prev) => ({ ...prev, content_pillars: data.pillars }))
        toast.success(`Regenerated ${data.pillars.length} content pillars`)
      } else {
        toast.error(data.error ?? 'Could not generate pillars')
      }
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`)
    } finally {
      setGeneratingPillars(false)
    }
  }

  async function regeneratePillar(index: number) {
    setRegeneratingIndices((prev) => {
      const next = new Set(prev)
      next.add(index)
      return next
    })
    try {
      const res = await fetch(
        '/api/dashboard/writing-style/generate-pillars',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ regenerate_index: index }),
        }
      )
      const data = await res.json()
      if (data.ok && data.pillar) {
        setIdentity((prev) => {
          const next = [...(prev.content_pillars ?? [])]
          next[index] = { ...data.pillar, locked: next[index]?.locked }
          return { ...prev, content_pillars: next }
        })
        toast.success('Pillar regenerated')
      } else {
        toast.error(data.error ?? 'Could not regenerate pillar')
      }
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`)
    } finally {
      setRegeneratingIndices((prev) => {
        const next = new Set(prev)
        next.delete(index)
        return next
      })
    }
  }

  function updatePillar(index: number, partial: Partial<Pillar>) {
    const current = identity.content_pillars ?? []
    const next = [...current]
    next[index] = { ...next[index], ...partial }
    patchIdentity({ content_pillars: next })
  }

  function deletePillar(index: number) {
    const next = (identity.content_pillars ?? []).filter((_, i) => i !== index)
    patchIdentity({ content_pillars: next })
  }

  function addPillar() {
    const current = identity.content_pillars ?? []
    if (current.length >= 5) return
    const next = [
      ...current,
      { name: '', description: '', example_topics: [] } as Pillar,
    ]
    patchIdentity({ content_pillars: next })
  }

  function togglePillarLock(index: number) {
    const current = identity.content_pillars ?? []
    const next = [...current]
    next[index] = { ...next[index], locked: !next[index].locked }
    patchIdentity({ content_pillars: next })
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Writing style"
        description="Choose a writing style template, define your preferences, and lock in five content pillars."
      />

      {/* Templates */}
      <div className="space-y-5">
        <SectionCard
          title="Templates"
          description="Pick a creator's style or paste your own examples to extract one."
          actions={
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus size={14} />
              Add your style
            </Button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {orderedTemplates.map((t) => {
              const active = identity.active_template_id === t.id
              const samplePost = (t.source_posts ?? [])[0] ?? ''
              const isNivi = t.id === 'nivi-default'
              return (
                <TemplateCard
                  key={t.id}
                  template={t}
                  samplePost={samplePost}
                  active={active}
                  isNivi={isNivi}
                  onActivate={() => activate(t.id)}
                  onSeeMore={() => setOpenTemplate(t)}
                  onDelete={
                    t.is_curated ? undefined : () => deleteTemplate(t.id)
                  }
                />
              )
            })}
          </div>
        </SectionCard>

        {/* Preferences */}
        <SectionCard
          title="Writing preferences"
          description="Personalized rules that guide how Nivi generates your posts. Nivi will also learn from chat over time."
        >
          <div className="space-y-2">
            {(identity.writing_preferences ?? []).map((p, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-secondary/50 border border-border rounded-md px-3 py-2"
              >
                <span className="text-[13px] text-foreground">{p}</span>
                <button
                  onClick={() => removePreference(i)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                placeholder="e.g. Keep paragraphs 1-3 lines max"
                value={newPref}
                onChange={(e) => setNewPref(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addPreference()}
              />
              <Button size="sm" onClick={addPreference} variant="outline">
                <Plus size={14} />
                Add
              </Button>
            </div>
          </div>
        </SectionCard>

        {/* Content pillars */}
        {(() => {
          const pillars = identity.content_pillars ?? []
          const lockedCount = pillars.filter((p) => p.locked).length
          const unlockedCount = pillars.length - lockedCount
          const allLocked = pillars.length === 5 && lockedCount === 5
          const canAdd = pillars.length < 5
          const regenLabel =
            lockedCount > 0 && lockedCount < pillars.length
              ? `Regenerate ${unlockedCount} unlocked`
              : 'Regenerate'
          return (
            <SectionCard
              title="Content pillars"
              description="Five themes Nivi rotates through. Edit inline, regenerate individual pillars, or lock the ones you love."
              actions={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={addPillar}
                    disabled={!canAdd}
                    title={canAdd ? 'Add a pillar' : 'Maximum 5 pillars'}
                  >
                    <Plus size={14} />
                    Add pillar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={regeneratePillars}
                    disabled={generatingPillars || allLocked}
                    title={
                      allLocked
                        ? 'Unlock at least one pillar to regenerate'
                        : regenLabel
                    }
                  >
                    {generatingPillars ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Sparkles size={14} />
                    )}
                    {regenLabel}
                  </Button>
                </div>
              }
            >
              {pillars.length === 0 ? (
                <p className="text-[13px] text-muted-foreground">
                  No pillars yet. Click Regenerate to derive 5 from your Identity, or Add pillar to create one manually.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  {pillars.slice(0, 5).map((p, i) => {
                    const isRegenerating = regeneratingIndices.has(i)
                    const locked = !!p.locked
                    return (
                      <div
                        key={i}
                        className={`group relative rounded-lg p-3 transition-colors flex flex-col h-full ${
                          locked
                            ? 'bg-secondary border border-primary/30'
                            : 'bg-secondary/50 border border-border'
                        }`}
                      >
                        {/* Top-left: Lock toggle */}
                        <button
                          onClick={() => togglePillarLock(i)}
                          className={`absolute top-2 left-2 w-5 h-5 rounded flex items-center justify-center transition-colors ${
                            locked
                              ? 'text-primary'
                              : 'text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100'
                          }`}
                          title={locked ? 'Unlock pillar' : 'Lock pillar'}
                        >
                          {locked ? <Lock size={12} /> : <LockOpen size={12} />}
                        </button>

                        {/* Top-right: Regenerate + Delete */}
                        <div className="absolute top-2 right-2 flex items-center gap-1">
                          <button
                            onClick={() => regeneratePillar(i)}
                            disabled={isRegenerating}
                            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
                            title="Regenerate this pillar"
                          >
                            {isRegenerating ? (
                              <Loader2
                                size={12}
                                className="animate-spin text-primary"
                              />
                            ) : (
                              <Sparkles size={12} />
                            )}
                          </button>
                          <button
                            onClick={() => deletePillar(i)}
                            className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Delete pillar"
                          >
                            <X size={12} />
                          </button>
                        </div>

                        {/* Editable fields */}
                        <div className="pt-5 space-y-2 flex flex-col flex-1">
                          <Textarea
                            value={p.name}
                            placeholder="Pillar name"
                            rows={2}
                            onChange={(
                              e: React.ChangeEvent<HTMLTextAreaElement>
                            ) =>
                              setIdentity((prev) => {
                                const next = [
                                  ...(prev.content_pillars ?? []),
                                ]
                                next[i] = { ...next[i], name: e.target.value }
                                return { ...prev, content_pillars: next }
                              })
                            }
                            onBlur={(
                              e: React.FocusEvent<HTMLTextAreaElement>
                            ) => updatePillar(i, { name: e.target.value })}
                            className="text-[13px] font-semibold resize-none px-2 py-1.5 leading-snug min-h-0"
                          />
                          <Textarea
                            value={p.description}
                            placeholder="What this pillar covers"
                            rows={6}
                            onChange={(
                              e: React.ChangeEvent<HTMLTextAreaElement>
                            ) =>
                              setIdentity((prev) => {
                                const next = [
                                  ...(prev.content_pillars ?? []),
                                ]
                                next[i] = {
                                  ...next[i],
                                  description: e.target.value,
                                }
                                return { ...prev, content_pillars: next }
                              })
                            }
                            onBlur={(
                              e: React.FocusEvent<HTMLTextAreaElement>
                            ) => updatePillar(i, { description: e.target.value })}
                            className="text-[12px] resize-none px-2 py-1.5 flex-1"
                          />
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider pt-1 mt-auto">
                            Pillar {i + 1}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </SectionCard>
          )
        })()}
      </div>

      {/* Add your own style */}
      <AddTemplateDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={refreshTemplates}
      />

      {/* See more modal */}
      <TemplateModal
        template={openTemplate}
        onClose={() => setOpenTemplate(null)}
        active={openTemplate ? identity.active_template_id === openTemplate.id : false}
        onActivate={(id) => {
          activate(id)
          setOpenTemplate(null)
        }}
        onDelete={deleteTemplate}
      />
    </div>
  )
}

// ────────────────────────────────────────────────
// Avatar — tries avatar_url with graceful initials fallback
// ────────────────────────────────────────────────

function TemplateAvatar({
  name,
  avatarUrl,
  isNivi,
  size = 40,
}: {
  name: string
  avatarUrl?: string | null
  isNivi: boolean
  size?: number
}) {
  const [broken, setBroken] = useState(false)
  const initials = name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  // Force unavatar.io to return 404 when no source is found instead of a
  // generic placeholder face — so onError fires and we can show initials.
  let resolvedUrl = avatarUrl ?? ''
  if (resolvedUrl.includes('unavatar.io') && !resolvedUrl.includes('fallback=')) {
    resolvedUrl += resolvedUrl.includes('?') ? '&fallback=false' : '?fallback=false'
  }

  const showImage = !!resolvedUrl && !broken
  const style: React.CSSProperties = { width: size, height: size }

  if (showImage) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedUrl}
        alt={name}
        width={size}
        height={size}
        onError={() => setBroken(true)}
        className="rounded-full object-cover shrink-0 border border-border"
        style={style}
      />
    )
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-semibold shrink-0 ${
        isNivi
          ? 'bg-primary text-primary-foreground'
          : 'bg-accent text-accent-foreground'
      }`}
      style={{ ...style, fontSize: Math.round(size * 0.32) }}
    >
      {isNivi && !resolvedUrl ? 'N' : initials}
    </div>
  )
}

// ────────────────────────────────────────────────
// Template card — LinkedIn-style preview
// ────────────────────────────────────────────────

function TemplateCard({
  template,
  samplePost,
  active,
  isNivi,
  onActivate,
  onSeeMore,
  onDelete,
}: {
  template: Template
  samplePost: string
  active: boolean
  isNivi: boolean
  onActivate: () => void
  onSeeMore: () => void
  onDelete?: () => void
}) {
  return (
    <div
      className={`group relative bg-card border rounded-xl overflow-hidden transition-all flex flex-col ${
        active
          ? 'border-primary ring-2 ring-primary/20'
          : 'border-border hover:border-primary/40'
      }`}
    >
      {/* Top-right controls: delete (user templates) + active check */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            className="w-6 h-6 rounded-full bg-card border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 flex items-center justify-center shadow-sm transition-colors"
            title="Delete this style"
          >
            <Trash2 size={12} />
          </button>
        )}
        {active && (
          <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <Check size={13} />
          </div>
        )}
      </div>

      {/* Author header */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <TemplateAvatar
          name={template.author_name}
          avatarUrl={template.avatar_url}
          isNivi={isNivi}
          size={40}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground truncate flex items-center gap-1.5">
            {template.author_name}
            {isNivi && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                Default
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground truncate">
            {template.author_headline}
          </p>
        </div>
      </div>

      {/* Sample post — paragraph-aware preview so blank lines show rhythm */}
      <div className="px-4 pb-2 flex-1">
        {samplePost ? (() => {
          const paragraphs = samplePost
            .split(/\n{2,}/)
            .map((p) => p.trim())
            .filter(Boolean)
          if (paragraphs.length <= 1) {
            // Dense single-paragraph fallback
            return (
              <p className="text-[12.5px] text-foreground leading-[1.55] line-clamp-4 min-h-[80px]">
                {samplePost}
              </p>
            )
          }
          return (
            <div className="space-y-2 min-h-[80px]">
              {paragraphs.slice(0, 2).map((p, i) => (
                <p
                  key={i}
                  className="text-[12.5px] text-foreground leading-[1.55] line-clamp-2"
                >
                  {p}
                </p>
              ))}
            </div>
          )
        })() : (
          <p className="text-[12px] text-muted-foreground italic min-h-[80px]">
            {template.hook_style ?? 'No sample available.'}
          </p>
        )}
        {samplePost && (
          <button
            onClick={onSeeMore}
            className="text-[12px] text-muted-foreground hover:text-foreground mt-1 font-medium"
          >
            …see more
          </button>
        )}
      </div>

      {/* Activate footer */}
      <div className="px-4 py-3 mt-2 border-t border-border bg-secondary/30">
        <Button
          size="sm"
          variant={active ? 'outline' : 'default'}
          className="w-full"
          onClick={onActivate}
        >
          {active ? 'Active' : 'Use this style'}
        </Button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────
// See more modal
// ────────────────────────────────────────────────

function TemplateModal({
  template,
  onClose,
  active,
  onActivate,
  onDelete,
}: {
  template: Template | null
  onClose: () => void
  active: boolean
  onActivate: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (!template) return null
  const samplePost = (template.source_posts ?? [])[0] ?? ''
  const isNivi = template.id === 'nivi-default'

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[calc(100vh-80px)] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>{template.name}</DialogTitle>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto space-y-4 -mx-4 px-4">
          {/* LinkedIn-style author */}
          <div className="flex items-center gap-3">
            <TemplateAvatar
              name={template.author_name}
              avatarUrl={template.avatar_url}
              isNivi={isNivi}
              size={44}
            />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-foreground">
                {template.author_name}
              </p>
              <p className="text-[12px] text-muted-foreground">
                {template.author_headline}
              </p>
            </div>
          </div>

          {/* Full post body */}
          {samplePost && (
            <div className="bg-secondary/40 border border-border rounded-lg p-3.5">
              <p className="text-[13.5px] text-foreground leading-[1.6] whitespace-pre-wrap">
                {samplePost}
              </p>
            </div>
          )}

          {/* Style facets */}
          <div className="space-y-2.5 pb-1">
            {template.hook_style && (
              <Facet label="Hook style" value={template.hook_style} />
            )}
            {template.sentence_style && (
              <Facet label="Sentence style" value={template.sentence_style} />
            )}
            {template.ending_style && (
              <Facet label="Ending style" value={template.ending_style} />
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-between gap-2 pt-3 border-t border-border">
          {!template.is_curated ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onDelete(template.id)}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              Delete
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            onClick={() => onActivate(template.id)}
            disabled={active}
          >
            {active ? 'Active' : 'Use this style'}
          </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Facet({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-[12px] text-foreground leading-relaxed">{value}</p>
    </div>
  )
}
