import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { categoryLabel } from '@/lib/categories'
import { GROWTH_CATEGORIES } from '@/lib/categories'
import { monthlyEquivalent } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import type { Expense } from '@/lib/types'

const PALETTE = ['#AF72FE', '#C1FE72', '#5BC0EB', '#F0A857', '#FF7F7F', '#8B5CF6', '#7DD9C5']

export function WhereYourLootGoes({ expenses }: { expenses: Expense[] }) {
  const { spendSlices, growthTotal, total } = useMemo(() => {
    const active = expenses.filter((e) => !e.deleted_at)
    const totals = new Map<string, number>()
    let growth = 0
    for (const e of active) {
      const amount = monthlyEquivalent(e)
      if (GROWTH_CATEGORIES.has(e.category as never)) {
        growth += amount
        continue
      }
      totals.set(e.category, (totals.get(e.category) ?? 0) + amount)
    }
    const slices = Array.from(totals.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const grandTotal = slices.reduce((s, x) => s + x.amount, 0) + growth
    return { spendSlices: slices, growthTotal: growth, total: grandTotal }
  }, [expenses])

  if (total === 0) {
    return (
      <div className="card flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
        <p className="text-sm font-semibold">Where your loot goes</p>
        <p className="text-xs text-text-muted">Add expenses to see the breakdown.</p>
      </div>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="overline">Where your loot goes</div>
      <div className="flex items-center gap-5">
        <div className="h-28 w-28 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={spendSlices}
                dataKey="amount"
                nameKey="category"
                innerRadius={38}
                outerRadius={54}
                paddingAngle={2}
                stroke="none"
              >
                {spendSlices.map((slice, i) => (
                  <Cell key={slice.category} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [formatCurrency(Number(value) || 0), categoryLabel(String(name))]}
                contentStyle={{
                  background: '#211B1B',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-1.5">
          {spendSlices.slice(0, 5).map((slice, i) => (
            <li key={slice.category} className="flex items-center gap-2 text-xs">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
              />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {categoryLabel(slice.category)}
              </span>
              <span className="tnum shrink-0 font-semibold">{formatCurrency(slice.amount)}</span>
            </li>
          ))}
          {growthTotal > 0 && (
            <li className="flex items-center gap-2 border-t border-hairline pt-1.5 text-xs">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
              <span className="min-w-0 flex-1 truncate text-primary">Saving & growing</span>
              <span className="tnum shrink-0 font-semibold text-primary">
                {formatCurrency(growthTotal)}
              </span>
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
