import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Select } from '@/components/ui/Select'
import { StatStrip } from '@/components/ui/StatStrip'
import { categoryColor, categoryLabel, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/categories'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import { monthLabel } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import type { MonthlySnapshot } from '@/lib/types'

export function CategoryTrendsTab({ snapshots }: { snapshots: MonthlySnapshot[] }) {
  const categoriesWithData = useMemo(() => {
    const seen = new Set<string>()
    for (const s of snapshots) {
      for (const cat of Object.keys(s.expenses_by_category ?? {})) seen.add(cat)
    }
    return EXPENSE_CATEGORIES.filter((c) => seen.has(c))
  }, [snapshots])

  // The snapshots may still be loading when this mounts, so the list of categories changes underneath us —
  // fall back to the first available category whenever the chosen one isn't in it.
  const [chosen, setChosen] = useState<ExpenseCategory | ''>('')
  const category: ExpenseCategory | '' = chosen && categoriesWithData.includes(chosen) ? chosen : (categoriesWithData[0] ?? '')

  if (categoriesWithData.length === 0) {
    return (
      <p className="card py-10 text-center text-[14px] text-muted-foreground">
        No categorised spending yet — add some expenses first.
      </p>
    )
  }

  const data = snapshots.map((s) => ({
    month: monthLabel(s.month),
    amount: Math.round((category && s.expenses_by_category?.[category]) || 0),
  }))
  const amounts = data.map((x) => x.amount)
  const latest = amounts[amounts.length - 1] ?? 0
  const avg = amounts.length ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0
  const peak = Math.max(...amounts, 0)
  const color = category ? categoryColor(category) : 'var(--chart-2)'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="card-title">One category over time</h2>
        <div className="w-56">
          <Select
            value={category}
            onValueChange={(v) => setChosen(v as ExpenseCategory)}
            aria-label="Category"
            options={categoriesWithData.map((c) => ({ value: c, label: categoryLabel(c) }))}
          />
        </div>
      </div>

      <StatStrip
        items={[
          { label: 'Latest month', color, value: formatCurrency(latest) },
          { label: `Average (${amounts.length} mo)`, value: formatCurrency(avg) },
          {
            label: 'vs average',
            value: `${latest >= avg ? '+' : '−'}${avg > 0 ? Math.round((Math.abs(latest - avg) / avg) * 100) : 0}%`,
            valueColor: latest > avg * 1.1 ? 'var(--caution)' : undefined,
          },
          { label: 'Highest month', value: formatCurrency(peak) },
        ]}
      />

      <section className="card sm:p-6">
        <h3 className="card-title mb-4">{category ? categoryLabel(category) : ''} each month</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--hairline)" vertical={false} />
              <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
              <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={0} />
              <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} contentStyle={chartTooltipStyle} cursor={{ fill: 'var(--fill)' }} />
              <ReferenceLine y={avg} stroke="var(--label-3)" strokeDasharray="4 4" />
              <Bar dataKey="amount" name={category ? categoryLabel(category) : 'Amount'} fill={color} radius={[8, 8, 3, 3]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">Dashed line = your average.</p>
      </section>
    </div>
  )
}
