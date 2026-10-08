import { createFileRoute } from '@tanstack/react-router'
import { AdminAuditPage, type AuditSearch } from '@/pages/admin/AdminAuditPage'

export const Route = createFileRoute('/admin/audit')({
  validateSearch: (s: Record<string, unknown>): AuditSearch => ({
    user: typeof s.user === 'string' && s.user ? s.user : undefined,
    action: typeof s.action === 'string' && s.action ? s.action : undefined,
    page: Number.isInteger(Number(s.page)) && Number(s.page) > 0 ? Number(s.page) : undefined,
  }),
  component: function AuditRoute() {
    return <AdminAuditPage search={Route.useSearch()} />
  },
})
