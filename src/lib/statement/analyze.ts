import { categorizeTransaction } from './categorize'
import type { ParsedTransaction, StatementAnalysis } from '@/lib/types'
import { categoryLabel } from '@/lib/categories'

export interface StatementSummary {
  totalIncome: number
  totalSpent: number
  netPosition: number
  unclassifiedAmount: number
  categoryTotals: Record<string, number>
  transactions: ParsedTransaction[]
  unclassified: ParsedTransaction[]
}

/** Applies the categorisation ruleset to every transaction and rolls up totals. */
export function analyzeTransactions(rawTransactions: ParsedTransaction[]): StatementSummary {
  const transactions = rawTransactions.map((t) => ({
    ...t,
    category: t.category ?? categorizeTransaction(t.description),
  }))

  let totalIncome = 0
  let totalSpent = 0
  let unclassifiedAmount = 0
  const categoryTotals: Record<string, number> = {}
  const unclassified: ParsedTransaction[] = []

  for (const t of transactions) {
    if (t.amount > 0) {
      totalIncome += t.amount
      continue
    }
    const spend = Math.abs(t.amount)
    totalSpent += spend
    if (t.category) {
      categoryTotals[t.category] = (categoryTotals[t.category] ?? 0) + spend
    } else {
      unclassifiedAmount += spend
      unclassified.push(t)
    }
  }

  return {
    totalIncome,
    totalSpent,
    netPosition: totalIncome - totalSpent,
    unclassifiedAmount,
    categoryTotals,
    transactions,
    unclassified,
  }
}

export interface CategoryAnomaly {
  category: string
  actual: number
  average: number
  pctAbove: number
}

/** Categories spending 25%+ above the average of the same category in prior analyses. */
export function detectAnomalies(
  categoryTotals: Record<string, number>,
  priorAnalyses: StatementAnalysis[]
): CategoryAnomaly[] {
  if (priorAnalyses.length === 0) return []
  const recent = priorAnalyses.slice(0, 3)
  const anomalies: CategoryAnomaly[] = []

  for (const [category, actual] of Object.entries(categoryTotals)) {
    const priorValues = recent.map((a) => a.category_totals[category] ?? 0).filter((v) => v > 0)
    if (priorValues.length === 0) continue
    const average = priorValues.reduce((a, b) => a + b, 0) / priorValues.length
    if (average <= 0) continue
    const pctAbove = ((actual - average) / average) * 100
    if (pctAbove >= 25) {
      anomalies.push({ category, actual, average, pctAbove })
    }
  }
  return anomalies.sort((a, b) => b.pctAbove - a.pctAbove)
}

export interface SubscriptionCandidate {
  serviceName: string
  amount: number
  lastCharged: string
}

/** Recurring-looking charges in the 'subscriptions' category from this statement. */
export function detectSubscriptions(transactions: ParsedTransaction[]): SubscriptionCandidate[] {
  const byMerchant = new Map<string, ParsedTransaction[]>()
  for (const t of transactions) {
    if (t.category !== 'subscriptions' || t.amount >= 0) continue
    const key = t.description.trim().toLowerCase()
    if (!byMerchant.has(key)) byMerchant.set(key, [])
    byMerchant.get(key)!.push(t)
  }
  return [...byMerchant.entries()].map(([, txns]) => {
    const latest = txns.sort((a, b) => b.date.localeCompare(a.date))[0]
    return { serviceName: latest.description.trim(), amount: Math.abs(latest.amount), lastCharged: latest.date }
  })
}

export function generateRecommendations(
  summary: StatementSummary,
  anomalies: CategoryAnomaly[],
  subscriptions: SubscriptionCandidate[]
): string[] {
  const recs: string[] = []

  if (summary.totalSpent > 0 && summary.unclassifiedAmount / summary.totalSpent > 0.15) {
    recs.push(
      `${((summary.unclassifiedAmount / summary.totalSpent) * 100).toFixed(0)}% of your spend is unclassified — assign categories manually so your breakdown stays accurate.`
    )
  }

  for (const a of anomalies.slice(0, 3)) {
    recs.push(
      `${categoryLabel(a.category as never)} spending is ${a.pctAbove.toFixed(0)}% above your recent average — worth a closer look.`
    )
  }

  if (subscriptions.length >= 3) {
    recs.push(`You have ${subscriptions.length} active subscriptions this month — review them for ones you no longer use.`)
  }

  if (summary.netPosition < 0) {
    recs.push('You spent more than you received this period — check for one-off costs before assuming this is your new normal.')
  } else if (summary.totalIncome > 0 && summary.totalSpent / summary.totalIncome > 0.9) {
    recs.push("You're spending over 90% of what came in this period — there's very little room left for surprises.")
  }

  if (recs.length === 0) {
    recs.push('Nothing unusual jumped out this period — your spending looks consistent with your recent history.')
  }

  return recs
}
