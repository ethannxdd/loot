import { Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { simulatePayoff, totalDebtBalance, totalMinPayments } from '@/lib/debt-math'
import { formatCurrency } from '@/lib/utils'
import type { Debt } from '@/lib/types'

interface DebtStrategyComparisonProps {
  debts: Debt[]
  extraPayment: number
  onExtraPaymentChange: (value: number) => void
  chosenStrategy: string | null
  onChooseStrategy: (strategy: 'avalanche' | 'snowball') => void
  isSaving?: boolean
}

function monthLabel(months: number) {
  const years = Math.floor(months / 12)
  const rem = months % 12
  if (years === 0) return `${rem}mo`
  if (rem === 0) return `${years}y`
  return `${years}y ${rem}mo`
}

export function DebtStrategyComparison({
  debts,
  extraPayment,
  onExtraPaymentChange,
  chosenStrategy,
  onChooseStrategy,
  isSaving,
}: DebtStrategyComparisonProps) {
  const [chartStrategy, setChartStrategy] = useState<'avalanche' | 'snowball'>('avalanche')

  const avalanche = useMemo(() => simulatePayoff(debts, extraPayment, 'avalanche'), [debts, extraPayment])
  const snowball = useMemo(() => simulatePayoff(debts, extraPayment, 'snowball'), [debts, extraPayment])

  const active = chartStrategy === 'avalanche' ? avalanche : snowball
  const chartData = active.schedule
    .filter((_, i) => i % Math.max(1, Math.floor(active.schedule.length / 24)) === 0)
    .map((s) => ({ month: s.month, balance: Math.round(s.totalBalance) }))

  if (debts.length === 0) {
    return (
      <p className="card py-10 text-center text-sm text-text-muted">
        Add at least one debt above to compare payoff strategies.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="overline">Total debt</p>
          <p className="tnum text-lg">{formatCurrency(totalDebtBalance(debts))}</p>
        </div>
        <div>
          <p className="overline">Min. payments</p>
          <p className="tnum text-lg">{formatCurrency(totalMinPayments(debts))}/mo</p>
        </div>
        <div className="min-w-[160px]">
          <label className="field-label" htmlFor="extra-payment">
            Extra payment / month
          </label>
          <input
            id="extra-payment"
            type="number"
            min={0}
            step={50}
            value={extraPayment || ''}
            onChange={(e) => onExtraPaymentChange(Number(e.target.value) || 0)}
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            { key: 'avalanche' as const, title: 'Avalanche', desc: 'Highest interest rate first — saves the most interest.' },
            { key: 'snowball' as const, title: 'Snowball', desc: 'Smallest balance first — fastest early wins.' },
          ]
        ).map(({ key, title, desc }) => {
          const result = key === 'avalanche' ? avalanche : snowball
          const isChosen = chosenStrategy === key
          return (
            <div
              key={key}
              className={`card space-y-3 ${isChosen ? 'border-primary/50' : ''}`}
              onClick={() => setChartStrategy(key)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold">{title}</h3>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                {isChosen && (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check size={14} strokeWidth={2.5} />
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface-2 px-3 py-2">
                  <p className="overline">Debt-free in</p>
                  <p className="tnum text-sm">{monthLabel(result.totalMonths)}</p>
                </div>
                <div className="rounded-lg bg-surface-2 px-3 py-2">
                  <p className="overline">Total interest</p>
                  <p className="tnum text-sm">{formatCurrency(result.totalInterest)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onChooseStrategy(key)
                }}
                disabled={isSaving}
                className={isChosen ? 'btn btn-secondary w-full' : 'btn btn-ghost w-full'}
              >
                {isChosen ? 'Chosen strategy' : 'Choose this strategy'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="card">
        <p className="overline mb-3">
          Payoff timeline — {chartStrategy === 'avalanche' ? 'Avalanche' : 'Snowball'}
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => monthLabel(m)}
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }} axisLine={false} tickLine={false} width={0} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value) || 0)}
                labelFormatter={(m) => `Month ${m}`}
                contentStyle={{
                  background: '#211B1B',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="balance" stroke="#AF72FE" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
