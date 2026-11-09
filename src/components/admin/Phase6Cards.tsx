import { Link } from '@tanstack/react-router'
import { AlertTriangle, Bell, ChevronRight, CreditCard, MessageSquare, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ActionDialog, AdminCard, IconTile, KV } from '@/components/admin/AdminUi'
import { useUserPhase6Actions } from '@/hooks/useAdminV2'
import { formatDate, relativeDay, roleAtLeast, type AdminRole, type OverviewStats, type UserDetail } from '@/lib/admin'
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, type OverviewPhase6, type UserPhase6 } from '@/lib/admin-v2'

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0)

/** Overview additions (§5.5): headline numbers and the Phase 6 "needs attention" rows. Hidden before Migration 032. */
export function OverviewPhase6Card({ s }: { s: OverviewStats & OverviewPhase6 }) {
  if (!s.phase6_attention) return null
  const a = s.phase6_attention
  const rows = [
    { icon: MessageSquare, color: 'var(--alert)', title: 'Unanswered feedback over 48h', n: a.unanswered_feedback_48h, to: '/admin/feedback' as const },
    { icon: SlidersHorizontal, color: 'var(--caution)', title: 'Stale content', n: a.stale_content + (a.missing_tax_table ? 1 : 0), to: '/admin/content' as const },
    { icon: AlertTriangle, color: 'var(--chart-5)', title: 'Push failures (24h)', n: `${a.push_failure_rate_24h}%`, to: '/admin/analytics' as const, warn: a.push_failure_rate_24h >= 20 },
  ]
  return (
    <AdminCard title="Phase 6" sub="Push, logging and support">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-fill px-3.5 py-3">
          <p className="text-[12.5px] text-muted-foreground">Push opt-in</p>
          <p className="tnum text-[22px] font-bold">{pct(s.push_opt_in?.subscribed ?? 0, s.push_opt_in?.active_7d ?? 0)}%</p>
          <p className="text-[12px] text-muted-foreground">{s.push_opt_in?.subscribed ?? 0} people</p>
        </div>
        <div className="rounded-2xl bg-fill px-3.5 py-3">
          <p className="text-[12.5px] text-muted-foreground">Logged a spend this week</p>
          <p className="tnum text-[22px] font-bold">{s.loggers_7d ?? 0}</p>
          <p className="text-[12px] text-muted-foreground">{pct(s.loggers_7d ?? 0, s.active_7d)}% of weekly active</p>
        </div>
      </div>
      <div className="-my-1 divide-y divide-hairline">
        {rows.map((r) => (
          <Link key={r.title} to={r.to} className="flex items-center gap-3 py-3">
            <IconTile icon={r.icon} color={r.color} size={32} />
            <span className="min-w-0 flex-1 text-[14.5px] font-semibold">{r.title}</span>
            <span className={`tnum text-[16px] font-bold ${r.warn ? 'text-alert' : ''}`}>{r.n}</span>
            <ChevronRight size={16} className="text-text-subtle" />
          </Link>
        ))}
      </div>
    </AdminCard>
  )
}

type Act = 'test' | 'clear' | 'revoke' | 'reset' | null

/** User page additions (§5.5): Phase 6 usage, push devices, capture key, payday, feedback threads and actions. */
export function UserPhase6Card({ d, role }: { d: UserDetail & UserPhase6; role: AdminRole | null }) {
  const actions = useUserPhase6Actions()
  const [open, setOpen] = useState<Act>(null)
  const p = d.phase6
  if (!p) return null
  const usage = d.usage as unknown as Record<string, number>
  const counts: [string, string][] = [
    ['spend_entries', 'Spends logged'],
    ['stokvels', 'Stokvels'],
    ['splits', 'Splits'],
    ['wishlist', 'Wishlist items'],
    ['scenarios', 'Saved scenarios'],
    ['renewals', 'Renewals'],
    ['challenges', 'Challenges'],
    ['tfsa_contributions', 'TFSA entries'],
    ['assistant_today', 'Ask Loot today'],
  ]
  const support = roleAtLeast(role, 'support')
  const id = d.account.id
  const done = (msg: string) => () => toast.success(msg)

  return (
    <AdminCard title="Phase 6" sub="Counts only">
      <div className="grid grid-cols-3 gap-2">
        {counts.map(([k, label]) => (
          <div key={k} className="rounded-xl bg-fill px-2.5 py-2">
            <p className="tnum text-[17px] font-bold">{usage[k] ?? 0}</p>
            <p className="text-[11.5px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <div className="divide-y divide-hairline">
        <KV k="Payday set" v={p.payday_set ? 'Yes' : 'No (calendar months)'} />
        <KV k={<span className="inline-flex items-center gap-1.5"><Bell size={14} /> Push devices</span>} v={p.push_devices.length === 0 ? 'None' : p.push_devices.map((x) => x.platform).join(', ')} />
        <KV
          k={<span className="inline-flex items-center gap-1.5"><CreditCard size={14} /> Capture key</span>}
          v={p.capture_key ? `Active · ${p.capture_key.total_uses} uses${p.capture_key.last_used_at ? ` · last ${relativeDay(p.capture_key.last_used_at)}` : ''}` : 'None'}
        />
      </div>
      {p.feedback.length > 0 && (
        <ul className="space-y-1">
          {p.feedback.map((f) => (
            <li key={f.id}>
              <Link to="/admin/feedback/$feedbackId" params={{ feedbackId: f.id }} className="flex justify-between gap-2 text-[13.5px] text-primary">
                <span>{FEEDBACK_KIND_LABEL[f.kind]} · {formatDate(f.created_at)}</span>
                <span className="text-muted-foreground">{FEEDBACK_STATUS_LABEL[f.status]}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {support && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary !min-h-9 !text-[13px]" disabled={p.push_devices.length === 0} onClick={() => setOpen('test')}>Send test push</button>
          <button type="button" className="btn btn-ghost !min-h-9 !text-[13px]" disabled={p.push_devices.length === 0} onClick={() => setOpen('clear')}>Clear push devices</button>
          <button type="button" className="btn btn-ghost !min-h-9 !text-[13px]" disabled={!p.capture_key} onClick={() => setOpen('revoke')}>Revoke capture key</button>
          <button type="button" className="btn btn-ghost !min-h-9 !text-[13px]" disabled={!(usage.assistant_today > 0)} onClick={() => setOpen('reset')}>Reset Ask Loot limit</button>
        </div>
      )}
      {open === 'test' && (
        <ActionDialog title="Send a test push?" description="Queues a test notification. It arrives within 5 minutes (not during 21:00–07:00)." confirmLabel="Send" onConfirm={() => actions.testPush.mutateAsync(id).then(done('Test queued'))} onClose={() => setOpen(null)} />
      )}
      {open === 'clear' && (
        <ActionDialog title="Clear push devices?" description="Removes every push subscription. They can switch push on again in Settings." confirmLabel="Clear" destructive reasonRequired onConfirm={(reason) => actions.clearPush.mutateAsync({ user: id, reason }).then(done('Push devices cleared'))} onClose={() => setOpen(null)} />
      )}
      {open === 'revoke' && (
        <ActionDialog title="Revoke the capture key?" description="Their Shortcut stops logging straight away. They can create a new key in Settings." confirmLabel="Revoke" destructive reasonRequired onConfirm={(reason) => actions.revokeKey.mutateAsync({ user: id, reason }).then(done('Capture key revoked'))} onClose={() => setOpen(null)} />
      )}
      {open === 'reset' && (
        <ActionDialog title="Reset today’s Ask Loot limit?" description="Gives them a fresh daily allowance for today." confirmLabel="Reset" reasonRequired onConfirm={(reason) => actions.resetAssistant.mutateAsync({ user: id, reason }).then(done('Limit reset'))} onClose={() => setOpen(null)} />
      )}
    </AdminCard>
  )
}
