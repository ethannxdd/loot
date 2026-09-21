import { describe, expect, it } from 'vitest'
import { makeExpense, makeSnapshot } from '@/test/factories'
import { computeForecast, currentExpensesByCategory } from './forecast'

const from = new Date(2026, 8, 21)

describe('currentExpensesByCategory', () => {
  it('sums monthly equivalents per category, skipping deleted, savings and investments', () => {
    const totals = currentExpensesByCategory([
      makeExpense({ category: 'groceries', amount: 1000 }),
      makeExpense({ category: 'groceries', amount: 1200, frequency: 'annual' }),
      makeExpense({ category: 'savings', amount: 2000 }),
      makeExpense({ category: 'investments', amount: 500 }),
      makeExpense({ category: 'transport', amount: 999, deleted_at: '2026-01-01T00:00:00Z' }),
    ])
    expect(totals).toEqual({ groceries: 1100 })
  })
})

describe('computeForecast', () => {
  const live = [makeExpense({ category: 'groceries', amount: 2000 })]

  it('with no history the live figures are the forecast and confidence is low', () => {
    const f = computeForecast([], live, 20_000, from)
    expect(f.confidence).toBe('low')
    expect(f.projectedIncome).toBe(20_000)
    expect(f.projectedTotalExpenses).toBe(2000)
    expect(f.projectedDisposableIncome).toBe(18_000)
    expect(f.projectedExpensesByCategory).toEqual({ groceries: 2000 })
    expect(f.flaggedCategories).toEqual([])
  })

  it('blends the history average with today\'s figures', () => {
    const history = [
      makeSnapshot({ month: '2026-06-01', net_income: 20_000, total_expenses: 1000, expenses_by_category: { groceries: 1000 } }),
      makeSnapshot({ month: '2026-07-01', net_income: 20_000, total_expenses: 1000, expenses_by_category: { groceries: 1000 } }),
      makeSnapshot({ month: '2026-08-01', net_income: 20_000, total_expenses: 1000, expenses_by_category: { groceries: 1000 } }),
    ]
    const f = computeForecast(history, live, 22_000, from)
    expect(f.confidence).toBe('high')
    expect(f.projectedExpensesByCategory.groceries).toBe(1500)
    expect(f.projectedIncome).toBe(21_000)
    expect(f.projectedTotalExpenses).toBe(1500)
    expect(f.projectedDisposableIncome).toBe(19_500)
  })

  it('confidence steps up with 1–2 completed months of history', () => {
    const one = [makeSnapshot({ month: '2026-08-01' })]
    const two = [...one, makeSnapshot({ month: '2026-07-01' })]
    expect(computeForecast(one, live, 1, from).confidence).toBe('medium')
    expect(computeForecast(two, live, 1, from).confidence).toBe('medium')
  })

  it('ignores the current month\'s own snapshot (it would be compared with itself)', () => {
    const f = computeForecast([makeSnapshot({ month: '2026-09-01', expenses_by_category: { groceries: 2000 } })], live, 20_000, from)
    expect(f.confidence).toBe('low')
    expect(f.flaggedCategories).toEqual([])
  })

  it('only the latest three completed months count', () => {
    const snaps = ['2026-01-01', '2026-06-01', '2026-07-01', '2026-08-01'].map((month, i) =>
      makeSnapshot({ month, total_expenses: i === 0 ? 999_999 : 3000, expenses_by_category: { groceries: i === 0 ? 999_999 : 1000 } }),
    )
    const f = computeForecast(snaps, live, 20_000, from)
    expect(f.projectedExpensesByCategory.groceries).toBe(1500)
  })

  it('flags categories running 25%+ above their average, biggest first', () => {
    const history = [makeSnapshot({ month: '2026-08-01', expenses_by_category: { groceries: 1000, transport: 1000 } })]
    const expenses = [
      makeExpense({ category: 'groceries', amount: 1300 }),
      makeExpense({ category: 'transport', amount: 1600 }),
    ]
    const f = computeForecast(history, expenses, 20_000, from)
    expect(f.flaggedCategories.map((c) => c.category)).toEqual(['transport', 'groceries'])
    expect(f.flaggedCategories[0].pctAboveAverage).toBeCloseTo(60)
    const calm = computeForecast(history, [makeExpense({ category: 'groceries', amount: 1249 })], 20_000, from)
    expect(calm.flaggedCategories).toEqual([])
  })

  it('a category that stopped this month still projects from its history', () => {
    const history = [makeSnapshot({ month: '2026-08-01', expenses_by_category: { pets: 400 } })]
    const f = computeForecast(history, [], 20_000, from)
    expect(f.projectedExpensesByCategory.pets).toBe(200)
  })

  it('counts savings and investments in the total even though they have no category history', () => {
    const expenses = [makeExpense({ category: 'groceries', amount: 1000 }), makeExpense({ category: 'savings', amount: 2000 })]
    const f = computeForecast([], expenses, 10_000, from)
    expect(f.projectedTotalExpenses).toBe(3000)
    expect(f.projectedExpensesByCategory.savings).toBeUndefined()
  })
})
