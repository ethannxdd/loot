import { describe, expect, it } from 'vitest'
import {
  dateKey,
  easterSunday,
  isPublicHoliday,
  isWorkingDay,
  lastWorkingDay,
  nextWorkingDay,
  previousWorkingDay,
  publicHolidays,
} from './sa-calendar'

const keys = (year: number) => publicHolidays(year).map((h) => dateKey(h.date))

describe('easterSunday', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
  ])('%i → %s', (year, expected) => {
    expect(dateKey(easterSunday(year))).toBe(expected)
  })
})

describe('publicHolidays', () => {
  it('2026 — gazetted list incl. Sunday → Monday', () => {
    expect(keys(2026)).toEqual([
      '2026-01-01',
      '2026-03-21', // Saturday — no Monday replacement
      '2026-04-03', // Good Friday
      '2026-04-06', // Family Day
      '2026-04-27',
      '2026-05-01',
      '2026-06-16',
      '2026-08-09', // Sunday
      '2026-08-10', // observed
      '2026-09-24',
      '2026-12-16',
      '2026-12-25',
      '2026-12-26',
    ])
  })

  it('2027 — Human Rights Day on Sunday and Christmas/Goodwill weekend', () => {
    const k = keys(2027)
    expect(k).toContain('2027-03-21')
    expect(k).toContain('2027-03-22') // observed Monday
    expect(k).toContain('2027-03-26') // Good Friday
    expect(k).toContain('2027-03-29') // Family Day
    expect(k).toContain('2027-12-25') // Saturday — no replacement
    expect(k).toContain('2027-12-26') // Sunday
    expect(k).toContain('2027-12-27') // observed Monday
    expect(k).toHaveLength(14)
  })

  it('2028 — Good Friday / Family Day and Freedom Day', () => {
    const k = keys(2028)
    expect(k).toContain('2028-04-14')
    expect(k).toContain('2028-04-17')
    expect(k).toContain('2028-04-27')
    expect(k).toContain('2028-01-01') // Saturday
    expect(k).not.toContain('2028-01-03')
  })

  it('Christmas on a Sunday pushes the extra day past Goodwill (2022 → Tue 27 Dec)', () => {
    const k = keys(2022)
    expect(k).toContain('2022-12-25')
    expect(k).toContain('2022-12-26')
    expect(k).toContain('2022-12-27')
  })
})

describe('working days', () => {
  it('weekends and holidays are not working days', () => {
    expect(isWorkingDay(new Date(2026, 9, 24))).toBe(false) // Saturday
    expect(isWorkingDay(new Date(2026, 9, 25))).toBe(false) // Sunday
    expect(isWorkingDay(new Date(2026, 11, 16))).toBe(false) // Wed holiday
    expect(isWorkingDay(new Date(2026, 9, 23))).toBe(true)
    expect(isPublicHoliday(new Date(2026, 7, 10))).toBe(true)
  })

  it('previous / next working day skip weekends and holidays', () => {
    expect(dateKey(previousWorkingDay(new Date(2026, 9, 25)))).toBe('2026-10-23')
    expect(dateKey(nextWorkingDay(new Date(2026, 9, 25)))).toBe('2026-10-26')
    // Christmas Fri 25 + Goodwill Sat 26 + Sun 27 2026 → previous is Thu 24, next is Mon 28
    expect(dateKey(previousWorkingDay(new Date(2026, 11, 27)))).toBe('2026-12-24')
    expect(dateKey(nextWorkingDay(new Date(2026, 11, 25)))).toBe('2026-12-28')
    // Easter weekend 2027
    expect(dateKey(previousWorkingDay(new Date(2027, 2, 29)))).toBe('2027-03-25')
  })

  it('lastWorkingDay', () => {
    expect(dateKey(lastWorkingDay(2026, 9))).toBe('2026-10-30') // 31 Oct is a Saturday
    expect(dateKey(lastWorkingDay(2026, 4))).toBe('2026-05-29') // 31 May Sunday, 30 Saturday
    expect(dateKey(lastWorkingDay(2027, 11))).toBe('2027-12-31')
    expect(dateKey(lastWorkingDay(2028, 1))).toBe('2028-02-29') // leap year, Tuesday
  })
})
