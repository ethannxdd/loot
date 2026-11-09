import { describe, expect, it } from 'vitest'
import { makeExpense, makeSpendEntry } from '@/test/factories'
import { cycleFor, cycleForMonth } from './cycle'
import {
  budgetsFor,
  fixedOnlyCategories,
  groupByDay,
  merchantKey,
  paceFor,
  recentMerchants,
  repeatedOverspend,
  safeToSpend,
  spendByCategory,
  UNSORTED,
} from './spending'

const settings = { payday_day: 25, payday_rule: 'previous_working_day' }
const today = new Date(2026, 9, 26, 9) // Mon 26 Oct 2026; cycle 23 Oct – 24 Nov
const cycle = cycleFor(today, settings, today)
const at = (day: number, month = 9) => new Date(2026, month, day, 12).toISOString()

const expenses = [
  makeExpense({ category: 'housing', amount: 8000, is_fixed: true, due_day: 1 }),
  makeExpense({ category: 'groceries', amount: 3000, is_fixed: false }),
  makeExpense({ category: 'groceries', amount: 100, frequency: 'weekly', is_fixed: false }),
  makeExpense({ category: 'eating_out', amount: 800, is_fixed: false }),
  makeExpense({ category: 'savings', amount: 2000, is_fixed: false }),
  makeExpense({ category: 'transport', amount: 1500, is_fixed: false, deleted_at: '2026-01-01' }),
]

describe('budgetsFor', () => {
  it('groups variable expenses by category, monthly-equivalent, skipping fixed, growth and deleted', () => {
    const b = budgetsFor(expenses)
    expect(b.map((x) => x.category)).toEqual(['groceries', 'eating_out'])
    expect(b[0].budget).toBeCloseTo(3000 + (100 * 52) / 12)
  })

  it('fixedOnlyCategories', () => {
    expect([...fixedOnlyCategories(expenses)]).toEqual(['housing'])
  })
})

describe('spendByCategory', () => {
  it('only counts the cycle and nets refunds', () => {
    const entries = [
      makeSpendEntry({ amount: 85, spent_at: at(26) }),
      makeSpendEntry({ amount: 200, spent_at: at(22) }), // previous cycle
      makeSpendEntry({ amount: -20, spent_at: at(27) }),
      makeSpendEntry({ amount: 50, category: null, spent_at: at(27) }),
      makeSpendEntry({ amount: 999, spent_at: at(27), deleted_at: '2026-10-27' }),
    ]
    expect(spendByCategory(entries, cycle)).toEqual({ groceries: 65, [UNSORTED]: 50 })
  })
})

describe('safeToSpend (Rule 19)', () => {
  const budgets = budgetsFor(expenses)
  const base = { disposable: 6000, buffer: 1000, budgets, cycle }

  it('with nothing logged it is disposable − buffer', () => {
    const r = safeToSpend({ ...base, entries: [] })
    expect(r.safe).toBe(5000)
    expect(r.planned).toBe(5000)
    expect(r.entryCount).toBe(0)
    expect(r.daysLeft).toBe(30)
    expect(r.perDay).toBeCloseTo(5000 / 30)
    expect(r.state).toBe('ok')
  })

  it('spend inside a budget does not move Safe to spend, but reduces budget left', () => {
    const r = safeToSpend({ ...base, entries: [makeSpendEntry({ amount: 85, spent_at: at(26) })] })
    expect(r.safe).toBe(5000)
    expect(r.budgetsLeft.groceries).toBeCloseTo(3000 + (100 * 52) / 12 - 85)
  })

  it('unplanned spend comes straight off', () => {
    const r = safeToSpend({
      ...base,
      entries: [
        makeSpendEntry({ amount: 650, category: 'tech_gadgets', spent_at: at(26) }),
        makeSpendEntry({ amount: 100, category: null, spent_at: at(26) }),
      ],
    })
    expect(r.unplanned).toBe(750)
    expect(r.safe).toBe(4250)
  })

  it('overspend in a budget comes off; the budget shows 0 left', () => {
    const r = safeToSpend({ ...base, entries: [makeSpendEntry({ amount: 920, category: 'eating_out', spent_at: at(26) })] })
    expect(r.over).toBe(120)
    expect(r.overByCategory).toEqual({ eating_out: 120 })
    expect(r.budgetsLeft.eating_out).toBe(0)
    expect(r.safe).toBe(4880)
  })

  it('a refund reduces spend', () => {
    const r = safeToSpend({
      ...base,
      entries: [
        makeSpendEntry({ amount: 1200, category: 'travel_holidays', spent_at: at(26) }),
        makeSpendEntry({ amount: -900, category: 'travel_holidays', spent_at: at(27) }),
      ],
    })
    expect(r.unplanned).toBe(300)
    expect(r.safe).toBe(4700)
  })

  it('over state never gives a negative daily allowance', () => {
    const r = safeToSpend({ ...base, entries: [makeSpendEntry({ amount: 5230, category: 'tech_gadgets', spent_at: at(26) })] })
    expect(r.safe).toBe(-230)
    expect(r.state).toBe('over')
    expect(r.perDay).toBe(0)
  })

  it('tight below 15% of the plan', () => {
    const r = safeToSpend({ ...base, entries: [makeSpendEntry({ amount: 4300, category: 'tech_gadgets', spent_at: at(26) })] })
    expect(r.state).toBe('tight')
  })

  it('last day of the cycle divides by 1', () => {
    const last = cycleFor(new Date(2026, 10, 24), settings, new Date(2026, 10, 24))
    const r = safeToSpend({ ...base, cycle: last, entries: [] })
    expect(r.perDay).toBe(5000)
  })
})

describe('paceFor', () => {
  it('under / ahead / over', () => {
    // Day 4 of 33
    expect(paceFor(3300, 100, cycle, today).status).toBe('under')
    expect(paceFor(3300, 600, cycle, today).status).toBe('ahead')
    expect(paceFor(3300, 3400, cycle, today).status).toBe('over')
    const p = paceFor(3300, 0, cycle, today)
    expect(p.fraction).toBeCloseTo(4 / 33)
    expect(p.expected).toBeCloseTo(400)
  })

  it('past cycles are fully elapsed', () => {
    const past = cycleForMonth(2026, 8, settings, today)
    expect(paceFor(1000, 900, past, today).fraction).toBe(1)
  })
})

describe('merchant memory', () => {
  it('merchantKey normalises', () => {
    expect(merchantKey('WOOLWORTHS 1234 Sandton*')).toBe('woolworths sandton')
    expect(merchantKey('  Pick n Pay   ')).toBe('pick n pay')
    expect(merchantKey('Café Ölé')).toBe('cafe ole')
    expect(merchantKey('1234')).toBe('')
    expect(merchantKey(null)).toBe('')
  })

  it('recentMerchants de-duplicates by key, newest first', () => {
    const list = recentMerchants([
      makeSpendEntry({ merchant: 'Woolworths', spent_at: at(20) }),
      makeSpendEntry({ merchant: 'WOOLWORTHS', spent_at: at(26) }),
      makeSpendEntry({ merchant: 'Checkers', spent_at: at(25) }),
      makeSpendEntry({ merchant: null, spent_at: at(27) }),
    ])
    expect(list).toEqual(['WOOLWORTHS', 'Checkers'])
  })
})

describe('repeatedOverspend', () => {
  it('suggests a raise when a budget was over two cycles running', () => {
    const budgets = [{ category: 'groceries', budget: 3000 }, { category: 'eating_out', budget: 800 }]
    const c1 = cycleForMonth(2026, 8, settings, today)
    const c2 = cycleForMonth(2026, 7, settings, today)
    const entries = [
      makeSpendEntry({ amount: 3210, spent_at: at(1, 9) }),
      makeSpendEntry({ amount: 3400, spent_at: at(1, 8) }),
      makeSpendEntry({ amount: 900, category: 'eating_out', spent_at: at(1, 9) }),
    ]
    expect(repeatedOverspend(entries, budgets, [c1, c2])).toEqual([{ category: 'groceries', budget: 3000, suggested: 3400 }])
  })
})

describe('groupByDay', () => {
  it('groups newest day first with totals', () => {
    const g = groupByDay([
      makeSpendEntry({ amount: 10, spent_at: at(25) }),
      makeSpendEntry({ amount: 20, spent_at: at(26) }),
      makeSpendEntry({ amount: 5, spent_at: new Date(2026, 9, 26, 18).toISOString() }),
    ])
    expect(g.map((d) => d.total)).toEqual([25, 10])
    expect(g[0].day.getDate()).toBe(26)
  })
})
