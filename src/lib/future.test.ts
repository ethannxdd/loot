import { describe, expect, it } from 'vitest'
import { CONTENT_DEFAULTS } from './content-defaults'
import { projectRetirement, taxYearEnd, tfsaRoom, twoPotWithdrawal } from './future'
import { getTaxTable } from './tax/tax-tables'

const limits = CONTENT_DEFAULTS.tfsa_limits

describe('TFSA (Rule 27)', () => {
  it('acceptance: R40,000 contributed in 2026/27 → R6,000 room and the 80% warning', () => {
    const r = tfsaRoom([{ tax_year: '2026/27', amount: 25_000 }, { tax_year: '2026/27', amount: 15_000 }], limits, new Date(2026, 10, 9))
    expect(r.taxYear).toBe('2026/27')
    expect(r.roomThisYear).toBe(6_000)
    expect(r.warning).toBe('eighty')
    expect(r.monthsLeft).toBe(4) // Nov, Dec, Jan, Feb
    expect(r.monthlyToMax).toBe(1_500)
  })

  it('other years count towards lifetime only', () => {
    const r = tfsaRoom([{ tax_year: '2025/26', amount: 36_000 }], limits, new Date(2026, 10, 9))
    expect(r.thisYear).toBe(0)
    expect(r.lifetime).toBe(36_000)
    expect(r.roomLifetime).toBe(464_000)
  })

  it('over the limit: 40% penalty on the excess', () => {
    const r = tfsaRoom([{ tax_year: '2026/27', amount: 50_000 }], limits, new Date(2026, 10, 9))
    expect(r.warning).toBe('over')
    expect(r.penalty).toBe(1_600)
    expect(r.roomThisYear).toBe(0)
  })

  it('room is capped by what is left of the lifetime limit', () => {
    const r = tfsaRoom([{ tax_year: '2020/21', amount: 495_000 }], limits, new Date(2026, 10, 9))
    expect(r.roomThisYear).toBe(5_000)
  })

  it('tax year end', () => {
    expect(taxYearEnd('2027/28').getDate()).toBe(29)
  })
})

describe('retirement', () => {
  it('with no growth the pot is balance + contributions', () => {
    const r = projectRetirement({ currentAge: 35, retirementAge: 65, balance: 100_000, monthlyContribution: 1_000, realReturnPct: 0, desiredIncome: 20_000 })
    expect(r.pot).toBe(100_000 + 1_000 * 360)
    expect(r.monthlyIncome).toBe(Math.round((460_000 * 0.04) / 12))
    expect(r.onTrack).toBe(false)
    expect(r.series.at(-1)!.age).toBe(65)
  })

  it('+R500 a month adds income', () => {
    const r = projectRetirement({ currentAge: 30, retirementAge: 65, balance: 0, monthlyContribution: 2_000, realReturnPct: 4, desiredIncome: 10_000 })
    expect(r.plus500).toBeGreaterThan(0)
  })
})

describe('two-pot (Rule 28)', () => {
  const table = getTaxTable('2026/27')
  const base = { balance: 50_000, adminFee: 500, annualIncome: 360_000, age: 35, realReturnPct: 4, yearsToRetirement: 30 }

  it('acceptance: R20,000 for a R30,000/mo earner is taxed at the 26% marginal rate', () => {
    const r = twoPotWithdrawal({ ...base, withdrawal: 20_000 }, CONTENT_DEFAULTS.two_pot, table)
    expect(r.marginalRatePct).toBe(26)
    expect(r.tax).toBe(5_200)
    expect(r.net).toBe(20_000 - 5_200 - 500)
    expect(r.costAtRetirement).toBe(Math.round(20_000 * Math.pow(1.04, 30)))
  })

  it('crossing a bracket taxes the part above at the higher rate', () => {
    const r = twoPotWithdrawal({ ...base, annualIncome: 380_000, withdrawal: 10_000 }, CONTENT_DEFAULTS.two_pot, table)
    // 3,100 at 26% + 6,900 at 31%
    expect(r.tax).toBe(Math.round(3_100 * 0.26 + 6_900 * 0.31))
    expect(r.marginalRatePct).toBe(31)
  })

  it('minimum and balance rules', () => {
    expect(twoPotWithdrawal({ ...base, withdrawal: 1_500 }, CONTENT_DEFAULTS.two_pot, table).allowed).toBe(false)
    expect(twoPotWithdrawal({ ...base, withdrawal: 60_000 }, CONTENT_DEFAULTS.two_pot, table).reason).toContain('more than')
  })
})

describe('tax tables from content', () => {
  it('a published table replaces the bundled one; clearing it restores the bundle', async () => {
    const { setPublishedTaxTables, getTaxTable: get, TAX_TABLES } = await import('./tax/tax-tables')
    const { publishedTaxTables } = await import('./content')
    const custom = { ...TAX_TABLES['2026/27'], raDeductionCap: 999_000 }
    setPublishedTaxTables(publishedTaxTables({ 'tax_tables:2026/27': custom, 'tax_tables:2027/28': { junk: true } }))
    expect(get('2026/27').raDeductionCap).toBe(999_000)
    setPublishedTaxTables({})
    expect(get('2026/27')).toBe(TAX_TABLES['2026/27'])
  })
})
