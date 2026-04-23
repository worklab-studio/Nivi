'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCachedFetch } from '@/lib/client/dataCache'
import { PostsSkeleton } from '@/components/skeletons/PostsSkeleton'
import { List, Columns3, LayoutGrid, Search, Plus } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PostListView } from '@/components/posts/PostListView'
import { PostKanbanView } from '@/components/posts/PostKanbanView'
import { PostLinkedInView } from '@/components/posts/PostLinkedInView'
import { PostPreviewModal } from '@/components/posts/PostPreviewModal'
import type { Post } from '@/components/posts/PostCard'
import { toast } from 'sonner'

type StatusTab = 'all' | 'published' | 'scheduled' | 'draft' | 'skipped'
type ViewMode = 'list' | 'kanban' | 'linkedin'
type SortBy = 'newest' | 'oldest' | 'impressions' | 'likes' | 'comments'

const TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'published', label: 'Published' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'draft', label: 'Draft' },
  { key: 'skipped', label: 'Skipped' },
]

const SORT_OPTIONS: { key: SortBy; label: string }[] = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'impressions', label: 'Most impressions' },
  { key: 'likes', label: 'Most likes' },
  { key: 'comments', label: 'Most comments' },
]

const VIEW_ICONS: { key: ViewMode; Icon: typeof List; label: string }[] = [
  { key: 'list', Icon: List, label: 'List' },
  { key: 'kanban', Icon: Columns3, label: 'Kanban' },
  { key: 'linkedin', Icon: LayoutGrid, label: 'LinkedIn' },
]

export default function PostsPage() {
  const router = useRouter()
  const { data: postsData, loading: postsLoading, refresh: refreshPosts } = useCachedFetch<{ posts: Post[] }>(
    'posts',
    '/api/dashboard/posts',
    { ttlMs: 30_000 }
  )
  const { data: meData } = useCachedFetch<{ profile?: { name: string; headline: string; avatarUrl: string } }>(
    'me',
    '/api/dashboard/me',
    { ttlMs: 5 * 60_000 }
  )
  const posts = useMemo(() => postsData?.posts ?? [], [postsData])
  const loaded = !postsLoading
  const [tab, setTab] = useState<StatusTab>('all')
  const [view, setView] = useState<ViewMode>('list')
  const [pillarFilter, setPillarFilter] = useState('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [search, setSearch] = useState('')
  const [previewPost, setPreviewPost] = useState<Post | null>(null)
  const authorProfile = meData?.profile ?? { name: 'You', headline: '', avatarUrl: '' }

  const counts = useMemo(
    () => ({
      all: posts.length,
      published: posts.filter((p) => p.status === 'published').length,
      scheduled: posts.filter((p) => p.status === 'scheduled').length,
      draft: posts.filter((p) => p.status === 'draft').length,
      skipped: posts.filter((p) => p.status === 'skipped').length,
    }),
    [posts]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return posts
      .filter((p) => tab === 'all' || p.status === tab)
      .filter(
        (p) =>
          pillarFilter === 'all' ||
          p.content_pillar === parseInt(pillarFilter)
      )
      .filter((p) => !q || p.content.toLowerCase().includes(q))
      .sort((a, b) => {
        switch (sortBy) {
          case 'oldest':
            return (
              new Date(a.created_at).getTime() -
              new Date(b.created_at).getTime()
            )
          case 'impressions':
            return b.impressions - a.impressions
          case 'likes':
            return b.likes - a.likes
          case 'comments':
            return b.comments - a.comments
          default:
            return (
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
            )
        }
      })
  }, [posts, tab, pillarFilter, sortBy, search])

  async function handleDelete(id: string) {
    try {
      await fetch('/api/posts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      toast.success('Post deleted')
      void refreshPosts()
    } catch {
      toast.error('Delete failed')
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const res = await fetch('/api/posts/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
      const data = await res.json()
      if (data.ok && data.post) {
        toast.success('Duplicated as draft')
        void refreshPosts()
      } else {
        toast.error(data.error ?? 'Could not duplicate')
      }
    } catch {
      toast.error('Duplicate failed')
    }
  }

  function handlePostClick(post: Post) {
    if (post.status === 'draft' || post.status === 'scheduled') {
      // Editable — open in compose
      router.push(`/compose?draft=${post.id}`)
    } else {
      // Published/skipped — open preview modal with repurpose option
      setPreviewPost(post)
    }
  }

  if (postsLoading) {
    return <PostsSkeleton />
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Posts"
        description="All your content in one place."
        actions={
          <Link href="/compose">
            <Button size="sm">
              <Plus size={14} />
              Create post
            </Button>
          </Link>
        }
      />

      {/* Stats pills */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {counts.all} total
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {counts.published} published
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {counts.scheduled} scheduled
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {counts.draft} drafts
        </span>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-4">
        {TABS.map((t) => {
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
              {t.label} ({counts[t.key]})
            </button>
          )
        })}
      </div>

      {/* Filters + view toggle row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {/* Pillar filter */}
          <div className="flex gap-1">
            {['all', '1', '2', '3', '4', '5'].map((p) => {
              const active = pillarFilter === p
              return (
                <button
                  key={p}
                  onClick={() => setPillarFilter(p)}
                  className={`text-[11px] px-2.5 py-1 rounded-full transition-colors ${
                    active
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'bg-secondary/50 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p === 'all' ? 'All pillars' : `P${p}`}
                </button>
              )
            })}
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="text-[12px] h-7 px-2 rounded-md border border-border bg-card text-muted-foreground focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative w-[200px]">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              placeholder="Search posts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-7 text-[12px]"
            />
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center bg-secondary rounded-md p-0.5">
          {VIEW_ICONS.map(({ key, Icon, label }) => {
            const active = view === key
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                title={label}
                className={`w-8 h-7 flex items-center justify-center rounded transition-colors ${
                  active
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon size={15} />
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {loaded && posts.length === 0 ? (
        <EmptyState
          icon={Plus}
          title="No posts yet"
          description="Create your first post to get started."
          action={
            <Link href="/compose">
              <Button size="sm">
                <Plus size={14} />
                Create your first post
              </Button>
            </Link>
          }
        />
      ) : loaded && filtered.length === 0 ? (
        <p className="text-[13px] text-muted-foreground text-center py-12">
          No posts match your filters.
        </p>
      ) : view === 'list' ? (
        <PostListView
          posts={filtered}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onPostClick={handlePostClick}
        />
      ) : view === 'kanban' ? (
        <PostKanbanView
          posts={filtered}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onPostClick={handlePostClick}
        />
      ) : (
        <PostLinkedInView
          posts={filtered}
          authorName="You"
          authorHeadline="Your LinkedIn profile"
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onPostClick={handlePostClick}
        />
      )}

      {/* Preview modal for published/skipped posts */}
      <PostPreviewModal
        post={previewPost}
        onClose={() => setPreviewPost(null)}
        onDelete={handleDelete}
        onDuplicate={handleDuplicate}
        authorName={authorProfile.name}
        authorHeadline={authorProfile.headline}
        authorAvatarUrl={authorProfile.avatarUrl}
      />
    </div>
  )
}
