import type { SavingsGoal } from './types'

/** Whole months between now and a target date (0 if past/today, null if no date set). */
export function monthsUntil(targetDate: string | null, from = new Date()): number | null {
  if (!targetDate) return null
  const target = new Date(targetDate)
  const months =
    (target.getFullYear() - from.getFullYear()) * 12 + (target.getMonth() - from.getMonth())
  return Math.max(0, months)
}

/** How much this goal needs per month to hit its target by its target date. */
export function requiredMonthlyContribution(goal: SavingsGoal, from = new Date()): number {
  if (goal.is_completed || goal.is_paused) return 0
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)
  const months = monthsUntil(goal.target_date, from)
  if (months === null) return 0 // no deadline — no forced monthly requirement
  if (months === 0) return remaining
  return remaining / months
}

export type CommitmentStatus = 'comfortable' | 'tight' | 'not-feasible'

/** How the combined monthly goal commitment compares to disposable income. */
export function commitmentStatus(totalCommitment: number, disposable: number): CommitmentStatus {
  if (disposable <= 0) return totalCommitment > 0 ? 'not-feasible' : 'comfortable'
  const ratio = totalCommitment / disposable
  if (ratio <= 0.5) return 'comfortable'
  if (ratio <= 1) return 'tight'
  return 'not-feasible'
}

/** 24-month projection of total required monthly commitment across all active goals. */
export function commitmentTimeline(goals: SavingsGoal[], from = new Date()) {
  const active = goals.filter((g) => !g.is_completed && !g.is_paused)
  const months = Array.from({ length: 24 }, (_, i) => {
    const date = new Date(from.getFullYear(), from.getMonth() + i, 1)
    const totalForMonth = active.reduce((sum, goal) => {
      const monthsLeft = monthsUntil(goal.target_date, date)
      const stillActive = monthsLeft === null || monthsLeft >= 0
      if (!stillActive) return sum
      return sum + requiredMonthlyContribution(goal, date)
    }, 0)
    return {
      month: date.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }),
      total: Math.round(totalForMonth),
    }
  })
  return months
}

/** Ranked suggestions for reducing an over-committed goal plan. */
export function shortfallSuggestions(goals: SavingsGoal[], shortfall: number) {
  return goals
    .filter((g) => !g.is_completed && !g.is_paused)
    .map((g) => ({ goal: g, monthly: requiredMonthlyContribution(g) }))
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 3)
    .map(({ goal, monthly }) => ({
      goal,
      monthly,
      suggestion:
        goal.target_date && monthly > 0
          ? `Push ${goal.name}'s target date back, or pause it, to free up roughly ${Math.round(monthly)} of your ${Math.round(shortfall)} shortfall each month.`
          : `Pausing ${goal.name} frees up its monthly contribution entirely.`,
    }))
}
