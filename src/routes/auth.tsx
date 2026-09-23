import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuthPage } from '@/pages/AuthPage'

export const Route = createFileRoute('/auth')({
  // `/auth?mode=signup` opens straight on "Create account" (used by the landing page's sign-up buttons).
  validateSearch: (search: Record<string, unknown>): { mode?: 'signup' } => ({
    mode: search.mode === 'signup' ? 'signup' : undefined,
  }),
  beforeLoad: ({ context }) => {
    if (context.auth.user) {
      throw redirect({ to: '/' })
    }
  },
  component: AuthPage,
})
