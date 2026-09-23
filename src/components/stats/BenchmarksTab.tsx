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
      <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-fill text-muted-foreground">
          <BarChart3 size={28} strokeWidth={1.8} />
        </span>
        <div className="space-y-1.5">
          <p className="text-[20px] font-bold tracking-[-0.02em]">Not enough data yet</p>
          <p className="max-w-sm text-[14px] text-muted-foreground">
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
    <div className="card space-y-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="card-title">You vs the {INCOME_BRACKET_LABELS[bracket]} bracket</h3>
        <div className="flex gap-4 text-[12.5px] text-muted-foreground">
          <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-[3px] bg-primary" /> You</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-2 w-2 rounded-[3px] bg-fill-2" /> Average</span>
        </div>
      </div>
      {eligible.map((b) => {
        const userAmount = userTotals[b.category] ?? 0
        const userPct = userTotal > 0 ? (userAmount / userTotal) * 100 : 0
        return (
          <div key={b.category} className="space-y-1">
            <div className="flex justify-between text-[13.5px]">
              <span className="font-medium">{categoryLabel(b.category)}</span>
              <span className="tnum text-muted-foreground">
                You {userPct.toFixed(0)}% · Avg {b.avg_pct.toFixed(0)}%
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-fill">
              <div
                className="absolute inset-y-0 left-0 rounded-full bg-fill-2"
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
