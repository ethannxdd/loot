import { Link } from '@tanstack/react-router'
import { Download, FileDown, GitCompare } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { usePlannerPlans } from '@/hooks/usePlannerPlans'
import { exportElementAsPdf, exportElementAsPng } from '@/lib/export'
import { computePlanTotals, METRIC_LOWER_IS_BETTER, winningPlanIds, type CompareMetric } from '@/lib/plan-compare'
import { formatCurrency } from '@/lib/utils'

const ROWS: { key: CompareMetric | 'phaseCount'; label: string }[] = [
  { key: 'tax_rate_pct', label: 'Effective tax rate' },
  { key: 'phaseCount', label: 'Phases' },
  { key: 'totalGross', label: 'Total gross income' },
  { key: 'totalNet', label: 'Total net income' },
  { key: 'totalExpenses', label: 'Total expenses' },
  { key: 'totalLeftover', label: 'Total leftover' },
  { key: 'avgLeftover', label: 'Avg. leftover per phase' },
]

/** Rows that add up every phase — only fair to rank when the plans have the same number of phases. */
const SUMMED_ROWS = new Set(['totalGross', 'totalNet', 'totalExpenses', 'totalLeftover'])

export function ComparePage() {
  const { data: plans = [], isLoading } = usePlannerPlans()
  const [selected, setSelected] = useState<string[]>([])
  const ref = useRef<HTMLDivElement>(null)

  const selectedPlans = plans.filter((p) => selected.includes(p.id))
  const totals = useMemo(() => new Map(selectedPlans.map((p) => [p.id, computePlanTotals(p)])), [selectedPlans])

  function toggle(id: string) {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= 4) return prev
      return [...prev, id]
    })
  }

  function rowValue(planId: string, key: (typeof ROWS)[number]['key']) {
    if (key === 'tax_rate_pct') return plans.find((p) => p.id === planId)?.tax_rate_pct ?? 0
    return totals.get(planId)?.[key] ?? 0
  }

  function formatValue(key: (typeof ROWS)[number]['key'], value: number) {
    if (key === 'tax_rate_pct') return `${value}%`
    if (key === 'phaseCount') return String(value)
    return formatCurrency(value)
  }

  if (isLoading) {
    return <div className="skeleton h-64 rounded-2xl" />
  }

  if (plans.length < 2) {
    return (
      <div className="animate-enter flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
          <GitCompare size={32} strokeWidth={1.75} />
        </div>
        <div className="space-y-1.5">
          <h1 className="text-[28px] font-bold tracking-[-0.025em]">Nothing to compare yet.</h1>
          <p className="max-w-sm text-sm text-muted-foreground">
            {plans.length === 0
              ? 'Create at least two salary plans in the Planner, then come back here to compare them side by side.'
              : 'You have one plan so far. Create a second salary plan in the Planner to compare them side by side.'}
          </p>
        </div>
        <Link to="/planner" className="btn btn-primary">
          Go to the Planner
        </Link>
      </div>
    )
  }

  return (
    <div className="animate-enter space-y-6">
      <header>
        <h1 className="text-[32px] font-bold tracking-[-0.025em]">Compare Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick 2–4 saved plans to compare, metric by metric.</p>
      </header>

      <div className="card">
        <p className="overline mb-3">Select plans (2–4)</p>
        <div className="flex flex-wrap gap-2">
          {plans.map((plan) => {
            const isSelected = selected.includes(plan.id)
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => toggle(plan.id)}
                className={`rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors ${
                  isSelected
                    ? 'border-primary/50 bg-primary/15 text-primary'
                    : 'border-border bg-surface-2 text-muted-foreground hover:border-primary/30'
                }`}
              >
                {plan.name}
              </button>
            )
          })}
        </div>
      </div>

      {selectedPlans.length < 2 ? (
        <p className="card py-10 text-center text-sm text-text-muted">
          Select at least two plans above to see a comparison.
        </p>
      ) : (
        <div className="space-y-3">
          <div ref={ref} className="card overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="overline pb-3 text-left">Metric</th>
                  {selectedPlans.map((plan) => (
                    <th key={plan.id} className="overline pb-3 text-right">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row) => {
                  const values = selectedPlans.map((p) => ({ planId: p.id, value: rowValue(p.id, row.key) }))
                  const comparable = !SUMMED_ROWS.has(row.key) || new Set(selectedPlans.map((p) => p.phases.length)).size === 1
                  const winners =
                    row.key === 'phaseCount' || !comparable
                      ? new Set<string>()
                      : winningPlanIds(values, METRIC_LOWER_IS_BETTER[row.key as CompareMetric])
                  return (
                    <tr key={row.key} className="border-t border-hairline">
                      <td className="py-3 font-semibold text-muted-foreground">{row.label}</td>
                      {values.map(({ planId, value }) => (
                        <td
                          key={planId}
                          className={`tnum py-3 text-right ${
                            winners.has(planId) && winners.size < selectedPlans.length
                              ? 'font-bold text-primary'
                              : ''
                          }`}
                        >
                          {formatValue(row.key, value)}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {new Set(selectedPlans.map((p) => p.phases.length)).size > 1 && (
            <p className="px-1 text-xs text-text-muted">
              These plans have different numbers of phases, so the “Total” rows add up different amounts of time — use the
              average row to see which plan leaves more each month.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => ref.current && exportElementAsPng(ref.current, 'loot-plan-comparison')}
              className="btn btn-ghost"
            >
              <Download size={14} strokeWidth={1.75} /> PNG
            </button>
            <button
              type="button"
              onClick={() => ref.current && exportElementAsPdf(ref.current, 'loot-plan-comparison')}
              className="btn btn-ghost"
            >
              <FileDown size={14} strokeWidth={1.75} /> PDF
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
