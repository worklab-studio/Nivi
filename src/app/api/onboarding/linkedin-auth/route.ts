import { auth } from '@clerk/nextjs/server'
import { ensureUser } from '@/lib/auth/ensureUser'

export async function POST() {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure user row exists (Clerk webhook may have failed)
  await ensureUser(userId)

  // Unipile hosted auth — creates a popup URL for LinkedIn OAuth
  const res = await fetch(
    `${process.env.UNIPILE_BASE_URL}/api/v1/hosted/accounts/link`,
    {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        type: 'create',
        providers: ['LINKEDIN'],
        api_url: process.env.UNIPILE_BASE_URL,
        expiresOn: new Date(Date.now() + 3600000).toISOString().replace(/\.\d{3}Z$/, '.000Z'),
        success_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/onboarding/linkedin-callback?userId=${userId}&status=connected`,
        failure_redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/onboarding/linkedin-callback?userId=${userId}&status=failed`,
        name: `Hello Nivi - ${userId}`,
      }),
    }
  )

  if (!res.ok) {
    return Response.json(
      { error: 'Failed to initiate LinkedIn connection' },
      { status: 500 }
    )
  }

  const data = await res.json()
  return Response.json({ url: data.url })
}
