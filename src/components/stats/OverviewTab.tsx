import { TrendingDown, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Segmented } from '@/components/ui/Segmented'
import { Select } from '@/components/ui/Select'
import { StatStrip } from '@/components/ui/StatStrip'
import { chartAxisTick, chartTooltipStyle } from '@/lib/chart'
import { monthLabel } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'
import type { MonthlySnapshot } from '@/lib/types'

const RANGES = ['3', '6', '12'] as const

function Delta({ value, upIsGood }: { value: number | null; upIsGood: boolean }) {
  if (value === null) return <span>First month on record</span>
  if (Math.round(value) === 0) return <span>Same as the month before</span>
  const up = value > 0
  const good = up === upIsGood
  return (
    <span className={`inline-flex items-center gap-1 font-semibold ${good ? 'text-primary' : 'text-alert'}`}>
      {up ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
      {formatCurrency(Math.abs(value))} {up ? 'more' : 'less'}
    </span>
  )
}

export function OverviewTab({ snapshots }: { snapshots: MonthlySnapshot[] }) {
  const [range, setRange] = useState<(typeof RANGES)[number]>('6')
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  if (snapshots.length === 0) {
    return <p className="card py-10 text-center text-[14px] text-muted-foreground">No monthly data yet — it builds up as you use Loot.</p>
  }

  const visible = snapshots.slice(-Number(range))
  const chartData = visible.map((s) => ({
    month: monthLabel(s.month),
    disposable: Math.round(s.disposable_income),
    expenses: Math.round(s.total_expenses),
  }))

  const current = (selectedMonth && snapshots.find((s) => s.month === selectedMonth)) || snapshots[snapshots.length - 1]
  const currentIndex = snapshots.findIndex((s) => s.month === current.month)
  const previous = currentIndex > 0 ? snapshots[currentIndex - 1] : null
  const d = (k: 'net_income' | 'total_expenses' | 'disposable_income') => (previous ? current[k] - previous[k] : null)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <h2 className="card-title">{monthLabel(current.month)} at a glance</h2>
        <div className="w-44">
          <Select
            value={current.month}
            onValueChange={setSelectedMonth}
            aria-label="Month"
            options={snapshots
              .slice()
              .reverse()
              .map((s) => ({ value: s.month, label: monthLabel(s.month) + (s.locked_at ? ' · closed' : '') }))}
          />
        </div>
      </div>

      <StatStrip
        items={[
          { label: 'Coming in', color: 'var(--chart-1)', value: formatCurrency(current.net_income), sub: <Delta value={d('net_income')} upIsGood /> },
          { label: 'Going out', color: 'var(--chart-2)', value: formatCurrency(current.total_expenses), sub: <Delta value={d('total_expenses')} upIsGood={false} /> },
          {
            label: 'Left over',
            color: 'var(--accent)',
            value: formatCurrency(current.disposable_income),
            valueColor: current.disposable_income < 0 ? 'var(--alert)' : undefined,
            sub: <Delta value={d('disposable_income')} upIsGood />,
          },
          { label: 'Savings rate', value: `${Math.round(current.savings_rate)}%`, sub: current.savings_rate >= 20 ? 'Comfortable' : current.savings_rate >= 5 ? 'Balanced' : 'Tight' },
        ]}
      />

      <section className="card sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="card-title">Trend</h3>
            <div className="mt-1 flex gap-4 text-[12.5px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-[3px] w-3.5 rounded bg-primary" /> Left over
              </span>
              <span className="flex items-center gap-1.5">
                <i className="inline-block h-[3px] w-3.5 rounded bg-[var(--chart-2)]" /> Going out
              </span>
            </div>
          </div>
          <Segmented
            label="Range"
            value={range}
            onChange={setRange}
            options={RANGES.map((r) => ({ value: r, label: `${r} mo` }))}
          />
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="ovFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 4" stroke="var(--hairline)" vertical={false} />
              <XAxis dataKey="month" tick={chartAxisTick} axisLine={false} tickLine={false} />
              <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={0} />
              <Tooltip formatter={(value) => formatCurrency(Number(value) || 0)} contentStyle={chartTooltipStyle} />
              <Area type="monotone" dataKey="disposable" name="Left over" stroke="var(--accent)" strokeWidth={2.5} fill="url(#ovFill)" dot={visible.length < 3} />
              <Line type="monotone" dataKey="expenses" name="Going out" stroke="var(--chart-2)" strokeWidth={2} dot={visible.length < 3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
