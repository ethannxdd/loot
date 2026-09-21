import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { categoryLabel, EXPENSE_CATEGORIES, type ExpenseCategory } from '@/lib/categories'
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

  const data = snapshots.map((s) => ({
    month: monthLabel(s.month),
    amount: Math.round((category && s.expenses_by_category?.[category]) || 0),
  }))

  if (categoriesWithData.length === 0) {
    return (
      <p className="card py-10 text-center text-sm text-text-muted">
        No categorised spending yet — add some expenses first.
      </p>
    )
  }

  return (
    <div className="card space-y-4">
      <select
        value={category}
        onChange={(e) => setChosen(e.target.value as ExpenseCategory)}
        className="!w-auto"
      >
        {categoriesWithData.map((c) => (
          <option key={c} value={c}>
            {categoryLabel(c)}
          </option>
        ))}
      </select>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} width={0} />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value) || 0)}
              contentStyle={{
                background: '#211B1B',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Line type="monotone" dataKey="amount" name={category ? categoryLabel(category) : 'Amount'} stroke="#5BC0EB" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
