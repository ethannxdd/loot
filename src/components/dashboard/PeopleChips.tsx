import { Link } from '@tanstack/react-router'
import { HandCoins, Split } from 'lucide-react'
import { useOnceOffIncome, useSplits } from '@/hooks/usePeople'
import type { Cycle } from '@/lib/cycle'
import { inCycle } from '@/lib/cycle'
import { balances } from '@/lib/splits'
import { formatCurrency } from '@/lib/utils'

/**
 * Summary chips (§4.1, §4.2): an expected stokvel payout this cycle, and what friends owe you / you owe them. Neither is
 * in Safe to spend until it actually lands (payout "Received", split settled).
 */
export function PeopleChips({ cycle }: { cycle: Cycle }) {
  const { data: income = [] } = useOnceOffIncome()
  const { data: splits } = useSplits()
  const payouts = income.filter((i) => !i.received_on && inCycle(new Date(`${i.expected_on}T12:00:00`), cycle))
  const b = splits ? balances(splits.splits, splits.shares) : { owedToMe: 0, iOwe: 0 }
  if (payouts.length === 0 && b.owedToMe === 0 && b.iOwe === 0) return null

  return (
    <div className="flex flex-wrap gap-2" data-testid="people-chips">
      {payouts.map((p) => (
        <Link
          key={p.id}
          to={p.source_id ? '/stokvels/$stokvelId' : '/stokvels'}
          params={p.source_id ? { stokvelId: p.source_id } : undefined}
          className="chip chip-positive !h-9 !px-3.5 !text-[13px]"
        >
          <HandCoins size={14} /> {p.label} this cycle: {formatCurrency(p.amount)}
        </Link>
      ))}
      {(b.owedToMe > 0 || b.iOwe > 0) && (
        <Link to="/splits" className="chip chip-neutral !h-9 !px-3.5 !text-[13px]">
          <Split size={14} />
          {[b.owedToMe > 0 && `Owed to you ${formatCurrency(b.owedToMe)}`, b.iOwe > 0 && `You owe ${formatCurrency(b.iOwe)}`].filter(Boolean).join(' · ')}
        </Link>
      )}
    </div>
  )
}
