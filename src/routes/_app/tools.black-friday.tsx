import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { BlackFridayToolPage } from '@/pages/tools/BlackFridayToolPage'

// Phase 6 — behind the `tools` flag.
export const Route = createFileRoute('/_app/tools/black-friday')({
  beforeLoad: requireFlag('tools'),
  component: BlackFridayToolPage,
})
