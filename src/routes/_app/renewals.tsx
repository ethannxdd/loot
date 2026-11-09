import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { RenewalsPage } from '@/pages/RenewalsPage'

// Phase 6 B5 — behind the `renewals` flag.
export const Route = createFileRoute('/_app/renewals')({
  beforeLoad: requireFlag('renewals'),
  component: RenewalsPage,
})
