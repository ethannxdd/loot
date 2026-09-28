import { EXPENSE_CATEGORIES } from './categories'
import { itemFrequency } from './planner-math'
import type { Expense, NewExpense, PlannerPhase } from './types'

/** Categories that are normally fixed commitments — everything else lands in Variable. */
const FIXED_CATEGORIES = new Set([
  'housing',
  'vehicle_finance',
  'insurance',
  'medical_aid',
  'debt_repayments',
  'subscriptions',
  'phone_airtime',
  'education',
  'childcare',
])

const key = (name: string, amount: number, frequency: string) =>
  `${name.trim().toLowerCase()}|${Math.round(amount * 100)}|${frequency}`

/**
 * Turns a plan phase into expenses to add. Items already in the user's active expenses (same name, amount and
 * frequency) are skipped, so applying a phase twice doesn't create duplicates.
 */
export function phaseToExpenses(phase: PlannerPhase, existing: Expense[]): { toAdd: NewExpense[]; skipped: number } {
  const have = new Set(existing.filter((e) => !e.deleted_at).map((e) => key(e.name, e.amount, e.frequency)))
  const toAdd: NewExpense[] = []
  let skipped = 0
  for (const item of phase.expenses) {
    const amount = Number(item.amount) || 0
    const name = item.name.trim()
    if (!name || amount <= 0) continue
    const frequency = itemFrequency(item)
    const k = key(name, amount, frequency)
    if (have.has(k)) {
      skipped += 1
      continue
    }
    have.add(k)
    const category = item.category && (EXPENSE_CATEGORIES as readonly string[]).includes(item.category) ? item.category : 'other'
    toAdd.push({ name, amount, frequency, category, is_fixed: FIXED_CATEGORIES.has(category) })
  }
  return { toAdd, skipped }
}
