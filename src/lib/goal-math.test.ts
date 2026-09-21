import { describe, expect, it } from 'vitest'
import { makeGoal } from '@/test/factories'
import {
  commitmentStatus,
  commitmentTimeline,
  completionPatch,
  computeAutoAllocations,
  currentPeriodKey,
  deadlineLabel,
  displayOrder,
  monthDiff,
  monthsUntil,
  normalizeAllocationMode,
  normalizeAutoTiming,
  parseDateOnly,
  remainingAmount,
  requiredMonthlyContribution,
  shouldAutoResume,
  suggestedOrder,
} from './goal-math'

const now = new Date(2026, 8, 21) // 21 Sep 2026

describe('test environment', () => {
  it('runs in a zone ahead of UTC so UTC-shift bugs surface', () => {
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(-120)
  })
})

describe('date helpers', () => {
  it('parses date-only strings as local calendar dates', () => {
    const d = parseDateOnly('2026-10-01')
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 9, 1])
  })

  it('monthDiff is signed calendar months', () => {
    expect(monthDiff(new Date(2027, 2, 1), now)).toBe(6)
    expect(monthDiff(new Date(2026, 7, 31), now)).toBe(-1)
    expect(monthDiff(new Date(2026, 8, 30), now)).toBe(0)
  })

  it('monthsUntil floors at 0 and is null without a date', () => {
    expect(monthsUntil(null, now)).toBeNull()
    expect(monthsUntil('2026-01-01', now)).toBe(0)
    expect(monthsUntil('2027-03-15', now)).toBe(6)
  })

  it('deadlineLabel wording', () => {
    expect(deadlineLabel(null, now)).toBe('No deadline')
    expect(deadlineLabel('2026-06-01', now)).toBe('Overdue')
    expect(deadlineLabel('2026-09-30', now)).toBe('Due this month')
    expect(deadlineLabel('2026-10-05', now)).toBe('1 month left')
    expect(deadlineLabel('2027-03-05', now)).toBe('6 months left')
  })

  it('currentPeriodKey is the first of the local month', () => {
    expect(currentPeriodKey(new Date(2026, 0, 31, 23, 59))).toBe('2026-01-01')
    expect(currentPeriodKey(new Date(2026, 11, 1, 0, 0))).toBe('2026-12-01')
  })
})

describe('requirements and status', () => {
  it('remainingAmount never goes negative', () => {
    expect(remainingAmount({ target_amount: 100, current_amount: 30 })).toBe(70)
    expect(remainingAmount({ target_amount: 100, current_amount: 130 })).toBe(0)
  })

  it('requiredMonthlyContribution divides what is left across the months left', () => {
    const g = makeGoal({ target_amount: 12_000, current_amount: 6_000, target_date: '2027-03-15' })
    expect(requiredMonthlyContribution(g, now)).toBe(1_000)
  })

  it('needs the whole remainder now when due this month or overdue', () => {
    const g = makeGoal({ target_amount: 5_000, current_amount: 1_000, target_date: '2026-09-30' })
    expect(requiredMonthlyContribution(g, now)).toBe(4_000)
    expect(requiredMonthlyContribution({ ...g, target_date: '2026-01-01' }, now)).toBe(4_000)
  })

  it('needs nothing without a deadline, when paused or when completed', () => {
    expect(requiredMonthlyContribution(makeGoal(), now)).toBe(0)
    expect(requiredMonthlyContribution(makeGoal({ target_date: '2027-01-01', is_paused: true }), now)).toBe(0)
    expect(requiredMonthlyContribution(makeGoal({ target_date: '2027-01-01', is_completed: true }), now)).toBe(0)
  })

  it('commitmentStatus thresholds', () => {
    expect(commitmentStatus(0, 0)).toBe('comfortable')
    expect(commitmentStatus(1, 0)).toBe('not-feasible')
    expect(commitmentStatus(500, 1000)).toBe('comfortable')
    expect(commitmentStatus(501, 1000)).toBe('tight')
    expect(commitmentStatus(1000, 1000)).toBe('tight')
    expect(commitmentStatus(1001, 1000)).toBe('not-feasible')
  })
})

describe('commitmentTimeline', () => {
  it('spreads each goal across its months and steps down as goals finish', () => {
    const a = makeGoal({ name: 'A', target_amount: 3_000, target_date: '2026-12-10' }) // 3 months → 1000/mo
    const b = makeGoal({ name: 'B', target_amount: 6_000, target_date: '2027-03-10' }) // 6 months → 1000/mo
    const t = commitmentTimeline([a, b], now, 8)
    expect(t.map((m) => m.total)).toEqual([2000, 2000, 2000, 1000, 1000, 1000, 0, 0])
    expect(t[2].completing).toEqual(['A'])
    expect(t[5].completing).toEqual(['B'])
  })

  it('a goal due this month is a single lump in month one', () => {
    const g = makeGoal({ name: 'Now', target_amount: 900, target_date: '2026-09-30' })
    const t = commitmentTimeline([g], now, 3)
    expect(t.map((m) => m.total)).toEqual([900, 0, 0])
    expect(t[0].completing).toEqual(['Now'])
  })

  it('ignores undated, completed and fully funded goals', () => {
    const goals = [
      makeGoal({ target_date: null }),
      makeGoal({ target_date: '2027-01-01', is_completed: true }),
      makeGoal({ target_date: '2027-01-01', target_amount: 100, current_amount: 100 }),
    ]
    expect(commitmentTimeline(goals, now, 4).every((m) => m.total === 0)).toBe(true)
  })

  it('a paused goal with a resume date contributes only from that month; without one, never', () => {
    const resume = makeGoal({ target_amount: 4_000, target_date: '2027-03-10', is_paused: true, resume_date: '2026-12-01' })
    const t = commitmentTimeline([resume], now, 8)
    // resumes in 3 months, target in 6 → 3 instalments of 4000/3
    expect(t.map((m) => m.total)).toEqual([0, 0, 0, 1333, 1333, 1333, 0, 0])
    const never = makeGoal({ target_amount: 4_000, target_date: '2027-03-10', is_paused: true })
    expect(commitmentTimeline([never], now, 8).every((m) => m.total === 0)).toBe(true)
  })
})

describe('ordering', () => {
  it('suggestedOrder: soonest deadline first, undated next, completed last', () => {
    const late = makeGoal({ name: 'late', target_date: '2028-01-01', sort_order: 0 })
    const soon = makeGoal({ name: 'soon', target_date: '2026-11-01', sort_order: 1 })
    const none = makeGoal({ name: 'none', sort_order: 2 })
    const done = makeGoal({ name: 'done', target_date: '2026-10-01', is_completed: true, sort_order: 3 })
    expect(suggestedOrder([done, none, late, soon]).map((g) => g.name)).toEqual(['soon', 'late', 'none', 'done'])
  })

  it('displayOrder keeps the user order but sinks completed goals', () => {
    const a = makeGoal({ name: 'a', sort_order: 0, is_completed: true })
    const b = makeGoal({ name: 'b', sort_order: 1 })
    const c = makeGoal({ name: 'c', sort_order: 2 })
    expect(displayOrder([a, c, b]).map((g) => g.name)).toEqual(['b', 'c', 'a'])
  })
})

describe('pause / resume / completion', () => {
  it('shouldAutoResume once the resume date arrives', () => {
    const g = makeGoal({ is_paused: true, resume_date: '2026-09-21' })
    expect(shouldAutoResume(g, now)).toBe(true)
    expect(shouldAutoResume({ ...g, resume_date: '2026-09-22' }, now)).toBe(false)
    expect(shouldAutoResume({ ...g, resume_date: null }, now)).toBe(false)
    expect(shouldAutoResume({ ...g, is_paused: false }, now)).toBe(false)
  })

  it('completionPatch marks done at target and keeps the original timestamp', () => {
    const open = { is_completed: false, completed_at: null }
    expect(completionPatch(open, 99, 100, now)).toEqual({ is_completed: false, completed_at: null })
    const done = completionPatch(open, 100, 100, now)
    expect(done.is_completed).toBe(true)
    expect(done.completed_at).toBe(now.toISOString())
    const again = completionPatch({ is_completed: true, completed_at: '2026-01-01T00:00:00.000Z' }, 150, 100, now)
    expect(again.completed_at).toBe('2026-01-01T00:00:00.000Z')
    // withdrawing below the target re-opens the goal
    expect(completionPatch({ is_completed: true, completed_at: 'x' }, 50, 100, now)).toEqual({ is_completed: false, completed_at: null })
    // a zero target is never "complete"
    expect(completionPatch(open, 0, 0, now).is_completed).toBe(false)
  })
})

describe('auto-progress settings', () => {
  it('normalises legacy database defaults', () => {
    expect(normalizeAllocationMode('manual')).toBe('weighted')
    expect(normalizeAllocationMode(null)).toBe('weighted')
    expect(normalizeAllocationMode('sequential')).toBe('sequential')
    expect(normalizeAutoTiming('start')).toBe('on_demand')
    expect(normalizeAutoTiming(undefined)).toBe('on_demand')
    expect(normalizeAutoTiming('monthly_1st')).toBe('monthly_1st')
    expect(normalizeAutoTiming('estimate_only')).toBe('estimate_only')
  })
})

describe('computeAutoAllocations', () => {
  const auto = (over: Partial<Parameters<typeof makeGoal>[0]> = {}) => makeGoal({ progress_mode: 'auto', ...over })

  it('only auto, unpaused, unfinished goals take part', () => {
    const a = auto({ id: 'a' })
    const manual = makeGoal({ id: 'm' })
    const paused = auto({ id: 'p', is_paused: true })
    const done = auto({ id: 'd', is_completed: true })
    const out = computeAutoAllocations([a, manual, paused, done], 1000, 'weighted')
    expect(Object.keys(out)).toEqual(['a'])
    expect(out.a).toBe(1000)
  })

  it('returns zeros for an empty or non-positive pool', () => {
    const a = auto({ id: 'a' })
    expect(computeAutoAllocations([a], 0, 'weighted')).toEqual({ a: 0 })
    expect(computeAutoAllocations([a], -50, 'sequential')).toEqual({ a: 0 })
    expect(computeAutoAllocations([a], NaN, 'weighted')).toEqual({ a: 0 })
    expect(computeAutoAllocations([], 100, 'weighted')).toEqual({})
  })

  it('weighted split follows weights', () => {
    const a = auto({ id: 'a', weight: 3, target_amount: 100_000 })
    const b = auto({ id: 'b', weight: 1, target_amount: 100_000 })
    const out = computeAutoAllocations([a, b], 1000, 'weighted')
    expect(out.a).toBeCloseTo(750)
    expect(out.b).toBeCloseTo(250)
  })

  it('weighted caps a goal at what it still needs and redistributes the overflow', () => {
    const a = auto({ id: 'a', weight: 1, target_amount: 100, current_amount: 0 }) // needs 100
    const b = auto({ id: 'b', weight: 1, target_amount: 100_000 })
    const out = computeAutoAllocations([a, b], 1000, 'weighted')
    expect(out.a).toBeCloseTo(100)
    expect(out.b).toBeCloseTo(900)
    expect(out.a + out.b).toBeCloseTo(1000)
  })

  it('weighted never allocates more than the goals need in total', () => {
    const a = auto({ id: 'a', target_amount: 100 })
    const b = auto({ id: 'b', target_amount: 200 })
    const out = computeAutoAllocations([a, b], 10_000, 'weighted')
    expect(out.a).toBeCloseTo(100)
    expect(out.b).toBeCloseTo(200)
  })

  it('all-zero weights fall back to an equal split', () => {
    const a = auto({ id: 'a', weight: 0, target_amount: 100_000 })
    const b = auto({ id: 'b', weight: 0, target_amount: 100_000 })
    const out = computeAutoAllocations([a, b], 1000, 'weighted')
    expect(out.a).toBeCloseTo(500)
    expect(out.b).toBeCloseTo(500)
  })

  it('sequential fills in list order and spills over', () => {
    const a = auto({ id: 'a', sort_order: 0, target_amount: 300 })
    const b = auto({ id: 'b', sort_order: 1, target_amount: 500 })
    const c = auto({ id: 'c', sort_order: 2, target_amount: 10_000 })
    const out = computeAutoAllocations([c, b, a], 1000, 'sequential')
    expect(out).toEqual({ a: 300, b: 500, c: 200 })
  })
})
