import { describe, expect, it } from 'vitest'
import { buildIdentity, stability, trendSlope, type IdentitySnapshot } from './identity'

const snap = (month: string, over: Partial<IdentitySnapshot> = {}): IdentitySnapshot => ({
  month,
  net_income: 20_000,
  total_expenses: 15_000,
  disposable_income: 5_000,
  savings_rate: 25,
  ...over,
})

describe('stability', () => {
  it('1 for identical or single values, lower as spread grows, never below 0', () => {
    expect(stability([100])).toBe(1)
    expect(stability([100, 100, 100])).toBe(1)
    expect(stability([100, 150])).toBeGreaterThan(0.5)
    expect(stability([10, 1000])).toBe(0)
    expect(stability([0, 0])).toBe(1)
  })
})

describe('trendSlope', () => {
  it('needs three points', () => {
    expect(trendSlope([1, 2])).toBe(0)
  })
  it('positive when rising, negative when falling, ~0 when flat', () => {
    expect(trendSlope([100, 110, 120, 130])).toBeGreaterThan(0.03)
    expect(trendSlope([130, 120, 110, 100])).toBeLessThan(-0.03)
    expect(trendSlope([100, 100, 100])).toBe(0)
    expect(trendSlope([0, 0, 0])).toBe(0)
  })
})

describe('buildIdentity', () => {
  it('returns null with no meaningful data', () => {
    expect(buildIdentity([], 0)).toBeNull()
    expect(buildIdentity([snap('2026-08-01', { net_income: 0, total_expenses: 0 })], 0)).toBeNull()
  })

  it('one month is "too early to tell" for pattern and trajectory', () => {
    const id = buildIdentity([snap('2026-08-01')], 0)!
    expect(id.months).toBe(1)
    expect(id.dimensions.find((d) => d.label === 'Spending pattern')!.value).toBe('Too early to tell')
    expect(id.dimensions.find((d) => d.label === 'Financial trajectory')!.value).toBe('Too early to tell')
    expect(id.summary).toContain('last 1 month,')
  })

  it('describes a steady, strong-saving, debt-free improving household', () => {
    const snaps = [
      snap('2026-05-01', { disposable_income: 4_000 }),
      snap('2026-06-01', { disposable_income: 5_000 }),
      snap('2026-07-01', { disposable_income: 6_000 }),
      snap('2026-08-01', { disposable_income: 7_000 }),
    ]
    const id = buildIdentity(snaps, 0)!
    const by = Object.fromEntries(id.dimensions.map((d) => [d.label, d.value]))
    expect(by['Spending pattern']).toBe('Consistent')
    expect(by['Savings behaviour']).toBe('Strong saver')
    expect(by['Debt position']).toBe('Debt-free')
    expect(by['Financial trajectory']).toBe('Improving')
  })

  it('uses only the six most recent months regardless of input order', () => {
    const months = ['2026-08-01', '2026-01-01', '2026-02-01', '2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01']
    expect(buildIdentity(months.map((m) => snap(m)), 0)!.months).toBe(6)
  })

  it('debt bands and low savings', () => {
    const one = [snap('2026-08-01', { savings_rate: 2 })]
    expect(buildIdentity(one, 20)!.dimensions.find((d) => d.label === 'Debt position')!.value).toBe('Managed')
    expect(buildIdentity(one, 40)!.dimensions.find((d) => d.label === 'Debt position')!.value).toBe('High load')
    expect(buildIdentity(one, 0)!.dimensions.find((d) => d.label === 'Savings behaviour')!.value).toBe('Needs attention')
  })
})
