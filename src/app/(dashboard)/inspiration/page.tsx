'use client'

import { useEffect, useMemo, useState } from 'react'
import { Search, RefreshCw, Loader2, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  InspirationCard,
  type InspirationPost,
} from '@/components/inspiration/InspirationCard'
import { toast } from 'sonner'

type Tab = 'trending' | 'library'

const FORMAT_FILTERS = [
  { key: 'all', label: 'All formats' },
  { key: 'hook_story', label: 'Hook + Story' },
  { key: 'listicle', label: 'Listicle' },
  { key: 'contrarian', label: 'Contrarian' },
  { key: 'data_led', label: 'Data-led' },
  { key: 'confession', label: 'Confession' },
  { key: 'observation', label: 'Observation' },
]

const TOPIC_FILTERS = [
  { key: 'all', label: 'All topics' },
  { key: 'building_in_public', label: 'Building in public' },
  { key: 'ai_tools', label: 'AI tools' },
  { key: 'design_thinking', label: 'Design' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'saas', label: 'SaaS' },
  { key: 'personal_growth', label: 'Personal growth' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'productivity', label: 'Productivity' },
]

const SORT_OPTIONS = [
  { key: 'shuffle', label: 'Shuffle' },
  { key: 'hook_score', label: 'Best hooks' },
  { key: 'likes', label: 'Most liked' },
  { key: 'newest', label: 'Newest' },
]

export default function InspirationPage() {
  const [posts, setPosts] = useState<InspirationPost[]>([])
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>('trending')
  const [formatFilter, setFormatFilter] = useState('all')
  const [topicFilter, setTopicFilter] = useState('all')
  const [sortBy, setSortBy] = useState('shuffle')
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  async function fetchPosts() {
    const params = new URLSearchParams({ tab, sort: sortBy, limit: '50' })
    if (formatFilter !== 'all') params.set('format', formatFilter)
    if (topicFilter !== 'all') params.set('topic', topicFilter)

    const res = await fetch(`/api/dashboard/inspiration?${params}`)
    const data = await res.json()
    setPosts(data.posts ?? [])
    setLoaded(true)
  }

  useEffect(() => {
    fetchPosts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, formatFilter, topicFilter, sortBy])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return posts
    return posts.filter(
      (p) =>
        p.content.toLowerCase().includes(q) ||
        p.author_name.toLowerCase().includes(q)
    )
  }, [posts, search])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/admin/inspiration/refresh', {
        method: 'POST',
      })
      const data = await res.json()
      if (data.ok) {
        const parts = [`Scraped ${data.scraped}`]
        if (data.inserted > 0) parts.push(`${data.inserted} new`)
        if (data.skipped > 0) parts.push(`${data.skipped} already in library`)
        if (data.trending > 0) parts.push(`${data.trending} trending`)
        toast.success(parts.join(' · '))
        fetchPosts()
      } else {
        toast.error(data.error ?? 'Refresh failed')
      }
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`)
    } finally {
      setRefreshing(false)
    }
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Inspiration"
        description="High-performing LinkedIn posts to spark your next idea. Remix any post in your voice."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {refreshing ? 'Scraping LinkedIn…' : 'Refresh trending'}
          </Button>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-4">
        {[
          { key: 'trending' as Tab, label: 'Trending' },
          { key: 'library' as Tab, label: 'Library' },
        ].map((t) => {
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-[13px] px-3 py-2 border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Filters — single row with dropdowns */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={formatFilter}
          onChange={(e) => setFormatFilter(e.target.value)}
          className="text-[12px] h-8 px-3 rounded-md border border-border bg-card text-foreground focus:outline-none"
        >
          {FORMAT_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          className="text-[12px] h-8 px-3 rounded-md border border-border bg-card text-foreground focus:outline-none"
        >
          {TOPIC_FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-[12px] h-8 px-3 rounded-md border border-border bg-card text-foreground focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="relative flex-1 min-w-[180px] max-w-[280px] ml-auto">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            placeholder="Search posts or authors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-[12px]"
          />
        </div>

        {/* Active filter chips — show below only when filters are active */}
        {(formatFilter !== 'all' || topicFilter !== 'all') && (
          <div className="w-full flex items-center gap-1.5 pt-1">
            {formatFilter !== 'all' && (
              <button
                onClick={() => setFormatFilter('all')}
                className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1 hover:bg-primary/20 transition-colors"
              >
                {FORMAT_FILTERS.find((f) => f.key === formatFilter)?.label}
                <span className="text-primary/60">×</span>
              </button>
            )}
            {topicFilter !== 'all' && (
              <button
                onClick={() => setTopicFilter('all')}
                className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1 hover:bg-primary/20 transition-colors"
              >
                {TOPIC_FILTERS.find((f) => f.key === topicFilter)?.label}
                <span className="text-primary/60">×</span>
              </button>
            )}
            <button
              onClick={() => {
                setFormatFilter('all')
                setTopicFilter('all')
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Grid */}
      {loaded && filtered.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title={
            tab === 'trending'
              ? 'No trending posts yet'
              : 'No inspiration posts yet'
          }
          description={
            tab === 'trending'
              ? 'Click Refresh trending to scrape fresh posts from top LinkedIn creators.'
              : 'Refresh trending to populate the library, or seed posts via the API.'
          }
          action={
            <Button
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              {refreshing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
              Refresh trending
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((post) => (
            <InspirationCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  )
}
