import { createFileRoute, redirect } from '@tanstack/react-router'
import { featureFlagsQuery } from '@/hooks/useFeatures'
import { AssistantPage } from '@/pages/AssistantPage'

// The Loot Assistant is behind the `assistant` feature flag (Admin → Feature flags). Without it this page
// sends you to Summary, exactly as when it was parked.
export const Route = createFileRoute('/_app/assistant')({
  beforeLoad: async ({ context }) => {
    let flags: Record<string, boolean> = {}
    try {
      flags = await context.queryClient.ensureQueryData(featureFlagsQuery(context.auth.user?.id))
    } catch {
      flags = {}
    }
    if (!flags.assistant) throw redirect({ to: '/dashboard' })
  },
  component: AssistantPage,
})
