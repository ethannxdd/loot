import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { MovingOutToolPage } from '@/pages/tools/MovingOutToolPage'

// Phase 6 — behind the `tools` flag.
export const Route = createFileRoute('/_app/tools/moving-out')({
  beforeLoad: requireFlag('tools'),
  component: MovingOutToolPage,
})
