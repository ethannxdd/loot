import { BarChart3 } from 'lucide-react'
import { BENCHMARK_MIN_SAMPLE, useSpendingBenchmarks } from '@/hooks/useSpendingBenchmarks'
import { categoryLabel } from '@/lib/categories'
import { incomeBracket, INCOME_BRACKET_LABELS } from '@/lib/money'
import type { MonthlySnapshot } from '@/lib/types'

export function BenchmarksTab({
  latestSnapshot,
  grossIncome,
}: {
  latestSnapshot: MonthlySnapshot | undefined
  grossIncome: number
}) {
  const bracket = incomeBracket(grossIncome)
  const { data: benchmarks = [], isLoading } = useSpendingBenchmarks(bracket)
  const eligible = benchmarks.filter((b) => b.sample_size >= BENCHMARK_MIN_SAMPLE)

  if (isLoading) return <div className="skeleton h-40 rounded-2xl" />

  if (eligible.length === 0) {
    return (
      <div className="card-elevated flex flex-col items-center gap-3 py-12 text-center">
        <BarChart3 size={28} strokeWidth={1.75} className="text-text-muted" />
        <div className="space-y-1">
          <p className="text-sm font-bold">Not enough data yet</p>
          <p className="max-w-xs text-xs text-text-muted">
            Benchmarks for the {INCOME_BRACKET_LABELS[bracket]} bracket need at least{' '}
            {BENCHMARK_MIN_SAMPLE} Loot users before they're reliable. Check back once Loot has
            more users in your bracket.
          </p>
        </div>
      </div>
    )
  }

  const userTotals = latestSnapshot?.expenses_by_category ?? {}
  const userTotal = Object.values(userTotals).reduce((s, v) => s + v, 0)

  return (
    <div className="card space-y-3">
      <div className="overline-label">Your spend vs the {INCOME_BRACKET_LABELS[bracket]} bracket</div>
      {eligible.map((b) => {
        const userAmount = userTotals[b.category] ?? 0
        const userPct = userTotal > 0 ? (userAmount / userTotal) * 100 : 0
        return (
          <div key={b.category} className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{categoryLabel(b.category)}</span>
              <span className="tnum">
                You {userPct.toFixed(0)}% · Avg {b.avg_pct.toFixed(0)}%
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-secondary/50"
                style={{ width: `${Math.min(100, b.avg_pct)}%` }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-primary"
                style={{ width: `${Math.min(100, userPct)}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
