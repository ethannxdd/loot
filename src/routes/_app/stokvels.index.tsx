import { createFileRoute } from '@tanstack/react-router'
import { requireFlag } from '@/lib/flag-route'
import { StokvelsPage } from '@/pages/StokvelsPage'

// Phase 6 B3 — behind the `stokvels` flag.
export const Route = createFileRoute('/_app/stokvels/')({
  beforeLoad: requireFlag('stokvels'),
  component: StokvelsPage,
})
