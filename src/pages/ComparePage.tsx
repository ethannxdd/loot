import { Link } from '@tanstack/react-router'
import { Check, Download, FileDown, GitCompare } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { usePlannerPlans } from '@/hooks/usePlannerPlans'
import { CompareExportDoc } from '@/components/export/ExportDocs'
import { exportDocument } from '@/lib/export'
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
  // Until the user picks, compare the first two plans so the page opens on a real comparison.
  const [picked, setPicked] = useState<string[] | null>(null)
  const selected = picked ?? plans.slice(0, 2).map((p) => p.id)

  const selectedPlans = plans.filter((p) => selected.includes(p.id))
  const totals = useMemo(() => new Map(selectedPlans.map((p) => [p.id, computePlanTotals(p)])), [selectedPlans])

  function toggle(id: string) {
    const prev = selected
    if (prev.includes(id)) return setPicked(prev.filter((x) => x !== id))
    if (prev.length >= 4) return
    setPicked([...prev, id])
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
      <div className="animate-enter space-y-6">
      <PageHeader eyebrow="Planning" title="Compare plans" />
      <div className="card-elevated flex flex-col items-center gap-4 py-14 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-primary/12 text-primary">
          <GitCompare size={28} strokeWidth={1.8} />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-[20px] font-bold tracking-[-0.02em]">Nothing to compare yet</h2>
          <p className="max-w-sm text-[14px] text-muted-foreground">
            {plans.length === 0
              ? 'Create at least two salary plans in the Planner, then come back here to compare them side by side.'
              : 'You have one plan so far. Create a second salary plan in the Planner to compare them side by side.'}
          </p>
        </div>
        <Link to="/planner" className="btn btn-primary">
          Go to the Salary planner
        </Link>
      </div>
      </div>
    )
  }

  return (
    <div className="animate-enter space-y-6">
      <PageHeader eyebrow="Planning" title="Compare plans" subtitle="Pick two to four saved plans and see them side by side." />

      <div className="space-y-2.5" data-tutorial="compare-pick">
        <p className="px-1 text-[13px] font-medium text-muted-foreground">
          Choose plans · {selected.length} of up to 4 selected
        </p>
        <div className="flex flex-wrap gap-2">
          {plans.map((plan) => {
            const isSelected = selected.includes(plan.id)
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => toggle(plan.id)}
                aria-pressed={isSelected}
                className={`inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition-colors ${
                  isSelected ? 'bg-ink text-ink-foreground' : 'bg-surface text-foreground shadow-[var(--shadow-card)] hover:bg-surface-2'
                }`}
              >
                {isSelected && <Check size={15} strokeWidth={2.6} />}
                {plan.name}
              </button>
            )
          })}
        </div>
      </div>

      {selectedPlans.length < 2 ? (
        <p className="card py-10 text-center text-[14px] text-muted-foreground">
          Select at least two plans above to see a comparison.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="card-elevated overflow-x-auto sm:p-6">
            <table className="w-full min-w-[480px] border-collapse text-[14.5px]">
              <thead>
                <tr>
                  <th className="pb-3 text-left text-[13px] font-medium text-muted-foreground">Metric</th>
                  {selectedPlans.map((plan) => (
                    <th key={plan.id} className="pb-3 text-right text-[15px] font-bold tracking-[-0.01em]">
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
                      <td className="py-3.5 text-muted-foreground">{row.label}</td>
                      {values.map(({ planId, value }) => (
                        <td
                          key={planId}
                          className="tnum py-3.5 text-right font-semibold"
                        >
                          {winners.has(planId) && winners.size < selectedPlans.length ? (
                            <span className="chip chip-positive !text-[13.5px]">{formatValue(row.key, value)}</span>
                          ) : (
                            formatValue(row.key, value)
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {new Set(selectedPlans.map((p) => p.phases.length)).size > 1 && (
            <p className="px-1 text-[13px] text-muted-foreground">
              These plans have different numbers of phases, so the “Total” rows add up different amounts of time — use the
              average row to see which plan leaves more each month.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
              <span className="chip chip-positive !h-6 !text-[12px]">Green</span> = the better number in each row
            </p>
            <div className="flex gap-2">
            <button
              type="button"
              onClick={() => exportDocument(<CompareExportDoc plans={selectedPlans} />, 'loot-plan-comparison', 'png')}
              className="btn btn-ghost"
            >
              <Download size={14} strokeWidth={2} /> Image
            </button>
            <button
              type="button"
              onClick={() => exportDocument(<CompareExportDoc plans={selectedPlans} />, 'loot-plan-comparison', 'pdf')}
              className="btn btn-ghost"
            >
              <FileDown size={14} strokeWidth={2} /> PDF
            </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
