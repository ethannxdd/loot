import { describe, expect, it } from 'vitest'
import { makeExpense, makeGoal, makeTaxProfile } from '@/test/factories'
import type { BudgeScore, MonthlySnapshot, SubscriptionReview } from './types'
import { generateNotificationCandidates, type NotificationInputs } from './notifications'

const from = new Date(2026, 8, 21) // 21 Sep 2026

const empty: NotificationInputs = {
  expenses: [],
  taxProfile: null,
  subscriptionReviews: [],
  flaggedCategories: [],
  goals: [],
  currentSnapshot: null,
  latestBriefingMonth: null,
  latestScore: null,
  previousScore: null,
}

const gen = (over: Partial<NotificationInputs>, at = from) => generateNotificationCandidates({ ...empty, ...over }, at)
const score = (month: string, s: number) => ({ month, score: s }) as BudgeScore

describe('notification candidates', () => {
  it('nothing to say → nothing generated', () => {
    expect(gen({})).toEqual([])
  })

  describe('upcoming debits', () => {
    it('fires within the lead time and dedupes per due month', () => {
      const e = makeExpense({ id: 'e1', name: 'Rent', due_day: 24, notify_enabled: true, notify_lead_days: 7 })
      const [n] = gen({ expenses: [e] })
      expect(n.kind).toBe('upcoming_debit')
      expect(n.title).toBe('Rent due in 3 days')
      expect(n.body).toContain('24th')
      expect(n.dedupe_key).toBe('upcoming_debit:e1:2026-09-01')
    })

    it('says "today" and singular day', () => {
      const e = makeExpense({ name: 'Gym', due_day: 21, notify_enabled: true, notify_lead_days: 7 })
      expect(gen({ expenses: [e] })[0].title).toBe('Gym due today')
      const f = makeExpense({ name: 'Gym', due_day: 22, notify_enabled: true, notify_lead_days: 7 })
      expect(gen({ expenses: [f] })[0].title).toBe('Gym due in 1 day')
    })

    it('respects lead time, notify flag, soft delete and missing due day', () => {
      const far = makeExpense({ due_day: 30, notify_enabled: true, notify_lead_days: 3 })
      const off = makeExpense({ due_day: 22, notify_enabled: false })
      const gone = makeExpense({ due_day: 22, notify_enabled: true, deleted_at: '2026-09-01T00:00:00Z' })
      const nodue = makeExpense({ due_day: null, notify_enabled: true })
      expect(gen({ expenses: [far, off, gone, nodue] })).toEqual([])
    })

    it('keys a debit due early next month to that month, even when the heads-up arrives at month end', () => {
      const e = makeExpense({ id: 'e2', due_day: 2, notify_enabled: true, notify_lead_days: 7 })
      const [n] = gen({ expenses: [e] }, new Date(2026, 8, 30))
      expect(n.dedupe_key).toBe('upcoming_debit:e2:2026-10-01')
    })
  })

  describe('goal milestones', () => {
    it('announces only the highest milestone reached', () => {
      const g = makeGoal({ id: 'g', name: 'Car', target_amount: 1000, current_amount: 760 })
      const list = gen({ goals: [g] })
      expect(list).toHaveLength(1)
      expect(list[0].dedupe_key).toBe('goal_milestone:g:75')
      expect(list[0].link).toBe('/goals/g')
      expect(gen({ goals: [{ ...g, current_amount: 1000 }] })[0].title).toBe('Car is fully funded!')
      expect(gen({ goals: [{ ...g, current_amount: 240 }] })).toEqual([])
      expect(gen({ goals: [{ ...g, target_amount: 0 }] })).toEqual([])
    })
  })

  describe('monthly close', () => {
    it('nudges in the first three days unless the month is locked', () => {
      const day2 = new Date(2026, 8, 2)
      expect(gen({}, day2).map((n) => n.kind)).toEqual(['monthly_close_ready'])
      const locked = { locked_at: '2026-09-02T00:00:00Z' } as MonthlySnapshot
      expect(gen({ currentSnapshot: locked }, day2)).toEqual([])
      expect(gen({}, new Date(2026, 8, 4))).toEqual([])
    })
  })

  describe('score change', () => {
    it('needs a 30 point swing in either direction', () => {
      expect(gen({ latestScore: score('2026-09-01', 700), previousScore: score('2026-08-01', 680) })).toEqual([])
      const up = gen({ latestScore: score('2026-09-01', 720), previousScore: score('2026-08-01', 680) })
      expect(up[0].title).toBe('Your Loot Score improved')
      expect(up[0].body).toContain('+40')
      const down = gen({ latestScore: score('2026-09-01', 640), previousScore: score('2026-08-01', 680) })
      expect(down[0].title).toBe('Your Loot Score dropped')
      expect(gen({ latestScore: score('2026-09-01', 720), previousScore: null })).toEqual([])
    })
  })

  describe('spending anomalies, subscriptions, briefing', () => {
    it('flags categories 25%+ above average, once per month', () => {
      const list = gen({
        flaggedCategories: [
          { category: 'groceries', pctAboveAverage: 40 },
          { category: 'transport', pctAboveAverage: 10 },
        ],
      })
      expect(list).toHaveLength(1)
      expect(list[0].dedupe_key).toBe('spending_anomaly:groceries:2026-09-01')
    })

    it('reminds about subscriptions marked to cancel', () => {
      const reviews = [
        { id: 's1', service_name: 'Netflix', marked_cancel: true },
        { id: 's2', service_name: 'Spotify', marked_cancel: false },
      ] as SubscriptionReview[]
      const list = gen({ subscriptionReviews: reviews })
      expect(list).toHaveLength(1)
      expect(list[0].title).toContain('Netflix')
    })

    it('briefing ready', () => {
      const [n] = gen({ latestBriefingMonth: '2026-08-01' })
      expect(n.kind).toBe('briefing_ready')
      expect(n.dedupe_key).toBe('briefing_ready:2026-08-01')
    })
  })

  describe('tax deadlines', () => {
    it('no tax profile → no tax notices', () => {
      expect(gen({}, new Date(2026, 9, 1)).some((n) => n.kind === 'tax_deadline')).toBe(false)
    })

    it('filing deadline heads-up at 60 then 30 days, with distinct dedupe keys', () => {
      const profile = makeTaxProfile()
      const at60 = gen({ taxProfile: profile }, new Date(2026, 8, 21)).filter((n) => n.kind === 'tax_deadline')
      expect(at60).toHaveLength(1)
      expect(at60[0].dedupe_key).toBe('tax_deadline:non-provisional-deadline-2026:60')
      const at30 = gen({ taxProfile: profile }, new Date(2026, 9, 5)).filter((n) => n.kind === 'tax_deadline')
      expect(at30[0].dedupe_key).toBe('tax_deadline:non-provisional-deadline-2026:30')
    })

    it('provisional taxpayers also hear about provisional payments; others do not', () => {
      const at = new Date(2026, 8, 21) // top-up payment is 9 days away
      const plain = gen({ taxProfile: makeTaxProfile({ is_provisional_taxpayer: 'no' }) }, at)
      const prov = gen({ taxProfile: makeTaxProfile({ is_provisional_taxpayer: 'yes' }) }, at)
      expect(plain.some((n) => n.dedupe_key.includes('prov-topup'))).toBe(false)
      expect(prov.some((n) => n.dedupe_key.includes('prov-topup'))).toBe(true)
    })
  })
})
