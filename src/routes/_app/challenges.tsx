import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { ChallengesPage } from '@/pages/ChallengesPage'

// Phase 6 B5 — behind the `challenges` flag.
export const Route = createFileRoute('/_app/challenges')({
  beforeLoad: requireFlag('challenges'),
  component: ChallengesPage,
})
