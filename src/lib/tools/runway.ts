import { round2 } from './finance'

/** Runway / What if (Phase 6 §4.5): how long savings last if income drops or costs rise. */

export type RunwayScenario = 'lose_income' | 'pay_cut' | 'new_baby' | 'custom'

export const RUNWAY_SCENARIO_LABELS: Record<RunwayScenario, string> = {
  lose_income: 'Lose my income',
  pay_cut: 'Pay cut',
  new_baby: 'New baby',
  custom: 'Custom',
}

export interface RunwayInputs {
  savings: number
  takeHome: number
  /** Expenses kept no matter what. */
  essentials: number
  /** Expenses that can be cut. */
  cuttable: number
  scenario: RunwayScenario
  payCutPct: number
  /** Extra monthly cost (new baby) or custom change (+ = more spending). */
  extraMonthly: number
  /** UIF or other income during the scenario (lose_income). */
  otherIncome: number
  /** Cut the cuttable expenses. */
  cut: boolean
}

export interface RunwayResult {
  /** Monthly shortfall (spending − income). ≤ 0 means savings never run out. */
  shortfall: number
  /** Whole and fractional months the savings last; null = they don't run out. */
  months: number | null
  runsOutOn: Date | null
  /** Balance at the start of each month, until it hits zero (max 60). */
  series: { month: number; balance: number }[]
  /** Extra months gained by cutting the cuttable expenses (null if cutting means it never runs out). */
  cutGain: number | null
}

/** Default baby costs (nappies, formula, clinic) — editable. */
export const NEW_BABY_MONTHLY = 3_500

function shortfallFor(i: RunwayInputs, cut: boolean): number {
  const income =
    i.scenario === 'lose_income'
      ? i.otherIncome
      : i.scenario === 'pay_cut'
        ? i.takeHome * (1 - Math.min(100, Math.max(0, i.payCutPct)) / 100)
        : i.takeHome
  const spending = i.essentials + (cut ? 0 : i.cuttable) + (i.scenario === 'new_baby' || i.scenario === 'custom' ? i.extraMonthly : 0)
  return spending - income
}

function monthsFor(savings: number, shortfall: number): number | null {
  if (shortfall <= 0) return null
  return savings / shortfall
}

export function runway(i: RunwayInputs, today = new Date()): RunwayResult {
  const shortfall = shortfallFor(i, i.cut)
  const months = monthsFor(i.savings, shortfall)
  const series: { month: number; balance: number }[] = []
  let balance = i.savings
  for (let m = 0; m <= 60; m++) {
    series.push({ month: m, balance: Math.round(Math.max(0, balance)) })
    if (balance <= 0) break
    balance -= Math.max(0, shortfall)
    if (shortfall <= 0 && m >= 24) break
  }
  let runsOutOn: Date | null = null
  if (months !== null) {
    const whole = Math.floor(months)
    const d = new Date(today.getFullYear(), today.getMonth() + whole, today.getDate())
    d.setDate(d.getDate() + Math.round((months - whole) * 30))
    runsOutOn = d
  }
  const withCut = monthsFor(i.savings, shortfallFor(i, true))
  const withoutCut = monthsFor(i.savings, shortfallFor(i, false))
  const cutGain = withoutCut === null ? 0 : withCut === null ? null : round2(withCut - withoutCut)
  return { shortfall: round2(shortfall), months: months === null ? null : round2(months), runsOutOn, series, cutGain }
}
