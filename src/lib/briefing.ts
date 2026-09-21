import { categoryLabel } from './categories'
import { monthLabel } from './money'
import type { MonthlySnapshot } from './types'
import { formatCurrency } from './utils'

export interface BriefingResult {
  observations: string[]
  recommendation: string
}

/**
 * Generates 5–8 grounded observations plus one prioritised recommendation from a closed
 * month's snapshot, compared against the month before it (LOOT-FEATURES.md "Briefing Card").
 * Rule-based, not an LLM call — Loot Assistant (Gemini) is a separate feature.
 */
export function computeBriefing(closed: MonthlySnapshot, previous: MonthlySnapshot | null): BriefingResult {
  const observations: string[] = []
  const month = monthLabel(closed.month)

  observations.push(
    `In ${month}, you brought in ${formatCurrency(closed.net_income)} and spent ${formatCurrency(closed.total_expenses)}, leaving ${formatCurrency(closed.disposable_income)} disposable.`
  )

  observations.push(`Your savings rate was ${Math.round(closed.savings_rate)}%.`)

  if (previous) {
    const disposableDelta = closed.disposable_income - previous.disposable_income
    if (Math.abs(disposableDelta) > 1) {
      observations.push(
        `Disposable income ${disposableDelta >= 0 ? 'improved' : 'dropped'} by ${formatCurrency(Math.abs(disposableDelta))} vs ${monthLabel(previous.month)}.`
      )
    }

    const expenseDelta = closed.total_expenses - previous.total_expenses
    if (Math.abs(expenseDelta) > 1) {
      observations.push(
        `Total spending ${expenseDelta >= 0 ? 'rose' : 'fell'} by ${formatCurrency(Math.abs(expenseDelta))} compared to the previous month.`
      )
    }

    const rateDelta = closed.savings_rate - previous.savings_rate
    if (Math.abs(rateDelta) >= 1) {
      observations.push(
        `Your savings rate ${rateDelta >= 0 ? 'climbed' : 'slipped'} ${Math.abs(Math.round(rateDelta))} percentage points.`
      )
    }
  }

  const categoryEntries = Object.entries(closed.expenses_by_category).sort((a, b) => b[1] - a[1])
  if (categoryEntries.length > 0) {
    const [topCategory, topAmount] = categoryEntries[0]
    observations.push(`${categoryLabel(topCategory)} was your biggest expense category at ${formatCurrency(topAmount)}.`)
  }

  if (previous) {
    let biggestIncreaseCategory: string | null = null
    let biggestIncreaseAmount = 0
    for (const [category, amount] of categoryEntries) {
      const prevAmount = previous.expenses_by_category[category] ?? 0
      const increase = amount - prevAmount
      if (increase > biggestIncreaseAmount) {
        biggestIncreaseAmount = increase
        biggestIncreaseCategory = category
      }
    }
    if (biggestIncreaseCategory && biggestIncreaseAmount > 50) {
      observations.push(
        `${categoryLabel(biggestIncreaseCategory)} increased the most, up ${formatCurrency(biggestIncreaseAmount)} on the month before.`
      )
    }
  }

  if (closed.net_worth !== null && previous?.net_worth != null) {
    const nwDelta = closed.net_worth - previous.net_worth
    if (Math.abs(nwDelta) > 1) {
      observations.push(`Net worth ${nwDelta >= 0 ? 'grew' : 'shrank'} by ${formatCurrency(Math.abs(nwDelta))}.`)
    }
  }

  if (closed.savings_rate < 5) {
    observations.push('Your savings rate was under 5% — most of what came in went straight back out.')
  } else if (closed.savings_rate >= 20) {
    observations.push('You kept a strong buffer this month, with over 20% of income unspent.')
  }

  let recommendation: string
  if (closed.savings_rate < 5) {
    recommendation = 'Look for one recurring expense you can cut or renegotiate — even a small trim compounds fast at this savings rate.'
  } else if (categoryEntries.length > 0 && categoryEntries[0][1] > closed.net_income * 0.3) {
    recommendation = `${categoryLabel(categoryEntries[0][0])} is taking up a large share of your income — worth checking if that's a one-off or your new normal.`
  } else if (previous && closed.disposable_income < previous.disposable_income) {
    recommendation = 'Disposable income dipped this month — review what changed before it becomes a pattern.'
  } else {
    recommendation = "You're on a solid track — consider directing some of this month's surplus toward a savings goal or extra debt payment."
  }

  return { observations: observations.slice(0, 8), recommendation }
}
