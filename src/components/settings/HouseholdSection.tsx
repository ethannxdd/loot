import { Loader2, Mail, UserPlus, Users, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useAuth } from '@/hooks/useAuth'
import {
  useAcceptHouseholdInvite,
  useCreateHousehold,
  useDisbandHousehold,
  useHouseholdInvites,
  useHouseholdPartnerProfiles,
  useMyHousehold,
  useMyPendingInvites,
  useRemoveHouseholdMember,
  useRevokeHouseholdInvite,
  useSendHouseholdInvite,
} from '@/hooks/useHousehold'

export function HouseholdSection() {
  const { user } = useAuth()
  const { data: household, isLoading } = useMyHousehold()
  const { data: pendingInvites = [] } = useMyPendingInvites()
  const createHousehold = useCreateHousehold()
  const acceptInvite = useAcceptHouseholdInvite()

  if (isLoading) return <div className="skeleton h-40 rounded-2xl" />

  return (
    <section className="card space-y-4">
      <div className="overline flex items-center gap-1.5">
        <Users size={13} strokeWidth={2} /> Household
      </div>

      {pendingInvites.length > 0 && (
        <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/8 p-3.5">
          <p className="text-xs font-semibold text-primary">You've been invited to a household</p>
          {pendingInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Invited on {new Date(invite.created_at).toLocaleDateString('en-ZA')} · expires{' '}
                {new Date(invite.expires_at).toLocaleDateString('en-ZA')}
              </p>
              <button
                type="button"
                onClick={() =>
                  acceptInvite.mutate(invite, { onSuccess: () => toast.success("You've joined the household") })
                }
                disabled={acceptInvite.isPending || Boolean(household)}
                title={household ? 'Leave your current household first' : undefined}
                className="btn btn-primary !h-8 !px-3 !text-xs"
              >
                {acceptInvite.isPending && <Loader2 size={12} className="animate-spin" />}
                Accept
              </button>
            </div>
          ))}
          {household && (
            <p className="text-[11px] text-text-muted">You’re already in a household — leave it below to accept an invite.</p>
          )}
        </div>
      )}

      {!household ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Link with a partner to see combined income, expenses, and totals — each of you keeps an individual view
            too.
          </p>
          <button
            type="button"
            onClick={() => createHousehold.mutate(undefined, { onSuccess: () => toast.success('Household created') })}
            disabled={createHousehold.isPending}
            className="btn btn-secondary"
          >
            {createHousehold.isPending && <Loader2 size={15} className="animate-spin" />}
            <UserPlus size={15} strokeWidth={1.75} /> Start a household
          </button>
        </div>
      ) : (
        <HouseholdManager householdId={household.household.id} isOwner={household.isOwner} memberUserIds={household.members.map((m) => m.user_id)} members={household.members} myUserId={user?.id} />
      )}
    </section>
  )
}

function HouseholdManager({
  householdId,
  isOwner,
  memberUserIds,
  members,
  myUserId,
}: {
  householdId: string
  isOwner: boolean
  memberUserIds: string[]
  members: { id: string; user_id: string }[]
  myUserId: string | undefined
}) {
  const { data: partnerProfiles = [] } = useHouseholdPartnerProfiles(memberUserIds)
  const { data: sentInvites = [] } = useHouseholdInvites(isOwner ? householdId : undefined)
  const sendInvite = useSendHouseholdInvite()
  const revokeInvite = useRevokeHouseholdInvite()
  const removeMember = useRemoveHouseholdMember()
  const disband = useDisbandHousehold()
  const [email, setEmail] = useState('')
  const [confirm, setConfirm] = useState<
    { kind: 'unlink'; memberRowId: string; name: string } | { kind: 'leave'; memberRowId: string } | { kind: 'disband' } | null
  >(null)

  const myMemberRow = members.find((m) => m.user_id === myUserId)
  const now = Date.now()
  const pendingSentInvites = sentInvites.filter((i) => !i.accepted_at && new Date(i.expires_at).getTime() > now)
  const partnerRows = members.filter((m) => m.user_id !== myUserId)

  function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    sendInvite.mutate(
      { householdId, email },
      {
        onSuccess: () => {
          toast.success(`Invite saved for ${email.trim().toLowerCase()}`)
          setEmail('')
        },
      },
    )
  }

  function runConfirmed() {
    if (!confirm) return
    if (confirm.kind === 'disband') {
      disband.mutate(householdId, {
        onSuccess: () => {
          setConfirm(null)
          toast.success('Household disbanded')
        },
      })
    } else {
      removeMember.mutate(confirm.memberRowId, {
        onSuccess: () => {
          setConfirm(null)
          toast.success(confirm.kind === 'leave' ? 'You left the household' : `${confirm.name} was unlinked`)
        },
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="overline">Linked partners</p>
        {partnerRows.length === 0 && pendingSentInvites.length === 0 && (
          <p className="text-xs text-text-muted">No one linked yet.</p>
        )}
        {partnerRows.map((memberRow) => {
          const profile = partnerProfiles.find((p) => p.id === memberRow.user_id)
          const name = profile?.display_name || 'Household member'
          return (
            <div key={memberRow.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm">
              <span>{name}</span>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => setConfirm({ kind: 'unlink', memberRowId: memberRow.id, name })}
                  className="text-xs font-semibold text-alert hover:underline"
                >
                  Unlink
                </button>
              )}
            </div>
          )
        })}
        {isOwner &&
          pendingSentInvites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm">
              <span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
                <Mail size={13} strokeWidth={1.75} className="shrink-0" />
                <span className="truncate">{invite.email}</span>
                <span className="shrink-0 text-text-muted">· pending</span>
              </span>
              <button
                type="button"
                onClick={() => revokeInvite.mutate({ id: invite.id, householdId })}
                aria-label={`Revoke invite to ${invite.email}`}
                className="text-text-muted hover:text-alert"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          ))}
      </div>

      {isOwner ? (
        <div className="space-y-2">
          <form onSubmit={handleInvite} className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="partner@email.com"
              aria-label="Partner's email"
              className="flex-1"
            />
            <button type="submit" disabled={sendInvite.isPending} className="btn btn-secondary shrink-0">
              {sendInvite.isPending && <Loader2 size={14} className="animate-spin" />}
              Invite
            </button>
          </form>
          <p className="text-[11px] text-text-muted">
            Loot doesn’t send an email for you — tell your partner to sign up or sign in to Loot with this address, and
            the invite will appear here in their Settings. Invites last 7 days.
          </p>
          <button
            type="button"
            onClick={() => setConfirm({ kind: 'disband' })}
            className="text-xs font-semibold text-alert hover:underline"
          >
            Disband household
          </button>
        </div>
      ) : (
        myMemberRow && (
          <button
            type="button"
            onClick={() => setConfirm({ kind: 'leave', memberRowId: myMemberRow.id })}
            className="text-xs font-semibold text-alert hover:underline"
          >
            Leave this household
          </button>
        )
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.kind === 'disband' ? 'Disband household?' : confirm.kind === 'leave' ? 'Leave household?' : `Unlink ${confirm.name}?`}
          confirmLabel={confirm.kind === 'disband' ? 'Disband' : confirm.kind === 'leave' ? 'Leave' : 'Unlink'}
          isPending={removeMember.isPending || disband.isPending}
          onCancel={() => setConfirm(null)}
          onConfirm={runConfirmed}
        >
          <p>
            {confirm.kind === 'disband'
              ? 'Everyone is removed and combined views switch off. Your own data is untouched.'
              : confirm.kind === 'leave'
                ? 'You’ll stop seeing each other’s expenses and income. Your own data is untouched.'
                : 'You’ll stop seeing each other’s expenses and income. Neither of your own data is deleted.'}
          </p>
        </ConfirmModal>
      )}
    </div>
  )
}
