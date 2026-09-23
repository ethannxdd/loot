import { describe, expect, it } from 'vitest'
import { bandFor, buildLootScoreView, calibratedEstimate, habitsRating, scaleFor } from './loot-score'
import type { BudgeScore, BureauScore } from './types'

const factors = { dti: 900, payment_consistency: 999, savings_rate: 800, utilisation: 950, expense_consistency: 700 }
const idx = (month: string, score: number) => ({ month, score, factors }) as BudgeScore
const bureau = (score: number, max: number, indexThen: number, reported_on = '2026-09-10', bureauName = 'Experian') =>
  ({ id: 'b', bureau: bureauName, score, estimated_score: indexThen, factors: { scale_max: max }, reported_on }) as unknown as BureauScore

const base = { netIncome: 30000, expenseCount: 5, snapshotMonths: 3, latest: idx('2026-09-01', 969), previous: idx('2026-08-01', 950), bureauScores: [] }

describe('Loot Score view', () => {
  it('shows nothing until income, expenses and 3 months exist', () => {
    const v = buildLootScoreView({ ...base, snapshotMonths: 1 })
    expect(v.status).toBe('insufficient')
    if (v.status === 'insufficient') expect(v.requirements.find((r) => r.key === 'history')?.done).toBe(false)
    expect(buildLootScoreView({ ...base, netIncome: 0 }).status).toBe('insufficient')
  })

  it('gives a 0–100 habits rating (never a fake credit score) without a bureau score', () => {
    const v = buildLootScoreView(base)
    expect(v.status).toBe('habits')
    if (v.status === 'habits') {
      expect(v.rating).toBe(97)
      expect(v.delta).toBe(2)
    }
  })

  it('anchors to a real Experian/ClearScore score on its 0–740 scale', () => {
    const v = buildLootScoreView({ ...base, bureauScores: [bureau(656, 740, 969)] })
    expect(v.status).toBe('calibrated')
    if (v.status === 'calibrated') {
      expect(v.estimate).toBe(656)
      expect(v.scale.max).toBe(740)
      expect(v.band.label).toBe('Good')
      expect(v.next?.label).toBe('Excellent')
      expect(v.next!.min - v.estimate).toBe(2)
    }
  })

  it('a bureau score skips the history wait once basics are in', () => {
    expect(buildLootScoreView({ ...base, snapshotMonths: 1, bureauScores: [bureau(656, 740, 969)] }).status).toBe('calibrated')
  })

  it('re-anchors on the newest score', () => {
    const v = buildLootScoreView({ ...base, bureauScores: [bureau(600, 740, 969, '2026-05-01'), bureau(671, 740, 969, '2026-09-20')] })
    if (v.status === 'calibrated') expect(v.estimate).toBe(671)
  })

  it('drifts with habits but never more than 6% of the scale', () => {
    expect(calibratedEstimate(bureau(656, 740, 500), 999)).toBe(656 + Math.round(740 * 0.06))
    expect(calibratedEstimate(bureau(656, 740, 999), 0)).toBe(656 - Math.round(740 * 0.06))
    const small = calibratedEstimate(bureau(656, 740, 900), 950)
    expect(small).toBeGreaterThan(656)
    expect(small).toBeLessThan(670)
  })

  it('knows TransUnion bands and falls back for unknown scales', () => {
    expect(bandFor(700, scaleFor(999)).label).toBe('Good')
    expect(bandFor(820, scaleFor(999)).label).toBe('Excellent')
    expect(scaleFor(850).max).toBe(850)
    expect(habitsRating(999)).toBe(100)
  })
})
