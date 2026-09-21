import { AlertTriangle, Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { simulatePayoff, totalDebtBalance, totalMinPayments } from '@/lib/debt-math'
import { parseDateOnly } from '@/lib/goal-math'
import { formatCurrency } from '@/lib/utils'
import type { Debt } from '@/lib/types'

interface DebtStrategyComparisonProps {
  debts: Debt[]
  extraPayment: number
  onExtraPaymentChange: (value: number) => void
  /** Called when the user finishes editing the extra payment (blur / Enter) — the moment to save it. */
  onExtraPaymentCommit: (value: number) => void
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
  onExtraPaymentCommit,
  chosenStrategy,
  onChooseStrategy,
  isSaving,
}: DebtStrategyComparisonProps) {
  const [chartStrategy, setChartStrategy] = useState<'avalanche' | 'snowball'>('avalanche')

  const avalanche = useMemo(() => simulatePayoff(debts, extraPayment, 'avalanche'), [debts, extraPayment])
  const snowball = useMemo(() => simulatePayoff(debts, extraPayment, 'snowball'), [debts, extraPayment])

  const nameOf = (id: string) => debts.find((d) => d.id === id)?.name ?? 'Debt'
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
            onChange={(e) => onExtraPaymentChange(Math.max(0, Number(e.target.value) || 0))}
            onBlur={(e) => onExtraPaymentCommit(Math.max(0, Number(e.target.value) || 0))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
            }}
            placeholder="0"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              {result.neverPaidOff ? (
                <div className="flex items-start gap-2 rounded-lg border border-alert/30 bg-alert/10 px-3 py-2.5 text-xs text-alert">
                  <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  <p>
                    At these payments {result.order.filter((id) => !result.perDebt[id].paidOff).map(nameOf).join(', ')}{' '}
                    never gets paid off — the interest is as big as, or bigger than, the payment. Raise the minimum or add an extra payment.
                  </p>
                </div>
              ) : (
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
              )}
              <ol className="space-y-1 text-xs text-muted-foreground">
                {result.order.map((id, i) => {
                  const entry = result.perDebt[id]
                  return (
                    <li key={id} className="flex justify-between gap-2">
                      <span className="truncate">
                        {i + 1}. {nameOf(id)}
                      </span>
                      <span className="tnum shrink-0">
                        {entry.paidOff
                          ? parseDateOnly(entry.payoffDate).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
                          : 'Not paid off'}
                      </span>
                    </li>
                  )
                })}
              </ol>
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
        {active.neverPaidOff ? (
          <p className="py-10 text-center text-xs text-text-muted">
            The balance never reaches zero at these payments, so there's no timeline to draw.
          </p>
        ) : (
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
                interval="preserveStartEnd"
                minTickGap={28}
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
        )}
      </div>
    </div>
  )
}
