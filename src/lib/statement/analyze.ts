import { categorizeTransaction, merchantKey } from './categorize'
import type { ParsedTransaction, StatementAnalysis } from '@/lib/types'
import { categoryLabel } from '@/lib/categories'

export interface StatementSummary {
  /** Calendar months ('YYYY-MM') the transactions fall in, oldest first. */
  months: string[]
  /** The month most transactions fall in — what the analysis is saved under. */
  primaryMonth: string | null
  /** First and last transaction date. */
  from: string | null
  to: string | null
  /** How many months of spending the statement covers (by days, so a 15th–14th statement counts as 1). */
  periodMonths: number
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

  const dates = transactions.map((t) => t.date).sort()
  const monthCounts = new Map<string, number>()
  for (const t of transactions) monthCounts.set(t.date.slice(0, 7), (monthCounts.get(t.date.slice(0, 7)) ?? 0) + 1)
  const months = [...monthCounts.keys()].sort()
  const primaryMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]?.[0] ?? null

  const from = dates[0] ?? null
  const to = dates[dates.length - 1] ?? null
  const spanDays = from && to ? Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1 : 0
  const periodMonths = Math.max(1, Math.round(spanDays / 30.4))

  return {
    months,
    primaryMonth,
    from,
    to,
    periodMonths,
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

/**
 * Categories spending 25%+ above the average of the same category in the most recent prior analyses.
 * `current` identifies the statement being analysed so a previously saved copy of the same month is never
 * compared with itself; `months` scales a multi-month statement down to a per-month figure.
 */
export function detectAnomalies(
  categoryTotals: Record<string, number>,
  priorAnalyses: StatementAnalysis[],
  current?: { bank: string; month: string | null; months?: number },
): CategoryAnomaly[] {
  const prior = priorAnalyses.filter((a) => !(current && a.bank === current.bank && current.month && a.statement_month === current.month))
  if (prior.length === 0) return []
  const scale = Math.max(1, current?.months ?? 1)
  const recent = prior.slice(0, 3)
  const anomalies: CategoryAnomaly[] = []

  for (const [category, total] of Object.entries(categoryTotals)) {
    const actual = total / scale
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

/**
 * A short readable name for a subscription — "Netflix.com" rather than the raw statement line, which can carry
 * reference numbers and card digits that have no business being saved to an account.
 */
function tidyServiceName(description: string): string {
  const key = merchantKey(description)
  const words = key.split(' ').filter(Boolean)
  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  return name || description.trim().slice(0, 40)
}

/** Recurring-looking charges in the 'subscriptions' category from this statement. */
export function detectSubscriptions(transactions: ParsedTransaction[]): SubscriptionCandidate[] {
  const byMerchant = new Map<string, ParsedTransaction[]>()
  for (const t of transactions) {
    if (t.category !== 'subscriptions' || t.amount >= 0) continue
    const key = merchantKey(t.description)
    if (!byMerchant.has(key)) byMerchant.set(key, [])
    byMerchant.get(key)!.push(t)
  }
  return [...byMerchant.values()].map((txns) => {
    const latest = [...txns].sort((a, b) => b.date.localeCompare(a.date))[0]
    return { serviceName: tidyServiceName(latest.description), amount: Math.abs(latest.amount), lastCharged: latest.date }
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
