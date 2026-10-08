import { createFileRoute } from '@tanstack/react-router'
import type { Platform, UserFilter } from '@/lib/admin'
import { AdminUsersPage, type UsersSearch } from '@/pages/admin/AdminUsersPage'

const FILTERS: UserFilter[] = ['all', 'active', 'unconfirmed', 'suspended', 'stuck', 'admins']
const PLATFORMS: Platform[] = ['browser', 'pwa', 'ios', 'android']

export const Route = createFileRoute('/admin/users/')({
  validateSearch: (s: Record<string, unknown>): UsersSearch => ({
    q: typeof s.q === 'string' && s.q ? s.q : undefined,
    filter: FILTERS.includes(s.filter as UserFilter) && s.filter !== 'all' ? (s.filter as UserFilter) : undefined,
    platform: PLATFORMS.includes(s.platform as Platform) ? (s.platform as Platform) : undefined,
    page: Number.isInteger(Number(s.page)) && Number(s.page) > 0 ? Number(s.page) : undefined,
  }),
  component: function UsersRoute() {
    return <AdminUsersPage search={Route.useSearch()} />
  },
})
