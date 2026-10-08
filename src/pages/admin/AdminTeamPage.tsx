import { Link } from '@tanstack/react-router'
import { Loader2, Plus, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ActionDialog, AdminCard, Avatar, ErrorNote } from '@/components/admin/AdminUi'
import { InlineSheet } from '@/components/ui/InlineSheet'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { useAdminMe, useAdminTeam, useTeamAction } from '@/hooks/useAdmin'
import { useAuth } from '@/hooks/useAuth'
import { formatDate, ROLE_LABEL, type AdminRole, type TeamMember } from '@/lib/admin'

const ROLE_HELP: Record<AdminRole, string> = {
  owner: 'Everything, including deleting accounts, global flags and the team',
  support: 'Look up users, fix stuck accounts, suspend, per-person flags',
  viewer: 'Read-only: stats and user lookups',
}

function AddAdmin({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AdminRole>('support')
  const [reason, setReason] = useState('')
  const team = useTeamAction()
  return (
    <InlineSheet title="Add someone to the team" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          team
            .mutateAsync({ kind: 'add', email: email.trim(), role, reason: reason.trim() })
            .then(() => {
              toast.success(`${email.trim()} added as ${ROLE_LABEL[role]}`)
              onClose()
            })
            .catch(() => {})
        }}
      >
        <div>
          <label className="field-label" htmlFor="team-email">
            Their Loot email
          </label>
          <input id="team-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">They need a Loot account already. They’ll set up two-factor the first time they open the portal.</p>
        </div>
        <div>
          <p className="field-label">Role</p>
          <Segmented<AdminRole>
            full
            label="Role"
            value={role}
            onChange={setRole}
            options={[
              { value: 'viewer', label: 'Viewer' },
              { value: 'support', label: 'Support' },
              { value: 'owner', label: 'Owner' },
            ]}
          />
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">{ROLE_HELP[role]}.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="team-reason">
            Reason
          </label>
          <input id="team-reason" required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Joining support" />
        </div>
        <ErrorNote error={team.error} />
        <button type="submit" disabled={team.isPending || !email.trim() || reason.trim().length < 3} className="btn btn-primary">
          {team.isPending && <Loader2 size={15} className="animate-spin" />}
          Add to team
        </button>
      </form>
    </InlineSheet>
  )
}

function MemberRow({ m, isMe }: { m: TeamMember; isMe: boolean }) {
  const team = useTeamAction()
  const [roleTo, setRoleTo] = useState<AdminRole | null>(null)
  const [removing, setRemoving] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-3 py-3" data-member={m.email ?? ''}>
      <Avatar name={m.display_name} email={m.email} size={38} />
      <Link to="/admin/users/$userId" params={{ userId: m.user_id }} className="min-w-0 flex-1 basis-[200px]">
        <span className="block truncate text-[15px] font-semibold">
          {m.display_name || m.email} {isMe && <span className="font-normal text-muted-foreground">(you)</span>}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
          <span className="truncate">{m.email}</span>
          <span className={`inline-flex items-center gap-1 ${m.mfa ? 'text-primary' : 'text-caution'}`}>
            {m.mfa ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />} {m.mfa ? '2FA on' : '2FA not set up'}
          </span>
          <span>· added {formatDate(m.created_at)}{m.added_by_email ? ` by ${m.added_by_email}` : ''}</span>
        </span>
      </Link>
      <Select
        aria-label={`Role for ${m.email}`}
        value={m.role}
        onValueChange={(v) => v !== m.role && setRoleTo(v as AdminRole)}
        className="!w-auto !min-w-[130px]"
        options={(['owner', 'support', 'viewer'] as AdminRole[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
      />
      <button type="button" className="icon-btn" aria-label={`Remove ${m.email} from the team`} onClick={() => setRemoving(true)}>
        <Trash2 size={15} />
      </button>
      {roleTo && (
        <ActionDialog
          title={`Make ${m.email} ${ROLE_LABEL[roleTo]}?`}
          description={<>{ROLE_HELP[roleTo]}.</>}
          confirmLabel="Change role"
          reasonRequired
          onConfirm={(reason) => team.mutateAsync({ kind: 'role', userId: m.user_id, role: roleTo, reason }).then(() => toast.success('Role changed'))}
          onClose={() => setRoleTo(null)}
        />
      )}
      {removing && (
        <ActionDialog
          title={`Remove ${m.email} from the team?`}
          description={isMe ? 'You’ll lose access to the admin portal straight away.' : 'They keep their Loot account but lose access to the admin portal.'}
          confirmLabel="Remove"
          destructive
          reasonRequired
          onConfirm={(reason) => team.mutateAsync({ kind: 'remove', userId: m.user_id, reason }).then(() => toast.success('Removed from the team'))}
          onClose={() => setRemoving(false)}
        />
      )}
    </div>
  )
}

export function AdminTeamPage() {
  const { data: me } = useAdminMe()
  const { user } = useAuth()
  const isOwner = me?.role === 'owner'
  const { data, isLoading, error } = useAdminTeam(isOwner)
  const [adding, setAdding] = useState(false)

  if (me && !isOwner) {
    return (
      <AdminCard title="Team">
        <p className="text-[15px] text-muted-foreground">Only an Owner can manage the admin team.</p>
      </AdminCard>
    )
  }

  return (
    <div className="animate-enter space-y-6" data-testid="admin-team">
      <PageHeader
        eyebrow="Admin · People"
        title="Team"
        subtitle="Who can use the admin portal, and what they can do."
        actions={
          !adding ? (
            <button type="button" onClick={() => setAdding(true)} className="btn btn-primary">
              <Plus size={16} /> Add person
            </button>
          ) : undefined
        }
      />
      {adding && <AddAdmin onClose={() => setAdding(false)} />}
      {error ? (
        <p role="alert" className="card text-[15px] font-medium text-alert">
          {error.message}
        </p>
      ) : isLoading || !data ? (
        <div className="skeleton h-48 rounded-[22px]" />
      ) : (
        <section className="card !px-4 !py-1">
          <div className="divide-y divide-hairline">
            {data.map((m) => (
              <MemberRow key={m.user_id} m={m} isMe={m.user_id === user?.id} />
            ))}
          </div>
        </section>
      )}
      <AdminCard title="Roles">
        <div className="-my-1 divide-y divide-hairline">
          {(['owner', 'support', 'viewer'] as AdminRole[]).map((r) => (
            <div key={r} className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
              <span className="font-semibold">{ROLE_LABEL[r]}</span>
              <span className="text-right text-muted-foreground">{ROLE_HELP[r]}</span>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  )
}
