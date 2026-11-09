import { Link } from '@tanstack/react-router'
import { motion, useReducedMotion } from 'motion/react'
import { categoryColor, categoryIcon, categoryLabel } from '@/lib/categories'
import type { Cycle } from '@/lib/cycle'
import { paceFor, type Budget } from '@/lib/spending'
import { formatCurrency } from '@/lib/utils'

interface BudgetsCardProps {
  budgets: Budget[]
  spentByCategory: Record<string, number>
  cycle: Cycle
  /** Show every budget (on /spending) rather than the top few (Summary). */
  full?: boolean
  limit?: number
}

/**
 * Variable budgets for the cycle (§3.2): "R x left of R y", a bar in the category colour and a pace marker showing
 * where spend should be today if it were spread evenly. Amber = ahead of pace, alert = over.
 */
export function BudgetsCard({ budgets, spentByCategory, cycle, full = false, limit = 5 }: BudgetsCardProps) {
  const reduce = useReducedMotion()
  const today = new Date()
  const rows = budgets.map((b) => ({ ...b, pace: paceFor(b.budget, Math.max(0, spentByCategory[b.category] ?? 0), cycle, today) }))
  const shown = full ? rows : rows.slice(0, limit)
  const totalLeft = rows.reduce((s, r) => s + r.pace.left, 0)

  return (
    <section className="card flex h-full flex-col" data-testid="budgets-card">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="card-title">Budgets</h3>
        {rows.length > 0 && <span className="tnum text-[13px] text-muted-foreground">{formatCurrency(totalLeft)} left</span>}
      </div>
      {rows.length === 0 ? (
        <div className="py-5 text-center">
          <p className="text-[13px] text-muted-foreground">
            Variable expenses — groceries, eating out, fuel — become budgets you can log spends against.
          </p>
          <Link to="/expenses" search={{ add: true }} className="btn btn-secondary mt-3 !min-h-9 !text-[13px]">
            Add a variable expense
          </Link>
        </div>
      ) : (
        <ul className="space-y-3.5">
          {shown.map(({ category, budget, pace }) => {
            const Icon = categoryIcon(category)
            const pct = budget > 0 ? Math.min(100, (pace.spent / budget) * 100) : 0
            const tone = pace.status === 'over' ? 'text-alert' : pace.status === 'ahead' ? 'text-caution' : 'text-muted-foreground'
            return (
              <li key={category} className="grid grid-cols-[auto_1fr] items-center gap-3">
                <span className="icon-tile !h-8 !w-8 !rounded-[9px]" style={{ background: categoryColor(category) }}>
                  <Icon size={15} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold">{categoryLabel(category)}</span>
                    <span className={`tnum shrink-0 text-[12.5px] ${tone}`}>
                      {pace.status === 'over'
                        ? `${formatCurrency(pace.spent - budget)} over`
                        : `${formatCurrency(pace.left)} left of ${formatCurrency(budget)}`}
                    </span>
                  </div>
                  <div className="budget-track mt-1.5" role="img" aria-label={`${Math.round(pct)}% of the ${categoryLabel(category)} budget used`}>
                    <motion.span
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ background: pace.status === 'over' ? 'var(--alert)' : categoryColor(category) }}
                      initial={false}
                      animate={{ width: `${pct}%` }}
                      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 160, damping: 24 }}
                    />
                    {pace.fraction > 0 && pace.fraction < 1 && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-[-2px] w-[2px] rounded-full bg-foreground/45"
                        style={{ left: `calc(${pace.fraction * 100}% - 1px)` }}
                      />
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {!full && rows.length > shown.length && (
        <Link to="/spending" className="mt-auto pt-3 text-[13px] font-semibold text-primary">
          See all {rows.length} budgets
        </Link>
      )}
      {cycle.daysLeft > 0 && rows.length > 0 && (
        <p className="mt-3 text-[12px] text-text-subtle">The thin line marks where you’d be today spending evenly.</p>
      )}
    </section>
  )
}
