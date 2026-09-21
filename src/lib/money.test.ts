import { describe, expect, it } from 'vitest'
import { makeExpense } from '@/test/factories'
import {
  burnRate,
  checkAffordability,
  currentMonthKey,
  daysUntilNextDue,
  disposableIncome,
  healthLevel,
  incomeBracket,
  isDtiFlagged,
  monthLabel,
  monthlyEquivalent,
  monthlyIncomeAmount,
  nextDueDate,
  previousMonthSnapshot,
  safetyBufferAmount,
  savingsRate,
  totalMonthlyExpenses,
} from './money'

describe('expense maths (Business Rules 1–6)', () => {
  it('converts every frequency to a monthly equivalent', () => {
    expect(monthlyEquivalent({ amount: 1200, frequency: 'monthly' })).toBe(1200)
    expect(monthlyEquivalent({ amount: 100, frequency: 'weekly' })).toBeCloseTo((100 * 52) / 12)
    expect(monthlyEquivalent({ amount: 2400, frequency: 'annual' })).toBe(200)
    expect(monthlyEquivalent({ amount: 999, frequency: 'once-off' })).toBe(0)
  })

  it('totals ignore soft-deleted expenses', () => {
    const list = [
      makeExpense({ amount: 1000 }),
      makeExpense({ amount: 1200, frequency: 'annual' }),
      makeExpense({ amount: 5000, deleted_at: '2026-01-01T00:00:00Z' }),
    ]
    expect(totalMonthlyExpenses(list)).toBe(1100)
    expect(disposableIncome(10_000, list)).toBe(8900)
  })

  it('savings rate is floored at zero and safe for zero income', () => {
    expect(savingsRate(2000, 10_000)).toBe(20)
    expect(savingsRate(-500, 10_000)).toBe(0)
    expect(savingsRate(500, 0)).toBe(0)
  })

  it('burn rate', () => {
    expect(burnRate(7500, 10_000)).toBe(75)
    expect(burnRate(7500, 0)).toBe(0)
  })

  it('health levels at the thresholds', () => {
    expect(healthLevel(20)).toBe('comfortable')
    expect(healthLevel(19.99)).toBe('balanced')
    expect(healthLevel(5)).toBe('balanced')
    expect(healthLevel(4.99)).toBe('tight')
  })

  it('DTI flags strictly above 36% of gross', () => {
    expect(isDtiFlagged(3600, 10_000)).toBe(false)
    expect(isDtiFlagged(3601, 10_000)).toBe(true)
    expect(isDtiFlagged(1000, 0)).toBe(false)
  })

  it('safety buffer is a percentage of net income', () => {
    expect(safetyBufferAmount(20_000, 10)).toBe(2000)
  })
})

describe('checkAffordability', () => {
  const base = { itemName: 'Gym', disposableIncome: 3000, safetyBuffer: 1000 }

  it('recurring: comfortable / tight / not-recommended', () => {
    expect(checkAffordability({ ...base, amount: 2000, isRecurring: true }).verdict).toBe('comfortable')
    expect(checkAffordability({ ...base, amount: 2500, isRecurring: true }).verdict).toBe('tight')
    expect(checkAffordability({ ...base, amount: 3001, isRecurring: true }).verdict).toBe('not-recommended')
  })

  it('once-off with savings compares against the emergency fund target', () => {
    const p = { ...base, isRecurring: false, savingsBalance: 10_000, emergencyFundTarget: 6000 }
    expect(checkAffordability({ ...p, amount: 4000 }).verdict).toBe('comfortable')
    expect(checkAffordability({ ...p, amount: 5000 }).verdict).toBe('tight')
    expect(checkAffordability({ ...p, amount: 10_001 }).verdict).toBe('not-recommended')
  })

  it('once-off with no savings on file falls back to cash flow', () => {
    const p = { ...base, isRecurring: false }
    expect(checkAffordability({ ...p, amount: 2000 }).verdict).toBe('comfortable')
    expect(checkAffordability({ ...p, amount: 2500 }).verdict).toBe('tight')
    expect(checkAffordability({ ...p, amount: 3500 }).verdict).toBe('not-recommended')
  })
})

describe('due dates', () => {
  it('this month if not yet passed, otherwise next month', () => {
    expect(nextDueDate(25, new Date(2026, 8, 21))).toEqual(new Date(2026, 8, 25))
    expect(nextDueDate(21, new Date(2026, 8, 21, 15, 30))).toEqual(new Date(2026, 8, 21))
    expect(nextDueDate(5, new Date(2026, 8, 21))).toEqual(new Date(2026, 9, 5))
  })

  it('rolls over the year end', () => {
    expect(nextDueDate(5, new Date(2026, 11, 21))).toEqual(new Date(2027, 0, 5))
  })

  it('a day 31 due date lands on the last day of short months', () => {
    expect(nextDueDate(31, new Date(2026, 1, 10))).toEqual(new Date(2026, 1, 28))
    expect(nextDueDate(31, new Date(2028, 1, 10))).toEqual(new Date(2028, 1, 29))
    expect(nextDueDate(31, new Date(2026, 3, 10))).toEqual(new Date(2026, 3, 30))
    // past Feb 28 → next is 31 March
    expect(nextDueDate(31, new Date(2026, 2, 1))).toEqual(new Date(2026, 2, 31))
    expect(nextDueDate(30, new Date(2026, 1, 28, 12))).toEqual(new Date(2026, 1, 28))
  })

  it('counts whole days, 0 = today', () => {
    expect(daysUntilNextDue(21, new Date(2026, 8, 21, 23, 59))).toBe(0)
    expect(daysUntilNextDue(25, new Date(2026, 8, 21))).toBe(4)
    // across the DST-free ZA zone and a month boundary
    expect(daysUntilNextDue(1, new Date(2026, 8, 21))).toBe(10)
  })
})

describe('month keys and snapshots', () => {
  it('currentMonthKey and monthLabel', () => {
    expect(currentMonthKey(new Date(2026, 8, 30))).toBe('2026-09-01')
    expect(monthLabel('2026-09-01')).toMatch(/2026/)
  })

  it('previousMonthSnapshot picks the latest earlier month, whether or not the current month is listed', () => {
    const snaps = [{ month: '2026-07-01' }, { month: '2026-08-01' }, { month: '2026-09-01' }]
    const from = new Date(2026, 8, 21)
    expect(previousMonthSnapshot(snaps, from)?.month).toBe('2026-08-01')
    expect(previousMonthSnapshot(snaps.slice(0, 2), from)?.month).toBe('2026-08-01')
    expect(previousMonthSnapshot([{ month: '2026-09-01' }], from)).toBeNull()
    expect(previousMonthSnapshot([], from)).toBeNull()
  })
})

describe('income', () => {
  it('income brackets', () => {
    expect(incomeBracket(9_999)).toBe('under_10k')
    expect(incomeBracket(10_000)).toBe('10k_20k')
    expect(incomeBracket(34_999)).toBe('20k_35k')
    expect(incomeBracket(59_999)).toBe('35k_60k')
    expect(incomeBracket(60_000)).toBe('60k_plus')
  })

  it('monthly equivalents of pay frequencies', () => {
    expect(monthlyIncomeAmount(12_000, 'yearly')).toBe(1000)
    expect(monthlyIncomeAmount(1000, 'weekly')).toBeCloseTo((1000 * 52) / 12)
    expect(monthlyIncomeAmount(1000, 'biweekly')).toBeCloseTo((1000 * 26) / 12)
    expect(monthlyIncomeAmount(1000, 'monthly')).toBe(1000)
  })
})
