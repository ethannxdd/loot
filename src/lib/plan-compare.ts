import { computePhase } from './planner-math'
import type { PlannerPlan } from './types'

export interface PlanTotals {
  planId: string
  totalGross: number
  totalNet: number
  totalExpenses: number
  totalLeftover: number
}

export function computePlanTotals(plan: PlannerPlan): PlanTotals {
  let totalGross = 0
  let totalNet = 0
  let totalExpenses = 0
  let totalLeftover = 0
  for (const phase of plan.phases) {
    const computed = computePhase(phase, plan.tax_rate_pct)
    totalGross += phase.gross_income
    totalNet += computed.netIncome
    totalExpenses += computed.totalExpenses
    totalLeftover += computed.leftover
  }
  return { planId: plan.id, totalGross, totalNet, totalExpenses, totalLeftover }
}

export type CompareMetric = 'tax_rate_pct' | 'totalGross' | 'totalNet' | 'totalExpenses' | 'totalLeftover'

/** true = lower value wins (tax rate, expenses); false = higher value wins. */
export const METRIC_LOWER_IS_BETTER: Record<CompareMetric, boolean> = {
  tax_rate_pct: true,
  totalGross: false,
  totalNet: false,
  totalExpenses: true,
  totalLeftover: false,
}

/** Returns the plan id(s) with the winning value for a metric (ties all win). */
export function winningPlanIds(values: { planId: string; value: number }[], lowerIsBetter: boolean): Set<string> {
  if (values.length === 0) return new Set()
  const best = lowerIsBetter ? Math.min(...values.map((v) => v.value)) : Math.max(...values.map((v) => v.value))
  return new Set(values.filter((v) => Math.abs(v.value - best) < 0.01).map((v) => v.planId))
}
