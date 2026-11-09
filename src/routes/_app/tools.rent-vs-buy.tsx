import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { RentBuyToolPage } from '@/pages/tools/RentBuyToolPage'

// Phase 6 — behind the `tools` flag.
export const Route = createFileRoute('/_app/tools/rent-vs-buy')({
  beforeLoad: requireFlag('tools'),
  component: RentBuyToolPage,
})
