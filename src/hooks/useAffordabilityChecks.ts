import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AffordabilityCheck, AffordabilityVerdict } from '@/lib/types'
import { useAuth } from './useAuth'

export function affordabilityChecksQueryKey(userId: string | undefined) {
  return ['affordability_checks', userId] as const
}

export function useAffordabilityChecks(limit = 15) {
  const { user } = useAuth()
  return useQuery({
    queryKey: affordabilityChecksQueryKey(user?.id),
    queryFn: async (): Promise<AffordabilityCheck[]> => {
      const { data, error } = await supabase
        .from('affordability_checks')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) throw error
      return data as AffordabilityCheck[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

interface NewCheck {
  item_name: string
  amount: number
  is_recurring: boolean
  verdict: AffordabilityVerdict
  reasoning: string
  disposable_at_check: number
  currency_code: string
}

export function useCreateAffordabilityCheck() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (check: NewCheck) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('affordability_checks')
        .insert({ ...check, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as AffordabilityCheck
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: affordabilityChecksQueryKey(user?.id) })
    },
  })
}
