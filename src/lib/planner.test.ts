import { describe, expect, it, vi } from 'vitest'
import type { NetWorthItem, PlannerPlan } from './types'
import { computePlanTotals, METRIC_LOWER_IS_BETTER, winningPlanIds } from './plan-compare'
import { computePhase, emptyPhase, netAfterTax } from './planner-math'

// net-worth.ts talks to Supabase; the maths under test doesn't, so keep the client out of the test.
vi.mock('./supabase', () => ({ supabase: {} }))
const { computeNetWorthTotals } = await import('./net-worth')
const { formatCurrency, formatCurrencyExact, getGreeting, setActiveCurrency, getActiveCurrency } = await import('./utils')

const plan = (over: Partial<PlannerPlan> = {}): PlannerPlan => ({
  id: 'p1',
  user_id: 'u',
  name: 'Plan',
  tax_rate_pct: 20,
  phases: [],
  notes: null,
  created_at: '',
  updated_at: '',
  ...over,
})

describe('planner maths', () => {
  it('net after flat tax', () => {
    expect(netAfterTax(50_000, 20)).toBe(40_000)
    expect(netAfterTax(50_000, 0)).toBe(50_000)
  })

  it('phase leftover = net − expenses; blank amounts count as zero', () => {
    const phase = { name: 'P', gross_income: 50_000, expenses: [{ name: 'Rent', amount: 15_000 }, { name: 'Blank', amount: NaN }] }
    expect(computePhase(phase, 20)).toEqual({ netIncome: 40_000, totalExpenses: 15_000, leftover: 25_000 })
  })

  it('emptyPhase', () => {
    expect(emptyPhase()).toEqual({ name: 'Phase 1', gross_income: 0, expenses: [] })
  })
})

describe('plan comparison', () => {
  const two = plan({
    tax_rate_pct: 25,
    phases: [
      { name: 'A', gross_income: 40_000, expenses: [{ name: 'x', amount: 20_000 }] },
      { name: 'B', gross_income: 60_000, expenses: [{ name: 'x', amount: 30_000 }] },
    ],
  })

  it('totals across phases with a per-phase average', () => {
    const t = computePlanTotals(two)
    expect(t.totalGross).toBe(100_000)
    expect(t.totalNet).toBe(75_000)
    expect(t.totalExpenses).toBe(50_000)
    expect(t.totalLeftover).toBe(25_000)
    expect(t.phaseCount).toBe(2)
    expect(t.avgLeftover).toBe(12_500)
  })

  it('an empty plan is all zeros, not NaN', () => {
    const t = computePlanTotals(plan())
    expect(t.avgLeftover).toBe(0)
    expect(t.phaseCount).toBe(0)
  })

  it('winners follow the metric direction and ties all win', () => {
    const values = [
      { planId: 'a', value: 10 },
      { planId: 'b', value: 20 },
      { planId: 'c', value: 20 },
    ]
    expect([...winningPlanIds(values, false)].sort()).toEqual(['b', 'c'])
    expect([...winningPlanIds(values, true)]).toEqual(['a'])
    expect(winningPlanIds([], false).size).toBe(0)
    expect(METRIC_LOWER_IS_BETTER.totalExpenses).toBe(true)
    expect(METRIC_LOWER_IS_BETTER.avgLeftover).toBe(false)
  })
})

describe('net worth totals', () => {
  const item = (kind: 'asset' | 'liability', value: number, depreciation_pct = 0) => ({ kind, value, depreciation_pct }) as NetWorthItem

  it('assets minus liabilities, with depreciation applied', () => {
    const t = computeNetWorthTotals([item('asset', 100_000), item('asset', 200_000, 10), item('liability', 50_000)])
    expect(t.assetsTotal).toBe(280_000)
    expect(t.liabilitiesTotal).toBe(50_000)
    expect(t.netWorth).toBe(230_000)
  })

  it('empty is zero', () => {
    expect(computeNetWorthTotals([])).toEqual({ assetsTotal: 0, liabilitiesTotal: 0, netWorth: 0 })
  })
})

describe('formatting', () => {
  it('formats rand by default and respects the active currency', () => {
    setActiveCurrency('ZAR')
    expect(formatCurrency(12_500)).toMatch(/12[\s ]500/)
    expect(formatCurrency(0.4)).not.toMatch(/-/) // never "-R0"
    expect(formatCurrency(-0.4)).not.toMatch(/-/)
    expect(formatCurrency(NaN)).toBe('—')
    expect(formatCurrencyExact(32.5)).toMatch(/32[.,]50/)
    expect(formatCurrencyExact(32)).not.toMatch(/[.,]00/)
    setActiveCurrency('USD')
    expect(getActiveCurrency()).toBe('USD')
    expect(formatCurrency(10)).toMatch(/US\$|\$/)
    setActiveCurrency('nonsense') // ignored
    expect(getActiveCurrency()).toBe('USD')
    setActiveCurrency('ZAR')
    expect(() => formatCurrency(5, 'XXQ')).not.toThrow()
  })

  it('greeting by local hour', () => {
    expect(getGreeting(new Date(2026, 0, 1, 8))).toBe('Good morning')
    expect(getGreeting(new Date(2026, 0, 1, 12))).toBe('Good afternoon')
    expect(getGreeting(new Date(2026, 0, 1, 18))).toBe('Good evening')
  })
})
