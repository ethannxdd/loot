import { Link } from '@tanstack/react-router'
import { ArrowLeft, Loader2, Lock, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AdminCard, ErrorNote, IconTile, KV } from '@/components/admin/AdminUi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { useAdminMe, useAdminTeam } from '@/hooks/useAdmin'
import { useAdminFeedbackThread, useFeedbackActions, useSavedReplies } from '@/hooks/useAdminV2'
import { formatDate, relativeDay, roleAtLeast } from '@/lib/admin'
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, type FeedbackPriority, type FeedbackStatus } from '@/lib/admin-v2'
import { KIND_META } from './AdminFeedbackPage'

/** /admin/feedback/$id (§5.3): thread, context, reply, internal notes, status / priority / assignee. */
export function AdminFeedbackThreadPage({ feedbackId }: { feedbackId: string }) {
  const { data: me } = useAdminMe()
  const { data, isLoading, error } = useAdminFeedbackThread(feedbackId)
  const { data: replies = [] } = useSavedReplies()
  const { data: team = [] } = useAdminTeam(roleAtLeast(me?.role, 'owner'))
  const actions = useFeedbackActions()
  const [reply, setReply] = useState('')
  const [note, setNote] = useState('')
  const canWrite = roleAtLeast(me?.role, 'support')

  if (error) return <p role="alert" className="card text-[15px] font-medium text-alert">{error.message}</p>
  if (isLoading || !data) return <div className="skeleton h-96 rounded-[22px]" />
  const meta = KIND_META[data.kind]

  function send() {
    if (!reply.trim()) return
    actions.reply.mutate(
      { id: feedbackId, body: reply.trim() },
      {
        onSuccess: () => {
          setReply('')
          toast.success('Reply sent. They’ll get a notification.')
        },
      },
    )
  }

  return (
    <div className="animate-enter space-y-6" data-testid="admin-feedback-thread">
      <Link to="/admin/feedback" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary">
        <ArrowLeft size={16} /> Inbox
      </Link>
      <PageHeader eyebrow={FEEDBACK_KIND_LABEL[data.kind]} title={data.message.split('\n')[0].slice(0, 80)} subtitle={`${data.user.email} · ${formatDate(data.created_at, true)}`} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <AdminCard title="Conversation">
            <ul className="space-y-3">
              {data.messages.map((m) => (
                <li key={m.id} className={`flex flex-col ${m.sender === 'admin' ? 'items-end' : 'items-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[14.5px] leading-relaxed whitespace-pre-wrap ${m.sender === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-surface-2'}`}>
                    {m.body}
                  </div>
                  <span className="mt-1 text-[12px] text-text-subtle">
                    {m.sender === 'admin' ? (m.admin_email ?? 'Loot support') : 'User'} · {relativeDay(m.created_at)}
                  </span>
                </li>
              ))}
            </ul>
            {canWrite && (
              <div className="space-y-2 border-t border-hairline pt-4">
                {replies.length > 0 && (
                  <Select
                    aria-label="Insert a saved reply"
                    value=""
                    placeholder="Insert a saved reply…"
                    onValueChange={(id) => {
                      const r = replies.find((x) => x.id === id)
                      if (r) setReply((t) => (t ? `${t}\n\n${r.body}` : r.body))
                    }}
                    options={replies.map((r) => ({ value: r.id, label: r.title }))}
                  />
                )}
                <textarea rows={4} maxLength={2000} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a reply…" aria-label="Reply" />
                <ErrorNote error={actions.reply.error} />
                <button type="button" onClick={send} disabled={!reply.trim() || actions.reply.isPending} className="btn btn-primary">
                  {actions.reply.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send reply
                </button>
              </div>
            )}
          </AdminCard>

          <AdminCard title={<span className="inline-flex items-center gap-1.5"><Lock size={14} /> Internal notes</span>} sub="Only the admin team sees these.">
            {data.notes.length === 0 ? (
              <p className="text-[13.5px] text-muted-foreground">No notes yet.</p>
            ) : (
              <ul className="space-y-2">
                {data.notes.map((n) => (
                  <li key={n.id} className="rounded-xl bg-[color-mix(in_srgb,var(--caution)_10%,transparent)] px-3.5 py-2.5 text-[14px]">
                    <p className="whitespace-pre-wrap">{n.body}</p>
                    <p className="mt-1 text-[12px] text-text-subtle">
                      {n.admin_email} · {relativeDay(n.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {canWrite && (
              <div className="flex gap-2">
                <input value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Add a note" aria-label="Internal note" />
                <button
                  type="button"
                  disabled={!note.trim() || actions.note.isPending}
                  onClick={() => actions.note.mutate({ id: feedbackId, body: note.trim() }, { onSuccess: () => setNote('') })}
                  className="btn btn-secondary shrink-0"
                >
                  Add
                </button>
              </div>
            )}
          </AdminCard>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <AdminCard title="Status">
            <div className="space-y-3">
              <Select
                aria-label="Status"
                value={data.status}
                disabled={!canWrite}
                onValueChange={(v) => actions.update.mutate({ id: feedbackId, status: v as FeedbackStatus })}
                options={(Object.keys(FEEDBACK_STATUS_LABEL) as FeedbackStatus[]).map((s) => ({ value: s, label: FEEDBACK_STATUS_LABEL[s] }))}
              />
              <Select
                aria-label="Priority"
                value={data.priority}
                disabled={!canWrite}
                onValueChange={(v) => actions.update.mutate({ id: feedbackId, priority: v as FeedbackPriority })}
                options={[
                  { value: 'low', label: 'Low priority' },
                  { value: 'normal', label: 'Normal priority' },
                  { value: 'high', label: 'High priority' },
                ]}
              />
              <Select
                aria-label="Assigned to"
                value={data.assigned_to ?? 'none'}
                disabled={!canWrite}
                onValueChange={(v) => actions.update.mutate({ id: feedbackId, assignedTo: v === 'none' ? null : v })}
                options={[{ value: 'none', label: 'Unassigned' }, ...team.map((t) => ({ value: t.user_id, label: t.email ?? t.user_id }))]}
              />
              <ErrorNote error={actions.update.error} />
            </div>
          </AdminCard>
          <AdminCard title="Context" sub="Sent with the message (the user saw this list before sending).">
            <div className="divide-y divide-hairline">
              {Object.entries(data.context).map(([k, v]) => (
                <KV key={k} k={k} v={String(v ?? '—')} />
              ))}
            </div>
          </AdminCard>
          <AdminCard title="Person">
            <div className="flex items-center gap-3">
              <IconTile icon={meta.icon} color={meta.color} />
              <div className="min-w-0">
                <p className="truncate text-[14.5px] font-semibold">{data.user.display_name ?? data.user.email}</p>
                <p className="text-[12.5px] text-muted-foreground">Joined {formatDate(data.user.created_at)}{data.user.suspended ? ' · suspended' : ''}</p>
              </div>
            </div>
            <Link to="/admin/users/$userId" params={{ userId: data.user.id }} className="btn btn-secondary w-full">
              Open user page
            </Link>
            {data.other_threads.length > 0 && (
              <ul className="space-y-1">
                {data.other_threads.map((t) => (
                  <li key={t.id}>
                    <Link to="/admin/feedback/$feedbackId" params={{ feedbackId: t.id }} className="flex justify-between text-[13px] text-primary">
                      <span>{FEEDBACK_KIND_LABEL[t.kind]}</span>
                      <span className="text-muted-foreground">{FEEDBACK_STATUS_LABEL[t.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </AdminCard>
        </div>
      </div>
    </div>
  )
}
