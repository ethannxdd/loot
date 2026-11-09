import type { BondCosts, DutyBracket } from '../content-defaults'
import { transferDuty } from '../content'
import { balanceAfter, instalment, round2 } from './finance'

/**
 * Rent vs buy (Phase 6 §4.5). Year by year: the net cost of buying (everything paid, less the equity you own) against
 * the net cost of renting (rent paid, less what the deposit and upfront costs would have earned invested). The
 * break-even year is the first year buying is cheaper.
 */

export interface RentBuyInputs {
  price: number
  deposit: number
  bondRatePct: number
  termYears: 20 | 30
  ratesLeviesMonthly: number
  insuranceMonthly: number
  maintenancePctYear: number
  rentMonthly: number
  rentEscalationPct: number
  investReturnPct: number
  propertyGrowthPct: number
  years: number
}

export interface RentBuyYear {
  year: number
  buyNet: number
  rentNet: number
  equity: number
}

export interface RentBuyResult {
  duty: number
  transferCosts: number
  bondCosts: number
  upfront: number
  bondRepayment: number
  /** First-year monthly cost of owning (repayment + rates + insurance + maintenance). */
  buyMonthly: number
  rentMonthly: number
  breakEvenYear: number | null
  years: RentBuyYear[]
}

export function defaultRentBuyInputs(prime: number): RentBuyInputs {
  return {
    price: 1_500_000,
    deposit: 150_000,
    bondRatePct: prime,
    termYears: 20,
    ratesLeviesMonthly: 1_800,
    insuranceMonthly: 450,
    maintenancePctYear: 1,
    rentMonthly: 12_000,
    rentEscalationPct: 8,
    investReturnPct: 9,
    propertyGrowthPct: 5,
    years: 15,
  }
}

export function rentVsBuy(i: RentBuyInputs, duty: DutyBracket[], costs: BondCosts): RentBuyResult {
  const bond = Math.max(0, i.price - i.deposit)
  const dutyAmt = transferDuty(i.price, duty)
  const transferCosts = round2((i.price * costs.transferPct) / 100 + costs.fixed / 2)
  const bondCosts = bond > 0 ? round2((bond * costs.bondPct) / 100 + costs.fixed / 2) : 0
  const upfront = round2(i.deposit + dutyAmt + transferCosts + bondCosts)
  const months = i.termYears * 12
  const pmt = instalment(bond, i.bondRatePct, months)

  let buyPaid = upfront
  let rentPaid = 0
  let rent = i.rentMonthly
  let invested = upfront
  let breakEvenYear: number | null = null
  const years: RentBuyYear[] = []

  for (let y = 1; y <= Math.max(1, i.years); y++) {
    const value = i.price * Math.pow(1 + i.propertyGrowthPct / 100, y)
    const paymentsThisYear = Math.min(12, Math.max(0, months - (y - 1) * 12))
    const upkeep = 12 * (i.ratesLeviesMonthly + i.insuranceMonthly) + ((value / (1 + i.propertyGrowthPct / 100)) * i.maintenancePctYear) / 100
    buyPaid += pmt * paymentsThisYear + upkeep
    const owed = Math.max(0, balanceAfter(bond, i.bondRatePct, pmt, Math.min(months, y * 12)))
    const equity = value - owed
    rentPaid += rent * 12
    rent *= 1 + i.rentEscalationPct / 100
    invested *= 1 + i.investReturnPct / 100
    const buyNet = buyPaid - equity
    const rentNet = rentPaid - (invested - upfront)
    if (breakEvenYear === null && buyNet <= rentNet) breakEvenYear = y
    years.push({ year: y, buyNet: Math.round(buyNet), rentNet: Math.round(rentNet), equity: Math.round(equity) })
  }

  return {
    duty: dutyAmt,
    transferCosts,
    bondCosts,
    upfront,
    bondRepayment: round2(pmt),
    buyMonthly: round2(pmt + i.ratesLeviesMonthly + i.insuranceMonthly + (i.price * i.maintenancePctYear) / 100 / 12),
    rentMonthly: i.rentMonthly,
    breakEvenYear,
    years,
  }
}
