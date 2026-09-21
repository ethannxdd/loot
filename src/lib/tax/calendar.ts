import { parseDateOnly } from '@/lib/goal-math'

export interface TaxCalendarEntry {
  id: string
  label: string
  date: string // ISO date (local calendar)
  description: string
  /** Only relevant to provisional taxpayers. */
  provisionalOnly?: boolean
  /** Only relevant to everyone else — provisional taxpayers file by a later deadline. */
  nonProvisionalOnly?: boolean
}

/**
 * Gazetted SARS filing-season dates. SARS re-gazettes these every year and they don't follow a fixed formula —
 * update them each year from sars.gov.za's "Filing Season" notice (usually published around June).
 * The fixed statutory dates (provisional payments, tax-year end) are computed dynamically below.
 */
export const FILING_SEASON_DATES: TaxCalendarEntry[] = [
  {
    id: 'non-provisional-deadline-2026',
    label: 'Non-provisional taxpayer filing deadline',
    date: '2026-10-23',
    description: "Deadline to submit your 2025/26 return if you're not a provisional taxpayer.",
    nonProvisionalOnly: true,
  },
  {
    id: 'provisional-deadline-2027',
    label: 'Provisional taxpayer filing deadline',
    date: '2027-01-22',
    description: 'Final deadline to submit your 2025/26 return via eFiling if you are a provisional taxpayer.',
    provisionalOnly: true,
  },
]

function isoOf(year: number, monthIndex: number, day: number) {
  const d = new Date(year, monthIndex, day)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Days from today (local) until a local calendar date; 0 = today, negative = past. */
function daysUntil(dateIso: string, from = new Date()) {
  const target = parseDateOnly(dateIso)
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

/** The next occurrence (from two weeks ago onwards) of a yearly recurring date. */
function nextYearly(id: string, from: Date, monthIndex: number, day: number, rest: Omit<TaxCalendarEntry, 'id' | 'date'>): TaxCalendarEntry {
  const candidates = [from.getFullYear() - 1, from.getFullYear(), from.getFullYear() + 1].map((y) => ({
    year: y,
    date: isoOf(y, monthIndex, day),
  }))
  const pick = candidates.find((c) => daysUntil(c.date, from) > -14) ?? candidates[candidates.length - 1]
  return { id: `${id}-${pick.year}`, date: pick.date, ...rest }
}

/** Fixed statutory dates — never change with the gazette. Day 0 of March is the last day of February. */
function statutoryDates(from: Date): TaxCalendarEntry[] {
  const feb = (y: number) => new Date(y, 2, 0).getDate()
  const febEntry = (() => {
    const y0 = from.getFullYear()
    const candidates = [y0, y0 + 1].map((y) => isoOf(y, 1, feb(y)))
    const date = candidates.find((c) => daysUntil(c, from) > -14) ?? candidates[1]
    return {
      id: `tax-year-end-${date.slice(0, 4)}`,
      date,
      label: 'Tax year ends · 2nd provisional payment',
      description:
        'Last day to make retirement annuity contributions and donations that count for this tax year. Provisional taxpayers also pay their second provisional payment.',
    } satisfies TaxCalendarEntry
  })()
  return [
    nextYearly('prov-1', from, 7, 31, {
      label: '1st provisional payment',
      description: 'First provisional tax payment (IRP6) for the tax year — half of your estimated tax.',
      provisionalOnly: true,
    }),
    febEntry,
    nextYearly('prov-topup', from, 8, 30, {
      label: 'Optional top-up payment',
      description:
        'Provisional taxpayers who under-estimated can pay a third, top-up payment by 30 September to avoid interest and penalties.',
      provisionalOnly: true,
    }),
  ]
}

export interface CalendarCountdown extends TaxCalendarEntry {
  daysUntil: number
  urgency: 'past' | 'soon' | 'upcoming' | 'far'
}

export function getCalendarWithCountdowns(from = new Date(), isProvisional = false): CalendarCountdown[] {
  return [...FILING_SEASON_DATES, ...statutoryDates(from)]
    .filter((e) => (isProvisional ? !e.nonProvisionalOnly : !e.provisionalOnly))
    .map((entry) => {
      const d = daysUntil(entry.date, from)
      const urgency: CalendarCountdown['urgency'] = d < 0 ? 'past' : d <= 30 ? 'soon' : d <= 90 ? 'upcoming' : 'far'
      return { ...entry, daysUntil: d, urgency }
    })
    .filter((e) => e.daysUntil > -14) // hide dates more than 2 weeks in the past
    .sort((a, b) => a.daysUntil - b.daysUntil)
}
