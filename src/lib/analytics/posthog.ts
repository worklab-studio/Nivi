import { PostHog } from 'posthog-node'

let _client: PostHog | null = null

function getClient(): PostHog | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return null
  if (!_client) {
    _client = new PostHog(key, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
      flushAt: 1, // flush immediately for serverless
      flushInterval: 0,
    })
  }
  return _client
}

/**
 * Capture a server-side event for the given user.
 * Fire-and-forget — never throws or blocks the response.
 */
export function captureServerEvent(
  userId: string,
  event: string,
  properties?: Record<string, unknown>
): void {
  try {
    const client = getClient()
    if (!client) return
    client.capture({
      distinctId: userId,
      event,
      properties: properties ?? {},
    })
  } catch (err) {
    console.error('[posthog] capture failed:', (err as Error).message)
  }
}

/**
 * Update user properties on PostHog person profile.
 */
export function setPersonProperties(
  userId: string,
  properties: Record<string, unknown>
): void {
  try {
    const client = getClient()
    if (!client) return
    client.identify({
      distinctId: userId,
      properties,
    })
  } catch (err) {
    console.error('[posthog] identify failed:', (err as Error).message)
  }
}
