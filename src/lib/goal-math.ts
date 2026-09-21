import { currentMonthKey } from './money'
import type { SavingsGoal } from './types'
import { formatCurrency } from './utils'

/**
 * Parses a 'YYYY-MM-DD' (or full ISO) date as a LOCAL calendar date. `new Date('2026-10-01')` is UTC midnight,
 * which lands on the previous day west of Greenwich and skews month maths.
 */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

/** Signed whole calendar months from `from`'s month to `target`'s month (negative if the target is in the past). */
export function monthDiff(target: Date, from: Date): number {
  return (target.getFullYear() - from.getFullYear()) * 12 + (target.getMonth() - from.getMonth())
}

/** Whole months between now and a target date (0 if past/this month, null if no date set). */
export function monthsUntil(targetDate: string | null, from = new Date()): number | null {
  if (!targetDate) return null
  return Math.max(0, monthDiff(parseDateOnly(targetDate), from))
}

/** Short deadline wording for cards: "No deadline", "Overdue", "Due this month", "5 months left". */
export function deadlineLabel(targetDate: string | null, from = new Date()): string {
  if (!targetDate) return 'No deadline'
  const diff = monthDiff(parseDateOnly(targetDate), from)
  if (diff < 0) return 'Overdue'
  if (diff === 0) return 'Due this month'
  return `${diff} month${diff === 1 ? '' : 's'} left`
}

export function remainingAmount(goal: Pick<SavingsGoal, 'target_amount' | 'current_amount'>): number {
  return Math.max(0, goal.target_amount - goal.current_amount)
}

/** How much this goal needs per month to hit its target by its target date. */
export function requiredMonthlyContribution(goal: SavingsGoal, from = new Date()): number {
  if (goal.is_completed || goal.is_paused) return 0
  const remaining = remainingAmount(goal)
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

/** Goals that still need money: not completed, and not already fully funded. */
export function isActiveGoal(goal: SavingsGoal): boolean {
  return !goal.is_completed && remainingAmount(goal) > 0
}

/**
 * Months from `from` until a paused goal starts contributing again: 0 if it isn't paused, Infinity if it is
 * paused with no resume date (so it never contributes in the projection).
 */
function resumeOffset(goal: SavingsGoal, from: Date): number {
  if (!goal.is_paused) return 0
  if (!goal.resume_date) return Infinity
  return Math.max(0, monthDiff(parseDateOnly(goal.resume_date), from))
}

export interface TimelineMonth {
  month: string
  total: number
  /** Names of goals whose final contribution lands in this month. */
  completing: string[]
}

/**
 * 24-month projection of the total monthly commitment across all goals. Each dated goal contributes
 * `remaining ÷ months-to-target` every month until its target month and then drops out — so the bars step
 * down as goals finish. A goal due this month (or overdue) is a single lump in the first month. Paused goals
 * with a resume date start contributing again from that month; undated goals need nothing.
 */
export function commitmentTimeline(goals: SavingsGoal[], from = new Date(), months = 24): TimelineMonth[] {
  const active = goals.filter(isActiveGoal)
  return Array.from({ length: months }, (_, i) => {
    const date = new Date(from.getFullYear(), from.getMonth() + i, 1)
    let total = 0
    const completing: string[] = []
    for (const goal of active) {
      const toTarget = monthsUntil(goal.target_date, from)
      if (toTarget === null) continue
      const start = resumeOffset(goal, from)
      if (!Number.isFinite(start)) continue
      // Number of monthly instalments from the moment it (re)starts: at least 1.
      const span = Math.max(1, toTarget - start)
      const end = start + span
      if (i >= start && i < end) total += remainingAmount(goal) / span
      if (i === end - 1) completing.push(goal.name)
    }
    return {
      month: date.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }),
      total: Math.round(total),
      completing,
    }
  })
}

/** Ranked suggestions for reducing an over-committed goal plan. */
export function shortfallSuggestions(goals: SavingsGoal[], shortfall: number, from = new Date()) {
  return goals
    .filter((g) => !g.is_completed && !g.is_paused)
    .map((g) => ({ goal: g, monthly: requiredMonthlyContribution(g, from) }))
    .filter((x) => x.monthly > 0)
    .sort((a, b) => b.monthly - a.monthly)
    .slice(0, 3)
    .map(({ goal, monthly }) => ({
      goal,
      monthly,
      suggestion: goal.target_date
        ? `Push ${goal.name}'s target date back, or pause it, to free up roughly ${formatCurrency(monthly)} of your ${formatCurrency(shortfall)} shortfall each month.`
        : `Pausing ${goal.name} frees up its monthly contribution entirely.`,
    }))
}

/** Goals ordered by soonest deadline (undated last, completed at the very end) — Loot's suggested priority order. */
export function suggestedOrder(goals: SavingsGoal[]): SavingsGoal[] {
  const rank = (g: SavingsGoal) => (g.is_completed ? 2 : g.target_date ? 0 : 1)
  return [...goals].sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank !== 0) return byRank
    if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date)
    return a.sort_order - b.sort_order
  })
}

/** Completed goals sink to the bottom; everything else keeps the user's own order. */
export function displayOrder(goals: SavingsGoal[]): SavingsGoal[] {
  return [...goals].sort((a, b) => Number(a.is_completed) - Number(b.is_completed) || a.sort_order - b.sort_order)
}

/** True when a paused goal's resume date has arrived. */
export function shouldAutoResume(goal: SavingsGoal, today = new Date()): boolean {
  if (!goal.is_paused || !goal.resume_date) return false
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return parseDateOnly(goal.resume_date).getTime() <= t.getTime()
}

/** `is_completed` / `completed_at` for a goal after its amounts change. */
export function completionPatch(
  goal: Pick<SavingsGoal, 'is_completed' | 'completed_at'>,
  currentAmount: number,
  targetAmount: number,
  now = new Date(),
): { is_completed: boolean; completed_at: string | null } {
  const done = targetAmount > 0 && currentAmount >= targetAmount
  if (!done) return { is_completed: false, completed_at: null }
  // Already complete — keep the original completion time rather than restamping it on every contribution.
  return { is_completed: true, completed_at: goal.is_completed && goal.completed_at ? goal.completed_at : now.toISOString() }
}

// ---------------------------------------------------------------------------
// Auto-progress: sharing the month's spare loot between goals set to "auto"
// ---------------------------------------------------------------------------

export type AllocationMode = 'weighted' | 'sequential'
export type AutoTiming = 'on_demand' | 'monthly_1st' | 'estimate_only'

/** The database defaults ('manual' / 'start') pre-date these options; anything unrecognised means "weighted". */
export function normalizeAllocationMode(value: string | null | undefined): AllocationMode {
  return value === 'sequential' ? 'sequential' : 'weighted'
}

/** Anything unrecognised means "on demand": suggest an amount, let the user press Apply. */
export function normalizeAutoTiming(value: string | null | undefined): AutoTiming {
  return value === 'monthly_1st' || value === 'estimate_only' ? value : 'on_demand'
}

/**
 * How much of `pool` (this month's spare loot) each auto goal would receive.
 * - weighted: split by each goal's `weight`; a goal never receives more than it still needs, and any
 *   overflow is redistributed to the goals that aren't full yet.
 * - sequential: fill goals in list order (`sort_order`), spilling into the next once one is full.
 */
export function computeAutoAllocations(goals: SavingsGoal[], pool: number, mode: AllocationMode): Record<string, number> {
  const auto = goals
    .filter((g) => g.progress_mode === 'auto' && !g.is_paused && isActiveGoal(g))
    .sort((a, b) => a.sort_order - b.sort_order)
  const out: Record<string, number> = {}
  for (const g of auto) out[g.id] = 0
  if (auto.length === 0 || !(pool > 0)) return out

  if (mode === 'sequential') {
    let left = pool
    for (const g of auto) {
      const give = Math.min(remainingAmount(g), left)
      out[g.id] = give
      left -= give
      if (left <= 0) break
    }
    return out
  }

  // weighted, with overflow redistribution
  let left = pool
  let open = auto.filter((g) => remainingAmount(g) > 0)
  for (let guard = 0; guard < 50 && left > 0.005 && open.length > 0; guard++) {
    const totalWeight = open.reduce((s, g) => s + Math.max(0, g.weight), 0)
    // If every open goal has zero weight, fall back to an equal split rather than allocating nothing.
    const shareOf = (g: SavingsGoal) => (totalWeight > 0 ? Math.max(0, g.weight) / totalWeight : 1 / open.length)
    let distributed = 0
    for (const g of open) {
      const room = remainingAmount(g) - out[g.id]
      const give = Math.min(left * shareOf(g), room)
      out[g.id] += give
      distributed += give
    }
    left -= distributed
    open = open.filter((g) => remainingAmount(g) - out[g.id] > 0.005)
    if (distributed < 0.005) break
  }
  return out
}

/** The 'YYYY-MM-01' key stored in `last_auto_period` once a month's share has been applied. */
export function currentPeriodKey(date = new Date()): string {
  return currentMonthKey(date)
}
