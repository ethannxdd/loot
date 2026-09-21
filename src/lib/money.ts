import type { AffordabilityVerdict, Expense } from './types'

/** Converts any expense frequency to its monthly-equivalent amount. */
export function monthlyEquivalent(expense: Pick<Expense, 'amount' | 'frequency'>): number {
  switch (expense.frequency) {
    case 'weekly':
      return (expense.amount * 52) / 12
    case 'annual':
      return expense.amount / 12
    case 'once-off':
      return 0
    case 'monthly':
    default:
      return expense.amount
  }
}

/** Total monthly-equivalent spend across active (non soft-deleted) expenses. */
export function totalMonthlyExpenses(expenses: Expense[]): number {
  return expenses.filter((e) => !e.deleted_at).reduce((sum, e) => sum + monthlyEquivalent(e), 0)
}

/** Business Rule 1: disposable income = net income − all monthly-equivalent expenses. */
export function disposableIncome(netIncome: number, expenses: Expense[]): number {
  return netIncome - totalMonthlyExpenses(expenses)
}

/** Business Rule 2: savings rate = disposable ÷ net income × 100, floored at 0. */
export function savingsRate(disposable: number, netIncome: number): number {
  if (netIncome <= 0) return 0
  return Math.max(0, (disposable / netIncome) * 100)
}

/** Business Rule 3: burn rate = total expenses ÷ net income × 100. */
export function burnRate(totalExpenses: number, netIncome: number): number {
  if (netIncome <= 0) return 0
  return (totalExpenses / netIncome) * 100
}

export type HealthLevel = 'comfortable' | 'balanced' | 'tight'

/** Business Rule 4: health level from savings rate. */
export function healthLevel(rate: number): HealthLevel {
  if (rate >= 20) return 'comfortable'
  if (rate >= 5) return 'balanced'
  return 'tight'
}

/** Business Rule 5: debt-to-income flag — debt repayments > 36% of gross income. */
export function isDtiFlagged(debtRepaymentsMonthly: number, grossIncome: number): boolean {
  if (grossIncome <= 0) return false
  return debtRepaymentsMonthly / grossIncome > 0.36
}

/** Business Rule 6: the minimum disposable income Loot always keeps aside. */
export function safetyBufferAmount(netIncome: number, safetyBufferPct: number): number {
  return netIncome * (safetyBufferPct / 100)
}

export interface AffordabilityResult {
  verdict: AffordabilityVerdict
  reasoning: string
}

/**
 * Business Rules 7 & 8 — affordability verdicts.
 * Recurring: checks the safety buffer would still hold after adding this monthly cost.
 * Once-off: weighs it against a savings balance vs the emergency fund target.
 */
export function checkAffordability(params: {
  itemName: string
  amount: number
  isRecurring: boolean
  disposableIncome: number
  safetyBuffer: number
  savingsBalance?: number
  emergencyFundTarget?: number
}): AffordabilityResult {
  const { itemName, amount, isRecurring, disposableIncome: disposable, safetyBuffer } = params

  if (isRecurring) {
    const remaining = disposable - amount
    if (remaining >= safetyBuffer) {
      return {
        verdict: 'comfortable',
        reasoning: `Adding ${itemName} as a monthly cost leaves you with ${formatZAR(remaining)} disposable — still above your ${formatZAR(safetyBuffer)} safety buffer.`,
      }
    }
    if (remaining >= 0) {
      return {
        verdict: 'tight',
        reasoning: `Adding ${itemName} would leave you ${formatZAR(safetyBuffer - remaining)} below your safety buffer each month. Doable, but it eats into your cushion.`,
      }
    }
    return {
      verdict: 'not-recommended',
      reasoning: `Adding ${itemName} would push you ${formatZAR(Math.abs(remaining))} into the red every month — more than your current disposable income covers.`,
    }
  }

  const savingsBalance = params.savingsBalance ?? 0
  const emergencyFundTarget = params.emergencyFundTarget ?? 0
  const remainingSavings = savingsBalance - amount

  if (savingsBalance === 0 && emergencyFundTarget === 0) {
    // No savings data recorded yet — fall back to a disposable-income read.
    if (amount <= disposable) {
      return {
        verdict: 'comfortable',
        reasoning: `${itemName} costs less than one month's disposable income (${formatZAR(disposable)}). No savings balance on file yet, so this check is based on cash flow alone.`,
      }
    }
    return {
      verdict: 'tight',
      reasoning: `${itemName} costs more than a month's disposable income (${formatZAR(disposable)}). No savings balance on file yet — add one in Settings for a sharper once-off check.`,
    }
  }

  if (remainingSavings >= emergencyFundTarget) {
    return {
      verdict: 'comfortable',
      reasoning: `After spending on ${itemName}, you'd still have ${formatZAR(remainingSavings)} in savings — at or above your ${formatZAR(emergencyFundTarget)} emergency fund target.`,
    }
  }
  if (remainingSavings >= 0) {
    return {
      verdict: 'tight',
      reasoning: `${itemName} would leave your savings ${formatZAR(emergencyFundTarget - remainingSavings)} below your emergency fund target.`,
    }
  }
  return {
    verdict: 'not-recommended',
    reasoning: `${itemName} costs more than you currently have in savings (${formatZAR(savingsBalance)}).`,
  }
}

function formatZAR(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Current month key in 'YYYY-MM-01' form, matching monthly_snapshots.month. */
export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

export const INCOME_BRACKETS = ['under_10k', '10k_20k', '20k_35k', '35k_60k', '60k_plus'] as const
export type IncomeBracket = (typeof INCOME_BRACKETS)[number]

export const INCOME_BRACKET_LABELS: Record<IncomeBracket, string> = {
  under_10k: 'Under R10k',
  '10k_20k': 'R10k–R20k',
  '20k_35k': 'R20k–R35k',
  '35k_60k': 'R35k–R60k',
  '60k_plus': 'R60k+',
}

/** Which income bracket a gross monthly income falls into — see LOOT-FEATURES.md Stats > Benchmarks. */
export function incomeBracket(grossMonthlyIncome: number): IncomeBracket {
  if (grossMonthlyIncome < 10000) return 'under_10k'
  if (grossMonthlyIncome < 20000) return '10k_20k'
  if (grossMonthlyIncome < 35000) return '20k_35k'
  if (grossMonthlyIncome < 60000) return '35k_60k'
  return '60k_plus'
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString('en-ZA', {
    month: 'short',
    year: 'numeric',
  })
}
