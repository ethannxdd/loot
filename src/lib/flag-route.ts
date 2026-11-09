import { redirect } from '@tanstack/react-router'
import { featureFlagsQuery } from '@/hooks/useFeatures'
import type { RouterContext } from './route-guards'

/**
 * beforeLoad for a Phase 6 page behind a feature flag: without the flag the page sends you to Summary (fails closed —
 * if the flags can't be read, the page is off).
 */
export function requireFlag(flag: string) {
  return async ({ context }: { context: RouterContext }) => {
    let flags: Record<string, boolean> = {}
    try {
      flags = await context.queryClient.ensureQueryData(featureFlagsQuery(context.auth.user?.id))
    } catch {
      flags = {}
    }
    if (!flags[flag]) throw redirect({ to: '/dashboard' })
  }
}
