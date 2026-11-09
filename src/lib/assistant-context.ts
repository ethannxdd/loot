import { categoryLabel } from './categories'
import type { Cycle } from './cycle'
import { daysUntilNextDue } from './money'
import type { SafeToSpend } from './spending'
import type { Debt, Expense, MonthlySnapshot, Profile, SavingsGoal, TaxProfile } from './types'
import { formatCurrency } from './utils'

/**
 * Builds a compact plain-text summary of the user's own numbers to ground Ask Loot. Headline figures only — never raw
 * transactions (Business Rule 13), never expense or goal notes, and never the names of other people (splits, stokvel
 * members). Exact figures for answers come from tool calls (Rule 25); this is orientation.
 */
export function buildFinancialContext(params: {
  profile: Profile | null
  expenses: Expense[]
  latestSnapshot: MonthlySnapshot | null
  debts: Debt[]
  goals: SavingsGoal[]
  taxProfile: TaxProfile | null
  /** Phase 6 — payday cycle and Safe to spend, when on. */
  cycle?: Cycle | null
  safe?: Pick<SafeToSpend, 'safe' | 'perDay' | 'daysLeft' | 'budgetsLeft' | 'entryCount'> | null
  /** Wishlist items waiting (name + price only). */
  wishlist?: { name: string; price: number }[]
  /** Renewals in the next 60 days (name + date). */
  renewals?: { name: string; renews_on: string }[]
}): string {
  const { profile, expenses, latestSnapshot, debts, goals, taxProfile, cycle, safe, wishlist = [], renewals = [] } = params
  if (!profile) return ''

  const lines: string[] = []
  lines.push(`Currency: ${profile.currency_code}. Pay frequency: ${profile.pay_frequency}.`)
  lines.push(`Gross income: ${formatCurrency(profile.gross_income)}/mo. Net income: ${formatCurrency(profile.net_income)}/mo.`)
  lines.push(`Safety buffer target: ${profile.safety_buffer_pct}% of net income.`)

  if (cycle && safe) {
    lines.push(
      `Current cycle: ${cycle.label}, ${safe.daysLeft} day(s) left. Safe to spend ${formatCurrency(safe.safe)} (${formatCurrency(safe.perDay)} a day). ${safe.entryCount} spend(s) logged this cycle.`,
    )
    const left = Object.entries(safe.budgetsLeft)
    if (left.length > 0) lines.push('Budgets left: ' + left.map(([c, v]) => `${categoryLabel(c)} ${formatCurrency(v)}`).join(', ') + '.')
  }

  if (latestSnapshot) {
    lines.push(
      `Latest month (${latestSnapshot.month}): disposable income ${formatCurrency(latestSnapshot.disposable_income)}, savings rate ${Math.round(latestSnapshot.savings_rate)}%, total expenses ${formatCurrency(latestSnapshot.total_expenses)}.`,
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
  const soon = active
    .filter((e) => e.due_day && e.frequency === 'monthly' && daysUntilNextDue(e.due_day) <= 7)
    .map((e) => `${e.name} ${formatCurrency(e.amount)}`)
  if (soon.length > 0) lines.push(`Debit orders in the next 7 days: ${soon.join(', ')}.`)

  if (debts.length > 0) {
    const totalDebt = debts.reduce((s, d) => s + d.balance, 0)
    lines.push(`Debts: ${debts.length} account(s), total balance ${formatCurrency(totalDebt)}.`)
  }

  if (goals.length > 0) {
    const activeGoals = goals.filter((g) => !g.is_completed)
    lines.push(
      `Savings goals: ${activeGoals.map((g) => `${g.name} (${formatCurrency(g.current_amount)}/${formatCurrency(g.target_amount)})`).join(', ') || 'none active'}.`,
    )
  }

  if (wishlist.length > 0) lines.push(`Wishlist (cooling off): ${wishlist.slice(0, 6).map((w) => `${w.name} ${formatCurrency(w.price)}`).join(', ')}.`)
  if (renewals.length > 0) lines.push(`Renewing soon: ${renewals.slice(0, 5).map((r) => `${r.name} on ${r.renews_on}`).join(', ')}.`)

  if (taxProfile) {
    lines.push(
      `Tax profile: ${taxProfile.employment_type}, ${taxProfile.is_provisional_taxpayer === 'yes' ? 'provisional taxpayer' : 'not a provisional taxpayer'}, age ${taxProfile.age}.`,
    )
  }

  return lines.join('\n')
}
