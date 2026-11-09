import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { SplitsPage } from '@/pages/SplitsPage'

// Phase 6 B3 — behind the `splits` flag.
export const Route = createFileRoute('/_app/splits')({
  beforeLoad: requireFlag('splits'),
  component: SplitsPage,
})
