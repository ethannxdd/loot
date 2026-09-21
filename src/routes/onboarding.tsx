import { createFileRoute, redirect } from '@tanstack/react-router'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { getProfileOrNull } from '@/lib/route-guards'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/auth' })
    }
    const profile = await getProfileOrNull(context)
    if (profile?.onboarded_at) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: OnboardingPage,
})
