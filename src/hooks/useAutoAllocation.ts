import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  computeAutoAllocations,
  currentPeriodKey,
  normalizeAllocationMode,
  normalizeAutoTiming,
  remainingAmount,
} from '@/lib/goal-math'
import { disposableIncome, safetyBufferAmount } from '@/lib/money'
import { supabase } from '@/lib/supabase'
import type { SavingsGoal } from '@/lib/types'
import { useAuth } from './useAuth'
import { useExpenses } from './useExpenses'
import { useGoals } from './useGoals'
import { useProfile } from './useProfile'

export const AUTO_NOTE_PREFIX = 'Auto · '

/** What auto goals have already been paid this month (goal id → amount), read from the contribution history. */
function useAppliedThisMonth() {
  const { user } = useAuth()
  const period = currentPeriodKey()
  return useQuery({
    queryKey: ['goal_auto_applied', user?.id, period],
    queryFn: async (): Promise<Record<string, number>> => {
      const start = new Date(`${period}T00:00:00`)
      const { data, error } = await supabase
        .from('goal_contributions')
        .select('goal_id, amount')
        .like('note', `${AUTO_NOTE_PREFIX}%`)
        .gte('created_at', start.toISOString())
      if (error) throw error
      const out: Record<string, number> = {}
      for (const row of data ?? []) out[row.goal_id] = (out[row.goal_id] ?? 0) + Number(row.amount)
      return out
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

/**
 * The month's "spare loot" and how it splits across goals set to auto-progress.
 *
 * pool = disposable income − safety buffer (never negative). Goals already paid this month are put back to
 * their start-of-month balance for the calculation, so paying one goal never inflates the share shown for
 * the others.
 */
export function useAutoAllocation() {
  const { data: profile, isSuccess: profileReady } = useProfile()
  const { data: expenses, isSuccess: expensesReady } = useExpenses()
  const { data: goals, isSuccess: goalsReady } = useGoals()
  const { data: applied, isSuccess: appliedReady } = useAppliedThisMonth()

  return useMemo(() => {
    const ready = profileReady && expensesReady && goalsReady && appliedReady
    const mode = normalizeAllocationMode(profile?.auto_allocation_mode)
    const timing = normalizeAutoTiming(profile?.auto_contribution_timing)
    if (!ready || !profile || !expenses || !goals || !applied) {
      return { ready: false, mode, timing, pool: 0, shares: {} as Record<string, number>, applied: {} as Record<string, number>, period: currentPeriodKey() }
    }
    const period = currentPeriodKey()
    const disposable = disposableIncome(profile.net_income, expenses)
    const pool = Math.max(0, disposable - safetyBufferAmount(profile.net_income, profile.safety_buffer_pct))
    // Rewind goals that were already paid this month so shares are computed from the same starting point.
    const startOfMonth: SavingsGoal[] = goals.map((g) => {
      const paid = applied[g.id] ?? 0
      if (paid <= 0) return g
      const current_amount = Math.max(0, g.current_amount - paid)
      return { ...g, current_amount, is_completed: g.is_completed && remainingAmount({ ...g, current_amount }) === 0 }
    })
    const shares = computeAutoAllocations(startOfMonth, pool, mode)
    return { ready: true, mode, timing, pool, shares, applied, period }
  }, [profile, expenses, goals, applied, profileReady, expensesReady, goalsReady, appliedReady])
}
