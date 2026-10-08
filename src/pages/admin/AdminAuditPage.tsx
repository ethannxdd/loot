import { Link, useNavigate } from '@tanstack/react-router'
import { ScrollText, X } from 'lucide-react'
import { AdminCard, EmptyState, Pager } from '@/components/admin/AdminUi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useAdminAudit } from '@/hooks/useAdmin'
import { ACTION_LABEL, describeAuditDetails, formatDate } from '@/lib/admin'

export interface AuditSearch {
  user?: string
  action?: string
  page?: number
}

const PAGE_SIZE = 50

export function AdminAuditPage({ search }: { search: AuditSearch }) {
  const navigate = useNavigate({ from: '/admin/audit' })
  const page = search.page ?? 0
  const { data, isLoading, error } = useAdminAudit({ target: search.user ?? null, action: search.action ?? null, page, pageSize: PAGE_SIZE })
  const set = (patch: Partial<AuditSearch>) => void navigate({ search: (s: AuditSearch) => ({ ...s, ...patch }) })
  const targetEmail = search.user ? data?.rows.find((r) => r.target_user_id === search.user)?.target_email : null

  return (
    <div className="animate-enter space-y-6" data-testid="admin-audit">
      <PageHeader
        eyebrow="Admin · Controls"
        title="Audit log"
        subtitle={
          data?.scope === 'mine'
            ? 'Your own admin actions. Owners see everyone’s. Nothing here can be edited or deleted.'
            : 'Every admin action, newest first. Nothing here can be edited or deleted.'
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <Select
          aria-label="Action"
          value={search.action ?? 'all'}
          onValueChange={(v) => set({ action: v === 'all' ? undefined : v, page: undefined })}
          className="!w-auto !min-w-[220px]"
          options={[{ value: 'all', label: 'All actions' }, ...Object.entries(ACTION_LABEL).map(([value, label]) => ({ value, label }))]}
        />
        {search.user && (
          <span className="chip chip-neutral !h-9 !px-3">
            {targetEmail ?? 'One user'}
            <button type="button" aria-label="Show everyone" onClick={() => set({ user: undefined, page: undefined })}>
              <X size={14} />
            </button>
          </span>
        )}
      </div>

      {error ? (
        <p role="alert" className="card text-[15px] font-medium text-alert">
          {error.message}
        </p>
      ) : isLoading || !data ? (
        <div className="skeleton h-80 rounded-[22px]" />
      ) : data.rows.length === 0 ? (
        <AdminCard title="Entries">
          <EmptyState icon={ScrollText} title="Nothing logged yet">
            Admin actions appear here as they happen.
          </EmptyState>
        </AdminCard>
      ) : (
        <section className="card space-y-3 !px-4 !py-2">
          <div className="divide-y divide-hairline">
            {data.rows.map((r) => {
              const extra = describeAuditDetails(r)
              return (
                <div key={r.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4">
                  <span className="tnum w-[150px] shrink-0 text-[12.5px] text-muted-foreground">{formatDate(r.created_at, true)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px]">
                      <span className="font-semibold">{ACTION_LABEL[r.action] ?? r.action}</span>
                      {extra && <span className="text-muted-foreground"> · {extra}</span>}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground">
                      by {r.admin_email ?? 'a removed admin'}
                      {r.target_email && (
                        <>
                          {' · '}
                          {r.target_user_id ? (
                            <Link to="/admin/users/$userId" params={{ userId: r.target_user_id }} className="font-semibold text-primary">
                              {r.target_email}
                            </Link>
                          ) : (
                            r.target_email
                          )}
                        </>
                      )}
                      {r.reason && <> · “{r.reason}”</>}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
          <div className="border-t border-hairline py-3">
            <Pager page={page} pageSize={PAGE_SIZE} total={data.total} onPage={(p) => set({ page: p || undefined })} />
          </div>
        </section>
      )}
    </div>
  )
}
