'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useState } from 'react'
import { Check } from 'lucide-react'

const PLANS = [
  {
    id: 'dashboard',
    name: 'Nivi Starter',
    price: 29,
    description: 'All dashboard features for LinkedIn growth',
    features: [
      'AI Post Composer with inline editing',
      'Content Calendar with drag-and-drop',
      'Inspiration Library (100+ creators)',
      'Brand Identity & Voice DNA',
      'Writing Style Templates',
      'Knowledge Base',
      'Strategic Engagement tools',
      'Performance Analytics',
      'Unlimited drafts & scheduling',
    ],
    highlight: false,
  },
  {
    id: 'complete',
    name: 'Nivi Pro',
    price: 35,
    badge: 'Most popular',
    description: 'Dashboard + Nivi on WhatsApp',
    features: [
      'Everything in Nivi Starter',
      'Nivi on WhatsApp — your AI strategist',
      'Daily morning post briefs',
      'One-word publishing (reply "POST")',
      'Conversational post editing',
      'Engagement opportunity alerts',
      'Voice note → post conversion',
      'Long-term memory & learning',
      'Priority support',
    ],
    highlight: true,
  },
]

export default function PricingPage() {
  const { isSignedIn } = useUser()
  const [loading, setLoading] = useState<string | null>(null)

  const handleSelect = async (planId: string) => {
    if (!isSignedIn) {
      window.location.href = '/sign-up'
      return
    }
    setLoading(planId)
    const res = await fetch('/api/lemonsqueezy/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: planId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <Link href="/" className="font-sans text-2xl font-bold">Nivi</Link>
        <div className="flex items-center gap-6">
          {isSignedIn ? (
            <Link href="/overview" className="text-sm text-[#888] hover:text-white transition-colors">Dashboard</Link>
          ) : (
            <>
              <Link href="/sign-in" className="text-sm text-[#888] hover:text-white transition-colors">Sign in</Link>
              <Link href="/sign-up" className="bg-white text-black text-sm px-5 py-2 rounded-lg font-medium hover:bg-white/90 transition-colors">
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Header */}
      <div className="text-center pt-16 pb-12 px-8">
        <h1 className="font-sans text-[44px] font-bold tracking-tight mb-4">
          Simple pricing
        </h1>
        <p className="text-[#888] text-lg max-w-lg mx-auto">
          Start with a 7-day free trial. No credit card required.
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-4xl mx-auto px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl p-8 ${
                plan.highlight
                  ? 'bg-[#111] border-2 border-white/20'
                  : 'bg-[#111] border border-[#222]'
              }`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-6 bg-white text-black text-[11px] font-semibold px-3 py-1 rounded-full">
                  {plan.badge}
                </span>
              )}

              <h3 className="text-[20px] font-semibold mb-1">{plan.name}</h3>
              <p className="text-[13px] text-[#888] mb-5">{plan.description}</p>

              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-[48px] font-bold">${plan.price}</span>
                <span className="text-[#888] text-[15px]">/month</span>
              </div>

              <button
                onClick={() => handleSelect(plan.id)}
                disabled={loading !== null}
                className={`w-full py-3.5 rounded-lg text-[14px] font-medium transition-all mb-8 ${
                  plan.highlight
                    ? 'bg-white text-black hover:bg-white/90 hover:shadow-[0_0_24px_rgba(255,255,255,0.1)]'
                    : 'bg-[#222] text-white hover:bg-[#333]'
                } disabled:opacity-50`}
              >
                {loading === plan.id ? 'Loading…' : 'Start 7-day free trial'}
              </button>

              <ul className="space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-[#aaa]">
                    <Check size={14} className="text-[#22c55e] mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-center text-[12px] text-[#555] mt-8">
          Cancel anytime. No long-term contracts. Prices in USD.
        </p>
      </div>
    </div>
  )
}
