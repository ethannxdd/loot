import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { GoalContribution, NewGoal, SavingsGoal } from '@/lib/types'
import { useAuth } from './useAuth'

export function goalsQueryKey(userId: string | undefined) {
  return ['savings_goals', userId] as const
}

export function contributionsQueryKey(goalId: string | undefined) {
  return ['goal_contributions', goalId] as const
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
      if (error) throw error
      return data as SavingsGoal[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

export function useGoal(goalId: string | undefined) {
  return useQuery({
    queryKey: ['savings_goal', goalId],
    queryFn: async (): Promise<SavingsGoal> => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('id', goalId!)
        .single()
      if (error) throw error
      return data as SavingsGoal
    },
    enabled: Boolean(goalId),
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
    mutationFn: async (goal: NewGoal) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('savings_goals')
        .insert({ ...goal, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as SavingsGoal
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsQueryKey(user?.id) }),
  })
}

export function useUpdateGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SavingsGoal> }) => {
      const { data, error } = await supabase
        .from('savings_goals')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as SavingsGoal
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: goalsQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['savings_goal', data.id] })
    },
  })
}

export function useDeleteGoal() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsQueryKey(user?.id) }),
  })
}

/** Persists a new sort order for the goals list (drag-to-reorder / "use suggested order"). */
export function useReorderGoals() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from('savings_goals').update({ sort_order: index }).eq('id', id),
        ),
      )
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: goalsQueryKey(user?.id) }),
  })
}

export function useAddContribution() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      goalId,
      amount,
      note,
    }: {
      goalId: string
      amount: number
      note?: string
    }) => {
      if (!user) throw new Error('Not signed in')
      const { error: contribError } = await supabase
        .from('goal_contributions')
        .insert({ goal_id: goalId, user_id: user.id, amount, note: note ?? null })
      if (contribError) throw contribError

      const { data: goal, error: goalError } = await supabase
        .from('savings_goals')
        .select('current_amount, target_amount')
        .eq('id', goalId)
        .single()
      if (goalError) throw goalError

      const nextAmount = goal.current_amount + amount
      const { error: updateError } = await supabase
        .from('savings_goals')
        .update({
          current_amount: nextAmount,
          is_completed: nextAmount >= goal.target_amount,
          completed_at: nextAmount >= goal.target_amount ? new Date().toISOString() : null,
        })
        .eq('id', goalId)
      if (updateError) throw updateError
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: goalsQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['savings_goal', variables.goalId] })
      queryClient.invalidateQueries({ queryKey: contributionsQueryKey(variables.goalId) })
    },
  })
}
