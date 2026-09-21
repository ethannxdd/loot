import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { getProfileOrNull } from '@/lib/route-guards'

export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context }) => {
    if (!context.auth.user) {
      throw redirect({ to: '/auth' })
    }
    const profile = await getProfileOrNull(context)
    if (!profile?.onboarded_at) {
      throw redirect({ to: '/onboarding' })
    }
  },
  component: AppLayout,
})
