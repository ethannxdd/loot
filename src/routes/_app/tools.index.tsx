import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { ToolsPage } from '@/pages/tools/ToolsPage'

// Phase 6 — behind the `tools` flag.
export const Route = createFileRoute('/_app/tools/')({
  beforeLoad: requireFlag('tools'),
  component: ToolsPage,
})
