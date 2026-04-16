'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { ThemeProvider, useTheme } from 'next-themes'
import type { ReactNode } from 'react'
import { PostHogProvider } from './PostHogProvider'

/**
 * Root client providers: next-themes + Clerk.
 *
 * ClerkProvider lives inside ThemeProvider so it can read the resolved
 * theme via `useTheme()` and switch its own appearance accordingly.
 * Without this, Clerk would render dark inside a light app (or vice versa)
 * because Clerk doesn't auto-detect Tailwind dark mode.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem={true}
      disableTransitionOnChange={false}
    >
      <ThemedClerkProvider>
        <PostHogProvider>{children}</PostHogProvider>
      </ThemedClerkProvider>
    </ThemeProvider>
  )
}

function ThemedClerkProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return (
    <ClerkProvider
      appearance={{
        baseTheme: isDark ? dark : undefined,
        variables: {
          colorBackground: isDark ? '#111111' : '#ffffff',
          colorInputBackground: isDark ? '#1a1a1a' : '#ffffff',
          colorInputText: isDark ? '#f0f0f0' : '#0a0a0a',
          colorText: isDark ? '#f0f0f0' : '#0a0a0a',
          colorTextOnPrimaryBackground: isDark ? '#000000' : '#ffffff',
          colorTextSecondary: isDark ? '#a0a0a0' : '#525252',
          colorPrimary: isDark ? '#ffffff' : '#0a0a0a',
          colorDanger: '#ef4444',
          colorSuccess: '#22c55e',
          colorNeutral: isDark ? '#f0f0f0' : '#0a0a0a',
          borderRadius: '0.5rem',
          fontFamily: `'Inter', sans-serif`,
          fontFamilyButtons: `'Inter', sans-serif`,
        },
        layout: {
          socialButtonsVariant: 'blockButton',
          termsPageUrl: '/terms',
          privacyPageUrl: '/privacy',
        },
      }}
    >
      {children}
    </ClerkProvider>
  )
}
