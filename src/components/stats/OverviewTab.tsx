import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Select } from '@/components/ui/Select'
import { monthLabel } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import type { MonthlySnapshot } from '@/lib/types'

const RANGES = [3, 6, 12] as const

export function OverviewTab({ snapshots }: { snapshots: MonthlySnapshot[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>(6)
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const visible = snapshots.slice(-range)
  const chartData = visible.map((s) => ({
    month: monthLabel(s.month),
    disposable: Math.round(s.disposable_income),
    expenses: Math.round(s.total_expenses),
  }))

  const current = selectedMonth
    ? (snapshots.find((s) => s.month === selectedMonth) ?? snapshots[snapshots.length - 1])
    : snapshots[snapshots.length - 1]
  const currentIndex = current ? snapshots.findIndex((s) => s.month === current.month) : -1
  const previous = currentIndex > 0 ? snapshots[currentIndex - 1] : null

  const rows = useMemo(() => {
    if (!current) return []
    return [
      { label: 'Net income', key: 'net_income' as const, upIsGood: true },
      { label: 'Total expenses', key: 'total_expenses' as const, upIsGood: false },
      { label: 'Disposable income', key: 'disposable_income' as const, upIsGood: true },
    ].map(({ label, key, upIsGood }) => ({
      label,
      value: current[key],
      delta: previous ? current[key] - previous[key] : null,
      upIsGood,
    }))
  }, [current, previous])

  if (snapshots.length === 0) {
    return <p className="card py-10 text-center text-sm text-text-muted">No monthly data yet.</p>
  }

  return (
    <div className="space-y-5">
      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <span className="overline-label">Trend</span>
          <div className="flex rounded-[10px] border border-border bg-input p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  range === r ? 'bg-surface-3 text-foreground' : 'text-text-muted'
                }`}
              >
                {r}mo
              </button>
            ))}
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
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
              <Line type="monotone" dataKey="disposable" name="Disposable" stroke="#C1FE72" strokeWidth={2} dot={visible.length < 3} />
              <Line type="monotone" dataKey="expenses" name="Expenses" stroke="#AF72FE" strokeWidth={2} dot={visible.length < 3} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <span className="overline-label">Month-over-month</span>
          <Select
            value={current?.month ?? ''}
            onValueChange={setSelectedMonth}
            className="!w-auto text-xs"
            options={snapshots
              .slice()
              .reverse()
              .map((s) => ({ value: s.month, label: monthLabel(s.month) }))}
          />
        </div>
        {!previous && <p className="text-xs text-text-muted">Loot needs two months of data to show changes.</p>}
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <div className="flex items-center gap-2">
                <span className="tnum font-semibold">{formatCurrency(row.value)}</span>
                {row.delta !== null && (
                  <span
                    className={`text-xs ${
                      Math.round(row.delta) === 0 ? 'text-text-muted' : row.delta > 0 === row.upIsGood ? 'text-primary' : 'text-alert'
                    }`}
                  >
                    {row.delta > 0 ? '+' : ''}
                    {formatCurrency(row.delta)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
