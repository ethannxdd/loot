import { monthlyEquivalent } from './money'
import type { Expense, MonthlySnapshot } from './types'

export type ForecastConfidence = 'high' | 'medium' | 'low'

export interface FlaggedCategory {
  category: string
  current: number
  average: number
  pctAboveAverage: number
}

export interface Forecast {
  projectedIncome: number
  projectedExpensesByCategory: Record<string, number>
  projectedTotalExpenses: number
  projectedDisposableIncome: number
  confidence: ForecastConfidence
  flaggedCategories: FlaggedCategory[]
}

/** Live monthly-equivalent spend per category from current (non-deleted) expenses. */
export function currentExpensesByCategory(expenses: Expense[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const e of expenses) {
    if (e.deleted_at) continue
    totals[e.category] = (totals[e.category] ?? 0) + monthlyEquivalent(e)
  }
  return totals
}

/** Anomaly threshold shared with Statement Analysis's category-anomaly detection. */
const ANOMALY_THRESHOLD = 0.25

/**
 * Projects the current month's end position from the last 3 monthly snapshots, blended
 * with today's live recurring-expense data (per LOOT-FEATURES.md "Forecast Card").
 * Confidence reflects how much snapshot history is available to average over.
 */
export function computeForecast(
  recentSnapshots: MonthlySnapshot[],
  liveExpenses: Expense[],
  liveNetIncome: number
): Forecast {
  const history = recentSnapshots.slice(-3)
  const current = currentExpensesByCategory(liveExpenses)

  const categories = new Set<string>(Object.keys(current))
  for (const s of history) {
    for (const cat of Object.keys(s.expenses_by_category)) categories.add(cat)
  }

  const projectedExpensesByCategory: Record<string, number> = {}
  const flaggedCategories: FlaggedCategory[] = []

  for (const category of categories) {
    const historyAmounts = history.map((s) => s.expenses_by_category[category] ?? 0)
    const avg = historyAmounts.length > 0 ? historyAmounts.reduce((a, b) => a + b, 0) / historyAmounts.length : null
    const currentAmount = current[category] ?? 0

    // Where we have history, blend it with the live figure; otherwise the live figure is all we have.
    const projected = avg !== null ? (avg + currentAmount) / 2 : currentAmount
    projectedExpensesByCategory[category] = projected

    if (avg !== null && avg > 0 && currentAmount > avg * (1 + ANOMALY_THRESHOLD)) {
      flaggedCategories.push({
        category,
        current: currentAmount,
        average: avg,
        pctAboveAverage: ((currentAmount - avg) / avg) * 100,
      })
    }
  }

  const incomeHistory = history.map((s) => s.net_income).filter((n) => n > 0)
  const projectedIncome =
    incomeHistory.length > 0 ? (incomeHistory.reduce((a, b) => a + b, 0) / incomeHistory.length + liveNetIncome) / 2 : liveNetIncome

  const projectedTotalExpenses = Object.values(projectedExpensesByCategory).reduce((a, b) => a + b, 0)
  const projectedDisposableIncome = projectedIncome - projectedTotalExpenses

  const confidence: ForecastConfidence = history.length >= 3 ? 'high' : history.length >= 1 ? 'medium' : 'low'

  flaggedCategories.sort((a, b) => b.pctAboveAverage - a.pctAboveAverage)

  return {
    projectedIncome,
    projectedExpensesByCategory,
    projectedTotalExpenses,
    projectedDisposableIncome,
    confidence,
    flaggedCategories,
  }
}
