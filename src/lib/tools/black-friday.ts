import type { AffordabilityVerdict } from '../types'
import { round2 } from './finance'

/** Black Friday planner (Phase 6 §3.5): a budget from Safe to spend, and each wishlist item checked against it. */

export interface BlackFridayItem {
  id: string
  name: string
  price: number
  targetPrice: number | null
}

export interface BlackFridayInputs {
  /** Projected Safe to spend on the day. */
  safeOnTheDay: number
  /** Money the person ring-fences (won't spend). */
  ringFenced: number
  /** Monthly goal contributions they could pause this cycle (0 = not paused). */
  pausedContributions: number
  buffer: number
}

export interface BlackFridayRow extends BlackFridayItem {
  /** Price used (target price if set). */
  cost: number
  runningTotal: number
  verdict: AffordabilityVerdict
}

export function blackFridayBudget(i: BlackFridayInputs): number {
  return round2(Math.max(0, i.safeOnTheDay - i.ringFenced + i.pausedContributions))
}

/** Items in order; each is comfortable while the running total fits the budget, tight within the buffer, else not. */
export function checkItems(items: BlackFridayItem[], budget: number, buffer: number): BlackFridayRow[] {
  let running = 0
  return items.map((it) => {
    const cost = it.targetPrice ?? it.price
    running += cost
    const verdict: AffordabilityVerdict = running <= budget ? 'comfortable' : running <= budget + buffer ? 'tight' : 'not-recommended'
    return { ...it, cost, runningTotal: round2(running), verdict }
  })
}

/** Black Friday weekend: Friday to the end of Monday (Cyber Monday). */
export function blackFridayWeekend(date: string): { start: Date; end: Date } {
  const [y, m, d] = date.split('-').map(Number)
  return { start: new Date(y, m - 1, d), end: new Date(y, m - 1, d + 4) }
}

/** Card window: from 1 Nov until the date + N days. */
export function inBlackFridayWindow(today: Date, date: string, daysAfter: number): boolean {
  const [y, m, d] = date.split('-').map(Number)
  const from = new Date(y, 10, 1)
  const to = new Date(y, m - 1, d + daysAfter + 1)
  return today.getTime() >= from.getTime() && today.getTime() < to.getTime()
}

/** "Delays Car deposit by 1 month" — months a goal slips if this cycle's contribution is paused. */
export function pauseDelayMonths(monthlyContribution: number): number {
  return monthlyContribution > 0 ? 1 : 0
}
