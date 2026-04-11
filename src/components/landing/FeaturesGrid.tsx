'use client'

import {
  PenSquare,
  Brain,
  Smartphone,
  MessageCircle,
  Calendar,
  Lightbulb,
  Target,
  BarChart3,
  RefreshCw,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const FEATURES: { icon: LucideIcon; title: string; desc: string }[] = [
  {
    icon: PenSquare,
    title: 'AI Post Composer',
    desc: 'Interactive editor with inline AI edits. Select text, rewrite, expand, or punch it up. LinkedIn-accurate preview with formatting toolbar.',
  },
  {
    icon: Brain,
    title: 'Voice DNA',
    desc: 'Nivi studies your writing samples, interview answers, and creator templates. Every post sounds like you — not AI.',
  },
  {
    icon: Smartphone,
    title: 'WhatsApp-First',
    desc: 'Morning briefs, post approvals, engagement alerts — all in WhatsApp. Publish with one word. No dashboard required.',
  },
  {
    icon: MessageCircle,
    title: 'Strategic Engagement',
    desc: 'Auto-scrapes target accounts for new posts. Draft voice-matched comments on demand. Build relationships at scale.',
  },
  {
    icon: Calendar,
    title: 'Content Calendar',
    desc: 'Drag-and-drop scheduling with 15-minute snap zones. Move posts between days, or back to drafts. Real-time red line.',
  },
  {
    icon: Lightbulb,
    title: 'Inspiration Library',
    desc: '100+ top LinkedIn creators scraped weekly. Trending posts, creator archetypes, hook analysis. Remix any post in your voice.',
  },
  {
    icon: Target,
    title: 'Brand Identity',
    desc: 'Import from LinkedIn, define your story, offers, and target audiences. Nivi uses this context for every piece of content.',
  },
  {
    icon: BarChart3,
    title: 'Performance Analytics',
    desc: 'Track impressions, engagement rates, content pillar performance, and hook types. Data-driven content strategy.',
  },
  {
    icon: RefreshCw,
    title: 'Memory & Learning',
    desc: 'Same brain on WhatsApp and dashboard. Nivi remembers preferences, learns from edits, and gets smarter over time.',
  },
]

export function FeaturesGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {FEATURES.map(({ icon: Icon, title, desc }) => (
        <div
          key={title}
          className="bg-[#111] border border-[#222] rounded-xl p-6 hover:border-[#333] transition-colors group"
        >
          <div className="size-10 rounded-lg bg-[#1a1a1a] border border-[#252525] flex items-center justify-center mb-4 group-hover:border-[#333] transition-colors">
            <Icon size={18} className="text-[#888] group-hover:text-white transition-colors" />
          </div>
          <h3 className="text-[15px] font-semibold text-white mb-2">{title}</h3>
          <p className="text-[13px] text-[#888] leading-relaxed">{desc}</p>
        </div>
      ))}
    </div>
  )
}
