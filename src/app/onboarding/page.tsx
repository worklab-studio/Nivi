import { OnboardingShell } from '@/components/onboarding/OnboardingShell'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function OnboardingPage() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  // TODO: fetch user's onboarding_step from Supabase to resume
  return <OnboardingShell initialStep={0} />
}
