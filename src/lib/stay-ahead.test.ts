import { describe, expect, it } from 'vitest'
import { makeExpense, makeSpendEntry } from '@/test/factories'
import {
  autoCheckins,
  challengeNotice,
  dayPasses,
  fiftyTwoWeekTotal,
  nextWeekend,
  progress,
  streak,
  weekAmount,
  type Challenge,
  type Checkin,
} from './challenges'
import { resolveContent, staleContent, taxTableFrom, transferDuty, validateTaxTable } from './content'
import { CONTENT_DEFAULTS } from './content-defaults'
import { comingUp, contractNudge, eventImpact, increaseChip, priceNotices, renewalNotices, type PriceEvent, type Renewal } from './stay-ahead'
import { TAX_TABLES } from './tax/tax-tables'

describe('content (Rule 24)', () => {
  it('empty / missing content → every bundled default', () => {
    const c = resolveContent({})
    expect(c.prime_rate).toEqual(CONTENT_DEFAULTS.prime_rate)
    expect(c.invalid).toEqual([])
    expect(resolveContent(null).tfsa_limits.annual).toBe(46_000)
  })

  it('a valid published value wins', () => {
    expect(resolveContent({ prime_rate: { rate: 10.5, effective: '2026-11-20' } }).prime_rate.rate).toBe(10.5)
  })

  it('a malformed value is ignored and reported', () => {
    const c = resolveContent({ prime_rate: { rate: 'eleven' }, fuel_prices: { petrol95: { inland: 999 } }, assistant_daily_cap: '25' })
    expect(c.prime_rate).toEqual(CONTENT_DEFAULTS.prime_rate)
    expect(c.fuel_prices).toEqual(CONTENT_DEFAULTS.fuel_prices)
    expect(c.assistant_daily_cap).toBe(25)
    expect(c.invalid.sort()).toEqual(['fuel_prices', 'prime_rate'])
  })

  it('transfer duty brackets must ascend', () => {
    const c = resolveContent({ transfer_duty: { brackets: [{ above: 0, base: 0, rate: 0 }, { above: 0, base: 0, rate: 0.03 }] } })
    expect(c.invalid).toContain('transfer_duty')
  })

  it('transfer duty from the SARS table', () => {
    const b = CONTENT_DEFAULTS.transfer_duty.brackets
    expect(transferDuty(1_000_000, b)).toBe(0)
    expect(transferDuty(2_000_000, b)).toBe(33_786)
    expect(transferDuty(3_000_000, b)).toBe(107_356)
  })

  it('tax tables: the bundled table validates; a gap is rejected; content path falls back', () => {
    expect(validateTaxTable(TAX_TABLES['2026/27'])).not.toBeNull()
    const broken = { ...TAX_TABLES['2026/27'], brackets: TAX_TABLES['2026/27'].brackets.map((b, i) => (i === 2 ? { ...b, above: b.above + 5 } : b)) }
    expect(validateTaxTable(broken)).toBeNull()
    expect(taxTableFrom({ 'tax_tables:2026/27': broken }, '2026/27')).toBe(TAX_TABLES['2026/27'])
    const tweaked = { ...TAX_TABLES['2026/27'], raDeductionCap: 450_000 }
    expect(taxTableFrom({ 'tax_tables:2026/27': tweaked }, '2026/27')?.raDeductionCap).toBe(450_000)
  })

  it('staleness', () => {
    expect(staleContent(CONTENT_DEFAULTS, new Date(2026, 11, 20))).toContain('Fuel prices are more than 35 days old')
    expect(staleContent(CONTENT_DEFAULTS, new Date(2026, 10, 9))).toEqual([])
  })
})

const event = (over: Partial<PriceEvent> = {}): PriceEvent => ({
  id: 'p1',
  kind: 'medical_aid',
  title: 'Medical aid contributions',
  description: '',
  effective_on: '2027-01-01',
  category: 'medical_aid',
  change_pct: 5,
  change_amount: null,
  change_unit: null,
  region: 'all',
  source_url: null,
  status: 'published',
  ...over,
})

describe('price impact', () => {
  it('acceptance: a 5% medical aid event shows only for people with medical aid', () => {
    expect(eventImpact(event(), [makeExpense({ category: 'medical_aid', amount: 3_000 })], 30)).toBe(150)
    expect(eventImpact(event(), [makeExpense({ category: 'groceries', amount: 3_000 })], 30)).toBeNull()
  })

  it('fuel c/l uses estimated litres from transport spend', () => {
    const fuel = event({ kind: 'fuel', category: 'transport', change_pct: null, change_amount: 80, change_unit: 'c/l' })
    // R3,000 ÷ R30/l = 100 l × R0.80 = R80
    expect(eventImpact(fuel, [makeExpense({ category: 'transport', amount: 3_000 })], 30)).toBe(80)
  })

  it('timeline merges renewals, published events and own increases within 90 days', () => {
    const renewal: Renewal = {
      id: 'r1',
      user_id: 'u',
      name: 'Car insurance',
      kind: 'insurance',
      provider: 'OUTsurance',
      amount: 900,
      frequency: 'monthly',
      renews_on: '2026-11-14',
      expense_id: null,
      reminder_days: 30,
      notes: null,
      ended_at: null,
      created_at: '',
      updated_at: '',
    }
    const items = comingUp({
      renewals: [renewal],
      events: [event(), event({ id: 'p2', status: 'draft' })],
      expenses: [makeExpense({ category: 'medical_aid', amount: 3_000 }), makeExpense({ name: 'Rent', category: 'housing', amount: 9_000, increase_month: 1, increase_pct: 8 })],
      fuelPrice: 30,
      today: new Date(2026, 10, 9),
    })
    expect(items.map((i) => i.type)).toEqual(['renewal', 'price', 'increase'])
    expect(items[2].amount).toBe(720)
  })

  it('increase chip', () => {
    expect(increaseChip({ increase_month: 1, increase_pct: 9 })).toBe('↑ Jan ~9%')
    expect(increaseChip({ increase_month: null, increase_pct: null })).toBeNull()
  })

  it('renewal reminders at 30 and 7 days; contract nudge', () => {
    const r: Renewal = {
      id: 'r1', user_id: 'u', name: 'Vodacom contract', kind: 'contract', provider: 'Vodacom', amount: 499, frequency: 'monthly',
      renews_on: '2026-12-09', expense_id: null, reminder_days: 30, notes: null, ended_at: null, created_at: '', updated_at: '',
    }
    expect(renewalNotices(r, new Date(2026, 10, 9))).toHaveLength(1)
    expect(renewalNotices(r, new Date(2026, 11, 2))).toHaveLength(1)
    expect(renewalNotices(r, new Date(2026, 10, 10))).toHaveLength(0)
    expect(contractNudge(r, new Date(2026, 10, 9))).toContain('SIM-only')
  })

  it('price notices 7 days before, only if it affects you', () => {
    const fmt = (n: number) => `R${n}`
    expect(priceNotices(event(), [makeExpense({ category: 'medical_aid', amount: 3_000 })], 30, new Date(2026, 11, 25), fmt)[0].body).toContain('R150 more')
    expect(priceNotices(event(), [], 30, new Date(2026, 11, 25), fmt)).toHaveLength(0)
  })
})

const challenge = (over: Partial<Challenge> = {}): Challenge => ({
  id: 'c1',
  user_id: 'u',
  kind: 'no_spend_weekend',
  title: 'No-spend weekend',
  starts_on: '2026-11-14',
  ends_on: '2026-11-15',
  settings: {},
  goal_id: null,
  status: 'active',
  created_at: '',
  updated_at: '',
  ...over,
})

describe('challenges', () => {
  it('acceptance: no discretionary entries on Sat–Sun auto-ticks both days', () => {
    const entries = [makeSpendEntry({ category: 'groceries', amount: 300, spent_at: new Date(2026, 10, 14, 11).toISOString() })]
    expect(autoCheckins(challenge(), [], entries, new Date(2026, 10, 16), true)).toEqual([
      { day: '2026-11-14', success: true },
      { day: '2026-11-15', success: true },
    ])
  })

  it('acceptance: one Eating out entry breaks it', () => {
    const entries = [makeSpendEntry({ category: 'eating_out', amount: 180, spent_at: new Date(2026, 10, 15, 19).toISOString() })]
    expect(autoCheckins(challenge(), [], entries, new Date(2026, 10, 16), true)[1]).toEqual({ day: '2026-11-15', success: false })
  })

  it('no auto-checks without logging, for today, or for manual kinds', () => {
    expect(autoCheckins(challenge(), [], [], new Date(2026, 10, 16), false)).toEqual([])
    expect(autoCheckins(challenge(), [], [], new Date(2026, 10, 15), true)).toHaveLength(1)
    expect(autoCheckins(challenge({ kind: 'custom' }), [], [], new Date(2026, 10, 16), true)).toEqual([])
  })

  it('cook at home only breaks on eating out', () => {
    expect(dayPasses('cook_at_home', '2026-11-14', [makeSpendEntry({ category: 'coffee_drinks', spent_at: new Date(2026, 10, 14, 9).toISOString() })])).toBe(true)
  })

  it('52-week amounts', () => {
    expect(weekAmount(1)).toBe(10)
    expect(weekAmount(52)).toBe(520)
    expect(weekAmount(1, 10, true)).toBe(520)
    expect(fiftyTwoWeekTotal()).toBe(13_780)
  })

  it('streak and progress', () => {
    const k = (day: string, success: boolean, amount = 0): Checkin => ({ id: day, challenge_id: 'c1', user_id: 'u', day, success, amount_saved: amount, auto: false })
    expect(streak([k('2026-11-14', false), k('2026-11-15', true), k('2026-11-16', true)])).toBe(2)
    expect(progress(challenge(), [k('2026-11-14', true, 50)])).toEqual({ done: 1, total: 2, fraction: 0.5, saved: 50 })
  })

  it('next weekend and the morning notice', () => {
    expect(nextWeekend(new Date(2026, 10, 9))).toEqual({ start: '2026-11-14', end: '2026-11-15' })
    expect(nextWeekend(new Date(2026, 10, 15))).toEqual({ start: '2026-11-14', end: '2026-11-15' })
    expect(challengeNotice(challenge(), new Date(2026, 10, 15))?.body).toBe('Day 2 of No-spend weekend — keep it going.')
  })
})
