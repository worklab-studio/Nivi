'use client'

import { useEffect, useMemo, useState } from 'react'
import { Plus, Search, BookOpen } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AddSourceDialog } from '@/components/knowledge/AddSourceDialog'
import { SourceCard, type KnowledgeChunk } from '@/components/knowledge/SourceCard'
import { toast } from 'sonner'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'transcript', label: 'Transcripts' },
  { value: 'article', label: 'Articles' },
  { value: 'post', label: 'Posts' },
  { value: 'note', label: 'Notes' },
  { value: 'video', label: 'Videos' },
] as const

type FilterValue = (typeof FILTERS)[number]['value']

function insightCount(chunk: KnowledgeChunk): number {
  return Array.isArray(chunk.extracted_insights)
    ? chunk.extracted_insights.filter(
        (x): x is string => typeof x === 'string'
      ).length
    : 0
}

function wordCount(chunk: KnowledgeChunk): number {
  return (chunk.raw_content ?? '').split(/\s+/).filter(Boolean).length
}

function formatRelative(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export default function KnowledgePage() {
  const [chunks, setChunks] = useState<KnowledgeChunk[]>([])
  const [loaded, setLoaded] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [filter, setFilter] = useState<FilterValue>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/dashboard/knowledge')
      .then((r) => r.json())
      .then((d) => {
        setChunks(d.chunks ?? [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const stats = useMemo(() => {
    const sources = chunks.length
    const words = chunks.reduce((sum, c) => sum + wordCount(c), 0)
    const insights = chunks.reduce((sum, c) => sum + insightCount(c), 0)
    const lastAdded =
      chunks.length > 0
        ? formatRelative(
            chunks.reduce((latest, c) =>
              new Date(c.created_at) > new Date(latest.created_at) ? c : latest
            ).created_at
          )
        : '—'
    return { sources, words, insights, lastAdded }
  }, [chunks])

  const filteredChunks = useMemo(() => {
    const q = search.trim().toLowerCase()
    return chunks.filter((c) => {
      if (filter !== 'all' && c.source_type !== filter) return false
      if (!q) return true
      const title = (c.source_title ?? '').toLowerCase()
      const raw = (c.raw_content ?? '').toLowerCase()
      return title.includes(q) || raw.includes(q)
    })
  }, [chunks, filter, search])

  async function handleDelete(chunkId: string) {
    const prev = chunks
    setChunks((p) => p.filter((c) => c.id !== chunkId))
    try {
      const res = await fetch('/api/knowledge/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunkId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Source deleted')
    } catch (e) {
      setChunks(prev)
      toast.error(`Delete failed: ${(e as Error).message}`)
    }
  }

  function handleCreated(chunk: KnowledgeChunk) {
    setChunks((p) => [chunk, ...p])
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Knowledge"
        description="Feed Nivi your expertise — she reads from this every time she writes a post or comment."
        actions={
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} />
            Add source
          </Button>
        }
      />

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 mb-5">
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {stats.sources} source{stats.sources === 1 ? '' : 's'}
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {stats.words.toLocaleString()} words
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {stats.insights} insights
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-muted-foreground">
          Last added: {stats.lastAdded}
        </span>
      </div>

      {/* Filter + search row */}
      {chunks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = filter === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`text-[12px] px-3 py-1.5 rounded-full transition-colors ${
                    active
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
          <div className="relative w-full sm:w-[260px]">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              placeholder="Search sources…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9 text-[12px]"
            />
          </div>
        </div>
      )}

      {/* Library */}
      {loaded && chunks.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Feed Nivi your expertise"
          description="Paste a podcast transcript, a blog article, notes from a call, or anything she should know about your thinking."
          action={
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} />
              Add your first source
            </Button>
          }
        />
      ) : loaded && filteredChunks.length === 0 ? (
        <p className="text-[13px] text-muted-foreground text-center py-12">
          No sources match your filters.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredChunks.map((chunk) => (
            <SourceCard
              key={chunk.id}
              chunk={chunk}
              onDelete={() => handleDelete(chunk.id)}
            />
          ))}
        </div>
      )}

      <AddSourceDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={handleCreated}
      />
    </div>
  )
}
