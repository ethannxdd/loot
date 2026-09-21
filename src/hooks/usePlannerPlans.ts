import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NewPlannerPlan, PlannerPlan } from '@/lib/types'
import { useAuth } from './useAuth'

export function plannerPlansQueryKey(userId: string | undefined) {
  return ['planner_plans', userId] as const
}

export function usePlannerPlans() {
  const { user } = useAuth()
  return useQuery({
    queryKey: plannerPlansQueryKey(user?.id),
    queryFn: async (): Promise<PlannerPlan[]> => {
      const { data, error } = await supabase
        .from('planner_plans')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as PlannerPlan[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

export function useCreatePlannerPlan() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plan: NewPlannerPlan) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('planner_plans')
        .insert({ ...plan, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as PlannerPlan
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: plannerPlansQueryKey(user?.id) }),
  })
}

export function useUpdatePlannerPlan() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<PlannerPlan> }) => {
      const { data, error } = await supabase
        .from('planner_plans')
        .update(patch)
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as PlannerPlan
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: plannerPlansQueryKey(user?.id) }),
  })
}

export function useDeletePlannerPlan() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('planner_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: plannerPlansQueryKey(user?.id) }),
  })
}
