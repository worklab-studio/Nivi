'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  RefreshCw,
  Loader2,
  UserPlus,
  Trash2,
  Link2,
  ExternalLink,
  BookOpen,
} from 'lucide-react'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/dashboard/EmptyState'
import { Button } from '@/components/ui/button'
import { OpportunityCard, type Opportunity } from '@/components/engagement/OpportunityCard'
import { PostSheet } from '@/components/engagement/PostSheet'
import { AddTargetDialog, type Target } from '@/components/engagement/AddTargetDialog'
import { AddOpportunityDialog } from '@/components/engagement/AddOpportunityDialog'
import { PostStatusBadge } from '@/components/dashboard/PostStatusBadge'
import { format } from 'date-fns'
import { toast } from 'sonner'

interface Stats {
  pending: number
  postedThisWeek: number
  postedTotal: number
  replyRate: number
  streak: number
}

type Tab = 'queue' | 'posted' | 'targets'

export default function EngagementPage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [stats, setStats] = useState<Stats>({
    pending: 0,
    postedThisWeek: 0,
    postedTotal: 0,
    replyRate: 0,
    streak: 0,
  })
  const [loaded, setLoaded] = useState(false)
  const [tab, setTab] = useState<Tab>('queue')
  const [refreshing, setRefreshing] = useState(false)
  const [postingAll, setPostingAll] = useState(false)
  const [sheetOpp, setSheetOpp] = useState<Opportunity | null>(null)

  // Targets
  const [targets, setTargets] = useState<Target[]>([])
  const [addTargetOpen, setAddTargetOpen] = useState(false)

  // Add from URL
  const [addUrlOpen, setAddUrlOpen] = useState(false)
  // Selected opportunity for split-pane view
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)

  async function fetchEngagement() {
    const res = await fetch('/api/dashboard/engagement')
    const data = await res.json()
    setOpportunities(data.opportunities ?? [])
    setStats(
      data.stats ?? {
        pending: 0,
        postedThisWeek: 0,
        postedTotal: 0,
        replyRate: 0,
        streak: 0,
      }
    )
    setLoaded(true)
  }

  async function fetchTargets() {
    const res = await fetch('/api/dashboard/engagement/targets')
    const data = await res.json()
    setTargets(data.targets ?? [])
  }

  useEffect(() => {
    fetchEngagement()
    fetchTargets()
  }, [])

  const pending = useMemo(
    () => opportunities.filter((o) => o.status === 'pending'),
    [opportunities]
  )
  const posted = useMemo(
    () => opportunities.filter((o) => o.status === 'posted'),
    [opportunities]
  )

  // Sort pending by relevance desc, then recency desc
  const sortedPending = useMemo(() => {
    return [...pending].sort((a, b) => {
      const ra = a.relevance_score ?? 0
      const rb = b.relevance_score ?? 0
      if (rb !== ra) return rb - ra
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [pending])

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/engagement/refresh-from-targets', {
        method: 'POST',
      })
      const data = await res.json()
      if (data.ok) {
        const created = data.created ?? 0
        const skipped = data.skippedTargets ?? 0
        toast.success(
          created > 0
            ? `Found ${created} new opportunit${created === 1 ? 'y' : 'ies'}${skipped > 0 ? ` · ${skipped} target${skipped === 1 ? '' : 's'} skipped` : ''}`
            : 'No new opportunities — try Add from URL for a specific post'
        )
        fetchEngagement()
      } else {
        // If the error is "add targets first", open the Add from URL dialog
        // so the user has an immediate path forward.
        toast.error(data.error ?? 'Could not refresh')
        if (/add targets first/i.test(data.error ?? '')) {
          setAddUrlOpen(true)
        }
      }
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`)
    } finally {
      setRefreshing(false)
    }
  }

  async function handlePost(id: string) {
    try {
      const res = await fetch('/api/engagement/post-comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: id }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setOpportunities((prev) =>
        prev.map((o) =>
          o.id === id
            ? { ...o, status: 'posted' }
            : o
        )
      )
      toast.success('Comment posted')
    } catch (e) {
      toast.error(`Post failed: ${(e as Error).message}`)
    }
  }

  async function handleSkip(id: string) {
    try {
      await fetch('/api/engagement/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunityId: id }),
      })
      setOpportunities((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: 'skipped' } : o))
      )
    } catch (e) {
      toast.error(`Skip failed: ${(e as Error).message}`)
    }
  }

  function handleUpdate(id: string, draftedComment: string) {
    setOpportunities((prev) =>
      prev.map((o) =>
        o.id === id ? { ...o, drafted_comment: draftedComment } : o
      )
    )
  }

  async function handlePostAll() {
    if (sortedPending.length === 0) return
    if (
      !confirm(
        `Post all ${sortedPending.length} pending comments? This cannot be undone.`
      )
    )
      return
    setPostingAll(true)
    try {
      for (const opp of sortedPending) {
        await handlePost(opp.id)
      }
      toast.success(`Posted ${sortedPending.length} comments`)
    } finally {
      setPostingAll(false)
    }
  }

  async function handleDeleteTarget(id: string) {
    if (!confirm('Remove this target?')) return
    setTargets((prev) => prev.filter((t) => t.id !== id))
    try {
      await fetch(`/api/dashboard/engagement/targets/${id}`, {
        method: 'DELETE',
      })
      toast.success('Target removed')
    } catch {
      toast.error('Delete failed')
      fetchTargets()
    }
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Engagement"
        description="Strategic commenting compounds — 15 minutes a day beats an extra post."
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAddUrlOpen(true)}
            >
              <Link2 size={14} />
              Add from URL
            </Button>
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
              {refreshing ? 'Scanning targets…' : 'Refresh opportunities'}
            </Button>
          </div>
        }
      />

      {/* Stats pills */}
      <div className="flex flex-wrap gap-2 mb-5">
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {stats.pending} pending
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {stats.postedThisWeek} posted this week
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {stats.postedTotal} all-time
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {stats.replyRate}% reply rate
        </span>
        <span className="bg-secondary rounded-full px-3 py-1 text-[12px] text-foreground tabular-nums">
          {stats.streak}d streak
        </span>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-5">
        {(
          [
            { key: 'queue', label: `Queue (${sortedPending.length})` },
            { key: 'posted', label: `Posted (${posted.length})` },
            { key: 'targets', label: `Targets (${targets.length})` },
          ] as { key: Tab; label: string }[]
        ).map((t) => {
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

      {/* Queue — split-pane: post list left, comment editor right */}
      {tab === 'queue' && (
        <div>
          {loaded && sortedPending.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title="No pending opportunities"
              description="Add targets in the Targets tab and refresh, or paste a specific LinkedIn post URL via Add from URL."
              action={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAddUrlOpen(true)}
                  >
                    <Link2 size={14} />
                    Add from URL
                  </Button>
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
                    Refresh from targets
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="flex gap-4" style={{ height: 'calc(100vh - 300px)', minHeight: 400 }}>
              {/* LEFT: Post list */}
              <div className="w-[380px] shrink-0 border border-border rounded-xl bg-card overflow-y-auto">
                <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                  <p className="text-[12px] font-medium text-foreground">
                    {sortedPending.length} pending
                  </p>
                  {sortedPending.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] px-2"
                      onClick={handlePostAll}
                      disabled={postingAll}
                    >
                      {postingAll && <Loader2 size={10} className="animate-spin" />}
                      Post all
                    </Button>
                  )}
                </div>
                <div className="divide-y divide-border">
                  {sortedPending.map((opp) => {
                    const isSelected = selectedOpp?.id === opp.id
                    return (
                      <button
                        key={opp.id}
                        type="button"
                        onClick={() => setSelectedOpp(opp)}
                        className={`w-full text-left px-3 py-3 transition-colors ${
                          isSelected
                            ? 'bg-accent'
                            : 'hover:bg-secondary/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          {opp.author_avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={opp.author_avatar_url}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-semibold text-muted-foreground shrink-0">
                              {(opp.author_name ?? '?').slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-semibold text-foreground truncate">
                              {opp.author_name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {opp.author_headline}
                            </p>
                          </div>
                          {opp.matched_pillar && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium shrink-0">
                              {opp.matched_pillar}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1.5 leading-snug">
                          {opp.post_preview?.slice(0, 120)}
                        </p>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* RIGHT: Selected post + comment editor */}
              <div className="flex-1 border border-border rounded-xl bg-card overflow-hidden flex flex-col">
                {selectedOpp ? (
                  <>
                    {/* Post content */}
                    <div className="flex-1 overflow-y-auto p-5">
                      {/* Author header */}
                      <div className="flex items-center gap-3 mb-4">
                        {selectedOpp.author_avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={selectedOpp.author_avatar_url}
                            alt=""
                            className="w-11 h-11 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-[13px] font-semibold text-foreground">
                            {(selectedOpp.author_name ?? '?').slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-foreground">
                            {selectedOpp.author_name}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {selectedOpp.author_headline}
                          </p>
                        </div>
                        {selectedOpp.linkedin_post_url && (
                          <a
                            href={selectedOpp.linkedin_post_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>

                      {/* Post body */}
                      <div className="text-[13px] text-foreground leading-[1.7] whitespace-pre-line">
                        {selectedOpp.post_preview}
                      </div>

                      {/* Pillar + relevance */}
                      {(selectedOpp.matched_pillar || selectedOpp.relevance_score) && (
                        <div className="flex items-center gap-2 mt-4">
                          {selectedOpp.matched_pillar && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              {selectedOpp.matched_pillar}
                            </span>
                          )}
                          {selectedOpp.relevance_score != null && (
                            <span className="text-[10px] text-muted-foreground">
                              {Math.round(selectedOpp.relevance_score * 100)}% match
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Comment editor */}
                    <div className="border-t border-border p-4 space-y-3">
                      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                        Your comment
                      </p>
                      <OpportunityCard
                        key={selectedOpp.id}
                        opp={selectedOpp}
                        onPost={handlePost}
                        onSkip={async (id) => {
                          await handleSkip(id)
                          setSelectedOpp(null)
                        }}
                        onUpdate={handleUpdate}
                        onOpenPost={setSheetOpp}
                        compactMode
                      />
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <BookOpen size={24} className="mx-auto text-muted-foreground mb-2" />
                      <p className="text-[13px] text-muted-foreground">
                        Select a post to read and comment
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Posted */}
      {tab === 'posted' && (
        <div>
          {posted.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-12">
              No posted comments yet.
            </p>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-border bg-secondary/30">
                  <tr>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Date
                    </th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Author
                    </th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                      Comment
                    </th>
                    <th className="text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-[100px]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {posted.slice(0, 100).map((opp) => (
                    <tr
                      key={opp.id}
                      className="hover:bg-secondary/30 cursor-pointer"
                      onClick={() => setSheetOpp(opp)}
                    >
                      <td className="px-4 py-3 text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {format(new Date(opp.created_at), 'MMM d')}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-foreground whitespace-nowrap">
                        {opp.author_name}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        <span className="line-clamp-1">
                          {opp.drafted_comment?.slice(0, 120)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <PostStatusBadge status={opp.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Targets */}
      {tab === 'targets' && (
        <div>
          <div className="flex justify-end mb-3">
            <Button size="sm" onClick={() => setAddTargetOpen(true)}>
              <UserPlus size={14} />
              Add target
            </Button>
          </div>
          {targets.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title="No targets yet"
              description="Add authors you want to build relationships with. Whitelisted authors get a relevance boost; blacklisted authors never surface in your queue."
              action={
                <Button size="sm" onClick={() => setAddTargetOpen(true)}>
                  <Plus size={14} />
                  Add your first target
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {targets.map((t) => (
                <div
                  key={t.id}
                  className="group relative bg-card border border-border rounded-lg p-4 flex items-center gap-3 hover:border-primary/40 transition-colors"
                >
                  {t.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={t.avatar_url}
                      alt={t.author_name ?? ''}
                      className="w-10 h-10 rounded-full object-cover border border-border shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-[12px] font-semibold shrink-0">
                      {(t.author_name ?? t.author_handle ?? '?')
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground truncate">
                      {t.author_name ?? t.author_handle}
                    </p>
                    {t.author_headline && (
                      <p className="text-[11px] text-muted-foreground truncate">
                        {t.author_headline}
                      </p>
                    )}
                    <span
                      className={`inline-block mt-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                        t.mode === 'whitelist'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-destructive/10 text-destructive'
                      }`}
                    >
                      {t.mode}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteTarget(t.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                    title="Remove target"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sheet + Dialogs */}
      <PostSheet opp={sheetOpp} onClose={() => setSheetOpp(null)} />
      <AddTargetDialog
        open={addTargetOpen}
        onOpenChange={setAddTargetOpen}
        onCreated={(target) => setTargets((prev) => [target, ...prev])}
      />
      <AddOpportunityDialog
        open={addUrlOpen}
        onOpenChange={setAddUrlOpen}
        onCreated={(opp) => {
          setOpportunities((prev) => [opp, ...prev])
          setTab('queue')
        }}
      />
    </div>
  )
}
