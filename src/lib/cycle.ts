import { addDays, lastWorkingDay, nextWorkingDay, previousWorkingDay, startOfDay } from './sa-calendar'

/**
 * Business Rule 18 — the Loot cycle (payday to the day before the next payday).
 *
 * `payday_day` null → calendar months, exactly as Loot worked before Phase 6. Otherwise the cycle starts on the
 * adjusted payday in month M and ends the day before the adjusted payday in month M+1. The cycle key stays
 * 'YYYY-MM-01' of M (the month you were paid in — D5), so snapshots, closes and charts keep working unchanged.
 */

export const PAYDAY_RULES = ['previous_working_day', 'next_working_day', 'exact', 'last_working_day'] as const
export type PaydayRule = (typeof PAYDAY_RULES)[number]

export const PAYDAY_RULE_LABELS: Record<Exclude<PaydayRule, 'last_working_day'>, string> = {
  previous_working_day: 'Day before',
  next_working_day: 'Day after',
  exact: 'Exact day',
}

export interface PaydaySettings {
  payday_day: number | null
  payday_rule: PaydayRule | string | null
}

export interface Cycle {
  /** 'YYYY-MM-01' of the month the cycle's payday falls in (or the calendar month). */
  key: string
  /** First day (local midnight). */
  start: Date
  /** Last day (local midnight) — inclusive. */
  end: Date
  daysTotal: number
  /** Days left including `today`; 0 when `today` is outside the cycle (a past cycle). */
  daysLeft: number
  /** True when the user has no payday set — the cycle is a calendar month. */
  calendar: boolean
  /** "Oct pay · 23 Oct – 24 Nov" (or "October 2026" for calendar months). */
  label: string
  /** "Oct pay" / "Oct" — compact chart / picker label. */
  shortLabel: string
  /** "23 Oct – 24 Nov". */
  rangeLabel: string
}

const MS_PER_DAY = 86_400_000

function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY)
}

function monthKey(year: number, month: number): string {
  const d = new Date(year, month, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function hasPayday(settings: PaydaySettings | null | undefined): settings is PaydaySettings & { payday_day: number } {
  return Boolean(settings && settings.payday_day != null && settings.payday_day >= 1 && settings.payday_day <= 31)
}

/**
 * The real payday in a month (month is 0-based): `payday_day` clamped to the month's length, then moved by the rule.
 * 'last_working_day' ignores payday_day. Returns null for calendar-month users.
 */
export function adjustedPayday(year: number, month: number, settings: PaydaySettings): Date | null {
  if (!hasPayday(settings)) return null
  const y = new Date(year, month, 1).getFullYear()
  const m = new Date(year, month, 1).getMonth()
  if (settings.payday_rule === 'last_working_day') return lastWorkingDay(y, m)
  const length = new Date(y, m + 1, 0).getDate()
  const nominal = new Date(y, m, Math.min(settings.payday_day, length))
  switch (settings.payday_rule) {
    case 'next_working_day':
      return nextWorkingDay(nominal)
    case 'exact':
      return nominal
    case 'previous_working_day':
    default:
      return previousWorkingDay(nominal)
  }
}

const fmtDay = (d: Date) => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
const fmtMonthShort = (year: number, month: number) => new Date(year, month, 1).toLocaleDateString('en-ZA', { month: 'short' })

function build(start: Date, end: Date, year: number, month: number, calendar: boolean, today: Date): Cycle {
  const t = startOfDay(today)
  const inside = t.getTime() >= start.getTime() && t.getTime() <= end.getTime()
  const rangeLabel = `${fmtDay(start)} – ${fmtDay(end)}`
  const shortLabel = calendar ? fmtMonthShort(year, month) : `${fmtMonthShort(year, month)} pay`
  const label = calendar
    ? new Date(year, month, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
    : `${shortLabel} · ${rangeLabel}`
  return {
    key: monthKey(year, month),
    start,
    end,
    daysTotal: daysBetween(start, end) + 1,
    daysLeft: inside ? daysBetween(t, end) + 1 : t.getTime() < start.getTime() ? daysBetween(start, end) + 1 : 0,
    calendar,
    label,
    shortLabel,
    rangeLabel,
  }
}

/** The cycle whose payday falls in month `month` of `year` (0-based month; overflow allowed, e.g. -1 or 12). */
export function cycleForMonth(year: number, month: number, settings: PaydaySettings | null | undefined, today = new Date()): Cycle {
  const y = new Date(year, month, 1).getFullYear()
  const m = new Date(year, month, 1).getMonth()
  if (!hasPayday(settings)) {
    return build(new Date(y, m, 1), new Date(y, m + 1, 0), y, m, true, today)
  }
  const start = adjustedPayday(y, m, settings)!
  const end = addDays(adjustedPayday(y, m + 1, settings)!, -1)
  return build(start, end, y, m, false, today)
}

/** The cycle that contains `date`. */
export function cycleFor(date: Date, settings: PaydaySettings | null | undefined, today = date): Cycle {
  const d = startOfDay(date)
  if (!hasPayday(settings)) return cycleForMonth(d.getFullYear(), d.getMonth(), settings, today)
  // Paydays only move a few days either side of their month, so the containing cycle's month is within ±1.
  for (let offset = 1; offset >= -2; offset--) {
    const payday = adjustedPayday(d.getFullYear(), d.getMonth() + offset, settings)!
    if (payday.getTime() <= d.getTime()) return cycleForMonth(d.getFullYear(), d.getMonth() + offset, settings, today)
  }
  // Unreachable in practice — fall back to the calendar month.
  return cycleForMonth(d.getFullYear(), d.getMonth(), null, today)
}

/** The cycle for a 'YYYY-MM-01' key. */
export function cycleForKey(key: string, settings: PaydaySettings | null | undefined, today = new Date()): Cycle {
  const [y, m] = key.split('-').map(Number)
  return cycleForMonth(y, m - 1, settings, today)
}

/** The current cycle and the `n - 1` before it, newest first. */
export function cyclesBack(n: number, settings: PaydaySettings | null | undefined, today = new Date()): Cycle[] {
  const current = cycleFor(today, settings, today)
  const [y, m] = current.key.split('-').map(Number)
  return Array.from({ length: Math.max(0, n) }, (_, i) => cycleForMonth(y, m - 1 - i, settings, today))
}

/** The next cycle after the one containing `today`. */
export function nextCycle(settings: PaydaySettings | null | undefined, today = new Date()): Cycle {
  const current = cycleFor(today, settings, today)
  const [y, m] = current.key.split('-').map(Number)
  return cycleForMonth(y, m, settings, today)
}

/** True when `at` (a timestamp) falls inside the cycle (inclusive of the whole last day). */
export function inCycle(at: Date | string, cycle: Pick<Cycle, 'start' | 'end'>): boolean {
  const t = (typeof at === 'string' ? new Date(at) : at).getTime()
  return t >= cycle.start.getTime() && t < addDays(cycle.end, 1).getTime()
}

/** A compact label for a snapshot month key, cycle-aware ("Oct pay" or "Oct 2026"). */
export function cycleMonthLabel(key: string, settings: PaydaySettings | null | undefined): string {
  const [y, m] = key.split('-').map(Number)
  if (!hasPayday(settings)) {
    return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })
  }
  return `${fmtMonthShort(y, m - 1)} pay`
}

// ---------------------------------------------------------------------------------------------------------
// Payday picker values (Settings, onboarding, the Summary prompt)
// ---------------------------------------------------------------------------------------------------------

export interface PaydayValue {
  /** 1–31, or null for "not set" (calendar months). Ignored when the rule is last_working_day. */
  day: number | null
  rule: PaydayRule
}

export const DEFAULT_PAYDAY: PaydayValue = { day: 25, rule: 'previous_working_day' }

/** What to save on the profile for a picked value. Last working day stores 31 so payday_day is never null. */
export function paydayPatch(v: PaydayValue): { payday_day: number | null; payday_rule: PaydayRule } {
  if (v.rule === 'last_working_day') return { payday_day: 31, payday_rule: 'last_working_day' }
  return { payday_day: v.day, payday_rule: v.rule }
}

export function paydayValueFrom(settings: Partial<PaydaySettings> | null | undefined): PaydayValue {
  if (!settings || settings.payday_day == null) return { day: null, rule: 'previous_working_day' }
  const rule = (settings.payday_rule as PaydayRule) ?? 'previous_working_day'
  return { day: settings.payday_day, rule }
}

/** "This cycle: 23 Oct – 24 Nov (33 days)" for a picked value. */
export function paydayPreview(v: PaydayValue, today = new Date()): string {
  const patch = paydayPatch(v)
  if (patch.payday_day == null) return `Calendar months: ${cycleFor(today, null).rangeLabel}`
  const c = cycleFor(today, patch)
  return `This cycle: ${c.rangeLabel} (${c.daysTotal} days)`
}
