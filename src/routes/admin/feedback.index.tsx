import { createFileRoute } from '@tanstack/react-router'
import { AdminFeedbackPage, type FeedbackSearch } from '@/pages/admin/AdminFeedbackPage'

const STATUSES = ['new', 'in_progress', 'waiting_on_user', 'resolved', 'closed']
const KINDS = ['problem', 'idea', 'question']

export const Route = createFileRoute('/admin/feedback/')({
  validateSearch: (s: Record<string, unknown>): FeedbackSearch => ({
    status: STATUSES.includes(String(s.status)) ? (s.status as FeedbackSearch['status']) : undefined,
    kind: KINDS.includes(String(s.kind)) ? (s.kind as FeedbackSearch['kind']) : undefined,
    assigned: s.assigned === 'me' || s.assigned === 'none' ? s.assigned : undefined,
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    page: Number.isInteger(Number(s.page)) && Number(s.page) > 0 ? Number(s.page) : undefined,
  }),
  component: function FeedbackRoute() {
    return <AdminFeedbackPage search={Route.useSearch()} />
  },
})
