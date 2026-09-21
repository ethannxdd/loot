import type { TaxProfile, TaxYearData } from '@/lib/types'
import { getTaxTable, type TaxTable } from './tax-tables'

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
  taxableIncome: number
  grossTax: number
  rebates: number
  medicalCredit: number
  annualLiability: number
  monthlyPaye: number
  effectiveRate: number
  belowThreshold: boolean
  /** Positive = refund estimate (paid more PAYE than owed), negative = amount still owed. */
  refundOrOweEstimate: number
}

export function estimateTax(
  profile: TaxProfile,
  yearData: TaxYearData,
  grossAnnualIncome: number,
  paidViaPayeAnnual: number
): TaxEstimate {
  const table = getTaxTable(yearData.tax_year)

  const raDeduction = raDeductionAmount(yearData.ra_contributions, grossAnnualIncome, table)
  const incomeAfterRa = grossAnnualIncome - raDeduction
  const donationsDeduction = donationsDeductionAmount(yearData.donations, incomeAfterRa)
  const homeOfficeDeduction = profile.home_office_enabled === 'yes' ? yearData.home_office_deduction : 0
  const travelDeduction = profile.has_travel_allowance ? yearData.travel_deduction : 0

  const taxableIncome = Math.max(
    0,
    incomeAfterRa - donationsDeduction - homeOfficeDeduction - travelDeduction
  )

  const grossTax = computeGrossTax(taxableIncome, table)
  const rebates = computeRebates(profile.age, table)
  const medicalCredit = computeMedicalCredit(profile.has_medical_aid, profile.medical_dependants, table)
  const annualLiability = Math.max(0, grossTax - rebates - medicalCredit)

  const threshold =
    profile.age >= 75 ? table.thresholds.from75 : profile.age >= 65 ? table.thresholds.from65to74 : table.thresholds.under65

  return {
    taxYear: table.taxYear,
    grossAnnualIncome,
    raDeduction,
    homeOfficeDeduction,
    travelDeduction,
    donationsDeduction,
    taxableIncome,
    grossTax,
    rebates,
    medicalCredit,
    annualLiability,
    monthlyPaye: annualLiability / 12,
    effectiveRate: grossAnnualIncome > 0 ? (annualLiability / grossAnnualIncome) * 100 : 0,
    belowThreshold: grossAnnualIncome < threshold,
    refundOrOweEstimate: paidViaPayeAnnual - annualLiability,
  }
}

export interface ProvisionalEstimate {
  periodLabel: string
  dueDate: string // ISO date
  amountDue: number
  daysUntilDue: number
}

/** Two provisional tax periods per SA tax year: 31 Aug (mid-year) and end-Feb (final). */
export function provisionalTaxEstimates(estimate: TaxEstimate, taxYearStartYear: number, from = new Date()): ProvisionalEstimate[] {
  const augDue = new Date(taxYearStartYear, 7, 31) // August = month index 7
  const febDue = new Date(taxYearStartYear + 1, 1, 28) // February = month index 1

  const halfLiability = estimate.annualLiability / 2
  const dayMs = 1000 * 60 * 60 * 24

  return [
    {
      periodLabel: 'First period (August)',
      dueDate: augDue.toISOString().slice(0, 10),
      amountDue: halfLiability,
      daysUntilDue: Math.ceil((augDue.getTime() - from.getTime()) / dayMs),
    },
    {
      periodLabel: 'Second period (February)',
      dueDate: febDue.toISOString().slice(0, 10),
      amountDue: estimate.annualLiability,
      daysUntilDue: Math.ceil((febDue.getTime() - from.getTime()) / dayMs),
    },
  ]
}
