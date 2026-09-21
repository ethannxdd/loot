export interface TaxCalendarEntry {
  id: string
  label: string
  date: string // ISO date
  description: string
}

/**
 * Gazetted SARS dates for the current filing cycle (Sept 2026). SARS re-gazettes
 * filing-season deadlines every year and they don't follow a fixed formula —
 * update these each year from sars.gov.za's "Filing Season" notice.
 * Provisional tax dates (31 Aug / end Feb) are fixed by statute and computed dynamically.
 */
export const FILING_SEASON_DATES: TaxCalendarEntry[] = [
  {
    id: 'non-provisional-deadline-2026',
    label: 'Non-provisional taxpayer filing deadline',
    date: '2026-10-23',
    description: "Deadline to submit your 2025/26 return if you're not a provisional taxpayer.",
  },
  {
    id: 'provisional-deadline-2027',
    label: 'Provisional taxpayer filing deadline',
    date: '2027-01-22',
    description: 'Final deadline to submit your 2025/26 return via eFiling if you are a provisional taxpayer.',
  },
]

function daysUntil(dateIso: string, from = new Date()) {
  const target = new Date(dateIso)
  return Math.ceil((target.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

export interface CalendarCountdown extends TaxCalendarEntry {
  daysUntil: number
  urgency: 'past' | 'soon' | 'upcoming' | 'far'
}

export function getCalendarWithCountdowns(from = new Date()): CalendarCountdown[] {
  return FILING_SEASON_DATES.map((entry) => {
    const d = daysUntil(entry.date, from)
    const urgency: CalendarCountdown['urgency'] = d < 0 ? 'past' : d <= 30 ? 'soon' : d <= 90 ? 'upcoming' : 'far'
    return { ...entry, daysUntil: d, urgency }
  })
    .filter((e) => e.daysUntil > -14) // hide dates more than 2 weeks in the past
    .sort((a, b) => a.daysUntil - b.daysUntil)
}
