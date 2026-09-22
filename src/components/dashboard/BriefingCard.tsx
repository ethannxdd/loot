import { Newspaper } from 'lucide-react'
import { useLatestBriefing } from '@/hooks/useMonthlyBriefing'
import { monthLabel } from '@/lib/money'
import type { MonthlySnapshot } from '@/lib/types'

export function BriefingCard({ snapshots }: { snapshots: MonthlySnapshot[] }) {
  const lockedSnapshots = snapshots.filter((s) => s.locked_at)
  const { latest, isLoading } = useLatestBriefing(lockedSnapshots)

  if (isLoading) return <div className="skeleton h-40 rounded-2xl" />

  if (!latest) {
    return (
      <div className="card space-y-2">
        <div className="overline-label flex items-center gap-1.5">
          <Newspaper size={13} strokeWidth={2} /> Briefing
        </div>
        <p className="text-sm text-muted-foreground">
          Close your first month to get a briefing — a short read-out of what happened and what to do next.
        </p>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      <div className="overline-label flex items-center gap-1.5">
        <Newspaper size={13} strokeWidth={2} /> Briefing — {monthLabel(latest.month)}
      </div>
      <ul className="space-y-1.5">
        {latest.observations.map((o, i) => (
          <li key={i} className="text-xs leading-relaxed text-muted-foreground">
            {o}
          </li>
        ))}
      </ul>
      <div className="rounded-lg border border-primary/25 bg-primary/8 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Recommendation</p>
        <p className="mt-1 text-xs leading-relaxed">{latest.recommendation}</p>
      </div>
    </div>
  )
}
