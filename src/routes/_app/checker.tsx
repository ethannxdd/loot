import { createFileRoute } from '@tanstack/react-router'
import { CheckerPage } from '@/pages/CheckerPage'

export interface CheckerSearch {
  item?: string
  amount?: number
  recurring?: 0 | 1
}

export const Route = createFileRoute('/_app/checker')({
  // Tools open the checker pre-filled: /checker?item=Car&amount=6200&recurring=1 (Phase 6 B4).
  validateSearch: (s: Record<string, unknown>): CheckerSearch => ({
    item: typeof s.item === 'string' ? s.item.slice(0, 80) : undefined,
    amount: Number(s.amount) > 0 ? Number(s.amount) : undefined,
    recurring: s.recurring === 1 || s.recurring === '1' ? 1 : undefined,
  }),
  component: CheckerPage,
})
