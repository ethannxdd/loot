import { Link, useNavigate } from '@tanstack/react-router'
import { Bug, HelpCircle, Lightbulb, MessageSquare, Search } from 'lucide-react'
import { useState } from 'react'
import { AdminCard, EmptyState, IconTile, Pager } from '@/components/admin/AdminUi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useAdminFeedback } from '@/hooks/useAdminV2'
import { relativeDay } from '@/lib/admin'
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, type FeedbackKind, type FeedbackStatus } from '@/lib/admin-v2'

export interface FeedbackSearch {
  status?: FeedbackStatus
  kind?: FeedbackKind
  assigned?: 'me' | 'none'
  q?: string
  page?: number
}

export const KIND_META: Record<FeedbackKind, { icon: typeof Bug; color: string }> = {
  problem: { icon: Bug, color: 'var(--alert)' },
  idea: { icon: Lightbulb, color: 'var(--chart-4)' },
  question: { icon: HelpCircle, color: 'var(--chart-2)' },
}

const STATUSES: FeedbackStatus[] = ['new', 'in_progress', 'waiting_on_user', 'resolved', 'closed']

/** /admin/feedback (§5.3): the support inbox. */
export function AdminFeedbackPage({ search }: { search: FeedbackSearch }) {
  const navigate = useNavigate({ from: '/admin/feedback/' })
  const [q, setQ] = useState(search.q ?? '')
  const page = search.page ?? 0
  const { data, isLoading, error } = useAdminFeedback({
    status: search.status ?? null,
    kind: search.kind ?? null,
    assigned: search.assigned ?? null,
    search: search.q ?? '',
    page,
  })
  const set = (patch: Partial<FeedbackSearch>) => void navigate({ search: (s: FeedbackSearch) => ({ ...s, ...patch, page: patch.page }) })

  return (
    <div className="animate-enter space-y-6" data-testid="admin-feedback">
      <PageHeader eyebrow="Admin · People" title="Feedback" subtitle="Messages from people using Loot. Replies arrive in their bell and as a push." />

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => set({ status: undefined })} className={`chip !h-9 !px-3.5 ${!search.status ? 'bg-ink text-ink-foreground' : 'chip-neutral'}`}>
          All
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" onClick={() => set({ status: s })} className={`chip !h-9 !px-3.5 ${search.status === s ? 'bg-ink text-ink-foreground' : 'chip-neutral'}`}>
            {FEEDBACK_STATUS_LABEL[s]}
            <span className="tnum opacity-70">{data?.counts?.[s] ?? 0}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            set({ q: q.trim() || undefined })
          }}
          className="relative min-w-[220px] flex-1"
        >
          <Search size={15} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search messages or email" className="!pl-10" aria-label="Search feedback" />
        </form>
        <Select
          aria-label="Kind"
          className="!w-auto !min-w-[180px]"
          value={search.kind ?? 'all'}
          onValueChange={(v) => set({ kind: v === 'all' ? undefined : (v as FeedbackKind) })}
          options={[{ value: 'all', label: 'All kinds' }, ...(Object.keys(FEEDBACK_KIND_LABEL) as FeedbackKind[]).map((k) => ({ value: k, label: FEEDBACK_KIND_LABEL[k] }))]}
        />
        <Select
          aria-label="Assigned"
          className="!w-auto !min-w-[160px]"
          value={search.assigned ?? 'any'}
          onValueChange={(v) => set({ assigned: v === 'any' ? undefined : (v as 'me' | 'none') })}
          options={[
            { value: 'any', label: 'Anyone' },
            { value: 'me', label: 'Assigned to me' },
            { value: 'none', label: 'Unassigned' },
          ]}
        />
      </div>

      {error ? (
        <p role="alert" className="card text-[15px] font-medium text-alert">
          {error.message}
        </p>
      ) : isLoading || !data ? (
        <div className="skeleton h-80 rounded-[22px]" />
      ) : data.rows.length === 0 ? (
        <AdminCard title="Inbox">
          <EmptyState icon={MessageSquare} title="Nothing here">
            No messages match. When people use Settings → Support → Send feedback, they land here.
          </EmptyState>
        </AdminCard>
      ) : (
        <AdminCard title={`${data.total} thread${data.total === 1 ? '' : 's'}`} sub={data.unanswered > 0 ? `${data.unanswered} waiting for a first reply` : undefined}>
          <ul className="-mx-2 divide-y divide-hairline">
            {data.rows.map((r) => {
              const meta = KIND_META[r.kind]
              return (
                <li key={r.id}>
                  <Link to="/admin/feedback/$feedbackId" params={{ feedbackId: r.id }} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-fill">
                    <IconTile icon={meta.icon} color={meta.color} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-[14.5px] ${r.awaiting_admin ? 'font-semibold' : ''}`}>{r.first_line}</span>
                      <span className="block truncate text-[12.5px] text-muted-foreground">
                        {r.email} · {relativeDay(r.last_activity_at)}
                        {r.assigned_to_email ? ` · ${r.assigned_to_email}` : ''}
                        {r.platform ? ` · ${r.platform}` : ''}
                      </span>
                    </span>
                    {r.priority === 'high' && <span className="chip chip-alert">High</span>}
                    <span className={`chip ${r.status === 'new' ? 'chip-caution' : r.status === 'resolved' || r.status === 'closed' ? 'chip-positive' : 'chip-neutral'}`}>
                      {FEEDBACK_STATUS_LABEL[r.status]}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
          <Pager page={page} pageSize={50} total={data.total} onPage={(p) => set({ page: p || undefined })} />
        </AdminCard>
      )}
    </div>
  )
}
