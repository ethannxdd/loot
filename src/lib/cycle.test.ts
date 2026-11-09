import { describe, expect, it } from 'vitest'
import {
  adjustedPayday,
  cycleFor,
  cycleForKey,
  cycleForMonth,
  cycleMonthLabel,
  cyclesBack,
  inCycle,
  nextCycle,
  PAYDAY_RULES,
  type PaydaySettings,
} from './cycle'
import { addDays, dateKey, isWorkingDay } from './sa-calendar'

const s = (payday_day: number | null, payday_rule: PaydaySettings['payday_rule'] = 'previous_working_day'): PaydaySettings => ({
  payday_day,
  payday_rule,
})

describe('calendar months (no payday set)', () => {
  it('matches the calendar month exactly', () => {
    const c = cycleFor(new Date(2026, 9, 26), s(null))
    expect(c.calendar).toBe(true)
    expect(c.key).toBe('2026-10-01')
    expect(dateKey(c.start)).toBe('2026-10-01')
    expect(dateKey(c.end)).toBe('2026-10-31')
    expect(c.daysTotal).toBe(31)
    expect(c.daysLeft).toBe(6)
    expect(c.label).toBe('October 2026')
  })

  it('null settings behave like no payday', () => {
    expect(cycleFor(new Date(2027, 1, 10), null).key).toBe('2027-02-01')
    expect(cycleFor(new Date(2028, 1, 29), undefined).daysTotal).toBe(29)
  })

  it('last day of the month has 1 day left', () => {
    expect(cycleFor(new Date(2026, 10, 30), null).daysLeft).toBe(1)
  })
})

describe('D5 example — payday 25th, previous working day', () => {
  const settings = s(25)

  it('Oct 2026: paid Fri 23 Oct (25th is a Sunday), runs to Tue 24 Nov', () => {
    const c = cycleFor(new Date(2026, 9, 26), settings)
    expect(c.key).toBe('2026-10-01')
    expect(dateKey(c.start)).toBe('2026-10-23')
    expect(dateKey(c.end)).toBe('2026-11-24')
    expect(c.daysTotal).toBe(33)
    expect(c.label).toBe('Oct pay · 23 Oct – 24 Nov')
    expect(c.shortLabel).toBe('Oct pay')
  })

  it('the day before payday belongs to the previous cycle', () => {
    const c = cycleFor(new Date(2026, 9, 22), settings)
    expect(c.key).toBe('2026-09-01')
    expect(dateKey(c.end)).toBe('2026-10-22')
  })

  it('today = payday starts the new cycle with all days left', () => {
    const c = cycleFor(new Date(2026, 9, 23), settings)
    expect(c.key).toBe('2026-10-01')
    expect(c.daysLeft).toBe(c.daysTotal)
  })

  it('today = last day has 1 day left', () => {
    expect(cycleFor(new Date(2026, 10, 24), settings).daysLeft).toBe(1)
  })

  it('Dec 2026: Christmas on the 25th → paid Thu 24 Dec', () => {
    const c = cycleForMonth(2026, 11, settings)
    expect(dateKey(c.start)).toBe('2026-12-24')
    expect(dateKey(c.end)).toBe('2027-01-24') // Jan 25 2027 is a Monday
    expect(c.key).toBe('2026-12-01')
  })

  it('Apr 2027: 25th is a Sunday → Fri 23 Apr, then Tue 25 May', () => {
    const c = cycleForMonth(2027, 3, settings)
    expect(dateKey(c.start)).toBe('2027-04-23')
    expect(dateKey(c.end)).toBe('2027-05-24')
  })

  it('crosses the year: 2 Jan 2027 is in the Dec 2026 cycle', () => {
    expect(cycleFor(new Date(2027, 0, 2), settings).key).toBe('2026-12-01')
  })
})

describe('rules', () => {
  it('next_working_day moves forward', () => {
    expect(dateKey(adjustedPayday(2026, 9, s(25, 'next_working_day'))!)).toBe('2026-10-26')
    // 31 Jan 2026 is a Saturday → Monday 2 Feb, which can land in the following month
    const p = adjustedPayday(2026, 0, s(31, 'next_working_day'))!
    expect(dateKey(p)).toBe('2026-02-02')
    // 1 Feb is then still in the December cycle
    expect(cycleFor(new Date(2026, 1, 1), s(31, 'next_working_day')).key).toBe('2025-12-01')
    expect(cycleFor(new Date(2026, 1, 2), s(31, 'next_working_day')).key).toBe('2026-01-01')
  })

  it('exact keeps weekends and holidays', () => {
    expect(dateKey(adjustedPayday(2026, 9, s(25, 'exact'))!)).toBe('2026-10-25')
    expect(dateKey(adjustedPayday(2026, 11, s(25, 'exact'))!)).toBe('2026-12-25')
  })

  it('last_working_day ignores payday_day', () => {
    expect(dateKey(adjustedPayday(2026, 9, s(1, 'last_working_day'))!)).toBe('2026-10-30')
    expect(dateKey(adjustedPayday(2026, 11, s(15, 'last_working_day'))!)).toBe('2026-12-31')
  })

  it('previous_working_day on the 1st can fall in the previous month', () => {
    // 1 Jan 2027 is a holiday (Friday) → Thursday 31 Dec 2026
    expect(dateKey(adjustedPayday(2027, 0, s(1))!)).toBe('2026-12-31')
    expect(cycleFor(new Date(2026, 11, 31), s(1)).key).toBe('2027-01-01')
  })
})

describe('29/30/31 clamps and leap years', () => {
  it('31st clamps to the month length', () => {
    expect(dateKey(adjustedPayday(2026, 10, s(31, 'exact'))!)).toBe('2026-11-30')
    expect(dateKey(adjustedPayday(2027, 1, s(31, 'exact'))!)).toBe('2027-02-28')
    expect(dateKey(adjustedPayday(2028, 1, s(31, 'exact'))!)).toBe('2028-02-29')
    expect(dateKey(adjustedPayday(2028, 1, s(30, 'exact'))!)).toBe('2028-02-29')
    expect(dateKey(adjustedPayday(2027, 1, s(29, 'exact'))!)).toBe('2027-02-28')
  })

  it('31st with previous working day', () => {
    // 28 Feb 2027 is a Sunday → Fri 26 Feb
    expect(dateKey(adjustedPayday(2027, 1, s(31))!)).toBe('2027-02-26')
  })
})

describe('exhaustive invariants 2026–2028', () => {
  for (const rule of PAYDAY_RULES) {
    for (const day of [1, 15, 25, 28, 29, 30, 31]) {
      it(`${rule} on day ${day}: cycles tile the calendar with no gaps or overlaps`, () => {
        const settings = s(day, rule)
        for (let i = 0; i < 36; i++) {
          const c = cycleForMonth(2026, i, settings)
          const next = cycleForMonth(2026, i + 1, settings)
          expect(dateKey(addDays(c.end, 1))).toBe(dateKey(next.start))
          expect(c.daysTotal).toBeGreaterThanOrEqual(26)
          expect(c.daysTotal).toBeLessThanOrEqual(36)
          if (rule !== 'exact') expect(isWorkingDay(c.start)).toBe(true)
          // Every day of the cycle maps back to it.
          for (let d = 0; d < c.daysTotal; d++) {
            expect(cycleFor(addDays(c.start, d), settings).key).toBe(c.key)
          }
        }
      })
    }
  }
})

describe('helpers', () => {
  const settings = s(25)

  it('cyclesBack returns newest first', () => {
    const list = cyclesBack(3, settings, new Date(2026, 9, 26))
    expect(list.map((c) => c.key)).toEqual(['2026-10-01', '2026-09-01', '2026-08-01'])
    expect(list[1].daysLeft).toBe(0)
  })

  it('nextCycle', () => {
    expect(nextCycle(settings, new Date(2026, 9, 26)).key).toBe('2026-11-01')
  })

  it('cycleForKey', () => {
    expect(dateKey(cycleForKey('2026-12-01', settings).start)).toBe('2026-12-24')
  })

  it('inCycle includes the whole last day', () => {
    const c = cycleForMonth(2026, 9, settings)
    expect(inCycle(new Date(2026, 10, 24, 23, 59), c)).toBe(true)
    expect(inCycle(new Date(2026, 10, 25, 0, 0), c)).toBe(false)
    expect(inCycle(new Date(2026, 9, 23, 0, 0), c)).toBe(true)
    expect(inCycle(new Date(2026, 9, 22, 23, 59).toISOString(), c)).toBe(false)
  })

  it('cycleMonthLabel', () => {
    expect(cycleMonthLabel('2026-10-01', settings)).toBe('Oct pay')
    expect(cycleMonthLabel('2026-10-01', null)).toBe('Oct 2026')
  })
})
