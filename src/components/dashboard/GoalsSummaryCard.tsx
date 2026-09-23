import { Link } from '@tanstack/react-router'
import { ChevronRight, Target } from 'lucide-react'
import { useGoals } from '@/hooks/useGoals'
import { displayOrder, monthsUntil, requiredMonthlyContribution } from '@/lib/goal-math'
import { formatCurrency } from '@/lib/utils'

const COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-4)']

function targetLabel(date: string | null) {
  if (!date) return 'No deadline'
  const [y, m] = date.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
}

/** Top three active goals with progress. */
export function GoalsSummaryCard() {
  const { data: goals = [], isLoading } = useGoals()
  const active = displayOrder(goals.filter((g) => !g.is_completed)).slice(0, 3)

  if (isLoading) return <div className="skeleton h-full min-h-[200px] rounded-[22px]" />

  return (
    <section className="card h-full">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="card-title">Goals</h3>
        <Link to="/goals" className="inline-flex items-center text-[13px] font-semibold text-primary">
          View all <ChevronRight size={15} />
        </Link>
      </div>
      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-fill">
            <Target size={20} strokeWidth={1.8} />
          </span>
          <p className="max-w-[240px] text-[13px] text-muted-foreground">Set a savings goal and Loot will pace it for you.</p>
          <Link to="/goals" className="btn btn-ghost !min-h-9 !text-[13px]">
            Add a goal
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-hairline">
          {active.map((g, i) => {
            const pct = g.target_amount > 0 ? Math.min(100, (g.current_amount / g.target_amount) * 100) : 0
            const monthly = requiredMonthlyContribution(g)
            const months = monthsUntil(g.target_date)
            const overdue = g.target_date !== null && months === 0 && pct < 100
            return (
              <li key={g.id} className="py-3.5 last:pb-0">
                <Link to="/goals/$goalId" params={{ goalId: g.id }} className="block">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <span className="truncate text-[14px] font-semibold">{g.name}</span>
                    <span className="tnum shrink-0 text-[13px] text-muted-foreground">
                      {formatCurrency(g.current_amount)} of {formatCurrency(g.target_amount)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-fill">
                    <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                  </div>
                  <div className="mt-1.5 flex justify-between text-[12px] text-muted-foreground">
                    <span className="tnum">{g.is_paused ? 'Paused' : monthly > 0 ? `${formatCurrency(monthly)} / month` : 'No monthly target'}</span>
                    <span className={overdue ? 'font-semibold text-caution' : ''}>{targetLabel(g.target_date)}</span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
