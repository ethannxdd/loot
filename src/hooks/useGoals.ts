import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { completionPatch, currentPeriodKey } from '@/lib/goal-math'
import { supabase } from '@/lib/supabase'
import type { GoalContribution, NewGoal, SavingsGoal } from '@/lib/types'
import { useAuth } from './useAuth'

export function goalsQueryKey(userId: string | undefined) {
  return ['savings_goals', userId] as const
}

export function contributionsQueryKey(goalId: string | undefined) {
  return ['goal_contributions', goalId] as const
}

function invalidateGoal(queryClient: QueryClient, userId: string | undefined, goalId?: string) {
  void queryClient.invalidateQueries({ queryKey: goalsQueryKey(userId) })
  void queryClient.invalidateQueries({ queryKey: ['goal_auto_applied'] })
  if (goalId) {
    void queryClient.invalidateQueries({ queryKey: ['savings_goal', goalId] })
    void queryClient.invalidateQueries({ queryKey: contributionsQueryKey(goalId) })
  }
}

async function fetchGoal(goalId: string): Promise<SavingsGoal> {
  const { data, error } = await supabase.from('savings_goals').select('*').eq('id', goalId).maybeSingle()
  if (error) throw error
  if (!data) throw new Error('That goal no longer exists.')
  return data as SavingsGoal
}

export function useGoals() {
  const { user } = useAuth()
  return useQuery({
    queryKey: goalsQueryKey(user?.id),
    queryFn: async (): Promise<SavingsGoal[]> => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user!.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as SavingsGoal[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

/** A single goal, or `null` when it doesn't exist (deleted, or someone else's link) so the page can say so. */
export function useGoal(goalId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['savings_goal', goalId],
    queryFn: async (): Promise<SavingsGoal | null> => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('id', goalId!)
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return (data as SavingsGoal | null) ?? null
    },
    enabled: Boolean(goalId && user?.id),
  })
}

export function useGoalContributions(goalId: string | undefined) {
  return useQuery({
    queryKey: contributionsQueryKey(goalId),
    queryFn: async (): Promise<GoalContribution[]> => {
      const { data, error } = await supabase
        .from('goal_contributions')
        .select('*')
        .eq('goal_id', goalId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as GoalContribution[]
    },
    enabled: Boolean(goalId),
  })
}

export function useCreateGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (goal: NewGoal & Partial<Pick<SavingsGoal, 'progress_mode' | 'weight'>>) => {
      if (!user) throw new Error('Not signed in')
      const current = goal.current_amount ?? 0
      const { data, error } = await supabase
        .from('savings_goals')
        .insert({
          ...goal,
          current_amount: current,
          ...completionPatch({ is_completed: false, completed_at: null }, current, goal.target_amount),
          user_id: user.id,
        })
        .select()
        .single()
      if (error) throw error
      return data as SavingsGoal
    },
    onSuccess: () => invalidateGoal(queryClient, user?.id),
  })
}

/**
 * Edits a goal. When the target or current amount changes, completion is recomputed from the stored row —
 * raising the target on a finished goal re-opens it, lowering it below what's saved completes it.
 */
export function useUpdateGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SavingsGoal> }) => {
      let next: Partial<SavingsGoal> = patch
      if (patch.target_amount !== undefined || patch.current_amount !== undefined) {
        const existing = await fetchGoal(id)
        next = {
          ...patch,
          ...completionPatch(
            existing,
            patch.current_amount ?? existing.current_amount,
            patch.target_amount ?? existing.target_amount,
          ),
        }
      }
      const { data, error } = await supabase.from('savings_goals').update(next).eq('id', id).select().single()
      if (error) throw error
      return data as SavingsGoal
    },
    onSuccess: (data) => invalidateGoal(queryClient, user?.id, data.id),
  })
}

export function useDeleteGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id)
      if (error) throw error
      return id
    },
    onSuccess: (id) => {
      queryClient.removeQueries({ queryKey: ['savings_goal', id] })
      queryClient.removeQueries({ queryKey: contributionsQueryKey(id) })
      invalidateGoal(queryClient, user?.id)
    },
  })
}

/** Persists a new sort order for the goals list ("use suggested order", move up / down, drag). */
export function useReorderGoals() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const results = await Promise.all(
        orderedIds.map((id, index) => supabase.from('savings_goals').update({ sort_order: index }).eq('id', id)),
      )
      const failed = results.find((r) => r.error)
      if (failed?.error) throw failed.error
    },
    onSuccess: () => invalidateGoal(queryClient, user?.id),
    onError: () => invalidateGoal(queryClient, user?.id), // re-sync the list with whatever did save
  })
}

interface ContributionInput {
  goalId: string
  /** Positive to add to the goal, negative to take money back out. */
  amount: number
  note?: string
}

/**
 * Applies a signed amount to a goal's balance and records it in the contribution history. The balance
 * update is guarded on the value we read, so two devices adding at once can't overwrite each other, and the
 * history row is rolled back if the balance can't be saved.
 */
async function applyContribution(userId: string, { goalId, amount, note }: ContributionInput) {
  if (!Number.isFinite(amount) || amount === 0) throw new Error('Enter an amount.')
  const goal = await fetchGoal(goalId)
  const next = Math.round((goal.current_amount + amount) * 100) / 100
  if (next < 0) throw new Error("You can't take out more than what's saved in this goal.")

  const { data: contribution, error: contribError } = await supabase
    .from('goal_contributions')
    .insert({ goal_id: goalId, user_id: userId, amount, note: note?.trim() || null })
    .select('id')
    .single()
  if (contribError) throw contribError

  const { data: updated, error: updateError } = await supabase
    .from('savings_goals')
    .update({ current_amount: next, ...completionPatch(goal, next, goal.target_amount) })
    .eq('id', goalId)
    .eq('current_amount', goal.current_amount)
    .select('id')
  if (updateError || !updated || updated.length === 0) {
    await supabase.from('goal_contributions').delete().eq('id', contribution.id)
    if (updateError) throw updateError
    throw new Error('This goal changed on another device — refresh and try again.')
  }
  return { goal, next, contributionId: contribution.id as string }
}

export function useAddContribution() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: ContributionInput) => {
      if (!user) throw new Error('Not signed in')
      return applyContribution(user.id, input)
    },
    onSuccess: (_data, variables) => invalidateGoal(queryClient, user?.id, variables.goalId),
  })
}

/** Removes a history entry and reverses its effect on the goal's balance. */
export function useDeleteContribution() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (contribution: GoalContribution) => {
      const goal = await fetchGoal(contribution.goal_id)
      const next = Math.max(0, Math.round((goal.current_amount - contribution.amount) * 100) / 100)
      const { error } = await supabase.from('goal_contributions').delete().eq('id', contribution.id)
      if (error) throw error
      // Removing this month's auto payment frees the month up so it can be applied again.
      const wasAuto = contribution.note?.startsWith('Auto · ') && goal.last_auto_period === currentPeriodKey(new Date(contribution.created_at))
      const { error: updateError } = await supabase
        .from('savings_goals')
        .update({
          current_amount: next,
          ...completionPatch(goal, next, goal.target_amount),
          ...(wasAuto ? { last_auto_period: null } : {}),
        })
        .eq('id', goal.id)
      if (updateError) {
        // Put the history row back so the balance and the ledger still agree.
        await supabase.from('goal_contributions').insert({
          id: contribution.id,
          goal_id: contribution.goal_id,
          user_id: contribution.user_id,
          amount: contribution.amount,
          note: contribution.note,
          created_at: contribution.created_at,
        })
        throw updateError
      }
      return goal.id
    },
    onSuccess: (goalId) => invalidateGoal(queryClient, user?.id, goalId),
  })
}

/**
 * Pays a goal its share of this month's spare loot — at most once per calendar month. The month is claimed on
 * the goal row first (conditional on it not already being claimed), so double-clicks, two tabs, or the
 * "1st of the month" automation racing a manual Apply can't double-pay. Released again if the payment fails.
 */
export function useApplyAutoContribution() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ goalId, amount, period = currentPeriodKey() }: { goalId: string; amount: number; period?: string }) => {
      if (!user) throw new Error('Not signed in')
      const rounded = Math.round(amount * 100) / 100
      if (!(rounded > 0)) return { applied: false as const }
      const goal = await fetchGoal(goalId)
      if (goal.last_auto_period === period) return { applied: false as const }

      let claim = supabase.from('savings_goals').update({ last_auto_period: period }).eq('id', goalId)
      claim = goal.last_auto_period === null ? claim.is('last_auto_period', null) : claim.eq('last_auto_period', goal.last_auto_period)
      const { data: claimed, error: claimError } = await claim.select('id')
      if (claimError) throw claimError
      if (!claimed || claimed.length === 0) return { applied: false as const } // someone else got there first

      try {
        const label = new Date(`${period.slice(0, 7)}-01T12:00:00`).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
        await applyContribution(user.id, { goalId, amount: Math.min(rounded, Math.max(0, goal.target_amount - goal.current_amount)), note: `Auto · ${label}` })
      } catch (err) {
        await supabase.from('savings_goals').update({ last_auto_period: goal.last_auto_period }).eq('id', goalId)
        throw err
      }
      return { applied: true as const }
    },
    onSuccess: (_data, variables) => invalidateGoal(queryClient, user?.id, variables.goalId),
  })
}
