import { computePhase } from './planner-math'
import type { PlannerPlan } from './types'

export interface PlanTotals {
  planId: string
  phaseCount: number
  /** Gross salary / month the most demanding phase needs. */
  peakGross: number
  /** Take-home / month the most demanding phase needs. */
  peakNet: number
  /** Average gross / month needed across phases. */
  avgRequiredGross: number
  /** Average monthly-equivalent spend across phases. */
  avgExpenses: number
  /** Average leftover target across phases. */
  avgLeftoverTarget: number
}

export function computePlanTotals(plan: PlannerPlan): PlanTotals {
  const computed = plan.phases.map((p) => computePhase(p, plan.tax_rate_pct))
  const n = computed.length
  const avg = (pick: (c: (typeof computed)[number]) => number) => (n > 0 ? computed.reduce((s, c) => s + pick(c), 0) / n : 0)
  return {
    planId: plan.id,
    phaseCount: n,
    peakGross: n > 0 ? Math.max(...computed.map((c) => c.requiredGross)) : 0,
    peakNet: n > 0 ? Math.max(...computed.map((c) => c.requiredNet)) : 0,
    avgRequiredGross: avg((c) => c.requiredGross),
    avgExpenses: avg((c) => c.totalExpenses),
    avgLeftoverTarget: avg((c) => c.leftoverTarget),
  }
}

export type CompareMetric = 'tax_rate_pct' | 'peakGross' | 'peakNet' | 'avgRequiredGross' | 'avgExpenses' | 'avgLeftoverTarget'

/** true = lower value wins (a cheaper life, less tax); false = higher value wins (more kept each month). */
export const METRIC_LOWER_IS_BETTER: Record<CompareMetric, boolean> = {
  tax_rate_pct: true,
  peakGross: true,
  peakNet: true,
  avgRequiredGross: true,
  avgExpenses: true,
  avgLeftoverTarget: false,
}

/** Rows shown on the compare page and in its export, in order. */
export const COMPARE_ROWS: { key: CompareMetric | 'phaseCount'; label: string }[] = [
  { key: 'peakGross', label: 'Salary needed (gross/mo)' },
  { key: 'peakNet', label: 'Take-home needed' },
  { key: 'avgRequiredGross', label: 'Avg. salary per phase' },
  { key: 'avgExpenses', label: 'Avg. monthly spend' },
  { key: 'avgLeftoverTarget', label: 'Avg. leftover target' },
  { key: 'tax_rate_pct', label: 'Effective tax rate' },
  { key: 'phaseCount', label: 'Phases' },
]

/** Returns the plan id(s) with the winning value for a metric (ties all win). */
export function winningPlanIds(values: { planId: string; value: number }[], lowerIsBetter: boolean): Set<string> {
  if (values.length === 0) return new Set()
  const best = lowerIsBetter ? Math.min(...values.map((v) => v.value)) : Math.max(...values.map((v) => v.value))
  return new Set(values.filter((v) => Math.abs(v.value - best) < 0.01).map((v) => v.planId))
}
