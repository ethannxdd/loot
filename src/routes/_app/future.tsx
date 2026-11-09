import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { FuturePage } from '@/pages/FuturePage'

// Phase 6 B6 — behind the `future_you` flag.
export const Route = createFileRoute('/_app/future')({
  beforeLoad: requireFlag('future_you'),
  component: FuturePage,
})
