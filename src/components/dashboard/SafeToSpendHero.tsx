import { Plus } from 'lucide-react'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import type { Cycle } from '@/lib/cycle'
import type { SafeToSpend } from '@/lib/spending'
import { formatCurrency, splitCurrency } from '@/lib/utils'

interface SafeToSpendHeroProps {
  stats: SafeToSpend
  cycle: Cycle
  netIncome: number
  /** Monthly-equivalent spend, excluding saving & growing categories (fixed + variable budgets). */
  committed: number
  /** Monthly savings + investments debits. */
  growing: number
  buffer: number
  budgets: { category: string; budget: number }[]
  onLog: () => void
}

function HeroAmount({ value, alert }: { value: number; alert: boolean }) {
  return (
    <p className={`hero-number tnum mt-4 mb-3 flex items-baseline ${alert ? '!text-alert' : ''}`} aria-label={formatCurrency(value)}>
      <AnimatedNumber
        value={value}
        render={(n) => {
          const { sign, symbol, number } = splitCurrency(n)
          return (
            <>
              {sign && <span>−</span>}
              {symbol && <span className="mr-1.5 text-[0.5em] font-semibold tracking-[-0.02em] text-muted-foreground">{symbol}</span>}
              {number}
            </>
          )
        }}
      />
    </p>
  )
}

/**
 * The Summary hero with payday cycles on (D6): Safe to spend — free money after budgets, debit orders and the
 * buffer — with a per-day figure to payday, what moved it, and how take-home splits this cycle.
 */
export function SafeToSpendHero({ stats, cycle, netIncome, committed, growing, buffer, budgets, onLog }: SafeToSpendHeroProps) {
  const over = stats.state === 'over'
  const toPayday = !cycle.calendar
  const daysLabel = toPayday
    ? `${stats.daysLeft} day${stats.daysLeft === 1 ? '' : 's'} to payday`
    : `${stats.daysLeft} day${stats.daysLeft === 1 ? '' : 's'} left in ${cycle.start.toLocaleDateString('en-ZA', { month: 'long' })}`

  // Spend inside budgets is already part of "committed"; split it out so the bar shows what's gone vs still planned.
  const spentInBudgets = budgets.reduce((s, b) => s + Math.min(Math.max(0, stats.spentByCategory[b.category] ?? 0), b.budget), 0)
  const spent = Math.max(0, spentInBudgets + stats.over + Math.max(0, stats.unplanned))
  const base = Math.max(netIncome, committed + growing + buffer + Math.max(0, stats.safe), 1)
  const segments = [
    { key: 'spent', label: 'Spent', amount: spent, color: 'var(--chart-4)' },
    { key: 'committed', label: 'Committed', amount: Math.max(0, committed - spentInBudgets), color: 'var(--chart-2)' },
    { key: 'growing', label: 'Saving & growing', amount: growing, color: 'var(--chart-3)' },
    { key: 'left', label: 'Left', amount: Math.max(0, stats.safe), color: 'var(--chart-1)' },
    { key: 'buffer', label: 'Buffer', amount: buffer, color: 'var(--fill-2)' },
  ].filter((s) => s.amount > 0)

  const parts = [
    { label: 'Planned', amount: stats.planned, show: true },
    { label: 'Spent unplanned', amount: stats.unplanned, show: stats.unplanned > 0.5 },
    { label: 'Over budget', amount: stats.over, show: stats.over > 0.5 },
  ].filter((p) => p.show)

  return (
    <section className="hero-card flex h-full flex-col p-6 sm:p-7" aria-label="Safe to spend" data-testid="safe-hero">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <span className="chip chip-neutral !h-7 !px-3 !text-[13px]">
            {toPayday ? cycle.shortLabel : cycle.start.toLocaleDateString('en-ZA', { month: 'long' })} · Safe to spend
          </span>
          <HeroAmount value={stats.safe} alert={over} />
          <div className="flex flex-wrap items-center gap-2">
            {over && <span className="chip chip-alert">Over by {formatCurrency(Math.abs(stats.safe))}</span>}
            {!over && stats.state === 'tight' && <span className="chip chip-caution">Tight until payday</span>}
            {parts.map((p) => (
              <span key={p.label} className="chip chip-neutral tnum">
                {p.label}: {formatCurrency(p.amount)}
              </span>
            ))}
          </div>
          {stats.entryCount === 0 && (
            <p className="mt-3 text-[13px] text-muted-foreground">Log spends to make this live — for now it’s your plan.</p>
          )}
        </div>

        {netIncome > 0 && (
          <div className="text-left sm:text-right">
            {over ? (
              <div className="text-[17px] font-semibold text-alert">Ease off until payday</div>
            ) : (
              <>
                <div className="text-[12.5px] text-muted-foreground">You can spend</div>
                <div className="tnum text-[26px] font-bold tracking-[-0.03em]">
                  <AnimatedNumber value={stats.perDay} render={(n) => formatCurrency(n)} />
                  <span className="text-[15px] font-semibold text-muted-foreground"> a day</span>
                </div>
              </>
            )}
            <div className="text-[12.5px] text-muted-foreground">{daysLabel}</div>
            <button type="button" onClick={onLog} className="btn btn-primary mt-3 !min-h-10" data-testid="hero-log">
              <Plus size={16} strokeWidth={2.4} />
              Log a spend
            </button>
          </div>
        )}
      </div>

      {netIncome > 0 && (
        <div className="mt-auto pt-7">
          <div className="flex h-3.5 gap-[3px] overflow-hidden rounded-full" role="img" aria-label="How your take-home pay splits this cycle">
            {segments.map((s, i) => (
              <span
                key={s.key}
                style={{ width: `${(s.amount / base) * 100}%`, background: s.color, transition: 'width 600ms cubic-bezier(0.16,1,0.3,1)' }}
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
