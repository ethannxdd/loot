import { describe, expect, it } from 'vitest'
import { makeSpendEntry } from '@/test/factories'
import { cycleFor } from './cycle'
import {
  amountsMismatch,
  balances,
  isSettled,
  knownPeople,
  requestMessage,
  settle,
  splitAmounts,
  splitReminders,
  type Split,
  type SplitShare,
} from './splits'
import { spendByCategory } from './spending'
import {
  contributionMonths,
  lateMonths,
  monthlyContribution,
  monthsToGo,
  nextContributionDate,
  paidInSoFar,
  payoutFor,
  stokvelNotices,
  type Stokvel,
  type StokvelPayment,
} from './stokvel'

const stokvel = (over: Partial<Stokvel> = {}): Stokvel => ({
  id: 'sv1',
  user_id: 'u',
  name: 'Kasi Club',
  type: 'rotating',
  contribution_amount: 1000,
  frequency: 'monthly',
  contribution_day: 5,
  start_month: '2027-01-01',
  member_count: 12,
  my_position: 4,
  payout_date: null,
  expected_interest_pct: null,
  expense_id: null,
  ended_at: null,
  created_at: '',
  updated_at: '',
  ...over,
})

const pay = (month: string, amount = 1000): StokvelPayment => ({
  id: month,
  stokvel_id: 'sv1',
  user_id: 'u',
  month,
  kind: 'contribution',
  amount,
  paid_on: month,
  created_at: '',
})

describe('stokvels', () => {
  it('acceptance: rotating R1,000 × 12, position 4, start Jan 2027 → Apr 2027, R12,000', () => {
    expect(payoutFor(stokvel())).toEqual({ month: '2027-04-01', date: null, amount: 12000, estimate: false })
  })

  it('monthly equivalents', () => {
    expect(monthlyContribution({ contribution_amount: 100, frequency: 'weekly' })).toBeCloseTo((100 * 52) / 12)
    expect(monthlyContribution({ contribution_amount: 100, frequency: 'fortnightly' })).toBeCloseTo((100 * 26) / 12)
  })

  it('savings type: contributions to the payout date plus simple interest', () => {
    const p = payoutFor(stokvel({ type: 'savings', my_position: null, payout_date: '2027-12-05', expected_interest_pct: 6 }))!
    // 11 months × R1,000 = 11,000 + 11,000 × 6% × (11/12/2)
    expect(p.month).toBe('2027-12-01')
    expect(p.amount).toBeCloseTo(11000 + 11000 * 0.06 * (11 / 24), 2)
    expect(p.estimate).toBe(true)
  })

  it('burial has no payout', () => {
    expect(payoutFor(stokvel({ type: 'burial' }))).toBeNull()
  })

  it('months to go and paid in', () => {
    expect(monthsToGo(stokvel(), new Date(2027, 0, 20))).toBe(3)
    expect(paidInSoFar([pay('2027-01-01'), pay('2027-02-01')])).toBe(2000)
  })

  it('next contribution date clamps and respects the start month', () => {
    expect(nextContributionDate(stokvel({ contribution_day: 31 }), new Date(2027, 1, 10))?.getDate()).toBe(28)
    expect(nextContributionDate(stokvel(), new Date(2026, 10, 9))?.toDateString()).toBe(new Date(2027, 0, 5).toDateString())
  })

  it('late months are past, unticked contribution months', () => {
    expect(lateMonths(stokvel(), [pay('2027-01-01')], new Date(2027, 3, 10))).toEqual(['2027-02-01', '2027-03-01'])
    expect(contributionMonths(stokvel(), '2027-03-01')).toHaveLength(3)
  })

  it('server notices: due in 3 days and payout month', () => {
    const fmt = (n: number) => `R${n}`
    const due = stokvelNotices(stokvel(), new Date(2027, 1, 2), fmt)
    expect(due.map((n) => n.title)).toEqual(['Kasi Club contribution due'])
    const payout = stokvelNotices(stokvel(), new Date(2027, 3, 1), fmt)
    expect(payout.some((n) => n.dedupe_key === 'stokvel_payout:sv1:2027-04-01')).toBe(true)
  })
})

const split = (over: Partial<Split> = {}): Split => ({
  id: 's1',
  user_id: 'u',
  title: 'Airbnb',
  total: 1200,
  spent_on: '2026-10-20',
  paid_by: 'me',
  payer_name: null,
  split_mode: 'equal',
  spend_entry_id: null,
  note: null,
  deleted_at: null,
  created_at: '',
  updated_at: '',
  ...over,
})

const share = (person: string, amount: number, over: Partial<SplitShare> = {}): SplitShare => ({
  id: `sh-${person}`,
  split_id: 's1',
  user_id: 'u',
  person_name: person,
  is_me: person === 'Me',
  amount,
  settled_amount: 0,
  settled_at: null,
  last_reminded_at: null,
  reminders_sent: 0,
  ...over,
})

describe('splits', () => {
  it('R100 three ways sums to R100.00 exactly', () => {
    const a = splitAmounts(100, 'equal', [0, 0, 0])
    expect(a).toEqual([33.34, 33.33, 33.33])
    expect(a.reduce((s, x) => s + Math.round(x * 100), 0)).toBe(10000)
  })

  it('shares mode uses largest remainder', () => {
    const a = splitAmounts(100, 'shares', [1, 1, 1, 2])
    expect(a.reduce((s, x) => s + Math.round(x * 100), 0)).toBe(10000)
    expect(a[3]).toBe(40)
  })

  it('amounts mode and mismatch', () => {
    expect(splitAmounts(100, 'amounts', [60, 40])).toEqual([60, 40])
    expect(amountsMismatch(100, [60, 30])).toBe(10)
  })

  it('acceptance: R1,200 four ways I paid; settling 3 × R300 nets my spend to R300', () => {
    const shares = ['Me', 'Thabo', 'Lerato', 'Sipho'].map((p, i) => share(p, splitAmounts(1200, 'equal', [0, 0, 0, 0])[i]))
    expect(balances([split()], shares).owedToMe).toBe(900)
    const today = new Date(2026, 10, 9)
    const cycle = cycleFor(today, { payday_day: 25, payday_rule: 'previous_working_day' }, today)
    const entries = [
      makeSpendEntry({ amount: 1200, category: 'travel_holidays', spent_at: new Date(2026, 9, 26).toISOString() }),
      ...[1, 2, 3].map((i) =>
        makeSpendEntry({ amount: -settle(shares[i], 300).applied, category: 'travel_holidays', source: 'split', spent_at: new Date(2026, 10, i).toISOString() }),
      ),
    ]
    expect(spendByCategory(entries, cycle).travel_holidays).toBe(300)
  })

  it('settle caps at what is outstanding and marks full settlement', () => {
    const s = share('Thabo', 300)
    expect(settle(s, 100)).toMatchObject({ settled_amount: 100, settled_at: null, applied: 100 })
    const full = settle({ ...s, settled_amount: 100 }, 500)
    expect(full.applied).toBe(200)
    expect(full.settled_at).not.toBeNull()
  })

  it('someone else paid → I owe', () => {
    const b = balances([split({ paid_by: 'other', payer_name: 'Naledi' })], [share('Me', 400), share('Thabo', 400)])
    expect(b.iOwe).toBe(400)
    expect(b.owedToMe).toBe(0)
    expect(b.people[0]).toMatchObject({ person: 'Naledi', iOwe: 400 })
  })

  it('isSettled', () => {
    const shares = [share('Me', 600), share('Thabo', 600, { settled_amount: 600 })]
    expect(isSettled(split(), shares)).toBe(true)
    expect(isSettled(split(), [share('Me', 600), share('Thabo', 600)])).toBe(false)
  })

  it('request message', () => {
    expect(requestMessage('Thabo Nkosi', 'Airbnb', 'R 300', '082@capitec')).toBe(
      'Hi Thabo — your share for Airbnb is R 300. PayShap: 082@capitec. Thanks!',
    )
    expect(requestMessage('Thabo', 'Airbnb', 'R 300', null)).toBe('Hi Thabo — your share for Airbnb is R 300. Thanks!')
  })

  it('known people', () => {
    expect(knownPeople([share('Thabo', 1), share('thabo', 1), share('Me', 1), share('Lerato', 1)])).toEqual(['Thabo', 'Lerato'])
  })

  it('reminders: after 7 days, weekly, at most 3', () => {
    const today = new Date(2026, 10, 9)
    const fmt = (n: number) => `R${n}`
    expect(splitReminders([split()], [share('Thabo', 300)], today, fmt)).toHaveLength(1)
    expect(splitReminders([split({ spent_on: '2026-11-05' })], [share('Thabo', 300)], today, fmt)).toHaveLength(0)
    expect(splitReminders([split()], [share('Thabo', 300, { reminders_sent: 3 })], today, fmt)).toHaveLength(0)
    expect(splitReminders([split()], [share('Thabo', 300, { last_reminded_at: new Date(2026, 10, 6).toISOString() })], today, fmt)).toHaveLength(0)
  })
})
