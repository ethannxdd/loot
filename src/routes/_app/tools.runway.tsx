import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { RunwayToolPage } from '@/pages/tools/RunwayToolPage'

// Phase 6 — behind the `tools` flag.
export const Route = createFileRoute('/_app/tools/runway')({
  beforeLoad: requireFlag('tools'),
  component: RunwayToolPage,
})
