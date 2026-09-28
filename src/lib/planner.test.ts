import { describe, expect, it, vi } from 'vitest'
import type { Expense, NetWorthItem, PlannerPlan } from './types'
import { computePlanTotals, METRIC_LOWER_IS_BETTER, winningPlanIds } from './plan-compare'
import { phaseToExpenses } from './planner-apply'
import {
  computePhase,
  emptyPhase,
  grossForNet,
  grossForNetSars,
  itemMonthly,
  netAfterTax,
  netFromGrossSars,
  normalisePhase,
  peakPhaseIndex,
  phaseUpfront,
  sarsRateForNet,
} from './planner-math'

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

describe('planner maths (target-driven)', () => {
  it('net after flat tax, and gross for a take-home', () => {
    expect(netAfterTax(50_000, 20)).toBe(40_000)
    expect(netAfterTax(50_000, 0)).toBe(50_000)
    expect(grossForNet(40_000, 20)).toBe(50_000)
    expect(grossForNet(40_000, 100)).toBe(0)
  })

  it('required take-home = monthly expenses + leftover target; gross grosses it up', () => {
    const phase = {
      name: 'P',
      gross_income: 0,
      leftover_target: 5_000,
      expenses: [
        { name: 'Rent', amount: 15_000 },
        { name: 'Blank', amount: NaN },
      ],
    }
    const c = computePhase(phase, 20)
    expect(c.totalExpenses).toBe(15_000)
    expect(c.requiredNet).toBe(20_000)
    expect(c.requiredGross).toBe(25_000)
    expect(c.requiredAnnualGross).toBe(300_000)
    expect(c.hasSalary).toBe(false)
    expect(c.leftover).toBe(0)
  })

  it('frequencies convert to monthly; once-off spreads over the phase length or stays up front', () => {
    expect(itemMonthly({ name: 'w', amount: 120, frequency: 'weekly' })).toBeCloseTo(520)
    expect(itemMonthly({ name: 'a', amount: 1_200, frequency: 'annual' })).toBe(100)
    expect(itemMonthly({ name: 'o', amount: 12_000, frequency: 'once-off' })).toBe(0)
    expect(itemMonthly({ name: 'o', amount: 12_000, frequency: 'once-off' }, 12)).toBe(1_000)
    expect(itemMonthly({ name: 'legacy', amount: 900 })).toBe(900) // no frequency = monthly

    const open = { name: 'P', gross_income: 0, expenses: [{ name: 'Deposit', amount: 30_000, frequency: 'once-off' as const }] }
    expect(phaseUpfront(open)).toBe(30_000)
    expect(phaseUpfront({ ...open, months: 6 })).toBe(0)
    expect(computePhase({ ...open, months: 6 }, 0).totalExpenses).toBe(5_000)
  })

  it('a tested salary gives take-home and leftover', () => {
    const c = computePhase({ name: 'P', gross_income: 50_000, expenses: [{ name: 'Rent', amount: 15_000 }] }, 20)
    expect(c.hasSalary).toBe(true)
    expect(c.netIncome).toBe(40_000)
    expect(c.leftover).toBe(25_000)
  })

  it('emptyPhase and normalisePhase fill the new optional fields', () => {
    expect(emptyPhase()).toEqual({ name: 'Phase 1', gross_income: 0, leftover_target: 0, months: null, expenses: [] })
    const legacy = normalisePhase({ name: 'Old', gross_income: 40_000, expenses: [{ name: 'x', amount: 1 }] })
    expect(legacy.leftover_target).toBe(0)
    expect(legacy.months).toBeNull()
    expect(legacy.expenses[0].frequency).toBe('monthly')
  })

  it('peak phase is the one that needs the most', () => {
    const phases = [
      { name: 'A', gross_income: 0, expenses: [{ name: 'x', amount: 10_000 }] },
      { name: 'B', gross_income: 0, expenses: [{ name: 'x', amount: 30_000 }] },
    ]
    expect(peakPhaseIndex(phases, 25)).toBe(1)
    expect(peakPhaseIndex([], 25)).toBe(-1)
  })

  it('SARS round trip: the gross for a take-home gives that take-home back', () => {
    for (const net of [8_000, 25_000, 60_000, 150_000]) {
      const gross = grossForNetSars(net, '2026/27')
      expect(netFromGrossSars(gross, '2026/27')).toBeCloseTo(net, 0)
      expect(gross).toBeGreaterThanOrEqual(net)
    }
    // Below the tax threshold there's no tax at all.
    expect(grossForNetSars(5_000, '2026/27')).toBeCloseTo(5_000, 0)
    expect(sarsRateForNet(5_000, '2026/27')).toBe(0)
    expect(sarsRateForNet(60_000, '2026/27')).toBeGreaterThan(20)
  })
})

describe('apply a phase to expenses', () => {
  const existing = [
    { name: 'Rent', amount: 9_000, frequency: 'monthly', deleted_at: null },
    { name: 'Gym', amount: 500, frequency: 'monthly', deleted_at: '2026-01-01' },
  ] as Expense[]

  it('skips items already tracked (same name, amount, frequency), keeps removed ones addable, sets category and fixed', () => {
    const { toAdd, skipped } = phaseToExpenses(
      {
        name: 'P',
        gross_income: 0,
        expenses: [
          { name: ' rent ', amount: 9_000, category: 'housing' },
          { name: 'Gym', amount: 500, category: 'health_beauty' },
          { name: 'Car', amount: 4_000, category: 'vehicle_finance', frequency: 'monthly' },
          { name: 'Flights', amount: 8_000, frequency: 'once-off' },
          { name: '', amount: 100 },
          { name: 'Zero', amount: 0 },
        ],
      },
      existing,
    )
    expect(skipped).toBe(1)
    expect(toAdd.map((e) => e.name)).toEqual(['Gym', 'Car', 'Flights'])
    expect(toAdd.find((e) => e.name === 'Car')?.is_fixed).toBe(true)
    expect(toAdd.find((e) => e.name === 'Gym')?.is_fixed).toBe(false)
    expect(toAdd.find((e) => e.name === 'Flights')).toMatchObject({ category: 'other', frequency: 'once-off' })
  })
})

describe('plan comparison', () => {
  const two = plan({
    tax_rate_pct: 20,
    phases: [
      { name: 'A', gross_income: 0, leftover_target: 4_000, expenses: [{ name: 'x', amount: 20_000 }] },
      { name: 'B', gross_income: 0, leftover_target: 0, expenses: [{ name: 'x', amount: 36_000 }] },
    ],
  })

  it('peak and per-phase averages', () => {
    const t = computePlanTotals(two)
    expect(t.phaseCount).toBe(2)
    expect(t.peakNet).toBe(36_000)
    expect(t.peakGross).toBe(45_000)
    expect(t.avgRequiredGross).toBe(37_500)
    expect(t.avgExpenses).toBe(28_000)
    expect(t.avgLeftoverTarget).toBe(2_000)
  })

  it('an empty plan is all zeros, not NaN or -Infinity', () => {
    const t = computePlanTotals(plan())
    expect(t).toMatchObject({ phaseCount: 0, peakGross: 0, peakNet: 0, avgRequiredGross: 0 })
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
    expect(METRIC_LOWER_IS_BETTER.peakGross).toBe(true)
    expect(METRIC_LOWER_IS_BETTER.avgLeftoverTarget).toBe(false)
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
