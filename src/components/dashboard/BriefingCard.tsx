import { Lightbulb } from 'lucide-react'
import { useState } from 'react'
import { useLatestBriefing } from '@/hooks/useMonthlyBriefing'
import type { MonthlySnapshot } from '@/lib/types'

function monthLong(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long' })
}

/** Last closed month's briefing: the headline observation, the recommendation, and the rest on demand. */
export function BriefingCard({ snapshots }: { snapshots: MonthlySnapshot[] }) {
  const lockedSnapshots = snapshots.filter((s) => s.locked_at)
  const { latest, isLoading } = useLatestBriefing(lockedSnapshots)
  const [expanded, setExpanded] = useState(false)

  if (isLoading) return <div className="skeleton h-44 rounded-[22px]" />

  if (!latest) {
    return (
      <section className="card">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="card-title">Monthly briefing</h3>
        </div>
        <p className="text-[14px] text-muted-foreground">
          Close your first month to get a briefing — a short read-out of what happened and what to do next.
        </p>
      </section>
    )
  }

  const [headline, ...rest] = latest.observations

  return (
    <section className="card-purple flex-1 p-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="card-title">{monthLong(latest.month)} in review</h3>
        <span className="text-[13px] text-muted-foreground">Briefing</span>
      </div>
      <p className="text-[15px] leading-relaxed tracking-[-0.008em]">{headline}</p>
      {expanded && (
        <ul className="animate-enter mt-3 space-y-1.5">
          {rest.map((o, i) => (
            <li key={i} className="text-[13.5px] leading-relaxed text-muted-foreground">
              {o}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-start gap-3 rounded-[14px] bg-surface-2 p-3.5">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
          <Lightbulb size={15} strokeWidth={2.1} />
        </span>
        <p className="text-[13.5px] leading-relaxed">{latest.recommendation}</p>
      </div>
      {rest.length > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-3 text-[13px] font-semibold text-primary"
        >
          {expanded ? 'Show less' : `Read the full briefing (${rest.length} more)`}
        </button>
      )}
    </section>
  )
}
