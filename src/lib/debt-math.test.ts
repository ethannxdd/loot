import { describe, expect, it } from 'vitest'
import { makeDebt } from '@/test/factories'
import { simulatePayoff, totalDebtBalance, totalMinPayments } from './debt-math'

const from = new Date(2026, 0, 31) // 31 Jan 2026

describe('simulatePayoff', () => {
  it('returns an empty result without debts', () => {
    const r = simulatePayoff([], 0, 'avalanche', from)
    expect(r.totalMonths).toBe(0)
    expect(r.neverPaidOff).toBe(false)
    expect(r.schedule).toEqual([])
  })

  it('a single zero-interest debt clears in balance ÷ payment months', () => {
    const d = makeDebt({ id: 'a', balance: 1000, interest_rate: 0, min_payment: 250 })
    const r = simulatePayoff([d], 0, 'avalanche', from)
    expect(r.totalMonths).toBe(4)
    expect(r.totalInterest).toBe(0)
    expect(r.perDebt.a.paidOff).toBe(true)
    expect(r.perDebt.a.payoffMonth).toBe(4)
    expect(r.schedule.map((s) => Math.round(s.totalBalance))).toEqual([1000, 750, 500, 250, 0])
  })

  it('payoff dates clamp the day: 31 Jan + 1 month is 28 Feb, not 3 March', () => {
    const d = makeDebt({ id: 'a', balance: 100, interest_rate: 0, min_payment: 100 })
    const r = simulatePayoff([d], 0, 'avalanche', from)
    expect(r.perDebt.a.payoffDate).toBe('2026-02-28')
    const leap = simulatePayoff([d], 0, 'avalanche', new Date(2028, 0, 31))
    expect(leap.perDebt.a.payoffDate).toBe('2028-02-29')
  })

  it('charges monthly interest before the payment', () => {
    const d = makeDebt({ id: 'a', balance: 1200, interest_rate: 12, min_payment: 1212 })
    const r = simulatePayoff([d], 0, 'avalanche', from)
    expect(r.totalMonths).toBe(1)
    expect(r.totalInterest).toBeCloseTo(12)
  })

  it('extra payment shortens the payoff and saves interest', () => {
    const d = makeDebt({ id: 'a', balance: 20_000, interest_rate: 22, min_payment: 700 })
    const base = simulatePayoff([d], 0, 'avalanche', from)
    const extra = simulatePayoff([d], 500, 'avalanche', from)
    expect(extra.totalMonths).toBeLessThan(base.totalMonths)
    expect(extra.totalInterest).toBeLessThan(base.totalInterest)
  })

  it('a payment that never outruns interest is flagged, not silently capped', () => {
    const d = makeDebt({ id: 'a', balance: 100_000, interest_rate: 30, min_payment: 1000 })
    const r = simulatePayoff([d], 0, 'avalanche', from)
    expect(r.neverPaidOff).toBe(true)
    expect(r.perDebt.a.paidOff).toBe(false)
    expect(r.totalMonths).toBe(600)
  })

  it('avalanche orders by rate, snowball by balance', () => {
    const big = makeDebt({ id: 'big', balance: 50_000, interest_rate: 25, min_payment: 1000 })
    const small = makeDebt({ id: 'small', balance: 2_000, interest_rate: 10, min_payment: 200 })
    expect(simulatePayoff([small, big], 0, 'avalanche', from).order).toEqual(['big', 'small'])
    expect(simulatePayoff([big, small], 0, 'snowball', from).order).toEqual(['small', 'big'])
  })

  it('avalanche never costs more interest than snowball', () => {
    const debts = [
      makeDebt({ id: 'a', balance: 30_000, interest_rate: 28, min_payment: 900 }),
      makeDebt({ id: 'b', balance: 5_000, interest_rate: 12, min_payment: 250 }),
      makeDebt({ id: 'c', balance: 12_000, interest_rate: 18, min_payment: 400 }),
    ]
    const av = simulatePayoff(debts, 800, 'avalanche', from)
    const sn = simulatePayoff(debts, 800, 'snowball', from)
    expect(av.totalInterest).toBeLessThanOrEqual(sn.totalInterest + 0.01)
    expect(av.neverPaidOff || sn.neverPaidOff).toBe(false)
  })

  it('freed-up minimums roll into the next debt', () => {
    const a = makeDebt({ id: 'a', balance: 500, interest_rate: 0, min_payment: 500 })
    const b = makeDebt({ id: 'b', balance: 1500, interest_rate: 0, min_payment: 500 })
    const r = simulatePayoff([a, b], 0, 'snowball', from)
    // month 1: a cleared (500) + b 500 → 1000 left; month 2: 1000 budget clears b
    expect(r.perDebt.a.payoffMonth).toBe(1)
    expect(r.perDebt.b.payoffMonth).toBe(2)
  })

  it('a debt entered with zero balance is paid off at month 0', () => {
    const z = makeDebt({ id: 'z', balance: 0, min_payment: 100 })
    const r = simulatePayoff([z], 0, 'avalanche', from)
    expect(r.perDebt.z.paidOff).toBe(true)
    expect(r.perDebt.z.payoffMonth).toBe(0)
    expect(r.totalMonths).toBe(0)
  })

  it('totals helpers', () => {
    const debts = [makeDebt({ balance: 100, min_payment: 10 }), makeDebt({ balance: 250, min_payment: 30 })]
    expect(totalDebtBalance(debts)).toBe(350)
    expect(totalMinPayments(debts)).toBe(40)
  })
})
