import { AlertTriangle, Check } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Segmented } from '@/components/ui/Segmented'
import { chartTooltipStyle } from '@/lib/chart'
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
      <p className="card py-10 text-center text-[14px] text-muted-foreground">
        Add at least one debt above to compare payoff strategies.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="card-elevated grid grid-cols-2 items-end gap-5 sm:grid-cols-3 sm:p-6">
        <div>
          <p className="text-[13px] font-medium text-muted-foreground">Total debt</p>
          <p className="tnum mt-1 text-[24px] font-bold tracking-[-0.03em]">{formatCurrency(totalDebtBalance(debts))}</p>
        </div>
        <div className="sm:border-l sm:border-hairline sm:pl-5">
          <p className="text-[13px] font-medium text-muted-foreground">Minimum payments</p>
          <p className="tnum mt-1 text-[24px] font-bold tracking-[-0.03em]">{formatCurrency(totalMinPayments(debts))}<span className="text-[14px] text-muted-foreground">/mo</span></p>
        </div>
        <div className="col-span-2 sm:col-span-1 sm:border-l sm:border-hairline sm:pl-5">
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
              className={`card cursor-pointer space-y-4 sm:p-6 ${isChosen ? '!shadow-[0_0_0_2px_var(--accent)]' : ''} ${
                chartStrategy === key && !isChosen ? '!shadow-[0_0_0_1.5px_var(--border)]' : ''
              }`}
              onClick={() => setChartStrategy(key)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[18px] font-bold tracking-[-0.015em]">{title}</h3>
                  <p className="text-[13px] text-muted-foreground">{desc}</p>
                </div>
                {isChosen && (
                  <span className="chip chip-positive shrink-0">
                    <Check size={13} strokeWidth={2.6} /> Your plan
                  </span>
                )}
              </div>
              {result.neverPaidOff ? (
                <div className="flex items-start gap-2 rounded-xl bg-alert/10 px-3.5 py-3 text-[13px] font-medium text-alert">
                  <AlertTriangle size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
                  <p>
                    At these payments {result.order.filter((id) => !result.perDebt[id].paidOff).map(nameOf).join(', ')}{' '}
                    never gets paid off — the interest is as big as, or bigger than, the payment. Raise the minimum or add an extra payment.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-surface-2 p-3.5">
                    <p className="text-[12.5px] text-muted-foreground">Debt-free in</p>
                    <p className="tnum text-[20px] font-bold tracking-[-0.02em]">{monthLabel(result.totalMonths)}</p>
                  </div>
                  <div className="rounded-2xl bg-surface-2 p-3.5">
                    <p className="text-[12.5px] text-muted-foreground">Total interest</p>
                    <p className="tnum text-[20px] font-bold tracking-[-0.02em]">{formatCurrency(result.totalInterest)}</p>
                  </div>
                </div>
              )}
              <ol className="space-y-1.5 text-[13px] text-muted-foreground">
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
                className={isChosen ? 'btn btn-accent w-full' : 'btn btn-ghost w-full'}
              >
                {isChosen ? 'Chosen strategy' : 'Choose this strategy'}
              </button>
            </div>
          )
        })}
      </div>

      <div className="card sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="card-title">Balance over time</h3>
          <Segmented
            label="Strategy shown"
            value={chartStrategy}
            onChange={setChartStrategy}
            options={[
              { value: 'avalanche', label: 'Avalanche' },
              { value: 'snowball', label: 'Snowball' },
            ]}
          />
        </div>
        {active.neverPaidOff ? (
          <p className="py-10 text-center text-[13px] text-muted-foreground">
            The balance never reaches zero at these payments, so there's no timeline to draw.
          </p>
        ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
              <defs>
                <linearGradient id="debtFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={(m) => monthLabel(m)}
                tick={{ fontSize: 11, fill: 'var(--label-2)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={28}
              />
              <YAxis tick={{ fontSize: 11, fill: 'var(--label-2)' }} axisLine={false} tickLine={false} width={0} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value) || 0)}
                labelFormatter={(m) => `Month ${m}`}
                contentStyle={chartTooltipStyle}
              />
              <Area type="monotone" dataKey="balance" name="Balance" stroke="var(--chart-5)" strokeWidth={2.5} fill="url(#debtFill)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>
    </div>
  )
}
