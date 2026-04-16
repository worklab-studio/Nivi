'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import posthog from 'posthog-js'
import { PostHogProvider as PHProvider, usePostHog } from 'posthog-js/react'
import { Suspense, type ReactNode } from 'react'

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

if (typeof window !== 'undefined' && POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: false, // we handle this manually for App Router
    capture_pageleave: true,
    person_profiles: 'identified_only', // don't create profiles for anon visitors
    autocapture: true,
    session_recording: {
      maskAllInputs: true,
    },
  })
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  if (!POSTHOG_KEY) {
    // No key configured — render children without PostHog wrapper
    return <>{children}</>
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogIdentify />
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  )
}

/**
 * Identifies the user with Clerk userId once loaded.
 * Resets on sign out.
 */
function PostHogIdentify() {
  const { user, isLoaded, isSignedIn } = useUser()
  const ph = usePostHog()

  useEffect(() => {
    if (!isLoaded || !ph) return

    if (isSignedIn && user) {
      ph.identify(user.id, {
        email: user.emailAddresses[0]?.emailAddress,
        name: `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim(),
        created_at: user.createdAt,
      })
    }
  }, [isLoaded, isSignedIn, user, ph])

  return null
}

/**
 * Manual pageview tracking for Next.js App Router.
 * Captures $pageview on every route change.
 */
function PageviewTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const ph = usePostHog()

  useEffect(() => {
    if (!ph || !pathname) return
    let url = window.origin + pathname
    if (searchParams?.toString()) url += `?${searchParams.toString()}`
    ph.capture('$pageview', { $current_url: url })
  }, [pathname, searchParams, ph])

  return null
}
