'use client'

/**
 * Lightweight client-side data cache.
 * - Caches API responses in sessionStorage (per-tab) with TTL
 * - On revisit: returns cached data INSTANTLY, then refetches in background
 *   (stale-while-revalidate pattern — same as SWR but with zero deps)
 *
 * Use this for any GET endpoint that's safe to show stale for a few seconds
 * (overview KPIs, posts list, identity, settings, etc.)
 */

const DEFAULT_TTL_MS = 60_000 // 60s
const KEY_PREFIX = 'nivi-cache:'

interface CacheEntry<T> {
  data: T
  cachedAt: number
}

function read<T>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + key)
    if (!raw) return null
    return JSON.parse(raw) as CacheEntry<T>
  } catch {
    return null
  }
}

function write<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return
  try {
    const entry: CacheEntry<T> = { data, cachedAt: Date.now() }
    sessionStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry))
  } catch {
    // sessionStorage full or disabled — silently ignore
  }
}

/**
 * Returns cached data if fresh, otherwise null.
 * Doesn't trigger a fetch.
 */
export function getCached<T>(key: string, maxAgeMs = DEFAULT_TTL_MS): T | null {
  const entry = read<T>(key)
  if (!entry) return null
  if (Date.now() - entry.cachedAt > maxAgeMs) return null
  return entry.data
}

/**
 * Returns cached data even if stale. Use for instant render on revisit.
 */
export function getStale<T>(key: string): T | null {
  return read<T>(key)?.data ?? null
}

/**
 * Save data to cache.
 */
export function setCached<T>(key: string, data: T): void {
  write(key, data)
}

/**
 * Invalidate a cached key (e.g. after a mutation).
 */
export function invalidate(key: string): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(KEY_PREFIX + key)
  } catch { /* ignore */ }
}

/**
 * Stale-while-revalidate fetch wrapper.
 *
 * Usage:
 *   const { data, loading, refresh } = useCachedFetch<OverviewData>('overview', '/api/dashboard/overview')
 *
 * On first visit: loading=true, then data appears.
 * On revisit: cached data appears INSTANTLY (loading=false), background refetch updates it.
 */
import { useEffect, useState, useCallback } from 'react'

export function useCachedFetch<T>(
  cacheKey: string,
  url: string,
  options?: { ttlMs?: number; enabled?: boolean }
): {
  data: T | null
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
} {
  const enabled = options?.enabled !== false
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS

  // Initial state: stale cache if available, otherwise null
  const initialCached = enabled ? getStale<T>(cacheKey) : null
  const [data, setData] = useState<T | null>(initialCached)
  const [loading, setLoading] = useState(enabled && !initialCached)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`fetch ${res.status}`)
      const json = (await res.json()) as T
      setData(json)
      setCached(cacheKey, json)
      setError(null)
    } catch (err) {
      setError(err as Error)
    } finally {
      setLoading(false)
    }
  }, [cacheKey, url, enabled])

  useEffect(() => {
    if (!enabled) return

    // If cache is fresh, use it and skip the fetch entirely
    const fresh = getCached<T>(cacheKey, ttl)
    if (fresh) {
      setData(fresh)
      setLoading(false)
      return
    }

    // Stale cache: show it but refetch in background (no loading flicker)
    if (initialCached) {
      void refresh()
      return
    }

    // No cache at all: full loading state
    setLoading(true)
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, url, enabled, ttl])

  return { data, loading, error, refresh }
}
