import { beforeEach, describe, expect, it } from 'vitest'
import type { ParsedTransaction, StatementAnalysis } from '@/lib/types'
import { analyzeTransactions, detectAnomalies, detectSubscriptions, generateRecommendations } from './analyze'

beforeEach(() => {
  ;(globalThis as { localStorage?: unknown }).localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  }
})

const tx = (date: string, description: string, amount: number): ParsedTransaction => ({ date, description, amount, balance: null, category: null })

describe('analyzeTransactions', () => {
  it('rolls up income, spend, categories and unclassified', () => {
    const s = analyzeTransactions([
      tx('2026-01-02', 'SALARY', 30_000),
      tx('2026-01-03', 'CHECKERS', -1_000),
      tx('2026-01-04', 'PICK N PAY', -500),
      tx('2026-01-05', 'ZZZ UNKNOWN', -250),
    ])
    expect(s.totalIncome).toBe(30_000)
    expect(s.totalSpent).toBe(1_750)
    expect(s.netPosition).toBe(28_250)
    expect(s.categoryTotals).toEqual({ groceries: 1_500 })
    expect(s.unclassifiedAmount).toBe(250)
    expect(s.unclassified).toHaveLength(1)
  })

  it('respects categories already on a transaction (manual assignment)', () => {
    const s = analyzeTransactions([{ ...tx('2026-01-05', 'ZZZ UNKNOWN', -250), category: 'pets' }])
    expect(s.categoryTotals).toEqual({ pets: 250 })
    expect(s.unclassifiedAmount).toBe(0)
  })

  it('a credit is never treated as spending, even in a category', () => {
    const s = analyzeTransactions([tx('2026-01-05', 'CHECKERS REFUND', 200)])
    expect(s.totalSpent).toBe(0)
    expect(s.totalIncome).toBe(200)
  })

  it('finds the primary month and covers a 15th–14th statement as one month', () => {
    const s = analyzeTransactions([
      tx('2025-12-15', 'SHOP', -10),
      tx('2025-12-20', 'SHOP', -10),
      tx('2026-01-05', 'SHOP', -10),
      tx('2026-01-06', 'SHOP', -10),
      tx('2026-01-14', 'SHOP', -10),
    ])
    expect(s.months).toEqual(['2025-12', '2026-01'])
    expect(s.primaryMonth).toBe('2026-01')
    expect(s.from).toBe('2025-12-15')
    expect(s.to).toBe('2026-01-14')
    expect(s.periodMonths).toBe(1)
  })

  it('a three month statement counts as three months', () => {
    const s = analyzeTransactions([tx('2026-01-01', 'SHOP', -10), tx('2026-03-31', 'SHOP', -10)])
    expect(s.periodMonths).toBe(3)
  })

  it('an empty statement is safe', () => {
    const s = analyzeTransactions([])
    expect(s.primaryMonth).toBeNull()
    expect(s.periodMonths).toBe(1)
    expect(s.totalSpent).toBe(0)
  })
})

describe('detectAnomalies', () => {
  const prior = (over: Partial<StatementAnalysis>): StatementAnalysis =>
    ({ id: 'p', bank: 'fnb', statement_month: '2025-12', category_totals: { groceries: 1000 }, ...over }) as StatementAnalysis

  it('flags categories 25%+ above the recent average', () => {
    const out = detectAnomalies({ groceries: 1300, transport: 400 }, [prior({}), prior({ id: 'q', statement_month: '2025-11' })])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ category: 'groceries', average: 1000 })
    expect(out[0].pctAbove).toBeCloseTo(30)
  })

  it('does nothing without history or below the threshold', () => {
    expect(detectAnomalies({ groceries: 5000 }, [])).toEqual([])
    expect(detectAnomalies({ groceries: 1249 }, [prior({})])).toEqual([])
  })

  it('never compares a statement with an earlier save of the same bank and month', () => {
    const same = prior({ statement_month: '2026-01', category_totals: { groceries: 100 } })
    expect(detectAnomalies({ groceries: 5000 }, [same], { bank: 'fnb', month: '2026-01' })).toEqual([])
    // a different bank's statement for that month is still a valid comparison
    expect(detectAnomalies({ groceries: 5000 }, [same], { bank: 'capitec', month: '2026-01' })).toHaveLength(1)
  })

  it('scales a multi-month statement down to a monthly figure', () => {
    expect(detectAnomalies({ groceries: 3000 }, [prior({})], { bank: 'fnb', month: null, months: 3 })).toEqual([])
    expect(detectAnomalies({ groceries: 3000 }, [prior({})], { bank: 'fnb', month: null, months: 1 })).toHaveLength(1)
  })
})

describe('detectSubscriptions', () => {
  it('lists each subscription merchant once, using the latest charge', () => {
    const list = detectSubscriptions([
      { ...tx('2026-01-02', 'NETFLIX.COM 123', -159), category: 'subscriptions' },
      { ...tx('2026-01-20', 'NETFLIX.COM 456', -169), category: 'subscriptions' },
      { ...tx('2026-01-05', 'SPOTIFY', -60), category: 'subscriptions' },
      { ...tx('2026-01-06', 'CHECKERS', -500), category: 'groceries' },
      { ...tx('2026-01-07', 'NETFLIX REFUND', 159), category: 'subscriptions' },
    ])
    expect(list).toHaveLength(2)
    const netflix = list.find((s) => /netflix/i.test(s.serviceName))!
    expect(netflix.serviceName).toBe('Netflix.com') // tidied, not the raw statement line
    expect(netflix.amount).toBe(169)
    expect(netflix.lastCharged).toBe('2026-01-20')
  })
})

describe('generateRecommendations', () => {
  const summary = (over: Partial<ReturnType<typeof analyzeTransactions>>) => ({ ...analyzeTransactions([]), ...over })

  it('has a calm default message', () => {
    const r = generateRecommendations(summary({ totalIncome: 10_000, totalSpent: 5_000, netPosition: 5_000 }), [], [])
    expect(r).toHaveLength(1)
    expect(r[0]).toMatch(/nothing unusual/i)
  })

  it('warns about a large unclassified share, overspending and many subscriptions', () => {
    const r = generateRecommendations(
      summary({ totalIncome: 1_000, totalSpent: 2_000, netPosition: -1_000, unclassifiedAmount: 1_000 }),
      [],
      [
        { serviceName: 'a', amount: 1, lastCharged: '2026-01-01' },
        { serviceName: 'b', amount: 1, lastCharged: '2026-01-01' },
        { serviceName: 'c', amount: 1, lastCharged: '2026-01-01' },
      ],
    )
    expect(r.some((x) => /unclassified/.test(x))).toBe(true)
    expect(r.some((x) => /3 active subscriptions/.test(x))).toBe(true)
    expect(r.some((x) => /more than you received/.test(x))).toBe(true)
  })
})
