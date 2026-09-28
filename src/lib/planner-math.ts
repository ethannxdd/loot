import { computeGrossTax, computeRebates } from './tax/tax-math'
import { getCurrentTaxYear, getTaxTable } from './tax/tax-tables'
import type { ExpenseFrequency, PlannerExpenseItem, PlannerPhase } from './types'

/**
 * The salary planner works backwards, like the original Lovable version: sketch the life you want in each phase
 * (expenses + what you'd like left over) and Loot works out the take-home and gross salary that pays for it.
 *
 * All amounts are monthly unless named otherwise.
 */

/** Net income after a flat effective tax rate. */
export function netAfterTax(grossIncome: number, taxRatePct: number) {
  return grossIncome * (1 - taxRatePct / 100)
}

/** Gross needed for a given take-home at a flat effective rate. */
export function grossForNet(net: number, taxRatePct: number) {
  const keep = 1 - taxRatePct / 100
  return keep > 0 ? net / keep : 0
}

export function itemFrequency(item: PlannerExpenseItem): ExpenseFrequency {
  return item.frequency ?? 'monthly'
}

/**
 * Monthly-equivalent cost of one plan item. Once-off costs are spread over the phase's length when it's set;
 * otherwise they don't count towards the monthly figure (they're shown separately as an up-front amount).
 */
export function itemMonthly(item: PlannerExpenseItem, months?: number | null): number {
  const amount = Number.isFinite(item.amount) ? item.amount || 0 : 0
  switch (itemFrequency(item)) {
    case 'weekly':
      return (amount * 52) / 12
    case 'annual':
      return amount / 12
    case 'once-off':
      return months && months > 0 ? amount / months : 0
    case 'monthly':
    default:
      return amount
  }
}

/** Monthly-equivalent total of a phase's expenses (once-off costs included only when the phase has a length). */
export function phaseTotalExpenses(phase: PlannerPhase) {
  return phase.expenses.reduce((sum, e) => sum + itemMonthly(e, phase.months), 0)
}

/** Once-off costs that are NOT spread into the monthly figure (the phase has no length). */
export function phaseUpfront(phase: PlannerPhase) {
  if (phase.months && phase.months > 0) return 0
  return phase.expenses
    .filter((e) => itemFrequency(e) === 'once-off')
    .reduce((sum, e) => sum + (Number.isFinite(e.amount) ? e.amount || 0 : 0), 0)
}

export interface PhaseComputed {
  /** Monthly-equivalent expenses. */
  totalExpenses: number
  leftoverTarget: number
  /** Take-home needed each month: expenses + leftover target. */
  requiredNet: number
  /** Gross salary needed each month at the plan's effective tax rate. */
  requiredGross: number
  requiredAnnualGross: number
  /** Once-off costs not included in the monthly figures. */
  upfront: number
  /** Take-home of the salary being tested (0 when none is set). */
  netIncome: number
  /** What the tested salary leaves after expenses (0 when none is set). */
  leftover: number
  hasSalary: boolean
}

export function computePhase(phase: PlannerPhase, taxRatePct: number): PhaseComputed {
  const totalExpenses = phaseTotalExpenses(phase)
  const leftoverTarget = Math.max(0, phase.leftover_target ?? 0)
  const requiredNet = totalExpenses + leftoverTarget
  const requiredGross = grossForNet(requiredNet, taxRatePct)
  const hasSalary = phase.gross_income > 0
  const netIncome = hasSalary ? netAfterTax(phase.gross_income, taxRatePct) : 0
  return {
    totalExpenses,
    leftoverTarget,
    requiredNet,
    requiredGross,
    requiredAnnualGross: requiredGross * 12,
    upfront: phaseUpfront(phase),
    netIncome,
    leftover: hasSalary ? netIncome - totalExpenses : 0,
    hasSalary,
  }
}

export function emptyPhase(name = 'Phase 1'): PlannerPhase {
  return { name, gross_income: 0, leftover_target: 0, months: null, expenses: [] }
}

/** Old plans (pre 2026-09-28) are missing the new optional fields — give every phase a complete shape. */
export function normalisePhase(phase: Partial<PlannerPhase>, index = 0): PlannerPhase {
  return {
    name: phase.name ?? `Phase ${index + 1}`,
    gross_income: Number(phase.gross_income) || 0,
    leftover_target: Number(phase.leftover_target) || 0,
    months: phase.months && phase.months > 0 ? phase.months : null,
    expenses: (phase.expenses ?? []).map((e) => ({ ...e, frequency: e.frequency ?? 'monthly' })),
  }
}

/** The phase that needs the highest salary — what a plan "costs" at its most demanding. */
export function peakPhaseIndex(phases: PlannerPhase[], taxRatePct: number): number {
  let best = -1
  let bestGross = -1
  phases.forEach((p, i) => {
    const g = computePhase(p, taxRatePct).requiredGross
    if (g > bestGross) {
      bestGross = g
      best = i
    }
  })
  return best
}

// ---------------------------------------------------------------------------
// SARS tables — used to suggest a tax rate that matches the salary the plan needs.
// Income tax only (primary rebate, under 65); UIF, pension and medical credits are left out.
// ---------------------------------------------------------------------------

export function netFromGrossSars(grossMonthly: number, taxYear = getCurrentTaxYear()): number {
  if (!(grossMonthly > 0)) return 0
  const table = getTaxTable(taxYear)
  const annual = grossMonthly * 12
  const liability = Math.max(0, computeGrossTax(annual, table) - computeRebates(30, table))
  return grossMonthly - liability / 12
}

/** Gross monthly salary whose SARS take-home is `netMonthly` (binary search — take-home rises with gross). */
export function grossForNetSars(netMonthly: number, taxYear = getCurrentTaxYear()): number {
  if (!(netMonthly > 0)) return 0
  let lo = netMonthly
  let hi = netMonthly * 2.5
  while (netFromGrossSars(hi, taxYear) < netMonthly) hi *= 2
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (netFromGrossSars(mid, taxYear) < netMonthly) lo = mid
    else hi = mid
  }
  return hi
}

/** The effective rate (1 decimal) at which a flat-rate plan matches SARS for this take-home. */
export function sarsRateForNet(netMonthly: number, taxYear = getCurrentTaxYear()): number {
  const gross = grossForNetSars(netMonthly, taxYear)
  if (!(gross > 0)) return 0
  return Math.round((1 - netMonthly / gross) * 1000) / 10
}
