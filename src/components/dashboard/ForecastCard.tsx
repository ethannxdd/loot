import { Activity } from 'lucide-react'
import { useId } from 'react'
import { categoryLabel } from '@/lib/categories'
import { computeForecast } from '@/lib/forecast'
import { currentMonthKey } from '@/lib/money'
import type { Expense, MonthlySnapshot } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'

const CONFIDENCE_META = {
  high: { label: 'High confidence', className: 'chip-positive' },
  medium: { label: 'Medium confidence', className: 'chip-caution' },
  low: { label: 'Low confidence — needs more history', className: 'chip-neutral' },
}

interface ForecastCardProps {
  snapshots: MonthlySnapshot[]
  expenses: Expense[]
  netIncome: number
  /** Live disposable income right now — drawn as the "Now" marker on this month's bar. */
  currentDisposable: number
}

function shortMonth(key: string) {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'short' })
}

/** Month-end forecast (v2): headline projection + Health-style bars of what was left over each month. */
export function ForecastCard({ snapshots, expenses, netIncome, currentDisposable }: ForecastCardProps) {
  const forecast = computeForecast(snapshots, expenses, netIncome)
  const confidence = CONFIDENCE_META[forecast.confidence]
  const hatchId = `hatch-${useId().replace(/:/g, '')}`
  const monthName = new Date().toLocaleDateString('en-ZA', { month: 'long' })

  const thisMonth = currentMonthKey()
  const history = snapshots
    .filter((s) => s.month < thisMonth)
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-5)
    .map((s) => ({ label: shortMonth(s.month), value: s.disposable_income, projected: false }))
  const bars = [...history, { label: shortMonth(thisMonth), value: forecast.projectedDisposableIncome, projected: true }]

  const W = 360
  const H = 200
  const base = H - 24
  const maxVal = Math.max(...bars.map((b) => b.value), currentDisposable, 1) * 1.1
  const bw = 38
  const gap = bars.length > 1 ? (W - bars.length * bw) / (bars.length - 1) : 0
  const y = (v: number) => base - (Math.max(0, v) / maxVal) * (base - 18)
  const flagged = forecast.flaggedCategories[0]

  return (
    <section className="card h-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="card-title">Month-end forecast</h3>
        <div className="flex gap-4 text-[12px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-[3px] w-3.5 rounded bg-primary" /> Left over
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-[3px] w-3.5 rounded bg-primary opacity-35" /> Projected
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="sm:w-[200px] sm:shrink-0">
          <p className="text-[13px] text-muted-foreground">You&apos;ll likely end {monthName} with</p>
          <p
            className={`tnum mt-1 mb-2 text-[30px] font-bold tracking-[-0.03em] ${
              forecast.projectedDisposableIncome < 0 ? 'text-alert' : ''
            }`}
          >
            {formatCurrency(forecast.projectedDisposableIncome)}
          </p>
          <span className={`chip ${confidence.className}`}>{confidence.label}</span>
          {flagged && (
            <p className="mt-3.5 flex gap-1.5 text-[13px] text-muted-foreground">
              <Activity size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-caution" />
              <span>
                {categoryLabel(flagged.category)} is tracking{' '}
                <b className="font-semibold text-foreground">{Math.round(flagged.pctAboveAverage)}% above</b> your 3-month
                average.
              </span>
            </p>
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-0 sm:ml-auto sm:max-w-[380px]" role="img" aria-label="Money left over each month">
          <defs>
            <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill="var(--accent-tint)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="var(--accent)" strokeWidth="2" opacity="0.45" />
            </pattern>
          </defs>
          {[0.33, 0.66, 1].map((f) => (
            <line key={f} x1="0" x2={W} y1={base - f * (base - 18)} y2={base - f * (base - 18)} stroke="var(--hairline)" strokeDasharray="2 4" />
          ))}
          {bars.map((b, i) => {
            const x = i * (bw + gap)
            const top = y(b.value)
            const h = Math.max(base - top, 2)
            return (
              <g key={`${b.label}-${i}`}>
                <rect
                  x={x}
                  y={base - h}
                  width={bw}
                  height={h}
                  rx="9"
                  fill={b.projected ? `url(#${hatchId})` : 'var(--accent)'}
                  opacity={b.projected ? 1 : 0.35 + (0.6 * (i + 1)) / Math.max(history.length, 1)}
                />
                <text
                  x={x + bw / 2}
                  y={H - 5}
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight={b.projected ? 600 : 500}
                  fill={b.projected ? 'var(--fg)' : 'var(--label-2)'}
                >
                  {b.label}
                </text>
                {b.projected && (
                  <>
                    <line x1={x - 4} x2={x + bw + 4} y1={y(currentDisposable)} y2={y(currentDisposable)} stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
                    <text x={x + bw / 2} y={y(currentDisposable) - 7} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--fg)">
                      Now
                    </text>
                  </>
                )}
              </g>
            )
          })}
        </svg>
      </div>
    </section>
  )
}
