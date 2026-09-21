import { GROWTH_CATEGORIES } from './categories'
import { currentMonthKey, disposableIncome, monthlyEquivalent, savingsRate } from './money'
import { supabase } from './supabase'
import type { Expense, Profile } from './types'

/**
 * Business Rule 9: snapshot auto-update. Recomputes the current month's
 * monthly_snapshots row from live profile + expenses data whenever either
 * changes. Never touches a locked (monthly-close) snapshot.
 */
export async function upsertCurrentMonthSnapshot(profile: Profile, expenses: Expense[]) {
  const month = currentMonthKey()

  const { data: existing, error: existingError } = await supabase
    .from('monthly_snapshots')
    .select('id, locked_at')
    .eq('user_id', profile.id)
    .eq('month', month)
    .maybeSingle()
  if (existingError) throw existingError

  if (existing?.locked_at) return // locked snapshots are frozen at month-close

  const active = expenses.filter((e) => !e.deleted_at)
  const totalExpenses = active.reduce((sum, e) => sum + monthlyEquivalent(e), 0)
  const disposable = disposableIncome(profile.net_income, expenses)

  const expensesByCategory: Record<string, number> = {}
  for (const e of active) {
    if (GROWTH_CATEGORIES.has(e.category as never)) continue
    expensesByCategory[e.category] = (expensesByCategory[e.category] ?? 0) + monthlyEquivalent(e)
  }

  const { error } = await supabase.from('monthly_snapshots').upsert(
    {
      user_id: profile.id,
      month,
      currency_code: profile.currency_code,
      gross_income: profile.gross_income,
      net_income: profile.net_income,
      total_expenses: totalExpenses,
      disposable_income: disposable,
      savings_rate: savingsRate(disposable, profile.net_income),
      expenses_by_category: expensesByCategory,
    },
    { onConflict: 'user_id,month' },
  )
  if (error) throw error
}
