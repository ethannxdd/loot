import type { TaxProfile, TaxYearData } from '@/lib/types'
import { getCurrentTaxYear, getTaxTable, type TaxTable } from './tax-tables'

export function computeGrossTax(taxableIncome: number, table: TaxTable): number {
  if (taxableIncome <= 0) return 0
  const bracket = table.brackets.find((b) => b.upTo === null || taxableIncome <= b.upTo)!
  return bracket.base + bracket.rate * (taxableIncome - bracket.above)
}

export function computeRebates(age: number, table: TaxTable): number {
  let rebate = table.rebates.primary
  if (age >= 65) rebate += table.rebates.secondary
  if (age >= 75) rebate += table.rebates.tertiary
  return rebate
}

/** Annual medical scheme fees tax credit — s6A. `dependants` excludes the main member. */
export function computeMedicalCredit(hasMedicalAid: boolean, dependants: number, table: TaxTable): number {
  if (!hasMedicalAid) return 0
  let monthly = table.medicalCredit.member
  if (dependants >= 1) monthly += table.medicalCredit.firstDependant
  if (dependants >= 2) monthly += (dependants - 1) * table.medicalCredit.additionalDependant
  return monthly * 12
}

export function raDeductionAmount(contributions: number, grossAnnualIncome: number, table: TaxTable): number {
  const capByIncome = grossAnnualIncome * 0.275
  return Math.max(0, Math.min(contributions, capByIncome, table.raDeductionCap))
}

export function donationsDeductionAmount(donations: number, taxableIncomeBeforeDonations: number): number {
  return Math.max(0, Math.min(donations, taxableIncomeBeforeDonations * 0.1))
}

export interface TaxEstimate {
  taxYear: string
  grossAnnualIncome: number
  raDeduction: number
  homeOfficeDeduction: number
  travelDeduction: number
  donationsDeduction: number
  /** Professional development / CPD costs — only deductible against self-employed income. */
  professionalDevelopmentDeduction: number
  taxableIncome: number
  grossTax: number
  rebates: number
  medicalCredit: number
  annualLiability: number
  monthlyPaye: number
  effectiveRate: number
  /** The bracket rate (%) applied to the last rand of taxable income. */
  marginalRate: number
  belowThreshold: boolean
  /**
   * PAYE assumed to have been withheld all year. For salaried and retired taxpayers this is the tax on the full
   * income with none of the claimable deductions applied (payroll doesn't know about them); for everyone else 0.
   */
  payeWithheld: number
  payeAssumed: boolean
  /** Tax saved by the deductions entered — liability without them minus liability with them. */
  deductionSaving: number
  /** Positive = refund estimate (PAYE withheld exceeds what's owed), negative = amount still to pay. */
  refundOrOweEstimate: number
}

/** Employment types whose tax is normally deducted at source by an employer or pension fund. */
export function isPayeEmployment(type: TaxProfile['employment_type']): boolean {
  return type === 'salaried' || type === 'retired'
}

function marginalRateAt(taxableIncome: number, table: TaxTable): number {
  const bracket = table.brackets.find((b) => b.upTo === null || taxableIncome <= b.upTo)!
  return bracket.rate * 100
}

function liabilityFor(taxableIncome: number, profile: TaxProfile, table: TaxTable): number {
  const gross = computeGrossTax(taxableIncome, table)
  const rebates = computeRebates(profile.age, table)
  const medical = computeMedicalCredit(profile.has_medical_aid, profile.medical_dependants, table)
  return Math.max(0, gross - rebates - medical)
}

export function estimateTax(
  profile: TaxProfile,
  yearData: TaxYearData,
  grossAnnualIncome: number,
  /** Override for PAYE withheld; when omitted it's assumed from the employment type (see TaxEstimate.payeWithheld). */
  paidViaPayeAnnual?: number,
): TaxEstimate {
  const table = getTaxTable(yearData.tax_year)
  const nonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

  const raDeduction = raDeductionAmount(nonNeg(yearData.ra_contributions), grossAnnualIncome, table)
  const incomeAfterRa = grossAnnualIncome - raDeduction
  const donationsDeduction = donationsDeductionAmount(nonNeg(yearData.donations), incomeAfterRa)
  const homeOfficeDeduction = profile.home_office_enabled === 'yes' ? nonNeg(yearData.home_office_deduction) : 0
  const travelDeduction = profile.has_travel_allowance ? nonNeg(yearData.travel_deduction) : 0
  const professionalDevelopmentDeduction =
    profile.employment_type === 'self_employed' || profile.employment_type === 'both' ? nonNeg(yearData.professional_development) : 0

  const taxableIncome = Math.max(
    0,
    incomeAfterRa - donationsDeduction - homeOfficeDeduction - travelDeduction - professionalDevelopmentDeduction,
  )
  const annualLiability = liabilityFor(taxableIncome, profile, table)

  const withoutDeductions = liabilityFor(Math.max(0, grossAnnualIncome), profile, table)
  const payeAssumed = paidViaPayeAnnual === undefined && isPayeEmployment(profile.employment_type)
  const payeWithheld = paidViaPayeAnnual ?? (payeAssumed ? withoutDeductions : 0)

  const threshold =
    profile.age >= 75 ? table.thresholds.from75 : profile.age >= 65 ? table.thresholds.from65to74 : table.thresholds.under65

  return {
    taxYear: table.taxYear,
    grossAnnualIncome,
    raDeduction,
    homeOfficeDeduction,
    travelDeduction,
    donationsDeduction,
    professionalDevelopmentDeduction,
    taxableIncome,
    grossTax: computeGrossTax(taxableIncome, table),
    rebates: computeRebates(profile.age, table),
    medicalCredit: computeMedicalCredit(profile.has_medical_aid, profile.medical_dependants, table),
    annualLiability,
    monthlyPaye: annualLiability / 12,
    effectiveRate: grossAnnualIncome > 0 ? (annualLiability / grossAnnualIncome) * 100 : 0,
    marginalRate: taxableIncome > 0 ? marginalRateAt(taxableIncome, table) : 0,
    belowThreshold: grossAnnualIncome < threshold,
    payeWithheld,
    payeAssumed,
    deductionSaving: Math.max(0, withoutDeductions - annualLiability),
    refundOrOweEstimate: payeWithheld - annualLiability,
  }
}

export interface ProvisionalEstimate {
  periodLabel: string
  dueDate: string // ISO date, local calendar
  amountDue: number
  daysUntilDue: number
}

function localIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The two provisional payments for a tax year: 31 August (half of the year's estimated tax) and the last day
 * of February (the rest). PAYE already withheld is credited first, so only the tax not covered by payroll is
 * split between the two.
 */
export function provisionalTaxEstimates(estimate: TaxEstimate, taxYearStartYear: number, from = new Date()): ProvisionalEstimate[] {
  const augDue = new Date(taxYearStartYear, 7, 31) // 31 August
  const febDue = new Date(taxYearStartYear + 1, 2, 0) // day 0 of March = last day of February (leap years included)
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const dayMs = 1000 * 60 * 60 * 24

  const net = Math.max(0, estimate.annualLiability - estimate.payeWithheld)
  const first = net / 2
  const second = net - first

  return [
    {
      periodLabel: 'First period (August)',
      dueDate: localIsoDate(augDue),
      amountDue: first,
      daysUntilDue: Math.round((augDue.getTime() - today.getTime()) / dayMs),
    },
    {
      periodLabel: 'Second period (February)',
      dueDate: localIsoDate(febDue),
      amountDue: second,
      daysUntilDue: Math.round((febDue.getTime() - today.getTime()) / dayMs),
    },
  ]
}

/**
 * Effective income-tax rate (%) on a gross monthly salary, from the SARS tables for the current tax year
 * (primary rebate only, age 30 assumed, no medical credit or deductions). Used to pre-fill the Salary Planner.
 */
export function estimateEffectiveTaxRatePct(grossMonthly: number, taxYear = getCurrentTaxYear(), age = 30): number {
  const annual = grossMonthly * 12
  if (!(annual > 0)) return 0
  const table = getTaxTable(taxYear)
  const liability = Math.max(0, computeGrossTax(annual, table) - computeRebates(age, table))
  return Math.round((liability / annual) * 1000) / 10
}
