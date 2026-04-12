'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  PenSquare,
  Flame,
  ArrowRight,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  BarChart3,
  FileText,
  Calendar,
  Users,
  Sparkles,
  RefreshCw,
  X,
} from 'lucide-react'
import { StreakRow } from '@/components/dashboard/StreakRow'
import { SectionCard } from '@/components/dashboard/SectionCard'
import { ConnectionModal } from '@/components/dashboard/ConnectionModal'
import { Button } from '@/components/ui/button'
import { format, subDays } from 'date-fns'

interface OverviewData {
  userName: string
  profile: { name: string; headline: string; avatarUrl: string }
  aboutYou: string
  followers: number
  connections: number
  connectionStatus: { linkedin: boolean; whatsapp: boolean }
  audienceCount: number
  pillarCount: number
  draftsCount: number
  scheduledCount: number
  streakCount: number
  postsThisWeek: number
  streakDays: { date: string; count: number; status: 'published' | 'scheduled' | 'empty' | 'future' }[]
  metrics: {
    impressions: number
    impressionsDelta: number
    likes: number
    likesDelta: number
    comments: number
    commentsDelta: number
    engagementRate: number
    streak: number
    totalPublished: number
  }
  today: {
    status: 'draft' | 'scheduled' | 'published' | null
    preview?: string
    scheduledTime?: string
    impressions?: number
    postId?: string
  }
  weekDays: { date: string; status: string | null }[]
  dailyImpressions: { date: string; impressions: number }[]
  pillarPerformance: { pillar: string; engagement: number; count: number }[]
  hookPerformance: { hook: string; comments: number; count: number }[]
  topPosts: {
    id: string
    preview: string
    impressions: number
    likes: number
    comments: number
  }[]
  recentEngagement: {
    id: string
    authorName: string
    comment: string
    status: string
  }[]
}

function fmtNum(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const PILLAR_COLORS = ['#2C58B6', '#14B8A6', '#F59E0B', '#8B5CF6', '#EF4444']

function MetricCard({
  icon: Icon,
  label,
  value,
  delta,
  hint,
}: {
  icon: typeof Eye
  label: string
  value: string
  delta?: number
  hint?: string
}) {
  const positive = (delta ?? 0) >= 0
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex items-start gap-3">
      <div className="size-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
        <Icon size={16} className="text-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
        <p className="text-[22px] font-semibold text-foreground tabular-nums leading-tight mt-0.5">
          {value}
        </p>
        <div className="flex items-center gap-1.5 mt-1">
          {typeof delta === 'number' && delta !== 0 && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                positive
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {positive ? '↑' : '↓'} {Math.abs(delta)}%
            </span>
          )}
          {hint && (
            <span className="text-[10px] text-muted-foreground">{hint}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OverviewPage() {
  const [data, setData] = useState<OverviewData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showConnectModal, setShowConnectModal] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    fetch('/api/dashboard/overview')
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
        // Auto-show modal if both disconnected and not dismissed recently
        const dismissed = localStorage.getItem('connection-modal-dismissed')
        const dismissedAt = dismissed ? parseInt(dismissed) : 0
        const hoursSinceDismiss = (Date.now() - dismissedAt) / 3600000
        if (!d.connectionStatus?.linkedin && !d.connectionStatus?.whatsapp && hoursSinceDismiss > 24) {
          setShowConnectModal(true)
        }
      })
      .catch(() => setLoading(false))
  }, [])

  // Full current year: Jan 1 → Dec 31
  const yearStartDate = new Date(new Date().getFullYear(), 0, 1)
  const yearEndDate = new Date(new Date().getFullYear(), 11, 31)
  const totalYearDays = Math.ceil((yearEndDate.getTime() - yearStartDate.getTime()) / 86400000) + 1
  const defaultDays = Array.from(
    { length: totalYearDays },
    (_, i) => ({
      date: format(new Date(yearStartDate.getTime() + i * 86400000), 'yyyy-MM-dd'),
      count: 0,
      status: 'empty' as const,
    })
  )
  const streakDays = data?.streakDays ?? defaultDays

  // Hero CTA logic
  const todayStatus = data?.today.status
  const heroAction =
    todayStatus === 'scheduled'
      ? { label: 'Review scheduled post', href: `/compose?draft=${data?.today.postId}` }
      : todayStatus === 'published'
        ? { label: 'Compose another', href: '/compose' }
        : { label: 'Write a post', href: '/compose' }

  const todayMessage =
    todayStatus === 'scheduled'
      ? `Post scheduled${data?.today.scheduledTime ? ` for ${new Date(data.today.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`
      : todayStatus === 'published'
        ? `Today's post is live${data?.today.impressions ? ` — ${fmtNum(data.today.impressions)} impressions` : ''}`
        : todayStatus === 'draft'
          ? 'You have a draft ready to go'
          : 'No post today yet'

  const hasAnyData = (data?.metrics.totalPublished ?? 0) > 0

  if (loading) {
    return (
      <div className="px-6 py-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-secondary rounded-xl" />
          <div className="grid grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-secondary rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-secondary rounded-xl" />
        </div>
      </div>
    )
  }

  return (
    <div className="px-6 py-6 max-w-[1400px]">
      {/* ──── PROFILE HERO ──── */}
      <div className="bg-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {data?.profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.profile.avatarUrl}
              alt={data.profile.name}
              className="w-16 h-16 rounded-full object-cover border-2 border-border shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xl font-semibold shrink-0">
              {(data?.userName ?? '?').slice(0, 2).toUpperCase()}
            </div>
          )}

          {/* Name + bio */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-[22px] font-semibold text-foreground tracking-tight leading-tight">
                  {greeting()}, {data?.profile.name ?? data?.userName ?? '…'}
                </h1>
                {data?.profile.headline && (
                  <p className="text-[13px] text-muted-foreground mt-0.5">
                    {data.profile.headline}
                  </p>
                )}
                {/* LinkedIn stats — show if available */}
                {((data?.followers ?? 0) > 0 || (data?.connections ?? 0) > 0 || (data?.metrics.totalPublished ?? 0) > 0) && (
                  <div className="flex items-center gap-3 mt-1">
                    {(data?.followers ?? 0) > 0 && (
                      <span className="text-[12px] text-foreground">
                        <span className="font-semibold">{(data?.followers ?? 0).toLocaleString()}</span>
                        <span className="text-muted-foreground"> followers</span>
                      </span>
                    )}
                    {(data?.connections ?? 0) > 0 && (
                      <span className="text-[12px] text-foreground">
                        <span className="font-semibold">{(data?.connections ?? 0).toLocaleString()}</span>
                        <span className="text-muted-foreground"> connections</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await fetch('/api/dashboard/sync-analytics', { method: 'POST' })
                    const d = await res.json()
                    if (d.ok) {
                      window.location.reload()
                    }
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground border border-border px-2.5 py-1.5 rounded-md transition-colors"
                  title="Sync LinkedIn analytics"
                >
                  <RefreshCw size={12} />
                </button>
                <Link href={heroAction.href}>
                  <Button size="sm" className="gap-1.5">
                    <PenSquare size={14} />
                    {heroAction.label}
                  </Button>
                </Link>
              </div>
            </div>

            {/* Week strip + badges */}
            <div className="flex items-center gap-3 mt-3 flex-wrap">
              {/* 7-day boxes */}
              <div className="flex items-center gap-1">
                {(data?.weekDays ?? []).map((d) => {
                  const dayDate = new Date(d.date)
                  const dayLabel = format(dayDate, 'EEE').slice(0, 2)
                  const dayNum = format(dayDate, 'd')
                  const isToday = format(new Date(), 'yyyy-MM-dd') === d.date
                  return (
                    <div
                      key={d.date}
                      className={`flex flex-col items-center w-10 py-1.5 rounded-lg transition-colors ${
                        isToday
                          ? 'bg-primary/10 border border-primary/30'
                          : 'bg-secondary/50'
                      }`}
                    >
                      <span className="text-[9px] text-muted-foreground uppercase font-medium">
                        {dayLabel}
                      </span>
                      <span className={`text-[12px] font-semibold mt-0.5 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                        {dayNum}
                      </span>
                      <div
                        className={`w-2 h-2 rounded-full mt-1 ${
                          d.status === 'published'
                            ? 'bg-emerald-500'
                            : d.status === 'scheduled'
                              ? 'bg-blue-500'
                              : d.status === 'draft'
                                ? 'bg-amber-500'
                                : 'bg-border'
                        }`}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Streak badge */}
              {(data?.metrics.streak ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <Flame size={11} />
                  {data?.metrics.streak}d
                </span>
              )}

              {/* Status badges */}
            </div>
          </div>
        </div>

        {/* Today's post preview */}
        {todayStatus && data?.today.preview && (
          <Link
            href={`/compose?draft=${data.today.postId}`}
            className="block mt-4 p-3 bg-secondary/50 border border-border rounded-lg hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] text-muted-foreground">{todayMessage}</span>
              <span className={`text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-full ${
                todayStatus === 'published'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : todayStatus === 'scheduled'
                    ? 'bg-blue-500/10 text-blue-600'
                    : 'bg-secondary text-muted-foreground'
              }`}>
                {todayStatus}
              </span>
            </div>
            <p className="text-[12px] text-foreground/80 line-clamp-2 leading-relaxed">
              {data.today.preview}
            </p>
          </Link>
        )}
      </div>

      {/* ──── CONNECTION BANNER ──── */}
      {!loading && !bannerDismissed && (!data?.connectionStatus?.linkedin || !data?.connectionStatus?.whatsapp) && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 mb-6 flex items-start gap-4">
          <div className="flex-1 space-y-1.5">
            {!data?.connectionStatus?.linkedin && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <p className="text-[12px] text-foreground">
                  <span className="font-medium">LinkedIn not connected</span>
                  <span className="text-muted-foreground"> — connect to sync analytics and publish posts</span>
                </p>
              </div>
            )}
            {!data?.connectionStatus?.whatsapp && (
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <p className="text-[12px] text-foreground">
                  <span className="font-medium">WhatsApp not connected</span>
                  <span className="text-muted-foreground"> — connect for morning briefs and post approvals</span>
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowConnectModal(true)}
              className="text-[11px] px-3 py-1.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 transition-opacity"
            >
              Connect now
            </button>
            <button
              onClick={() => {
                setBannerDismissed(true)
                localStorage.setItem('connection-modal-dismissed', String(Date.now()))
              }}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ──── CONNECTION MODAL ──── */}
      <ConnectionModal
        open={showConnectModal}
        onClose={() => {
          setShowConnectModal(false)
          localStorage.setItem('connection-modal-dismissed', String(Date.now()))
        }}
        linkedinConnected={data?.connectionStatus?.linkedin ?? false}
        whatsappConnected={data?.connectionStatus?.whatsapp ?? false}
        onLinkedInConnected={() => window.location.reload()}
      />

      {/* ──── METRICS ──── */}
      {(() => {
        const cards = [
          { icon: Eye, label: 'Impressions', value: data?.metrics.impressions ?? 0, fmtValue: fmtNum(data?.metrics.impressions ?? 0), delta: data?.metrics.impressionsDelta, hint: 'vs last week' },
          { icon: Heart, label: 'Reactions', value: data?.metrics.likes ?? 0, fmtValue: fmtNum(data?.metrics.likes ?? 0), delta: data?.metrics.likesDelta, hint: 'vs last week' },
          { icon: MessageCircle, label: 'Comments', value: data?.metrics.comments ?? 0, fmtValue: fmtNum(data?.metrics.comments ?? 0), delta: data?.metrics.commentsDelta, hint: 'vs last week' },
          { icon: BarChart3, label: 'Engagement', value: data?.metrics.engagementRate ?? 0, fmtValue: `${data?.metrics.engagementRate ?? 0}%`, hint: 'avg rate' },
          { icon: FileText, label: 'Published', value: data?.metrics.totalPublished ?? 0, fmtValue: `${data?.metrics.totalPublished ?? 0}`, hint: 'total posts', alwaysShow: true },
        ]
        // Always show Published; others only if they have data or if any metric has data
        const anyData = cards.some((c) => c.value > 0)
        const visible = anyData ? cards : cards.filter((c) => (c as { alwaysShow?: boolean }).alwaysShow)
        const cols = visible.length >= 5 ? 'lg:grid-cols-5' : visible.length >= 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'
        return (
          <div className={`grid grid-cols-2 md:grid-cols-3 ${cols} gap-3 mb-6`}>
            {visible.map((c) => (
              <MetricCard
                key={c.label}
                icon={c.icon}
                label={c.label}
                value={c.fmtValue}
                delta={c.delta}
                hint={c.hint}
              />
            ))}
          </div>
        )
      })()}

      {/* ──── INSIGHTS ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Impressions chart */}
        <SectionCard title="Impressions" description="Last 30 days">
            {hasAnyData ? (
              <div className="h-[200px] -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data?.dailyImpressions ?? []}>
                    <defs>
                      <linearGradient id="overview-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      stroke="hsl(var(--border))"
                      strokeDasharray="3 3"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={40}
                    />
                    <YAxis
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      width={35}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="impressions"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#overview-area)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyInsight
                icon={TrendingUp}
                message="Publish your first post to see impression trends"
                actionLabel="Compose a post"
                actionHref="/compose"
              />
            )}
          </SectionCard>

        {/* Content pillars */}
        <SectionCard title="Content pillars">
            {(data?.pillarPerformance ?? []).some((p) => p.count > 0) ? (
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data?.pillarPerformance ?? []}
                    layout="vertical"
                    margin={{ left: 0 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="pillar"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 8,
                        fontSize: 12,
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Bar dataKey="engagement" radius={[0, 4, 4, 0]}>
                      {(data?.pillarPerformance ?? []).map((_, i) => (
                        <Cell key={i} fill={PILLAR_COLORS[i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyInsight
                icon={BarChart3}
                message="Tag posts with content pillars to see performance"
                actionLabel="Set up pillars"
                actionHref="/writing-style"
                small
              />
            )}
          </SectionCard>

          {/* Hook types */}
          <SectionCard title="Best hook types">
            {(data?.hookPerformance ?? []).length > 0 ? (
              <div className="space-y-2.5">
                {data!.hookPerformance.map((h, i) => {
                  const maxComments = Math.max(
                    ...data!.hookPerformance.map((x) => x.comments),
                    1
                  )
                  return (
                    <div key={h.hook}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-foreground capitalize font-medium">
                          {h.hook}
                        </span>
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {h.comments} avg
                        </span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(h.comments / maxComments) * 100}%`,
                            background: PILLAR_COLORS[i % 5],
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyInsight
                icon={Sparkles}
                message="Hook performance data will appear after more posts"
                small
              />
            )}
          </SectionCard>

          {/* Recent engagement */}
          <SectionCard
            title="Recent engagement"
            actions={
              (data?.recentEngagement?.length ?? 0) > 0 ? (
                <Link
                  href="/engagement"
                  className="text-[11px] text-muted-foreground hover:text-foreground"
                >
                  View all
                </Link>
              ) : undefined
            }
          >
            {(data?.recentEngagement?.length ?? 0) > 0 ? (
              <div className="divide-y divide-border">
                {data!.recentEngagement.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-start gap-2.5 py-2.5"
                  >
                    <div className="size-7 rounded-full bg-accent flex items-center justify-center text-[9px] font-semibold text-foreground shrink-0 mt-0.5">
                      {e.authorName.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-foreground font-medium truncate">
                        {e.authorName}
                      </p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                        {e.comment}
                      </p>
                    </div>
                    <span className={`text-[8px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded-full shrink-0 mt-1 ${
                      e.status === 'posted'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-secondary text-muted-foreground'
                    }`}>
                      {e.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyInsight
                icon={Users}
                message="Start engaging to see activity here"
                actionLabel="Go to Engagement"
                actionHref="/engagement"
                small
              />
            )}
          </SectionCard>

        {/* Top performing posts — full width row */}
        <SectionCard
          title="Top performing posts"
          className="lg:col-span-2"
          actions={
            hasAnyData ? (
              <Link
                href="/posts"
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                View all <ArrowRight size={10} />
              </Link>
            ) : undefined
          }
        >
          {(data?.topPosts ?? []).length > 0 ? (
            <div className="divide-y divide-border">
              {data!.topPosts.map((post, i) => (
                <Link
                  key={post.id}
                  href={`/compose?draft=${post.id}`}
                  className="flex items-center gap-3 py-3 hover:bg-secondary/30 rounded-lg px-2 -mx-2 transition-colors"
                >
                  <span
                    className={`text-[13px] font-semibold w-5 tabular-nums text-center ${
                      i === 0 ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <p className="text-[12px] text-foreground flex-1 truncate leading-snug">
                    {post.preview}
                  </p>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1">
                      <Eye size={10} /> {fmtNum(post.impressions)}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1">
                      <Heart size={10} /> {fmtNum(post.likes)}
                    </span>
                    <span className="text-[10px] text-muted-foreground tabular-nums flex items-center gap-1">
                      <MessageCircle size={10} /> {post.comments}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyInsight
              icon={FileText}
              message="Your top posts will appear here after publishing"
              actionLabel="Write your first post"
              actionHref="/compose"
            />
          )}
        </SectionCard>
      </div>
    </div>
  )
}

/** GitHub-style yearly posting heatmap — full current year, edge-to-edge */
function YearlyHeatmap({
  days,
}: {
  days: { date: string; count: number; status: string }[]
}) {
  // Group into weeks (Mon=0)
  const weeks: (typeof days[0] | null)[][] = []
  let week: (typeof days[0] | null)[] = []
  const firstDay = new Date(days[0]?.date ?? new Date())
  const pad = (firstDay.getDay() + 6) % 7
  for (let i = 0; i < pad; i++) week.push(null)
  for (const d of days) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length) { while (week.length < 7) week.push(null); weeks.push(week) }

  // Month labels
  const months: { label: string; weekIdx: number }[] = []
  let prev = ''
  weeks.forEach((w, wi) => {
    const f = w.find((d) => d?.date)
    if (f?.date) {
      const m = format(new Date(f.date), 'MMM')
      if (m !== prev) { months.push({ label: m, weekIdx: wi }); prev = m }
    }
  })

  const todayStr = format(new Date(), 'yyyy-MM-dd')

  function color(d: typeof days[0] | null) {
    if (!d) return 'bg-transparent'
    if (d.status === 'future') return 'bg-muted/30'
    if (d.count >= 3) return 'bg-emerald-600'
    if (d.count === 2) return 'bg-emerald-500'
    if (d.count === 1) return 'bg-emerald-400'
    if (d.status === 'scheduled') return 'bg-blue-400/70'
    return 'bg-secondary'
  }

  const total = days.filter((d) => d.count > 0).length

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 mb-6">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[12px] font-medium text-foreground">
          {total} post{total !== 1 ? 's' : ''} in {new Date().getFullYear()}
        </p>
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <span>Less</span>
          {['bg-secondary', 'bg-emerald-400', 'bg-emerald-500', 'bg-emerald-600'].map((c) => (
            <div key={c} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Month labels — full width */}
      <div className="flex mb-1">
        {months.map((m, i) => {
          const next = months[i + 1]?.weekIdx ?? weeks.length
          const span = next - m.weekIdx
          return (
            <span
              key={`${m.label}-${m.weekIdx}`}
              className="text-[9px] text-muted-foreground"
              style={{ flex: span }}
            >
              {m.label}
            </span>
          )
        })}
      </div>

      {/* Grid — flex cells fill width, fixed height for perfect squares */}
      <div className="flex gap-[2px]">
        {weeks.map((wk, wi) => (
          <div key={wi} className="flex-1 flex flex-col gap-[2px]">
            {wk.map((d, di) => (
              <div
                key={`${wi}-${di}`}
                title={d?.date ? `${d.date}: ${d.count} post${d.count !== 1 ? 's' : ''}` : ''}
                className={`w-full rounded-[2px] ${color(d)} ${d?.date === todayStr ? 'ring-1 ring-primary' : ''}`}
                style={{ paddingBottom: '100%' }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Reusable empty state for insight cards */
function EmptyInsight({
  icon: Icon,
  message,
  actionLabel,
  actionHref,
  small,
}: {
  icon: typeof Eye
  message: string
  actionLabel?: string
  actionHref?: string
  small?: boolean
}) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${small ? 'py-4' : 'py-8'}`}>
      <div className={`rounded-full bg-secondary flex items-center justify-center mb-2 ${small ? 'size-8' : 'size-10'}`}>
        <Icon size={small ? 14 : 16} className="text-muted-foreground" />
      </div>
      <p className={`text-muted-foreground ${small ? 'text-[11px]' : 'text-[12px]'}`}>
        {message}
      </p>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-[11px] text-primary hover:underline mt-1.5 inline-flex items-center gap-1"
        >
          {actionLabel} <ArrowRight size={10} />
        </Link>
      )}
    </div>
  )
}
