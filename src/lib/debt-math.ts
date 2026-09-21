import type { Debt } from './types'

export type DebtStrategy = 'avalanche' | 'snowball'

export interface DebtPayoffEntry {
  debtId: string
  /** Month number (from today) the balance reaches zero; only meaningful when `paidOff` is true. */
  payoffMonth: number
  payoffDate: string // ISO date (local calendar)
  totalInterest: number
  /** False when the payments never clear this debt within the 50-year simulation cap. */
  paidOff: boolean
}

export interface DebtPayoffResult {
  strategy: DebtStrategy
  order: string[] // debt ids, priority order
  perDebt: Record<string, DebtPayoffEntry>
  totalMonths: number
  totalInterest: number
  /** True when at least one debt is never cleared at the current payments (interest outruns the payment). */
  neverPaidOff: boolean
  /** Combined outstanding balance across all debts, month by month (month 0 = today). */
  schedule: { month: number; totalBalance: number }[]
}

const MAX_MONTHS = 600 // 50 years — simulation safety cap

/** Local calendar date `months` from `date`, clamping the day so 31 Jan + 1 month is 28/29 Feb (not 3 Mar). */
function addMonths(date: Date, months: number) {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1)
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`
}

/**
 * Simulates a debt payoff strategy month by month.
 * Avalanche: highest interest rate first. Snowball: smallest balance first.
 * Freed-up minimum payments from paid-off debts roll into the shared "extra"
 * budget for the next-priority debt (the standard snowball/avalanche effect).
 */
export function simulatePayoff(
  debts: Debt[],
  extraPayment: number,
  strategy: DebtStrategy,
  from = new Date()
): DebtPayoffResult {
  if (debts.length === 0) {
    return { strategy, order: [], perDebt: {}, totalMonths: 0, totalInterest: 0, neverPaidOff: false, schedule: [] }
  }

  const order =
    strategy === 'avalanche'
      ? [...debts].sort((a, b) => b.interest_rate - a.interest_rate)
      : [...debts].sort((a, b) => a.balance - b.balance)

  const balances = new Map(order.map((d) => [d.id, d.balance]))
  const totalInterestByDebt = new Map(order.map((d) => [d.id, 0]))
  const payoffMonth = new Map<string, number>()
  const totalBudget = order.reduce((sum, d) => sum + d.min_payment, 0) + Math.max(0, extraPayment)

  const schedule: { month: number; totalBalance: number }[] = [
    { month: 0, totalBalance: order.reduce((s, d) => s + d.balance, 0) },
  ]

  // A debt entered with a zero balance is already paid off.
  for (const d of order) if ((balances.get(d.id) ?? 0) <= 0.01) payoffMonth.set(d.id, 0)

  let month = 0
  while (order.some((d) => (balances.get(d.id) ?? 0) > 0.01) && month < MAX_MONTHS) {
    month++

    for (const d of order) {
      const bal = balances.get(d.id) ?? 0
      if (bal <= 0) continue
      const interest = bal * (d.interest_rate / 100 / 12)
      balances.set(d.id, bal + interest)
      totalInterestByDebt.set(d.id, (totalInterestByDebt.get(d.id) ?? 0) + interest)
    }

    let budgetLeft = totalBudget
    for (const d of order) {
      const bal = balances.get(d.id) ?? 0
      if (bal <= 0) continue
      const pay = Math.min(d.min_payment, bal)
      balances.set(d.id, bal - pay)
      budgetLeft -= pay
    }
    for (const d of order) {
      if (budgetLeft <= 0.001) break
      const bal = balances.get(d.id) ?? 0
      if (bal <= 0) continue
      const pay = Math.min(budgetLeft, bal)
      balances.set(d.id, bal - pay)
      budgetLeft -= pay
    }

    for (const d of order) {
      if (!payoffMonth.has(d.id) && (balances.get(d.id) ?? 0) <= 0.01) {
        payoffMonth.set(d.id, month)
      }
    }

    schedule.push({
      month,
      totalBalance: order.reduce((s, d) => s + Math.max(0, balances.get(d.id) ?? 0), 0),
    })
  }

  const perDebt: Record<string, DebtPayoffEntry> = {}
  let neverPaidOff = false
  for (const d of order) {
    const m = payoffMonth.get(d.id)
    const paidOff = m !== undefined
    if (!paidOff) neverPaidOff = true
    perDebt[d.id] = {
      debtId: d.id,
      payoffMonth: m ?? month,
      payoffDate: addMonths(from, m ?? month),
      totalInterest: totalInterestByDebt.get(d.id) ?? 0,
      paidOff,
    }
  }

  return {
    strategy,
    order: order.map((d) => d.id),
    perDebt,
    totalMonths: month,
    neverPaidOff,
    totalInterest: [...totalInterestByDebt.values()].reduce((a, b) => a + b, 0),
    schedule,
  }
}

export function totalMinPayments(debts: Debt[]) {
  return debts.reduce((sum, d) => sum + d.min_payment, 0)
}

export function totalDebtBalance(debts: Debt[]) {
  return debts.reduce((sum, d) => sum + d.balance, 0)
}
