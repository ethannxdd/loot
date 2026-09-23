import { TrendingDown, TrendingUp } from 'lucide-react'
import type { HealthLevel } from '@/lib/money'
import { formatCurrency } from '@/lib/utils'

interface AvailableLootHeroProps {
  /** Disposable income this month (Business Rule 1). */
  value: number
  delta: number | null
  netIncome: number
  /** Monthly-equivalent spend, excluding saving & growing categories. */
  committed: number
  /** Monthly savings + investments debits. */
  growing: number
  health: HealthLevel
  savingsRate: number
  /** Month name the figures belong to, e.g. "September". */
  monthName: string
}

const HEALTH_META: Record<HealthLevel, { label: string; className: string }> = {
  comfortable: { label: 'Comfortable', className: 'chip-positive' },
  balanced: { label: 'Balanced', className: 'chip-caution' },
  tight: { label: 'Tight', className: 'chip-alert' },
}

/** Splits a formatted amount into its currency symbol and the number, so the symbol can be set smaller. */
function splitCurrency(amount: number) {
  const formatted = formatCurrency(amount)
  const match = formatted.match(/^(-?)([^\d-]*?)\s*([\d\s.,]+)$/)
  if (!match) return { sign: '', symbol: '', number: formatted }
  return { sign: match[1], symbol: match[2].trim(), number: match[3].trim() }
}

/**
 * The Dashboard hero (v2): the one number Loot exists to answer — what's actually left this month —
 * with a daily allowance and a bar showing how take-home pay splits into committed, saving & growing,
 * and available.
 */
export function AvailableLootHero({
  value,
  delta,
  netIncome,
  committed,
  growing,
  health,
  savingsRate,
  monthName,
}: AvailableLootHeroProps) {
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = daysInMonth - now.getDate() + 1
  const perDay = value / daysInMonth
  const overspent = value < 0
  const { sign, symbol, number } = splitCurrency(value)
  const isUp = (delta ?? 0) >= 0
  const meta = HEALTH_META[health]

  const base = Math.max(netIncome, committed + growing, 1)
  const segments = [
    { key: 'available', label: 'Available', amount: Math.max(0, value), color: 'var(--chart-1)' },
    { key: 'committed', label: 'Committed', amount: committed, color: 'var(--chart-2)' },
    { key: 'growing', label: 'Saving & growing', amount: growing, color: 'var(--chart-3)' },
  ].filter((s) => s.amount > 0)

  return (
    <section className="hero-card flex h-full flex-col p-6 sm:p-7" aria-label="Available to spend">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <span className="chip chip-neutral !h-7 !px-3 !text-[13px]">{monthName} · Available to spend</span>
          <p
            className={`hero-number tnum mt-4 mb-3 flex items-baseline ${overspent ? '!text-alert' : ''}`}
            aria-label={formatCurrency(value)}
          >
            {sign && <span>−</span>}
            {symbol && (
              <span className="mr-1.5 text-[0.5em] font-semibold tracking-[-0.02em] text-muted-foreground">{symbol}</span>
            )}
            {number}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {delta !== null && Math.round(delta) !== 0 && (
              <span className={`chip ${isUp ? 'chip-positive' : 'chip-alert'}`}>
                {isUp ? <TrendingUp size={13} strokeWidth={2.4} /> : <TrendingDown size={13} strokeWidth={2.4} />}
                {formatCurrency(Math.abs(delta))} {isUp ? 'more' : 'less'} than last month
              </span>
            )}
            {netIncome > 0 && (
              <span className={`chip ${meta.className}`}>
                {meta.label} · {Math.round(savingsRate)}% of take-home
              </span>
            )}
          </div>
        </div>

        {!overspent && netIncome > 0 && (
          <div className="text-left sm:text-right">
            <div className="text-[12.5px] text-muted-foreground">Daily allowance</div>
            <div className="tnum text-[26px] font-bold tracking-[-0.03em]">
              {formatCurrency(perDay)}
              <span className="text-[15px] font-semibold text-muted-foreground"> /day</span>
            </div>
            <div className="text-[12.5px] text-muted-foreground">
              {daysLeft} day{daysLeft === 1 ? '' : 's'} left in {monthName}
            </div>
          </div>
        )}
      </div>

      {netIncome > 0 && (
        <div className="mt-auto pt-7">
          <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full" role="img" aria-label="How your take-home pay splits">
            {segments.map((s, i) => (
              <span
                key={s.key}
                style={{ width: `${(s.amount / base) * 100}%`, background: s.color }}
                className={`${i === 0 ? 'rounded-l-full' : 'rounded-l-[3px]'} ${i === segments.length - 1 ? 'rounded-r-full' : 'rounded-r-[3px]'}`}
              />
            ))}
          </div>
          <div className="mt-3.5 flex flex-wrap gap-x-7 gap-y-3">
            {segments.map((s) => (
              <div key={s.key} className="text-[12.5px] text-muted-foreground">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-[3px] align-[1px]" style={{ background: s.color }} />
                {s.label}
                <b className="tnum mt-0.5 block text-[15px] font-semibold text-foreground">{formatCurrency(s.amount)}</b>
              </div>
            ))}
            <div className="text-[12.5px] text-muted-foreground sm:ml-auto sm:text-right">
              Take-home pay
              <b className="tnum mt-0.5 block text-[15px] font-semibold text-foreground">{formatCurrency(netIncome)}</b>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
