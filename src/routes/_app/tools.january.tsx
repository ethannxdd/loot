import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { JanuaryToolPage } from '@/pages/tools/JanuaryToolPage'

// Phase 6 — behind the `tools` flag.
export const Route = createFileRoute('/_app/tools/january')({
  beforeLoad: requireFlag('tools'),
  component: JanuaryToolPage,
})
