import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Check, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Select'
import { StatStrip } from '@/components/ui/StatStrip'
import { useGoals } from '@/hooks/useGoals'
import { useDeleteStokvel, useOnceOffIncome, useReceiveIncome, useStokvels, useToggleStokvelPayment } from '@/hooks/usePeople'
import {
  addMonths,
  contributionMonths,
  currentMonth,
  lateMonths,
  monthName,
  monthsBetween,
  monthsToGo,
  paidInSoFar,
  payoutFor,
  STOKVEL_TYPE_LABELS,
} from '@/lib/stokvel'
import { formatCurrency } from '@/lib/utils'

/** /stokvels/$id (§4.1): paid in, payout, members, and the contributions log. */
export function StokvelDetailPage({ stokvelId }: { stokvelId: string }) {
  const { data, isLoading } = useStokvels()
  const { data: income = [] } = useOnceOffIncome()
  const { data: goals = [] } = useGoals()
  const toggle = useToggleStokvelPayment()
  const receive = useReceiveIncome()
  const remove = useDeleteStokvel()
  const navigate = useNavigate()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [goalId, setGoalId] = useState('')

  if (isLoading) return <div className="skeleton h-64 rounded-2xl" />
  const s = data?.stokvels.find((x) => x.id === stokvelId)
  if (!s) {
    return (
      <div className="card py-12 text-center">
        <p className="text-[15px] font-semibold">That stokvel isn’t here any more.</p>
        <Link to="/stokvels" className="btn btn-secondary mt-4">
          Back to stokvels
        </Link>
      </div>
    )
  }

  const payments = (data?.payments ?? []).filter((p) => p.stokvel_id === s.id)
  const members = (data?.members ?? []).filter((m) => m.stokvel_id === s.id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const payout = payoutFor(s)
  const toGo = monthsToGo(s)
  const paid = new Set(payments.filter((p) => p.kind === 'contribution').map((p) => p.month))
  const late = new Set(lateMonths(s, payments))
  const lastLogMonth = addMonths(currentMonth(), 2)
  const months = contributionMonths(s, payout && s.type !== 'rotating' && monthsBetween(payout.month, lastLogMonth) > 0 ? payout.month : lastLogMonth)
    .slice(-12)
    .reverse()
  const openPayout = income.find((i) => i.source_id === s.id && !i.received_on)
  const payoutDue = openPayout && openPayout.expected_on.slice(0, 7) <= currentMonth().slice(0, 7)

  return (
    <div className="animate-enter space-y-6">
      <Link to="/stokvels" className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary">
        <ArrowLeft size={16} /> Stokvels
      </Link>
      <PageHeader
        eyebrow={`${STOKVEL_TYPE_LABELS[s.type]} stokvel · ${s.member_count} members`}
        title={s.name}
        actions={
          <button type="button" onClick={() => setConfirmDelete(true)} className="btn btn-ghost text-alert">
            <Trash2 size={15} /> Delete
          </button>
        }
      />

      <StatStrip
        items={[
          { label: 'Paid in so far', value: formatCurrency(paidInSoFar(payments)) },
          {
            label: s.type === 'rotating' ? 'Your payout' : 'Payout',
            value: payout ? `${payout.estimate ? '~' : ''}${formatCurrency(payout.amount)}` : '—',
            sub: payout ? monthName(payout.month) : 'Burial stokvels pay out when needed',
          },
          {
            label: 'Months to go',
            value: toGo === null ? '—' : toGo < 0 ? 'Paid out' : toGo === 0 ? 'This month' : String(toGo),
          },
        ]}
      />

      {openPayout && (
        <section className={`card space-y-3 ${payoutDue ? 'ring-2 ring-primary' : ''}`} data-testid="payout-card">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="card-title">{payoutDue ? 'Your payout is due' : 'Payout planned'}</h3>
            <span className="tnum text-[17px] font-bold">{formatCurrency(openPayout.amount)}</span>
          </div>
          <p className="text-[13px] text-muted-foreground">
            It shows on your Summary and forecast for {monthName(`${openPayout.expected_on.slice(0, 7)}-01`)}, but it’s not in Safe to spend
            until you say it’s arrived.
          </p>
          {payoutDue && (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" disabled={receive.isPending} onClick={() => receive.mutate({ income: openPayout, as: 'cycle' }, { onSuccess: () => toast.success('Added to this cycle') })} className="btn btn-primary">
                {receive.isPending && <Loader2 size={15} className="animate-spin" />}
                Received · add to this cycle
              </button>
              {goals.length > 0 && (
                <>
                  <div className="min-w-44">
                    <Select aria-label="Goal" value={goalId} placeholder="Or put into a goal…" onValueChange={setGoalId} options={goals.filter((g) => !g.is_completed).map((g) => ({ value: g.id, label: g.name }))} />
                  </div>
                  <button
                    type="button"
                    disabled={!goalId || receive.isPending}
                    onClick={() => receive.mutate({ income: openPayout, as: 'goal', goalId }, { onSuccess: () => toast.success('Put into your goal') })}
                    className="btn btn-secondary"
                  >
                    Put into goal
                  </button>
                </>
              )}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="card lg:col-span-7">
          <h3 className="card-title mb-3">Contributions</h3>
          <ul className="divide-y divide-hairline">
            {months.map((m) => {
              const isPaid = paid.has(m)
              const isLate = late.has(m)
              const future = m > currentMonth()
              return (
                <li key={m} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-[14.5px] font-medium">{monthName(m)}</p>
                    <p className="tnum text-[12.5px] text-muted-foreground">{formatCurrency(Number(s.contribution_amount))}</p>
                  </div>
                  {isLate && !isPaid && <span className="chip chip-caution">Late</span>}
                  <button
                    type="button"
                    disabled={toggle.isPending || future}
                    aria-pressed={isPaid}
                    onClick={() => toggle.mutate({ stokvel: s, month: m, paid: !isPaid })}
                    className={`btn !min-h-9 !px-3 !text-[13px] ${isPaid ? 'btn-accent' : 'btn-secondary'}`}
                  >
                    {isPaid ? (
                      <>
                        <Check size={14} /> Paid
                      </>
                    ) : future ? (
                      'Upcoming'
                    ) : (
                      'Mark paid'
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </section>

        <section className="card lg:col-span-5">
          <h3 className="card-title mb-3">Members</h3>
          {members.length <= 1 ? (
            <p className="text-[13px] text-muted-foreground">
              {s.member_count} members{s.my_position ? ` · you’re number ${s.my_position}` : ''}. Loot only stores names, never phone numbers.
            </p>
          ) : (
            <ol className="divide-y divide-hairline">
              {members.map((m) => {
                const turn = s.type === 'rotating' && m.position ? addMonths(s.start_month, m.position - 1) : null
                const done = turn ? turn < currentMonth() : false
                return (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <span className="tnum w-6 text-[13px] text-muted-foreground">{m.position}</span>
                    <span className={`flex-1 text-[14.5px] ${m.is_me ? 'font-semibold text-primary' : ''}`}>{m.is_me ? 'You' : m.name}</span>
                    {turn && <span className="text-[12.5px] text-muted-foreground">{monthName(turn)}</span>}
                    {done && <Check size={15} className="text-primary" aria-label="Paid out" />}
                  </li>
                )
              })}
            </ol>
          )}
        </section>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${s.name}?`}
          isPending={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            remove.mutate(s, {
              onSuccess: () => {
                toast.success('Stokvel deleted. Its expense is in Recently removed on Expenses.')
                void navigate({ to: '/stokvels' })
              },
            })
          }
        >
          <p>Its contributions log goes too. The linked monthly expense moves to Recently removed, so you can bring it back.</p>
        </ConfirmModal>
      )}
    </div>
  )
}
