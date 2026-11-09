import { describe, expect, it } from 'vitest'
import { makeExpense, makeGoal, makeSpendEntry } from '@/test/factories'
import { buildFinancialContext } from './assistant-context'
import { extractActions } from './assistant-declarations'
import { runTool, type ToolData } from './assistant-tools'
import { resolveContent } from './content'
import { checkAffordability, disposableIncome, safetyBufferAmount } from './money'
import type { Profile } from './types'

const profile = { id: 'u', currency_code: 'ZAR', pay_frequency: 'monthly', gross_income: 40_000, net_income: 30_000, safety_buffer_pct: 10 } as Profile
const expenses = [makeExpense({ category: 'housing', amount: 12_000, is_fixed: true }), makeExpense({ category: 'groceries', amount: 4_000, is_fixed: false })]
const goals = [makeGoal({ name: 'Emergency', category: 'emergency_fund', target_amount: 20_000, current_amount: 8_000 })]
const data: ToolData = {
  profile,
  expenses,
  goals,
  entries: [makeSpendEntry({ amount: 500, category: 'groceries', spent_at: new Date(2026, 10, 5).toISOString() })],
  payday: { payday_day: 25, payday_rule: 'previous_working_day' },
  tfsa: [{ id: 't', user_id: 'u', tax_year: '2026/27', amount: 40_000, contributed_on: '2026-06-01', provider: null, note: null, created_at: '', updated_at: '' }],
  content: resolveContent({}),
  today: new Date(2026, 10, 9),
}

describe('Ask Loot tools (Rule 25)', () => {
  it('acceptance: "Can I afford a R6,000 PS5?" gives the same verdict as the Checker', () => {
    const tool = runTool('check_affordability', { item: 'PS5', amount: 6000, recurring: false }, data)
    const checker = checkAffordability({
      itemName: 'PS5',
      amount: 6000,
      isRecurring: false,
      disposableIncome: disposableIncome(profile.net_income, expenses),
      safetyBuffer: safetyBufferAmount(profile.net_income, profile.safety_buffer_pct),
      savingsBalance: 8_000,
      emergencyFundTarget: 20_000,
    })
    expect(tool.verdict).toBe(checker.verdict)
    expect(tool.reasoning).toBe(checker.reasoning)
  })

  it('cycle status uses Safe to spend', () => {
    const r = runTool('cycle_status', {}, data)
    expect(r.safe_to_spend).toBe(30_000 - 16_000 - 3_000)
    expect(r.spends_logged).toBe(1)
  })

  it('tfsa_room matches the Future you maths', () => {
    expect(runTool('tfsa_room', {}, data)).toMatchObject({ room_this_year: 6_000, annual_limit: 46_000 })
  })

  it('category_spend validates the category', () => {
    expect(runTool('category_spend', { category: 'bitcoin' }, data).error).toBeDefined()
    const r = runTool('category_spend', { category: 'groceries', cycles: 2 }, data) as { cycles: { spent: number }[] }
    expect(r.cycles).toHaveLength(2)
    expect(r.cycles[0].spent).toBe(500)
  })

  it('unknown tools and bad numbers return errors, not crashes', () => {
    expect(runTool('transfer_money', {}, data).error).toBeDefined()
    expect(runTool('check_affordability', { amount: -5 }, data).error).toBeDefined()
    expect(runTool('tax_estimate', { gross_monthly: 30_000 }, data).take_home_monthly).toBeGreaterThan(20_000)
  })

  it('action markers are stripped', () => {
    expect(extractActions('Yes, comfortably. [[action:wishlist]] [[action:nope]]')).toEqual({ text: 'Yes, comfortably.', actions: ['wishlist'] })
  })

  it('context never includes notes or other people', () => {
    const ctx = buildFinancialContext({
      profile,
      expenses: [makeExpense({ name: 'Rent', category: 'housing', amount: 12_000 })],
      latestSnapshot: null,
      debts: [],
      goals: [makeGoal({ name: 'Trip', note: 'secret note about Thabo' })],
      taxProfile: null,
    })
    expect(ctx).not.toContain('secret')
    expect(ctx).not.toContain('Thabo')
  })
})
