import { Link, useNavigate } from '@tanstack/react-router'
import { BadgeCheck, ChevronRight, Globe, Loader2, Search, ShieldCheck, Smartphone, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar, EmptyState, Pager, StatusChip } from '@/components/admin/AdminUi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { useAdminUsers } from '@/hooks/useAdmin'
import { formatDate, PLATFORM_LABEL, relativeDay, ROLE_LABEL, type Platform, type UserFilter, type UserRow } from '@/lib/admin'

export interface UsersSearch {
  q?: string
  filter?: UserFilter
  platform?: Platform
  page?: number
}

const FILTERS: { value: UserFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'unconfirmed', label: 'Unconfirmed' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'stuck', label: 'Stuck' },
  { value: 'admins', label: 'Admins' },
]

const PAGE_SIZE = 25

function PlatformCell({ p }: { p: Platform | null }) {
  if (!p) return <span className="text-[13px] text-text-subtle">—</span>
  const Icon = p === 'browser' ? Globe : Smartphone
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <Icon size={15} /> {p === 'pwa' ? 'App' : PLATFORM_LABEL[p]}
    </span>
  )
}

function lastActive(u: UserRow) {
  return relativeDay(u.last_active_day ?? u.last_sign_in_at)
}

function Name({ u }: { u: UserRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={u.display_name} email={u.email} />
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-[15px] font-semibold">
          <span className="truncate">{u.display_name || u.email}</span>
          {u.admin_role && (
            <span title={`Admin · ${ROLE_LABEL[u.admin_role]}`} className="shrink-0 text-primary">
              <ShieldCheck size={14} />
            </span>
          )}
        </p>
        <p className="truncate text-[12.5px] text-muted-foreground">{u.email}</p>
      </div>
    </div>
  )
}

const GRID = 'grid grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_0.8fr_0.9fr_20px] items-center gap-4'

export function AdminUsersPage({ search }: { search: UsersSearch }) {
  const navigate = useNavigate({ from: '/admin/users/' })
  const filter = search.filter ?? 'all'
  const page = search.page ?? 0
  const [text, setText] = useState(search.q ?? '')

  // Debounce typing into the URL (so Back from a user returns to the same search).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if ((search.q ?? '') !== text.trim()) {
        void navigate({ search: (s: UsersSearch) => ({ ...s, q: text.trim() || undefined, page: undefined }), replace: true })
      }
    }, 300)
    return () => window.clearTimeout(t)
  }, [text, search.q, navigate])

  const { data, isLoading, isFetching, error } = useAdminUsers({
    search: search.q ?? '',
    filter,
    platform: search.platform ?? null,
    page,
    pageSize: PAGE_SIZE,
  })

  const set = (patch: Partial<UsersSearch>) => void navigate({ search: (s: UsersSearch) => ({ ...s, ...patch }) })

  return (
    <div className="animate-enter space-y-6" data-testid="admin-users">
      <PageHeader
        eyebrow="Admin · People"
        title="Users"
        subtitle={data ? `${data.total.toLocaleString('en-ZA')} ${data.total === 1 ? 'account' : 'accounts'}${filter !== 'all' || search.q || search.platform ? ' match' : ''}. Search by email or name.` : 'Search by email or name.'}
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-11 min-w-0 flex-1 basis-[260px] items-center gap-2 rounded-full bg-surface px-4 shadow-[var(--shadow-card)]">
          <Search size={16} className="shrink-0 text-text-subtle" />
          <input
            type="search"
            aria-label="Search users"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search email or name"
            className="!h-auto min-w-0 flex-1 !border-0 !bg-transparent !p-0 !shadow-none !ring-0"
          />
          {isFetching && <Loader2 size={15} className="shrink-0 animate-spin text-text-subtle" />}
          {text && (
            <button type="button" aria-label="Clear search" onClick={() => setText('')} className="text-text-subtle">
              <X size={15} />
            </button>
          )}
        </div>
        <div className="-mx-4 max-w-[100vw] overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <Segmented<UserFilter> label="Filter" value={filter} onChange={(v) => set({ filter: v === 'all' ? undefined : v, page: undefined })} options={FILTERS} />
        </div>
        <Select
          aria-label="Platform"
          value={search.platform ?? 'any'}
          onValueChange={(v) => set({ platform: v === 'any' ? undefined : (v as Platform), page: undefined })}
          className="!w-auto !min-w-[150px]"
          options={[
            { value: 'any', label: 'Any platform' },
            { value: 'browser', label: 'Browser' },
            { value: 'pwa', label: 'Installed app' },
            { value: 'ios', label: 'iOS app' },
            { value: 'android', label: 'Android app' },
          ]}
        />
      </div>

      {error ? (
        <p role="alert" className="card text-[15px] font-medium text-alert">
          {error.message}
        </p>
      ) : isLoading || !data ? (
        <div className="skeleton h-96 rounded-[22px]" />
      ) : data.rows.length === 0 ? (
        <section className="card">
          <EmptyState icon={Users} title="No accounts match">
            Try a different search or filter.
          </EmptyState>
        </section>
      ) : (
        <>
          {/* Desktop table */}
          <section className="card hidden !p-0 overflow-hidden lg:block">
            <div className={`${GRID} border-b border-hairline px-5 py-3 text-[12px] font-semibold tracking-[0.02em] text-muted-foreground uppercase`}>
              <span>User</span>
              <span>Status</span>
              <span>Signed up</span>
              <span>Last active</span>
              <span>Onboarded</span>
              <span>Platform</span>
              <span />
            </div>
            <div className="divide-y divide-hairline">
              {data.rows.map((u) => (
                <Link key={u.id} to="/admin/users/$userId" params={{ userId: u.id }} className={`${GRID} px-5 py-3 hover:bg-fill`}>
                  <Name u={u} />
                  <span>
                    <StatusChip status={u.status} />
                  </span>
                  <span className="tnum text-[13.5px]">{formatDate(u.created_at)}</span>
                  <span className="text-[13.5px]">{lastActive(u)}</span>
                  <span>{u.onboarded ? <BadgeCheck size={18} className="text-primary" aria-label="Yes" /> : <span className="text-[13px] text-text-subtle">Not yet</span>}</span>
                  <PlatformCell p={u.platform} />
                  <ChevronRight size={16} className="text-text-subtle" />
                </Link>
              ))}
            </div>
            <div className="border-t border-hairline px-5 py-3">
              <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => set({ page: p || undefined })} />
            </div>
          </section>

          {/* Phone / tablet list */}
          <section className="space-y-3 lg:hidden">
            <div className="card !px-4 !py-1">
              <div className="divide-y divide-hairline">
                {data.rows.map((u) => (
                  <Link key={u.id} to="/admin/users/$userId" params={{ userId: u.id }} className="flex items-center gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <Name u={u} />
                      <p className="mt-1.5 flex flex-wrap items-center gap-2 pl-[46px] text-[12.5px] text-muted-foreground">
                        <StatusChip status={u.status} />
                        <span>Joined {formatDate(u.created_at)}</span>
                        <span>· Active {lastActive(u).toLowerCase()}</span>
                      </p>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-text-subtle" />
                  </Link>
                ))}
              </div>
            </div>
            <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => set({ page: p || undefined })} />
          </section>
        </>
      )}
    </div>
  )
}
