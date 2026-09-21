import { categoryLabel } from './categories'
import type { Debt, Expense, MonthlySnapshot, Profile, SavingsGoal, TaxProfile } from './types'
import { formatCurrency } from './utils'

/**
 * Builds a compact plain-text summary of the user's own numbers to ground Loot Assistant's
 * replies. Deliberately category totals and headline figures only — never raw transaction
 * data — consistent with Business Rule 13's client-side-only handling of bank statement detail.
 */
export function buildFinancialContext(params: {
  profile: Profile | null
  expenses: Expense[]
  latestSnapshot: MonthlySnapshot | null
  debts: Debt[]
  goals: SavingsGoal[]
  taxProfile: TaxProfile | null
}): string {
  const { profile, expenses, latestSnapshot, debts, goals, taxProfile } = params
  if (!profile) return ''

  const lines: string[] = []
  lines.push(`Currency: ${profile.currency_code}. Pay frequency: ${profile.pay_frequency}.`)
  lines.push(`Gross income: ${formatCurrency(profile.gross_income)}/mo. Net income: ${formatCurrency(profile.net_income)}/mo.`)
  lines.push(`Safety buffer target: ${profile.safety_buffer_pct}% of net income.`)

  if (latestSnapshot) {
    lines.push(
      `Latest month (${latestSnapshot.month}): disposable income ${formatCurrency(latestSnapshot.disposable_income)}, savings rate ${Math.round(latestSnapshot.savings_rate)}%, total expenses ${formatCurrency(latestSnapshot.total_expenses)}.`
    )
    const topCategories = Object.entries(latestSnapshot.expenses_by_category)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
    if (topCategories.length > 0) {
      lines.push('Top expense categories: ' + topCategories.map(([c, a]) => `${categoryLabel(c)} ${formatCurrency(a)}`).join(', ') + '.')
    }
  }

  const active = expenses.filter((e) => !e.deleted_at)
  lines.push(`Tracked recurring expenses: ${active.length} (${active.filter((e) => e.is_fixed).length} fixed, ${active.filter((e) => !e.is_fixed).length} variable).`)

  if (debts.length > 0) {
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
    lines.push(`Debts: ${debts.length} account(s), total balance ${formatCurrency(totalDebt)}.`)
  }

  if (goals.length > 0) {
    const activeGoals = goals.filter((g) => !g.is_completed)
    lines.push(
      `Savings goals: ${activeGoals.map((g) => `${g.name} (${formatCurrency(g.current_amount)}/${formatCurrency(g.target_amount)})`).join(', ') || 'none active'}.`
    )
  }

  if (taxProfile) {
    lines.push(
      `Tax profile: ${taxProfile.employment_type}, ${taxProfile.is_provisional_taxpayer === 'yes' ? 'provisional taxpayer' : 'not a provisional taxpayer'}, age ${taxProfile.age}.`
    )
  }

  return lines.join('\n')
}
