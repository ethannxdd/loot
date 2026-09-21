import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { NewTaxProfile, TaxProfile } from '@/lib/types'
import { useAuth } from './useAuth'

export function taxProfileQueryKey(userId: string | undefined) {
  return ['tax_profile', userId] as const
}

export function useTaxProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: taxProfileQueryKey(user?.id),
    queryFn: async (): Promise<TaxProfile | null> => {
      const { data, error } = await supabase
        .from('tax_profile')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data as TaxProfile | null
    },
    enabled: Boolean(user?.id),
    staleTime: 30_000,
  })
}

export function useUpsertTaxProfile() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (patch: NewTaxProfile) => {
      if (!user) throw new Error('Not signed in')
      const { data, error } = await supabase
        .from('tax_profile')
        .upsert({ ...patch, user_id: user.id }, { onConflict: 'user_id' })
        .select()
        .single()
      if (error) throw error
      return data as TaxProfile
    },
    onSuccess: (data) => queryClient.setQueryData(taxProfileQueryKey(user?.id), data),
  })
}
