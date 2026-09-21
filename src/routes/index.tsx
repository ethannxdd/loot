import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '@/pages/LandingPage'
import { getProfileOrNull } from '@/lib/route-guards'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    // Signed-out visitors see the public landing page — no redirect.
    if (!context.auth.user) return

    const profile = await getProfileOrNull(context)
    if (!profile?.onboarded_at) {
      throw redirect({ to: '/onboarding' })
    }
    throw redirect({ to: '/dashboard' })
  },
  component: LandingPage,
})
