import { describe, expect, it } from 'vitest'
import { CONTENT_DEFAULTS } from './content-defaults'
import { checkAffordability } from './money'
import { blackFridayBudget, blackFridayWeekend, checkItems, inBlackFridayWindow } from './tools/black-friday'
import { carCost, defaultCarInputs } from './tools/car-cost'
import { balanceAfter, instalment } from './tools/finance'
import { inJanuaryWindow, surviveJanuary } from './tools/january'
import { movingOut, defaultMovingOutInputs } from './tools/moving-out'
import { defaultRentBuyInputs, rentVsBuy } from './tools/rent-vs-buy'
import { runway } from './tools/runway'
import { countdown, defaultCoolOff, effectiveStatus, readyAt, readyToday, savedByNotBuying, type WishlistItem } from './wishlist'

/** Independent amortisation: simulate month by month and find the payment that leaves exactly the balloon. */
function simulatedPayment(principal: number, ratePct: number, months: number, balloon: number) {
  const r = ratePct / 100 / 12
  let lo = 0
  let hi = principal
  for (let k = 0; k < 200; k++) {
    const mid = (lo + hi) / 2
    let bal = principal
    for (let m = 0; m < months; m++) bal = bal * (1 + r) - mid
    if (bal > balloon) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

describe('car cost', () => {
  it('acceptance: R300k, 10% deposit, 72 months, 12.75%, 30% balloon matches an independent amortisation to the cent', () => {
    const r = carCost({ ...defaultCarInputs(10.75, 30), price: 300_000, deposit: 30_000, termMonths: 72, ratePct: 12.75, balloonPct: 30 })
    expect(r.balloon).toBe(90_000)
    expect(r.instalment).toBeCloseTo(simulatedPayment(270_000, 12.75, 72, 90_000), 2)
    expect(r.trueMonthly).toBeGreaterThan(r.instalment)
    expect(r.totalPaid).toBeCloseTo(30_000 + r.instalment * 72 + 90_000, 0)
  })

  it('no interest, no balloon', () => {
    expect(instalment(12_000, 0, 12)).toBe(1000)
  })

  it('balance after the full term equals the balloon', () => {
    const pmt = instalment(270_000, 12.75, 72, 90_000)
    expect(balanceAfter(270_000, 12.75, pmt, 72)).toBeCloseTo(90_000, 2)
  })

  it('true cost adds fuel at km × l/100km × price', () => {
    const r = carCost({ ...defaultCarInputs(10.75, 30), kmPerMonth: 1000, litresPer100km: 8, fuelPrice: 30 })
    expect(r.fuelMonthly).toBe(2400)
  })

  it('default rate is prime + 2', () => {
    expect(defaultCarInputs(10.75, 30.24).ratePct).toBe(12.75)
  })
})

describe('rent vs buy', () => {
  it('upfront includes deposit, duty and costs; finds a break-even year', () => {
    const r = rentVsBuy(defaultRentBuyInputs(10.75), CONTENT_DEFAULTS.transfer_duty.brackets, CONTENT_DEFAULTS.bond_costs)
    expect(r.duty).toBe(8_700) // 3% of the R290,000 above R1.21m
    expect(r.upfront).toBeGreaterThan(150_000 + 8_700)
    expect(r.years).toHaveLength(15)
    expect(r.breakEvenYear === null || (r.breakEvenYear >= 1 && r.breakEvenYear <= 15)).toBe(true)
  })

  it('cheap rent never breaks even within a short horizon', () => {
    const r = rentVsBuy({ ...defaultRentBuyInputs(10.75), rentMonthly: 2_000, rentEscalationPct: 0, years: 3 }, CONTENT_DEFAULTS.transfer_duty.brackets, CONTENT_DEFAULTS.bond_costs)
    expect(r.breakEvenYear).toBeNull()
  })
})

describe('moving out', () => {
  it('monthly, upfront, gap', () => {
    const r = movingOut(defaultMovingOutInputs(), 20_000)
    expect(r.monthly).toBe(14_700)
    expect(r.upfront).toBe(7_500 * 2 + 15_000)
    expect(r.gap).toBe(5_300)
    expect(r.grossNeeded).toBeGreaterThan(14_700)
  })
})

describe('runway', () => {
  const base = {
    savings: 60_000,
    takeHome: 25_000,
    essentials: 12_000,
    cuttable: 3_000,
    scenario: 'lose_income' as const,
    payCutPct: 0,
    extraMonthly: 0,
    otherIncome: 0,
    cut: false,
  }

  it('lose income: savings ÷ spending', () => {
    const r = runway(base, new Date(2026, 10, 9))
    expect(r.months).toBe(4)
    expect(r.series[0].balance).toBe(60_000)
    expect(r.series.at(-1)!.balance).toBe(0)
  })

  it('UIF stretches it, and cutting buys more months', () => {
    const r = runway({ ...base, otherIncome: 5_000 })
    expect(r.months).toBe(6)
    expect(r.cutGain).toBeCloseTo(60_000 / 7_000 - 6, 2)
  })

  it('a small pay cut that is still covered never runs out', () => {
    const r = runway({ ...base, scenario: 'pay_cut', payCutPct: 10 })
    expect(r.months).toBeNull()
    expect(r.runsOutOn).toBeNull()
  })
})

describe('survive January', () => {
  it('acceptance: Dec payday 15 Dec, Jan payday 23 Jan → 39 days; set-aside covers school + January days', () => {
    const r = surviveJanuary({
      decPayday: '2026-12-15',
      janPayday: '2027-01-23',
      decPay: 30_000,
      commitments: 15_000,
      festive: { gifts: 2_000, travel: 1_500, food: 1_500, other: 0 },
      school: [{ label: 'Uniforms', amount: 2_000 }],
      usualDays: 31,
    })
    expect(r.stretchDays).toBe(39)
    expect(r.extraDays).toBe(8)
    expect(r.dayToDay).toBe(8_000)
    expect(r.dailyAllowance).toBeCloseTo(8_000 / 39, 2)
    expect(r.januaryDays).toBe(22)
    expect(r.setAside).toBe(Math.ceil((2_000 + (8_000 / 39) * 22) / 10) * 10)
  })

  it('window wraps the year end', () => {
    const w = { start: '11-01', end: '01-15' }
    expect(inJanuaryWindow(new Date(2026, 10, 9), w)).toBe(true)
    expect(inJanuaryWindow(new Date(2027, 0, 10), w)).toBe(true)
    expect(inJanuaryWindow(new Date(2027, 1, 1), w)).toBe(false)
  })
})

describe('black friday', () => {
  it('budget and running verdicts', () => {
    const budget = blackFridayBudget({ safeOnTheDay: 5_000, ringFenced: 1_000, pausedContributions: 500, buffer: 2_000 })
    expect(budget).toBe(4_500)
    const rows = checkItems(
      [
        { id: 'a', name: 'AirPods', price: 4_000, targetPrice: 3_000 },
        { id: 'b', name: 'Shoes', price: 1_500, targetPrice: null },
        { id: 'c', name: 'TV', price: 9_000, targetPrice: null },
      ],
      budget,
      1_000,
    )
    expect(rows.map((r) => r.verdict)).toEqual(['comfortable', 'comfortable', 'not-recommended'])
  })

  it('weekend and card window', () => {
    expect(blackFridayWeekend('2026-11-27').end.getDate()).toBe(1)
    expect(inBlackFridayWindow(new Date(2026, 10, 9), '2026-11-27', 3)).toBe(true)
    expect(inBlackFridayWindow(new Date(2026, 11, 1), '2026-11-27', 3)).toBe(false)
  })
})

const item = (over: Partial<WishlistItem> = {}): WishlistItem => ({
  id: 'w1',
  user_id: 'u',
  name: 'AirPods',
  price: 4_500,
  url: null,
  category: 'tech_gadgets',
  cool_off_days: 2,
  added_at: '2026-11-07T10:00:00.000Z',
  ready_at: '2026-11-09T10:00:00.000Z',
  status: 'waiting',
  snoozed_until: null,
  decided_at: null,
  verdict: null,
  verdict_reasoning: null,
  tags: [],
  target_price: null,
  created_at: '',
  updated_at: '',
  ...over,
})

describe('wishlist', () => {
  it('default cooling-off by price vs take-home', () => {
    expect(defaultCoolOff(500, 20_000)).toBe(2)
    expect(defaultCoolOff(1_500, 20_000)).toBe(7)
    expect(defaultCoolOff(2_500, 20_000)).toBe(30)
  })

  it('acceptance: a 48h item becomes ready once the clock passes ready_at', () => {
    const added = new Date('2026-11-07T10:00:00Z')
    expect(readyAt(added, 2).toISOString()).toBe('2026-11-09T10:00:00.000Z')
    expect(effectiveStatus(item(), new Date('2026-11-09T09:59:00Z'))).toBe('waiting')
    expect(effectiveStatus(item(), new Date('2026-11-09T10:00:00Z'))).toBe('ready')
  })

  it('acceptance: the verdict uses the numbers at ready time, not when added', () => {
    const atAdd = checkAffordability({ itemName: 'AirPods', amount: 4_500, isRecurring: false, disposableIncome: 8_000, safetyBuffer: 2_000 })
    // Income dropped between adding and ready time.
    const atReady = checkAffordability({ itemName: 'AirPods', amount: 4_500, isRecurring: false, disposableIncome: 3_000, safetyBuffer: 2_000 })
    expect(atAdd.verdict).toBe('comfortable')
    expect(atReady.verdict).toBe('not-recommended')
  })

  it('snoozed items wait until snoozed_until', () => {
    const s = item({ status: 'snoozed', snoozed_until: '2026-11-16T10:00:00Z' })
    expect(effectiveStatus(s, new Date('2026-11-10T00:00:00Z'))).toBe('snoozed')
    expect(effectiveStatus(s, new Date('2026-11-17T00:00:00Z'))).toBe('ready')
  })

  it('countdown label', () => {
    expect(countdown(item(), new Date('2026-11-08T10:00:00Z'))).toEqual({ fraction: 0.5, label: 'Ready in 1 day' })
    expect(countdown(item(), new Date('2026-11-09T07:00:00Z')).label).toBe('Ready in 3 hours')
  })

  it('saved by not buying', () => {
    expect(savedByNotBuying([item({ status: 'dropped' }), item({ status: 'dropped', price: 500 }), item()])).toBe(5_000)
  })

  it('readyToday', () => {
    expect(readyToday([item()], new Date(2026, 10, 9))).toHaveLength(1)
    expect(readyToday([item({ status: 'dropped' })], new Date(2026, 10, 9))).toHaveLength(0)
  })
})
