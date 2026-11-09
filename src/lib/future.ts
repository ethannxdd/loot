import type { TfsaLimits, TwoPot } from './content-defaults'
import { getCurrentTaxYear, getTaxTable, type TaxTable } from './tax/tax-tables'
import { computeGrossTax, computeRebates } from './tax/tax-math'
import { futureValue } from './tools/finance'

/**
 * Future you (Phase 6 §4.7, Rules 27–28): TFSA room, the retirement projection and the two-pot withdrawal cost.
 * Limits come from content (useContent) with bundled defaults; tax uses the same SARS tables as the Tax centre.
 */

// ---------------------------------------------------------------------------------------------------------
// TFSA
// ---------------------------------------------------------------------------------------------------------

export interface TfsaContribution {
  id: string
  user_id: string
  tax_year: string
  amount: number
  contributed_on: string
  provider: string | null
  note: string | null
  created_at: string
  updated_at: string
}

/** The SA tax year a date falls in ('2026/27' runs 1 Mar 2026 – 28 Feb 2027). */
export function taxYearOf(date: Date): string {
  return getCurrentTaxYear(date)
}

/** 28/29 February at the end of a tax year. */
export function taxYearEnd(taxYear: string): Date {
  const start = Number(taxYear.slice(0, 4))
  return new Date(start + 1, 2, 0)
}

export type TfsaWarning = 'none' | 'eighty' | 'full' | 'over'

export interface TfsaRoom {
  taxYear: string
  thisYear: number
  annualLimit: number
  roomThisYear: number
  lifetime: number
  lifetimeLimit: number
  roomLifetime: number
  /** Share of the annual limit used, 0–1+. */
  usedPct: number
  warning: TfsaWarning
  /** Over the annual limit: the 40% penalty on the excess. */
  penalty: number
  /** Monthly amount to max out the year by 28 Feb (0 when full). */
  monthlyToMax: number
  monthsLeft: number
}

/** Rule 27: room per tax year and lifetime, warnings at 80% and 100%, penalty on excess. */
export function tfsaRoom(contributions: Pick<TfsaContribution, 'tax_year' | 'amount'>[], limits: TfsaLimits, today = new Date()): TfsaRoom {
  const year = taxYearOf(today)
  const thisYear = contributions.filter((c) => c.tax_year === year).reduce((s, c) => s + Number(c.amount), 0)
  const lifetime = contributions.reduce((s, c) => s + Number(c.amount), 0)
  const roomThisYear = Math.max(0, Math.min(limits.annual - thisYear, limits.lifetime - lifetime))
  const usedPct = limits.annual > 0 ? thisYear / limits.annual : 0
  const warning: TfsaWarning = thisYear > limits.annual ? 'over' : usedPct >= 1 ? 'full' : usedPct >= 0.8 ? 'eighty' : 'none'
  const end = taxYearEnd(year)
  const monthsLeft = Math.max(1, (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth()) + 1)
  return {
    taxYear: year,
    thisYear,
    annualLimit: limits.annual,
    roomThisYear,
    lifetime,
    lifetimeLimit: limits.lifetime,
    roomLifetime: Math.max(0, limits.lifetime - lifetime),
    usedPct,
    warning,
    penalty: Math.max(0, thisYear - limits.annual) * (limits.penalty_pct / 100),
    monthlyToMax: roomThisYear > 0 ? Math.ceil(roomThisYear / monthsLeft) : 0,
    monthsLeft,
  }
}

// ---------------------------------------------------------------------------------------------------------
// Retirement
// ---------------------------------------------------------------------------------------------------------

export interface RetirementInputs {
  currentAge: number
  retirementAge: number
  balance: number
  monthlyContribution: number
  /** After inflation, % a year. */
  realReturnPct: number
  /** Desired monthly income in today's rands. */
  desiredIncome: number
}

export interface RetirementResult {
  years: number
  /** Projected pot at retirement, in today's rands. */
  pot: number
  /** Sustainable monthly income in today's rands (4% a year drawdown). */
  monthlyIncome: number
  gap: number
  onTrack: boolean
  /** What an extra R500 a month would add to the monthly income. */
  plus500: number
  series: { age: number; pot: number }[]
}

/** Safe-ish drawdown used for "on track for R x a month" — 4% of the pot a year. */
export const DRAWDOWN_RATE = 0.04

export function projectRetirement(i: RetirementInputs): RetirementResult {
  const years = Math.max(0, i.retirementAge - i.currentAge)
  const r = i.realReturnPct / 100 / 12
  const grow = (balance: number, monthly: number) => {
    let pot = balance
    const series: { age: number; pot: number }[] = [{ age: i.currentAge, pot: Math.round(pot) }]
    for (let m = 1; m <= years * 12; m++) {
      pot = pot * (1 + r) + monthly
      if (m % 12 === 0) series.push({ age: i.currentAge + m / 12, pot: Math.round(pot) })
    }
    return { pot, series }
  }
  const base = grow(i.balance, i.monthlyContribution)
  const extra = grow(i.balance, i.monthlyContribution + 500)
  const monthlyIncome = (base.pot * DRAWDOWN_RATE) / 12
  return {
    years,
    pot: Math.round(base.pot),
    monthlyIncome: Math.round(monthlyIncome),
    gap: Math.round(Math.max(0, i.desiredIncome - monthlyIncome)),
    onTrack: monthlyIncome >= i.desiredIncome,
    plus500: Math.round(((extra.pot - base.pot) * DRAWDOWN_RATE) / 12),
    series: base.series,
  }
}

// ---------------------------------------------------------------------------------------------------------
// Two-pot withdrawal (Rule 28)
// ---------------------------------------------------------------------------------------------------------

export interface TwoPotInputs {
  /** Savings-component balance. */
  balance: number
  withdrawal: number
  adminFee: number
  /** Gross annual taxable income (without the withdrawal). */
  annualIncome: number
  age: number
  realReturnPct: number
  yearsToRetirement: number
}

export interface TwoPotResult {
  allowed: boolean
  reason: string | null
  /** Extra tax because the withdrawal is added to taxable income. */
  tax: number
  marginalRatePct: number
  net: number
  /** What the withdrawal would have grown to by retirement (today's rands). */
  costAtRetirement: number
}

function annualTax(taxable: number, age: number, table: TaxTable): number {
  return Math.max(0, computeGrossTax(taxable, table) - computeRebates(age, table))
}

export function twoPotWithdrawal(i: TwoPotInputs, rules: TwoPot, table: TaxTable = getTaxTable(getCurrentTaxYear())): TwoPotResult {
  const w = Math.max(0, i.withdrawal)
  let reason: string | null = null
  if (w < rules.min_withdrawal) reason = `The minimum withdrawal is R${rules.min_withdrawal.toLocaleString('en-ZA')}.`
  else if (w > i.balance) reason = 'You can’t take out more than your savings pot holds.'
  const tax = annualTax(i.annualIncome + w, i.age, table) - annualTax(i.annualIncome, i.age, table)
  const marginal = [...table.brackets].reverse().find((b) => i.annualIncome + w > b.above)?.rate ?? 0
  return {
    allowed: reason === null,
    reason,
    tax: Math.round(tax),
    marginalRatePct: Math.round(marginal * 100),
    net: Math.round(Math.max(0, w - tax - i.adminFee)),
    costAtRetirement: Math.round(futureValue(w, i.realReturnPct, Math.max(0, i.yearsToRetirement))),
  }
}
