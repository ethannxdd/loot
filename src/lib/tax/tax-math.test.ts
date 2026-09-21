import { describe, expect, it } from 'vitest'
import { makeTaxProfile, makeTaxYear } from '@/test/factories'
import { getCalendarWithCountdowns } from './calendar'
import {
  computeGrossTax,
  computeMedicalCredit,
  computeRebates,
  donationsDeductionAmount,
  estimateEffectiveTaxRatePct,
  estimateTax,
  isPayeEmployment,
  provisionalTaxEstimates,
  raDeductionAmount,
} from './tax-math'
import { AVAILABLE_TAX_YEARS, TAX_TABLES, getCurrentTaxYear, getTaxTable } from './tax-tables'

const t2627 = TAX_TABLES['2026/27']

describe('tax tables', () => {
  it('bracket bases are continuous (each base = previous base + previous width × rate)', () => {
    for (const table of Object.values(TAX_TABLES)) {
      for (let i = 1; i < table.brackets.length; i++) {
        const prev = table.brackets[i - 1]
        const expected = prev.base + prev.rate * ((prev.upTo as number) - prev.above)
        expect(Math.abs(table.brackets[i].base - expected)).toBeLessThan(2)
        expect(table.brackets[i].above).toBe(prev.upTo)
      }
    }
  })

  it('tax year runs 1 March – end Feb', () => {
    expect(getCurrentTaxYear(new Date(2026, 1, 28))).toBe('2025/26')
    expect(getCurrentTaxYear(new Date(2026, 2, 1))).toBe('2026/27')
    expect(getCurrentTaxYear(new Date(2026, 8, 21))).toBe('2026/27')
    expect(getCurrentTaxYear(new Date(2099, 5, 1))).toBe('2099/00')
  })

  it('unknown years fall back to the latest known table', () => {
    expect(getTaxTable('2031/32')).toBe(TAX_TABLES[AVAILABLE_TAX_YEARS[AVAILABLE_TAX_YEARS.length - 1]])
  })
})

describe('building blocks', () => {
  it('gross tax at bracket edges', () => {
    expect(computeGrossTax(0, t2627)).toBe(0)
    expect(computeGrossTax(-5, t2627)).toBe(0)
    expect(computeGrossTax(100_000, t2627)).toBeCloseTo(18_000)
    expect(computeGrossTax(245_100, t2627)).toBeCloseTo(44_118)
    expect(computeGrossTax(600_000, t2627)).toBeCloseTo(150_727)
    expect(computeGrossTax(2_000_000, t2627)).toBeCloseTo(666_339 + 0.45 * (2_000_000 - 1_878_600))
  })

  it('rebates by age', () => {
    expect(computeRebates(30, t2627)).toBe(17_820)
    expect(computeRebates(65, t2627)).toBe(17_820 + 9_765)
    expect(computeRebates(75, t2627)).toBe(17_820 + 9_765 + 3_249)
  })

  it('medical credit: member, first dependant, additional dependants', () => {
    expect(computeMedicalCredit(false, 3, t2627)).toBe(0)
    expect(computeMedicalCredit(true, 0, t2627)).toBe(376 * 12)
    expect(computeMedicalCredit(true, 1, t2627)).toBe((376 + 376) * 12)
    expect(computeMedicalCredit(true, 3, t2627)).toBe((376 + 376 + 2 * 254) * 12)
  })

  it('RA deduction: lesser of contributions, 27.5% of income and the cap', () => {
    expect(raDeductionAmount(50_000, 400_000, t2627)).toBe(50_000)
    expect(raDeductionAmount(200_000, 400_000, t2627)).toBeCloseTo(110_000)
    expect(raDeductionAmount(900_000, 5_000_000, t2627)).toBe(430_000)
    expect(raDeductionAmount(-5, 400_000, t2627)).toBe(0)
  })

  it('donations: up to 10% of taxable income', () => {
    expect(donationsDeductionAmount(5_000, 100_000)).toBe(5_000)
    expect(donationsDeductionAmount(50_000, 100_000)).toBe(10_000)
  })
})

describe('estimateTax', () => {
  it('R600k salaried, no deductions', () => {
    const e = estimateTax(makeTaxProfile(), makeTaxYear(), 600_000)
    expect(e.annualLiability).toBeCloseTo(150_727 - 17_820)
    expect(e.monthlyPaye).toBeCloseTo((150_727 - 17_820) / 12)
    expect(e.marginalRate).toBe(36)
    expect(e.belowThreshold).toBe(false)
    expect(e.deductionSaving).toBe(0)
  })

  it('never returns negative tax and flags below-threshold income', () => {
    const e = estimateTax(makeTaxProfile(), makeTaxYear(), 60_000)
    expect(e.annualLiability).toBe(0)
    expect(e.belowThreshold).toBe(true)
  })

  it('salaried: PAYE is assumed withheld on the full income, so deductions produce a refund equal to the saving', () => {
    const e = estimateTax(makeTaxProfile(), makeTaxYear({ ra_contributions: 60_000 }), 600_000)
    expect(e.payeAssumed).toBe(true)
    expect(e.raDeduction).toBe(60_000)
    expect(e.deductionSaving).toBeCloseTo(60_000 * 0.36)
    expect(e.refundOrOweEstimate).toBeCloseTo(e.deductionSaving)
    expect(e.refundOrOweEstimate).toBeGreaterThan(0)
  })

  it('with no deductions a salaried taxpayer is neither owed nor owing', () => {
    const e = estimateTax(makeTaxProfile(), makeTaxYear(), 600_000)
    expect(e.refundOrOweEstimate).toBeCloseTo(0)
  })

  it('self-employed: nothing withheld, so the whole liability is owed', () => {
    const e = estimateTax(makeTaxProfile({ employment_type: 'self_employed' }), makeTaxYear(), 600_000)
    expect(e.payeAssumed).toBe(false)
    expect(e.payeWithheld).toBe(0)
    expect(e.refundOrOweEstimate).toBeCloseTo(-e.annualLiability)
  })

  it('an explicit PAYE figure overrides the assumption', () => {
    const e = estimateTax(makeTaxProfile(), makeTaxYear(), 600_000, 100_000)
    expect(e.payeAssumed).toBe(false)
    expect(e.refundOrOweEstimate).toBeCloseTo(100_000 - e.annualLiability)
  })

  it('professional development only counts for self-employed / both', () => {
    const yd = makeTaxYear({ professional_development: 20_000 })
    expect(estimateTax(makeTaxProfile({ employment_type: 'salaried' }), yd, 600_000).professionalDevelopmentDeduction).toBe(0)
    expect(estimateTax(makeTaxProfile({ employment_type: 'self_employed' }), yd, 600_000).professionalDevelopmentDeduction).toBe(20_000)
    expect(estimateTax(makeTaxProfile({ employment_type: 'both' }), yd, 600_000).professionalDevelopmentDeduction).toBe(20_000)
  })

  it('home office and travel only count when enabled on the profile', () => {
    const yd = makeTaxYear({ home_office_deduction: 10_000, travel_deduction: 8_000 })
    const off = estimateTax(makeTaxProfile(), yd, 600_000)
    expect(off.homeOfficeDeduction + off.travelDeduction).toBe(0)
    const on = estimateTax(makeTaxProfile({ home_office_enabled: 'yes', has_travel_allowance: true }), yd, 600_000)
    expect(on.homeOfficeDeduction).toBe(10_000)
    expect(on.travelDeduction).toBe(8_000)
  })

  it('medical credit reduces liability', () => {
    const none = estimateTax(makeTaxProfile(), makeTaxYear(), 600_000)
    const aid = estimateTax(makeTaxProfile({ has_medical_aid: true }), makeTaxYear(), 600_000)
    expect(none.annualLiability - aid.annualLiability).toBeCloseTo(376 * 12)
  })

  it('ignores junk (NaN / negative) deduction inputs', () => {
    const e = estimateTax(makeTaxProfile(), makeTaxYear({ ra_contributions: NaN, donations: -50 }), 600_000)
    expect(e.raDeduction).toBe(0)
    expect(e.donationsDeduction).toBe(0)
  })

  it('zero income is safe', () => {
    const e = estimateTax(makeTaxProfile(), makeTaxYear(), 0)
    expect(e.annualLiability).toBe(0)
    expect(e.effectiveRate).toBe(0)
    expect(e.marginalRate).toBe(0)
  })

  it('PAYE employment types', () => {
    expect(isPayeEmployment('salaried')).toBe(true)
    expect(isPayeEmployment('retired')).toBe(true)
    expect(isPayeEmployment('self_employed')).toBe(false)
    expect(isPayeEmployment('both')).toBe(false)
  })
})

describe('provisionalTaxEstimates', () => {
  const selfEmployed = estimateTax(makeTaxProfile({ employment_type: 'self_employed' }), makeTaxYear(), 600_000)

  it('splits the liability in two, on 31 Aug and the last day of February', () => {
    const [first, second] = provisionalTaxEstimates(selfEmployed, 2026, new Date(2026, 7, 1))
    expect(first.dueDate).toBe('2026-08-31')
    expect(second.dueDate).toBe('2027-02-28')
    expect(first.amountDue + second.amountDue).toBeCloseTo(selfEmployed.annualLiability)
    expect(first.amountDue).toBeCloseTo(selfEmployed.annualLiability / 2)
    expect(first.daysUntilDue).toBe(30)
  })

  it('uses 29 February in leap years', () => {
    const [, second] = provisionalTaxEstimates(selfEmployed, 2027, new Date(2027, 7, 1))
    expect(second.dueDate).toBe('2028-02-29')
  })

  it('credits PAYE already withheld before splitting', () => {
    const both = estimateTax(makeTaxProfile({ employment_type: 'both' }), makeTaxYear(), 600_000, 100_000)
    const [first, second] = provisionalTaxEstimates(both, 2026, new Date(2026, 7, 1))
    expect(first.amountDue + second.amountDue).toBeCloseTo(both.annualLiability - 100_000)
  })

  it('owes nothing when PAYE already covers the tax', () => {
    const salaried = estimateTax(makeTaxProfile(), makeTaxYear(), 600_000)
    const [first, second] = provisionalTaxEstimates(salaried, 2026, new Date(2026, 7, 1))
    expect(first.amountDue).toBe(0)
    expect(second.amountDue).toBe(0)
  })

  it('counts negative days once a date has passed', () => {
    const [first] = provisionalTaxEstimates(selfEmployed, 2026, new Date(2026, 8, 5))
    expect(first.daysUntilDue).toBe(-5)
  })
})

describe('estimateEffectiveTaxRatePct', () => {
  it('is 0 below the tax threshold and rises with income', () => {
    expect(estimateEffectiveTaxRatePct(5_000, '2026/27')).toBe(0)
    const mid = estimateEffectiveTaxRatePct(30_000, '2026/27')
    const high = estimateEffectiveTaxRatePct(100_000, '2026/27')
    expect(mid).toBeGreaterThan(0)
    expect(high).toBeGreaterThan(mid)
  })

  it('matches a hand calculation (R50k/month)', () => {
    // annual 600k → (150,727 − 17,820) / 600,000 = 22.15% → 22.2 rounded to 1dp
    expect(estimateEffectiveTaxRatePct(50_000, '2026/27')).toBe(22.2)
  })

  it('handles zero / invalid income', () => {
    expect(estimateEffectiveTaxRatePct(0)).toBe(0)
    expect(estimateEffectiveTaxRatePct(NaN)).toBe(0)
  })
})

describe('tax calendar', () => {
  it('hides provisional-only dates for non-provisional taxpayers', () => {
    const from = new Date(2026, 8, 21)
    const plain = getCalendarWithCountdowns(from, false)
    expect(plain.some((e) => e.provisionalOnly)).toBe(false)
    const prov = getCalendarWithCountdowns(from, true)
    expect(prov.some((e) => e.provisionalOnly)).toBe(true)
    // …and provisional taxpayers don't see the earlier non-provisional filing deadline
    expect(plain.some((e) => e.id === 'non-provisional-deadline-2026')).toBe(true)
    expect(prov.some((e) => e.id === 'non-provisional-deadline-2026')).toBe(false)
  })

  it('computes the statutory dates dynamically and sorts soonest first', () => {
    const from = new Date(2026, 8, 21)
    const list = getCalendarWithCountdowns(from, true)
    const topUp = list.find((e) => e.id.startsWith('prov-topup'))!
    expect(topUp.date).toBe('2026-09-30')
    expect(topUp.daysUntil).toBe(9)
    expect(topUp.urgency).toBe('soon')
    const yearEnd = list.find((e) => e.id.startsWith('tax-year-end'))!
    expect(yearEnd.date).toBe('2027-02-28')
    expect(list.map((e) => e.daysUntil)).toEqual([...list.map((e) => e.daysUntil)].sort((a, b) => a - b))
  })

  it('shows the next 31 August after it has passed by more than two weeks', () => {
    const list = getCalendarWithCountdowns(new Date(2026, 8, 21), true)
    expect(list.find((e) => e.id.startsWith('prov-1'))?.date).toBe('2027-08-31')
  })

  it('February end is 29 in leap years', () => {
    const list = getCalendarWithCountdowns(new Date(2027, 9, 1), true)
    expect(list.find((e) => e.id.startsWith('tax-year-end'))?.date).toBe('2028-02-29')
  })

  it('drops entries more than two weeks in the past', () => {
    const list = getCalendarWithCountdowns(new Date(2026, 10, 30), false)
    expect(list.find((e) => e.id === 'non-provisional-deadline-2026')).toBeUndefined()
  })
})
