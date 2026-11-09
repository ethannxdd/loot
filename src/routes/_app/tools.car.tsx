import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { CarToolPage } from '@/pages/tools/CarToolPage'

// Phase 6 — behind the `tools` flag.
export const Route = createFileRoute('/_app/tools/car')({
  beforeLoad: requireFlag('tools'),
  component: CarToolPage,
})
