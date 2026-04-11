'use client'

import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import { useState } from 'react'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 19,
    features: [
      '1 LinkedIn account',
      '30 AI posts per month',
      'WhatsApp daily delivery',
      'Basic analytics',
      '30-day memory',
    ],
    highlight: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    badge: 'Most popular',
    features: [
      'Everything in Starter',
      '2 LinkedIn + 1 X account',
      '90 AI posts per month',
      'Image generation',
      'Full memory + knowledge base',
      'Engagement engine (5 daily comments)',
      'Strategy advice',
    ],
    highlight: true,
  },
  {
    id: 'agency',
    name: 'Agency',
    price: 79,
    features: [
      'Everything in Pro',
      'Up to 10 accounts',
      'Unlimited posts',
      'Priority support',
    ],
    highlight: false,
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
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ planId }),
    })
    const data = await res.json()
    if (data.url) window.location.href = data.url
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-border">
        <Link href="/" className="font-sans text-2xl font-bold">
          Nivi
        </Link>
        <div className="flex items-center gap-6">
          {isSignedIn ? (
            <Link
              href="/"
              className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/sign-in"
                className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="bg-white text-black font-sans text-sm px-4 py-2 rounded-md hover:bg-white/90 transition-colors"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* Header */}
      <div className="max-w-4xl mx-auto px-8 pt-16 pb-12 text-center">
        <h1 className="font-sans text-4xl font-bold mb-4">
          Simple pricing
        </h1>
        <p className="text-muted-foreground text-lg font-sans">
          Start free. Upgrade when you need more.
        </p>
      </div>

      {/* Plans grid */}
      <div className="max-w-5xl mx-auto px-8 pb-20 grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-lg p-6 flex flex-col ${
              plan.highlight
                ? 'border-2 border-white bg-card'
                : 'border border-border bg-card'
            }`}
          >
            {plan.badge && (
              <span className="self-start font-sans text-[10px] px-2 py-0.5 bg-white text-black rounded-full mb-4">
                {plan.badge}
              </span>
            )}
            <h2 className="font-sans text-[13px] text-muted-foreground uppercase tracking-widest mb-2">
              {plan.name}
            </h2>
            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-sans text-[36px] font-medium text-white">
                ${plan.price}
              </span>
              <span className="font-sans text-[13px] text-muted-foreground">
                /mo
              </span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-[13px] text-muted-foreground"
                >
                  <span className="text-emerald-600 mt-0.5">&#10003;</span>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSelect(plan.id)}
              disabled={loading === plan.id}
              className={`w-full font-sans text-[13px] px-4 py-2.5 rounded-md transition-colors disabled:opacity-50 ${
                plan.highlight
                  ? 'bg-white text-black hover:bg-white/90'
                  : 'border border-border text-muted-foreground hover:text-white hover:border-white'
              }`}
            >
              {loading === plan.id ? 'Loading...' : 'Get Started'}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
