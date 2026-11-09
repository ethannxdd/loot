import { createFileRoute, redirect } from '@tanstack/react-router'
import { featureFlagsQuery } from '@/hooks/useFeatures'
import { SpendingPage } from '@/pages/SpendingPage'

// Phase 6 B1 — behind the `live_cycle` feature flag (Admin → Feature flags). Without it this page sends you to Summary.
export const Route = createFileRoute('/_app/spending')({
  beforeLoad: async ({ context }) => {
    let flags: Record<string, boolean> = {}
    try {
      flags = await context.queryClient.ensureQueryData(featureFlagsQuery(context.auth.user?.id))
    } catch {
      flags = {}
    }
    if (!flags.live_cycle) throw redirect({ to: '/dashboard' })
  },
  component: SpendingPage,
})
