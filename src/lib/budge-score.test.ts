import { describe, expect, it } from 'vitest'
import { makeDebt, makeSnapshot } from '@/test/factories'
import { computeBudgeScore, scoreColor, scoreRecommendations } from './budge-score'

describe('computeBudgeScore', () => {
  it('a debt-free, high-saving, steady household scores near the top', () => {
    const snaps = ['2026-06-01', '2026-07-01', '2026-08-01'].map((month) => makeSnapshot({ month, savings_rate: 30, total_expenses: 15_000 }))
    const { score, factors } = computeBudgeScore(snaps[2], snaps, [])
    expect(factors.dti).toBe(999)
    expect(factors.savings_rate).toBe(999)
    expect(factors.utilisation).toBe(999)
    expect(factors.payment_consistency).toBe(999)
    expect(factors.expense_consistency).toBe(999)
    expect(score).toBe(999)
  })

  it('never leaves the 0–999 range', () => {
    const bad = makeSnapshot({ gross_income: 10_000, expenses_by_category: { debt_repayments: 9_000 }, savings_rate: 0 })
    const debts = [makeDebt({ account_type: 'credit_card', balance: 1_000_000 })]
    const { score } = computeBudgeScore(bad, [bad], debts)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThan(500)
  })

  it('DTI factor: 0 at 50% of gross, full at 0%', () => {
    const half = makeSnapshot({ gross_income: 10_000, expenses_by_category: { debt_repayments: 5_000 } })
    expect(computeBudgeScore(half, [half], []).factors.dti).toBe(0)
    const quarter = makeSnapshot({ gross_income: 10_000, expenses_by_category: { debt_repayments: 2_500 } })
    expect(computeBudgeScore(quarter, [quarter], []).factors.dti).toBeCloseTo(499.5)
  })

  it('unknown income gives a neutral DTI factor', () => {
    const s = makeSnapshot({ gross_income: 0 })
    expect(computeBudgeScore(s, [s], []).factors.dti).toBe(500)
  })

  it('payment consistency drops for each month over the 36% line', () => {
    const over = (month: string) => makeSnapshot({ month, gross_income: 10_000, expenses_by_category: { debt_repayments: 4_000 } })
    const ok = (month: string) => makeSnapshot({ month, gross_income: 10_000, expenses_by_category: { debt_repayments: 1_000 } })
    const snaps = [over('2026-06-01'), ok('2026-07-01'), ok('2026-08-01'), ok('2026-05-01')]
    expect(computeBudgeScore(snaps[2], snaps, []).factors.payment_consistency).toBeCloseTo(999 * 0.75)
  })

  it('utilisation counts only credit and store cards against an assumed limit of 3× net income', () => {
    const s = makeSnapshot({ net_income: 10_000 })
    const debts = [
      makeDebt({ account_type: 'credit_card', balance: 15_000 }),
      makeDebt({ account_type: 'home_loan', balance: 2_000_000 }),
    ]
    expect(computeBudgeScore(s, [s], debts).factors.utilisation).toBeCloseTo(999 * 0.5)
  })

  it('expense consistency is neutral with fewer than two months, lower with volatile spending', () => {
    const s = makeSnapshot()
    expect(computeBudgeScore(s, [s], []).factors.expense_consistency).toBe(700)
    const wild = [makeSnapshot({ total_expenses: 5_000 }), makeSnapshot({ total_expenses: 25_000 })]
    expect(computeBudgeScore(wild[1], wild, []).factors.expense_consistency).toBeLessThan(200)
  })
})

describe('scoreColor', () => {
  it('bands', () => {
    expect(scoreColor(701)).toBe('green')
    expect(scoreColor(700)).toBe('amber')
    expect(scoreColor(550)).toBe('amber')
    expect(scoreColor(549)).toBe('red')
  })
})

describe('scoreRecommendations', () => {
  it('only recommends for factors below 700', () => {
    const strong = { dti: 999, payment_consistency: 999, savings_rate: 999, utilisation: 999, expense_consistency: 999 }
    expect(scoreRecommendations(strong)).toEqual([])
    const weak = { ...strong, savings_rate: 100, utilisation: 300 }
    expect(scoreRecommendations(weak).map((r) => r.factor)).toEqual(['savings_rate', 'utilisation'])
  })
})
