'use client'

import { useState, useEffect } from 'react'
import { NiviMessage } from '@/components/nivi/NiviMessage'
import { MetricCard } from '@/components/dashboard/MetricCard'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts'

interface AnalyticsData {
  totalImpressions: number
  avgEngagement: number
  totalPublished: number
  peakImpressions: number
  dailyImpressions: { date: string; impressions: number }[]
  pillarPerformance: { pillar: string; engagement: number }[]
  hookPerformance: { hook: string; comments: number }[]
  heatmap: { day: number; hour: number; engagement: number }[]
  topPosts: {
    id: string
    preview: string
    impressions: number
    likes: number
    comments: number
    pillar: number | null
  }[]
}

const PILLAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444']
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.[0]) return null
  return (
    <div className="bg-accent border border-border rounded px-3 py-2">
      <p className="font-sans text-[10px] text-muted-foreground">{label}</p>
      <p className="font-sans text-[13px] text-white">{payload[0].value.toLocaleString()}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/analytics')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  const avgImpressions = data?.dailyImpressions.length
    ? data.dailyImpressions.reduce((s, d) => s + d.impressions, 0) / data.dailyImpressions.length
    : 0

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="font-sans text-2xl font-medium text-foreground">Analytics</h1>
        <p className="font-sans text-xs text-muted-foreground mt-1 tracking-wider uppercase">Performance insights</p>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total Impressions" value={data?.totalImpressions ?? 0} />
        <MetricCard label="Avg Engagement" value={data?.avgEngagement ?? 0} suffix="%" />
        <MetricCard label="Posts Published" value={data?.totalPublished ?? 0} />
        <MetricCard label="Peak Impressions" value={data?.peakImpressions ?? 0} />
      </div>

      {/* Impressions trend */}
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
          Impressions — Last 30 days
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data?.dailyImpressions ?? []}>
            <CartesianGrid stroke="#1e1e1e" strokeDasharray="none" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#555' }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              orientation="right"
              tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#555' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={avgImpressions} stroke="#555" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="impressions" stroke="#ffffff" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pillar performance */}
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
            Pillar Performance
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.pillarPerformance ?? []}>
              <XAxis
                dataKey="pillar"
                tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#555' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#555' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="engagement" radius={[4, 4, 0, 0]}>
                {(data?.pillarPerformance ?? []).map((_, i) => (
                  <rect key={i} fill={PILLAR_COLORS[i % 5]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hook performance */}
        <div className="bg-card border border-border rounded-lg p-5">
          <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
            Hook Type Performance
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.hookPerformance ?? []}>
              <XAxis
                dataKey="hook"
                tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#555' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: 'DM Mono', fill: '#555' }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="comments" fill="#ffffff" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Posting time heatmap */}
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
          Posting Time Heatmap
        </p>
        <div className="overflow-x-auto">
          <div className="flex gap-0.5">
            <div className="w-8 shrink-0" />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="w-[14px] text-center">
                {h % 4 === 0 && (
                  <span className="font-sans text-[9px] text-muted-foreground">{h}</span>
                )}
              </div>
            ))}
          </div>
          {DAYS.map((day, di) => (
            <div key={day} className="flex gap-0.5 mt-0.5">
              <div className="w-8 shrink-0 font-sans text-[9px] text-muted-foreground flex items-center">
                {day}
              </div>
              {Array.from({ length: 24 }, (_, h) => {
                const cell = data?.heatmap.find((c) => c.day === di && c.hour === h)
                const opacity = cell ? Math.min(cell.engagement / 100, 0.8) : 0.05
                return (
                  <div
                    key={h}
                    className="w-[14px] h-[14px] rounded-[2px]"
                    style={{ backgroundColor: `rgba(255,255,255,${opacity})` }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Nivi insight */}
      <NiviMessage
        message="Your highest engagement comes from contrarian hooks posted between 9-10 AM. Wednesday and Thursday are your best days."
        timestamp="analysis"
        animate={false}
      />

      {/* Top 5 posts */}
      <div className="bg-card border border-border rounded-lg p-5">
        <p className="font-sans text-[10px] text-muted-foreground uppercase tracking-widest mb-4">
          Top 5 Posts
        </p>
        <div className="space-y-3">
          {(data?.topPosts ?? []).map((post, i) => (
            <div
              key={post.id}
              className="flex items-center gap-4 py-2 border-b border-border last:border-0"
            >
              <span className={`font-sans text-[14px] w-6 ${i === 0 ? 'text-white' : 'text-muted-foreground'}`}>
                {i + 1}
              </span>
              <p className={`font-sans text-[12px] flex-1 truncate ${i === 0 ? 'text-white' : 'text-muted-foreground'}`}>
                {post.preview}
              </p>
              <span className="font-sans text-[11px] text-muted-foreground w-20 text-right">
                {post.impressions.toLocaleString()}
              </span>
              <span className="font-sans text-[11px] text-muted-foreground w-12 text-right">
                {post.likes}
              </span>
              <span className="font-sans text-[11px] text-muted-foreground w-12 text-right">
                {post.comments}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
