import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useMemo } from 'react'
import { categoryColor, categoryIcon, categoryLabel, GROWTH_CATEGORIES } from '@/lib/categories'
import { monthlyEquivalent } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

const MAX_ROWS = 7

/** Screen-Time-style ranked bars of monthly spend per category. Saving & growing is shown as its own line. */
export function WhereYourLootGoes({ expenses, compact = false }: { expenses: Expense[]; compact?: boolean }) {
  const { rows, growthTotal, spendTotal } = useMemo(() => {
    const totals = new Map<string, number>()
    let growth = 0
    for (const e of expenses) {
      if (e.deleted_at) continue
      const amount = monthlyEquivalent(e)
      if (amount <= 0) continue
      if (GROWTH_CATEGORIES.has(e.category as never)) {
        growth += amount
        continue
      }
      totals.set(e.category, (totals.get(e.category) ?? 0) + amount)
    }
    const sorted = Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const limit = compact ? 5 : MAX_ROWS
    const head = sorted.slice(0, limit)
    const tail = sorted.slice(limit)
    if (tail.length > 0) head.push({ category: 'other_rollup', amount: tail.reduce((s, x) => s + x.amount, 0) })
    return { rows: head, growthTotal: growth, spendTotal: sorted.reduce((s, x) => s + x.amount, 0) }
  }, [expenses, compact])

  const top = rows[0]?.amount || 1

  return (
    <section className="card h-full">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="card-title">Where it goes</h3>
        <Link to="/expenses" className="inline-flex items-center text-[13px] font-semibold text-primary">
          All expenses <ChevronRight size={15} />
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">Add expenses to see the breakdown.</p>
      ) : (
        <ul className="space-y-3.5">
          {rows.map((row) => {
            const isRollup = row.category === 'other_rollup'
            const Icon = categoryIcon(isRollup ? 'other' : row.category)
            const color = isRollup ? 'var(--chart-7)' : categoryColor(row.category)
            return (
              <li key={row.category} className="grid grid-cols-[30px_1fr_auto] items-center gap-3">
                <span className="grid h-[30px] w-[30px] place-items-center rounded-[9px] text-white" style={{ background: color }}>
                  <Icon size={15} strokeWidth={2.1} />
                </span>
                <div className="min-w-0">
                  <div className="mb-1.5 flex justify-between gap-2 text-[13.5px] font-medium">
                    <span className="truncate">{isRollup ? 'Everything else' : categoryLabel(row.category)}</span>
                    <span className="tnum shrink-0 text-[12.5px] font-medium text-muted-foreground">
                      {Math.round((row.amount / (spendTotal || 1)) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-fill">
                    <span className="block h-full rounded-full" style={{ width: `${(row.amount / top) * 100}%`, background: color }} />
                  </div>
                </div>
                <span className="tnum min-w-[76px] text-right text-[14px] font-semibold">{formatCurrency(row.amount)}</span>
              </li>
            )
          })}
        </ul>
      )}
      {growthTotal > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/10 px-3.5 py-2.5 text-[13px] font-semibold text-primary">
          <span>Saving &amp; growing each month</span>
          <span className="tnum">{formatCurrency(growthTotal)}</span>
        </div>
      )}
    </section>
  )
}
