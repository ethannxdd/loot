import type { PlannerPhase } from './types'

/** Net income after a flat effective tax rate. */
export function netAfterTax(grossIncome: number, taxRatePct: number) {
  return grossIncome * (1 - taxRatePct / 100)
}

export function phaseTotalExpenses(phase: PlannerPhase) {
  return phase.expenses.reduce((sum, e) => sum + (e.amount || 0), 0)
}

export interface PhaseComputed {
  netIncome: number
  totalExpenses: number
  leftover: number
}

export function computePhase(phase: PlannerPhase, taxRatePct: number): PhaseComputed {
  const netIncome = netAfterTax(phase.gross_income, taxRatePct)
  const totalExpenses = phaseTotalExpenses(phase)
  return { netIncome, totalExpenses, leftover: netIncome - totalExpenses }
}

export function emptyPhase(name = 'Phase 1'): PlannerPhase {
  return { name, gross_income: 0, expenses: [] }
}
