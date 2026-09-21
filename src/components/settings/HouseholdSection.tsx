import { Loader2, Mail, UserPlus, Users, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useAuth } from '@/hooks/useAuth'
import {
  useAcceptHouseholdInvite,
  useCreateHousehold,
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
              <p className="text-xs text-muted-foreground">Invited on {new Date(invite.created_at).toLocaleDateString('en-ZA')}</p>
              <button
                type="button"
                onClick={() => acceptInvite.mutate(invite)}
                disabled={acceptInvite.isPending}
                className="btn btn-primary !h-8 !px-3 !text-xs"
              >
                {acceptInvite.isPending && <Loader2 size={12} className="animate-spin" />}
                Accept
              </button>
            </div>
          ))}
        </div>
      )}

      {!household ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Link with a partner to see combined income, expenses, and totals — each of you keeps an individual view
            too.
          </p>
          <button type="button" onClick={() => createHousehold.mutate()} disabled={createHousehold.isPending} className="btn btn-secondary">
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
  const [email, setEmail] = useState('')

  const myMemberRow = members.find((m) => m.user_id === myUserId)
  const pendingSentInvites = sentInvites.filter((i) => !i.accepted_at)

  function handleInvite(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    sendInvite.mutate({ householdId, email }, { onSuccess: () => setEmail('') })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <p className="overline">Linked partners</p>
        {partnerProfiles.length === 0 && pendingSentInvites.length === 0 && (
          <p className="text-xs text-text-muted">No one linked yet.</p>
        )}
        {partnerProfiles.map((p) => {
          const memberRow = members.find((m) => m.user_id === p.id)
          return (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm">
              <span>{p.display_name || 'Household member'}</span>
              {memberRow && (isOwner || memberRow.user_id === myUserId) && (
                <button
                  type="button"
                  onClick={() => removeMember.mutate(memberRow.id)}
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
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Mail size={13} strokeWidth={1.75} /> {invite.email} <span className="text-text-muted">· pending</span>
              </span>
              <button
                type="button"
                onClick={() => revokeInvite.mutate({ id: invite.id, householdId })}
                aria-label="Revoke invite"
                className="text-text-muted hover:text-alert"
              >
                <X size={14} strokeWidth={1.75} />
              </button>
            </div>
          ))}
      </div>

      {isOwner ? (
        <form onSubmit={handleInvite} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="partner@email.com"
            className="flex-1"
          />
          <button type="submit" disabled={sendInvite.isPending} className="btn btn-secondary shrink-0">
            {sendInvite.isPending && <Loader2 size={14} className="animate-spin" />}
            Invite
          </button>
        </form>
      ) : (
        myMemberRow && (
          <button type="button" onClick={() => removeMember.mutate(myMemberRow.id)} className="text-xs font-semibold text-alert hover:underline">
            Leave this household
          </button>
        )
      )}
    </div>
  )
}
