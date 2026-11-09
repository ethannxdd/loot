import { round2 } from './finance'

/**
 * Survive January (Phase 6 §3.5). December pay is often early (before Christmas) and January pay normal, so December
 * pay has to last much longer than a usual month — while the festive season and back-to-school land on top.
 */

export interface JanuaryInputs {
  /** 'YYYY-MM-DD' */
  decPayday: string
  janPayday: string
  /** Take-home for December. */
  decPay: number
  /** Monthly commitments that go off between the two paydays (expenses, debit orders). */
  commitments: number
  festive: { gifts: number; travel: number; food: number; other: number }
  school: { label: string; amount: number }[]
  /** Usual cycle length in days (for "vs usual"). */
  usualDays: number
}

export interface JanuaryResult {
  stretchDays: number
  extraDays: number
  festiveTotal: number
  schoolTotal: number
  /** What's left for day-to-day after commitments, festive and school. */
  dayToDay: number
  dailyAllowance: number
  /** Keep this from December pay for January (school + the January share of day-to-day). */
  setAside: number
  /** Days from 1 January to the January payday. */
  januaryDays: number
  breakdown: { key: string; label: string; amount: number }[]
}

const DAY = 86_400_000

function parse(d: string): Date {
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day)
}

export function surviveJanuary(i: JanuaryInputs): JanuaryResult {
  const dec = parse(i.decPayday)
  const jan = parse(i.janPayday)
  const stretchDays = Math.max(1, Math.round((jan.getTime() - dec.getTime()) / DAY))
  const firstJan = new Date(jan.getFullYear(), 0, 1)
  const januaryDays = Math.max(0, Math.round((jan.getTime() - firstJan.getTime()) / DAY))
  const festiveTotal = i.festive.gifts + i.festive.travel + i.festive.food + i.festive.other
  const schoolTotal = i.school.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  const dayToDay = i.decPay - i.commitments - festiveTotal - schoolTotal
  const dailyAllowance = dayToDay > 0 ? dayToDay / stretchDays : 0
  const setAside = schoolTotal + Math.max(0, dailyAllowance * januaryDays)
  return {
    stretchDays,
    extraDays: stretchDays - i.usualDays,
    festiveTotal: round2(festiveTotal),
    schoolTotal: round2(schoolTotal),
    dayToDay: round2(dayToDay),
    dailyAllowance: round2(dailyAllowance),
    setAside: Math.ceil(setAside / 10) * 10,
    januaryDays,
    breakdown: [
      { key: 'commitments', label: 'Debit orders & bills', amount: round2(i.commitments) },
      { key: 'festive', label: 'Festive season', amount: round2(festiveTotal) },
      { key: 'school', label: 'Back to school', amount: round2(schoolTotal) },
      { key: 'daytoday', label: 'Day-to-day', amount: round2(Math.max(0, dayToDay)) },
    ],
  }
}

/** Whether the Survive January card shows today (content window, e.g. 1 Nov – 15 Jan). */
export function inJanuaryWindow(today: Date, window: { start: string; end: string }): boolean {
  const md = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  // The window wraps the year end when start > end.
  return window.start <= window.end ? md >= window.start && md <= window.end : md >= window.start || md <= window.end
}
