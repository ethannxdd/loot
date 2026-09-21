import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Debt, NewDebt } from '@/lib/types'
import { useAuth } from './useAuth'

export function debtsQueryKey(userId: string | undefined) {
  return ['debts', userId] as const
}

export function useDebts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: debtsQueryKey(user?.id),
    queryFn: async (): Promise<Debt[]> => {
      const { data, error } = await supabase
        .from('debts')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Debt[]
    },
    enabled: Boolean(user?.id),
    staleTime: 10_000,
  })
}

export function useCreateDebt() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (debt: NewDebt) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('debts')
        .insert({ ...debt, user_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as Debt
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: debtsQueryKey(user?.id) }),
  })
}

export function useUpdateDebt() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Debt> }) => {
      const { data, error } = await supabase.from('debts').update(patch).eq('id', id).select().single()
      if (error) throw error
      return data as Debt
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: debtsQueryKey(user?.id) }),
  })
}

export function useDeleteDebt() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('debts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: debtsQueryKey(user?.id) }),
  })
}
