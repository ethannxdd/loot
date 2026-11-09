import { grossForNetSars } from '../planner-math'
import { round2 } from './finance'

/** Moving out (Phase 6 §4.5): what it costs a month, the cash you need upfront and the salary it takes. */

export interface MovingOutInputs {
  rent: number
  depositMonths: number
  utilities: number
  internet: number
  groceries: number
  transport: number
  other: number
  onceOff: number
}

export interface MovingOutResult {
  monthly: number
  upfront: number
  grossNeeded: number
  /** Current take-home minus the new monthly cost (negative = short). */
  gap: number
}

export function defaultMovingOutInputs(): MovingOutInputs {
  return { rent: 7_500, depositMonths: 1, utilities: 1_200, internet: 500, groceries: 3_000, transport: 1_500, other: 1_000, onceOff: 15_000 }
}

export function movingOut(i: MovingOutInputs, takeHome: number, taxYear?: string): MovingOutResult {
  const monthly = i.rent + i.utilities + i.internet + i.groceries + i.transport + i.other
  return {
    monthly: round2(monthly),
    upfront: round2(i.rent * i.depositMonths + i.rent + i.onceOff),
    grossNeeded: Math.round(grossForNetSars(monthly, taxYear)),
    gap: round2(takeHome - monthly),
  }
}
