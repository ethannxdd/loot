import { Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  BadgeCheck,
  BellOff,
  Calculator,
  ChartColumn,
  ChevronRight,
  Copy,
  FileSearch,
  Globe,
  Home,
  KeyRound,
  Link2,
  LockOpen,
  LogOut,
  PlayCircle,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Target,
  Trash2,
  UserCheck,
  UserX,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ActionDialog, AdminCard, Avatar, IconTile, KV } from '@/components/admin/AdminUi'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { useAdminAccountAction, useAdminDbAction, useAdminMe, useAdminUser, useSetOverride } from '@/hooks/useAdmin'
import { useAuth } from '@/hooks/useAuth'
import {
  ACTION_LABEL,
  describeAuditDetails,
  formatDate,
  formatMonth,
  PLATFORM_LABEL,
  PROVIDER_LABEL,
  relativeDay,
  ROLE_LABEL,
  roleAtLeast,
  type AdminRole,
  type UserDetail,
  type UserFlag,
} from '@/lib/admin'

type ActionKey =
  | 'suspend'
  | 'unsuspend'
  | 'sign_out_everywhere'
  | 'confirm_email'
  | 'send_password_reset'
  | 'send_magic_link'
  | 'reset_onboarding'
  | 'replay_tutorial'
  | 'unlock_month'
  | 'remove_from_household'
  | 'clear_notifications'
  | 'delete_user'

interface ActionDef {
  key: ActionKey
  icon: LucideIcon
  color: string
  title: string
  sub: string
  min: AdminRole
  danger?: boolean
  /** Why it can't be used right now (dims the row and shows this instead of `sub`). */
  unavailable?: string | null
}

function buildActions(d: UserDetail, role: AdminRole, myId: string | undefined): { group: string; rows: ActionDef[] }[] {
  const suspended = d.status.status === 'suspended'
  const isAdmin = !!d.account.admin_role
  const isMe = d.account.id === myId
  return [
    {
      group: 'Access',
      rows: [
        suspended
          ? { key: 'unsuspend', icon: UserCheck, color: 'var(--accent)', title: 'Lift suspension', sub: 'They can use Loot again straight away', min: 'support' }
          : {
              key: 'suspend',
              icon: UserX,
              color: 'var(--alert)',
              title: 'Suspend account',
              sub: 'Makes the account read-only and shows why. They can still export their data.',
              min: 'support',
              unavailable: isMe ? 'You can’t suspend yourself' : isAdmin ? 'Remove them from the admin team first' : null,
            },
        { key: 'sign_out_everywhere', icon: LogOut, color: 'var(--chart-7)', title: 'Sign out everywhere', sub: 'Ends every session on every device', min: 'support' },
      ],
    },
    {
      group: 'Sign-in help',
      rows: [
        {
          key: 'confirm_email',
          icon: BadgeCheck,
          color: 'var(--accent)',
          title: 'Confirm email',
          sub: 'For when the confirmation email never arrived',
          min: 'support',
          unavailable: d.account.email_confirmed_at ? 'Already confirmed' : null,
        },
        { key: 'send_password_reset', icon: KeyRound, color: 'var(--chart-2)', title: 'Send password reset', sub: 'Emails a reset link', min: 'support' },
        { key: 'send_magic_link', icon: Link2, color: 'var(--chart-3)', title: 'Send sign-in link', sub: 'Emails a one-time sign-in link', min: 'support' },
      ],
    },
    {
      group: 'Fix stuck',
      rows: [
        {
          key: 'reset_onboarding',
          icon: RotateCcw,
          color: 'var(--chart-4)',
          title: 'Reset onboarding',
          sub: 'They set up income, pay frequency and buffer again',
          min: 'support',
          unavailable: d.account.onboarded_at ? null : 'Not onboarded yet',
        },
        {
          key: 'replay_tutorial',
          icon: PlayCircle,
          color: 'var(--chart-3)',
          title: 'Show the guided tour again',
          sub: 'It starts next time they open Loot',
          min: 'support',
          unavailable: d.account.tutorial_completed ? null : 'The tour hasn’t been finished yet',
        },
        {
          key: 'unlock_month',
          icon: LockOpen,
          color: 'var(--chart-6)',
          title: 'Unlock a month',
          sub: `${d.locked_months.length} locked ${d.locked_months.length === 1 ? 'month' : 'months'}`,
          min: 'support',
          unavailable: d.locked_months.length ? null : 'No locked months',
        },
        {
          key: 'remove_from_household',
          icon: Home,
          color: 'var(--chart-5)',
          title: 'Remove from household',
          sub: 'Fixes a broken partner link',
          min: 'support',
          unavailable: d.account.in_household ? null : 'Not in a household',
        },
        {
          key: 'clear_notifications',
          icon: BellOff,
          color: 'var(--chart-7)',
          title: 'Clear notifications',
          sub: `${d.usage.notifications} ${d.usage.notifications === 1 ? 'notification' : 'notifications'}`,
          min: 'support',
          unavailable: d.usage.notifications ? null : 'No notifications',
        },
      ],
    },
    {
      group: 'Danger',
      rows: [
        {
          key: 'delete_user',
          icon: Trash2,
          color: 'var(--alert)',
          title: 'Delete account',
          sub: 'Owner only · type the email to confirm',
          min: 'owner',
          danger: true,
          unavailable: isMe ? 'Use Settings → Danger zone for your own account' : isAdmin ? 'Remove them from the admin team first' : null,
        },
      ],
    },
  ].map((g) => ({
    group: g.group,
    rows: (g.rows as ActionDef[]).map((r) => ({
      ...r,
      unavailable: r.unavailable ?? (roleAtLeast(role, r.min) ? null : r.min === 'owner' ? 'Owner only' : 'Your role can only view'),
    })),
  }))
}

function Actions({ d, role, onPick }: { d: UserDetail; role: AdminRole; onPick: (k: ActionKey) => void }) {
  const { user } = useAuth()
  return (
    <div className="space-y-4">
      {buildActions(d, role, user?.id).map((g) => (
        <div key={g.group}>
          <p className="mb-1.5 px-1 text-[12px] font-semibold tracking-[0.02em] text-muted-foreground uppercase">{g.group}</p>
          <div className="divide-y divide-hairline rounded-2xl bg-fill px-3">
            {g.rows.map((a) => (
              <button
                key={a.key}
                type="button"
                disabled={!!a.unavailable}
                onClick={() => onPick(a.key)}
                data-action={a.key}
                className="flex w-full items-center gap-3 py-2.5 text-left disabled:cursor-not-allowed disabled:opacity-45"
              >
                <IconTile icon={a.icon} color={a.color} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14.5px] font-semibold ${a.danger ? 'text-alert' : ''}`}>{a.title}</span>
                  <span className="block text-[12.5px] leading-snug text-muted-foreground">{a.unavailable ?? a.sub}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-text-subtle" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

type SuspendFor = 'lifted' | '7' | '30' | 'date'

function ActionDialogs({ open, d, onClose }: { open: ActionKey | null; d: UserDetail; onClose: () => void }) {
  const db = useAdminDbAction()
  const acct = useAdminAccountAction()
  const navigate = useNavigate()
  const [suspendFor, setSuspendFor] = useState<SuspendFor>('lifted')
  const [until, setUntil] = useState('')
  const [month, setMonth] = useState(d.locked_months[0] ?? '')
  const [typed, setTyped] = useState('')
  if (!open) return null

  const id = d.account.id
  const email = d.account.email ?? 'this account'
  const done = (msg: string) => () => toast.success(msg)
  const E = <span className="font-semibold text-foreground">{email}</span>

  switch (open) {
    case 'suspend': {
      const untilIso =
        suspendFor === 'lifted'
          ? null
          : suspendFor === 'date'
            ? until
              ? new Date(`${until}T23:59:59`).toISOString()
              : null
            : new Date(Date.now() + Number(suspendFor) * 86_400_000).toISOString()
      return (
        <ActionDialog
          title="Suspend account"
          description={<>{E} will see a “suspended” screen with your reason, can download their data, and can’t change anything until it’s lifted.</>}
          confirmLabel="Suspend"
          destructive
          reasonRequired
          reasonPlaceholder="Shown to them, e.g. Repeated fake sign-ups"
          canConfirm={suspendFor !== 'date' || !!until}
          onConfirm={(reason) => db.mutateAsync({ kind: 'suspend', userId: id, reason, until: untilIso }).then(done('Account suspended'))}
          onClose={onClose}
        >
          <div className="space-y-2">
            <p className="field-label">How long</p>
            <Segmented<SuspendFor>
              full
              label="Suspension length"
              value={suspendFor}
              onChange={setSuspendFor}
              options={[
                { value: 'lifted', label: 'Until lifted' },
                { value: '7', label: '7 days' },
                { value: '30', label: '30 days' },
                { value: 'date', label: 'Date' },
              ]}
            />
            {suspendFor === 'date' && (
              <input type="date" aria-label="Suspended until" value={until} min={new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} />
            )}
          </div>
        </ActionDialog>
      )
    }
    case 'unsuspend':
      return (
        <ActionDialog
          title="Lift suspension"
          description={<>{E} can use Loot again straight away.</>}
          confirmLabel="Lift suspension"
          onConfirm={(reason) => db.mutateAsync({ kind: 'unsuspend', userId: id, reason }).then(done('Suspension lifted'))}
          onClose={onClose}
        />
      )
    case 'sign_out_everywhere':
      return (
        <ActionDialog
          title="Sign out everywhere"
          description={<>Ends every session for {E} on every device. They can sign straight back in.</>}
          confirmLabel="Sign out everywhere"
          onConfirm={(reason) => acct.mutateAsync({ action: 'sign_out_everywhere', userId: id, reason }).then(done('Signed out everywhere'))}
          onClose={onClose}
        />
      )
    case 'confirm_email':
      return (
        <ActionDialog
          title="Confirm email"
          description={<>Marks {E} as confirmed, so they can sign in without the confirmation email. Only do this if you’re sure the email belongs to them.</>}
          confirmLabel="Confirm email"
          onConfirm={(reason) => acct.mutateAsync({ action: 'confirm_email', userId: id, reason }).then(done('Email confirmed'))}
          onClose={onClose}
        />
      )
    case 'send_password_reset':
      return (
        <ActionDialog
          title="Send password reset"
          description={<>Emails {E} a link to choose a new password.</>}
          confirmLabel="Send email"
          onConfirm={(reason) => acct.mutateAsync({ action: 'send_password_reset', userId: id, reason }).then(done('Reset email sent'))}
          onClose={onClose}
        />
      )
    case 'send_magic_link':
      return (
        <ActionDialog
          title="Send sign-in link"
          description={<>Emails {E} a one-time link that signs them in.</>}
          confirmLabel="Send email"
          onConfirm={(reason) => acct.mutateAsync({ action: 'send_magic_link', userId: id, reason }).then(done('Sign-in link sent'))}
          onClose={onClose}
        />
      )
    case 'reset_onboarding':
      return (
        <ActionDialog
          title="Reset onboarding"
          description={<>Next time {E} opens Loot they’ll go through onboarding again. Their expenses, goals and history stay.</>}
          confirmLabel="Reset onboarding"
          onConfirm={(reason) => db.mutateAsync({ kind: 'reset_onboarding', userId: id, reason }).then(done('Onboarding reset'))}
          onClose={onClose}
        />
      )
    case 'replay_tutorial':
      return (
        <ActionDialog
          title="Show the guided tour again"
          description={<>The guided tour starts next time {E} opens Loot.</>}
          confirmLabel="Turn tour on"
          onConfirm={(reason) => db.mutateAsync({ kind: 'replay_tutorial', userId: id, reason }).then(done('Guided tour turned back on'))}
          onClose={onClose}
        />
      )
    case 'unlock_month':
      return (
        <ActionDialog
          title="Unlock a month"
          description={<>Unlocking lets that month’s numbers update again until {E} closes it again.</>}
          confirmLabel="Unlock"
          canConfirm={!!month}
          onConfirm={(reason) => db.mutateAsync({ kind: 'unlock_month', userId: id, month, reason }).then(done('Month unlocked'))}
          onClose={onClose}
        >
          <div>
            <label className="field-label" htmlFor="unlock-month">
              Month
            </label>
            <Select id="unlock-month" value={month} onValueChange={setMonth} options={d.locked_months.map((m) => ({ value: m, label: formatMonth(m) }))} />
          </div>
        </ActionDialog>
      )
    case 'remove_from_household':
      return (
        <ActionDialog
          title="Remove from household"
          description={<>Removes {E}’s household link and any pending invites. If they own the household, it’s closed and their partner is unlinked too. Nobody’s own data is touched.</>}
          confirmLabel="Remove"
          destructive
          onConfirm={(reason) => db.mutateAsync({ kind: 'remove_from_household', userId: id, reason }).then(done('Removed from household'))}
          onClose={onClose}
        />
      )
    case 'clear_notifications':
      return (
        <ActionDialog
          title="Clear notifications"
          description={<>Deletes {E}’s {d.usage.notifications} notifications. New ones still arrive as normal.</>}
          confirmLabel="Clear"
          destructive
          onConfirm={(reason) => db.mutateAsync({ kind: 'clear_notifications', userId: id, reason }).then(done('Notifications cleared'))}
          onClose={onClose}
        />
      )
    case 'delete_user':
      return (
        <ActionDialog
          title="Delete account"
          description={<>Permanently deletes {E} and all of their data. This can’t be undone. The audit log keeps a record that it happened.</>}
          confirmLabel="Delete forever"
          destructive
          reasonRequired
          canConfirm={typed.trim().toLowerCase() === (d.account.email ?? '').toLowerCase()}
          onConfirm={(reason) => acct.mutateAsync({ action: 'delete_user', userId: id, reason, confirmEmail: typed }).then(() => {
              toast.success('Account deleted')
              void navigate({ to: '/admin/users' })
            })}
          onClose={onClose}
        >
          <div>
            <label className="field-label" htmlFor="confirm-email">
              Type <span className="font-semibold text-foreground">{d.account.email}</span> to confirm
            </label>
            <input id="confirm-email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
          </div>
        </ActionDialog>
      )
  }
}

type OverrideChoice = 'default' | 'on' | 'off'

function FeatureAccess({ d, canEdit }: { d: UserDetail; canEdit: boolean }) {
  const setOverride = useSetOverride()
  const [pendingKey, setPendingKey] = useState<string | null>(null)

  async function change(f: UserFlag, choice: OverrideChoice) {
    setPendingKey(f.key)
    try {
      await setOverride.mutateAsync({ userId: d.account.id, key: f.key, enabled: choice === 'default' ? null : choice === 'on' })
      toast.success(choice === 'default' ? `${f.key} follows the global setting` : `${f.key} turned ${choice} for this person`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t change that')
    } finally {
      setPendingKey(null)
    }
  }

  if (!d.flags.length) return <p className="text-[14px] text-muted-foreground">No feature flags yet.</p>

  return (
    <div className="-my-1 divide-y divide-hairline">
      {d.flags.map((f) => {
        const value: OverrideChoice = f.override === null ? 'default' : f.override ? 'on' : 'off'
        return (
          <div key={f.key} className="space-y-2 py-3" data-flag={f.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[14.5px] font-semibold">
                  <span className="font-mono text-[13.5px]">{f.key}</span>
                  <span className={`chip ${f.effective ? 'chip-positive' : 'chip-neutral'} !h-[22px] !text-[11.5px]`}>{f.effective ? 'On' : 'Off'}</span>
                </p>
                <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{f.description}</p>
              </div>
            </div>
            <Segmented<OverrideChoice>
              full
              size="sm"
              label={`${f.key} for this person`}
              value={value}
              onChange={(v) => canEdit && pendingKey === null && v !== value && void change(f, v)}
              options={[
                { value: 'default', label: `Default (${f.enabled_globally ? 'on' : 'off'})` },
                { value: 'on', label: 'On' },
                { value: 'off', label: 'Off' },
              ]}
            />
          </div>
        )
      })}
      {!canEdit && <p className="pt-3 text-[12.5px] text-text-subtle">Your role can only view feature access.</p>}
    </div>
  )
}

const USAGE: { key: keyof UserDetail['usage']; label: string; icon: LucideIcon; color: string }[] = [
  { key: 'expenses', label: 'Expenses', icon: Wallet, color: 'var(--chart-2)' },
  { key: 'goals', label: 'Goals', icon: Target, color: 'var(--chart-1)' },
  { key: 'checks', label: 'Checks', icon: Sparkles, color: 'var(--chart-4)' },
  { key: 'statements', label: 'Statements', icon: FileSearch, color: 'var(--chart-3)' },
  { key: 'plans', label: 'Plans', icon: Calculator, color: 'var(--chart-6)' },
  { key: 'months', label: 'Months tracked', icon: ChartColumn, color: 'var(--chart-5)' },
]

function ActivityStrip({ d }: { d: UserDetail }) {
  const days: { day: string; on: boolean }[] = []
  const active = new Set(d.activity.map((a) => a.day))
  const now = new Date()
  for (let i = 29; i >= 0; i--) {
    const x = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
    const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    days.push({ day: key, on: active.has(key) })
  }
  const count = days.filter((x) => x.on).length
  return (
    <div>
      <div className="flex gap-[3px]" role="img" aria-label={`Active on ${count} of the last 30 days`}>
        {days.map((x, i) => (
          <span key={x.day} title={x.day} className="h-7 min-w-0 flex-1 rounded-[4px]" style={{ background: x.on ? 'var(--accent)' : 'var(--fill-2)', opacity: x.on ? 0.55 + (i / 30) * 0.45 : 1 }} />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-text-subtle">
        <span>{formatDate(days[0].day).replace(/ \d{4}$/, '')}</span>
        <span>
          {count} of 30 days active
        </span>
        <span>Today</span>
      </div>
    </div>
  )
}

function History({ d }: { d: UserDetail }) {
  if (!d.history.length) return <p className="text-[14px] text-muted-foreground">No admin has changed this account.</p>
  return (
    <ol className="space-y-3">
      {d.history.slice(0, 8).map((h) => {
        const extra = describeAuditDetails(h)
        return (
          <li key={h.id} className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-fill-2" style={{ outline: '3px solid var(--fill)' }} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px]">
                <span className="font-semibold">{ACTION_LABEL[h.action] ?? h.action}</span>
                {extra && <span className="text-muted-foreground"> · {extra}</span>}
              </p>
              <p className="text-[12.5px] text-muted-foreground">
                {h.admin_email ?? 'System'} · {formatDate(h.created_at, true)}
                {h.reason ? ` · “${h.reason}”` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Header({ d }: { d: UserDetail }) {
  const a = d.account
  const platform = d.last_active?.platform
  return (
    <div className="space-y-4">
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary">
        <ArrowLeft size={15} /> Users
      </Link>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={a.display_name} email={a.email} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="page-title truncate">{a.display_name || a.email}</h1>
          <button
            type="button"
            onClick={() => a.email && void navigator.clipboard?.writeText(a.email).then(() => toast.success('Email copied'))}
            className="mt-1 flex max-w-full items-center gap-2 text-[15px] text-muted-foreground"
          >
            <span className="truncate">{a.email}</span>
            <Copy size={14} className="shrink-0 text-text-subtle" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {d.status.status === 'suspended' ? (
            <span className="chip chip-alert">Suspended</span>
          ) : !a.email_confirmed_at ? (
            <span className="chip chip-caution">Unconfirmed</span>
          ) : (
            <span className="chip chip-positive">Active</span>
          )}
          {platform && (
            <span className="chip chip-neutral">
              {platform === 'browser' ? <Globe size={13} /> : <Smartphone size={13} />} {PLATFORM_LABEL[platform]}
            </span>
          )}
          {a.admin_role && (
            <span className="chip chip-neutral">
              <ShieldCheck size={13} /> Admin · {ROLE_LABEL[a.admin_role]}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ children }: { children: ReactNode }) {
  return <div className="space-y-6 lg:col-span-7">{children}</div>
}

export function AdminUserPage({ userId }: { userId: string }) {
  const { data: d, isLoading, error } = useAdminUser(userId)
  const { data: me } = useAdminMe()
  const [open, setOpen] = useState<ActionKey | null>(null)
  const role = me?.role ?? 'viewer'

  if (error) {
    return (
      <div className="space-y-4">
        <Link to="/admin/users" className="inline-flex items-center gap-1 text-[14px] font-semibold text-primary">
          <ArrowLeft size={15} /> Users
        </Link>
        <p role="alert" className="card text-[15px] font-medium text-alert">
          {error.message}
        </p>
      </div>
    )
  }
  if (isLoading || !d) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-24 rounded-[22px]" />
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="skeleton h-96 rounded-[22px] lg:col-span-7" />
          <div className="skeleton h-96 rounded-[22px] lg:col-span-5" />
        </div>
      </div>
    )
  }

  const a = d.account
  return (
    <div className="animate-enter space-y-6" data-testid="admin-user">
      <Header d={d} />

      {d.status.status === 'suspended' && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-alert/10 px-4 py-3" data-testid="suspended-banner">
          <UserX size={18} className="shrink-0 text-alert" />
          <p className="min-w-0 flex-1 text-[14px]">
            <span className="font-semibold">Suspended {d.status.suspended_until ? `until ${formatDate(d.status.suspended_until)}` : 'until lifted'}</span>
            {d.status.reason && <span className="text-muted-foreground"> · “{d.status.reason}”</span>}
            {d.status.updated_by_email && <span className="text-muted-foreground"> · by {d.status.updated_by_email}</span>}
          </p>
          {roleAtLeast(role, 'support') && (
            <button type="button" onClick={() => setOpen('unsuspend')} className="btn btn-secondary !min-h-9 !px-3.5 !text-[13px]">
              Lift suspension
            </button>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <Section>
          <AdminCard title="Account">
            <div className="-my-1 divide-y divide-hairline">
              <KV k="Signed up" v={`${formatDate(a.created_at)} · ${relativeDay(a.created_at).toLowerCase()}`} />
              <KV
                k="Last active"
                v={d.last_active ? `${relativeDay(d.last_active.day)} · ${PLATFORM_LABEL[d.last_active.platform]}` : a.last_sign_in_at ? `Signed in ${relativeDay(a.last_sign_in_at).toLowerCase()}` : '—'}
              />
              <KV k="Sign-in method" v={(a.providers.length ? a.providers : [a.provider]).map((p) => PROVIDER_LABEL[p] ?? p).join(', ')} />
              <KV k="Email confirmed" v={a.email_confirmed_at ? <span className="text-primary">Yes</span> : <span className="text-caution">Not yet</span>} />
              <KV k="Onboarded" v={a.onboarded_at ? formatDate(a.onboarded_at) : 'Not yet'} />
              <KV k="Guided tour" v={a.tutorial_completed ? 'Finished' : 'Not finished'} />
              <KV k="Household" v={a.in_household ? 'Yes' : 'No'} />
              <KV k="Tax profile" v={d.usage.tax_profile ? 'Set up' : 'No'} />
              <KV
                k="User ID"
                v={
                  <button type="button" onClick={() => void navigator.clipboard?.writeText(a.id).then(() => toast.success('User ID copied'))} className="font-mono text-[12.5px] text-muted-foreground">
                    {a.id.slice(0, 8)}…{a.id.slice(-4)}
                  </button>
                }
              />
            </div>
          </AdminCard>

          <AdminCard title="Usage" sub="Counts only. Amounts are never shown.">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {USAGE.map(({ key, label, icon: Icon, color }) => (
                <div key={key} className="rounded-2xl bg-fill px-3.5 py-3">
                  <Icon size={17} style={{ color }} strokeWidth={2.1} />
                  <p className="tnum mt-2 text-[22px] font-bold tracking-[-0.03em]">{Number(d.usage[key])}</p>
                  <p className="text-[12.5px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            <ActivityStrip d={d} />
          </AdminCard>

          <AdminCard
            title="History"
            sub="Every admin action on this account"
            right={
              d.history.length > 8 ? (
                <Link to="/admin/audit" search={{ user: a.id }} className="text-[13px] font-semibold text-primary">
                  See all
                </Link>
              ) : undefined
            }
          >
            <History d={d} />
          </AdminCard>
        </Section>

        <div className="space-y-6 lg:col-span-5">
          <AdminCard title="Actions" sub="Each one asks you to confirm and is logged">
            <Actions d={d} role={role} onPick={setOpen} />
          </AdminCard>
          <AdminCard title="Feature access" sub="Override a flag for just this person">
            <FeatureAccess d={d} canEdit={roleAtLeast(role, 'support')} />
          </AdminCard>
        </div>
      </div>

      <ActionDialogs key={open ?? 'none'} open={open} d={d} onClose={() => setOpen(null)} />
    </div>
  )
}
